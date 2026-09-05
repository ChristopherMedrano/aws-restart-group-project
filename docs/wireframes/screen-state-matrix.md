# S3NT Screen-State Matrix

This matrix defines the required states for frontend wireframes. It excludes
Cognito-owned pages.

| Screen | Required states |
| --- | --- |
| Landing and Sign In | Signed out; redirecting to Cognito; configuration or sign-in-start error; signed-in redirect. |
| Sign-In Callback | Processing; callback error; missing profile; successful redirect. |
| Assigned Tasks | Loading; task list; empty list; marking complete; completion success; request error; Load more. |
| Created Tasks | Loading; task list; empty list; notification processing; terminal outcome; request error; Load more. |
| Create Task | Blank form; validation error; submitting; task saved; retry/recovery error. |
| Profile | Viewing/editing; saving; saved confirmation; validation/request error; missing profile. |
| Notification History | Loading; notification list; empty history; request error; Load more. |
| Missing Profile | Support message; retrying; retry error; sign out. |
| Session Expired | Session-expired message; sign-in action. |
| Configuration Error | Deployment-support message; API/auth actions blocked. |
| Not Found | Unknown-route message; link to Assigned Tasks. |

- Use one shared loading indicator and a live region for loading, success, and
  error messages.
- Keep existing list content visible when a refresh fails.
