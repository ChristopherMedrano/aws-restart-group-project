# QA Test Account Plan Template

**Owner:** Gokila

| Alias | Purpose | Profile confirmed? | Email notifications | Notes |
| --- | --- | --- | --- | --- |
| `qa-creator-enabled` | Creates a task. | [ ] | On | |
| `qa-assignee-enabled` | Receives a task and email. | [ ] | On | |
| `qa-assignee-disabled` | Receives a task without email. | [ ] | Off | |
| `qa-unrelated` | Tests that another user's task is denied. | [ ] | Either | |

## Example

`qa-assignee-disabled` is confirmed and has notifications off. When assigned a
task, the expected notification result is `skipped`; no email is expected.

## Before a test run

- [ ] Confirm the required accounts exist.
- [ ] Confirm enabled/disabled notification preferences.
- [ ] Use a new UUID task ID and neutral task text.
- [ ] Record only safe evidence and task IDs.
