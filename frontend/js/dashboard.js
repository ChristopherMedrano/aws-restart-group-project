/* =========================================
   Dashboard Data
========================================= */

// Temporary team members for frontend testing.
// Later, this information will come from the backend /assignees API.
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
   Temporary Task Data
========================================= */

// Temporary task for frontend testing.
// Later, tasks will come from the backend:
// GET /tasks?role=assigned
const sampleTasks = [
    {
        id: 1,
        title: "Review AWS Documentation",
        description: "Review the project documentation and make sure the information is up to date.",
        createdById: "sample-user-2",
        assigneeId: "sample-user-1",
        status: "open",
        notificationStatus: "sent",
        createdAt: "2026-09-07"
    }
];

let tasks = JSON.parse(localStorage.getItem("tasks"));

if (!Array.isArray(tasks)) {
    tasks = sampleTasks;
    localStorage.setItem("tasks", JSON.stringify(tasks));
}

/* =========================================
   URL Parameters
========================================= */

const urlParams = new URLSearchParams(window.location.search);
const returnPage = urlParams.get("return");

/* =========================================
   Save Tasks
========================================= */

function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
}

/* =========================================
   Page Elements
========================================= */

const userNameElement = document.getElementById("user-name");
const createTaskButton = document.getElementById("create-task-button");
const navCreateTask = document.getElementById("nav-create-task");
const createTaskModal = document.getElementById("create-task-modal");
const closeModalButton = document.getElementById("close-modal-button");
const cancelTaskButton = document.getElementById("cancel-task-button");
const createTaskForm = document.getElementById("create-task-form");
const taskList = document.getElementById("task-list");

const taskTitleInput = document.getElementById("task-title");
const taskDetailsInput = document.getElementById("task-details");
const assigneeSelect = document.getElementById("assignee");

const titleError = document.getElementById("title-error");
const descriptionError = document.getElementById("description-error");
const assigneeError = document.getElementById("assignee-error");

userNameElement.textContent = currentUser.name;

/* =========================================
   Load Team Members
========================================= */

// Add team members to the Assignee dropdown.
function loadAssignees() {
    assigneeSelect.innerHTML = `
        <option value="">Select a team member</option>
    `;

    teamMembers.forEach(function (member) {
        const option = document.createElement("option");

        option.value = member.id;
        option.textContent = member.name;

        assigneeSelect.appendChild(option);
    });
}

/* =========================================
   Find Team Member
========================================= */

// Get a team member's display name from their ID.
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
   Get Assigned Tasks
========================================= */

// Get tasks where the current user is the assignee.
function getAssignedTasks(filter = "all") {
    let assignedTasks = tasks.filter(function (task) {
        return task.assigneeId === currentUser.id;
    });

    if (filter === "open") {
        assignedTasks = assignedTasks.filter(function (task) {
            return task.status === "open";
        });
    }

    if (filter === "complete") {
        assignedTasks = assignedTasks.filter(function (task) {
            return task.status === "complete";
        });
    }

    return assignedTasks;
}

/* =========================================
   Render Assigned Tasks
========================================= */

function renderTasks(filter = "all") {
    taskList.innerHTML = "";

    const assignedTasks = getAssignedTasks(filter);

    if (assignedTasks.length === 0) {
        const emptyMessage = document.createElement("div");

        emptyMessage.className = "empty-task-message";
        emptyMessage.textContent = "No tasks are currently assigned to you.";

        taskList.appendChild(emptyMessage);
        return;
    }

    assignedTasks.forEach(function (task) {
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

        const description = document.createElement("p");

        description.className = "task-description";
        description.textContent = task.description || task.details || "";

        const creatorDetails = document.createElement("div");

        creatorDetails.className = "task-details";

        const creatorText = document.createElement("span");

        creatorText.textContent = "Assigned by: ";

        const creatorName = document.createElement("strong");

        creatorName.textContent = getTeamMemberName(task.createdById);

        creatorText.appendChild(creatorName);
        creatorDetails.appendChild(creatorText);

        taskMain.appendChild(taskHeader);
        taskMain.appendChild(description);
        taskMain.appendChild(creatorDetails);

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

        if (task.status === "open" && task.assigneeId === currentUser.id) {
            const completeButton = document.createElement("button");

            completeButton.className = "complete-button";
            completeButton.type = "button";
            completeButton.textContent = "Mark Complete";

            completeButton.addEventListener("click", function () {
                completeTask(task.id);
            });

            actions.appendChild(completeButton);
        }

        taskCard.appendChild(taskMain);
        taskCard.appendChild(actions);

        taskList.appendChild(taskCard);
    });
}

/* =========================================
   Open Create Task Modal
========================================= */

function openCreateTaskModal() {
    createTaskModal.classList.remove("hidden");

    taskTitleInput.focus();
}

/* =========================================
   Close Create Task Modal
========================================= */

function closeCreateTaskModal() {
    createTaskModal.classList.add("hidden");

    createTaskForm.reset();

    titleError.textContent = "";
    descriptionError.textContent = "";
    assigneeError.textContent = "";
}

/* =========================================
   Create Task
========================================= */

// Create and save a new task.
function createTask() {
    const title = taskTitleInput.value.trim();
    const description = taskDetailsInput.value.trim();
    const assigneeId = assigneeSelect.value;

    if (title === "") {
        titleError.textContent = "Title is required.";
        return;
    }

    if (description === "") {
        descriptionError.textContent = "Description is required.";
        return;
    }

    if (assigneeId === "") {
        assigneeError.textContent = "Please select an assignee.";
        return;
    }

    const taskId = crypto.randomUUID();

    const newTask = {
        id: taskId,
        title: title,
        description: description,
        createdById: currentUser.id,
        assigneeId: assigneeId,
        status: "open",
        notificationStatus: "processing",
        createdAt: new Date().toISOString()
    };

    tasks.push(newTask);

    saveTasks();

    renderTasks();

    setTimeout(function () {
        closeCreateTaskModal();

        if (returnPage === "created") {
            window.location.href = "created-tasks.html";
        }
    }, 500);
}

/* =========================================
   Complete Task
========================================= */

// Only the person assigned to the task can mark it complete.
// Later:
// PATCH /tasks/{taskId}/status
function completeTask(taskId) {
    const task = tasks.find(function (task) {
        return task.id === taskId;
    });

    if (!task) {
        return;
    }

    if (task.assigneeId !== currentUser.id) {
        return;
    }

    if (task.status !== "open") {
        return;
    }

    task.status = "complete";

    saveTasks();
    renderTasks();
}

/* =========================================
   Task Filters
========================================= */

const filterButtons = document.querySelectorAll(".filter-button");

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
   Create Task Button
========================================= */

// Open the Create Task popup.
createTaskButton.addEventListener("click", function () {
    openCreateTaskModal();
});

/* =========================================
   Navigation Create Task
========================================= */

// The Create Task link in the navbar also opens the popup.
navCreateTask.addEventListener("click", function (event) {
    event.preventDefault();

    openCreateTaskModal();
});

/* =========================================
   Close Modal
========================================= */

closeModalButton.addEventListener("click", function () {
    closeCreateTaskModal();
});

cancelTaskButton.addEventListener("click", function () {
    closeCreateTaskModal();
});

/* =========================================
   Close Modal by Clicking Outside
========================================= */

createTaskModal.addEventListener("click", function (event) {
    if (event.target === createTaskModal) {
        closeCreateTaskModal();
    }
});

/* =========================================
   Create Task Form
========================================= */

createTaskForm.addEventListener("submit", function (event) {
    event.preventDefault();

    createTask();
});

/* =========================================
   Title Validation
========================================= */

taskTitleInput.addEventListener("input", function () {
    titleError.textContent = "";
});

/* =========================================
   Description Validation
========================================= */

taskDetailsInput.addEventListener("input", function () {
    descriptionError.textContent = "";
});

/* =========================================
   Assignee Validation
========================================= */

assigneeSelect.addEventListener("change", function () {
    assigneeError.textContent = "";
});

/* =========================================
   Initial Page Setup
========================================= */

loadAssignees();
renderTasks();

/* =========================================
   Open Create Task From Another Page
========================================= */

if (urlParams.get("create") === "true") {
    openCreateTaskModal();
}