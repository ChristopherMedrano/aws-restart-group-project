# S3NT frontend

This directory contains the S3NT browser application. It is a static
single-page app: the browser loads these files as they are in git. There is no
`package.json`, bundler, or lint step. Local development uses `npx serve` on
port 5173. HTTPS hosting on CloudFront and private S3 is the planned `s3nt-web`
stack.

## Local development

```bash
cp config.example.js config.local.js
# Fill in Cognito domain, app client id, and Task API URL from stack outputs.
npx --yes serve -s . -l 5173
```

`config.local.js` is gitignored. Do not commit pool id, client id, API URL, or
tokens.

## Current behavior

- Uses Cognito managed login with authorization code + PKCE.
- Keeps the Cognito session in `sessionStorage`.
- Reads public runtime config from `config.local.js` (`window.S3NT_CONFIG`).
- Calls the Task API with the Cognito access token: profile (`GET`/`PATCH /me`),
  assignees, task create/list/complete, and notification reads.
- Create Task retries `POST /tasks` with the same UUID if the API returns
  `503 EVENT_PUBLISH_FAILED` (three extra attempts, then a manual retry). After
  save, it polls `GET /tasks/{taskId}/notification` every two seconds for 30
  seconds.
- Does not use sample data or browser task storage. Notification history is
  empty until the Notification Lambda writes.

## Files

```text
frontend/
├── config.example.js  # copy to gitignored config.local.js
├── index.html         # SPA shell
├── styles.css         # shared visual design
└── scripts/
    ├── api.js         # protected Task API client
    ├── auth.js        # Cognito PKCE, session, and logout
    └── app.js         # routing and page rendering
```

## Deployment configuration

Local callbacks are `http://localhost:5173/callback` and sign-out
`http://localhost:5173/`. When `s3nt-web` exists, the Cognito app client must
list the exact CloudFront origin as callback and sign-out, and API CORS must
allow that origin and the `authorization` header.

The app uses History API paths such as `/tasks/assigned`. CloudFront must
return `index.html` for missing SPA paths. Architecture also calls for hashed
immutable assets with short cache on `index.html` and `config.js`. That hashing
is not done in this folder yet; `s3nt-web` can add it at upload time.

Never add a client secret, bearer token, authorization code, password, or email
address to this repository or this README.
