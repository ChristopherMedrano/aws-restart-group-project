# Safe QA Test Data Template

**Owner:** Gokila

Use aliases and neutral task text only.

| Alias | Required state | Notification preference | Used for |
| --- | --- | --- | --- |
| `qa-creator-enabled` | Confirmed profile | On | Create tasks. |
| `qa-assignee-enabled` | Confirmed profile | On | Test an enabled notification. |
| `qa-assignee-disabled` | Confirmed profile | Off | Test `skipped`. |
| `qa-unrelated` | Confirmed profile | Either | Test denied access. |

## Example fixture

```json
{
  "title": "Review demo notes",
  "description": "Check the shared test flow."
}
```

Replace the example only with similarly neutral text. Use a new UUID task ID
for each formal test run.
