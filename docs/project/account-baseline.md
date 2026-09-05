# AWS account and SES readiness — E1-I02

**Owner:** Chris
**Observed:** September 4, 2026 (America/New_York)
**Issue:** [E1-I02 / #12](https://github.com/ChristopherMedrano/aws-restart-group-project/issues/12)
**Status:** Evidence consolidated; conditional readiness, review and follow-ups pending.

## Account and deployment baseline

The team will use AWS Free plan account.


| Setting | Selected value |
|---|---|
| Deployment Region | `us-east-1` (N. Virginia) |
| Project tag | `S3NT`|
| Environment tag | `shared-dev` |
| Stack management tag | `ManagedBy=SAM` |
| Documented manual bootstrap tag | `ManagedBy=ManualBootstrap` |
| Free access end shown | January 30, 2027 |

## Service access and existing resources

Regional observations cover `us-east-1` unless explicitly stated.

| Service | Observed evidence | Scope / limitation |
|---|---|---|
| Cognito | 0 user pools; list loaded | Creation and application sign-in untested |
| API Gateway | 0 APIs; list loaded | API deployment untested |
| Lambda | 0 functions; 0 bytes code storage | Dashboard and quotas accessible |
| DynamoDB | 0 tables | Table/index creation untested |
| SNS | 0 topics | Publish and subscription permissions untested |
| SQS | 0 queues | Queue creation and failure routing untested |
| SES | Domain and test recipient verified; real inbox test received | Sandbox remains enabled |
| S3 | 1 remaining general-purpose bucket across all Regions | CLI inventory verified after reference-share deletion |
| CloudFront | 1 enabled distribution | Personal portfolio; CLI inventory verified after Reference Links deletion |
| CloudWatch | 0 alarms, 0 log groups; 0 custom dashboards | Alarms/logs checked regionally; dashboard list checked |
| IAM | 0 users, 0 groups, 4 service-linked roles, 0 customer-managed policies, 0 identity providers | No project-specific roles found |
| CloudFormation | 0 active stacks | Active filter excludes deleted history; deployment untested |
| SAM toolchain | SAM CLI 1.166.1 installed and available on local PATH | Ready for SAM build/deploy work |

IAM dashboard confirms root MFA is enabled and root has no active access keys.
The four existing roles serve CloudFront logging, Resource Explorer, Support,
and Trusted Advisor. Named project access is not yet established or tested.

## Blocked services and actions

None. Service provisioning and application integration checks are implementation
work and do not block this account-readiness record.

### Existing S3 and CloudFront usage

| Existing resource | Region | Latest reported bytes | Objects | Source |
|---|---|---:|---:|---|
| Personal portfolio S3 bucket | `us-east-1` | 10,436,096 | 238 | Metrics tooltip supplied by Chris; object tooltip observed |

## Capacity and allowance comparison

| Check | Applied quota / observed usage | Planned demand / implication |
|---|---|---|
| Lambda concurrency | 10 total, 10 unreserved; reported utilization 0 | Shared by all functions; test simultaneous API, profile, and notification activity |
| Lambda function/layer storage | 300 GB; dashboard reports 0 bytes used | No existing code-storage pressure |
| DynamoDB provisioned read throughput | 80,000; utilization 0 | 10 RCU across tables and indexes |
| DynamoDB provisioned write throughput | 80,000; utilization 0 | 24 WCU across tables and indexes |
| DynamoDB tables | 2,500; utilization 0 | 3 tables |
| DynamoDB GSIs per table | 20 | Maximum 2 on a planned table |
| DynamoDB table-level read/write throughput | 40,000 each | Planned per-table values are below these limits |
| SES | 200 emails per 24 hours; 1 email/second | Initial usage was 0; later inbox test is not included in that initial reading |
| CloudWatch standard alarms | No general count quota appeared in Service Quotas | Plan uses 10 directly referenced standard-resolution alarm metrics |
| CloudWatch dashboard | No existing custom dashboards | Plan uses 1 dashboard with at most 50 metrics |

## SES readiness and completed checks

- `cthecoder.io` is verified in `us-east-1`, and Easy DKIM is enabled with
  RSA 2048-bit signing.
- The three SES DKIM CNAME records were checked in Cloudflare and resolved to
  the expected SES endpoints.
- A test Gmail address was verified for SES testing.
- A test email was sent successfully through the SES simulator, and later
  `AWS/SES Send` metrics showed activity.
- SES sandbox mode is still enabled, so all real recipients must be verified
  before email-enabled QA scenarios.
