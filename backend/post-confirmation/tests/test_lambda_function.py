"""Unit tests for Cognito post-confirmation Users writes."""

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from botocore.exceptions import ClientError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import lambda_function


def cognito_event(sub="user-123", email="taylor@example.test", name="Taylor"):
    attrs = {}
    if sub is not None:
        attrs["sub"] = sub
    if email is not None:
        attrs["email"] = email
    if name is not None:
        attrs["name"] = name
    return {"request": {"userAttributes": attrs}, "response": {}}


class CreateProfileTests(unittest.TestCase):
    def test_writes_directory_profile_once(self):
        table = unittest.mock.Mock()
        event = cognito_event()

        with (
            patch.object(lambda_function, "_users_table", return_value=table),
            patch.object(
                lambda_function,
                "_now_iso",
                return_value="2026-09-13T00:00:00Z",
            ),
        ):
            result = lambda_function.lambda_handler(event, None)

        self.assertIs(result, event)
        table.put_item.assert_called_once_with(
            Item={
                "userId": "user-123",
                "displayName": "Taylor",
                "email": "taylor@example.test",
                "emailNotificationsEnabled": True,
                "createdAt": "2026-09-13T00:00:00Z",
                "directoryPk": "DIRECTORY",
                "displayNameKey": "taylor#user-123",
            },
            ConditionExpression="attribute_not_exists(userId)",
        )

    def test_defaults_display_name_when_name_missing(self):
        table = unittest.mock.Mock()
        event = cognito_event(name=None)

        with (
            patch.object(lambda_function, "_users_table", return_value=table),
            patch.object(
                lambda_function,
                "_now_iso",
                return_value="2026-09-13T00:00:00Z",
            ),
        ):
            lambda_function.lambda_handler(event, None)

        item = table.put_item.call_args.kwargs["Item"]
        self.assertEqual(item["displayName"], "Member")
        self.assertEqual(item["displayNameKey"], "member#user-123")

    def test_skips_write_when_profile_exists(self):
        table = unittest.mock.Mock()
        table.put_item.side_effect = ClientError(
            {
                "Error": {
                    "Code": "ConditionalCheckFailedException",
                    "Message": "exists",
                }
            },
            "PutItem",
        )
        event = cognito_event()

        with patch.object(lambda_function, "_users_table", return_value=table):
            result = lambda_function.lambda_handler(event, None)

        self.assertIs(result, event)

    def test_skips_write_when_sub_or_email_missing(self):
        table = unittest.mock.Mock()
        event = cognito_event(sub=None, email=None)

        with (
            patch.object(lambda_function, "_users_table", return_value=table),
            patch.object(lambda_function, "LOGGER"),
        ):
            result = lambda_function.lambda_handler(event, None)

        self.assertIs(result, event)
        table.put_item.assert_not_called()


class CreateProfileErrorTests(unittest.TestCase):
    def test_reraises_unexpected_dynamodb_error(self):
        table = unittest.mock.Mock()
        table.put_item.side_effect = ClientError(
            {"Error": {"Code": "InternalServerError", "Message": "unavailable"}},
            "PutItem",
        )

        with (
            patch.object(lambda_function, "_users_table", return_value=table),
            patch.object(lambda_function, "LOGGER"),
        ):
            with self.assertRaises(ClientError):
                lambda_function.lambda_handler(cognito_event(), None)
