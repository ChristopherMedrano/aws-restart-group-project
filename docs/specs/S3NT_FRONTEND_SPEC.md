# S3NT: Frontend Build Checklist

Build one piece at a time and test it in the browser before starting the next piece.

## 1. Start the app

- [ ] Make a simple single-page web app with `index.html`, CSS, and JavaScript.
- [ ] Add a top navigation area with links for **Assigned Tasks**, **Created
  Tasks**, **Create Task**, **Notifications**, **Profile**, and **Sign out**.
- [ ] Make the navigation work on small (phone/tablet) screens too. 
- [ ] Add a landing page with the app name, a one-sentence explanation, and a **Register or sign in** button.

## 2. Create routes and recovery states

Build these SPA routes. Use the route names if the app has routing.

| Page | Route | What the user needs to do |
| --- | --- | --- |
| Landing and Sign In | `/` | Show the app name, a short explanation, and **Register or sign in**. Redirect signed-in users to Assigned Tasks. |
| Sign-In Callback | `/callback` | Finish the Cognito sign-in return, then redirect to a safe signed-in route. Never show a code or token. |
| Assigned Tasks | `/tasks/assigned` | See tasks assigned to them and mark an open task complete. |
| Created Tasks | `/tasks/created` | See tasks they created and check the notification result. |
| Create Task | `/tasks/new` | Create a task and choose who receives it. |
| Notifications | `/notifications` | See the history of notification results. |
| Profile | `/profile` | Change display name and email-notification preference. |
| Not Found | any unknown route | Show a helpful message and a link back to Assigned Tasks. |

Also build these in-app recovery states. They are frontend-owned screens, not
separate normal routes and not Cognito-hosted pages.

| Recovery state | Trigger | What the user needs to do |
| --- | --- | --- |
| Missing Profile | A valid sign-in succeeds but the app profile is unavailable. | Show safe help with **Try again** and **Sign out**. |
| Session Expired | A protected request returns `401`. | Explain that the session expired and offer **Sign in**. |
| Configuration Error | Required runtime configuration is missing or invalid. | Show deployment-support guidance and block API/auth actions. |

## 3. Build the task lists

- [ ] Load assigned tasks from `GET /tasks?role=assigned`.
- [ ] Load created tasks from `GET /tasks?role=created`.
- [ ] Show each task's title, description, status, dates, and the other person's
  display name when available.
- [ ] Show these empty messages:
  - Assigned: **No tasks are currently assigned to you.**
  - Created: **You have not created any tasks yet.**
- [ ] Add **Load more** when the API returns `nextToken`. Send that opaque token
  unchanged in the next request, append the returned items, and hide **Load
  more** when `nextToken` is absent.
- [ ] On Assigned Tasks, add **Mark complete** for open tasks. Send
  `PATCH /tasks/{taskId}/status` with `{"status":"complete"}`.
- [ ] While a task is being completed, disable its button. Then update that card
  when the request succeeds.

## 4. Build the Create Task form

- [ ] Add fields for **Title**, **Description**, and **Assignee**.
- [ ] Load assignee choices from `GET /assignees`. The choices contain a user ID
  and display name. Include the current user.
- [ ] Use a dropdown for the assignee. Add **Assign to myself** to select the
  current user quickly.
- [ ] Require a title, description, and assignee before sending the form.
- [ ] Match backend validation: title is 1–140 UTF-8 bytes and description is
  1–4,000 UTF-8 bytes. Do not allow title or description values made only of
  spaces or blank lines, and reject carriage returns (`\r`).
- [ ] Show **Description is required.** under the description field.
- [ ] Show a live counter under Description, for example
  `1,248 / 4,000 characters`. Calculate the limit with UTF-8 bytes, not only
  JavaScript `text.length`.
- [ ] Keep the user's text in the form when there is an error.
- [ ] Create one canonical lowercase UUID v4 task ID for a submission. If the
  user retries the same task, reuse the same task ID and the same values.
- [ ] Send `POST /tasks` with `taskId`, `title`, `description`, and `assigneeId`.
- [ ] On success, show **Task saved**. Explain that email status may appear a
  little later.
- [ ] If the API returns `503 EVENT_PUBLISH_FAILED`, keep the same task ID and
  values. Make only bounded automatic retries, then offer a manual retry with
  that same immutable request. If the API returns `409`, show a clear conflict
  message and do not generate a replacement task ID.

## 5. Show notification results

- [ ] Add **View notification outcome** to task cards.
- [ ] Load one task's result from `GET /tasks/{taskId}/notification`.
- [ ] After **Task saved**, poll the task-scoped outcome every two seconds for up
  to 30 seconds. Then offer manual refresh while keeping **Notification
  processing** visible until a terminal result is returned.
- [ ] Use these messages:

| Result | Show this message |
| --- | --- |
| No result yet | Notification processing |
| `sent` | Email sent |
| `skipped` | Email not sent because the assignee disabled email notifications |
| `failed` | Email delivery failed; the task remains assigned |
| `unknown` | Delivery could not be confirmed |

- [ ] Load notification history from `GET /notifications`. When the API returns
  `nextToken`, send it back unchanged for **Load more**, append the new items,
  and hide **Load more** when no token is returned.
- [ ] For each history item, show a generic **Task assignment** label, email
  result, date, and a short task ID. Do not show the task title in history.

## 6. Build Profile

- [ ] Load profile data from `GET /me`.
- [ ] Let the user change display name and turn email notifications on or off.
- [ ] Save changes with `PATCH /me`.
- [ ] Show a simple saved message or a clear error message.

## 7. Make the app pleasant to use

- [ ] Show a loading message while a list or form is working.
- [ ] Show a plain error message and a **Try again** button when a request fails.
- [ ] Keep the old list on screen if a refresh fails.
- [ ] Use the same page layout, buttons, card style, and status style everywhere.
- [ ] Check the app on a phone-sized screen before calling it done.

## 8. Keep the first version small


- [ ] Finish the checklist above before adding extra features.
