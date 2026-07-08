# SSRF Substring Allowlist Fragment Bypass

## Date

2026-07-08

## Target Type

Server-side URL fetchers, previewers, webhook testers, and link unfurlers with naive destination restrictions

## Bug Class

SSRF through substring allowlist bypass using URL fragments

## Initial Signal

An application fetches user-supplied URLs but claims only one destination or a small set of destinations is allowed. Rejections look like:

```text
destination not in allowlist
host not allowed
invalid url
```

Direct loopback requests fail, but the validation error suggests the check happens before the outbound HTTP request.

## Pattern

Some apps validate with string operations instead of parsed URL components:

```javascript
if (!url.includes(ALLOWED_URL)) {
  throw new Error('destination not in allowlist');
}
fetch(url);
```

Or:

```javascript
if (!url.startsWith(ALLOWED_ORIGIN)) {
  deny();
}
```

A fragment can satisfy the string check without affecting the real destination:

```text
http://127.0.0.1:9000/secret#https://allowed.example/
```

What each layer sees:

| Layer | Host | Path | Fragment |
|---|---|---|---|
| Substring validator | sees `https://allowed.example/` in full string | — | not evaluated for allowlist |
| URL parser / HTTP client | `127.0.0.1` | `/secret` | ignored on wire |

## Trust Boundary

The application assumes "if the allowed destination appears in the URL, the fetch is safe." That assumption breaks when attacker-controlled syntax separates string appearance from network destination.

## Investigation Workflow

1. Identify the fetch endpoint and response format.
2. Confirm the exact allowed URL or origin string.
3. Test direct loopback and obvious parser-confusion payloads.
4. If `@` userinfo bypasses fail, test fragment smuggling early.
5. Use the internal response as an oracle for next paths.
6. Prefer documented internal endpoints over blind guessing.

## Minimal Reproduction

```bash
curl -sS -X POST "https://[host]/api/fetch" \
  -H 'content-type: application/json' \
  -d '{"url":"http://127.0.0.1:[port]/#https://[allowed-host]/"}'
```

Useful signals:

```text
metadata service
internal banner
different body than public app
openapi or endpoint list
```

Then target documented paths:

```text
http://127.0.0.1:[port]/[internal-path]#https://[allowed-host]/
```

## Difference From Userinfo Bypass

| Technique | Validator trick | Typical requirement |
|---|---|---|
| Userinfo | `allowed@127.0.0.1` | `@` accepted; parser splits authority |
| Fragment allowlist smuggling | `127.0.0.1#https://allowed/` | substring or `startsWith` allowlist |
| Fragment path control | `allowed@127.0.0.1/path#` | server appends suffix after user input |

These can coexist in one app but are separate root causes.

## Why Failed Tests Fail

- Parsed-host allowlists that normalize before comparison.
- Explicit rejection of `#` or `@`.
- Blocked loopback IPs after DNS resolution.
- Blind SSRF with no response reflection.
- Allowlist checks on `hostname` after `new URL(url)`.

## Why Working Tests Work

The raw submitted string contains the allowed destination token, so the substring gate passes. The HTTP stack parses the authority as loopback and never sends the fragment to the server.

## Impact

- Read internal HTTP services on loopback or RFC1918 networks.
- Discover internal routes from metadata responses.
- Exfiltrate secrets when fetch output is reflected to the attacker.

## Fix

- Never use `includes()`, `startsWith()`, or regex on the raw URL for SSRF policy.
- Parse with a strict URL library and validate exact allowed `origin`.
- Reject fragments and userinfo unless explicitly needed.
- Resolve hostnames and block private, loopback, and metadata destinations.
- Revalidate redirect targets on every hop.

## Regression Test

These must fail after patching:

```text
http://127.0.0.1:9000/#https://allowed.example/
http://127.0.0.1:9000/secret#https://allowed.example/
https://evil.example/redirect#https://allowed.example/
```

## Future Checklist Item

When an SSRF filter mentions "allowlist" or "one address," test fragment smuggling in the same pass as userinfo and redirect bypasses.
