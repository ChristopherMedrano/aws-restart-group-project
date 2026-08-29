# Shared Task Notifications — Team Draft

## Problem Statement

Teams need a simple way to assign tasks and let people know when a task is assigned to them. The app should save the task even if an email cannot be sent. Each user can choose whether to receive assignment emails.

## Architecture

The app uses a small serverless AWS setup:

```text
Browser → CloudFront → private S3 bucket (static frontend)
   │
   ├── Cognito (sign-up, sign-in, and JWTs)
   │      └── Post-confirmation Lambda → Users table
   │
   └── API Gateway → Task Lambda → DynamoDB
                            │
                            ▼
                           SNS
                            │
                            ▼
                 Notification Lambda → SES
                            │
                            ├──────────────→ SQS failure queue (exhausted failures only)
                            ▼
                        DynamoDB
```

- A private S3 bucket stores the static HTML, CSS, and JavaScript frontend.
- CloudFront is the required public HTTPS entry point for the frontend and reads the private bucket through Origin Access Control (OAC).
- Cognito handles sign-up and sign-in.
- A Cognito Post-confirmation Lambda creates the user's application profile in the Users table.
- API Gateway receives requests from the web app.
- The Task Lambda creates tasks and assignments.
- DynamoDB stores users, tasks, and notification results.
- SNS sends assignment events to the Notification Lambda.
- The Notification Lambda checks the user’s preference and sends email through SES when enabled.
- CloudWatch Logs for all three Lambdas help us trace requests and troubleshoot problems.

## Data Model

We will use three DynamoDB tables.

| Table | Main information |
| --- | --- |
| Users | User ID, display name, email, email preference, creation date |
| Tasks | Task ID, title, details, creator, assignee, status, timestamps |
| Notifications | Task ID, recipient, email result, timestamps |

Task status will be `open` or `complete`. Notification status will be `sent`, `skipped`, `failed`, or `unknown`; `unknown` means an email might have been accepted but its final result could not be recorded.

## Event Flow

1. A signed-in user creates a task and assigns it to another user.
2. The browser supplies a UUID task ID; the Task Lambda uses it to make retries idempotent, validates the request, and saves the assignment in DynamoDB.
3. It publishes a `task.assigned` event to SNS.
4. SNS triggers the Notification Lambda in the background.
5. The Notification Lambda checks the assignee’s email setting.
6. If email is enabled, it sends an email through SES and records the result.
7. If email is disabled, it records the notification as `skipped`.
8. A confirmed email failure is `failed`; an interrupted, uncertain outcome is `unknown`. The task stays assigned either way.
9. Exhausted Notification Lambda failures are retained in a separate SQS failure queue and surfaced by CloudWatch alarms; SQS is not part of normal delivery.

## Technology Choices

| Need | Choice |
| --- | --- |
| Frontend | HTML, CSS, and JavaScript |
| Frontend hosting | Private Amazon S3 bucket behind Amazon CloudFront with OAC |
| Authentication | Amazon Cognito |
| API | API Gateway HTTP API |
| Backend | Python on AWS Lambda |
| Database | Amazon DynamoDB |
| Events | Amazon SNS |
| Failure retention | Amazon SQS Standard queue, only after Lambda retries are exhausted |
| Email | Amazon SES |
| Logs | Amazon CloudWatch and free CloudTrail management-event history |