# S3NT: DynamoDB Data Model Template

Use the [backend build checklist](../specs/S3NT_BACKEND_SPEC.md) and the
[approved architecture](architecture.md). Do not add MVP features or change
the API contract while filling this out.

## What to complete

- [ ] Define the primary key for each table.
- [ ] List every stored attribute and its DynamoDB type.
- [ ] Define the listed GSIs, including their partition key and sort key.
- [ ] Map every access pattern to a table or GSI query.
- [ ] Mark internal attributes that must never appear in API responses.

Use DynamoDB terms: **items** and **attributes**, not SQL rows and columns.

## 1. Users table

Purpose: store the application profile and provide the assignee directory.

| Item detail | Fill in |
| --- | --- |
| Table name | `Users` |
| Primary key attribute and type | |
| Directory GSI name | `directoryPk-displayNameKey` |
| Directory GSI partition key | |
| Directory GSI sort key | |
| Directory ordering | Display names, case-insensitive; duplicate names must remain stable. |

Required attributes:

| Attribute | DynamoDB type | Public API field? | Notes |
| --- | --- | --- | --- |
| `userId` | | Yes | Cognito user ID. |
| `displayName` | | Yes | Returned by `/me` and `/assignees`. |
| `email` | | `/me` only | Never return from `/assignees`. |
| `emailNotificationsEnabled` | | `/me` only | Used by notification processing. |
| `createdAt` | | Yes | Server-generated timestamp. |
| `directoryPk` | | No | Needed for the assignee-directory GSI. |
| `displayNameKey` | | No | Needed for stable directory ordering. |

## 2. Tasks table

Purpose: store each task once, support idempotent creation, and list tasks by
creator or assignee.

| Item detail | Fill in |
| --- | --- |
| Table name | `Tasks` |
| Primary key attribute and type | |
| Creator-list GSI name | `creatorId-createdSortKey` |
| Creator-list GSI partition key | |
| Creator-list GSI sort key | |
| Assignee-list GSI name | `assigneeId-createdSortKey` |
| Assignee-list GSI partition key | |
| Assignee-list GSI sort key | |
| List ordering | Newest task first. |

Required attributes:

| Attribute | DynamoDB type | Public API field? | Notes |
| --- | --- | --- | --- |
| `taskId` | | Yes | Client-provided lowercase UUID v4; use for idempotency. |
| `title` | | Yes | |
| `description` | | Yes | |
| `creatorId` | | Yes | Get from the Cognito token, not the request body. |
| `assigneeId` | | Yes | Must be a registered user. |
| `status` | | Yes | `open` or `complete`. |
| `createdAt` | | Yes | Server-generated timestamp. |
| `completedAt` | | Yes | `null` until completed. |
| `createdSortKey` | | No | Needed by both task-list GSIs. |
| `notificationPublishState` | | No | Internal publish/retry state only. |

## 3. Notifications table

Purpose: store one email-notification result for each task and let a recipient
view their completed notification history.

| Item detail | Fill in |
| --- | --- |
| Table name | `Notifications` |
| Primary key attribute and type | |
| Recipient-history GSI name | `historyRecipientId-historySortKey` |
| Recipient-history GSI partition key | |
| Recipient-history GSI sort key | |
| History ordering | Newest terminal notification first. |
| Sparse-index rule | Include an item only after its status is terminal. |

Required attributes:

| Attribute | DynamoDB type | Public API field? | Notes |
| --- | --- | --- | --- |
| `taskId` | | Yes | One notification record per task. |
| `recipientId` | | Yes, when terminal | Assignee who receives the notification. |
| `channel` | | Yes | Always `email` for MVP. |
| `status` | | Yes, when terminal | `sent`, `skipped`, `failed`, or `unknown`. |
| `createdAt` | | Yes | Notification processing timestamp. |
| `sentAt` | | Yes | `null` unless SES accepted the send. |
| `failureReason` | | Yes, when applicable | Safe reason code only. |
| `historyRecipientId` | | No | Needed for terminal-history GSI entries. |
| `historySortKey` | | No | Needed for terminal-history GSI ordering. |
| `deliveryState` | | No | Internal processing state only. |
| `attemptCount` | | No | Enforce one SES attempt at most. |

## 4. Access-pattern map

Fill in the table/index used for each action. Do not use DynamoDB scans.

| Action | Table or GSI used | Query/read/write notes |
| --- | --- | --- |
| `GET /me` | | |
| `PATCH /me` | | |
| `GET /assignees` | | |
| `POST /tasks` | | Validate both users; create or read by task ID. |
| `GET /tasks?role=created` | | |
| `GET /tasks?role=assigned` | | |
| `PATCH /tasks/{taskId}/status` | | |
| Notification Lambda processing | | |
| `GET /tasks/{taskId}/notification` | | Authorize from the task first. |
| `GET /notifications` | | |

## 5. Review checklist

- [ ] Every backend route has a direct key or GSI access path.
- [ ] The assignee directory returns only `userId` and `displayName`.
- [ ] A task is saved before its notification begins.
- [ ] Task and notification internal state cannot appear in public responses.
- [ ] Task lists and notification history can be queried newest first.
