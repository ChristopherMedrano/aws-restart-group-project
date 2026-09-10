# QA Manual Test Checklist Template

**Owner:** Gokila

Run these checks only when the shared environment is available. Mark a check
**Blocked** if setup is missing; do not guess a result.

| Check | Steps to write | Expected result | Status | Evidence link or safe task ID |
| --- | --- | --- | --- | --- |
| Read profile | | Signed-in user receives only their own profile. | [ ] Pass [ ] Fail [ ] Blocked | |
| Create task | | A task is saved for a registered assignee. | [ ] Pass [ ] Fail [ ] Blocked | |
| View task lists | | Creator and assignee see the task in the correct list. | [ ] Pass [ ] Fail [ ] Blocked | |
| Complete task | | Assignee can complete; unrelated user receives `403`. | [ ] Pass [ ] Fail [ ] Blocked | |
| Enabled notification | | A terminal notification result is shown. | [ ] Pass [ ] Fail [ ] Blocked | |
| Disabled notification | | Result is `skipped`; no email is expected. | [ ] Pass [ ] Fail [ ] Blocked | |

## Example

For **Complete task**, sign in as `qa-assignee-enabled`, complete the task, and
record the task ID. Then sign in as `qa-unrelated`; the same request should
return `403`.

Never include tokens, passwords, real email addresses, or personal task content
in evidence.
