"""Unit tests for the deployed GET /me behavior."""

import base64
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from botocore.exceptions import ClientError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import lambda_function


def api_event(route_key="GET /me", sub="user-123", body=None, query=None, path=None):
    event = {"routeKey": route_key}
    if sub is not None:
        event["requestContext"] = {
            "authorizer": {"jwt": {"claims": {"sub": sub}}}
        }
    if body is not None:
        event["body"] = body if isinstance(body, str) else json.dumps(body)
    if query is not None:
        event["queryStringParameters"] = query
    if path is not None:
        event["pathParameters"] = path
    return event


TASK_ID = "11111111-1111-4111-8111-111111111111"


def task_body(**overrides):
    body = {
        "taskId": TASK_ID,
        "title": "Ship keys",
        "description": "Fill the data model",
        "assigneeId": "user-123",
    }
    body.update(overrides)
    return body


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


class UpdateProfileTests(unittest.TestCase):
    def test_updates_display_name_and_directory_key(self):
        table = unittest.mock.Mock()
        table.update_item.return_value = {
            "Attributes": {
                "userId": "user-123",
                "displayName": "Jordan",
                "email": "jordan@example.test",
                "emailNotificationsEnabled": True,
                "createdAt": "2026-09-11T00:00:00Z",
                "directoryPk": "DIRECTORY",
                "displayNameKey": "jordan#user-123",
            }
        }

        with patch.object(lambda_function, "_users_table", return_value=table):
            result = lambda_function.lambda_handler(
                api_event(route_key="PATCH /me", body={"displayName": "Jordan"}),
                None,
            )

        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(
            json.loads(result["body"])["user"]["displayName"], "Jordan"
        )
        kwargs = table.update_item.call_args.kwargs
        self.assertEqual(kwargs["Key"], {"userId": "user-123"})
        self.assertIn("displayNameKey", kwargs["UpdateExpression"])
        self.assertEqual(kwargs["ExpressionAttributeValues"][":dnk"], "jordan#user-123")
        self.assertNotIn("email", json.dumps(kwargs["ExpressionAttributeValues"]))

    def test_rejects_empty_patch_and_invalid_name(self):
        with patch.object(lambda_function, "_users_table") as users:
            empty = lambda_function.lambda_handler(
                api_event(route_key="PATCH /me", body={}), None
            )
            blank = lambda_function.lambda_handler(
                api_event(route_key="PATCH /me", body={"displayName": "   "}),
                None,
            )
        self.assertEqual(empty["statusCode"], 400)
        self.assertEqual(blank["statusCode"], 400)
        users.assert_not_called()


class GetAssigneesTests(unittest.TestCase):
    def test_returns_only_directory_public_fields(self):
        table = unittest.mock.Mock()
        table.query.return_value = {
            "Items": [
                {
                    "userId": "user-123",
                    "displayName": "Taylor",
                    "email": "hidden@example.test",
                    "emailNotificationsEnabled": False,
                    "directoryPk": "DIRECTORY",
                    "displayNameKey": "taylor#user-123",
                }
            ]
        }

        with patch.object(lambda_function, "_users_table", return_value=table):
            result = lambda_function.lambda_handler(
                api_event(route_key="GET /assignees"), None
            )

        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(
            json.loads(result["body"]),
            {"assignees": [{"userId": "user-123", "displayName": "Taylor"}]},
        )
        kwargs = table.query.call_args.kwargs
        self.assertEqual(kwargs["IndexName"], "directoryPk-displayNameKey")
        self.assertEqual(kwargs["ExpressionAttributeValues"][":pk"], "DIRECTORY")


class CreateTaskTests(unittest.TestCase):
    def test_creates_unpublished_task(self):
        users = unittest.mock.Mock()
        users.get_item.return_value = {"Item": {"userId": "user-123"}}
        tasks = unittest.mock.Mock()
        tasks.put_item.return_value = {}

        with (
            patch.object(lambda_function, "_users_table", return_value=users),
            patch.object(lambda_function, "_tasks_table", return_value=tasks),
            patch.object(lambda_function, "_now_iso", return_value="2026-09-13T12:00:00Z"),
        ):
            result = lambda_function.lambda_handler(
                api_event(route_key="POST /tasks", body=task_body()), None
            )

        self.assertEqual(result["statusCode"], 201)
        payload = json.loads(result["body"])["task"]
        self.assertEqual(payload["taskId"], TASK_ID)
        self.assertEqual(payload["creatorId"], "user-123")
        self.assertEqual(payload["status"], "open")
        self.assertIsNone(payload["completedAt"])
        self.assertNotIn("createdSortKey", payload)
        self.assertNotIn("notificationPublishState", payload)
        item = tasks.put_item.call_args.kwargs["Item"]
        self.assertEqual(item["notificationPublishState"], "unpublished")
        self.assertEqual(item["createdSortKey"], f"2026-09-13T12:00:00Z#{TASK_ID}")
        self.assertNotIn("completedAt", item)

    def test_returns_existing_task_on_identical_retry(self):
        users = unittest.mock.Mock()
        existing = {
            "taskId": TASK_ID,
            "title": "Ship keys",
            "description": "Fill the data model",
            "creatorId": "user-123",
            "assigneeId": "user-123",
            "status": "open",
            "createdAt": "2026-09-13T12:00:00Z",
            "createdSortKey": f"2026-09-13T12:00:00Z#{TASK_ID}",
            "notificationPublishState": "unpublished",
        }
        tasks = unittest.mock.Mock()
        tasks.put_item.side_effect = ClientError(
            {"Error": {"Code": "ConditionalCheckFailedException", "Message": "exists"}},
            "PutItem",
        )
        tasks.get_item.return_value = {"Item": existing}

        with (
            patch.object(lambda_function, "_users_table", return_value=users),
            patch.object(lambda_function, "_tasks_table", return_value=tasks),
        ):
            result = lambda_function.lambda_handler(
                api_event(route_key="POST /tasks", body=task_body()), None
            )

        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(json.loads(result["body"])["task"]["taskId"], TASK_ID)

    def test_rejects_conflict_bad_id_and_missing_assignee(self):
        users = unittest.mock.Mock()
        users.get_item.return_value = {}
        tasks = unittest.mock.Mock()

        with (
            patch.object(lambda_function, "_users_table", return_value=users),
            patch.object(lambda_function, "_tasks_table", return_value=tasks),
        ):
            missing = lambda_function.lambda_handler(
                api_event(route_key="POST /tasks", body=task_body()), None
            )
            bad_id = lambda_function.lambda_handler(
                api_event(
                    route_key="POST /tasks",
                    body=task_body(taskId="not-a-uuid"),
                ),
                None,
            )

        self.assertEqual(missing["statusCode"], 404)
        self.assertEqual(bad_id["statusCode"], 400)
        tasks.put_item.assert_not_called()

        users.get_item.return_value = {"Item": {"userId": "other"}}
        existing = {
            "taskId": TASK_ID,
            "title": "Different",
            "description": "Fill the data model",
            "creatorId": "user-123",
            "assigneeId": "other",
            "status": "open",
            "createdAt": "2026-09-13T12:00:00Z",
        }
        tasks.put_item.side_effect = ClientError(
            {"Error": {"Code": "ConditionalCheckFailedException", "Message": "exists"}},
            "PutItem",
        )
        tasks.get_item.return_value = {"Item": existing}

        with (
            patch.object(lambda_function, "_users_table", return_value=users),
            patch.object(lambda_function, "_tasks_table", return_value=tasks),
        ):
            conflict = lambda_function.lambda_handler(
                api_event(route_key="POST /tasks", body=task_body()), None
            )
        self.assertEqual(conflict["statusCode"], 409)


class GetTasksTests(unittest.TestCase):
    def test_lists_assigned_newest_first_without_token_when_complete(self):
        tasks = unittest.mock.Mock()
        tasks.query.return_value = {
            "Items": [
                {
                    "taskId": TASK_ID,
                    "title": "Ship keys",
                    "description": "Fill the data model",
                    "creatorId": "other",
                    "assigneeId": "user-123",
                    "status": "open",
                    "createdAt": "2026-09-13T12:00:00Z",
                    "createdSortKey": f"2026-09-13T12:00:00Z#{TASK_ID}",
                    "notificationPublishState": "unpublished",
                }
            ]
        }

        with patch.object(lambda_function, "_tasks_table", return_value=tasks):
            result = lambda_function.lambda_handler(
                api_event(route_key="GET /tasks", query={"role": "assigned"}),
                None,
            )

        self.assertEqual(result["statusCode"], 200)
        body = json.loads(result["body"])
        self.assertEqual(len(body["tasks"]), 1)
        self.assertNotIn("nextToken", body)
        self.assertNotIn("notificationPublishState", body["tasks"][0])
        kwargs = tasks.query.call_args.kwargs
        self.assertEqual(kwargs["IndexName"], "assigneeId-createdSortKey")
        self.assertFalse(kwargs["ScanIndexForward"])
        self.assertEqual(kwargs["Limit"], 20)

    def test_lists_created_and_returns_next_token(self):
        tasks = unittest.mock.Mock()
        tasks.query.return_value = {
            "Items": [],
            "LastEvaluatedKey": {
                "creatorId": "user-123",
                "createdSortKey": f"2026-09-13T12:00:00Z#{TASK_ID}",
                "taskId": TASK_ID,
            },
        }

        with patch.object(lambda_function, "_tasks_table", return_value=tasks):
            result = lambda_function.lambda_handler(
                api_event(route_key="GET /tasks", query={"role": "created", "limit": "2"}),
                None,
            )

        self.assertEqual(result["statusCode"], 200)
        body = json.loads(result["body"])
        self.assertIn("nextToken", body)
        kwargs = tasks.query.call_args.kwargs
        self.assertEqual(kwargs["IndexName"], "creatorId-createdSortKey")
        self.assertEqual(kwargs["Limit"], 2)

    def test_rejects_bad_role_and_token(self):
        missing = lambda_function.lambda_handler(
            api_event(route_key="GET /tasks", query={}), None
        )
        bad_role = lambda_function.lambda_handler(
            api_event(route_key="GET /tasks", query={"role": "owner"}), None
        )
        bad_token = lambda_function.lambda_handler(
            api_event(
                route_key="GET /tasks",
                query={"role": "assigned", "nextToken": "%%%"},
            ),
            None,
        )
        self.assertEqual(missing["statusCode"], 400)
        self.assertEqual(bad_role["statusCode"], 400)
        self.assertEqual(bad_token["statusCode"], 400)

    def test_rejects_malformed_next_token_on_query_validation(self):
        bad_token = base64.urlsafe_b64encode(
            json.dumps({"not": "a-key"}, separators=(",", ":")).encode("ascii")
        ).decode("ascii")
        tasks = unittest.mock.Mock()
        tasks.query.side_effect = ClientError(
            {
                "Error": {
                    "Code": "ValidationException",
                    "Message": "Invalid ExclusiveStartKey",
                }
            },
            "Query",
        )

        with patch.object(lambda_function, "_tasks_table", return_value=tasks):
            result = lambda_function.lambda_handler(
                api_event(
                    route_key="GET /tasks",
                    query={"role": "assigned", "nextToken": bad_token},
                ),
                None,
            )

        self.assertEqual(result["statusCode"], 400)
        self.assertEqual(json.loads(result["body"]), {"message": "Invalid request"})

    def test_rejects_float_next_token_before_assigned_query(self):
        bad_token = base64.urlsafe_b64encode(
            json.dumps({"assigneeId": 1.5}, separators=(",", ":")).encode("ascii")
        ).decode("ascii")
        tasks = unittest.mock.Mock()
        tasks.query.side_effect = TypeError(
            "Float types are not supported. Use Decimal types instead."
        )

        with patch.object(lambda_function, "_tasks_table", return_value=tasks):
            result = lambda_function.lambda_handler(
                api_event(
                    route_key="GET /tasks",
                    query={"role": "assigned", "nextToken": bad_token},
                ),
                None,
            )

        self.assertEqual(result["statusCode"], 400)
        self.assertEqual(json.loads(result["body"]), {"message": "Invalid request"})
        tasks.query.assert_not_called()


class UpdateTaskStatusTests(unittest.TestCase):
    def test_assignee_completes_open_task(self):
        tasks = unittest.mock.Mock()
        tasks.get_item.return_value = {
            "Item": {
                "taskId": TASK_ID,
                "title": "Ship keys",
                "description": "Fill the data model",
                "creatorId": "other",
                "assigneeId": "user-123",
                "status": "open",
                "createdAt": "2026-09-13T12:00:00Z",
            }
        }
        tasks.update_item.return_value = {
            "Attributes": {
                "taskId": TASK_ID,
                "title": "Ship keys",
                "description": "Fill the data model",
                "creatorId": "other",
                "assigneeId": "user-123",
                "status": "complete",
                "createdAt": "2026-09-13T12:00:00Z",
                "completedAt": "2026-09-13T13:00:00Z",
            }
        }

        with (
            patch.object(lambda_function, "_tasks_table", return_value=tasks),
            patch.object(lambda_function, "_now_iso", return_value="2026-09-13T13:00:00Z"),
        ):
            result = lambda_function.lambda_handler(
                api_event(
                    route_key="PATCH /tasks/{taskId}/status",
                    body={"status": "complete"},
                    path={"taskId": TASK_ID},
                ),
                None,
            )

        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(json.loads(result["body"])["task"]["status"], "complete")
        tasks.update_item.assert_called_once()

    def test_rejects_non_assignee_and_repeats_complete(self):
        tasks = unittest.mock.Mock()
        tasks.get_item.return_value = {
            "Item": {
                "taskId": TASK_ID,
                "title": "Ship keys",
                "description": "Fill the data model",
                "creatorId": "user-123",
                "assigneeId": "other",
                "status": "open",
                "createdAt": "2026-09-13T12:00:00Z",
            }
        }

        with patch.object(lambda_function, "_tasks_table", return_value=tasks):
            forbidden = lambda_function.lambda_handler(
                api_event(
                    route_key="PATCH /tasks/{taskId}/status",
                    body={"status": "complete"},
                    path={"taskId": TASK_ID},
                ),
                None,
            )
        self.assertEqual(forbidden["statusCode"], 403)
        tasks.update_item.assert_not_called()

        completed = {
            "taskId": TASK_ID,
            "title": "Ship keys",
            "description": "Fill the data model",
            "creatorId": "other",
            "assigneeId": "user-123",
            "status": "complete",
            "createdAt": "2026-09-13T12:00:00Z",
            "completedAt": "2026-09-13T13:00:00Z",
        }
        tasks.get_item.return_value = {"Item": completed}
        with patch.object(lambda_function, "_tasks_table", return_value=tasks):
            repeat = lambda_function.lambda_handler(
                api_event(
                    route_key="PATCH /tasks/{taskId}/status",
                    body={"status": "complete"},
                    path={"taskId": TASK_ID},
                ),
                None,
            )
        self.assertEqual(repeat["statusCode"], 200)
        self.assertEqual(json.loads(repeat["body"])["task"]["completedAt"], "2026-09-13T13:00:00Z")
        tasks.update_item.assert_not_called()


class NotificationReadTests(unittest.TestCase):
    def test_returns_null_notification_for_task_party(self):
        tasks = unittest.mock.Mock()
        tasks.get_item.return_value = {
            "Item": {
                "taskId": TASK_ID,
                "creatorId": "user-123",
                "assigneeId": "other",
                "title": "Ship keys",
                "description": "x",
                "status": "open",
                "createdAt": "2026-09-13T12:00:00Z",
            }
        }
        notes = unittest.mock.Mock()
        notes.get_item.return_value = {}

        with (
            patch.object(lambda_function, "_tasks_table", return_value=tasks),
            patch.object(lambda_function, "_notifications_table", return_value=notes),
        ):
            result = lambda_function.lambda_handler(
                api_event(
                    route_key="GET /tasks/{taskId}/notification",
                    path={"taskId": TASK_ID},
                ),
                None,
            )

        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(json.loads(result["body"]), {"notification": None})

    def test_forbids_strangers_and_lists_empty_history(self):
        tasks = unittest.mock.Mock()
        tasks.get_item.return_value = {
            "Item": {
                "taskId": TASK_ID,
                "creatorId": "a",
                "assigneeId": "b",
            }
        }
        notes = unittest.mock.Mock()
        notes.query.return_value = {"Items": []}

        with (
            patch.object(lambda_function, "_tasks_table", return_value=tasks),
            patch.object(lambda_function, "_notifications_table", return_value=notes),
        ):
            forbidden = lambda_function.lambda_handler(
                api_event(
                    route_key="GET /tasks/{taskId}/notification",
                    path={"taskId": TASK_ID},
                ),
                None,
            )
            history = lambda_function.lambda_handler(
                api_event(route_key="GET /notifications"), None
            )

        self.assertEqual(forbidden["statusCode"], 403)
        self.assertEqual(history["statusCode"], 200)
        self.assertEqual(json.loads(history["body"]), {"notifications": []})
        kwargs = notes.query.call_args.kwargs
        self.assertEqual(kwargs["IndexName"], "historyRecipientId-historySortKey")
        self.assertFalse(kwargs["ScanIndexForward"])

    def test_rejects_invalid_notifications_next_token(self):
        float_token = base64.urlsafe_b64encode(
            json.dumps({"historyRecipientId": 1.5}, separators=(",", ":")).encode(
                "ascii"
            )
        ).decode("ascii")
        wrong_pk_token = base64.urlsafe_b64encode(
            json.dumps(
                {
                    "historyRecipientId": "other-user",
                    "historySortKey": "2026-09-13T12:00:00Z#sent",
                    "taskId": TASK_ID,
                },
                separators=(",", ":"),
            ).encode("ascii")
        ).decode("ascii")
        notes = unittest.mock.Mock()
        notes.query.side_effect = TypeError(
            "Float types are not supported. Use Decimal types instead."
        )

        with patch.object(lambda_function, "_notifications_table", return_value=notes):
            float_result = lambda_function.lambda_handler(
                api_event(
                    route_key="GET /notifications",
                    query={"nextToken": float_token},
                ),
                None,
            )
            pk_result = lambda_function.lambda_handler(
                api_event(
                    route_key="GET /notifications",
                    query={"nextToken": wrong_pk_token},
                ),
                None,
            )

        self.assertEqual(float_result["statusCode"], 400)
        self.assertEqual(json.loads(float_result["body"]), {"message": "Invalid request"})
        self.assertEqual(pk_result["statusCode"], 400)
        self.assertEqual(json.loads(pk_result["body"]), {"message": "Invalid request"})
        notes.query.assert_not_called()
