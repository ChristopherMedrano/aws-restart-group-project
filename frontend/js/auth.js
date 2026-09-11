/*
 * Public SPA configuration. This client intentionally has no secret.
 * Before deploying, add this exact HTTPS origin (with its trailing slash) to
 * the Cognito app client's callback and sign-out URL lists.
 */
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

function setStatus(message, isError = false) {
    const status = document.getElementById("auth-status");
    if (!status) return;

    status.textContent = message;
    status.classList.toggle("error", isError);
}

function showProfile(user) {
    const profile = document.getElementById("profile");
    const name = document.getElementById("profile-name");
    const id = document.getElementById("profile-id");

    name.textContent = user.displayName || "Signed-in user";
    id.textContent = user.userId ? `User ID: ${user.userId}` : "";
    profile.hidden = false;
}

async function loadProfile(accessToken) {
    const response = await fetch(`${AUTH_CONFIG.apiBaseUrl}/me`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error("No application profile was found for this signed-in user.");
        }
        throw new Error(`The profile request failed (${response.status}).`);
    }

    const payload = await response.json();
    if (!payload || !payload.user || !payload.user.userId) {
        throw new Error("The profile response was invalid.");
    }

    showProfile(payload.user);
}

function bytesToBase64Url(bytes) {
    let binary = "";
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
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

async function startSignIn() {
    if (!window.isSecureContext || !window.crypto?.subtle) {
        throw new Error("Sign-in requires HTTPS (or localhost) and a modern browser.");
    }

    const verifier = randomValue();
    const state = randomValue();
    const nonce = randomValue();
    const challenge = await pkceChallenge(verifier);

    sessionStorage.setItem(TRANSACTION_KEY, JSON.stringify({ verifier, state, nonce }));

    const query = new URLSearchParams({
        response_type: "code",
        client_id: AUTH_CONFIG.clientId,
        redirect_uri: AUTH_CONFIG.redirectUri,
        scope: AUTH_CONFIG.scope,
        code_challenge: challenge,
        code_challenge_method: "S256",
        state,
        nonce
    });

    window.location.assign(`${AUTH_CONFIG.cognitoDomain}/oauth2/authorize?${query}`);
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
    try {
        await loadProfile(tokens.access_token);
        setStatus("Signed in. Your application profile is loaded.");
    } catch (error) {
        console.error("Could not load application profile", error);
        setStatus("Signed in, but the application profile could not be loaded. Check the /me API and CORS settings.", true);
    }
}

async function handleCallback() {
    const query = new URLSearchParams(window.location.search);
    if (query.has("error")) {
        sessionStorage.removeItem(TRANSACTION_KEY);
        window.history.replaceState({}, document.title, AUTH_CONFIG.redirectUri);
        throw new Error("Cognito cancelled or rejected the sign-in. Please try again.");
    }
    if (!query.has("code")) return;

    setStatus("Completing sign in…");
    await finishSignIn(query.get("code"), query.get("state"));
}

async function logout() {
    sessionStorage.removeItem(TRANSACTION_KEY);
    sessionStorage.removeItem(SESSION_KEY);

    const query = new URLSearchParams({
        client_id: AUTH_CONFIG.clientId,
        logout_uri: AUTH_CONFIG.logoutUri
    });
    window.location.assign(`${AUTH_CONFIG.cognitoDomain}/logout?${query}`);
}

window.logout = logout;

document.getElementById("sign-in")?.addEventListener("click", async () => {
    try {
        setStatus("Redirecting to Cognito…");
        await startSignIn();
    } catch (error) {
        setStatus(error.message || "Unable to start sign-in.", true);
    }
});

handleCallback().catch((error) => {
    setStatus(error.message || "Unable to complete sign-in.", true);
});
