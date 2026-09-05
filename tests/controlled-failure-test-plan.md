# Controlled failure-test plan

**Status:** Plan only; not executed.

This plan validates that controlled email-notification failures are handled
predictably: the assigned task is preserved, the notification state accurately
records `failed` or `unknown`, and the system avoids duplicate SES send attempts.
It provides repeatable automated and sandbox evidence without affecting
production access, account-wide sending, or the working domain/DNS.

1. First test a deterministic SES rejection using the notification component's
   mocked SES client: return `MessageRejected` before acceptance. Assert `failed`,
   preserved task assignment, and no further SES send attempt for that task ID.
2. For live sandbox evidence, use a dedicated QA account with an inbox the team
   controls, verified for application sign-in but deliberately not verified in
   SES and not under an SES-verified domain. Confirm those preconditions immediately
   before the test; do not use an arbitrary person's address or the verified Gmail
   recipient used above.
3. Create one task assigned to that QA account with email enabled. Expect SES to
   reject the recipient while sandboxed. Confirm the task remains assigned and the
   notification becomes `failed`. Record sanitized task/correlation ID, error code,
   timestamp, and database/UI outcome. A handled rejection should not be mistaken
   for an exhausted Lambda invocation or SNS delivery failure.
4. If SES unexpectedly accepts the message, stop and classify the test as invalid
   for rejection evidence. Do not resend the same task or mark it failed merely
   because inbox receipt is unknown. Investigate the sandbox/identity preconditions.
5. Separately inject an ambiguous post-send result in an isolated automated test:
   assert terminal `unknown` and at most one SES attempt. This is not a live resend
   experiment. Use a new task ID for any later positive control.
6. Restore the QA fixture by verifying its SES recipient if it will participate
   in positive email tests, or disable its email preference. Confirm a positive
   control using a verified recipient and a new task.

Do not use a mailbox-simulator bounce as proof of the MVP's synchronous `failed`
status: SES can accept a send before a later bounce. Bounce/complaint tracking is
outside the MVP contract. The two planned SQS failure queues must stay separate;
their failure-injection tests belong to the later messaging/QA work.
