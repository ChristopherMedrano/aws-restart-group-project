# Shared Task Notifications: Frontend Guide

**Version:** 1.0

## Project goal

Build a simple app where signed-in users create and assign tasks, see tasks they
created or received, update notification preferences, and check email outcomes.
The task is saved first, so an email problem never loses the task.

## Frontend approach

This is a static JavaScript single-page application (SPA).

- Use one HTML shell: `index.html`.
- Use History API routing.
- Serve private S3 files through CloudFront.
- CloudFront and the local server must return `index.html` for app routes.
- Keep the app framework-free unless the team agrees otherwise.

## Scope

Included: Cognito sign-in/sign-out, profile updates, task creation and
self-assignment, created and assigned task lists, task completion, notification
outcomes/history, and accessible desktop/mobile layouts.

Not included: task editing, deleting, reopening, comments, team workspaces,
custom password forms, or task-detail deep links.

## Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Anyone | Landing page; redirect signed-in users to Assigned Tasks. |
| `/callback` | Anyone | Finish the Cognito sign-in flow. |
| `/tasks/assigned` | Signed in | Show tasks assigned to the current user. |
| `/tasks/created` | Signed in | Show tasks created by the current user. |
| `/tasks/new` | Signed in | Create and assign a task. |
| `/notifications` | Signed in | Show notification history. |
| `/profile` | Signed in | Update profile and notification settings. |

Unknown routes show a friendly Not Found page with a link to Assigned Tasks.

## Shared layout

Signed-out pages show the product name, a short explanation, and **Register or
sign in**. Do not request protected data.

Signed-in pages show navigation for Assigned Tasks, Created Tasks, Create Task,
Notifications, Profile, and Sign out. Mobile navigation may collapse into a menu
but must remain keyboard accessible.

Use one shared loading indicator for loading, refresh, and Load More behavior.
Include a live region for session and network messages.

## Screens and minimum states

| Screen | Must show |
| --- | --- |
| Landing and sign in | Signed out, redirecting, and sign-in/configuration error. |
| OAuth callback | Processing, safe callback error, missing-profile help, and redirect. Never display a code or token. |
| Assigned Tasks | List, empty list, mark complete, completion progress, and error. |
| Created Tasks | List, empty list, notification processing/result, and error. |
| Create Task | Blank form, validation error, submitting, saved, and retry/recovery. |
| Profile | View/edit, saved confirmation, validation/request error, and missing-profile help. |
| Notification History | List, empty history, and error. |
| Missing Profile | Support message with retry or sign-out. |
| Session Expired | Short message and sign-in action. |
| Configuration Error | Deployment-support message; block API/auth actions. |
| Not Found | Unknown-route message and useful link back into the app. |

Every wireframe needs its route, API call, data, main action, focus behavior,
mobile layout, and any open backend question.

## Task lists and creation

Use `GET /tasks?role=assigned` and `GET /tasks?role=created` with a limit and
continuation token. Use **Load more**, not page numbers or infinite scrolling.

Assigned-task cards show title, description, status, creator label, dates,
**Mark complete**, and **View notification outcome**. Use: **No tasks are
currently assigned to you.**

Created-task cards show title, description, assignee label, status, dates, and
**View notification outcome**. Use: **You have not created any tasks yet.**

The create-task form requires a title (1–140 UTF-8 bytes), description
(1–4,000 UTF-8 bytes), and registered assignee. Make **Assign to myself** easy
to find. Use labels, helpful text, and byte counts. Preserve valid text exactly;
do not silently trim or normalize it.

Generate one lowercase UUID v4 after the first valid submission. Keep that same
ID and exact request payload for retries. Show **Task saved** after success.

For an uncertain network result or retryable `503 EVENT_PUBLISH_FAILED`, retry
the same request up to three times, then offer a manual retry with the same ID.
Do not create a new ID automatically.

## Notifications and profile

Use `GET /tasks/{taskId}/notification` when a user asks to view an outcome, and
poll only for a task that was just created.

| Result | User-facing message |
| --- | --- |
| No result yet | Notification processing |
| `sent` | Email sent |
| `skipped` | Email not sent because the assignee disabled email notifications |
| `failed` | Email delivery failed; the task remains assigned |
| `unknown` | Delivery could not be confirmed; do not try a duplicate send |

Use `GET /notifications` for history. Show a Task assignment label, Email,
status, timestamps, and shortened task ID. Do not show task titles in history.

Use `GET /me` and `PATCH /me` for Profile. Let users edit their display name and
notification preference. Keep verified email and account creation date read-only.

## Authentication, errors, and accessibility

Use Cognito authorization code flow with PKCE. Store temporary OAuth state and
the return route in `sessionStorage`. On callback, validate state, exchange the
code, remove callback details from history, check `/me`, and redirect safely.

Send the Cognito access token to protected API calls. Clear protected data,
tokens, and pending retries on sign-out or session expiry.

Show errors in plain language, preserve typed form data, and offer safe retries.
On `401`, show Session Expired. On a missing profile, show Missing Profile. Do
not blank a list just because a refresh failed.

- Target WCAG 2.2 AA.
- Use real labels, buttons, headings, and clear focus order.
- Link validation errors to fields and focus the first invalid field after submit.
- Do not rely on color alone for errors or status.
- Keep layouts usable at 200% zoom and on narrow mobile screens.

Never put tokens, authorization codes, PKCE values, passwords, AWS credentials,
or unnecessary personal data in logs, URLs, source control, or screenshots.

## Deployment basics

Load public, non-secret runtime configuration from `config.js`. If it is missing,
show Configuration Error and do not call API or Cognito endpoints.

Do not cache `index.html` or `config.js` for a long time. Cache versioned assets
longer. Configure CloudFront fallback so client routes receive the SPA shell.

## Week 1 deliverables

- This guide, checked with backend, infrastructure, QA, and project leads.
- A short PKCE decision note.
- A route map and screen/state matrix.
- Desktop and mobile wireframes for the 11 screens in Noor's handoff.
- A short list of API or deployment questions that need team input.
