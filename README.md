# Shared Task Notifications

Shared Task Notifications is a simple web app for small groups that need to assign work and keep everyone informed.

## What the app does

After creating an account, a person can:

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

This is an AWS re/Start group project. The team is building the first version with a simple web interface, secure sign-in, task storage, and email notifications.

## Team

| Team member | Primary role | Secondary role | AWS Services
| --- | --- | --- | --- |
| Ruthvik | Project Manager | Junior Cloud Engineer | SNS, SES, Lambda(notification)
| Chris | Cloud Infrastructure Architect | Business Analyst | IAM, Cognito, API Gateway
| Noor | Frontend Developer | Junior Cloud Engineer | S3, CloudFront, HTML, CSS, Javascript
| Duke | Backend Developer | Junior Cloud Engineer | DynamoDB, Lambda(Task)
| Gokila | Quality Assurance and Testing Lead | Junior Cloud Engineer | CloudWatch

## For contributors

Project planning notes are in [team-draft.md](team-draft.md).
