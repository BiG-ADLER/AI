# Internal Echo Service Header Handshake Bypass

## What Is Happening

The [Internal Echo Service lab](https://f56f7fc44435.pwnbox-lab.com/) shows a denied page by default:

```text
Handshake not detected.
This endpoint only responds to requests originating from our own tooling.
```

Every response also includes:

```http
x-pwnbox: null
```

That response header looks like a status indicator, but it does not change when access is granted.

## Why It Happens

The server treats any **non-empty `X-Pwnbox` request header** as a valid handshake. It does not verify tooling identity, origin, or a server-issued secret.

The real pass/fail signal is in the HTML body:

- denied: `Handshake not detected.`
- accepted: `Handshake accepted.` plus the secret in a `<pre>` block

## Exploit Chain

1. Request `/` and confirm the denied baseline.
2. Ignore the constant `x-pwnbox: null` response header as an oracle.
3. Resend the request with `X-Pwnbox: handshake` (or any non-empty value).
4. Read the accepted body and flag from `<pre>`.

## Exact Test

Baseline:

```bash
curl -sS "https://f56f7fc44435.pwnbox-lab.com/"
```

Bypass:

```bash
curl -sS -H "X-Pwnbox: handshake" "https://f56f7fc44435.pwnbox-lab.com/"
```

## Expected Signal

| Request | Body signal | `x-pwnbox` response header |
|---|---|---|
| No custom header | `Handshake not detected.` | `null` |
| `X-Pwnbox: handshake` | `Handshake accepted.` + flag in `<pre>` | `null` |
| `X-Pwnbox:` (empty) | denied | `null` |
| `Pwnbox: handshake` (wrong name) | denied | `null` |

## Result Interpretation

Confirmed bug chain:

```text
Weak custom-header gate
-> client adds X-Pwnbox
-> server accepts any non-empty value
-> secret disclosed in HTML
-> misleading constant response header
```

## Root Cause

Using header presence as authentication, combined with a misleading response header that does not reflect authorization state.

## Impact

- Unauthorized disclosure of gated content to any HTTP client.
- False sense of security from "internal tooling only" copy.
- Recon labs may waste time on origin/UA/WebSocket paths while the real check is a single forgeable header.

## Fix

- Replace header presence checks with signed, server-issued credentials.
- Bind internal access to authenticated sessions or mTLS.
- Do not expose secrets in HTML for gated endpoints.
- Make authorization outcomes visible only through reliable server-side signals.

## Key Lesson

When a lab mentions a "handshake," test simple custom headers early. If a response header looks like an oracle but never changes, trust the body content instead.

## Flag

`pwnbox{a8c4f3e217b9d56e4f8a1b2c3d4e5f6a}`
