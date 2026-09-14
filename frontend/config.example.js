/* Copy to config.local.js for local development. Do not commit config.local.js.
   Fill in Cognito domain, app client id, and Task API base URL from stack outputs.
   This file is public SPA config only. Never add a client secret or tokens. */
window.S3NT_CONFIG = {
    cognitoDomain: "https://YOUR_COGNITO_DOMAIN.auth.us-east-2.amazoncognito.com",
    clientId: "YOUR_APP_CLIENT_ID",
    apiBaseUrl: "https://YOUR_API_ID.execute-api.us-east-2.amazonaws.com",
    redirectUri: "http://localhost:5173/callback",
    logoutUri: "http://localhost:5173/",
    scope: "openid email profile shared-task-api/access"
};
