# S3NT frontend

This directory contains the S3NT browser application. It is a single-page
application served as static files through CloudFront and S3.

## Current behavior

- Uses Cognito managed login with authorization code + PKCE.
- Keeps the Cognito session in `sessionStorage`.
- Calls protected `GET /me` and shows the signed-in user's display name and ID
  on the Profile route.
- Provides SPA shells for Assigned Tasks, Created Tasks, Create Task, and
  Notifications. Those screens deliberately do not use sample data or browser
  task storage while their API routes are being built.

## Files

```text
frontend/
├── index.html       # SPA shell
├── css/style.css    # shared visual design
└── js/
    ├── auth.js      # Cognito PKCE, session, logout, and GET /me client
    └── app.js       # routing and page rendering
```

## Deployment configuration

`auth.js` contains public identifiers for the current shared-dev user pool and
HTTP API. The Cognito app client must list the exact deployed CloudFront origin
as both a callback and sign-out URL. API Gateway CORS must allow that same
origin and the `authorization` request header.

The app uses History API paths such as `/tasks/assigned`. Before deploying
those deep links, configure CloudFront to return `index.html` for missing SPA
paths; otherwise a direct page load at a nested path will not reach the SPA.

Never add a client secret, bearer token, authorization code, password, or email
address to this repository or this README.
