# API signup mass assignment → role escalation

**Date:** 2026-07-11  
**Target type:** Lab / JSON-backed auth app  
**Bug class:** Mass assignment (API6 / object state manipulation)

## Concept

When a registration endpoint maps the entire JSON body into a user model, attackers can supply privileged fields that the UI never exposes. If the backend does not allowlist writable properties, self-registration becomes privilege escalation.

## Pattern

1. Map auth surface: `/signup`, `/login`, `/api/users/me`, protected routes like `/admin`.
2. Register normally and inspect what the API returns and what `/api/users/me` exposes.
3. Re-register with one extra field per request:
   - `role`
   - `user_role`
   - `isAdmin` / `admin` / `is_admin`
   - `type`
4. Confirm escalation through a read endpoint and a protected route, not only the write response.
5. Reduce to the single field name the model actually uses.

## Signals that matter

| Signal | Likely meaning |
|---|---|
| Signup accepts `Content-Type: application/json` | Good candidate for field injection |
| `GET /api/users/me` echoes `role` after injection | Server persisted the extra field |
| Protected path flips from `302` to `200` | Authorization now trusts poisoned state |
| Write response omits privileged fields | Silent binding still possible — verify with read + access test |

## Common mistake

Stopping after the signup response. Many apps only return safe fields while still storing privileged ones. Always verify with:

- an authenticated read endpoint (`/api/users/me`, `/api/user/me`)
- the actual protected action or page (`/admin`, `/api/admin/flag`)

## Why it worked in Otex

- Source: JSON body on `POST /signup`
- Sink: user persistence layer binding all keys
- Security control: role-based access on `/admin`
- Break: client-writable `role` field set to `admin`
- Other guessed names (`isAdmin`, `admin`) did not map to the model

## Related variant: profile update mass assignment

Same class, different lifecycle:

- **Signup-time binding** (Otex): inject on create
- **Update-time binding** (Herra): register normally, then `PUT /api/user/edit` with `user_role: admin`

Check both creation and update endpoints when hunting this bug class.

## Why it worked in Herra

- **Discovery:** wordlist fuzz found `/docs` → Swagger UI; full spec in `/docs/swagger-ui-init.js`
- **Auth:** JWT Bearer (`POST /api/auth/login`), not cookies
- **Source:** JSON body on `PUT /api/user/edit`
- **Sink:** user persistence layer binding all keys
- **Security control:** role check on `GET /api/admin/flag`
- **Break:** client-writable `user_role` set to `admin`
- **Swagger gap:** docs list only `firstname`/`lastname`; server still accepts `user_role`
- **Read endpoint:** `GET /api/user/me` echoes `user_role: "user"` before, `"admin"` after

```bash
# After login → TOKEN
curl -s -X PUT "$BASE/api/user/edit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_role":"admin"}'
curl -s "$BASE/api/admin/flag" -H "Authorization: Bearer $TOKEN"
```

## Fix model

- DTO / allowlist per endpoint
- Server-side defaults for role and permissions
- Deny unknown fields explicitly
- Authorization must read trusted server state, not client-supplied attributes

## Drill

On every JSON `POST /signup` or `POST /register`:

```json
{"email":"x","password":"y","role":"admin"}
{"email":"x","password":"y","user_role":"admin"}
```

On every JSON `PUT /api/user/edit` or `PATCH /profile` (authenticated):

```json
{"user_role":"admin"}
{"role":"admin"}
```

Then:

```http
GET /api/users/me
GET /api/user/me
GET /admin
GET /api/admin/flag
```

Look for role persistence and route access change.

## API enumeration signal

When fuzzing returns `/docs` or `/swagger`, pull the embedded spec before guessing routes:

```bash
curl -s "$BASE/docs/swagger-ui-init.js"
```

Many Express labs embed `swaggerDoc` inline with all paths and schemas.
