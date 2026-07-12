# API mass assignment recon

**Bug class:** Mass assignment / improper input handling (API6)  
**Goal:** Find client-writable privileged fields on JSON create or update endpoints

## Surface map

- [ ] Identify auth routes: register, login, profile read, profile update
- [ ] Note auth mechanism: JWT Bearer vs session cookie
- [ ] Find protected admin route or flag endpoint (401/403 when unprivileged)
- [ ] Check for API docs: `/docs`, `/swagger`, `/openapi.json`, `/docs/swagger-ui-init.js`

## Enumeration

- [ ] Fuzz directories with raft-small or similar; treat **401, 403, 405** as hits
- [ ] If `/docs` exists, extract embedded OpenAPI from `swagger-ui-init.js`
- [ ] Compare documented request body vs fields echoed on `GET /me` endpoints

## Mass assignment tests

### Signup-time (create)

- [ ] Register normally; inspect `GET /api/user/me` or `/api/users/me`
- [ ] Re-register with one extra field per request:
  - `role`, `user_role`, `isAdmin`, `admin`, `is_admin`, `type`
- [ ] Confirm persistence on read endpoint, not only signup response

### Update-time (edit)

- [ ] Authenticate as normal user
- [ ] `PUT` or `PATCH` profile endpoint with privileged field candidates
- [ ] Re-read `/me` and retry protected admin route

## Verification

- [ ] Escalation confirmed on read endpoint (role field changed)
- [ ] Protected route flips from 401/403 to 200
- [ ] Reduce to single working property name for the model

## Common mistakes

- Stopping at Swagger docs — server may accept fields not listed in schema
- Trusting signup response only — verify with read + access test
- Testing only signup when update endpoint is the actual sink

## Fix checklist (for reports)

- [ ] DTO/allowlist per endpoint
- [ ] Server-side defaults for role/permissions
- [ ] Reject or strip unknown fields
- [ ] Authorization reads trusted server state only

## Lab references

- Otex: signup-time `role` on `POST /signup`
- Herra: update-time `user_role` on `PUT /api/user/edit`; Swagger at `/docs`
