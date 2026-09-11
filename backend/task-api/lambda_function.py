"""Task API Lambda entry point.

API Gateway HTTP API validates the Cognito JWT before this handler is invoked.
The handler therefore treats the JWT `sub` claim as the caller identity and
never accepts a user ID from a request body or query parameter.
"""

import json
import logging
import os

import boto3
from botocore.exceptions import ClientError

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

# Open the configured DynamoDB Users table.
def _users_table():
    """Return the Users table configured for this deployment."""
    return boto3.resource("dynamodb").Table(os.environ["USERS_TABLE"])


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


# Stub the future PATCH /me route.
def update_me(user_id):
    """Stub for the future PATCH /me implementation."""
    return response(501, {"message": "Not implemented"})


# Stub the future GET /assignees route.
def get_assignees(user_id):
    """Stub for the future GET /assignees implementation."""
    return response(501, {"message": "Not implemented"})


# Stub the future POST /tasks route.
def create_task(event, user_id):
    """Stub for the future POST /tasks implementation."""
    return response(501, {"message": "Not implemented"})


# Stub the future GET /tasks route.
def get_tasks(event, user_id):
    """Stub for the future GET /tasks implementation."""
    return response(501, {"message": "Not implemented"})


# Stub the future PATCH /tasks/{taskId}/status route.
def update_task_status(event, user_id):
    """Stub for the future PATCH /tasks/{taskId}/status implementation."""
    return response(501, {"message": "Not implemented"})


# Stub the future GET /tasks/{taskId}/notification route.
def get_task_notification(event, user_id):
    """Stub for the future GET /tasks/{taskId}/notification implementation."""
    return response(501, {"message": "Not implemented"})


# Stub the future GET /notifications route.
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
        return update_me(user_id)
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
