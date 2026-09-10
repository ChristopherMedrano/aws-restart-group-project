# Shared Task Notifications — Frontend

## Overview

**Shared Task Notifications** is a web-based frontend application that allows users to sign in, create and assign tasks to team members, view assigned and created tasks, manage task status, and configure email notification preferences.

The application is designed to help small teams organize shared tasks and notify team members when tasks are assigned to them.

---

## Features

* User sign-in
* User account creation
* Assigned Tasks dashboard
* View tasks assigned to the current user
* View tasks created by the current user
* Create and assign tasks to team members
* View task status
* Mark assigned tasks as completed
* Filter tasks by All, Open, and Completed
* Edit created tasks
* Delete created tasks
* View notification outcome for created tasks
* Email notification preference settings
* User logout
* Responsive design for desktop and smaller screens

---

## Application Navigation

After signing in, users can navigate through the application using the navigation bar at the top of the page.

### 1. Sign In

**Page:** `index.html`

The Sign In page allows existing users to access the application using their email address and password.

If the user does not have an account, they can select **Create an account** to go to the Sign Up page.

---

### 2. Create Account

**Page:** `signup.html`

New users can create an account by providing:

* Name
* Email address
* Password
* Password confirmation

After creating an account, the user can sign in and access the dashboard.

---

### 3. Assigned Tasks

**Page:** `dashboard.html`

The **Assigned Tasks** page is the main task dashboard for the current user.

Users can:

* View tasks assigned to them
* Review task descriptions
* See who assigned each task
* Check whether a task is **Open** or **Completed**
* Filter tasks using:

  * **All**
  * **Open**
  * **Completed**
* Mark an open assigned task as complete
* Create a new task

Only the user assigned to a task can mark that task as complete.

#### Create a Task

Selecting **+ Create Task** opens a form where users can enter:

* Task title
* Task description
* Assignee

After submitting the form, the task is added to the task list.

---

### 4. Created Tasks

**Page:** `created-tasks.html`

The **Created Tasks** page allows users to view and manage the tasks they created.

Users can:

* View tasks they created
* See who each task is assigned to
* Check whether a task is **Open** or **Completed**
* Filter tasks using:

  * **All**
  * **Open**
  * **Completed**
* Edit a created task
* Delete a created task
* View the notification outcome for a task

#### Notification Outcome

The **View notification outcome** button allows the task creator to see the current notification result for the assigned task.

Possible notification results include:

* **Email sent**
* **Email not sent because the assignee disabled email notifications**
* **Email delivery failed; task remains assigned**
* **Notification processing**
* **Delivery could not be confirmed**

---

### 5. Settings

**Page:** `settings.html`

The **Settings** page allows users to manage their notification preferences.

Currently, users can control their **email notification preference** using the toggle switch.

Users can select **Save Preferences** to save their changes.

---

### 6. Logout

The **Logout** option is available in the navigation bar.

Selecting **Logout** logs the user out of the application and returns them to the Sign In page.

---

## User Navigation Flow

The basic navigation flow is:

```text
Sign In
   │
   ├── Create an Account
   │       │
   │       └── Sign In
   │
   └── Assigned Tasks
           │
           ├── Created Tasks
           │      │
           │      ├── View Created Tasks
           │      ├── Edit Task
           │      ├── Delete Task
           │      └── View Notification Outcome
           │
           ├── Create Task
           │
           ├── View Assigned Tasks
           │
           ├── Filter Tasks
           │
           ├── Mark Assigned Task Complete
           │
           ├── Settings
           │
           └── Logout
                  │
                  └── Sign In
```

---

## Technologies

The frontend is built using:

* **HTML5** — Page structure and content
* **CSS3** — Layout, styling, responsive design, buttons, forms, cards, and navigation
* **JavaScript** — User interactions and application behavior
* **Local Storage** — Temporary frontend storage for users, tasks, and task state during development
* **Git/GitHub** — Version control and team collaboration

---

## Design

The application uses a clean, modern dashboard-style design with:

* Light background
* White content cards
* Blue primary actions
* Simple navigation
* Status badges
* Responsive layouts
* Consistent buttons and form controls
* Clear spacing and typography
* Task filters
* Modal dialogs for task creation and notification outcomes

The design is intended to make task management simple, clear, and easy to navigate.

---

## Current Frontend Implementation

The current frontend uses temporary data and browser local storage for development and testing.

Team member information and task data are currently handled on the frontend. Backend integration will replace these temporary values with application APIs and AWS services.

The notification outcome is also currently represented using frontend task data and will later be connected to the backend notification workflow.

---

## Future Improvements

Potential future improvements include:

* Additional notification methods such as Slack or SMS
* Task due dates
* Calendar integration
* Advanced task search and filtering

These features are outside the current capstone scope.

---

## Project Structure

```text
frontend/
│
├── index.html
├── signup.html
├── dashboard.html
├── created-tasks.html
├── settings.html
│
├── css/
│   └── style.css
│
├── js/
│   ├── auth.js
│   ├── dashboard.js
│   ├── created-tasks.js
│   └── settings.js
│
└── README.md
```


