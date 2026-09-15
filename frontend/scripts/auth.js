/* Cognito PKCE + session. No client secret in the browser.
   Pool/client/API ids come from config.local.js (window.S3NT_CONFIG). */
const AUTH_CONFIG = Object.freeze(window.S3NT_CONFIG || {});

function requireConfig() {
    if (
        !AUTH_CONFIG.cognitoDomain
        || !AUTH_CONFIG.clientId
        || !AUTH_CONFIG.redirectUri
        || !AUTH_CONFIG.logoutUri
        || !AUTH_CONFIG.scope
    ) {
        throw new Error("Runtime configuration is missing or invalid.");
    }
}

// PKCE verifier lives here until /callback; tokens after that.
const TRANSACTION_KEY = "s3nt.cognito.transaction";
const SESSION_KEY = "s3nt.cognito.session";

function bytesToBase64Url(bytes) {
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    // Cognito wants this flavor: -/_ and no = padding.
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
    // Cognito expires_in is seconds. Easy to treat it as ms and never expire.
    if (Date.now() >= session.receivedAt + (session.expiresIn * 1000)) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
    }
    return session;
}

async function startSignIn() {
    requireConfig();
    if (!window.isSecureContext || !window.crypto?.subtle) {
        throw new Error("Sign-in requires HTTPS (or localhost) and a modern browser.");
    }
    const verifier = randomValue();
    const state = randomValue(); // CSRF check on the way back
    const nonce = randomValue(); // must match the id_token later
    // Keep verifier in sessionStorage so the token swap can prove we started this login.
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

async function loadProfile() {
    // Defined in api.js; both scripts are defer so this is safe at call time.
    return window.S3NTApi.getMe();
}

async function finishSignIn(code, returnedState) {
    requireConfig();
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
    // API Gateway JWT authorizer wants the access token, not the id token.
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        accessToken: tokens.access_token,
        idToken: tokens.id_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        receivedAt: Date.now()
    }));
    sessionStorage.removeItem(TRANSACTION_KEY);
    // Drop ?code= from the address bar so a refresh doesn't try to reuse it.
    window.history.replaceState({}, document.title, AUTH_CONFIG.redirectUri);
    return loadProfile();
}

async function handleCallback() {
    const query = new URLSearchParams(window.location.search);
    if (query.has("error")) {
        sessionStorage.removeItem(TRANSACTION_KEY);
        window.history.replaceState({}, document.title, AUTH_CONFIG.redirectUri);
        throw new Error("Cognito cancelled or rejected the sign-in. Please try again.");
    }
    if (!query.has("code")) return null; // normal visit, not a Cognito return
    return finishSignIn(query.get("code"), query.get("state"));
}

// Local sign-out only (API 401). logout() also hits Cognito hosted logout.
function expireSession() {
    sessionStorage.removeItem(TRANSACTION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
}

function logout() {
    requireConfig();
    expireSession();
    const query = new URLSearchParams({ client_id: AUTH_CONFIG.clientId, logout_uri: AUTH_CONFIG.logoutUri });
    window.location.assign(`${AUTH_CONFIG.cognitoDomain}/logout?${query}`);
}

window.S3NTAuth = Object.freeze({
    startSignIn,
    handleCallback,
    getSession,
    loadProfile,
    expireSession,
    logout
});
