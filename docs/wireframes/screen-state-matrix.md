# S3NT Screen-State Matrix

This matrix defines the required states for frontend wireframes. It excludes
Cognito-owned pages and applies the shared shell, focus, live-region, and mobile
requirements in [`screens.md`](screens.md).

| Screen | Required states |
| --- | --- |
| Landing and Sign In | Signed out; redirecting to Cognito; configuration or sign-in-start error; signed-in redirect. |
| Sign-In Callback | Processing; callback error; missing profile; successful redirect. Never display callback values. |
| Assigned Tasks | Initial loading; task list; empty list; refresh in progress; refresh error with prior list retained; marking complete; completion success; request error; Load more. |
| Created Tasks | Initial loading; task list; empty list; refresh in progress; refresh error with prior list retained; notification processing; terminal outcome; request error; Load more. |
| Create Task | Blank form; validation error; submitting; task saved; notification processing; bounded automatic retry; manual retry with the same task ID/payload; conflict; request error. |
| Profile | Initial loading; viewing/editing; saving; saved confirmation; validation/request error; missing profile. |
| Notification History | Initial loading; notification list; empty history; refresh in progress; refresh error with prior list retained; Load more; request error. |
| Missing Profile | Support message; retrying; retry error; sign out. |
| Session Expired | Session-expired message; sign-in action. |
| Configuration Error | Deployment-support message; API/auth actions blocked. |
| Not Found | Unknown-route message; link to Assigned Tasks. |

- Use one shared loading indicator and a live region for loading, success, and
  error messages. Do not rely on color alone for a status.
- Each visual wireframe package includes desktop and phone-sized layouts for
  every applicable state, including keyboard focus after its primary action.
- Keep existing list content visible when a refresh fails.
