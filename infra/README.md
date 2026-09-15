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

`aws login` sessions expire. After login, run `aws sts get-caller-identity`
and check **Account `190285489911`**. If the CLI asks to overwrite that root
session with account `354551173586`, answer **n** and finish login for
`190285489911`.

| Work | Profile | `sts` Arn contains |
| --- | --- | --- |
| Bootstrap | `aws-restart-root` | `190285489911:root` |
| App or web deploy, SPA upload | `s3nt-app-deployer` | `assumed-role/s3nt-shared-dev-app-deployer` |

Do not `sam deploy --config-env web` or `app` as root. `samconfig` still uses
the CloudFormation execution role for resource APIs.

`export AWS_PROFILE=...` stays for the rest of that terminal. `aws login
--profile NAME` only refreshes that named profile; it does **not** change
`AWS_PROFILE`. Before every `sam deploy`, run `aws sts get-caller-identity`
with no extra flags and read the Arn. If bootstrap shows
`assumed-role/s3nt-shared-dev-app-deployer`, SAM will try to create
`aws-sam-cli-managed-default` and fail. Switch with
`export AWS_PROFILE=aws-restart-root` (after `aws login --profile
aws-restart-root`). `chris-aws` cannot update `s3nt-bootstrap`.

## Bootstrap (root)

No `sam build`. Pass `TrustedPrincipalArns` (IAM user ARNs that may assume the
deployer). It is not in `samconfig`. **Update bootstrap before the first
`s3nt-web` deploy** so the execution role can call CloudFront.

```bash
export AWS_PROFILE=aws-restart-root
export AWS_DEFAULT_REGION=us-east-2
aws sts get-caller-identity
# Arn must be arn:aws:iam::190285489911:root
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
export AWS_PROFILE=s3nt-app-deployer
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

No `sam build`. Bootstrap must already be updated (`ManageS3ntWeb` on the
execution role). Default hostname is `*.cloudfront.net`. Commands run from
`infra/`. Do not upload until the stack is `CREATE_COMPLETE`.

```bash
export AWS_PROFILE=s3nt-app-deployer
export AWS_DEFAULT_REGION=us-east-2
aws sts get-caller-identity
sam deploy --config-env web --config-file samconfig.toml
./web/upload-spa.sh
```

If CloudFront OAC returns AccessDenied on `s3nt-shared-dev-cfn-execution`,
bootstrap was not updated. If `DescribeStacks` on `s3nt-web` is denied for the
deployer, same cause. After a `ROLLBACK_COMPLETE` stack, delete `s3nt-web`
(root can), remove empty `s3nt-web-spa-ACCOUNT` if `BucketAlreadyExists`, then
deploy web as the deployer.

Then app-deploy with `DeployedOrigin` set to the `SpaOrigin` output. Review
each change set. Do not `sam sync`.

## Local frontend

From repo `frontend/`:

```bash
npx --yes serve -s . -l 5173
```
Runtime ids go in gitignored `frontend/config.local.js` (`cognitoDomain`, `clientId`, `apiBaseUrl`, `redirectUri`, `logoutUri`, `scope`). Do not commit tokens.
