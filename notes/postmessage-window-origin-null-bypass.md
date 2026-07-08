# postMessage `window.origin` Null-Origin Bypass

## Date

2026-07-08

## Target Type

Web applications using `window.postMessage()` with weak origin validation and dangerous message handlers

## Bug Class

postMessage origin validation flaw, sandbox null-origin confusion, DOM XSS / JS execution via `eval`

## Initial Signal

A page listens for `message` events and contains logic like:

```javascript
if (event.origin !== window.origin) return;
eval(event.data);
```

Or similar sinks such as `innerHTML`, `location`, or dynamic function invocation.

Lab copy may mention trusted branches, official origins, or rejected unauthorized messages.

## Working Theory

`window.origin` is not equivalent to a strict trust decision on the real page origin. In sandboxed contexts, both the sender and receiver can present `window.origin` as the string `"null"`. If the handler compares `event.origin !== window.origin`, attacker-controlled messages from a sandboxed `srcdoc` iframe or sandboxed popup can pass the check.

This is different from a correct check against `location.origin`, which remains tied to the document URL and cannot be forced to `"null"` through ordinary sandbox tricks on the victim page itself.

## Trust Boundary

`postMessage` data must be treated as untrusted input from any origin that can satisfy the listener's validation. A flawed origin check collapses the boundary between attacker-controlled script and application JavaScript execution.

## Pattern

### Vulnerable check

```javascript
window.onmessage = function (event) {
  if (event.origin !== window.origin) return;
  eval(event.data);
};
```

### Why it fails

| Value | Legitimate same-origin message | Sandbox null-origin message |
|---|---|---|
| `event.origin` | `https://app.example` | `"null"` |
| `window.origin` | `https://app.example` | `"null"` |
| Check result | pass | pass |

The sandbox case is unintended.

## Minimal Reproduction

1. Identify a `message` listener and its origin check.
2. Determine whether it uses `window.origin`, `location.origin`, `indexOf`, or `event.source`.
3. Create a sandbox iframe:

```html
<iframe sandbox="allow-scripts" srcdoc="..."></iframe>
```

4. From the `srcdoc` script, either:
   - load the target in a nested sandbox iframe and `postMessage`, or
   - `open(target)` from a sandbox with `allow-popups`
5. Send attacker-controlled data to a dangerous sink such as `eval`.

## Common Mistakes During Testing

- Using `document.cookie` without checking whether the secret is rendered elsewhere in the DOM.
- Hosting the exploit on webhook.site while its CSP blocks inline/external script execution.
- Assuming `document.body` exists inside `srcdoc` scripts.
- Using only a nested iframe when the admin cookie is only sent on top-level navigation.
- Testing with `fetch()` exfil when `Image().src` is more reliable from sandboxed contexts.
- Sending `postMessage` before the target listener is registered; use a delay such as 10 seconds in bot labs.

## Why Failed Tests Fail

- Comparing against `location.origin` correctly blocks `null` origins.
- Static allowlists block unknown sender origins.
- No dangerous sink means message receipt alone is not enough for impact.
- Cross-origin sandbox iframe may load the page without privileged cookies, leaving DOM secret holders empty.

## Why Working Tests Work

Both sides of the comparison resolve to `"null"`, so the listener accepts attacker data. If the sink is `eval`, `innerHTML`, or similar, the attacker gains script execution or markup control in the target context.

## Related Pattern: Secret In DOM, Not Cookie

Some labs render cookie values server-side into an element such as:

```html
<span id="cookies">FLAG=...</span>
```

In those cases, the postMessage payload should read the DOM node:

```javascript
document.getElementById('cookies').innerText
```

not:

```javascript
document.cookie
```

## Impact

- JavaScript execution in the victim page.
- Exfiltration of DOM-visible secrets.
- Possible credentialed page access if the executed code can perform same-origin fetches.
- Bot/admin session compromise when a crawler visits attacker pages.

## Fix

- Compare against `location.origin` or a fixed trusted origin list.
- Never call `eval()` on `postMessage` data.
- Avoid rendering secrets into the DOM.
- Treat `event.source` checks carefully; source can be null or spoofable in some flows.
- Isolate bots and strip privileged cookies from untrusted browsing.

## Regression Test

- Messages from sandboxed `null` origins are rejected.
- `eval`, `innerHTML`, and dynamic code execution are absent from message handlers.
- Secrets are not present in DOM text content.
- Admin/report bots do not execute attacker pages with privileged cookies.

## Future Checklist Item

When you see `postMessage`, inspect the origin check before testing normal XSS. If the code references `window.origin`, build a sandbox `srcdoc` null-origin proof before trying reflected or stored XSS.
