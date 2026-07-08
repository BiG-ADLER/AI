# Rolodex Source Map Token Leak

## What Is Happening

The Rolodex lab is a React single-page app backed by Express. The page loads a production JavaScript bundle, but the matching source map is also publicly accessible.

The source map exposes original source code, including an unused endpoint constant:

```ts
export const USER_LOGS = '/api/users/logs'
```

That endpoint is not used by the visible UI, but it is still live on the server.

## Why It Happens

The production bundle removed the unused `USER_LOGS` constant through tree shaking, so the endpoint was not obvious in the page JavaScript. The source map still included the original source in `sourcesContent`, which revealed the hidden route.

The server then failed to enforce authorization on `/api/users/logs` and returned active user session tokens.

## Exact Test

Check the source map:

```bash
curl -s https://[lab-host]/assets/index-DPm9vOq3.js.map
```

Find the hidden route in `sourcesContent`:

```text
/api/users/logs
```

Request the hidden endpoint:

```bash
curl -i https://[lab-host]/api/users/logs
```

Use the disclosed admin token:

```bash
curl -i -H 'Cookie: token=adm_[redacted]' https://[lab-host]/api/profile
```

Access the admin-only SVG path referenced by CSS:

```bash
curl -i -H 'Cookie: token=adm_[redacted]' https://[lab-host]/twleoknsdcsbu
```

## Expected Signal

- `/api/users/logs` returns JSON, not SPA fallback HTML.
- The JSON contains user records and active tokens.
- The admin token changes `/api/profile` from a customer profile to an admin profile.
- The admin-only SVG path returns `200 OK` only with the admin token.

## Result Interpretation

Confirmed bug chain:

```text
Public source map
-> hidden endpoint discovery
-> unauthenticated token disclosure
-> admin token reuse
-> admin-only resource access
```

## Root Cause

The root issue is missing authorization on a sensitive logs endpoint. Public source maps made discovery easier, but the critical server-side bug is that `/api/users/logs` returned active session tokens without requiring privileged access.

## Impact

An unauthenticated or low-privileged attacker can obtain active tokens for other users, including an admin, and impersonate them by setting the `token` cookie.

## Fix

- Require authorization on `/api/users/logs`.
- Remove raw session tokens from all API and log responses.
- Rotate exposed tokens.
- Treat source maps as sensitive production artifacts unless intentionally public.
- Add regression tests proving unauthenticated and customer requests cannot read user logs.

## Key Lesson

Do not stop at the minified bundle. For SPA labs and real targets, check source maps, extract `sourcesContent`, and test discovered endpoints with real HTTP requests before deciding they are only client-side artifacts.
