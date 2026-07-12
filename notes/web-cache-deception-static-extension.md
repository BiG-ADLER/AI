# Web cache deception via static extension on dynamic API

**Date:** 2026-07-11  
**Target type:** Lab / CDN-fronted web app  
**Bug class:** Web cache deception

## Concept

A cache layer treats a URL as static because of its extension or path shape, while the origin serves authenticated dynamic content for the same request. If the cache key ignores session cookies, one victim visit can expose private data to later unauthenticated readers.

## Pattern

1. Find a dynamic endpoint with sensitive per-user data.
2. Append or insert a static extension the cache rule recognizes:
   - `/api/v1/info.css`
   - `/api/v1/info.min.css`
   - `/api/v1/info/<segment>.css`
3. Compare authenticated vs unauthenticated behavior and cache headers.
4. Confirm the cache stores the authenticated body without cookie isolation.
5. Re-read the same URL without a session after the victim visit.

## Signals that matter

| Signal | Likely meaning |
|---|---|
| `cache-control: max-age=...` on authenticated JSON | Origin tells CDN to cache dynamic data |
| `cf-cache-status: HIT` / `MISS` / `EXPIRED` | CDN is involved; check second request |
| Auth `200`, cold unauth `301` | Origin is session-aware; deception may still work after victim poisons cache |
| Same body on `/api/v1/info` and `/api/v1/info.css` | Path normalization bug at origin or cache |

## Common mistake

Testing only with `curl` without a cookie after priming the cache with unauthenticated requests. Cold unauth probes can cache `301` responses and confuse results. Better test flow:

1. Victim/authenticated user visits deception URL first.
2. Attacker reads same URL without credentials in a browser or clean client context.

## Why it worked in Catch me

- Sensitive sink: `/api/v1/info`
- Deception URL: `/api/v1/info.css`
- Origin served private JSON with `max-age=14400`
- CDN cached authenticated response without session-aware cache keying

## Fix model

- Dynamic endpoints: `Cache-Control: private, no-store`
- Static path rules: only real static directories
- CDN: cache deception armor / content-type vs extension checks
- Origin: `404` for fake static paths, not dynamic fallback

## Drill

On any authenticated JSON endpoint, test:

```
/<endpoint>.css
/<endpoint>.min.css
/<endpoint>/x.css
/<endpoint>.js
```

Then verify whether an unauthenticated second request inherits the victim response from cache.
