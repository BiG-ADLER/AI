# Checklist: Northstar Cloud MFA Lab

Use when instance URL is `*.pwnbox-lab.com` and theme is MFA + operations workspace.

## Phase 0 — Instance health

- [ ] `POST /register` returns 302 (not 405 Instance Not Running)
- [ ] Record instance ID from subdomain (e.g. `81306254c3e8`)

## Phase 1 — Static recon

- [ ] Fetch `/assets/legacy/release-admin.41c8.js` for operator creds
- [ ] Fetch `/assets/app.91bd2.js.map` for runtime config + legacy flags
- [ ] Fetch `/assets/runtime.2c91a.js` for `window.__NORTHSTAR__`
- [ ] Read `/robots.txt` — confirm whether this is Portal variant (Disallow /backups/) or MFA variant
- [ ] Check `/product`, `/docs`, `/app/activity` for flavor text / hints

## Phase 2 — Auth mapping

- [ ] Register test account, capture `session` JWT
- [ ] Decode JWT — note `sub`, `twoFactorVerified` (no role claim)
- [ ] `GET /api/session` — note `role`, `mfaVerified` from DB
- [ ] Confirm only real API route: `GET /api/session` → 200 (others often 401/404 noise)

## Phase 3 — MFA stale-session bypass

- [ ] `GET /settings/security/mfa/setup` — extract TOTP secret from `<code>`
- [ ] `POST /settings/security/mfa/enable` with valid TOTP
- [ ] Confirm JWT still has `twoFactorVerified: false` after enable
- [ ] Confirm UI shows MFA Enabled + `/api/session` shows `mfaVerified: false`
- [ ] Re-login → MFA challenge issued, old cookie still accesses `/app`

## Phase 4 — Production sink

- [ ] `POST /api/legacy/releases/smoke-test` without cookie → 401
- [ ] Same with member session + leaked Maya creds in body → 404
- [ ] Document: needs admin session, not just body creds

## Phase 5 — Maya admin path

- [ ] Login Maya with leaked creds → MFA challenge, no session until verify
- [ ] Confirm `use_recovery=1&code=` param on `/auth/mfa/verify`
- [ ] Hunt recovery-code view route (UI: "Not viewed", CSS: `.secret-panel`)
- [ ] Fuzz `/settings/security/*recovery*`, `/api/*recovery*` with auth
- [ ] Try JWT crack (hashcat -m 16500) with instance ID + release string + leak strings
- [ ] Test `/backups/*` with and without session (302 vs open listing)

## Phase 6 — Win condition

- [ ] Obtain Maya admin session (recovery login, JWT forge, or unknown path)
- [ ] `POST /api/legacy/releases/smoke-test` with Maya creds + admin session
- [ ] Capture `pwnbox{...}`

## Wording discipline

- **Confirmed:** proven on live instance with request/response evidence
- **Likely:** strong inference (e.g. 404 = role gate)
- **Unknown:** recovery view route, JWT secret, Maya recovery codes

## Do not waste time on (ruled out for this variant)

- robots.txt → open `/backups/` (Portal lab only, not MFA variant)
- `role=admin` on register
- Profile email change to Maya
- smoke-test with headers only (no admin session)
- alg:none JWT
