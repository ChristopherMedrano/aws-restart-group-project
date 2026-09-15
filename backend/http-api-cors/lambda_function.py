"""Set HTTP API CORS from CloudFormation. SAM CorsConfiguration does not always update an existing API."""

import json
import logging
import urllib.request

import boto3

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)


def _send(event, status, reason=""):
    body = json.dumps({
        "Status": status,
        "Reason": reason[:256],
        "PhysicalResourceId": event.get("PhysicalResourceId") or "http-api-cors",
        "StackId": event["StackId"],
        "RequestId": event["RequestId"],
        "LogicalResourceId": event["LogicalResourceId"],
        "Data": {},
    }).encode()
    request = urllib.request.Request(event["ResponseURL"], data=body, method="PUT")
    request.add_header("content-type", "")
    urllib.request.urlopen(request)


def lambda_handler(event, context):
    if event["RequestType"] == "Delete":
        _send(event, "SUCCESS")
        return
    props = event["ResourceProperties"]
    origins = props.get("AllowOrigins") or []
    if isinstance(origins, str):
        origins = [part for part in origins.split(",") if part]
    try:
        boto3.client("apigatewayv2").update_api(
            ApiId=props["ApiId"],
            CorsConfiguration={
                "AllowOrigins": origins,
                "AllowMethods": ["GET", "POST", "PATCH", "OPTIONS"],
                "AllowHeaders": ["authorization", "content-type"],
                "MaxAge": 300,
            },
        )
    except Exception:
        LOGGER.exception("Unable to update HTTP API CORS")
        _send(event, "FAILED", "Unable to update HTTP API CORS")
        raise
    _send(event, "SUCCESS")
