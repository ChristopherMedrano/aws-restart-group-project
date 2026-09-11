# Cognito foundation — shared-dev

**Region:** `us-east-2` (Ohio)
**Account:** `190285489911`
**Created:** September 9, 2026

This is the configuration record for the manually bootstrapped Cognito
foundation. The values below are identifiers and public endpoints, not
credentials. Do not add client secrets, user passwords, authorization codes,
access tokens, refresh tokens, or email addresses to this file.

## Integration outputs

| Setting | Value |
| --- | --- |
| User pool ID | `us-east-2_e4zskjGI6` |
| OIDC issuer | `https://cognito-idp.us-east-2.amazonaws.com/us-east-2_e4zskjGI6` |
| SPA app client | `S3NT-shared-dev-spa` |
| SPA client ID | `3shfthangguj7gion7a2afia6e` |
| Managed-login domain | `https://us-east-2e4zskjgi6.auth.us-east-2.amazoncognito.com` |
| API scope | `shared-task-api/access` |

## Selected configuration

- Sign-in identifier: email only.
- Required standard attributes: `email`, `name`.
- Email verification: Cognito-assisted email verification enabled.
- Self-service sign-up: disabled for the shared-dev foundation.
- Resource server: `shared-task-api`, with the `access` scope.
- SPA client: public client with no client secret; authorization-code flow with
  PKCE.
- Allowed scopes: `openid`, `email`, `profile`, and
  `shared-task-api/access`.
- Local callback URL: `http://localhost:5173/callback`.
- Local sign-out URL: `http://localhost:5173/`.
- Deployed callback URL: `https://d22amkzcsmugnp.cloudfront.net/`.
- Deployed sign-out URL: `https://d22amkzcsmugnp.cloudfront.net/`.
- Branding: Cognito Managed Login.
- Lambda triggers: none attached. In particular, do not attach the
  post-confirmation function until it creates `Users` records correctly.

## Application-user group

| Setting | Value |
| --- | --- |
| Group | `S3NT-users` |
| Description | Application users for S3NT shared-dev |
| Precedence | Not set |
| IAM role | None |

This group is an operational membership label for application users. It is not
currently an API authorization boundary: the backend specification authorizes
the MVP routes for authenticated users and applies route-specific ownership
checks. Do not add group claims to DynamoDB user profiles or rely on the group
for authorization unless a future API authorization requirement explicitly
defines that policy.

## Temporary user provisioning

Self-service sign-up is intentionally deferred, even though the planned
frontend may continue to present a future "Register or sign in" entry point.
Until that flow is enabled and tested, an administrator creates each Cognito
application user and adds it to `S3NT-users` as appropriate.

The post-confirmation Lambda is not attached yet. For every administrator-
provisioned application user, create the matching `Users` table item manually:
use the Cognito `sub` as `userId`, then populate the required profile and
directory attributes described in `docs/architecture/data-model.md`. Do not
record user IDs, email addresses, passwords, or tokens in this foundation
record.

## Verified deployed sign-in flow

The CloudFront demo uses the authorization-code flow with PKCE and the managed
login domain. A successful sign-in returns to the deployed callback URL, then
the demo calls the protected `GET /me` API with the Cognito access token. The
verified response displays the user's name and user ID from DynamoDB. This
confirms the Cognito, API Gateway JWT authorizer, Task API Lambda, and `Users`
table integration without placing tokens in the browser UI or this document.

## Tags

| Key | Value |
| --- | --- |
| `Project` | `S3NT` |
| `Environment` | `shared-dev` |
| `ManagedBy` | `ManualBootstrap` |

## Ongoing configuration

Keep both the local and deployed callback/sign-out URLs while local development
remains supported. Any additional deployed origin must be added exactly,
including its scheme and trailing slash where applicable, before it can be used
as a Cognito redirect.
