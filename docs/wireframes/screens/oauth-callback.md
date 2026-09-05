# Sign-In Callback

Route: `/callback`. This SPA page finishes the return from the external sign-in
flow and then redirects into the app.

```text
+----------------------------------------------------+
| Signing you in…                                    |
| Please wait while we finish your sign-in.          |
|                    [ loading ]                     |
+----------------------------------------------------+
```

Use the same centered status on mobile. Show a safe error and a sign-in-again
action if it fails; never show the returned sign-in details on screen.
