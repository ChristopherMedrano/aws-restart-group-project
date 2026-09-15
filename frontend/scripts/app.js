// SPA shell: scripts load once. Nav only swaps #app-content.
let currentUser = null;
let renderSeq = 0; // bump this when the user navigates so a late fetch is ignored
let nameById = {}; // userId -> displayName from GET /assignees (tasks only store ids)
let pendingCreate = null; // same payload + taskId if they retry create
let listItems = [];
let listNextToken = null;

const ROUTES = Object.freeze({
    "/tasks/assigned": { title: "Assigned Tasks", empty: "No tasks are currently assigned to you." },
    "/tasks/created": { title: "Created Tasks", empty: "You have not created any tasks yet." },
    "/tasks/new": { title: "Create Task" },
    "/notifications": { title: "Notifications", empty: "No notification history yet." },
    "/profile": { title: "Profile" }
});

const OUTCOME_TEXT = Object.freeze({
    sent: "Email sent",
    skipped: "Email not sent because the assignee disabled email notifications",
    failed: "Email delivery failed; the task remains assigned",
    unknown: "Delivery could not be confirmed"
});

const PUBLISH_AUTO_RETRIES = 3; // extra POSTs after a 503 EVENT_PUBLISH_FAILED
const POLL_MS = 2000;
const POLL_FOR_MS = 30000;

let createPollTimer = null;

function hasRuntimeConfig() {
    const config = window.S3NT_CONFIG || {};
    return Boolean(
        config.cognitoDomain
        && config.clientId
        && config.apiBaseUrl
        && config.redirectUri
        && config.logoutUri
        && config.scope
    );
}

function setAuthStatus(message, isError = false) {
    const status = document.getElementById("auth-status");
    status.textContent = message;
    status.classList.toggle("error", isError);
}

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value || "";
    return element.innerHTML;
}

// Backend limits are UTF-8 bytes, not JS string.length (emoji etc.).
function utf8Bytes(value) {
    return new TextEncoder().encode(value).length;
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopCreatePoll() {
    if (createPollTimer) {
        clearTimeout(createPollTimer);
        createPollTimer = null;
    }
}

function outcomeLabel(notification) {
    const status = notification?.status;
    if (status && OUTCOME_TEXT[status]) return OUTCOME_TEXT[status];
    return "Notification processing";
}

function validText(value, minBytes, maxBytes) {
    if (typeof value !== "string" || value.includes("\r") || value.trim() === "") return false;
    const size = utf8Bytes(value);
    return size >= minBytes && size <= maxBytes;
}

function displayName(userId) {
    return nameById[userId] || userId;
}

function handleSessionError(error) {
    if (error?.status !== 401) return false;
    window.S3NTAuth.expireSession();
    currentUser = null;
    setAuthStatus(error.message, true);
    render();
    return true;
}

function navigate(path, replace = false) {
    const safePath = ROUTES[path] ? path : "/tasks/assigned"; // unknown URL -> assigned
    window.history[replace ? "replaceState" : "pushState"]({}, "", safePath);
    render();
}

function pageShell(title, intro, body) {
    const name = escapeHtml(currentUser.displayName || "there");
    return `
        <section class="dashboard-header"><div><h1>${escapeHtml(title)}</h1><p>Welcome back, ${name}.</p><p>${escapeHtml(intro)}</p></div></section>
        ${body}`;
}

function renderLoading(title) {
    return pageShell(title, "Loading…", `<section class="tasks-section"><div class="empty-task-message"><p>Loading.</p></div></section>`);
}

function renderError(title, message) {
    return pageShell(
        title,
        "Something went wrong.",
        `<section class="tasks-section"><div class="empty-task-message"><p>${escapeHtml(message)}</p><p><button type="button" class="primary-button" id="retry-load">Try again</button></p></div></section>`
    );
}

function renderTaskCard(task, role) {
    const otherId = role === "assigned" ? task.creatorId : task.assigneeId;
    const otherLabel = role === "assigned" ? "From" : "Assigned to";
    const completeButton = role === "assigned" && task.status === "open"
        ? `<button type="button" class="primary-button" data-complete="${escapeHtml(task.taskId)}">Mark complete</button>`
        : ""; // only the assignee can complete; API would 403 otherwise
    return `
        <article class="task-card" data-task-id="${escapeHtml(task.taskId)}">
          <div class="task-card-main">
            <div class="task-card-header"><h3>${escapeHtml(task.title)}</h3></div>
            <p class="task-description">${escapeHtml(task.description)}</p>
            <p class="task-details"><strong>Status:</strong> ${escapeHtml(task.status)}</p>
            <p class="task-details"><strong>${otherLabel}:</strong> ${escapeHtml(displayName(otherId))}</p>
            <p class="task-details"><strong>Created:</strong> ${escapeHtml(task.createdAt || "")}</p>
            ${task.completedAt ? `<p class="task-details"><strong>Completed:</strong> ${escapeHtml(task.completedAt)}</p>` : ""}
            <p class="task-details" data-outcome hidden></p>
          </div>
          <div class="task-card-actions">
            ${completeButton}
            <button type="button" class="nav-link" data-outcome-task="${escapeHtml(task.taskId)}">View notification outcome</button>
          </div>
        </article>`;
}

function renderTaskList(route, tasks, nextToken) {
    const page = ROUTES[route];
    const role = route === "/tasks/assigned" ? "assigned" : "created";
    const cards = tasks.length
        ? tasks.map((task) => renderTaskCard(task, role)).join("")
        : `<div class="empty-task-message"><p>${escapeHtml(page.empty)}</p></div>`;
    const more = nextToken
        ? `<p><button type="button" class="primary-button" id="load-more">Load more</button></p>`
        : "";
    return pageShell(page.title, "Tasks from the Task API.", `<section class="tasks-section">${cards}${more}</section>`);
}

function renderCreateForm(assignees, message) {
    const options = assignees.map((person) => {
        const label = person.userId === currentUser.userId
            ? `${person.displayName} (you)`
            : person.displayName;
        return `<option value="${escapeHtml(person.userId)}">${escapeHtml(label)}</option>`;
    }).join("");
    const status = message ? `<p class="settings-message" id="create-status">${escapeHtml(message)}</p>` : `<p class="settings-message" id="create-status"></p>`;
    return pageShell(
        "Create Task",
        "Assign a task to a registered person. The task is saved even if email is not sent yet.",
        `<section class="settings-card">
          <form id="create-task-form">
            <div class="form-group"><label for="task-title">Title</label><input id="task-title" name="title" maxlength="140" required></div>
            <div class="form-group">
              <label for="task-description">Description</label>
              <textarea id="task-description" name="description" required></textarea>
              <p>Description is required.</p>
              <p id="description-count">0 / 4,000 characters</p>
            </div>
            <div class="form-group">
              <label for="task-assignee">Assignee</label>
              <select id="task-assignee" name="assigneeId" required>${options}</select>
            </div>
            <div class="settings-actions">
              <button type="button" class="nav-link" id="assign-self">Assign to myself</button>
              <button type="submit" class="primary-button">Create task</button>
            </div>
            ${status}
            <p class="settings-message" id="create-outcome" hidden></p>
            <div class="settings-actions">
              <button type="button" class="primary-button" id="create-retry-publish" hidden>Retry notification</button>
              <button type="button" class="nav-link" id="create-refresh-outcome" hidden>Refresh notification</button>
            </div>
          </form>
        </section>`
    );
}

function renderNotifications(items, nextToken) {
    // Spec: generic "Task assignment" + short id. Don't put the task title here.
    const cards = items.length
        ? items.map((item) => `
            <article class="task-card">
              <div class="task-card-main">
                <h3>Task assignment</h3>
                <p class="task-details"><strong>Email:</strong> ${escapeHtml(OUTCOME_TEXT[item.status] || "Notification processing")}</p>
                <p class="task-details"><strong>Date:</strong> ${escapeHtml(item.createdAt || item.sentAt || "")}</p>
                <p class="task-details"><strong>Task:</strong> ${escapeHtml((item.taskId || "").slice(0, 8))}</p>
              </div>
            </article>`).join("")
        : `<div class="empty-task-message"><p>${escapeHtml(ROUTES["/notifications"].empty)}</p></div>`;
    const more = nextToken
        ? `<p><button type="button" class="primary-button" id="load-more">Load more</button></p>`
        : "";
    return pageShell("Notifications", "Notification history from the Task API.", `<section class="tasks-section">${cards}${more}</section>`);
}

function renderProfile() {
    const name = escapeHtml(currentUser.displayName || "");
    const enabled = currentUser.emailNotificationsEnabled ? "checked" : "";
    // Email is from Cognito; we display it but PATCH /me can't change it.
    return `
        <section class="settings-container">
          <header class="settings-header"><h1>Profile</h1><p>Your S3NT application profile.</p></header>
          <section class="settings-card">
            <form id="profile-form">
              <div class="form-group"><label for="display-name">Display name</label><input id="display-name" name="displayName" value="${name}" required></div>
              <div class="form-group">
                <label><input type="checkbox" id="email-pref" ${enabled}> Email notifications</label>
              </div>
              <p>Email: ${escapeHtml(currentUser.email || "")}</p>
              <div class="settings-actions"><button type="submit" class="primary-button">Save</button></div>
              <p class="settings-message" id="profile-status"></p>
            </form>
          </section>
        </section>`;
}

function bindRetry(route) {
    document.getElementById("retry-load")?.addEventListener("click", () => loadRoute(route));
}

// innerHTML wipes listeners, so call this again after every list render.
function bindTaskActions(route) {
    document.querySelectorAll("[data-complete]").forEach((button) => {
        button.addEventListener("click", async () => {
            button.disabled = true;
            try {
                const updated = await window.S3NTApi.completeTask(button.getAttribute("data-complete"));
                const index = listItems.findIndex((task) => task.taskId === updated.taskId);
                if (index >= 0) listItems[index] = updated;
                const content = document.getElementById("app-content");
                content.innerHTML = renderTaskList(route, listItems, listNextToken);
                bindTaskActions(route);
            } catch (error) {
                if (handleSessionError(error)) return;
                button.disabled = false;
                button.textContent = error.message || "Unable to complete task";
            }
        });
    });
    document.querySelectorAll("[data-outcome-task]").forEach((button) => {
        button.addEventListener("click", async () => {
            const card = button.closest("[data-task-id]");
            const outcome = card.querySelector("[data-outcome]");
            outcome.hidden = false;
            outcome.textContent = "Notification processing";
            try {
                const notification = await window.S3NTApi.getTaskNotification(button.getAttribute("data-outcome-task"));
                const status = notification?.status;
                outcome.textContent = status ? (OUTCOME_TEXT[status] || "Notification processing") : "Notification processing";
            } catch (error) {
                if (handleSessionError(error)) return;
                outcome.textContent = error.message || "Unable to load notification";
            }
        });
    });
    document.getElementById("load-more")?.addEventListener("click", () => loadRoute(route, true));
}

function bindCreateForm(assignees) {
    const form = document.getElementById("create-task-form");
    const description = document.getElementById("task-description");
    const count = document.getElementById("description-count");
    const status = document.getElementById("create-status");
    const outcome = document.getElementById("create-outcome");
    const retryPublish = document.getElementById("create-retry-publish");
    const refreshOutcome = document.getElementById("create-refresh-outcome");
    const updateCount = () => {
        // Label says "characters" in the spec; we still count UTF-8 bytes.
        count.textContent = `${utf8Bytes(description.value).toLocaleString()} / 4,000 characters`;
    };
    description.addEventListener("input", updateCount);
    updateCount();
    document.getElementById("assign-self").addEventListener("click", () => {
        document.getElementById("task-assignee").value = currentUser.userId;
    });

    async function pollOutcome(taskId, deadline, seq) {
        if (seq !== renderSeq || !document.getElementById("create-outcome")) return;
        try {
            const notification = await window.S3NTApi.getTaskNotification(taskId);
            if (seq !== renderSeq) return;
            outcome.hidden = false;
            outcome.textContent = outcomeLabel(notification);
            if (notification?.status && OUTCOME_TEXT[notification.status]) {
                refreshOutcome.hidden = true;
                return;
            }
        } catch (error) {
            if (handleSessionError(error)) return;
            if (seq !== renderSeq) return;
            // Keep "Notification processing" until sent/skipped/failed/unknown.
            outcome.hidden = false;
            outcome.textContent = "Notification processing";
        }
        if (Date.now() >= deadline) {
            refreshOutcome.hidden = false;
            return;
        }
        createPollTimer = setTimeout(() => pollOutcome(taskId, deadline, seq), POLL_MS);
    }

    function startOutcomePoll(taskId) {
        stopCreatePoll();
        refreshOutcome.dataset.taskId = taskId;
        outcome.hidden = false;
        outcome.textContent = "Notification processing";
        refreshOutcome.hidden = true;
        pollOutcome(taskId, Date.now() + POLL_FOR_MS, renderSeq);
    }

    // Same body every time. 503 EVENT_PUBLISH_FAILED: 3 extra POSTs, then the button.
    async function postImmutableTask() {
        let lastError;
        const tries = 1 + PUBLISH_AUTO_RETRIES;
        for (let i = 0; i < tries; i += 1) {
            try {
                return await window.S3NTApi.createTask(pendingCreate);
            } catch (error) {
                lastError = error;
                if (!window.S3NTApi.isPublishFailed(error) || i === tries - 1) throw error;
                status.textContent = "Task saved. Retrying email notification…";
                await wait(1000);
            }
        }
        throw lastError;
    }

    async function submitCreate() {
        retryPublish.hidden = true;
        refreshOutcome.hidden = true;
        outcome.hidden = true;
        const submit = form.querySelector("button[type=submit]");
        submit.disabled = true;
        retryPublish.disabled = true;
        try {
            const created = await postImmutableTask();
            status.textContent = "Task saved. Email status may appear a little later.";
            const taskId = created?.task?.taskId || pendingCreate.taskId;
            pendingCreate = null;
            form.reset();
            document.getElementById("task-assignee").value = currentUser.userId;
            updateCount();
            startOutcomePoll(taskId);
        } catch (error) {
            if (handleSessionError(error)) return;
            if (error.status === 409) {
                status.textContent = "That task ID already exists with different data.";
            } else if (window.S3NTApi.isPublishFailed(error)) {
                status.textContent = "Task saved, but the email notification did not start. Retry uses the same task.";
                retryPublish.hidden = false;
            } else {
                status.textContent = error.message || "Unable to create task.";
            }
        } finally {
            submit.disabled = false;
            retryPublish.disabled = false;
        }
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const title = form.title.value;
        const text = form.description.value;
        const assigneeId = form.assigneeId.value;
        if (!validText(title, 1, 140) || !validText(text, 1, 4000) || !assigneeId) {
            status.textContent = "Enter a title, description, and assignee. Do not use only spaces or carriage returns.";
            return;
        }
        // Reuse the uuid if they're retrying the exact same form. New text = new task.
        const same = pendingCreate
            && pendingCreate.title === title
            && pendingCreate.description === text
            && pendingCreate.assigneeId === assigneeId;
        if (!same) pendingCreate = { taskId: crypto.randomUUID(), title, description: text, assigneeId };
        await submitCreate();
    });
    retryPublish.addEventListener("click", async () => {
        if (!pendingCreate) return;
        await submitCreate();
    });
    refreshOutcome.addEventListener("click", () => {
        const taskId = refreshOutcome.dataset.taskId;
        if (!taskId) return;
        startOutcomePoll(taskId);
    });
}

function bindProfileForm() {
    document.getElementById("profile-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const status = document.getElementById("profile-status");
        const displayNameValue = document.getElementById("display-name").value;
        if (!validText(displayNameValue, 1, 140)) {
            status.textContent = "Enter a display name that is not blank.";
            return;
        }
        try {
            currentUser = await window.S3NTApi.updateMe({
                displayName: displayNameValue,
                emailNotificationsEnabled: document.getElementById("email-pref").checked
            });
            status.textContent = "Saved.";
        } catch (error) {
            if (handleSessionError(error)) return;
            status.textContent = error.message || "Unable to save profile.";
        }
    });
}

async function refreshNames() {
    const assignees = await window.S3NTApi.getAssignees();
    nameById = Object.fromEntries(assignees.map((person) => [person.userId, person.displayName]));
    return assignees;
}

async function loadRoute(route, append = false) {
    const seq = ++renderSeq;
    stopCreatePoll();
    // append=true is Load more; keep what we already have.
    const content = document.getElementById("app-content");
    if (!append) {
        listItems = [];
        listNextToken = null;
        content.innerHTML = renderLoading(ROUTES[route].title);
    }
    try {
        if (route === "/profile") {
            content.innerHTML = renderProfile();
            bindProfileForm();
            return;
        }
        if (route === "/tasks/new") {
            const assignees = await refreshNames();
            if (seq !== renderSeq) return; // clicked away while this was in flight
            content.innerHTML = renderCreateForm(assignees);
            bindCreateForm(assignees);
            document.getElementById("task-assignee").value = currentUser.userId;
            return;
        }
        if (route === "/notifications") {
            const page = await window.S3NTApi.listNotifications(append ? listNextToken : null);
            if (seq !== renderSeq) return;
            listItems = append ? listItems.concat(page.notifications) : page.notifications;
            listNextToken = page.nextToken;
            content.innerHTML = renderNotifications(listItems, listNextToken);
            document.getElementById("load-more")?.addEventListener("click", () => loadRoute(route, true));
            return;
        }
        await refreshNames();
        const role = route === "/tasks/created" ? "created" : "assigned";
        const page = await window.S3NTApi.listTasks(role, append ? listNextToken : null);
        if (seq !== renderSeq) return;
        listItems = append ? listItems.concat(page.tasks) : page.tasks;
        listNextToken = page.nextToken;
        content.innerHTML = renderTaskList(route, listItems, listNextToken);
        bindTaskActions(route);
    } catch (error) {
        if (seq !== renderSeq) return;
        if (handleSessionError(error)) return;
        content.innerHTML = renderError(ROUTES[route].title, error.message || "Unable to load this page.");
        bindRetry(route);
    }
}

function render() {
    const authView = document.getElementById("auth-view");
    const appView = document.getElementById("app-view");
    if (!hasRuntimeConfig()) {
        authView.hidden = false;
        appView.hidden = true;
        document.getElementById("sign-in").disabled = true;
        setAuthStatus("Runtime configuration is missing. Copy config.example.js to config.local.js.", true);
        return;
    }
    if (!currentUser) {
        authView.hidden = false;
        appView.hidden = true;
        return;
    }
    const route = ROUTES[window.location.pathname] ? window.location.pathname : "/tasks/assigned";
    authView.hidden = true;
    appView.hidden = false;
    document.querySelectorAll("[data-route]").forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === route);
    });
    loadRoute(route);
}

async function boot() {
    // Don't let the browser do a full page load for in-app links.
    document.addEventListener("click", (event) => {
        const link = event.target.closest("a[data-route]");
        if (link) {
            event.preventDefault();
            navigate(link.getAttribute("href"));
        }
    });
    document.getElementById("sign-in").addEventListener("click", async () => {
        try {
            setAuthStatus("Redirecting to Cognito…");
            await window.S3NTAuth.startSignIn();
        } catch (error) {
            setAuthStatus(error.message || "Unable to start sign-in.", true);
        }
    });
    document.getElementById("sign-out").addEventListener("click", () => window.S3NTAuth.logout());
    window.addEventListener("popstate", render); // back/forward

    try {
        currentUser = await window.S3NTAuth.handleCallback();
        if (!currentUser && window.S3NTAuth.getSession()) currentUser = await window.S3NTAuth.loadProfile();
        if (currentUser) navigate("/tasks/assigned", true); // replace so Back skips /callback
        else render();
    } catch (error) {
        if (error.status === 404) {
            setAuthStatus("No application profile was found for this signed-in user.", true);
        } else {
            setAuthStatus(error.message || "Unable to complete sign-in.", true);
        }
        render();
    }
}

boot();
