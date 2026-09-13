"""Notification Lambda stub. SES send is not implemented in the first delivery."""

import logging

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)


def lambda_handler(event, context):
    LOGGER.info("Notification stub; SES send is not implemented")
    return {"ok": True, "ses": "not_implemented"}
