# Northstar MFA Lab — Stale Session Bypass + Legacy Smoke-Test Gate

**Date:** 2026-07-10  
**Bug classes:** MFA session desync, credential leak, broken access control on legacy API  
**Lab variant:** Northstar Cloud operations workspace (MFA), not Portal/robots variant

## Concept

A SaaS app adds MFA to protect privileged operations, but:

1. **Legacy production tooling** still exists at a JSON API endpoint
2. **Operator credentials** leak in a retired JS bundle
3. **MFA enable/login** fails to sync the JWT `twoFactorVerified` claim with DB MFA state
4. **Legacy endpoint** gates on session role (admin), not just body credentials

The flag is not in the leak itself — you must chain leak → admin session → authenticated smoke-test call.

## Pattern: MFA stale-session bypass

### Observation

After enabling MFA, the server re-issues the session cookie but leaves `twoFactorVerified: false` in the JWT while the DB marks MFA as enabled.

### Evidence signals

- UI: Authenticator shows **Enabled**
- API: `GET /api/session` → `"mfaVerified": false`
- JWT decode: `twoFactorVerified: false`
- Re-login redirects to `/auth/mfa?challenge=...` but **previous cookie still works** for `/app`

### Why it happens

MFA enrollment updates persistent user state but does not refresh the session claim that downstream auth middleware trusts (or trusts inconsistently).

### Exploitability conditions

- Attacker has a valid account
- Attacker enables MFA
- Attacker can use stale cookie to access post-MFA routes without completing verify

### Limitation in this lab

The smoke-test endpoint requires **admin role** from session `sub`, not just any authenticated user. Stale bypass alone gives member access only.

## Pattern: Legacy credential leak

### Source

`/assets/legacy/release-admin.41c8.js` — intentionally deployed for rollback validation.

### Sink

```javascript
fetch("/api/legacy/releases/smoke-test", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password })
});
```

Credentials in JS are necessary but **not sufficient** — server still checks session.

## Pattern: smoke-test authorization model

| Request | Response | Meaning |
|---------|----------|---------|
| No cookie | 401 `authentication_required` | Route exists, needs session |
| Member cookie + any body | 404 `Not found` | Auth OK, **role denied** (likely) |
| Admin cookie (hypothesis) | 200 + flag | Required win condition |

**Do not confuse** 401 (no session) with 404 (session present but not authorized).

## Pattern: MFA recovery login parameter

On `POST /auth/mfa/verify?challenge=<id>`:

- TOTP: `code=<6-digit>`
- Recovery: **`use_recovery=1&code=<8-char-code>`**

Wrong recovery → 401 "Incorrect authentication code"  
Alphanumeric without `use_recovery=1` → 400 invalid/expired challenge

Recovery codes view route was **not found** in testing — UI shows "Not viewed" with no link.

## Pattern: JWT role separation

- JWT: identity + `twoFactorVerified` only
- Role: server-side lookup on `/api/session` — **not forgeable via payload tampering** without knowing HS256 secret

## Minimal reproduction (member stale bypass)

```bash
BASE="https://<instance>.pwnbox-lab.com"
JAR=/tmp/ns.cj

# Register
curl -sS -c "$JAR" -X POST "$BASE/register" \
  -d "email=test@example.com&password=Testpass123!&name=Test"

# Get TOTP secret from setup page
SECRET=$(curl -sS -b "$JAR" "$BASE/settings/security/mfa/setup" \
  | grep -oP '(?<=<code>)[A-Z2-7]+')

# Enable MFA (generate TOTP with pyotp or manual)
curl -sS -c "$JAR" -b "$JAR" -X POST "$BASE/settings/security/mfa/enable" \
  -d "code=<6-digit-totp>"

# Confirm desync
curl -sS -b "$JAR" "$BASE/api/session"
# → mfaVerified:false, UI shows Enabled
```

## Fix (defensive)

1. Re-issue JWT with `twoFactorVerified: true` only after successful MFA enrollment verify
2. Invalidate pre-MFA sessions on MFA enable
3. Enforce MFA completion server-side on all protected routes (don't trust stale JWT claim)
4. Remove legacy operator credentials from static assets
5. Gate legacy endpoints behind current auth policy + role checks with consistent error codes
6. Implement recovery-code view as authenticated route; don't rely on security through obscurity

## Regression tests

- After MFA enable, JWT must reflect MFA state or session must be invalidated
- Re-login must invalidate old session cookies
- smoke-test returns 403 (not 404) for authenticated non-admin if hiding existence matters
- No credentials in `/assets/legacy/*`

## Checklist item

When lab mentions MFA + legacy/production tooling:

1. Read leaked JS bundles and source maps first
2. Test MFA enable → JWT claim vs DB state desync
3. Test re-login while keeping old cookie
4. Map smoke-test/auth API with and without session (401 vs 404)
5. Fuzz recovery-code routes — UI "Not viewed" implies a view endpoint exists
6. Try `use_recovery=1` on MFA verify once codes obtained
7. Do not assume robots.txt/backup variant — confirm per instance

## Common mistake

Stopping at credential leak and calling smoke-test with body creds only → 401 without session, 404 with member session. **Admin session is the blocker.**
