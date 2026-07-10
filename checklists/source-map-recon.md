# Source Map Recon Checklist

## Goal

Find hidden client-side knowledge in production JavaScript source maps and prove whether it maps to real backend behavior.

## 1. Scope Confirmation

- Confirm the target is a lab, owned app, in-scope target, or defensive review.
- Record the target host and time.
- Avoid copying real secrets, tokens, flags, cookies, or private URLs into reusable notes.

Record:

```text
Target:
Authorization basis:
Date:
```

## 2. Map The Frontend Assets

Fetch the root page and identify JavaScript and CSS assets.

Check:

- `<script src=...>`
- `<link rel="stylesheet" href=...>`
- preload/modulepreload links
- service worker registration
- manifest file

Record:

```text
HTML URL:
JS assets:
CSS assets:
Cookies set:
Framework/header clues:
```

## 3. Test For Source Maps

For each JavaScript/CSS asset, test:

```text
/path/file.js.map
/path/file.css.map
```

Also inspect the bottom of JavaScript files for:

```text
//# sourceMappingURL=
```

Record:

```text
Source map URL:
Status:
Content-Type:
Contains sourcesContent: yes/no
```

## 4. Extract Useful Source Content

Focus on app source files before vendor files.

Search for:

- `/api/`
- `admin`
- `debug`
- `logs`
- `users`
- `profile`
- `token`
- `session`
- `role`
- `feature`
- `flag`
- `internal`
- `TODO`
- `sourceMappingURL`

Record:

```text
Source file:
Interesting constant/function:
Why suspicious:
```

## 5. Validate Real Endpoint Vs SPA Fallback

Do not trust status code alone. SPAs often return `200` fallback HTML for unknown paths.

Confirm:

- Is `Content-Type` JSON or HTML?
- Is the body app shell HTML?
- Does the response differ from `/random-nonexistent-route`?
- Does method handling differ?
- Are there API-shaped errors such as `{"error":"Not found"}`?

Record:

```text
Endpoint:
Status:
Content-Type:
Body type:
Real endpoint or SPA fallback:
```

## 6. Test Authorization Safely

For sensitive endpoints, compare:

- no cookie
- normal user cookie
- invalid/tampered cookie
- higher-privilege cookie only if legitimately obtained

Do not rely on client-side UI state. Confirm server-side behavior.

Record:

```text
Identity source:
Session source:
Role source:
Check location:
Missing check:
```

## 7. Confirm Impact

If data is disclosed, test minimal impact with the safest endpoint.

Examples:

- Use leaked session token only against `/api/profile`.
- Use discovered admin route only for a read-only request.
- Verify whether admin-only resources are server-protected.

Record:

```text
Leaked data type:
Replay location:
Observed identity/role change:
Impact:
Limitations:
```

## 8. Report Root Cause

Separate discovery weakness from server-side vulnerability.

Example:

```text
Source map exposure made endpoint discovery easier.
The confirmed security bug is missing authorization on the sensitive endpoint.
```

## 9. Fix Checklist

- Disable or restrict production source maps.
- Remove sensitive comments and unused endpoint constants from client source.
- Enforce server-side authorization on all sensitive endpoints.
- Never return raw session tokens in logs or user responses.
- Rotate exposed credentials.
- Add regression tests for unauthenticated and low-privileged access.

## 10. Known Lab Template

Rolodex / Source Maps style labs often follow:

```text
public .js.map
-> USER_LOGS = '/api/users/logs' in sourcesContent
-> unauthenticated token JSON
-> admin token cookie replay
-> admin SVG/CSS-hidden path such as /twleoknsdcsbu
```

Acme Intranet / session-tied IDOR + source maps often follow:

```text
login demo/demo
-> /js/app.bundle.js + public .js.map
-> unused adminInfo.js in sourcesContent
-> GET /api/v1/admin/profile?principal=1
-> secret field for Mira (#1, admin)
```

Still validate each step; do not skip auth and content-type checks. Search maps for `principal`, `secret`, and `/api/v1/admin` as well as generic `/api/`.

## 11. Decision Checklist

- [ ] Source map is confirmed reachable.
- [ ] Interesting source content is extracted.
- [ ] Discovered route is confirmed real, not SPA fallback.
- [ ] Authorization behavior is tested.
- [ ] Impact is confirmed with minimal safe replay.
- [ ] Root cause separates disclosure from missing server-side control.
- [ ] Reusable notes do not include live secrets, tokens, or flags.
