"""Notification Lambda: one email attempt per task.assigned event.

SNS delivers the event after the task is already saved. This function claims the
Notifications item, checks the assignee preference, and calls SES at most once.
Do not log email addresses or tokens.
"""

import html
import json
import logging
import os
import re
from datetime import datetime, timezone

import boto3
from botocore.exceptions import BotoCoreError, ClientError

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

EVENT_TYPE = "task.assigned"
SCHEMA_VERSION = 1
CHANNEL = "email"
TERMINAL = frozenset({"sent", "skipped", "failed", "unknown"})
UUID_V4 = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)
# SES said no. Anything else after we already tried is unknown, not a retry.
SES_REJECTED = frozenset({
    "MessageRejected",
    "MailFromDomainNotVerifiedException",
    "ConfigurationSetDoesNotExist",
    "AccountSendingPausedException",
    "FromEmailAddressNotVerified",
})


def _users_table():
    return boto3.resource("dynamodb").Table(os.environ["USERS_TABLE"])


def _tasks_table():
    return boto3.resource("dynamodb").Table(os.environ["TASKS_TABLE"])


def _notifications_table():
    return boto3.resource("dynamodb").Table(os.environ["NOTIFICATIONS_TABLE"])


def _ses():
    return boto3.client("ses")


def _now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _attempt_count(item):
    raw = item.get("attemptCount") or 0
    return int(raw)  # DynamoDB Number comes back as Decimal


def parse_assignment(message):
    """Require the five-field v1 event. Extra keys are ignored."""
    if not isinstance(message, dict):
        return None
    if message.get("eventType") != EVENT_TYPE:
        return None
    if message.get("schemaVersion") != SCHEMA_VERSION:
        return None
    task_id = message.get("taskId")
    assignee_id = message.get("assigneeId")
    occurred_at = message.get("occurredAt")
    if not isinstance(task_id, str) or not UUID_V4.fullmatch(task_id):
        return None
    if not isinstance(assignee_id, str) or not assignee_id:
        return None
    if not isinstance(occurred_at, str) or not occurred_at:
        return None
    return {
        "taskId": task_id,
        "assigneeId": assignee_id,
        "occurredAt": occurred_at,
    }


def records_from_event(event):
    # SNS wraps JSON in Records[].Sns.Message. Bad records are skipped so one
    # poison payload doesn't block the rest of the batch.
    raw_records = event.get("Records") or []
    parsed = []
    for record in raw_records:
        sns = record.get("Sns") or {}
        body = sns.get("Message")
        if body is None:
            LOGGER.error("SNS record missing Message")
            continue
        if isinstance(body, str):
            try:
                body = json.loads(body)
            except json.JSONDecodeError:
                LOGGER.error("SNS message was not JSON")
                continue
        assignment = parse_assignment(body)
        if not assignment:
            LOGGER.error("SNS message failed assignment validation")
            continue
        parsed.append(assignment)
    return parsed


def get_item(table, key):
    # Consistent read: SNS can beat a eventually-consistent GetItem after PutItem.
    return table.get_item(Key=key, ConsistentRead=True).get("Item")


def claim_notification(task_id, recipient_id, created_at):
    """First writer wins. Later deliveries see the existing item."""
    item = {
        "taskId": task_id,
        "recipientId": recipient_id,
        "channel": CHANNEL,
        "createdAt": created_at,
        "deliveryState": "claimed",
        "attemptCount": 0,
    }
    try:
        _notifications_table().put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(taskId)",
        )
        return item
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise
        existing = get_item(_notifications_table(), {"taskId": task_id})
        if not existing:
            raise
        return existing


def mark_send_started(task_id):
    """Reserve the one SES attempt. Fail if someone already used it."""
    try:
        _notifications_table().update_item(
            Key={"taskId": task_id},
            UpdateExpression="SET deliveryState = :ds, attemptCount = :one",
            ConditionExpression=(
                "attribute_exists(taskId) AND attemptCount = :zero "
                "AND attribute_not_exists(#st)"
            ),
            ExpressionAttributeNames={"#st": "status"},  # status is reserved in DynamoDB
            ExpressionAttributeValues={
                ":ds": "send_started",
                ":zero": 0,
                ":one": 1,
            },
        )
        return True
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


def write_terminal(task_id, recipient_id, created_at, status, sent_at=None, failure_reason=None):
    """Set history GSI keys only when status is terminal. Never overwrite one."""
    names = {"#st": "status"}
    values = {
        ":st": status,
        ":ds": "terminal",
        ":hr": recipient_id,  # history GSI is sparse until we go terminal
        ":hs": f"{created_at}#{task_id}",
        ":ch": CHANNEL,
        ":rid": recipient_id,
        ":ca": created_at,
    }
    sets = [
        "#st = :st",
        "deliveryState = :ds",
        "historyRecipientId = :hr",
        "historySortKey = :hs",
        "channel = :ch",
        "recipientId = :rid",
        "createdAt = :ca",
    ]
    if sent_at:
        sets.append("sentAt = :sa")
        values[":sa"] = sent_at
    if failure_reason:
        sets.append("failureReason = :fr")
        values[":fr"] = failure_reason
    try:
        _notifications_table().update_item(
            Key={"taskId": task_id},
            UpdateExpression="SET " + ", ".join(sets),
            ConditionExpression="attribute_not_exists(#st)",
            ExpressionAttributeNames=names,  # #st = status
            ExpressionAttributeValues=values,
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise
        LOGGER.info("Notification already terminal taskId=%s", task_id)


def send_assignment_email(recipient_email, title, task_id):
    from_address = os.environ["SES_FROM_EMAIL"]
    safe_title = html.escape(title, quote=True)
    # No magic login links. Don't log recipient_email.
    text = (
        f"You were assigned a task in S3NT: {title}\n\n"
        "Sign in to S3NT to view it. This message does not include a login link."
    )
    html_body = (
        f"<p>You were assigned a task in S3NT: <strong>{safe_title}</strong></p>"
        "<p>Sign in to S3NT to view it.</p>"
    )
    _ses().send_email(
        Source=from_address,
        Destination={"ToAddresses": [recipient_email]},
        Message={
            "Subject": {"Data": "S3NT: a task was assigned to you", "Charset": "UTF-8"},
            "Body": {
                "Text": {"Data": text, "Charset": "UTF-8"},
                "Html": {"Data": html_body, "Charset": "UTF-8"},
            },
        },
    )
    LOGGER.info("SES accepted send taskId=%s", task_id)


def process_assignment(assignment):
    task_id = assignment["taskId"]
    event_assignee = assignment["assigneeId"]
    LOGGER.info("Processing task.assigned taskId=%s", task_id)

    try:
        task = get_item(_tasks_table(), {"taskId": task_id})
    except ClientError:
        LOGGER.exception("Unable to load task taskId=%s", task_id)
        raise

    if not task:
        LOGGER.error("Task missing for assignment taskId=%s", task_id)
        return  # don't retry forever on a bad/old event
    if task.get("assigneeId") != event_assignee:
        LOGGER.error("Assignee mismatch on taskId=%s", task_id)
        return  # never email the event's assignee if the task says otherwise

    try:
        user = get_item(_users_table(), {"userId": event_assignee})
    except ClientError:
        LOGGER.exception("Unable to load assignee for taskId=%s", task_id)
        raise

    if not user:
        LOGGER.error("Assignee profile missing taskId=%s", task_id)
        return

    created_at = _now_iso()
    try:
        item = claim_notification(task_id, event_assignee, created_at)
    except ClientError:
        LOGGER.exception("Unable to claim notification taskId=%s", task_id)
        raise

    created_at = item.get("createdAt") or created_at  # keep the original claim time on retries
    recipient_id = item.get("recipientId") or event_assignee

    if item.get("status") in TERMINAL:
        LOGGER.info("Notification already complete taskId=%s", task_id)
        return

    if _attempt_count(item) >= 1:
        # We already crossed the SES line. Do not send again.
        write_terminal(
            task_id,
            recipient_id,
            created_at,
            "unknown",
            failure_reason="SES_UNCONFIRMED",
        )
        return

    if user.get("emailNotificationsEnabled") is False:
        write_terminal(task_id, recipient_id, created_at, "skipped")
        LOGGER.info("Skipped email by preference taskId=%s", task_id)
        return  # never call SES when they opted out

    recipient_email = user.get("email")
    if not isinstance(recipient_email, str) or "@" not in recipient_email:
        write_terminal(
            task_id,
            recipient_id,
            created_at,
            "failed",
            failure_reason="MISSING_EMAIL",
        )
        return

    if not mark_send_started(task_id):
        # Lost the race, or a previous invoke already reserved SES.
        LOGGER.info("SES attempt already reserved taskId=%s", task_id)
        existing = get_item(_notifications_table(), {"taskId": task_id}) or {}
        if existing.get("status") in TERMINAL:
            return
        write_terminal(
            task_id,
            recipient_id,
            created_at,
            "unknown",
            failure_reason="SES_UNCONFIRMED",
        )
        return

    try:
        send_assignment_email(recipient_email, task.get("title") or "Task", task_id)
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        LOGGER.exception("SES ClientError taskId=%s code=%s", task_id, code)
        if code in SES_REJECTED:
            write_terminal(
                task_id,
                recipient_id,
                created_at,
                "failed",
                failure_reason="SES_REJECTED",
            )
            return
        # Throttles, 5xx, etc. We already reserved the attempt so we cannot retry SES.
        write_terminal(
            task_id,
            recipient_id,
            created_at,
            "unknown",
            failure_reason="SES_UNCONFIRMED",
        )
        return
    except (BotoCoreError, Exception):
        # Clock ran out or network died after the request. Might have sent.
        LOGGER.exception("SES result unclear taskId=%s", task_id)
        write_terminal(
            task_id,
            recipient_id,
            created_at,
            "unknown",
            failure_reason="SES_UNCONFIRMED",
        )
        return

    write_terminal(task_id, recipient_id, created_at, "sent", sent_at=_now_iso())


def lambda_handler(event, context):
    assignments = records_from_event(event or {})
    for assignment in assignments:
        process_assignment(assignment)  # Dynamo/SES errors still raise → Lambda retry
    return {"ok": True}
