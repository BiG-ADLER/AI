# SSRF Through file:// Scheme

## Date

2026-07-08

## Target Type

Web application URL preview, webhook tester, import fetcher, or link unfurling feature

## Bug Class

SSRF, unsafe scheme handling, local file disclosure

## Initial Signal

An application fetches user-supplied URLs server-side and displays or stores the result. The prompt or UI mentions:

- preview a link from the server
- fetch URL contents
- local file path such as `/flag.txt`
- import remote resource
- webhook/callback verification

## Working Theory

If the fetcher accepts schemes beyond HTTP(S), `file://` may let the attacker read local files from the server's filesystem using the fetch process permissions.

## Trust Boundary

The server-side fetcher must only retrieve explicitly approved remote resources. It must never expose filesystem, internal network, or metadata endpoints through attacker-controlled URLs.

## Minimal Reproduction

1. Identify the fetch endpoint and parameter, commonly `url`.
2. Confirm a normal remote fetch works.
3. Submit a local file URL:

```text
file:///etc/passwd
file:///flag.txt
```

4. Inspect status text, HTML `<pre>` output, JSON body, or error messages for file contents.

Example:

```bash
curl -sS -X POST "https://[host]/fetch" -d "url=file:///flag.txt"
```

## Why Failed Tests May Fail

- The fetcher allows HTTP only and rejects `file://` outright.
- File reads succeed but output is not reflected, requiring blind/OOB techniques.
- Path normalization blocks absolute paths or strips scheme handlers incorrectly.
- The process lacks read permission on the target file.
- A WAF or middleware rewrites or blocks non-HTTP schemes before the fetcher runs.

## Why Working Test Works

Generic URL APIs often use libraries that support multiple schemes. If developers assume users will only paste `https://` links, `file:///path` can still be passed through to the same fetch primitive and read local files.

## Related SSRF Classes

Direct scheme abuse:

```text
file:///flag.txt
```

Internal HTTP access:

```text
http://127.0.0.1/
http://169.254.169.254/
```

Parser confusion when HTTP-only is intended:

```text
https://allowed.example@127.0.0.1/
http://127.1/
http://0x7f000001/
```

## Impact

- Disclosure of local secrets, configs, source, keys, or flags.
- Access to cloud metadata when combined with HTTP SSRF.
- Port scanning and interaction with internal admin services in more complex variants.

## Fix

- Enforce an allowlist of schemes: `http`, `https` only.
- Parse URLs with a strict library and reject everything else before fetch.
- Resolve hostnames and block private, loopback, link-local, and metadata destinations.
- Separate "preview remote web page" from "read local file" code paths entirely.
- Do not reflect fetched content from unapproved destinations.

## Regression Test

- `file://`, `gopher://`, and `dict://` payloads are rejected.
- `http://127.0.0.1/` and metadata URLs do not return internal content.
- DNS rebinding and parser-confusion payloads fail after normalization.
- Normal external HTTPS fetches still work for legitimate use cases.

## Future Checklist Item

On any server-side URL fetch feature, test `file:///etc/passwd` and any lab-provided local path before attempting localhost parser bypass chains.
