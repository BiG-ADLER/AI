# SSRF Alternate Loopback Recon Checklist

## Goal

Determine whether a server-side fetcher blocks only obvious internal-host strings and can still reach loopback through alternate numeric host notation.

## 1. Scope Confirmation

- Confirm lab, owned app, in-scope target, or defensive review.
- Record host and date.
- Do not copy live flags, tokens, cookies, or private URLs into reusable notes.

Record:

```text
Target:
Authorization basis:
Date:
Internal hint (host/port/service):
```

## 2. Map The Fetch Surface

Find:

- chat preview
- OG unfurler
- URL preview
- webhook tester
- import from URL

Record:

```text
Endpoint:
Parameter:
Method:
Response fields:
Blocked-host message:
```

## 3. Confirm Baseline Behavior

Submit a normal external URL:

```bash
curl -sS -X POST "https://[host]/post" \
  --data-urlencode "message=https://example.com/"
```

Record:

```text
External fetch works: yes/no
Preview title:
Preview URL:
Preview description:
```

## 4. Confirm Direct Internal Block

Test common literal forms:

```text
http://127.0.0.1:[port]/
http://localhost:[port]/
http://[::1]:[port]/
```

Record:

```text
Direct loopback blocked: yes/no
localhost blocked: yes/no
IPv6 loopback blocked: yes/no
Exact blocked message/title:
```

## 5. Test Alternate Loopback Forms

Try:

```text
http://127.1:[port]/
http://0x7f000001:[port]/
http://0177.0.0.1:[port]/
http://2130706433:[port]/
```

Record:

```text
Payload:
Accepted or blocked:
Observed title:
Observed description:
```

## 6. Compare Validator And Executor

Document:

```text
Validator-visible host:
Expected canonical IP:
Likely executor destination:
Evidence of successful internal fetch:
```

## 7. Prefer Minimal Internal Proof

If the app reflects the response, stop once you have:

- an internal banner
- preview metadata from the internal service
- a lab flag or canary in scope

Do not broaden testing unnecessarily.

## 8. Root Cause Checklist

Separate:

```text
Raw-string blocklist:
Missing canonicalization:
Missing DNS/IP validation:
Response reflection:
```

## 9. Fix Checklist

- Canonicalize and parse URLs before policy checks.
- Resolve the host and validate the final IP.
- Block loopback, RFC1918, link-local, and metadata ranges.
- Normalize alternate numeric IP forms to canonical IPs before comparison.
- Avoid exposing sensitive internal response details to untrusted users.

## Decision Checklist

- [ ] Fetch surface identified.
- [ ] External baseline confirmed.
- [ ] Direct loopback block confirmed.
- [ ] Alternate loopback notation tested.
- [ ] At least one successful alternate form confirmed or ruled out.
- [ ] Minimal internal proof captured.
- [ ] Root cause documented as canonicalization failure.
- [ ] Reusable notes exclude live secrets.
