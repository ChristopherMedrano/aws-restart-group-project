# Backend

This directory is the version-controlled source for the S3NT serverless
backend. The deployed Task API Lambda currently implements only `GET /me`.
Its source is kept in `task-api/lambda_function.py` so the Lambda handler stays
`lambda_function.lambda_handler`, matching the deployed function.

## Local setup and checks

Use a virtual environment and install the development requirements:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements-dev.txt
python -m unittest discover -s backend/task-api/tests -v
```

The Lambda needs `USERS_TABLE` in its environment. API Gateway validates the
Cognito access token before invoking the Lambda; the handler reads the caller
only from the validated JWT `sub` claim.

## Current and planned routes

| Route | Status |
| --- | --- |
| `GET /me` | Implemented and deployed. |
| `PATCH /me` | Explicit `501 Not implemented` stub; not deployed or routed through API Gateway. |
| `GET /assignees` | Explicit `501 Not implemented` stub. |
| `POST /tasks` and `GET /tasks` | Explicit `501 Not implemented` stubs. |
| `PATCH /tasks/{taskId}/status` | Explicit `501 Not implemented` stub. |
| `GET /tasks/{taskId}/notification` | Explicit `501 Not implemented` stub. |
| `GET /notifications` | Explicit `501 Not implemented` stub. |

The complete API contract and implementation order are in
[`docs/specs/S3NT_BACKEND_SPEC.md`](../docs/specs/S3NT_BACKEND_SPEC.md).

## Deployment boundary

This repository does not yet own deployment infrastructure for the existing
console-managed Lambda. Keep live changes and source changes paired in a pull
request. Before adding routes, the team should adopt SAM or CloudFormation and
import or deliberately replace the existing resources rather than mixing
untracked console updates with an IaC deployment.
