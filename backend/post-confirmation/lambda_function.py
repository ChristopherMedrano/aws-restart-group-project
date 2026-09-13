"""Cognito post-confirmation: create the application Users profile."""

import logging
import os
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)


def _users_table():
    return boto3.resource("dynamodb").Table(os.environ["USERS_TABLE"])


def _now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def profile_item(user_id, display_name, email):
    return {
        "userId": user_id,
        "displayName": display_name,
        "email": email,
        "emailNotificationsEnabled": True,
        "createdAt": _now_iso(),
        "directoryPk": "DIRECTORY",
        "displayNameKey": f"{display_name.lower()}#{user_id}",
    }


def lambda_handler(event, context):
    attrs = event.get("request", {}).get("userAttributes", {})
    user_id = attrs.get("sub")
    email = attrs.get("email")
    display_name = attrs.get("name") or "Member"

    if not user_id or not email:
        LOGGER.error("Cognito profile trigger missing sub or email")
        return event

    try:
        _users_table().put_item(
            Item=profile_item(user_id, display_name, email),
            ConditionExpression="attribute_not_exists(userId)",
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "ConditionalCheckFailedException":
            LOGGER.exception("Unable to create profile")
            raise
        LOGGER.info("Profile already exists")

    return event
