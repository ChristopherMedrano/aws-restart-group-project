# Create Task

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
success, then notification processing or a retry option if needed.
