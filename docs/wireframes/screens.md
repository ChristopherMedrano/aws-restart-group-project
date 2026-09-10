# S3NT Screen Wireframes

This document contains the reference layouts for the S3NT application screens.
It covers the eight SPA routes and three in-app recovery views required by the
frontend specification. Cognito-hosted registration, verification, recovery,
and credential-entry pages are intentionally excluded.

## Shared authenticated application shell

Every protected route uses the same shell. The top navigation contains
**Assigned Tasks**, **Created Tasks**, **Create Task**, **Notifications**,
**Profile**, and **Sign out**. **Sign out** returns the user to the external
Cognito sign-out flow; it is not an application API request. On small screens,
the navigation remains keyboard accessible and wraps or collapses without
hiding a destination.

Use a skip link to the main content, a visible keyboard focus indicator, and a
live region for loading, success, and error messages. After a successful action,
focus the success message or the changed item; after an error, focus the error
message or the first invalid field. Keep visible list content on screen if a
refresh fails.

## Screen annotation coverage

The screen-specific sections below provide the layouts and mobile behavior. This
table records the route/trigger, data dependency, and primary recovery behavior
required for every annotated wireframe.

| Screen | Route or trigger | API/data dependency | Primary action and focus behavior |
| --- | --- | --- | --- |
| Landing and Sign In | `/` | Runtime configuration and session state | Start sign-in; move focus to the redirecting or error status. Signed-in users redirect to Assigned Tasks. |
| Assigned Tasks | `/tasks/assigned` | `GET /tasks?role=assigned` | Complete an open task with `PATCH /tasks/{taskId}/status`; focus the updated task status. |
| Created Tasks | `/tasks/created` | `GET /tasks?role=created`; `GET /tasks/{taskId}/notification` | Open notification outcome; focus its status panel. |
| Create Task | `/tasks/new` | `GET /assignees`; `POST /tasks` | Submit or retry the same task ID and payload; focus saved, retry, or field-error status. |
| Notification History | `/notifications` | `GET /notifications` | Load another page or retry; focus the new items or error status. |
| Profile | `/profile` | `GET /me`; `PATCH /me` | Save profile changes; focus the saved or error status. |
| Sign-In Callback | `/callback` | Cognito callback values, handled without display | Finish sign-in; focus the safe error and Sign in again action if it fails. |
| Missing Profile | Valid sign-in but no application profile | `GET /me` retry | Retry profile lookup; focus the result or error status. |
| Session Expired | A protected request returns `401` | No application data | Start sign-in again; focus the redirecting or error status. |
| Configuration Error | Required runtime configuration is invalid | Runtime configuration only | No API/auth action is available; focus the support message. |
| Not Found | Unknown client route | No API request | Return to Assigned Tasks; focus that page heading after navigation. |

Secondary actions are shown in each layout where applicable, including **Load
more**, **View notification outcome**, **Assign to myself**, **Try again**, and
**Sign out**. No screen assumes an unpublished backend field or route; any
future dependency must be added to the frontend contract before it is added to a
wireframe.

## Landing and Sign In

Route: `/`. This is an SPA page.

```text
+----------------------------------------------------+
| S3NT                                               |
| Assign work clearly. Keep the team informed.       |
|                                                    |
|              [ Register or sign in ]               |
+----------------------------------------------------+
```

Use the same centered content and a full-width button on mobile. The button
opens the externally hosted registration/sign-in flow; do not add username,
password, registration, verification, or recovery fields to this page. Show a
redirecting state and a safe configuration or sign-in-start error.

## Assigned Tasks

Route: `/tasks/assigned`. Load `GET /tasks?role=assigned`; complete with
`PATCH /tasks/{taskId}/status`.

```text
+----------------------------------------------------+
| Assigned Tasks                         [Profile]   |
| [Task title]  Open • Created: Sep 9                |
| Description • Created by: teammate                 |
| [Mark complete] [View notification outcome]        |
| [Load more]                                        |
+----------------------------------------------------+
```

On mobile, stack each card and make actions full width. Show the empty message
**No tasks are currently assigned to you.** Disable only the task being
completed, then update its status. Do not offer reopen.

## Create Task

Route: `/tasks/new`. Load `GET /assignees`; submit `POST /tasks`.

```text
+----------------------------------------------------+
| Create Task                                        |
| Title        [_______________________________]     |
| Description  [_______________________________]     |
|              Description is required.              |
|              0 / 4,000 characters                 |
| Assignee     [Select a teammate              v]    |
| [Assign to myself]                 [Create task]   |
+----------------------------------------------------+
```

Stack fields and use full-width controls on mobile. Load assignees into the
dropdown, including the current user. Require all fields; keep entered text on
errors. The visible character counter uses UTF-8 bytes. Show **Task saved** on
success, then notification processing or a retry option if needed. If event
publication cannot be confirmed, preserve the same task ID and values for the
bounded automatic retry and the visible manual retry; show a conflict message
without replacing the user's entered data.

## Created Tasks

Route: `/tasks/created`. Load `GET /tasks?role=created`.

```text
+----------------------------------------------------+
| Created Tasks                    [Create task]     |
| [Task title] Assigned to: Noor • Open              |
| Description • Created: Sep 9                       |
| [View notification outcome]                        |
| [Load more]                                        |
+----------------------------------------------------+
```

On mobile, stack task details and put the notification action below each card.
Show **You have not created any tasks yet** when empty. The outcome panel can
show Processing, Email sent, Skipped, Failed, or Unknown; check again after a
processing result.

## Notification History

Route: `/notifications`. Load `GET /notifications`.

```text
+----------------------------------------------------+
| Notification History                               |
| Task assignment | Email | Sent | Processed: 10:42  |
| Task ID: ab12…9f3e                                 |
| [Load more]                                        |
+----------------------------------------------------+
```

Stack each item on mobile. Show a generic Task assignment label, email result,
date, and short task ID—never a task title. Support empty, error, and Load more
states.

## Profile

Route: `/profile`. Load `GET /me`; save with `PATCH /me`.

```text
+----------------------------------------------------+
| Profile                                            |
| Display name [Noor__________________________]      |
| Email notifications [ on / off ]                   |
|                                     [Save changes] |
+----------------------------------------------------+
```

Stack fields and make Save full width on mobile. Show viewing, saving, saved,
and error states. Explain that the preference changes future assignment emails.

## Sign-In Callback

Route: `/callback`. This SPA page finishes the return from the external sign-in
flow and then redirects into the app.

```text
+----------------------------------------------------+
| Signing you in…                                    |
| Please wait while we finish your sign-in.          |
|                    [ loading ]                     |
+----------------------------------------------------+
```

Use the same centered status on mobile. Show a safe error and a sign-in-again
action if it fails; never show the returned sign-in details on screen.

## Missing Profile

Shown when the signed-in user's profile is not ready.

```text
+----------------------------------------------------+
| We could not find your profile                     |
| Your sign-in worked, but your app profile is not   |
| ready yet. Please try again or contact support.    |
| [Try again]  [Sign out]                            |
+----------------------------------------------------+
```

Stack the two actions full width on mobile. Retry checks the profile again.

## Session Expired

Shown when a signed-in session has expired.

```text
+----------------------------------------------------+
| Your session expired                               |
| Please sign in again to continue.                  |
|                 [Sign in]                          |
+----------------------------------------------------+
```

Use the same centered message and a full-width button on mobile. The action
opens the external sign-in flow.

## Configuration Error

Shown when required app configuration is missing or invalid.

```text
+----------------------------------------------------+
| The app is not configured yet                      |
| Please contact the project team for help.          |
| API and sign-in actions are unavailable.           |
+----------------------------------------------------+
```

Use the same single-column support message on mobile. Do not offer unavailable
actions.

## Not Found

Shown for an unknown route. No API request is needed.

```text
+----------------------------------------------------+
| Page not found                                     |
| That page is not available.                        |
|              [Go to Assigned Tasks]                |
+----------------------------------------------------+
```

Use the same centered message and full-width recovery button on mobile.
