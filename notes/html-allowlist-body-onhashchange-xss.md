# HTML Allowlist Body onhashchange XSS

## Date

2026-07-10

## Target Type

Profile/bio editors, comment systems, and “safe HTML” fields that claim an allowlist of tags

## Bug Class

Stored XSS via incomplete HTML allowlist; missed event handler (`onhashchange`); admin/review bot delivery

## Initial Signal

Look for:

- copy mentioning “allowlist” / “safe tags” / “some HTML allowed”
- different sanitization across fields (firstname vs bio vs lastname)
- raw tags surviving in one field while others are escaped
- a `hashchange` listener that looks like a jQuery DOM XSS lab (often a red herring)
- a report/ticket URL the admin bot will visit (including external URLs)

## Pattern

```text
allowlist keeps <body> (or another element that supports rare events)
-> common on* handlers stripped
-> uncommon handler survives (onhashchange, onbeforetoggle, …)
-> need a second step to fire the event (hash change, toggle, …)
-> bot/victim visits opener page that triggers the event on the stored page
```

Minimal stored payload shape:

```html
<body onhashchange="/* XSS */">X</body>
```

Trigger from another origin (when framing is blocked):

```javascript
const w = window.open('https://[host]/profile/[user]');
setTimeout(() => { w.location = 'https://[host]/profile/[user]#x'; }, 2000);
```

## Trust Boundary

User-controlled profile HTML is attacker input. An allowlist is only as strong as the tag/attr matrix and the browser’s event model. Document-level elements and obscure handlers are high-risk leftovers.

## Minimal Reproduction

1. Probe each field with `<b>x</b>`, `<body>x</body>`, `<img src=x onerror=1>`.
2. For any kept tag, fuzz `on*` attributes — including uncommon ones.
3. If `onhashchange` survives, confirm it does not fire until the fragment changes.
4. Build an opener page; submit it to the review bot if present.
5. Exfil `document.cookie` or fetch privileged same-origin resources.

## Why Failed Tests Fail

- Field is fully escaped (`&lt;...&gt;`) — no HTML execution.
- Allowlist strips all `on*` attributes.
- `body`/`html` are not permitted.
- Bot only visits same-origin URLs and never loads the opener.
- Framing blocked and `window.open` blocked — no way to change the victim tab’s hash.
- Secrets only in HttpOnly cookies and no privileged same-origin fetch path.

## Why Working Tests Work

- Sanitizer allowlists `body` but forgets `onhashchange`.
- Browser fires `hashchange` on the element/window when the fragment updates.
- External ticket URLs are accepted, so the bot runs the opener under a real browser profile.
- Flag/secret cookie is readable from JS.

## Common Mistake

Chasing the visible `addEventListener('hashchange', ...)` stub (jQuery `$()` style) instead of checking which **attributes** the allowlist actually keeps on stored HTML.

## Drill

Given three fields with different escaping, map:

```text
kept tags:
kept attributes:
event needed to fire:
bot URL policy:
HttpOnly vs non-HttpOnly secrets:
```

## Checklist Update

When auditing HTML allowlists:

- [ ] Enumerate kept tags with a tag matrix, not random payloads
- [ ] Fuzz uncommon `on*` handlers (`onhashchange`, `onbeforetoggle`, `onanimationend`, …)
- [ ] Reject `body`/`html`/`head`/`svg`/`math` unless explicitly required
- [ ] Confirm how the event is triggered without user click (bot opener, autofocus, etc.)
- [ ] Separate “escaped for me” from “executed for admin”

## Related Files

- `writeups/hashology-body-onhashchange-allowlist-xss.md`
- `payloads/xss/body-onhashchange-allowlist-bot.md`
- `checklists/xss.md`
- `checklists/admin-bot-xss-recon.md`
