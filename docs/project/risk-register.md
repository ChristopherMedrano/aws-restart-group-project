# Risk Register

**Related issue:** E1-I01
**Status:** Ready for review

| ID | Risk | Impact | Mitigation / trigger | Owner | Status |
|---|---|---|---|---|---|
| R-001 | Duke lacked repository collaborator access. | API handoff and review could have been delayed. | Resolved: Duke has collaborator access as `toddorduke`. | Ruthvik | Resolved |
| R-002 | No required CI status check is configured yet. | A failing build could merge if manual checks are missed. | Approve and enable CI, then add its status check to branch protection. | Gokila | Open |
| R-003 | Week 1 baseline decisions may remain unresolved. | Blocks Gate 1 and Week 2 infrastructure work. | Track each decision in the decision log and mark blocked issues immediately. | Ruthvik | Open |
| R-004 | AWS account or SES readiness may constrain the approved architecture. | Delays shared-environment implementation. | Complete E1-I02 and record any instructor escalation or approved contingency. | Chris | Open |

Review this register during the weekly integration review and whenever a
gate-blocking condition changes.
