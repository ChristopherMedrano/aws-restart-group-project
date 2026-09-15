# Infra (SAM)

Templates and `samconfig.toml` for shared-dev. Run SAM commands in **this
directory**. Account-specific ARNs, user names, pool ids, and test accounts
are in the local runbook (`_planning/sam-greenfield/runbook.md`), not here.

| Path | Stack |
| --- | --- |
| `bootstrap/template.yaml` | `s3nt-bootstrap` |
| `app/template.yaml` | `s3nt-app` |
| `web/template.yaml` | `s3nt-web` |
| `web/upload-spa.sh` | generate `config.js`, sync SPA, invalidate |
| `samconfig.toml` | region, stack names, artifact bucket, CloudFormation `role_arn` |

Do not commit AWS profile names or `TrustedPrincipalArns`. Do not create IAM
access keys. Do not attach `AdministratorAccess`. Do not use `sam sync`.
Shared-dev code changes go only through `sam deploy` and a reviewed change set.

## Login

Use `aws login` as the named IAM user (not root). Confirm account with
`aws sts get-caller-identity`. For app deploy, use a profile that assumes
`s3nt-shared-dev-app-deployer`.

## Bootstrap (root)

No `sam build`. Pass `TrustedPrincipalArns` (IAM user ARNs that may assume the
deployer). It is not in `samconfig`.

```bash
export AWS_DEFAULT_REGION=us-east-2
sam deploy --config-env bootstrap --config-file samconfig.toml \
  --parameter-overrides TrustedPrincipalArns=arn:aws:iam::ACCOUNT:user/YOUR_USER
```

Review the change set. Execute only if it creates or updates the deployer and
CloudFormation execution roles (and, first time, the artifact bucket). Do not
replace the artifact bucket.

Keep `[app.deploy.parameters]` and `[web.deploy.parameters]` `s3_bucket` and
`role_arn` from stack outputs. Do not set `resolve_s3 = true` on app or web
deploy.

## App (deployer)

```bash
export AWS_DEFAULT_REGION=us-east-2
sam build --config-env app
aws sts get-caller-identity
sam deploy --config-env app --config-file samconfig.toml \
  --parameter-overrides SesFromEmail=verified@example.test DeployedOrigin=https://dxxxx.cloudfront.net
```

Pass `SesFromEmail` (verified in `us-east-2`). In SES sandbox, recipients must
also be verified. Omit `DeployedOrigin` until `s3nt-web` exists; then pass the
`SpaOrigin` output (no trailing slash). Review the change set. Caller must be
the deployer role.
App deploy must not set `template_file` (uses `.aws-sam/build`). Rebuild after
Lambda or `app/template.yaml` changes.
If the change set is empty, do not execute it. Do not `sam sync` against
shared-dev.

If `AccessDenied`, use the `User:` ARN: CloudFormation execution role vs
deployer. Fix that role, then update bootstrap as root.

## Web (deployer)

No `sam build`. Bootstrap IAM must already allow `stack/s3nt-web`. Default
hostname is `*.cloudfront.net`.

```bash
export AWS_DEFAULT_REGION=us-east-2
aws sts get-caller-identity
sam deploy --config-env web --config-file samconfig.toml
./web/upload-spa.sh
```

Then app-deploy with `DeployedOrigin` set to the `SpaOrigin` output. Review
each change set. Do not `sam sync`.

## Local frontend

From repo `frontend/`:

```bash
npx --yes serve -s . -l 5173
```
Runtime ids go in gitignored `frontend/config.local.js` (`cognitoDomain`, `clientId`, `apiBaseUrl`, `redirectUri`, `logoutUri`, `scope`). Do not commit tokens.
