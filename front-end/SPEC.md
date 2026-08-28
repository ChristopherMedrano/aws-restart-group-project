# Frontend specification (stub)

## Purpose

Provide the static single-page interface for the Shared Task Notifications MVP.

## Technology

- HTML, CSS, and JavaScript
- Amazon Cognito User Pool for registration and sign-in
- API Gateway HTTP API for protected requests using a Cognito JWT
- Private S3 origin delivered through CloudFront over HTTPS

## MVP screens and capabilities

- Register, sign in, and sign out.
- View and update the signed-in user's display name and email-notification preference.
- Create a task with a title, description, and registered assignee.
- View tasks created by the signed-in user.
- View tasks assigned to the signed-in user and mark an assigned task complete.
- View notification history, including `sent`, `skipped`, and `failed` outcomes.

## Integration requirements

- Store only the minimum Cognito session data needed by the client in
  `sessionStorage`; never log JWTs or place them in URLs.
- Include the Cognito JWT on protected API requests.
- Show a clear success state once an assignment is saved; notification delivery is asynchronous.
- During class development, restrict API CORS to the exact CloudFront origin and
  `http://localhost:8000`; remove localhost after local testing ends.

## Deployment and security

- Keep the S3 bucket private with Block Public Access enabled.
- Use CloudFront Origin Access Control, HTTPS redirection, and versioned asset names.
- Configure CloudFront custom error responses for origin `403` and `404`: serve
  `/index.html` with HTTP `200` and error-caching minimum TTL `0`, so `/callback`
  and other client routes load the SPA.
- Apply security response headers through CloudFront.

## Runtime configuration

Deploy a non-secret `config.js` before the application bundle with:

```js
window.APP_CONFIG = {
  apiBaseUrl: "https://API_ID.execute-api.REGION.amazonaws.com",
  awsRegion: "REGION",
  cognitoUserPoolId: "USER_POOL_ID",
  cognitoAppClientId: "APP_CLIENT_ID",
  cognitoDomain: "COGNITO_DOMAIN"
};
```

Use authorization-code flow with PKCE and a public app client without a secret.
Use email-only sign-in; require and verify the standard `email` attribute and
require the standard `name` attribute as the profile display name. Allow the app
client to read and write `email` and `name`. Create resource-server identifier
`shared-task-api` with scope `access`; enable only the authorization-code grant
with scopes `openid`, `email`, `profile`, and `shared-task-api/access`. Send the
Cognito access token as the API bearer token; every API route requires the custom
scope and the authorizer validates issuer and app-client audience.
Configure these Cognito URLs:

| Environment | Callback URL | Sign-out URL |
| --- | --- | --- |
| Deployed | `https://CLOUDFRONT_DOMAIN/callback` | `https://CLOUDFRONT_DOMAIN/` |
| Local | `http://localhost:8000/callback` | `http://localhost:8000/` |

`config.js` contains identifiers and endpoints only; it must never contain a
password, token, client secret, or AWS credential.

## Open decisions

- [x] Define API base-URL and Cognito configuration through deploy-time `config.js`.
- [ ] Confirm the UI design/wireframes and accessibility requirements.
- [ ] Define empty, loading, and error states for each screen.
