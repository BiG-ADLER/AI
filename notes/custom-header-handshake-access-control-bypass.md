# Custom Header Handshake Access Control Bypass

## Date

2026-07-08

## Target Type

Internal tools, debug endpoints, echo services, admin banners, and "tooling only" HTTP gates

## Bug Class

Information disclosure through weak header-based access control and misleading response metadata

## Initial Signal

Copy such as:

```text
Handshake not detected.
This endpoint only responds to requests originating from our own tooling.
Internal use only.
```

Often paired with:

- a static custom response header
- HTML denied/accepted messages
- no obvious login flow

## Pattern

The application checks for a custom request header instead of real authentication:

```http
X-Pwnbox: handshake
```

If the header exists and is non-empty, the server returns protected content. Browsers do not send this header by default, so developers assume casual visits are blocked.

This is not a protocol handshake. It is usually just:

```text
if request.headers.get("X-Pwnbox"):
    allow()
```

## Misleading Oracle

A common trap is a response header that appears related but does not change:

```http
x-pwnbox: null
```

If that value is constant for both denied and accepted requests, it is not a reliable signal. Read the body instead:

```text
Handshake not detected.
Handshake accepted.
```

## Trust Boundary

Header presence is attacker-controlled. Any client capable of setting HTTP headers—`curl`, Burp, scripts, browser extensions—can satisfy the gate.

## Minimal Reproduction

```bash
curl -sS "https://[host]/"
curl -sS -H "X-Pwnbox: handshake" "https://[host]/"
```

Compare:

- body text
- `<pre>` secret output
- whether any response header actually changes

## Investigation Workflow

1. Record the denied baseline body and headers.
2. Identify custom response headers that look interesting.
3. Verify whether those response headers change on success.
4. Test likely request header names from page branding (`X-Pwnbox`, `X-Handshake`, `X-Internal-Tool`).
5. Test non-empty vs empty header values.
6. Confirm wrong header names fail.
7. Reduce to the smallest forgeable header that unlocks content.

## Why Failed Tests Fail

- Checking only response headers that never change.
- Assuming WebSocket/TLS/protocol handshake is required when the app only checks header presence.
- Testing origin, referrer, or user-agent without trying branded custom headers.
- Using the wrong header name (`Pwnbox` vs `X-Pwnbox`).
- Sending an empty header value.

## Why Working Tests Work

The server equates "internal tooling" with "request includes our secret header name." No server-side identity is verified.

## Impact

- Disclosure of flags, internal messages, debug output, or privileged HTML.
- Bypass of cosmetic "internal only" controls.
- Wasted defensive effort if teams trust constant response metadata.

## Fix

- Issue server-side credentials for internal clients.
- Sign and verify tokens; do not trust header names alone.
- Enforce auth at the application or network edge.
- Ensure observability uses reliable authorization signals.
- Remove secrets from responses reachable through weak gates.

## Regression Test

These must remain denied:

```text
GET / without credentials
GET / with empty X-Pwnbox:
GET / with arbitrary X-Pwnbox: attacker
```

Only valid server-issued credentials should unlock protected output.

## Future Checklist Item

When a page says "handshake" or "own tooling only," test branded `X-*` request headers before deep protocol or origin-bypass rabbit holes. Separately verify whether response headers are real oracles.
