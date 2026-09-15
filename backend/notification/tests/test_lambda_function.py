"""Unit tests for the Notification Lambda."""

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from botocore.exceptions import ClientError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import lambda_function

TASK_ID = "11111111-1111-4111-8111-111111111111"


def sns_event(message):
    return {"Records": [{"Sns": {"Message": json.dumps(message)}}]}


def assignment(**overrides):
    body = {
        "eventType": "task.assigned",
        "schemaVersion": 1,
        "taskId": TASK_ID,
        "assigneeId": "user-123",
        "occurredAt": "2026-09-13T12:00:00Z",
    }
    body.update(overrides)
    return body


class NotificationHandlerTests(unittest.TestCase):
    def test_empty_batch_is_ok(self):
        result = lambda_function.lambda_handler({"Records": []}, None)
        self.assertEqual(result, {"ok": True})

    def test_skips_ses_when_email_disabled(self):
        tasks = Mock()
        tasks.get_item.return_value = {
            "Item": {
                "taskId": TASK_ID,
                "assigneeId": "user-123",
                "title": "Ship keys",
            }
        }
        users = Mock()
        users.get_item.return_value = {
            "Item": {
                "userId": "user-123",
                "email": "hidden@example.test",
                "emailNotificationsEnabled": False,
            }
        }
        notes = Mock()
        notes.put_item.return_value = {}
        notes.update_item.return_value = {}

        with (
            patch.object(lambda_function, "_tasks_table", return_value=tasks),
            patch.object(lambda_function, "_users_table", return_value=users),
            patch.object(lambda_function, "_notifications_table", return_value=notes),
            patch.object(lambda_function, "_ses") as ses,
            patch.object(lambda_function, "_now_iso", return_value="2026-09-13T12:00:01Z"),
        ):
            result = lambda_function.lambda_handler(sns_event(assignment()), None)

        self.assertEqual(result, {"ok": True})
        ses.return_value.send_email.assert_not_called()
        values = notes.update_item.call_args.kwargs["ExpressionAttributeValues"]
        self.assertEqual(values[":st"], "skipped")
