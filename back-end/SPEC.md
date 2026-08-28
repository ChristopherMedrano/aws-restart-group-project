# Backend specification

## Purpose and boundaries

Python AWS Lambda backend for the Shared Task Notifications MVP. API Gateway HTTP
API accepts authenticated JSON requests; DynamoDB stores application data; SNS
delivers `task.assigned` events directly to the Notification Lambda; SES sends
the MVP email. SQS is outside the MVP.

All timestamps are ISO-8601 UTC strings. The MVP has no deletion, reassignment,
comments, attachments, reminders, or notification channels other than email.

## Authentication and authorization

Every API route requires a valid Cognito User Pool access token with
`shared-task-api/access`. API Gateway validates the token; the Task API Lambda
reads the caller only from JWT claim `sub`.

- A user may read and update only their own profile.
- A caller may list only tasks they created or tasks assigned to them.
- A caller may mark a task complete only when they are its assignee.
- Client request bodies never supply creator or caller IDs.
- Cognito owns email verification and email changes; this API updates only
  `displayName` and `emailNotificationsEnabled`.

## JSON data shapes

### User

```json
{
  "userId": "cognito-sub",
  "displayName": "Alice",
  "email": "alice@example.com",
  "emailNotificationsEnabled": true,
  "createdAt": "2026-08-28T14:00:00Z"
}
```

### Task

```json
{
  "taskId": "uuid",
  "title": "Review proposal",
  "description": "Add notes by Friday",
  "status": "open",
  "creatorId": "cognito-sub",
  "assigneeId": "cognito-sub",
  "createdAt": "2026-08-28T14:00:00Z",
  "completedAt": null
}
```

### Notification

```json
{
  "notificationId": "uuid",
  "eventId": "uuid",
  "taskId": "uuid",
  "recipientId": "cognito-sub",
  "channel": "email",
  "status": "sent",
  "deliveryState": "complete",
  "attemptCount": 1,
  "claimStartedAt": "2026-08-28T14:01:00Z",
  "createdAt": "2026-08-28T14:01:00Z",
  "sentAt": "2026-08-28T14:01:01Z",
  "failureReason": null
}
```

### Assignment event

```json
{
  "eventType": "task.assigned",
  "eventId": "uuid",
  "taskId": "uuid",
  "assigneeId": "cognito-sub",
  "occurredAt": "2026-08-28T14:00:00Z"
}
```

`Task.status` is `open` or `complete`. `Notification.status` is `sent`,
`skipped`, or `failed`; `channel` is always `email`. `deliveryState` is internal:
`processing` or `complete`; notification history returns only complete
records. `eventId` is generated once by the Task API Lambda and remains unchanged
if SNS redelivers the event.

All failures use:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "title is required"
  }
}
```

## REST API

All routes require the Cognito JWT. Responses wrap resources in a named key.

### `GET /me`

Response: `200` with a `user` object.

Errors: `401` for an invalid or absent JWT; `404` when the profile is missing.

### `PATCH /me`

Request — include at least one allowed field:

```json
{
  "displayName": "Alice",
  "emailNotificationsEnabled": true
}
```

Response: `200` with the updated `user` object.

Errors: `400` for unknown or invalid fields; `401` for an invalid or absent JWT;
`404` when the profile is missing.

### `POST /tasks`

Request — every field is required:

```json
{
  "title": "Review proposal",
  "description": "Add notes by Friday",
  "assigneeId": "cognito-sub"
}
```

Response: `201` with the saved `task` object. The API validates the assignee,
saves the task, then publishes `task.assigned`.

Errors: `400` for invalid input; `401` for an invalid or absent JWT; `404` for an
unknown assignee.

If SNS publication fails after saving the task, retain the task and return `503`:

```json
{
  "error": {
    "code": "EVENT_PUBLISH_FAILED",
    "message": "Task was saved but notification initiation failed"
  },
  "taskId": "uuid"
}
```

### `GET /tasks?role=created|assigned`

Response: `200` with a `tasks` array for the selected caller-owned role.

Errors: `400` for a missing or invalid `role`; `401` for an invalid or absent JWT.

### `PATCH /tasks/{taskId}/status`

Request:

```json
{
  "status": "complete"
}
```

Response: `200` with the completed `task` object. Only the assignee may complete
the task; repeating completion returns the existing completed task.

Errors: `400` for another status; `401` for an invalid or absent JWT; `403` when
the caller is not the assignee; `404` when the task is missing.

### `GET /notifications`

Response: `200` with a `notifications` array for the caller's received
notifications only.

Errors: `401` for an invalid or absent JWT.

## DynamoDB design

| Table | Primary key | Required indexes | Use |
| --- | --- | --- | --- |
| Users | `userId` (PK) | None | Profile and email preference lookup. |
| Tasks | `taskId` (PK) | `creatorId-createdAt`, `assigneeId-createdAt` GSIs | Get by ID; list caller-created or caller-assigned tasks, newest first. |
| Notifications | `eventId` (PK) | `recipientId-createdAt` GSI | Conditional create by event ID for idempotency; list a recipient's history, newest first. |

The Notifications item retains `notificationId` for the public data model. Its
`eventId` primary key is the durable idempotency key: one task assignment and all
of its retries share the same value.

## Notification delivery and idempotency

SNS invokes the Notification Lambda asynchronously and may retry an invocation,
so duplicate events are expected.

1. Conditionally create the Notifications item by `eventId` with
   `deliveryState=processing`, `attemptCount=1`, and `claimStartedAt=now`. Only
   the invocation that creates it may call SES.
2. If an item already has a terminal state, acknowledge the duplicate and return.
   If it is `processing` and less than 30 seconds old, treat the original as
   active and return without changing it. If it is at least 30 seconds old—twice
   the configured Lambda timeout—conditionally change it from `processing` to
   `failed` with the safe reason `delivery outcome unknown after interrupted
   attempt`, then return without SES.
3. With email disabled, set `status=skipped` and `deliveryState=complete`. With
   SES success, set `status=sent`, record `sentAt`, and complete the record.
4. On SES failure, set `status=failed`, store a safe `failureReason`, complete the
   record, and return successfully so SNS does not retry a known delivery failure.

This MVP intentionally chooses at-most-once email attempts. A crash after SES
accepts the email but before DynamoDB records success can produce a conservative
`failed` outcome, but a later invocation does not send a duplicate email. Log the
shared `eventId` so the uncertain outcome is traceable.

## Python function contracts

```python
def post_confirmation_handler(event: dict, context: object) -> dict:
    """Input: Cognito PostConfirmation event. Output: the unchanged event.
    Create the Users record from Cognito `sub`, `email`, and standard `name` claims with
    emailNotificationsEnabled=True; safely tolerate a replay for the same user.
    """

def api_handler(event: dict, context: object) -> dict:
    """Input: API Gateway HTTP API event with validated JWT claims. Output: HTTP response.
    Route the request, validate JSON, and turn domain errors into the shared envelope.
    """

def create_task(caller_id: str, payload: dict) -> dict:
    """Input: caller sub and title, description, assigneeId. Output: saved Task.
    Validate the assignee, persist an open task, then publish one task.assigned event.
    """

def list_tasks(caller_id: str, role: str) -> list[dict]:
    """Input: caller sub and created or assigned role. Output: caller-scoped Tasks.
    Query the corresponding Tasks GSI.
    """

def complete_task(caller_id: str, task_id: str) -> dict:
    """Input: caller sub and task ID. Output: completed Task.
    Require the caller to be assignee and set status/complete timestamp once.
    """

def update_profile(caller_id: str, payload: dict) -> dict:
    """Input: caller sub and allowed profile fields. Output: updated User.
    Update only displayName and/or emailNotificationsEnabled on that caller's record.
    """

def notification_handler(event: dict, context: object) -> None:
    """Input: SNS event containing task.assigned messages. Output: none.
    Claim each event by eventId, then skip, send once, or record failure.
    """

def record_notification_if_new(assignment_event: dict) -> bool:
    """Input: validated assignment event. Output: whether it was claimed.
    Conditionally create by eventId; never reclaim an existing email attempt.
    Ignore active duplicates and close processing claims older than 30 seconds as
    uncertain failures without calling SES.
    """

def send_assignment_email(user: dict, task: dict) -> None:
    """Input: recipient User and assigned Task. Output: none or delivery exception.
    Send the minimal assignment email through SES without exposing secrets or tokens.
    """
```

When a newly recorded event has email disabled, set its result to `skipped` and do
not call SES. On SES failure, record a safe final `failed` result without an
application retry. A notification failure never changes the task.

## IAM, logging, and tests

- **Task API Lambda:** least-privilege Users/Tasks read-write, query-only access
  to the Notifications `recipientId-createdAt` GSI, SNS publish, and CloudWatch
  Logs access.
- **Notification Lambda:** read `userId`, `email`, and
  `emailNotificationsEnabled` from Users; get a Task by `taskId`; Notifications
  read-write; SES send
  through the approved sender identity; and CloudWatch Logs access. It reads the
  Task after receiving its event so the email can contain assignment details
  without putting them in SNS.
- **Post-confirmation Lambda:** Users create/write and CloudWatch Logs access.
- Log structured request ID, event ID, task ID, function name, and notification
  status. Never log JWTs, passwords, or unnecessary personal data.
- Test invalid/missing JWTs; profile ownership; validation; unknown assignees;
  task-query scoping; assignee-only completion; enabled, disabled, and failed email
  paths; SNS publish failure after save; concurrent duplicate SNS events; the
  30-second stale-processing transition without a second SES call; and an
  SES-success/DynamoDB-crash uncertainty case.

## Deployment defaults

### DynamoDB capacity

Use provisioned capacity to remain inside the always-free DynamoDB allowance,
assuming the account has no other provisioned DynamoDB usage:

- Users table: 1 RCU and 1 WCU.
- Tasks table and each of its two GSIs: 1 RCU and 1 WCU each.
- Notifications table and its GSI: 1 RCU and 1 WCU each.
- Combined project allocation: 6 RCU and 6 WCU.

Use `ALL` projection for the three GSIs. Enable table deletion protection. Keep
point-in-time recovery disabled unless class-account coverage is confirmed.

### HTTP API and JWT

- Stage: `$default` with auto-deploy enabled; the API base URL has no stage suffix.
- Routes: `GET /me`, `PATCH /me`, `POST /tasks`, `GET /tasks`,
  `PATCH /tasks/{taskId}/status`, and `GET /notifications`.
- JWT issuer: the project Cognito User Pool issuer URL.
- JWT audience: the public SPA app-client ID; every route requires authorization
  scope `shared-task-api/access`.
- CORS origins during class development: the exact CloudFront site origin and
  `http://localhost:8000`; remove localhost after local testing ends.
- CORS methods: `GET`, `POST`, `PATCH`, and `OPTIONS`.
- CORS headers: `Authorization` and `Content-Type`; credentials are disabled.

### Lambda configuration

| Function | Runtime | Memory | Timeout | Environment variables |
| --- | --- | ---: | ---: | --- |
| Task API | Python 3.13 | 256 MB | 10 seconds | `USERS_TABLE_NAME`, `TASKS_TABLE_NAME`, `NOTIFICATIONS_TABLE_NAME`, `ASSIGNMENT_TOPIC_ARN`, `LOG_LEVEL=INFO` |
| Post-confirmation | Python 3.13 | 128 MB | 5 seconds | `USERS_TABLE_NAME`, `LOG_LEVEL=INFO` |
| Notification | Python 3.13 | 256 MB | 15 seconds | `USERS_TABLE_NAME`, `TASKS_TABLE_NAME`, `NOTIFICATIONS_TABLE_NAME`, `SES_FROM_ADDRESS`, `LOG_LEVEL=INFO` |

Use the default 512 MB ephemeral storage, no VPC attachment, no provisioned
concurrency, and pre-created CloudWatch log groups with 7-day retention.
