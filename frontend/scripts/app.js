let currentUser = null;

const ROUTES = Object.freeze({
    "/tasks/assigned": { title: "Assigned Tasks", description: "Tasks assigned to you will appear here once the task API is connected." },
    "/tasks/created": { title: "Created Tasks", description: "Tasks you create will appear here once the task API is connected." },
    "/tasks/new": { title: "Create Task", description: "Task creation will be enabled when POST /tasks is available." },
    "/notifications": { title: "Notifications", description: "Notification history will be enabled when GET /notifications is available." }
});

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

function navigate(path, replace = false) {
    const safePath = (ROUTES[path] || path === "/profile") ? path : "/tasks/assigned";
    window.history[replace ? "replaceState" : "pushState"]({}, "", safePath);
    render();
}

function renderProfile() {
    const name = escapeHtml(currentUser.displayName || "Signed-in user");
    const userId = escapeHtml(currentUser.userId);
    return `
        <section class="settings-container">
          <header class="settings-header"><h1>Profile</h1><p>Your S3NT application profile.</p></header>
          <section class="settings-card">
            <div class="settings-card-header"><div><h2>${name}</h2><p>User ID: ${userId}</p></div></div>
            <p class="settings-message">Profile editing will be enabled when PATCH /me is available.</p>
          </section>
        </section>`;
}

function renderPlaceholder(route) {
    const page = ROUTES[route];
    const name = escapeHtml(currentUser.displayName || "there");
    return `
        <section class="dashboard-header"><div><h1>${page.title}</h1><p>Welcome back, ${name}.</p><p>${page.description}</p></div></section>
        <section class="tasks-section"><div class="empty-task-message"><p>This screen is ready for its protected API integration.</p></div></section>`;
}

function render() {
    const authView = document.getElementById("auth-view");
    const appView = document.getElementById("app-view");
    const content = document.getElementById("app-content");
    if (!currentUser) {
        authView.hidden = false;
        appView.hidden = true;
        return;
    }
    const route = window.location.pathname;
    authView.hidden = true;
    appView.hidden = false;
    content.innerHTML = route === "/profile" ? renderProfile() : renderPlaceholder(ROUTES[route] ? route : "/tasks/assigned");
    document.querySelectorAll("[data-route]").forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === route);
    });
    content.focus();
}

async function boot() {
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
    window.addEventListener("popstate", render);

    try {
        currentUser = await window.S3NTAuth.handleCallback();
        if (!currentUser && window.S3NTAuth.getSession()) currentUser = await window.S3NTAuth.loadProfile();
        if (currentUser) navigate("/tasks/assigned", true);
        else render();
    } catch (error) {
        setAuthStatus(error.message || "Unable to complete sign-in.", true);
        render();
    }
}

boot();
