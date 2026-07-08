# Control-Character JavaScript Scheme Bypass

## Date

2026-07-08

## Target Type

Client-side redirectors, preview tools, deep-link handlers, and JavaScript navigation helpers that blocklist dangerous schemes with raw string checks

## Bug Class

DOM XSS through scheme blocklist bypass, parser mismatch, and browser normalization of control characters

## Initial Signal

Look for flows where:

- a page accepts `?redirect_uri=`, `?next=`, `?url=`, or similar navigation input
- the source uses a regex like `/^javascript:/i`
- the value is assigned to `location.href`, `location`, `window.open`, or a link target
- there is no `trim()`, no `new URL()` parsing, and no explicit allowlist of safe schemes
- there is a report/admin-review feature that can deliver a same-origin victim click

Common examples:

```javascript
if (/^javascript:/i.test(value)) block();
location.href = value;
```

## Pattern

The application assumes dangerous schemes only matter at byte 0:

```javascript
if (/^javascript:/i.test(value)) reject();
```

But browsers often normalize or ignore leading whitespace/control characters:

```text
\njavascript:alert(1)
\tjavascript:alert(1)
\rjavascript:alert(1)
```

So the validator sees:

```text
does not start with javascript:
```

while the browser executes:

```text
javascript:...
```

## Trust Boundary

User-controlled navigation targets are attacker-controlled code paths. The browser's URL normalization rules are the real authority, not the app's raw string regex.

## Minimal Reproduction

1. Identify the redirect parameter.
2. Confirm a literal `javascript:` value is blocked.
3. Add one control character before the scheme.
4. Observe whether the value reaches the sink and executes.

Generic proof:

```text
https://[host]/?redirect_uri=%0Ajavascript:alert(1)
```

## Why Failed Tests Fail

- The app trims the value before validation.
- The app parses with `new URL()` and allows only safe schemes.
- The sink rejects non-network schemes after normalization.
- CSP or framework navigation logic blocks the follow-on XSS behavior.

## Why Working Tests Work

The validator tests the unnormalized string, while the browser normalizes leading control characters before interpreting the scheme. If the normalized value becomes `javascript:` and reaches `location.href`, the code executes.

## Impact

- DOM XSS on redirect pages or client-side routers.
- Admin/support bot compromise when same-origin report flows exist.
- Cookie theft or privileged in-browser actions in the victim session.

## Fix

- Trim and normalize before validation.
- Parse with `new URL()` and enforce a strict allowlist of schemes such as `https:`.
- Reject `javascript:`, `data:`, and similar active schemes after normalization.
- Avoid direct navigation to attacker-controlled strings.

## Regression Test

All of the following must be rejected:

```text
javascript:alert(1)
%0Ajavascript:alert(1)
%09javascript:alert(1)
%0Djavascript:alert(1)
```

Normal `https://example.com` redirects should still work.

## Future Checklist Item

When a redirector advertises a regex block on `javascript:`, test leading newline, tab, carriage return, and form-feed variants before spending time on more complex encoding tricks.
