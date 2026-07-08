# S3/MinIO Response Header Override Upload XSS

## Date

2026-06-18

## Target Type

Web applications that accept uploads and serve stored objects through AWS S3, MinIO, or S3-compatible storage.

## Bug Class

Stored XSS through upload validation weakness and object-storage response header override.

## Initial Signal

An uploaded image is served from a path such as `/uploads/<key>.png`, `/images/uploads/<key>.png`, a bucket-style hostname, or a CDN-backed object URL. The response may include S3-style clues such as `X-Amz-Request-Id`, `X-Amz-Id-2`, `X-Amz-Bucket-Region`, `ETag`, `x-amz-meta-*`, or XML errors like `NoSuchKey`.

## Working Theory

The upload validator may only check superficial file properties such as extension, client-provided MIME type, or magic bytes. If the storage/download path lets the requester override `Content-Type`, a stored object that starts with image magic bytes but contains HTML/JavaScript can be served as `text/html` and executed by the browser.

This is official AWS S3 GetObject response-header override behavior, not a MinIO-only trick. MinIO is S3-compatible and commonly supports the same pattern, but behavior can vary by version, SDK, proxy, and signature rules.

## Relevant Override Parameters

Official S3 GetObject response header override query parameters:

- `response-cache-control`
- `response-content-disposition`
- `response-content-encoding`
- `response-content-language`
- `response-content-type`
- `response-expires`

Security priority for upload-to-XSS testing:

1. `response-content-type=text/html`
2. `response-content-disposition=inline`
3. `response-content-type=image/svg+xml`
4. `response-content-type=application/xhtml+xml`
5. `response-content-encoding=gzip`

## Signed URL Condition

For public unsigned object URLs, adding override parameters may work directly.

For private or presigned object URLs, override parameters usually must be included when the URL is signed. Adding them after signing can cause signature validation failure.

## Minimal Reproduction

Create a PNG-signature HTML polyglot:

```bash
printf '\x89PNG\r\n\x1a\n<script>document.body.textContent=document.domain</script>' > test.png
```

Upload it as a PNG, then compare the normal and override responses:

```bash
curl -I 'https://target/uploads/file.png'
curl -I 'https://target/uploads/file.png?response-content-type=text/html'
```

If the second response changes from `Content-Type: image/png` to `Content-Type: text/html`, load the override URL in a browser with a harmless proof payload.

## Why `nosniff` Does Not Save It

`X-Content-Type-Options: nosniff` prevents the browser from guessing a different MIME type than the server declared.

It does not help when the server itself declares:

```http
Content-Type: text/html
X-Content-Type-Options: nosniff
```

In that case the browser follows the declared HTML type.

## Common Failed Assumptions

- "The filename ends in `.png`, so the browser will treat it as an image."
- "The object has `nosniff`, so it cannot execute."
- "MinIO/S3 must be fingerprinted before this is worth testing."
- "Magic-byte validation proves the file is a real image."
- "A presigned URL can always be modified after signing."

## Fix

- Decode and validate uploaded images with a real image parser.
- Re-encode accepted images server-side and store only the normalized output.
- Reject malformed files, trailing junk, and polyglot content when the use case is images only.
- Strip or reject S3/MinIO response header override parameters at the application/CDN/proxy layer.
- Force stable download headers for user uploads.
- Serve user uploads from a cookieless separate origin.
- Set sensitive cookies with `HttpOnly`, `Secure`, and appropriate `SameSite`.

## Future Checklist Item

For any upload served from object storage, compare the normal object response with `?response-content-type=text/html` and test whether the returned `Content-Type` is requester-controlled.
