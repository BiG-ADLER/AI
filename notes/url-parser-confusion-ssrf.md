# URL Parser Confusion SSRF

## Date

2026-06-09

## Target Type

Web application or GraphQL/API resolver that fetches user-selected upstream services

## Bug Class

SSRF caused by inconsistent URL parsing, normalization, validation, and execution

## Initial Signal

A user-controlled field influences an outbound request target:

```text
service
url
callback
webhook
avatar
file host
import URL
```

The app appears to restrict destinations, but accepts complex URL authority syntax.

## Pattern

Parser confusion happens when different components disagree about a URL:

```text
validator parser
-> normalizer / URL builder
-> redirect handler
-> DNS resolver
-> HTTP client
-> proxy / socket destination
```

The bug exists when the security decision is made on one interpretation, but the outbound connection uses another.

## Common Authority Confusion

Userinfo can make one host appear before another:

```text
https://allowed.example@127.0.0.1:8001/
```

Depending on the parser:

- `allowed.example` may be treated as userinfo.
- `127.0.0.1` may be the actual host.
- A naive allowlist may still match `allowed.example`.

Fragments can matter when the application appends paths:

```text
https://allowed.example@127.0.0.1:8001/openapi.json#/api/files/id
```

The appended suffix may be placed after `#`, leaving the effective request path as:

```text
/openapi.json
```

## Investigation Workflow

1. Identify the exact user-controlled field.
2. Determine whether the field is a full URL, hostname, service name, or path segment.
3. Reconstruct the URL the server likely builds.
4. Compare what the validator sees with what the HTTP client connects to.
5. Use one minimal internal response test before broad recon.
6. Inspect error messages for upstream status, URL, headers, or body leakage.
7. If internal documentation is exposed, use it as the source of truth.
8. Confirm impact with the smallest privileged read.

## Evidence To Record

For every candidate:

```text
Input:
Validator-visible host:
Executor destination:
Final URL logged or reflected:
Status:
Body signal:
Redirect behavior:
DNS behavior:
Blocked ranges:
```

## Why Payloads Fail

Common failure reasons:

- The application rejects userinfo with `@`.
- The application strips fragments before URL construction.
- The HTTP client does not send fragments to the server, so a fragment only helps if the vulnerable app appends paths before parsing.
- The allowlist validates the parsed hostname after normalization.
- Redirects are disabled or every redirect hop is revalidated.
- The app blocks loopback/private IPs after DNS resolution.

## Safe Fix

- Prefer symbolic service identifiers mapped to fixed server-side URLs.
- Do not accept raw user-controlled authorities for internal fetches.
- Parse once with a strict parser and validate the normalized URL used for execution.
- Reject userinfo, fragments, backslashes, encoded separators, mixed slashes, and unexpected schemes.
- Resolve DNS and validate every final socket IP.
- Revalidate every redirect destination.
- Keep upstream response bodies out of user-visible errors.

## Future Checklist Item

When testing SSRF, do not start by collecting payloads. Start by drawing:

```text
source -> URL construction -> validator -> executor -> final socket -> response exposure
```

Then break one parser assumption at a time.
