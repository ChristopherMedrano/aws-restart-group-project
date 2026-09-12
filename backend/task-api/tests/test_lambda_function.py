"""Unit tests for the deployed GET /me behavior."""

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from botocore.exceptions import ClientError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import lambda_function


def api_event(route_key="GET /me", sub="user-123"):
    event = {"routeKey": route_key}
    if sub is not None:
        event["requestContext"] = {
            "authorizer": {"jwt": {"claims": {"sub": sub}}}
        }
    return event


class GetProfileTests(unittest.TestCase):
    def test_returns_only_public_profile_fields(self):
        item = {
            "userId": "user-123",
            "displayName": "Taylor",
            "email": "taylor@example.test",
            "emailNotificationsEnabled": True,
            "createdAt": "2026-09-11T00:00:00Z",
            "directoryPk": "DIRECTORY",
            "displayNameKey": "taylor#user-123",
        }
        table = unittest.mock.Mock()
        table.get_item.return_value = {"Item": item}

        with patch.object(lambda_function, "_users_table", return_value=table):
            result = lambda_function.lambda_handler(api_event(), None)

        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(
            json.loads(result["body"]),
            {
                "user": {
                    "userId": "user-123",
                    "displayName": "Taylor",
                    "email": "taylor@example.test",
                    "emailNotificationsEnabled": True,
                    "createdAt": "2026-09-11T00:00:00Z",
                }
            },
        )
        table.get_item.assert_called_once_with(
            Key={"userId": "user-123"}, ConsistentRead=True
        )

    def test_allows_absent_optional_profile_fields(self):
        table = unittest.mock.Mock()
        table.get_item.return_value = {"Item": {"userId": "user-123"}}

        with patch.object(lambda_function, "_users_table", return_value=table):
            result = lambda_function.lambda_handler(api_event(), None)

        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(
            json.loads(result["body"]), {"user": {"userId": "user-123"}}
        )

    def test_rejects_missing_caller_claim(self):
        result = lambda_function.lambda_handler(api_event(sub=None), None)

        self.assertEqual(result["statusCode"], 401)
        self.assertEqual(json.loads(result["body"]), {"message": "Unauthorized"})

    def test_rejects_unimplemented_route(self):
        result = lambda_function.lambda_handler(api_event(route_key="POST /me"), None)

        self.assertEqual(result["statusCode"], 404)
        self.assertEqual(json.loads(result["body"]), {"message": "Not found"})

    def test_returns_server_error_when_dynamodb_fails(self):
        table = unittest.mock.Mock()
        table.get_item.side_effect = ClientError(
            {"Error": {"Code": "InternalServerError", "Message": "unavailable"}},
            "GetItem",
        )

        with (
            patch.object(lambda_function, "_users_table", return_value=table),
            patch.object(lambda_function, "LOGGER"),
        ):
            result = lambda_function.lambda_handler(api_event(), None)

        self.assertEqual(result["statusCode"], 500)
        self.assertEqual(
            json.loads(result["body"]), {"message": "Unable to load profile"}
        )


class UpdateProfileStubTests(unittest.TestCase):
    def test_patch_profile_is_an_explicit_stub(self):
        result = lambda_function.lambda_handler(
            api_event(route_key="PATCH /me"), None
        )

        self.assertEqual(result["statusCode"], 501)
        self.assertEqual(json.loads(result["body"]), {"message": "Not implemented"})


class RemainingRouteStubTests(unittest.TestCase):
    def test_remaining_contract_routes_are_explicit_stubs(self):
        route_keys = (
            "GET /assignees",
            "POST /tasks",
            "GET /tasks",
            "PATCH /tasks/{taskId}/status",
            "GET /tasks/{taskId}/notification",
            "GET /notifications",
        )

        for route_key in route_keys:
            with self.subTest(route_key=route_key):
                result = lambda_function.lambda_handler(api_event(route_key), None)

                self.assertEqual(result["statusCode"], 501)
                self.assertEqual(
                    json.loads(result["body"]), {"message": "Not implemented"}
                )
