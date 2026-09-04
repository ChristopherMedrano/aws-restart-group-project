# Working Agreement

**Related issue:** E1-I01
**Status:** Ready for review

## Trunk-based development

`master` is the single shared trunk and must remain deployable. Do not create
or use long-lived `develop` or release branches.

- Start short-lived branches from current `master` and keep pull requests
  small, focused, and frequently merged.
- Merge only through a pull request. No independent approval is required, so
  the author may review and merge their own pull request. Unresolved
  conversations still block merging.
- Use a linear-history merge method. Force pushes and branch deletion are not
  permitted on `master`.
- Behavior-changing work should receive domain and QA review when a teammate
  is available. When self-reviewing, record the checks performed and evidence
  in the pull request or linked issue before merge.
- Add required automated status checks once the CI workflow is approved and
  operational. Until then, run and attach the relevant local checks manually.
- Use feature flags, safe seams, or incomplete-but-non-user-visible paths when
  work must integrate before a full capability is ready.

## Roles and communication

| Team name | GitHub username | Notes |
|---|---|---|
| Chris | `ChristopherMedrano` | Repository owner/collaborator |
| Noor | `NoorAlhijab` | Collaborator |
| Gokila | `gokilaradha` | Collaborator |
| Ruthvik | `ruthvikpallukuri` | Collaborator |
| Duke | `toddorduke` | Collaborator |

Use the relevant GitHub issue for decisions, blockers, evidence, and handoff
notes. Raise a change request before changing an approved API, architecture,
scope, security control, or schedule commitment.

## Team-friendly communication

Keep issues, pull requests, project docs, and team comments business casual and
easy to follow. Use clear, direct wording that fits a college or coding-bootcamp
team; avoid stiff corporate language, but keep technical requirements precise.
Be respectful, explain decisions and blockers plainly, and ask for clarification
when a handoff is unclear.

## Blocker escalation

Record the blocker on the affected issue immediately, including owner, impact,
dependency, and requested decision. Escalate gate-blocking items in the team
channel and update the risk register.

## Evidence rules

Link PRs, test output, deployment records, and safe screenshots/logs from the
issue. Do not record credentials, tokens, authorization codes, personal data,
or sensitive task content.
