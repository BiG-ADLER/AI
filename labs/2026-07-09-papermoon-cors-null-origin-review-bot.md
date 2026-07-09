# Paper Moon Pwnbox Lab - CORS Null-Origin + Review Bot

Date: 2026-07-09
Target type: CTF/lab
Bug class: CORS misconfiguration (`Origin: null` + credentials), sandbox null-origin bypass, credentialed cross-origin read, admin review bot abuse

## Observation

Gallery app at `https://c5d7d861ac77.pwnbox-lab.com/`.

Initial signals:

- React SPA titled **Paper Moon**
- Login form pre-filled with `gallery-user` / `moonlight`
- After login: **Review URL** form and `Signed in as gallery-user`
- Express backend (`x-powered-by: Express`)
- Session cookie: `session=...; HttpOnly; Secure; SameSite=None`

API surface from bundled JS:

- `POST /api/login`
- `GET /api/me`
- `POST /api/report`

Authenticated `/api/me` for gallery-user:

```json
{"username":"gallery-user","role":"user","session":"sess_..."}
```

## Hypothesis

The lab is CORS-themed. Sensitive endpoints may reflect `Origin: null` with `Access-Control-Allow-Credentials: true`. A sandboxed iframe can force `Origin: null`, then `fetch(..., {credentials:'include'})` can read authenticated responses from the victim browser.

The **Review URL** feature likely sends a headless admin bot to attacker-controlled pages, similar to other pwnbox curator/report bots.

## Evidence

CORS probe on `/api/me`:

```bash
curl -sI -H "Origin: null" "https://c5d7d861ac77.pwnbox-lab.com/api/me"
```

Confirmed response headers:

```http
access-control-allow-origin: null
access-control-allow-credentials: true
access-control-allow-headers: content-type
access-control-allow-methods: GET,POST,OPTIONS
```

Same behavior on `/poster.svg`.

Random origin `https://evil.com` returned no CORS headers. Exact lab origin was also reflected.

`/poster.svg` without auth:

```text
Unauthorized
```

After login, the frontend fetches `/poster.svg` with `credentials:'include'` and uses it as the page background. Likely admin-only secret content.

## Failed Assumptions

1. **CORS on arbitrary origins** — `https://evil.com` did not get `Access-Control-Allow-Origin`.
2. **Flag in `/api/me` JSON for admin** — admin response exposed role/session metadata, not the flag string itself.
3. **Direct unauthenticated `/poster.svg` read** — endpoint requires session.

## Working Theory

1. Host exploit page with sandboxed `srcdoc` iframe (`sandbox="allow-scripts"`).
2. From null origin, fetch:
   - `/api/me`
   - `/poster.svg`
   with `credentials:'include'`.
3. Exfiltrate via `Image().src` to OAST.
4. Submit exploit URL through `POST /api/report` while logged in as `gallery-user`.

## Test

Exploit host: subkeeper page with sandbox iframe.
Exfil: OAST session.
Trigger:

```bash
curl -s -b "session=$SESSION" -X POST "https://c5d7d861ac77.pwnbox-lab.com/api/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://[exploit-host]/"}'
```

Response:

```json
{"ok":true}
```

## Result

OAST received two hits from HeadlessChrome:

1. `/me?...` with admin session JSON:
   `{"username":"gallery-admin","role":"admin","session":"sess_..."}`
2. `/svg?...` with full admin-only SVG body containing per-character flag text.

Flag recovered from SVG text nodes:

```text
pwnbox{...}
```

## Root Cause

Server reflects `Origin: null` together with `Access-Control-Allow-Credentials: true` on authenticated JSON and SVG endpoints. Sandbox iframes produce a legitimate browser `null` origin, enabling cross-site credentialed reads. Review bot visits external URLs with admin cookies attached.

## Why Other Payloads Failed

- Non-null attacker origins were not allowlisted.
- Unauthenticated direct fetch of `/poster.svg` returned `401 Unauthorized`.
- `/api/me` alone was enough to prove admin account takeover metadata, but the flag lived in `/poster.svg`.

## Fix

- Never allow `Origin: null` with credentialed CORS.
- Use a strict origin allowlist; reject unknown origins entirely.
- Do not embed secrets in SVG/text served to credentialed cross-origin readers.
- Isolate review-bot sessions from high-value assets or block external navigation with active session cookies.

## Reusable Outputs

- `writeups/papermoon-cors-null-origin-review-bot.md`
- `notes/cors-null-origin-credentials-sandbox-bypass.md`
- `payloads/cors/sandbox-null-origin-credentialed-fetch-exfil.md`
- `checklists/cors-null-origin-recon.md`
