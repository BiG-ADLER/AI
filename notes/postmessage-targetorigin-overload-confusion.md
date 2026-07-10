# postMessage targetOrigin Overload Confusion

## Date

2026-07-09

## Target Type

Embedded widgets, SSO/session handoff SDKs, popup or iframe integrations, and review/admin-bot flows that exchange tokens with `postMessage`

## Bug Class

Client-side trust failure through attacker-controlled `postMessage` fields, JavaScript coercion mismatch, and `targetOrigin` overload confusion

## Initial Signal

Look for flows where:

- a widget accepts a partner-supplied `origin` value through `postMessage`
- the code validates with `new URL(value)` or string operations
- the same value is reused as the second argument to `window.postMessage`
- the code does not first require `typeof value === "string"`
- a review/admin bot opens attacker-controlled partner URLs in an authenticated browser session

Common shape:

```javascript
window.addEventListener('message', (e) => {
  const origin = e.data.origin;
  if (new URL(origin).hostname === 'trusted.example') {
    opener.postMessage({ token }, origin);
  }
});
```

## Pattern

The validator sees a string-like value:

```javascript
String(origin) === 'https://trusted.example'
new URL(origin).hostname === 'trusted.example'
```

But the sink may interpret the same value as a structured object:

```javascript
origin.targetOrigin = 'https://attacker.tld'
window.postMessage(message, origin)
```

One working example:

```javascript
const origin = ['https://trusted.example'];
origin.targetOrigin = 'https://attacker.tld';
```

This is not classic parser confusion on one string. It is API-boundary confusion caused by reusing an attacker-controlled non-primitive value across two operations with different semantics.

## Trust Boundary

The browser provides `event.origin` as the sender identity. Any origin value inside `event.data` is attacker input. If the application also accepts non-string objects and lets browser APIs coerce or reinterpret them, the trust boundary fails twice:

1. identity comes from attacker input
2. type and delivery semantics remain attacker-controlled

## Minimal Reproduction

1. Find the widget/popup/iframe endpoint.
2. Confirm it listens for `message` events.
3. Check whether it reads `e.data.origin` or similar attacker-controlled fields.
4. Check whether it validates with `new URL(origin)` or string logic.
5. Confirm the same value is reused in `postMessage(..., origin)`.
6. Send a non-string value whose stringification looks trusted but whose `targetOrigin` points to the attacker.

Generic proof:

```javascript
const a = ['https://trusted.example'];
a.targetOrigin = location.origin;
popup.postMessage({ origin: a }, '*');
```

## Why Failed Tests Fail

- The widget validates `event.origin` and ignores self-declared origin fields.
- The widget forces `typeof origin === "string"` before parsing.
- The code reuses `parsed.origin` instead of the original attacker value.
- The browser/runtime does not interpret the supplied value through the overload path being tested.
- Embedded third-party context strips cookies, so an iframe-only test shows an empty session.

## Why Working Tests Work

The attacker supplies one object-like value that passes validation after string coercion, then gets reinterpreted by `postMessage` through its overload semantics. The validation result and the delivery target are no longer the same thing.

## Impact

- Session cookie or token leakage
- Cross-app account takeover
- Break of SSO/partner handoff trust
- Admin/reviewer bot compromise when the handoff runs in a fresh authenticated session

## Fix

- Validate `event.origin`
- Require origin values to be primitive strings
- Parse once and store the normalized primitive origin
- Compare exact origin, not hostname-only checks
- Avoid passing attacker-controlled objects into overload-sensitive browser APIs

## Regression Test

All of the following must fail:

```javascript
const a = ['https://trusted.example'];
a.targetOrigin = 'https://attacker.tld';

const b = { toString(){ return 'https://trusted.example'; }, targetOrigin: 'https://attacker.tld' };
```

Only a real sender with `event.origin === 'https://trusted.example'` should receive the handoff, and the sink should use the normalized primitive string value rather than the original object.

## Future Checklist Item

When reviewing `postMessage` token handoffs, search not only for `event.data.origin` but also for non-string origin reuse across `new URL(...)` and `postMessage(..., origin)`. Treat object/array coercion plus API overloads as a first-class attack pattern.
