# S3NT: DynamoDB Data Model Template

Use the [backend build checklist](../specs/S3NT_BACKEND_SPEC.md) and the
[approved architecture](architecture.md). Do not add MVP features or change
the API contract while filling this out.

## What to complete

- [x] Define the primary key for each table.
- [x] List every stored attribute and its DynamoDB type.
- [x] Define the listed GSIs, including their partition key and sort key.
- [x] Map every access pattern to a table or GSI query.
- [x] Mark internal attributes that must never appear in API responses.

Use DynamoDB terms: **items** and **attributes**, not SQL rows and columns.

## 1. Users table

Purpose: store the application profile and provide the assignee directory.

| Item detail | Fill in |
| --- | --- |
| Table name | `Users` |
| Primary key attribute and type | `userId` (String) |
| Directory GSI name | `directoryPk-displayNameKey` |
| Directory GSI partition key | `directoryPk` (String), constant value `DIRECTORY` |
| Directory GSI sort key | `displayNameKey` (String), lowercase display name + `#` + `userId` |
| Directory ordering | Display names, case-insensitive; duplicate names must remain stable. |

Required attributes:

| Attribute | DynamoDB type | Public API field? | Notes |
| --- | --- | --- | --- |
| `userId` | String | Yes | Cognito `sub`. |
| `displayName` | String | Yes | Returned by `/me` and `/assignees`. |
| `email` | String | `/me` only | Never return from `/assignees`. |
| `emailNotificationsEnabled` | Boolean | `/me` only | Used by notification processing. |
| `createdAt` | String | Yes | Server-generated ISO 8601 timestamp. |
| `directoryPk` | String | No | Constant `DIRECTORY`; needed for the assignee-directory GSI. |
| `displayNameKey` | String | No | Lowercase `displayName` + `#` + `userId` for stable directory ordering. |

## 2. Tasks table

Purpose: store each task once, support idempotent creation, and list tasks by
creator or assignee.

| Item detail | Fill in |
| --- | --- |
| Table name | `Tasks` |
| Primary key attribute and type | `taskId` (String) |
| Creator-list GSI name | `creatorId-createdSortKey` |
| Creator-list GSI partition key | `creatorId` (String) |
| Creator-list GSI sort key | `createdSortKey` (String) = `{createdAt}#{taskId}` |
| Assignee-list GSI name | `assigneeId-createdSortKey` |
| Assignee-list GSI partition key | `assigneeId` (String) |
| Assignee-list GSI sort key | `createdSortKey` (String) = `{createdAt}#{taskId}` |
| List ordering | Newest task first (`Query` `ScanIndexForward=false`). |

Required attributes:

| Attribute | DynamoDB type | Public API field? | Notes |
| --- | --- | --- | --- |
| `taskId` | String | Yes | Client-provided lowercase UUID v4; use for idempotency. |
| `title` | String | Yes | 1–140 UTF-8 bytes. |
| `description` | String | Yes | 1–4,000 UTF-8 bytes. |
| `creatorId` | String | Yes | Get from the Cognito token, not the request body. |
| `assigneeId` | String | Yes | Must be a registered user. |
| `status` | String | Yes | `open` or `complete`. |
| `createdAt` | String | Yes | Server-generated ISO 8601 UTC timestamp. |
| `completedAt` | String | Yes | `null` until completed; omit the DynamoDB attribute until then. |
| `createdSortKey` | String | No | `{createdAt}#{taskId}` for both task-list GSIs. |
| `notificationPublishState` | String | No | Internal publish/retry state; this slice stores `unpublished`. |

## 3. Notifications table

Purpose: store one email-notification result for each task and let a recipient
view their completed notification history.

| Item detail | Fill in |
| --- | --- |
| Table name | `Notifications` |
| Primary key attribute and type | `taskId` (String) |
| Recipient-history GSI name | `historyRecipientId-historySortKey` |
| Recipient-history GSI partition key | `historyRecipientId` (String) |
| Recipient-history GSI sort key | `historySortKey` (String) = `{createdAt}#{taskId}` |
| History ordering | Newest terminal notification first (`Query` `ScanIndexForward=false`). |
| Sparse-index rule | Set `historyRecipientId` and `historySortKey` only after status is terminal (`sent`, `skipped`, `failed`, `unknown`). |

Required attributes:

| Attribute | DynamoDB type | Public API field? | Notes |
| --- | --- | --- | --- |
| `taskId` | String | Yes | One notification record per task. |
| `recipientId` | String | Yes, when terminal | Assignee who receives the notification. |
| `channel` | String | Yes | Always `email` for MVP. |
| `status` | String | Yes, when terminal | `sent`, `skipped`, `failed`, or `unknown`. |
| `createdAt` | String | Yes | Notification processing timestamp. |
| `sentAt` | String | Yes | `null` unless SES accepted the send; omit the DynamoDB attribute until then. |
| `failureReason` | String | Yes, when applicable | Safe reason code only. |
| `historyRecipientId` | String | No | Equals `recipientId` only when terminal. |
| `historySortKey` | String | No | `{createdAt}#{taskId}` when terminal. |
| `deliveryState` | String | No | Internal processing state only. |
| `attemptCount` | Number | No | Enforce one SES attempt at most. |

## 4. Access-pattern map

Fill in the table/index used for each action. Do not use DynamoDB scans.

| Action | Table or GSI used | Query/read/write notes |
| --- | --- | --- |
| `GET /me` | `Users` table | `GetItem` by `userId` from the JWT `sub`; use a consistent read. |
| `PATCH /me` | `Users` table | `UpdateItem` by `userId`; rewrite `displayNameKey` when `displayName` changes. |
| `GET /assignees` | Users GSI `directoryPk-displayNameKey` | `Query` `directoryPk=DIRECTORY`; return only `userId` and `displayName`. |
| `POST /tasks` | Users table + Tasks table | `GetItem` assignee; conditional `PutItem` on `taskId`; identical retry `GetItem`. |
| `GET /tasks?role=created` | Tasks GSI `creatorId-createdSortKey` | `Query` PK = JWT `sub`, `ScanIndexForward=false`, opaque `nextToken`. |
| `GET /tasks?role=assigned` | Tasks GSI `assigneeId-createdSortKey` | `Query` PK = JWT `sub`, `ScanIndexForward=false`, opaque `nextToken`. |
| `PATCH /tasks/{taskId}/status` | `Tasks` table | `GetItem` then `UpdateItem`; caller must be `assigneeId`. |
| Notification Lambda processing | Users + Tasks + Notifications | Writer path; not implemented in this slice. |
| `GET /tasks/{taskId}/notification` | Tasks then Notifications | Authorize from the task, then `GetItem` by `taskId`; missing item → `null`. |
| `GET /notifications` | Notifications GSI `historyRecipientId-historySortKey` | `Query` PK = JWT `sub`, newest first, opaque pagination. |

## 5. Review checklist

- [x] Every backend route has a direct key or GSI access path.
- [x] The assignee directory returns only `userId` and `displayName`.
- [x] A task is saved before its notification begins.
- [x] Task and notification internal state cannot appear in public responses.
- [x] Task lists and notification history can be queried newest first.
