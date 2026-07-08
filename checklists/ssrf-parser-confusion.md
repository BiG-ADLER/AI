# SSRF Parser Confusion Checklist

## Goal

Prove whether a user-controlled outbound request target can bypass validation because the validator and executor interpret the URL differently.

## 1. Scope Confirmation

- Confirm the target is a lab, owned app, in-scope target, or defensive review.
- Record the target host and endpoint.
- Do not copy live secrets, tokens, flags, cookies, or private URLs into reusable notes.

Record:

```text
Target:
Authorization basis:
Date:
```

## 2. Identify The Source

Find the user-controlled field that influences the outbound request:

- `url`
- `service`
- `host`
- `callback`
- `webhook`
- `file`
- `avatar`
- `import`

Record:

```text
Endpoint:
Parameter:
Expected format:
Server-appended prefix/suffix:
```

## 3. Reconstruct URL Construction

Determine whether the server builds:

```text
http://[service]/fixed/path
https://fixed-host/[user-path]
[user-url]
```

Record:

```text
Observed reflected URL:
Assumed builder:
Unknown pieces:
```

## 4. Compare Parsers

Test one parser assumption at a time:

- userinfo: `allowed.example@127.0.0.1`
- fragments: `internal/path#`
- encoded slash: `%2f`
- backslash: `\`
- mixed slash/backslash: `\/`
- IPv6 loopback: `[::1]`
- integer IP forms
- redirects to internal hosts

Record:

```text
Input:
What validator likely sees:
What executor likely connects to:
Evidence:
```

## 5. Look For Response Oracles

Check whether errors reveal:

- upstream status
- final URL
- headers
- response body
- parser failure body
- timing differences

Record:

```text
Status signal:
Body signal:
Timing signal:
Final URL leak:
```

## 6. Use Internal Documentation Before Guessing

If the target exposes internal docs, use them:

```text
/openapi.json
/swagger.json
/docs
/redoc
```

Record:

```text
Docs path:
Internal routes:
Auth requirements:
Sensitive route candidates:
```

## 7. Trace Authentication Material

If secrets are exposed, answer before replaying:

- What type of secret is it?
- Which service accepts it?
- Which auth scheme uses it?
- What username/password/header/cookie format is required?
- What is the minimal read-only proof?

Record:

```text
Secret type:
Replay service:
Replay method:
Minimal proof:
```

## 8. Confirm Impact Minimally

Prefer a single read-only request that proves privilege:

```text
/api/profile
/admin/status
/flag in lab only
```

Record:

```text
Precondition:
Request:
Response:
Impact:
Limitations:
```

## 9. Report Root Cause

Separate each issue:

```text
Primary: URL parser mismatch allows SSRF.
Amplifier: upstream body is exposed in user-visible GraphQL errors.
Impact pivot: internal control-plane route exposes a reusable super-token.
```

## 10. Fix Checklist

- Replace raw URL input with server-side service identifiers.
- Parse and validate the exact normalized URL used for execution.
- Reject userinfo, fragments, ambiguous separators, and unexpected schemes.
- Resolve DNS and block loopback, private, link-local, and metadata ranges.
- Revalidate every redirect target.
- Hide upstream bodies from application errors.
- Remove control-plane secrets from HTTP responses.
- Rotate any exposed credentials.
- Add regression tests for parser-confusion payloads.

## Decision Checklist

- [ ] Source parameter is identified.
- [ ] URL construction is understood.
- [ ] Validator interpretation is separated from executor destination.
- [ ] At least one internal response signal is confirmed.
- [ ] Response oracle behavior is documented.
- [ ] Internal route discovery uses evidence, not guessing.
- [ ] Secret replay method is understood before use.
- [ ] Final impact is proven with a minimal request.
- [ ] Reusable notes are redacted.
