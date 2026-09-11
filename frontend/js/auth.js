/* Public SPA configuration. This browser client intentionally has no secret. */
const AUTH_CONFIG = Object.freeze({
    cognitoDomain: "https://us-east-2e4zskjgi6.auth.us-east-2.amazoncognito.com",
    clientId: "3shfthangguj7gion7a2afia6e",
    apiBaseUrl: "https://o7f51vbeyh.execute-api.us-east-2.amazonaws.com",
    redirectUri: `${window.location.origin}/`,
    logoutUri: `${window.location.origin}/`,
    scope: "openid email profile shared-task-api/access"
});

const TRANSACTION_KEY = "s3nt.cognito.transaction";
const SESSION_KEY = "s3nt.cognito.session";

function bytesToBase64Url(bytes) {
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function randomValue() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return bytesToBase64Url(bytes);
}

async function pkceChallenge(verifier) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return bytesToBase64Url(new Uint8Array(digest));
}

function readJsonStorage(key) {
    const value = sessionStorage.getItem(key);
    return value ? JSON.parse(value) : null;
}

function idTokenPayload(idToken) {
    const encodedPayload = idToken.split(".")[1];
    if (!encodedPayload) throw new Error("The ID token is malformed.");
    const padded = encodedPayload.replaceAll("-", "+").replaceAll("_", "/")
        .padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))));
}

function getSession() {
    const session = readJsonStorage(SESSION_KEY);
    if (!session?.accessToken || !session.receivedAt || !session.expiresIn) return null;
    if (Date.now() >= session.receivedAt + (session.expiresIn * 1000)) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
    }
    return session;
}

async function startSignIn() {
    if (!window.isSecureContext || !window.crypto?.subtle) {
        throw new Error("Sign-in requires HTTPS (or localhost) and a modern browser.");
    }
    const verifier = randomValue();
    const state = randomValue();
    const nonce = randomValue();
    sessionStorage.setItem(TRANSACTION_KEY, JSON.stringify({ verifier, state, nonce }));
    const query = new URLSearchParams({
        response_type: "code",
        client_id: AUTH_CONFIG.clientId,
        redirect_uri: AUTH_CONFIG.redirectUri,
        scope: AUTH_CONFIG.scope,
        code_challenge: await pkceChallenge(verifier),
        code_challenge_method: "S256",
        state,
        nonce
    });
    window.location.assign(`${AUTH_CONFIG.cognitoDomain}/oauth2/authorize?${query}`);
}

async function loadProfile(accessToken = getSession()?.accessToken) {
    if (!accessToken) throw new Error("Your session has expired. Please sign in again.");
    const response = await fetch(`${AUTH_CONFIG.apiBaseUrl}/me`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) {
        if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
        if (response.status === 404) throw new Error("No application profile was found for this signed-in user.");
        throw new Error(`The profile request failed (${response.status}).`);
    }
    const payload = await response.json();
    if (!payload?.user?.userId) throw new Error("The profile response was invalid.");
    return payload.user;
}

async function finishSignIn(code, returnedState) {
    const transaction = readJsonStorage(TRANSACTION_KEY);
    if (!transaction || returnedState !== transaction.state) {
        throw new Error("The sign-in response could not be verified. Please sign in again.");
    }
    const response = await fetch(`${AUTH_CONFIG.cognitoDomain}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: AUTH_CONFIG.clientId,
            code,
            redirect_uri: AUTH_CONFIG.redirectUri,
            code_verifier: transaction.verifier
        })
    });
    const tokens = await response.json();
    if (!response.ok || !tokens.access_token || !tokens.id_token) {
        throw new Error("Cognito could not complete the sign-in. Please sign in again.");
    }
    if (idTokenPayload(tokens.id_token).nonce !== transaction.nonce) {
        throw new Error("The sign-in response could not be verified. Please sign in again.");
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        accessToken: tokens.access_token,
        idToken: tokens.id_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        receivedAt: Date.now()
    }));
    sessionStorage.removeItem(TRANSACTION_KEY);
    window.history.replaceState({}, document.title, AUTH_CONFIG.redirectUri);
    return loadProfile(tokens.access_token);
}

async function handleCallback() {
    const query = new URLSearchParams(window.location.search);
    if (query.has("error")) {
        sessionStorage.removeItem(TRANSACTION_KEY);
        window.history.replaceState({}, document.title, AUTH_CONFIG.redirectUri);
        throw new Error("Cognito cancelled or rejected the sign-in. Please try again.");
    }
    if (!query.has("code")) return null;
    return finishSignIn(query.get("code"), query.get("state"));
}

function logout() {
    sessionStorage.removeItem(TRANSACTION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    const query = new URLSearchParams({ client_id: AUTH_CONFIG.clientId, logout_uri: AUTH_CONFIG.logoutUri });
    window.location.assign(`${AUTH_CONFIG.cognitoDomain}/logout?${query}`);
}

window.S3NTAuth = Object.freeze({ startSignIn, handleCallback, getSession, loadProfile, logout });
