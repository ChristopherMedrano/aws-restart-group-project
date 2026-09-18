# S3NT - Share Tasks. Send Simple Notifications

S3NT is a simple web app for small groups that need to assign work and keep everyone informed.


## Planned app behavior

After creating an account, a person will be able to:

- Create a task with a title and details.
- Assign that task to another registered person.
- See tasks assigned to them.
- Mark an assigned task as complete.
- Choose whether they want assignment emails.
- View the history of assignment notifications.

For example, Ruthvik can assign “Prepare the project slides” to Noor. Noor sees the task in the app and, if email notifications are turned on, receives an email about it.

## Why it is useful

Small teams often need a lightweight way to make responsibilities clear without using a large project-management platform. This app keeps task assignment and notification preferences in one place.

Most importantly, assigning a task does not depend on an email being delivered. The task is saved first. If an email is turned off or cannot be sent, the app records that result without losing the assignment.

## What users will see

The app will include:

- A registration page for new users.
- A sign-in page for returning users.
- A task-creation and assignment form.
- An assigned-tasks view.
- A notification-preferences setting.
- A notification-history view showing whether an email was sent, skipped, or failed.

## Privacy and safety

Users sign in before viewing or changing tasks. Each person can update only their own profile and notification preference, and only the person assigned to a task can mark it complete. The app is designed to keep login details and unnecessary personal information out of activity records.

## Project status

Planning and architecture for the MVP are complete. Implementation is in
progress on shared-dev. Current work, owners, and remaining items are tracked
in the [GitHub issue tracker](https://github.com/ChristopherMedrano/aws-restart-group-project/issues).

## Reference architecture diagram

> This is a simplified reference diagram. The approved detailed architecture
> plan is maintained in [architecture.md](docs/architecture/architecture.md).

```text
Browser
  |-- CloudFront (HTTPS, SPA fallback, security headers)
  |     `-- private S3 bucket (OAC-only static assets)
  |
  |-- Cognito managed pages (authorization code + PKCE)
  |     `-- Post-confirmation Lambda --> Users table
  |
  `-- API Gateway HTTP API (JWT + exact CORS)
        `-- Task API Lambda
              |-- Users table / directory GSI
              |-- Tasks table / creator and assignee GSIs
              |-- Notifications table (authorized reads)
              `-- SNS assignment topic
                    |-- Notification Lambda
                    |     |-- Users, Tasks, and Notifications tables
                    |     `-- SES (one send attempt at most)
                    |
                    `-- SNS-delivery failure SQS queue

Notification Lambda exhausted asynchronous invocation
  `-- Lambda-invocation failure SQS queue

Lambdas and managed services --> CloudWatch logs, metrics, alarms,
                              operations-alert topic, and project dashboard
```

## Team

| Team member | Primary role | Secondary role | Assigned AWS-service ownership |
| --- | --- | --- | --- |
| Ruthvik | Project Manager | Junior Cloud Engineer | SNS, SES, Lambda(notification) |
| Chris | Cloud Infrastructure Architect | Business Analyst | IAM, Cognito, API Gateway |
| Noor | Frontend Developer | Junior Cloud Engineer | S3, CloudFront |
| Duke | Backend Developer | Junior Cloud Engineer | DynamoDB, Lambda(Task) |
| Gokila | Quality Assurance and Testing Lead | Junior Cloud Engineer | CloudWatch |

AWS configuration is completed as a group. Each team member owns the assigned
service area: learns its role and key settings, participates in the group
walkthrough, records configuration evidence, and handles first-line questions.
Chris retains responsibility for cross-service architecture, security-sensitive
decisions, and final review.

## For contributors

[working agreement](docs/project/working-agreement.md),
[AWS account baseline](docs/project/account-baseline.md),
[approved architecture](docs/architecture/architecture.md),
[local SAM setup](infra/README.md#run-the-api-locally-with-sam), and
[GitHub issue tracker](https://github.com/ChristopherMedrano/aws-restart-group-project/issues).
