"""Task API Lambda entry point.

API Gateway HTTP API validates the Cognito JWT before this handler is invoked.
The handler therefore treats the JWT `sub` claim as the caller identity and
never accepts a user ID from a request body or query parameter.
"""

import base64
import json
import logging
import os
import re
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError, ParamValidationError

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

# Attributes: GET /me
PROFILE_FIELDS = (
    "userId",
    "displayName",
    "email",
    "emailNotificationsEnabled",
    "createdAt",
)

UUID_V4 = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)
TASK_FIELDS = (
    "taskId",
    "title",
    "description",
    "creatorId",
    "assigneeId",
    "status",
    "createdAt",
    "completedAt",
)

DEFAULT_LIMIT = 20
MAX_LIMIT = 50


# Open the configured DynamoDB Users table.
def _users_table():
    """Return the Users table configured for this deployment."""
    return boto3.resource("dynamodb").Table(os.environ["USERS_TABLE"])


def _now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _tasks_table():
    return boto3.resource("dynamodb").Table(os.environ["TASKS_TABLE"])


def task_from_item(item):
    """Return public task fields; completedAt is JSON null when unset."""
    public = {field: item[field] for field in TASK_FIELDS if field in item}
    public.setdefault("completedAt", None)
    return public


# Create the HTTP response API Gateway sends back to the browser.
def response(status_code, body):
    """Build the API Gateway HTTP API proxy response."""
    return {
        "statusCode": status_code,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(body),
    }


# Extract the authenticated Cognito user ID from API Gateway's JWT claims.
def caller_id(event):
    """Read the caller from API Gateway's already-validated JWT claims."""
    return (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
        .get("sub")
    )


def parse_json_object(event):
    """Parse the HTTP API body as a JSON object, or return None."""
    raw = event.get("body")
    if raw in (None, ""):
        return None
    if event.get("isBase64Encoded"):
        try:
            raw = base64.b64decode(raw).decode("utf-8")
        except (ValueError, UnicodeDecodeError):
            return None
    try:
        data = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    return data


def valid_text(value, min_bytes, max_bytes):
    """Return True when value is a non-blank string within UTF-8 byte bounds and has no CR."""
    if not isinstance(value, str) or "\r" in value or value.strip() == "":
        return False
    size = len(value.encode("utf-8"))
    return min_bytes <= size <= max_bytes


# Remove internal DynamoDB attributes before returning a user profile.
def profile_from_item(item):
    """Return only the profile fields allowed by the public API."""
    return {field: item[field] for field in PROFILE_FIELDS if field in item}


# Read one profile by its Cognito user ID.
def get_profile(user_id):
    """Load one user profile with a strongly consistent primary-key read."""
    return _users_table().get_item(
        Key={"userId": user_id},
        ConsistentRead=True,
    ).get("Item")


# Handle the implemented GET /me route.
def get_me(user_id):
    """Return the authenticated caller's application profile."""
    LOGGER.info("GET /me requested")

    try:
        item = get_profile(user_id)
    except ClientError:
        # Do not log the event: it can include an Authorization header.
        LOGGER.exception("Unable to load profile from Users")
        return response(500, {"message": "Unable to load profile"})

    if not item:
        LOGGER.info("GET /me profile not found")
        return response(404, {"message": "Profile not found"})

    LOGGER.info("GET /me succeeded")
    return response(200, {"user": profile_from_item(item)})


def update_me(event, user_id):
    """Update the authenticated caller's display name and/or email preference."""
    LOGGER.info("PATCH /me requested")
    body = parse_json_object(event)
    if body is None:
        return response(400, {"message": "Invalid request"})

    has_name = "displayName" in body
    has_pref = "emailNotificationsEnabled" in body
    if not has_name and not has_pref:
        return response(400, {"message": "Invalid request"})

    names = {}
    values = {}
    sets = []
    if has_name:
        display_name = body["displayName"]
        if not valid_text(display_name, 1, 140):
            return response(400, {"message": "Invalid request"})
        sets.append("#dn = :dn")
        sets.append("displayNameKey = :dnk")
        names["#dn"] = "displayName"
        values[":dn"] = display_name
        values[":dnk"] = f"{display_name.lower()}#{user_id}"
    if has_pref:
        enabled = body["emailNotificationsEnabled"]
        if not isinstance(enabled, bool):
            return response(400, {"message": "Invalid request"})
        sets.append("emailNotificationsEnabled = :en")
        values[":en"] = enabled

    update_kwargs = {
        "Key": {"userId": user_id},
        "UpdateExpression": "SET " + ", ".join(sets),
        "ExpressionAttributeValues": values,
        "ConditionExpression": "attribute_exists(userId)",
        "ReturnValues": "ALL_NEW",
    }
    if names:
        update_kwargs["ExpressionAttributeNames"] = names

    try:
        updated = _users_table().update_item(**update_kwargs)
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            LOGGER.info("PATCH /me profile not found")
            return response(404, {"message": "Profile not found"})
        LOGGER.exception("Unable to update profile")
        return response(500, {"message": "Unable to update profile"})

    LOGGER.info("PATCH /me succeeded")
    return response(200, {"user": profile_from_item(updated.get("Attributes", {}))})


def get_assignees(user_id):
    """Return the assignee directory without emails or preferences."""
    LOGGER.info("GET /assignees requested")
    items = []
    kwargs = {
        "IndexName": "directoryPk-displayNameKey",
        "KeyConditionExpression": "directoryPk = :pk",
        "ExpressionAttributeValues": {":pk": "DIRECTORY"},
    }
    try:
        while True:
            page = _users_table().query(**kwargs)
            items.extend(page.get("Items", []))
            last = page.get("LastEvaluatedKey")
            if not last:
                break
            kwargs["ExclusiveStartKey"] = last
    except ClientError:
        LOGGER.exception("Unable to load assignees")
        return response(500, {"message": "Unable to load assignees"})

    assignees = [
        {"userId": item["userId"], "displayName": item.get("displayName")}
        for item in items
        if "userId" in item
    ]
    LOGGER.info("GET /assignees succeeded")
    return response(200, {"assignees": assignees})


def create_task(event, user_id):
    """Create a task or return the existing identical retry. Do not publish SNS."""
    LOGGER.info("POST /tasks requested")
    body = parse_json_object(event)
    if body is None:
        return response(400, {"message": "Invalid request"})

    task_id = body.get("taskId")
    title = body.get("title")
    description = body.get("description")
    assignee_id = body.get("assigneeId")
    if not isinstance(task_id, str) or not UUID_V4.fullmatch(task_id):
        return response(400, {"message": "Invalid request"})
    if not valid_text(title, 1, 140) or not valid_text(description, 1, 4000):
        return response(400, {"message": "Invalid request"})
    if not isinstance(assignee_id, str) or not assignee_id:
        return response(400, {"message": "Invalid request"})

    try:
        assignee = get_profile(assignee_id)
    except ClientError:
        LOGGER.exception("Unable to load assignee")
        return response(500, {"message": "Unable to create task"})
    if not assignee:
        LOGGER.info("POST /tasks assignee not found")
        return response(404, {"message": "Assignee not found"})

    created_at = _now_iso()
    item = {
        "taskId": task_id,
        "title": title,
        "description": description,
        "creatorId": user_id,
        "assigneeId": assignee_id,
        "status": "open",
        "createdAt": created_at,
        "createdSortKey": f"{created_at}#{task_id}",
        "notificationPublishState": "unpublished",
    }

    try:
        _tasks_table().put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(taskId)",
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "ConditionalCheckFailedException":
            LOGGER.exception("Unable to create task")
            return response(500, {"message": "Unable to create task"})
        try:
            existing = _tasks_table().get_item(
                Key={"taskId": task_id},
                ConsistentRead=True,
            ).get("Item")
        except ClientError:
            LOGGER.exception("Unable to load task")
            return response(500, {"message": "Unable to create task"})
        if not existing:
            return response(500, {"message": "Unable to create task"})
        same = (
            existing.get("creatorId") == user_id
            and existing.get("title") == title
            and existing.get("description") == description
            and existing.get("assigneeId") == assignee_id
        )
        if not same:
            LOGGER.info("POST /tasks conflict")
            return response(409, {"message": "Task conflict"})
        LOGGER.info("POST /tasks identical retry")
        return response(200, {"task": task_from_item(existing)})

    LOGGER.info("POST /tasks created")
    return response(201, {"task": task_from_item(item)})


def encode_next_token(last_evaluated_key):
    if not last_evaluated_key:
        return None
    return base64.urlsafe_b64encode(
        json.dumps(last_evaluated_key, separators=(",", ":")).encode("utf-8")
    ).decode("ascii")


def decode_next_token(raw):
    try:
        padded = raw + "=" * ((4 - len(raw) % 4) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    return data


def parse_limit(query):
    raw = (query or {}).get("limit")
    if raw in (None, ""):
        return DEFAULT_LIMIT, None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None, response(400, {"message": "Invalid request"})
    if value < 1 or value > MAX_LIMIT:
        return None, response(400, {"message": "Invalid request"})
    return value, None


def get_tasks(event, user_id):
    """List the caller's created or assigned tasks, newest first."""
    LOGGER.info("GET /tasks requested")
    query = event.get("queryStringParameters") or {}
    role = query.get("role")
    if role == "created":
        index_name = "creatorId-createdSortKey"
        pk_name = "creatorId"
    elif role == "assigned":
        index_name = "assigneeId-createdSortKey"
        pk_name = "assigneeId"
    else:
        return response(400, {"message": "Invalid request"})

    limit, error = parse_limit(query)
    if error:
        return error

    start_key = None
    token = query.get("nextToken")
    if token:
        start_key = decode_next_token(token)
        if start_key is None:
            return response(400, {"message": "Invalid request"})

    kwargs = {
        "IndexName": index_name,
        "KeyConditionExpression": "#pk = :pk",
        "ExpressionAttributeNames": {"#pk": pk_name},
        "ExpressionAttributeValues": {":pk": user_id},
        "ScanIndexForward": False,
        "Limit": limit,
    }
    if start_key:
        kwargs["ExclusiveStartKey"] = start_key

    try:
        page = _tasks_table().query(**kwargs)
    except ParamValidationError:
        return response(400, {"message": "Invalid request"})
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ValidationException":
            return response(400, {"message": "Invalid request"})
        LOGGER.exception("Unable to list tasks")
        return response(500, {"message": "Unable to list tasks"})

    body = {"tasks": [task_from_item(item) for item in page.get("Items", [])]}
    next_token = encode_next_token(page.get("LastEvaluatedKey"))
    if next_token:
        body["nextToken"] = next_token
    LOGGER.info("GET /tasks succeeded")
    return response(200, body)


# TODO: PATCH /tasks/{taskId}/status accepts only {"status": "complete"}.
# Return: 200 {"task": task}; a repeated completion returns the same task.
# Security: only the task assignee may complete the task.
def update_task_status(event, user_id):
    """Stub for the future PATCH /tasks/{taskId}/status implementation."""
    return response(501, {"message": "Not implemented"})


# TODO: GET /tasks/{taskId}/notification reads the one notification outcome.
# Return: 200 {"notification": notification-or-null}.
# Security: only the task creator or assignee may read it.
def get_task_notification(event, user_id):
    """Stub for the future GET /tasks/{taskId}/notification implementation."""
    return response(501, {"message": "Not implemented"})


# TODO: GET /notifications supports optional opaque pagination.
# Return: 200 {"notifications": [...], "nextToken": "..."} when another page exists.
# Security: return only the authenticated caller's history; omit task titles.
def get_notifications(event, user_id):
    """Stub for the future GET /notifications implementation."""
    return response(501, {"message": "Not implemented"})


# Route authenticated API Gateway requests to their route handlers.
def lambda_handler(event, context):
    """Route Task API requests for authenticated callers."""
    user_id = caller_id(event)
    if not user_id:
        return response(401, {"message": "Unauthorized"})

    route_key = event.get("routeKey")
    if route_key == "GET /me":
        return get_me(user_id)
    if route_key == "PATCH /me":
        return update_me(event, user_id)
    if route_key == "GET /assignees":
        return get_assignees(user_id)
    if route_key == "POST /tasks":
        return create_task(event, user_id)
    if route_key == "GET /tasks":
        return get_tasks(event, user_id)
    if route_key == "PATCH /tasks/{taskId}/status":
        return update_task_status(event, user_id)
    if route_key == "GET /tasks/{taskId}/notification":
        return get_task_notification(event, user_id)
    if route_key == "GET /notifications":
        return get_notifications(event, user_id)

    return response(404, {"message": "Not found"})
