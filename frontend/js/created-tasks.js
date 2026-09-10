/* =========================================
   Created Tasks Data
========================================= */

// Temporary team members for frontend testing.
// Later, this information will come from the backend.
const teamMembers = [
    {
        id: "sample-user-1",
        name: "Team Member 1"
    },
    {
        id: "sample-user-2",
        name: "Team Member 2"
    },
    {
        id: "sample-user-3",
        name: "Team Member 3"
    }
];

/* =========================================
   Current User
========================================= */

// Temporary user information.
// Later, this will come from Amazon Cognito.
const currentUser = JSON.parse(localStorage.getItem("currentUser")) || {
    id: "sample-user-1",
    name: "Team Member 1",
    email: "user@example.com"
};

/* =========================================
   Task Data
========================================= */

let tasks = JSON.parse(localStorage.getItem("tasks")) || [];

/* =========================================
   Page Elements
========================================= */

const userNameElement = document.getElementById("user-name");
const taskList = document.getElementById("task-list");
const createTaskButton = document.getElementById("create-task-button");
const filterButtons = document.querySelectorAll(".filter-button");

userNameElement.textContent = currentUser.name;

/* =========================================
   Save Tasks
========================================= */

function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
}

/* =========================================
   Find Team Member
========================================= */

function getTeamMemberName(memberId) {
    const member = teamMembers.find(function (member) {
        return member.id === memberId;
    });

    if (member) {
        return member.name;
    }

    return "Unknown team member";
}

/* =========================================
   Notification Message
========================================= */

// Temporary notification messages.
// Later, this information will come from:
// GET /tasks/{taskId}/notification
function getNotificationMessage(status) {
    if (status === "sent") {
        return "Email sent";
    }

    if (status === "skipped") {
        return "Email not sent because the assignee disabled email notifications";
    }

    if (status === "failed") {
        return "Email delivery failed; task remains assigned";
    }

    if (status === "processing") {
        return "Notification processing";
    }

    return "Delivery could not be confirmed";
}

/* =========================================
   Notification Outcome Modal
========================================= */

const notificationModal = document.getElementById("notification-modal");
const notificationStatus = document.getElementById("notification-status");
const closeNotificationModalButton = document.getElementById("close-notification-modal");
const closeNotificationButton = document.getElementById("close-notification-button");

/* =========================================
   Open Notification Modal
========================================= */

function openNotificationModal(status) {
    notificationStatus.textContent = getNotificationMessage(status);

    notificationModal.classList.remove("hidden");
}

/* =========================================
   Close Notification Modal
========================================= */

function closeNotificationModal() {
    notificationModal.classList.add("hidden");
}

closeNotificationModalButton.addEventListener(
    "click",
    closeNotificationModal
);

closeNotificationButton.addEventListener(
    "click",
    closeNotificationModal
);

/* =========================================
   Close Notification Modal by Clicking Outside
========================================= */

notificationModal.addEventListener("click", function (event) {
    if (event.target === notificationModal) {
        closeNotificationModal();
    }
});

/* =========================================
   Get Created Tasks
========================================= */

// Get tasks created by the current user.
function getCreatedTasks(filter = "all") {
    let createdTasks = tasks.filter(function (task) {
        return task.createdById === currentUser.id;
    });

    if (filter === "open") {
        createdTasks = createdTasks.filter(function (task) {
            return task.status === "open";
        });
    }

    if (filter === "complete") {
        createdTasks = createdTasks.filter(function (task) {
            return task.status === "complete";
        });
    }

    return createdTasks;
}

/* =========================================
   Render Created Tasks
========================================= */

function renderTasks(filter = "all") {
    taskList.innerHTML = "";

    const createdTasks = getCreatedTasks(filter);

    if (createdTasks.length === 0) {
        const emptyMessage = document.createElement("div");

        emptyMessage.className = "empty-task-message";
        emptyMessage.textContent = "You have not created any tasks yet.";

        taskList.appendChild(emptyMessage);
        return;
    }

    createdTasks.forEach(function (task) {
        const taskCard = document.createElement("article");

        taskCard.className = "task-card";
        taskCard.dataset.status = task.status;

        const taskMain = document.createElement("div");

        taskMain.className = "task-card-main";

        const taskHeader = document.createElement("div");

        taskHeader.className = "task-card-header";

        const title = document.createElement("h3");

        title.textContent = task.title;

        taskHeader.appendChild(title);

        const taskMenu = document.createElement("div");

        taskMenu.className = "task-menu";

        const menuButton = document.createElement("button");

        menuButton.className = "task-menu-button";
        menuButton.type = "button";
        menuButton.textContent = "⋮";

        const menu = document.createElement("div");

        menu.className = "task-menu-dropdown hidden";

        const editButton = document.createElement("button");

        editButton.type = "button";
        editButton.textContent = "Edit";

        const deleteButton = document.createElement("button");

        deleteButton.type = "button";
        deleteButton.textContent = "Delete";

        menu.appendChild(editButton);
        menu.appendChild(deleteButton);

        taskMenu.appendChild(menuButton);
        taskMenu.appendChild(menu);

        taskHeader.appendChild(taskMenu);

        const description = document.createElement("p");

        description.className = "task-description";
        description.textContent = task.description || task.details || "";

        const taskDetails = document.createElement("div");

        taskDetails.className = "task-details";

        const assigneeText = document.createElement("span");

        assigneeText.textContent = "Assigned to: ";

        const assigneeName = document.createElement("strong");

        assigneeName.textContent = getTeamMemberName(task.assigneeId);

        assigneeText.appendChild(assigneeName);

        taskDetails.appendChild(assigneeText);

        taskMain.appendChild(taskHeader);
        taskMain.appendChild(description);
        taskMain.appendChild(taskDetails);

        const actions = document.createElement("div");

        actions.className = "task-card-actions";

        const statusBadge = document.createElement("span");

        statusBadge.className = "status-badge";

        if (task.status === "open") {
            statusBadge.classList.add("open");
            statusBadge.textContent = "Open";
        } else {
            statusBadge.classList.add("complete");
            statusBadge.textContent = "Completed";
        }

        actions.appendChild(statusBadge);

        const notificationButton = document.createElement("button");

        notificationButton.className = "secondary-button";
        notificationButton.type = "button";
        notificationButton.textContent = "View notification outcome";

        notificationButton.addEventListener("click", function () {
            openNotificationModal(task.notificationStatus);
        });

        actions.appendChild(notificationButton);

        taskCard.appendChild(taskMain);
        taskCard.appendChild(actions);

        taskList.appendChild(taskCard);

        /* =========================================
           Task Menu
        ========================================= */

        menuButton.addEventListener("click", function (event) {
            event.stopPropagation();

            document
                .querySelectorAll(".task-menu-dropdown")
                .forEach(function (dropdown) {
                    dropdown.classList.add("hidden");
                });

            menu.classList.toggle("hidden");
        });

        /* =========================================
           Edit Task
        ========================================= */

        editButton.addEventListener("click", function () {
            editTask(task.id);
        });

        /* =========================================
           Delete Task
        ========================================= */

        deleteButton.addEventListener("click", function () {
            deleteTask(task.id);
        });
    });
}

/* =========================================
   Edit Task
========================================= */

function editTask(taskId) {
    const task = tasks.find(function (task) {
        return task.id === taskId;
    });

    if (!task) {
        return;
    }

    if (task.createdById !== currentUser.id) {
        return;
    }

    const newTitle = prompt("Edit task title:", task.title);

    if (newTitle === null) {
        return;
    }

    const newDescription = prompt(
        "Edit task description:",
        task.description || task.details || ""
    );

    if (newDescription === null) {
        return;
    }

    if (newTitle.trim() === "") {
        alert("Title is required.");
        return;
    }

    if (newDescription.trim() === "") {
        alert("Description is required.");
        return;
    }

    task.title = newTitle.trim();
    task.description = newDescription.trim();

    saveTasks();
    renderTasks();
}

/* =========================================
   Delete Task
========================================= */

function deleteTask(taskId) {
    const task = tasks.find(function (task) {
        return task.id === taskId;
    });

    if (!task) {
        return;
    }

    if (task.createdById !== currentUser.id) {
        return;
    }

    const confirmed = confirm(
        "Are you sure you want to delete this task?"
    );

    if (!confirmed) {
        return;
    }

    tasks = tasks.filter(function (task) {
        return task.id !== taskId;
    });

    saveTasks();
    renderTasks();
}

/* =========================================
   Close Task Menus
========================================= */

document.addEventListener("click", function () {
    document
        .querySelectorAll(".task-menu-dropdown")
        .forEach(function (dropdown) {
            dropdown.classList.add("hidden");
        });
});

/* =========================================
   Create Task Button
========================================= */

// The Create Task popup is on dashboard.html.
// Open the dashboard and tell it to open the popup.
createTaskButton.addEventListener("click", function () {
    window.location.href = "dashboard.html?create=true&return=created";
});

/* =========================================
   Task Filters
========================================= */

filterButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        filterButtons.forEach(function (button) {
            button.classList.remove("active");
        });

        button.classList.add("active");

        renderTasks(button.dataset.filter);
    });
});

/* =========================================
   Initial Page Setup
========================================= */

renderTasks();