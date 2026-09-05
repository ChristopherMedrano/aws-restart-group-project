# Defect Report Example

Use the repository's [defect form](../../.github/ISSUE_TEMPLATE/defect.yml) for the actual report. This example shows the level of detail needed.

| Form field | Example |
| --- | --- |
| Title | `Task completion is denied for the assigned user` |
| Observed behavior | `PATCH /tasks/<safe-task-id>/status returned 403 while signed in as the assigned user.` |
| Expected behavior | `The assigned user can mark an open task complete. See S3NT Backend Build Checklist, Complete task.` |
| Safe reproduction | `1. Create a task for qa-assignee-enabled. 2. Sign in as qa-assignee-enabled. 3. Send status complete request.` |
| Environment | `shared-dev, build abc123` |
| Impact | `User cannot see tasks` |
| Evidence | `Sanitized response status and safe task ID only; no token or email address.` |

Do not include credentials, tokens, real email addresses, or sensitive task
content in a defect report.
