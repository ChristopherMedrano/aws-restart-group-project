# S3NT MVP — Manual QA Baseline

**Suggested lead:** Gokila  
**Parent epic:** [Project setup, feasibility, and design freeze #10](https://github.com/ChristopherMedrano/aws-restart-group-project/issues/10)  
**Status:** Draft — tests not run; awaiting a test environment and accounts.

## 1. Planned test accounts

Use aliases in documentation and evidence. Set up approved test identities when the environment is available.

| Alias | Purpose | Assignment emails |
|---|---|---|
| `QA_CREATOR` | Creates tasks and assigns them to others | Not relevant to these checks |
| `QA_ENABLED` | Receives assignments and completes own tasks | Enabled |
| `QA_DISABLED` | Receives assignments without email | Disabled |
| `QA_UNRELATED` | Tests unauthorized actions | Not relevant to these checks |

## 2. Six manual checks

For each check, record the actual result and sanitized evidence during execution.

| ID | Check | Steps | Expected result | Status |
|---|---|---|---|---|
| QA-01 | Profile and preferences | Sign in as `QA_ENABLED`. Change the email preference, save, and reload. Restore it to enabled. Attempt to update another test account’s profile or preference using an approved test method. | Own preference persists. Updating another account’s profile or preference is rejected, and its data remains unchanged. | Not run |
| QA-02 | Create and assign task | As `QA_CREATOR`, create `QA task 001` with details `Neutral QA test details` and assign it to `QA_ENABLED`. | Task is saved with the correct title, details, and assignee. Assignment does not depend on email delivery. | Not run |
| QA-03 | Assigned-task lists | Sign in as `QA_ENABLED`, then as `QA_DISABLED` and `QA_UNRELATED`. Check each assigned-tasks view. | `QA task 001` appears in `QA_ENABLED`’s assigned tasks and does not appear in the other accounts’ assigned-task lists. | Not run |
| QA-04 | Completion and 403 | While `QA task 001` is incomplete, attempt completion as `QA_UNRELATED` and `QA_CREATOR`. Then complete it as `QA_ENABLED` and reload. | Non-assignee attempts return `403 Forbidden` and leave the task unchanged. The assignee can complete it, and completion persists. | Not run |
| QA-05 | Enabled notification | With `QA_ENABLED`’s preference enabled, assign a new task to that account. Check the approved test email destination and notification history. | Under working email-service conditions, an assignment email arrives and history records `sent`. The task remains assigned. | Not run |
| QA-06 | Disabled notification | Set `QA_DISABLED`’s preference to disabled. Assign a new task to that account. Check its task list, test email destination, and notification history. | Task is saved and visible to the assignee. No assignment email is sent. History records `skipped`. | Not run |

**Execution note:** QA-01 and QA-04 need an approved way to test unauthorized requests if the UI hides those actions. Record the method once the application is available.

### Test run record

- Date: Pending
- Tester: Pending
- Environment / URL: Pending
- Deployed version: Pending
- Unauthorized-request test method: Pending

| Check | Actual result | Pass / Fail / Blocked / Not run | Sanitized evidence or defect link |
|---|---|---|---|
| QA-01 | Pending execution | Not run | — |
| QA-02 | Pending execution | Not run | — |
| QA-03 | Pending execution | Not run | — |
| QA-04 | Pending execution | Not run | — |
| QA-05 | Pending execution | Not run | — |
| QA-06 | Pending execution | Not run | — |

## 3. Safe test-data rules

- Use neutral titles and details, such as `QA task 001`.
- Use account aliases in the checklist and defect reports.
- Do not include passwords, tokens, real email addresses, or personal data in task text, screenshots, logs, or defect reports.
- Keep test credentials outside this document.
- Sanitize evidence before attaching it to GitHub.

## 4. Defect-form review

**Status:** Pending — the existing GitHub defect form and example have not been reviewed for this baseline.

When available:

- Read both the form and its example.
- Confirm how to record reproduction steps, expected and actual behavior, environment, and sanitized evidence.
- Use the existing form for failures and link each defect to its QA check.

### Review record

- Defect form link: Pending
- Example link: Pending
- Reviewer and date: Pending
- Review notes: Pending

## 5. Needed before execution

- MVP test URL and deployed version.
- Four approved test accounts.
- Access to an approved email test destination and notification history.
- An approved method for checking unauthorized requests and HTTP responses.
- Links to the existing defect form and example.

**Open requirement:** The app also promises `failed` notification history without losing the assignment. That behavior is not explicitly covered by the six required checks. Confirm whether a controlled email-failure test should be added.

## 6. Completion status

The draft baseline is prepared. Test execution and the defect-form review remain pending; the issue should not yet be marked fully complete.
