# API Gateway foundation — shared-dev

**Region:** `us-east-2` (Ohio)
**Account:** `190285489911`
**Created:** September 9, 2026

This record describes the manually bootstrapped HTTP API foundation. It
contains public resource identifiers and configuration only; do not add bearer
tokens, authorization codes, passwords, credentials, or email addresses.

## Integration outputs

| Setting | Value |
| --- | --- |
| API name | `S3NT-shared-dev-api` |
| API ID | `o7f51vbeyh` |
| Invoke URL | `https://o7f51vbeyh.execute-api.us-east-2.amazonaws.com` |
| Stage | `$default` (automatic deployment enabled) |

## JWT authorizer

| Setting | Value |
| --- | --- |
| Name | `S3NT-shared-dev-jwt` |
| Type | Native API Gateway JWT authorizer |
| Identity source | `$request.header.Authorization` |
| Issuer | `https://cognito-idp.us-east-2.amazonaws.com/us-east-2_e4zskjGI6` |
| Audience | `3shfthangguj7gion7a2afia6e` |
| Required route scope | `shared-task-api/access` |

## Integration and routes

All listed routes use the Lambda proxy integration for
`S3NT-shared-dev-task-api` with HTTP API payload format version `2.0`. Each
route uses `S3NT-shared-dev-jwt` and requires the
`shared-task-api/access` authorization scope.

| Route |
| --- |
| `GET /me` |
| `PATCH /me` |
| `GET /assignees` |
| `POST /tasks` |
| `GET /tasks` |
| `PATCH /tasks/{taskId}/status` |
| `GET /tasks/{taskId}/notification` |
| `GET /notifications` |

The post-confirmation and notification Lambdas are not direct API Gateway
integrations.

## Verified profile flow

`GET /me` has been verified from the deployed CloudFront demo after Cognito
managed login. The browser sends the Cognito access token as a Bearer token;
API Gateway authorizes the request, and the Task API Lambda returns the
matching DynamoDB `Users` record. The demo renders only the returned display
name and user ID. Do not expose tokens in the page or application logs.

## CORS

| Setting | Value |
| --- | --- |
| Allowed origins | `http://localhost:5173`, `https://d22amkzcsmugnp.cloudfront.net` |
| Allowed methods | `GET`, `POST`, `PATCH` |
| Allowed request headers | `authorization`, `content-type` |
| Exposed headers | None |
| Preflight max age | `300` seconds |
| Credentials | Disabled |

## Tags

| Key | Value |
| --- | --- |
| `Project` | `S3NT` |
| `Environment` | `shared-dev` |
| `ManagedBy` | `ManualBootstrap` |
