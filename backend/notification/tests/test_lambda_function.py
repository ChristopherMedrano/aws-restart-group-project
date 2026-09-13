"""Unit tests for the Notification Lambda stub."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import lambda_function


class NotificationStubTests(unittest.TestCase):
    def test_does_not_send_email(self):
        result = lambda_function.lambda_handler({"Records": []}, None)
        self.assertEqual(result, {"ok": True, "ses": "not_implemented"})
        self.assertFalse(hasattr(lambda_function, "ses_client"))
