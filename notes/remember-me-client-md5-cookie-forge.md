# Remember-Me Client MD5 Cookie Forge

## Date

2026-07-10

## Target Type

Login flows with “remember me” / “keep me logged in” implemented partly in browser JavaScript

## Bug Class

Broken authentication: client-built remember-me cookie, shared/disclosed MD5 (or similar) signing key, often chained with user IDOR

## Initial Signal

Look for:

- checkbox `remember` / `keep-me-logged-in`
- client scripts named like `md5.js`, cookie helpers, `localStorage` keys `k` / `r` / `u`
- login response HTML with hidden fields carrying a hex key and username
- cookies such as `userid`, `username`, `rc` / `remember` that are **not** HttpOnly
- comments or UI mentioning `md5`, `session`, `forget-me`

Typical construction:

```javascript
data = userid + '|' + username + '|' + md5(key + userid + username)
document.cookie = 'rc=' + btoa(data)
```

## Pattern

```text
server embeds shared key in login HTML
-> JS builds MAC over (userid, username)
-> attacker reads key once with any account
-> attacker learns victim id/username (IDOR, enum, leak)
-> forges rc for victim
-> /login or auto-login restores victim session
```

## Trust Boundary

The browser is attacker-controlled. A “signature” computed with a key the client can read is not a signature. Remember-me must be an opaque server secret or a MAC with a **server-only** key.

## Minimal Reproduction

1. Authenticate as any user with remember-me enabled.
2. Extract the key from HTML/JS/localStorage.
3. Confirm `rc` formula against your own cookies.
4. Obtain another account’s id + username (IDOR preferred).
5. Forge `userid` / `username` / `rc` and hit the restore endpoint.

## Why Failed Tests Fail

- Key is per-user and never sent to the client.
- Cookie is HttpOnly and set only by the server.
- MAC uses HMAC-SHA256 with a server secret.
- Server binds token to a random id stored hashed in DB; client cannot mint new ones.
- Username in the cookie is ignored; only opaque token id is looked up.

## Why Working Tests Work

The integrity check is reproducible by anyone who saw one successful remember-me login, and identity fields in the cookie are attacker-chosen.

## Common Mistake

Treating MD5-in-the-browser as “signed sessions” and only testing password reuse, while ignoring the remember-me cookie formula and user-id APIs.

## Drill

Given `c.js` / `s.js` style helpers, write the forge for:

```text
key = [from HTML]
ui  = base64(user_id)
u   = username
rc  = btoa(ui + '|' + u + '|' + md5(key + ui + u))
```

Then list how you would learn `user_id` and `username` without the password.

## Checklist Update

When auditing remember-me:

- [ ] Is the token opaque and server-issued?
- [ ] Is any MAC key visible to the client?
- [ ] Are identity fields inside the cookie attacker-controlled?
- [ ] Can low-priv users enumerate other usernames/ids?
- [ ] Does visiting `/login` with only remember cookies create a full session?

## Related Files

- `writeups/custos-remember-me-md5-cookie-forge.md`
- `payloads/auth/remember-me-md5-rc-cookie-forge.md`
- `notes/client-side-role-trust-auth-bypass.md`
- `checklists/client-side-session-trust-recon.md`
