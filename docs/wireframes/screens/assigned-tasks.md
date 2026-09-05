# Assigned Tasks

Route: `/tasks/assigned`. Load `GET /tasks?role=assigned`; complete with
`PATCH /tasks/{taskId}/status`.

```text
+----------------------------------------------------+
| Assigned Tasks                         [Profile]   |
| [Task title]  Open                                |
| Description and creator                            |
| [Mark complete] [View notification outcome]        |
| [Load more]                                        |
+----------------------------------------------------+
```

On mobile, stack each card and make actions full width. Show the empty message
**No tasks are currently assigned to you.** Disable only the task being
completed, then update its status. Do not offer reopen.
