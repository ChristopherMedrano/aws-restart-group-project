# Backend

This directory is the version-controlled source for the S3NT serverless
backend. Its source is kept in `task-api/lambda_function.py` so the Lambda
handler stays `lambda_function.lambda_handler`, matching the deployed function.

## Local setup and checks

Use a virtual environment and install the development requirements:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements-dev.txt
python -m unittest discover -s backend/task-api/tests -v
```

The Lambda needs `USERS_TABLE`, `TASKS_TABLE`, and `NOTIFICATIONS_TABLE` in its
environment. API Gateway validates the Cognito access token before invoking the
Lambda; the handler reads the caller only from the validated JWT `sub` claim.

## Current and planned routes

| Route | Status |
| --- | --- |
| `GET /me` | Implemented. |
| `PATCH /me` | Implemented. |
| `GET /assignees` | Implemented. |
| `POST /tasks` | Implemented; persists the task and does not publish SNS. |
| `GET /tasks` | Implemented (`role=assigned` or `role=created`). |
| `PATCH /tasks/{taskId}/status` | Implemented. |
| `GET /tasks/{taskId}/notification` | Implemented; returns `null` until Notification Lambda writes. |
| `GET /notifications` | Implemented; empty until Notification Lambda writes. |

The Task API Lambda implements the profile, assignee, and task routes above.
Notification send remains a stub Lambda.

The complete API contract and implementation order are in
[`docs/specs/S3NT_BACKEND_SPEC.md`](../docs/specs/S3NT_BACKEND_SPEC.md).

## Deployment boundary

Infrastructure lives in [`infra/app/template.yaml`](../infra/app/template.yaml).
Keep live changes and source changes paired in a pull request. Do not mix
untracked console updates with the SAM deployment.
