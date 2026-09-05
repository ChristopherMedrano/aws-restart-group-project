# Tool version pins — E1-I03

**Related issue:** E1-I03
**Status:** Proposed for review

The Gate 0 baseline comes from the canonical AWS Access Plan §2.3. Local tool
versions must match it before validating or deploying the shared environment.

| Tool or runtime | Required version | Local status |
|---|---:|---|
| AWS SAM CLI | `1.166.1` | Verified: `1.166.1` |
| AWS CLI | `2.36.0` (major version 2) | Verified: `2.36.0` |
| `cfn-lint` | `1.55.1` | Verified: `1.55.1` |
| Lambda Python runtime | `python3.14` | Must be declared in the SAM template; local Python `3.14.7` is compatible with this runtime line. |
| CloudFormation template format | `2010-09-09` | Must be declared in the template. |
| AWS SAM transform | `AWS::Serverless-2016-10-31` | Must be declared in the template. |

## Project development pins

| Tool | Pinned version | Verification |
|---|---:|---|
| Node.js | `22.22.2` | `.nvmrc`; `node --version` |
| npm | `10.9.7` | `npm --version` |

## Packaging rules

- Commit the applicable dependency lockfile before adding application code:
  `package-lock.json` for Node packages and a pinned requirements or lock file
  for Python packages.
- Use `npm ci` for Node dependency installation in CI and reproducible local
  setup.
- Use `python3 -m pip` for local tooling; do not infer the Lambda runtime from
  the workstation's Python version.
- A future SAM template must declare `python3.14` explicitly.

## Change control

Changing a pinned version requires a reviewed pull request that updates this
record, the relevant lockfile or runtime declaration, and validation evidence.
