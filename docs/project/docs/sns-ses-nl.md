# SNS, SES, and Notification Lambda — shared-dev
# Notification foundation — shared-dev

**Owner:** Ruthvik
**Support:** Chris
**AWS ownership:** SNS, Notification Lambda, SES
**Region:** us-east-2
**Recorded:** 09/11/2026

## Service purposes

| Service | Purpose |
| --- | --- |
| SNS | Receives assignment notifications and passes them to Notification Lambda. |
| Notification Lambda | Reads the assignment information and calls SES to send an email. |
| SES | Sends the assignment email to the assignee. |

## Assignment-notification path

SNS → Notification Lambda → SES → Assignee’s email

Saving a task and delivering its email are separate operations.
An email failure must not undo the saved task.

## Basic configuration

| Setting | Value or status | 
| --- | --- | --- |
| SNS topic name | S3NT-shared-dev-Assignments |
| SNS subscription to Notification Lambda | Configured |
| Notification Lambda function name | S3NT-shared-dev-notification |
| SNS trigger on Lambda | [Configured / Pending] |
| Lambda sender environment variable | SENDER_EMAIL — [Configured / Pending] |
| SNS permission to invoke Lambda | [Verified / Pending] |
| Lambda permission to send through SES | [Verified / Pending] |
| SES sender identity | [Verified / Pending — omit email address] |
| SES account status | [Sandbox / Production] |
| SES test recipients verified, if in sandbox | [Verified / Pending / Not applicable] |

## Configuration evidence

- SNS subscription screenshot: [Link]
- Lambda trigger and permissions screenshots: [Link]
- SES verification screenshot: [Link]
- Email test: [Test date, SNS publish or Lambda test, and result]

Remove email addresses, credentials, and personal task information
from screenshots before sharing.

## Group review

- Flow reviewed with the group: [Date / Pending]
- Review outcome: [Brief note]

## Setup blockers for Chris

[Record SES or notification setup blockers, or “None identified.”]

## Scope

No full notification feature coding is required this week.
Detailed event, queue, retry, and delivery behavior remains
in the private MVP reference files.
