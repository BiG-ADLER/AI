# postMessage Origin Field Trust Session Leak

## Date

2026-07-08

## Target Type

Embedded widgets, SSO/session handoff SDKs, partner integrations, and popup or iframe flows that exchange tokens with `postMessage`

## Bug Class

Client-side trust failure through attacker-controlled `postMessage` fields, origin spoofing, and session/token leakage

## Initial Signal

Look for flows where:

- an app says it sends a token or session to partner apps via `postMessage`
- a widget lives on a provider origin but replies to `window.opener` or `window.parent`
- the code reads `event.data.origin`, `event.data.targetOrigin`, or similar
- the allowlist uses regex/string matching instead of exact parsed origins
- a review/admin bot opens attacker-supplied partner URLs in a fresh session

Common examples:

```javascript
window.addEventListener('message', (e) => {
  if (allowed.test(e.data.origin)) {
    opener.postMessage({ token }, e.data.origin);
  }
});
```

## Pattern

The application ignores the trusted browser metadata:

```javascript
e.origin
```

and instead trusts attacker-controlled payload data:

```javascript
e.data.origin
```

If the same value is reused as the `postMessage` target, two bypass families appear:

**String parser confusion**

```text
https://trusted.example@attacker.tld
```

A weak regex or prefix check may see `trusted.example` while `postMessage` delivers to `attacker.tld`.

**Array / object `targetOrigin` confusion**

```javascript
const origin = ['https://trusted.example'];
origin.targetOrigin = 'https://attacker.tld';
```

`new URL(origin)` stringifies the array to a trusted URL, but `postMessage(secret, origin)` treats the array as options and reads `targetOrigin`.

## Trust Boundary

The browser provides `event.origin` as the sender identity. Any origin value inside `event.data` is just untrusted attacker input and must never define authorization or delivery targets.

## Minimal Reproduction

1. Find the widget/popup/iframe endpoint.
2. Confirm it listens for `message` events.
3. Check whether it reads `e.data.origin` instead of `e.origin`.
4. Forge the claimed origin and point it at an attacker-controlled real origin.

Generic proof:

```javascript
popup.postMessage({ origin: 'https://trusted.example@attacker.tld' }, '*');
```

```javascript
const origin = ['https://trusted.example'];
origin.targetOrigin = location.origin;
iframe.contentWindow.postMessage({ origin }, '*');
```

## Why Failed Tests Fail

- The widget validates `e.origin` and ignores attacker-supplied origin fields.
- The allowlist compares exact normalized origins.
- The widget signs and scopes a token instead of sending raw cookies.
- Embedded third-party context strips cookies, making iframes insufficient.
- The review flow does not open attacker-controlled external origins.

## Why Working Tests Work

The attacker can choose the claimed `origin` string, make it pass a weak allowlist, and reuse it as the `postMessage` target origin. Browser parsing then routes the sensitive reply to the attacker's actual origin.

## Impact

- Session cookie or token leakage
- Cross-app account takeover
- Break of SSO/partner handoff trust
- Admin/reviewer bot compromise when the handoff runs in a fresh authenticated session

## Fix

- Validate `event.origin`
- Tie responses to the exact sender window plus exact parsed origin
- Reject userinfo and parser-confusion forms
- Send narrow signed tokens rather than raw cookies or ambient session data
- Add replay protection and one-time handoff nonces

## Regression Test

All of the following must fail:

```text
event.data.origin = https://trusted.example@attacker.tld
event.data.origin = https://trusted.example.evil.tld
event.data.origin = https://trusted.example:443@attacker.tld
event.data.origin = ['https://trusted.example'] with targetOrigin = https://attacker.tld
```

Only a real sender with `event.origin === https://trusted.example` should receive the handoff.

## Future Checklist Item

When reviewing `postMessage` token handoffs, grep for `event.data.origin` before testing anything else. If the widget trusts a self-declared origin string, treat that as the primary break candidate.
