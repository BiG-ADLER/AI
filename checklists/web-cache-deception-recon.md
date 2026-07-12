# Web cache deception recon checklist

Use after finding authenticated dynamic endpoints on CDN-fronted apps.

## 1. Map sensitive dynamic endpoints

- [ ] Profile/account APIs
- [ ] Settings/export endpoints
- [ ] Tokens, API keys, or secret fields in JSON
- [ ] Client-side XHR/fetch paths from authenticated pages

## 2. Identify cache participants

- [ ] CDN headers: `cf-cache-status`, `x-cache`, `age`, `via`
- [ ] Origin cache headers: `cache-control`, `expires`, `etag`
- [ ] Static asset behavior baseline (`/css/*.css`, `/js/*.js`)

## 3. Test static-extension confusion

For each sensitive endpoint `<path>` test:

- [ ] `<path>.css`
- [ ] `<path>.min.css`
- [ ] `<path>.js`
- [ ] `<path>.png`
- [ ] `<path>/<random>.css`
- [ ] `<path>/.css`

Record for each:

- status with auth
- status without auth
- body equality with base endpoint
- cacheability headers
- CDN cache status on repeat requests

## 4. Test deception chain

- [ ] Authenticated victim visit to deception URL first
- [ ] Unauthenticated read of same URL second
- [ ] Confirm sensitive body returned without cookie
- [ ] Repeat in browser, not only curl

## 5. Rule out false positives

- [ ] Direct authenticated access to base endpoint is not the finding
- [ ] Unauthenticated cold request returning only `301`/`302`/`404` is not enough by itself
- [ ] Confirm post-victim unauthenticated disclosure

## 6. Path normalization extras

- [ ] encoded slash: `/api/v1/info%2f.css`
- [ ] delimiter forms: `/api/v1/info/.css`
- [ ] redirect normalization: `/api/v1/info/..%2finfo.css`

## 7. Report-ready artifacts

- [ ] deception URL
- [ ] victim request/response
- [ ] attacker cached read request/response
- [ ] root cause: extension-based cache rule + missing cookie isolation
- [ ] fix: `no-store`, fake static path hardening, CDN deception armor
