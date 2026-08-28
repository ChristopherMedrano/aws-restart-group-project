# Shared Task Notifications — Team Draft

## Problem Statement

Teams need a simple way to assign tasks and let people know when a task is assigned to them. The app should save the task even if an email cannot be sent. Each user can choose whether to receive assignment emails.

## Architecture

The app uses a small serverless AWS setup:

```text
User → Cognito → API Gateway → Task Lambda → DynamoDB
                                      │
                                      ▼
                                     SNS
                                      │
                                      ▼
                         Notification Lambda → SES
                                      │
                                      ▼
                                  DynamoDB
```

- Cognito handles sign-up and sign-in.
- API Gateway receives requests from the web app.
- The Task Lambda creates tasks and assignments.
- DynamoDB stores users, tasks, and notification results.
- SNS sends assignment events to the Notification Lambda.
- The Notification Lambda checks the user’s preference and sends email through SES when enabled.
- CloudWatch Logs help us trace requests and troubleshoot problems.

## Data Model

We will use three DynamoDB tables.

| Table | Main information |
| --- | --- |
| Users | User ID, display name, email, email preference, creation date |
| Tasks | Task ID, title, details, creator, assignee, status, timestamps |
| Notifications | Notification ID, event ID, task ID, recipient, email result, timestamps |

Task status will be `open` or `complete`. Notification status will be `sent`, `skipped`, or `failed`.

## Event Flow

1. A signed-in user creates a task and assigns it to another user.
2. The Task Lambda validates and saves the assignment in DynamoDB.
3. It publishes a `task.assigned` event to SNS.
4. SNS triggers the Notification Lambda in the background.
5. The Notification Lambda checks the assignee’s email setting.
6. If email is enabled, it sends an email through SES and records the result.
7. If email is disabled, it records the notification as `skipped`.
8. If email delivery fails, the task stays assigned and the result is recorded as `failed`.

## Technology Choices

| Need | Choice |
| --- | --- |
| Frontend | Simple HTML, CSS, and JavaScript |
| Authentication | Amazon Cognito |
| API | API Gateway HTTP API |
| Backend | Python on AWS Lambda |
| Database | Amazon DynamoDB |
| Events | Amazon SNS |
| Email | Amazon SES |
| Logs | Amazon CloudWatch |

Optional additions, if the MVP is complete, include S3/CloudFront hosting, SQS for additional reliability, and infrastructure as code with SAM, CloudFormation, or Terraform.
