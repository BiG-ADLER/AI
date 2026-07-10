# postMessage targetOrigin Type Confusion

## Date

2026-07-09

## Target Type

Embedded widgets, session-handoff SDKs, and iframe `postMessage` reply flows that validate a user-controlled origin value before calling `postMessage(data, origin)`

## Bug Class

Client-side type confusion between `URL()` string coercion and `postMessage()` options-dictionary parsing

## Initial Signal

Look for code shaped like:

```javascript
const origin = event.data.origin;
if (ALLOWED.includes(new URL(origin).hostname)) {
  window.parent.postMessage(secret, origin);
}
```

Especially when:

- `origin` is taken from `event.data`, not `event.origin`
- hostname allowlists are exact or prefix-based
- the widget replies to `window.parent` from an iframe
- string parser-confusion payloads are blocked or patched

## Pattern

`URL()` and `postMessage()` disagree on how to read the same attacker-controlled value when it is an array.

Validation path:

```javascript
new URL(["https://trusted.example"]).hostname
// array -> "https://trusted.example" -> hostname passes
```

Delivery path:

```javascript
const origin = ["https://trusted.example"];
origin.targetOrigin = "https://attacker.tld";
window.parent.postMessage(secret, origin);
// postMessage treats array as options object
// reads origin.targetOrigin, not the stringified URL
```

## Trust Boundary

- `event.origin` is browser metadata and identifies the sender.
- `event.data.origin` is attacker-controlled.
- `targetOrigin` is a fixed `postMessage` option name; any object second argument is parsed as options, not as a URL string.

## Minimal Reproduction

```javascript
const origin = ['https://trusted.example'];
origin.targetOrigin = location.origin;
iframe.contentWindow.postMessage({ origin }, '*');
```

Receiver must be `window.parent` from an embedded widget iframe.

## Why Failed Tests Fail

- Code validates `event.origin` instead of `event.data.origin`
- Code requires `typeof origin === 'string'` before use
- Code passes a literal string to `postMessage`, not the raw attacker object
- Reviewer flow never opens attacker-controlled external pages
- Flag or session cookie is `HttpOnly` or blocked in third-party iframe context

## Why Working Tests Work

The validator and sink share one variable name but apply different JavaScript coercion rules. The attacker passes hostname validation with a stringified trusted URL while setting the real delivery target through `targetOrigin`.

## Impact

- Session cookie or token leakage to attacker origin
- Break of partner handoff trust
- Reviewer or admin bot compromise when the widget runs in a fresh authenticated session

## Fix

- Trust `event.origin` for sender identity
- Reject non-string `targetOrigin` values
- Use a separate validated string variable for `postMessage(message, trustedOriginString)`
- Never pass attacker-controlled objects as the `postMessage` options argument

## Regression Test

All of the following must fail to receive secrets:

```javascript
const origin = ['https://trusted.example'];
origin.targetOrigin = 'https://attacker.tld';
```

Also fail:

```text
event.data.origin = https://trusted.example@attacker.tld
event.data.origin = object with forged targetOrigin
```

## Future Checklist Item

When `postMessage` validation uses `new URL(value)` or string comparison, test the same value as an array/object with a custom `targetOrigin` property before assuming parser-confusion strings are the only bypass.
