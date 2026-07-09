# Client-Side Role Trust Authentication Bypass

## Date

2026-07-08

## Target Type

Web applications that store session or role state in `localStorage`, `sessionStorage`, non-HttpOnly cookies, or custom client-supplied headers

## Bug Class

Broken authentication / authorization through trust in mutable client-side role claims

## Initial Signal

Look for flows where:

- login returns a JSON object containing `role`, `user`, or permission data
- the frontend stores it in `localStorage` or `sessionStorage`
- subsequent privileged requests send the stored object back in a header or request body
- there is no sign of a server-side session identifier or token verification

Common examples:

```text
localStorage.setItem('session', JSON.stringify(data))
X-Session: {...}
X-User: {...}
role=guest in a writable cookie
```

## Pattern

The app treats browser state as the source of truth:

```javascript
localStorage.setItem('session', JSON.stringify({
  user: 'guest',
  role: 'guest'
}));
```

Later:

```javascript
fetch('/api/staff', {
  headers: { 'X-Session': localStorage.getItem('session') }
});
```

If the server trusts that object directly, the client can replace:

```json
{"user":"guest","role":"guest"}
```

with:

```json
{"user":"guest","role":"admin"}
```

## Trust Boundary

The browser is attacker-controlled. Session state may be stored client-side for convenience, but authorization claims must not be trusted unless they are integrity-protected and verified server-side.

## Minimal Reproduction

1. Log in with a low-privilege account.
2. Capture the stored session object.
3. Modify the role claim.
4. Replay it to the privileged endpoint.

Generic proof:

```bash
curl -sS "https://[host]/api/staff" \
  -H 'X-Session: {"user":"guest","role":"admin"}'
```

## Why Failed Tests Fail

- The server ignores client role fields and uses a server-side session.
- The token is signed and signature validation fails after tampering.
- The privileged role string is not the one you guessed.
- Additional server-side checks such as user ID, nonce, or expiry are enforced.

## Why Working Tests Work

The server accepts unsigned, client-controlled authorization data and makes access-control decisions from it.

## Impact

- Self-promotion from low privilege to admin.
- Privileged API access without credential compromise.
- Possible access to staff dashboards, reports, exports, or destructive actions.

## Fix

- Store role and authorization state server-side.
- If using tokens, sign them and verify integrity on every request.
- Use HttpOnly session cookies or verified JWT/PASETO-style tokens.
- Never trust raw client-provided role claims without cryptographic verification.

## Regression Test

Changing any client-side role or permission field must not change server behavior:

```text
guest -> admin
user -> staff
read_only -> write
```

Unsigned custom session headers should be rejected.

## Future Checklist Item

When a frontend stores a whole session object in browser storage, inspect every privileged request path for direct replay into headers or bodies before spending time on password attacks or SQLi.

## Related Pattern

Client-built **remember-me** cookies that MAC `userid|username` with a key embedded in login HTML are the same trust failure in cookie form. See `notes/remember-me-client-md5-cookie-forge.md`.
