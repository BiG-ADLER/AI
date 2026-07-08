# Custom Header Handshake Recon Checklist

## Goal

Determine whether a gated HTTP endpoint relies on a forgeable custom request header instead of real authentication, and extract the protected content with minimal tests.

## 1. Scope Confirmation

- Confirm lab, owned app, in-scope target, or defensive review.
- Record host, path, and date.
- Do not copy live flags, tokens, or private URLs into reusable notes.

Record:

```text
Target:
Authorization basis:
Endpoint:
Date:
```

## 2. Map The Gate Surface

Identify:

- denied message text
- accepted message text
- allowed HTTP methods
- whether content is HTML, JSON, or plain text

Record:

```text
Denied body signal:
Accepted body signal:
Methods allowed:
Secret output location:
```

## 3. Record Response Headers

Capture all response headers on the denied baseline.

Look for custom names such as:

```text
x-pwnbox
x-internal
x-handshake
x-tool
```

Record:

```text
Interesting response headers:
Do they change on retry: yes/no
```

## 4. Test Whether Response Headers Are Real Oracles

Retry after any successful-looking request.

If a header stays constant, mark it:

```text
Misleading oracle: yes/no
Reliable success signal:
```

Prefer body text over static response headers.

## 5. Test Branded Request Headers

Based on page title, product name, or lab branding, try:

```text
X-Pwnbox: handshake
X-Pwnbox: test
X-Handshake: 1
X-Internal-Tool: 1
X-Echo: 1
```

Also test:

```text
empty value
wrong header name
```

Record:

```text
Working request header:
Minimum value required:
Wrong-name control result:
```

## 6. Rule Out Common False Paths Early

Quickly test and document if these fail:

```text
Origin / Referer only
User-Agent only
Sec-Fetch-* only
X-Forwarded-For / X-Real-IP
WebSocket upgrade without real support
query parameters only
cookies only
```

This prevents unnecessary rabbit holes.

## 7. Confirm Minimal Proof

Use the smallest unlock primitive:

```bash
curl -sS -H "X-Pwnbox: handshake" "https://[host]/"
```

Record:

```text
Unlock header:
Unlock value:
Protected content location:
Impact:
```

## 8. Root Cause Checklist

Separate:

```text
Header presence check:
Server-issued credential required: yes/no
Misleading response metadata:
Secret exposure location:
```

## 9. Fix Checklist

- Replace header presence checks with signed auth.
- Remove secrets from weakly gated responses.
- Use reliable server-side authorization logging.
- Validate that response metadata reflects real state.

## Decision Checklist

- [ ] Denied baseline captured.
- [ ] Response headers inspected for misleading oracles.
- [ ] Branded custom request headers tested.
- [ ] Empty and wrong-name controls tested.
- [ ] Minimal unlock primitive confirmed.
- [ ] Protected content extracted.
- [ ] Root cause documented as forgeable header gate.
- [ ] Reusable notes exclude live secrets.
