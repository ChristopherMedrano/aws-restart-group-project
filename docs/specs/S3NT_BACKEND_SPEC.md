# S3NT: Backend Build Checklist

Build one piece at a time and test each API route before starting the next.

## 1. Set up authentication and users

- [ ] Use Cognito sign-in and require a valid access token for every API route.
- [ ] Read the caller's user ID from the validated token. Never accept it from
  the request body.
- [ ] Create a user record when Cognito confirms registration.
- [ ] Store `userId`, `displayName`, `email`, `emailNotificationsEnabled`, and
  `createdAt` for each user.
- [ ] Keep email read-only in the app.

## 2. Build profile and assignee routes

- [x] Add `GET /me` to return the signed-in user's profile as `{"user": ...}`.
- [ ] Add `PATCH /me` to update `displayName` and/or
  `emailNotificationsEnabled`.
- [ ] Add `GET /assignees` to return registered users as `userId` and
  `displayName` only.
- [ ] Include the current user in `/assignees` so self-assignment works.
- [ ] Do not return emails or notification preferences from `/assignees`.

## API route reference

All routes require `Authorization: Bearer <Cognito access token>` and return
JSON.

| Method and route | Request | Success response | Who may use it |
| --- | --- | --- | --- |
| `GET /me` | No body or query parameters. The required Cognito bearer token identifies the caller. | `200 {"user": user}` | Signed-in user; their own profile only. |
| `PATCH /me` | `{"displayName":"...","emailNotificationsEnabled":true}`; either field may be sent | `200 {"user": user}` | Signed-in user; their own profile only. |
| `GET /assignees` | No body or query parameters. The required Cognito bearer token authorizes the caller. | `200 {"assignees":[{"userId":"...","displayName":"..."}]}` | Any signed-in user. |
| `POST /tasks` | `{"taskId":"uuid-v4","title":"...","description":"...","assigneeId":"..."}` | `201 {"task": task}`; `200` for an identical retry | Any signed-in user; caller becomes creator. |
| `GET /tasks?role=assigned` | Required query `role=assigned`; optional `limit` and opaque `nextToken` | `200 {"tasks":[...],"nextToken":"..."}`; omit `nextToken` when there is no next page | Signed-in user; only their assigned tasks. |
| `GET /tasks?role=created` | Required query `role=created`; optional `limit` and opaque `nextToken` | `200 {"tasks":[...],"nextToken":"..."}`; omit `nextToken` when there is no next page | Signed-in user; only their created tasks. |
| `PATCH /tasks/{taskId}/status` | `{"status":"complete"}` | `200 {"task": task}` | Task assignee only. |
| `GET /tasks/{taskId}/notification` | No body or query parameters. `taskId` is in the path; the required Cognito bearer token identifies the caller. | `200 {"notification": notification-or-null}` | Task creator or assignee only. |
| `GET /notifications` | Optional `limit` and opaque `nextToken`. The required Cognito bearer token identifies the caller. | `200 {"notifications":[...],"nextToken":"..."}`; omit `nextToken` when there is no next page | Signed-in user; only their notification history. |

Use `400` for invalid input, `401` for a missing or invalid token, `403` for
an unauthorized task action, and `404` for a missing task, user, or profile.

### Verified `GET /me` implementation

The deployed Task API Lambda reads `sub` from API Gateway's validated JWT
claims, performs a consistent `GetItem` from the `Users` table using that value
as `userId`, and returns `200 {"user": ...}`. Cognito managed login through
the CloudFront demo has verified this path end to end. The remaining profile,
assignee, task, and notification checklist items are not implied complete by
this verification.

## 3. Create and store tasks

- [ ] Add `POST /tasks` with `taskId`, `title`, `description`, and `assigneeId`.
- [ ] Require all four fields. The client sends a lowercase UUID v4 for
  `taskId`.
- [ ] Require a title from 1–140 UTF-8 bytes and a description from 1–4,000
  UTF-8 bytes. Reject blank-only values and carriage returns (`\r`).
- [ ] Confirm the assignee is a registered user. Allow self-assignment.
- [ ] Set `creatorId` from the token, `status` to `open`, and timestamps on the
  server.
- [ ] Store `taskId`, `title`, `description`, `creatorId`, `assigneeId`,
  `status`, `createdAt`, and `completedAt`.
- [ ] Return `201 {"task": ...}` when the task is first created.
- [ ] If the same caller retries with the same task ID and exact data, return
  the existing task instead of creating another one. Return `409` if that ID is
  used with different data.

## 4. List and complete tasks

- [ ] Add `GET /tasks?role=assigned` for tasks assigned to the caller.
- [ ] Add `GET /tasks?role=created` for tasks created by the caller.
- [ ] Return newest tasks first. Support pagination with an optional `limit` and
  an opaque `nextToken`; return `nextToken` only when another page is available.
  Do not let the client construct, inspect, or modify a token.
- [ ] Add `PATCH /tasks/{taskId}/status` and accept only
  `{"status":"complete"}`.
- [ ] Allow only the task assignee to complete a task. Set `completedAt` when
  it is completed. A second completion returns the same completed task.

## 5. Send and show assignment notifications

- [ ] After saving a new task, publish a `task.assigned` event to SNS.
- [ ] Have a Notification Lambda process that event.
- [ ] If the assignee disabled email notifications, store `skipped` and do not
  call SES.
- [ ] Otherwise, make one SES send attempt. Store `sent` if SES accepts it,
  `failed` if it clearly rejects it, or `unknown` if the result cannot be
  confirmed. Do not send a duplicate email.
- [ ] If event publication cannot be confirmed, return `503` with
  `EVENT_PUBLISH_FAILED`. Keep the task saved so the client can retry the same
  request and task ID.
- [ ] Add `GET /tasks/{taskId}/notification`. Let only the task creator or
  assignee read it. Return `{"notification": null}` while it is processing.
- [ ] Add `GET /notifications` for the caller's notification history with the
  same opaque-pagination behavior as task lists. Do not include task titles in
  this response.

## 6. Protect the API

- [ ] Return `400` for invalid input, `401` for a missing or invalid token,
  `403` when a user is not allowed to change or view an item, and `404` for a
  missing item.
- [ ] Check authorization in the backend, not only in the frontend.
- [ ] Do not return tokens, passwords, AWS credentials, email addresses from
  the assignee directory, or stack traces.
- [ ] Log safe errors in CloudWatch without tokens or email addresses.

## 7. Done checklist

- [ ] A registered user can update their profile and choose an assignee.
- [ ] A user can create a task for themself or another registered user.
- [ ] Created and assigned task lists show only the correct user's tasks.
- [ ] Only the assignee can complete a task.
- [ ] A task remains saved if notification delivery has a problem.
- [ ] Retrying a create request does not create another task or email.
- [ ] Notification outcomes are available as `sent`, `skipped`, `failed`, or
  `unknown`.
