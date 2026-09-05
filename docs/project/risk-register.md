# Risk Register

**Related issue:** E1-I01
**Status:** Ready for review

| ID | Risk | Impact | Mitigation / trigger | Owner | Status |
|---|---|---|---|---|---|
| R-001 | Duke lacked repository collaborator access. | API handoff and review could have been delayed. | Resolved: Duke has collaborator access as `toddorduke`. | Ruthvik | Resolved |
| R-002 | No required CI status check is configured yet. | A failing build could merge if manual checks are missed. | Approve and enable CI, then add its status check to branch protection. | Gokila | Open |

Review this register during the weekly integration review and whenever a
gate-blocking condition changes.
