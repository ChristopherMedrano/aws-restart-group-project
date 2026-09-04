# Decision Log

**Related issue:** E1-I01
**Status:** Ready for review

| ID | Decision | Rationale | Owner | Approval / evidence | Status |
|---|---|---|---|---|---|
| D-001 | Use trunk-based development on `master`. | Small, reviewed changes integrate frequently while keeping one deployable trunk. | Chris | GitHub branch protection configured; team review pending. | Proposed |
| D-002 | Make the repository public. | Enables GitHub Free branch-protection capabilities for this course repository. | Chris | Repository visibility is public. | Implemented |
| D-003 | Require pull requests with resolved conversations and linear history; permit self-review/self-merge; disable force-push/delete on `master`. | Supports a single-maintainer workflow while retaining a protected, auditable trunk. | Chris | GitHub branch-protection configuration. | Implemented |
| D-004 | Use a business-casual, team-friendly tone in project docs, issues, pull requests, and comments. | Keeps the work clear and approachable for a college or coding-bootcamp team without losing technical accuracy. | Team | Working agreement update, 2026-09-04. | Implemented |

Record any architecture, API, scope, deployment, release, or team-process
decision here with its approval and the linked issue or ADR.
