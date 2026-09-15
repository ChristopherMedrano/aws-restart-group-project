/* Task API fetch helpers. Auth header comes from S3NTAuth; URLs from S3NT_CONFIG.
   Keep nextToken opaque — send it back exactly, don't parse it. */

function apiBaseUrl() {
    const base = window.S3NT_CONFIG?.apiBaseUrl;
    if (!base) throw new Error("Runtime configuration is missing or invalid.");
    return base.replace(/\/$/u, ""); // so we can always do `${base}/me`
}

function accessToken() {
    const token = window.S3NTAuth.getSession()?.accessToken;
    if (!token) {
        const error = new Error("Your session has expired. Please sign in again.");
        error.status = 401;
        throw error;
    }
    return token;
}

async function request(method, path, body) {
    const headers = { Authorization: `Bearer ${accessToken()}` };
    const options = { method, headers };
    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
    }
    const response = await fetch(`${apiBaseUrl()}${path}`, options);
    let payload = null;
    const text = await response.text();
    if (text) {
        try {
            payload = JSON.parse(text);
        } catch {
            payload = null; // empty or not JSON; still use status below
        }
    }
    // Stick status on the Error so app.js can tell 401 from a normal failure.
    if (response.status === 401) {
        const error = new Error("Your session has expired. Please sign in again.");
        error.status = 401;
        throw error;
    }
    if (!response.ok) {
        const error = new Error(payload?.message || `The request failed (${response.status}).`);
        error.status = response.status;
        error.payload = payload;
        throw error;
    }
    return payload;
}

function queryPath(path, params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        // Skip empties so we don't send nextToken= on the first page.
        if (value !== undefined && value !== null && value !== "") query.set(key, value);
    });
    const encoded = query.toString();
    return encoded ? `${path}?${encoded}` : path;
}

async function getMe() {
    const payload = await request("GET", "/me");
    if (!payload?.user?.userId) throw new Error("The profile response was invalid.");
    return payload.user; // never send userId; API takes it from the JWT
}

async function updateMe(fields) {
    const payload = await request("PATCH", "/me", fields);
    if (!payload?.user?.userId) throw new Error("The profile response was invalid.");
    return payload.user;
}

async function getAssignees() {
    const payload = await request("GET", "/assignees");
    return Array.isArray(payload?.assignees) ? payload.assignees : [];
}

async function createTask(task) {
    return request("POST", "/tasks", task); // caller includes taskId (uuid v4)
}

// POST /tasks wrote the item but SNS didn't. Caller retries the same body.
function isPublishFailed(error) {
    return error?.status === 503 && error.payload?.code === "EVENT_PUBLISH_FAILED";
}

// role is "assigned" or "created". nextToken is optional (Load more).
async function listTasks(role, nextToken) {
    const payload = await request("GET", queryPath("/tasks", { role, nextToken }));
    return {
        tasks: Array.isArray(payload?.tasks) ? payload.tasks : [],
        nextToken: payload?.nextToken || null
    };
}

async function completeTask(taskId) {
    const payload = await request("PATCH", `/tasks/${encodeURIComponent(taskId)}/status`, {
        status: "complete"
    });
    return payload?.task;
}

async function getTaskNotification(taskId) {
    const payload = await request("GET", `/tasks/${encodeURIComponent(taskId)}/notification`);
    return payload?.notification ?? null; // null until Notification Lambda writes
}

async function listNotifications(nextToken) {
    const payload = await request("GET", queryPath("/notifications", { nextToken }));
    return {
        notifications: Array.isArray(payload?.notifications) ? payload.notifications : [],
        nextToken: payload?.nextToken || null
    };
}

window.S3NTApi = Object.freeze({
    getMe,
    updateMe,
    getAssignees,
    createTask,
    listTasks,
    completeTask,
    getTaskNotification,
    listNotifications,
    isPublishFailed
});
