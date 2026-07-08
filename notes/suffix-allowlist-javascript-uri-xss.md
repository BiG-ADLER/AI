# Suffix Allowlist JavaScript URI XSS

## Date

2026-07-08

## Target Type

Client-side redirectors, report/review flows, and JavaScript navigation helpers that validate user-supplied URLs in the browser

## Bug Class

DOM XSS through redirect validation failure, scheme confusion, and suffix-based allowlist misuse

## Initial Signal

Look for flows where:

- a page accepts `?url=`, `?to=`, `?next=`, or `?l=`
- the UI advertises an allowlist such as `.trusted.example`
- the source code uses string checks like `includes`, `indexOf`, `startsWith`, or `endsWith`
- the page assigns the validated value to `location.href`, `location`, `open()`, or a link target
- there is an admin/report feature that will revisit a crafted same-origin URL

Common examples:

```text
if (value.indexOf("https:") > -1) ...
if (candidate.endsWith(".trusted.example")) ...
location.href = value
```

## Pattern

The application mixes two bad assumptions:

```javascript
if (value.indexOf("https:") > -1) accept(value);
```

and:

```javascript
const checked = /^https?:\/\//i.test(value) ? new URL(value).host : value;
if (checked.endsWith(".trusted.example")) navigate(value);
```

This lets a payload like:

```text
javascript:alert(1)//https:.trusted.example
```

pass both checks while still executing as a `javascript:` URI.

## Trust Boundary

User-supplied navigation targets are attacker-controlled input. Visible suffixes and embedded substrings are not trustworthy security signals. The browser's URL parser and JavaScript URI handling define the real execution behavior.

## Minimal Reproduction

1. Identify the redirect parameter.
2. Confirm the code accepts any value containing `https:` or a trusted host substring.
3. Check whether non-HTTP inputs are validated as raw strings.
4. Test a `javascript:` URI ending in the trusted suffix.

Generic proof:

```text
https://[host]/?l=javascript:alert(1)//https:.trusted.example
```

## Why Failed Tests Fail

- The code parses every candidate with `new URL()` and validates `protocol` plus `hostname`.
- The sink blocks `javascript:` schemes before navigation.
- CSP or framework routing prevents the payload from executing even after navigation.
- The allowlist applies to the parsed host, not the raw string.

## Why Working Tests Work

The validator is checking a cosmetic substring or suffix, while the browser executes the real scheme. If the sink assigns the untrusted string to `location.href`, a passing `javascript:` URI becomes code execution.

## Impact

- DOM XSS on the redirect page.
- Admin/support bot compromise through same-origin report links.
- Cookie theft when sensitive cookies are readable by JavaScript.
- Potential privileged in-browser actions with the victim's session.

## Fix

- Always parse with `new URL()` before validation.
- Enforce an explicit scheme allowlist such as only `https:`.
- Validate `hostname` or normalized origin, not the whole string.
- Reject `javascript:`, `data:`, `vbscript:`, and similar active schemes.
- Prefer server-side redirect validation where possible.

## Regression Test

All of the following must be rejected:

```text
javascript:alert(1)//https:.trusted.example
data:text/html,<script>alert(1)</script>//https:.trusted.example
foohttps://bar.trusted.example
```

Normal approved destinations such as `https://sub.trusted.example/path` should still succeed.

## Future Checklist Item

When a redirector exposes its allowlist in the UI or source, test whether the check is applied to the parsed hostname or just to the tail of the full string before trying more complex parser-smuggling payloads.
