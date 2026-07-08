# GraphQL Alias Authorization Cache IDOR

## Context

Use this when a GraphQL field fetches an object by ID and authorization depends on object ownership, visibility, tenant, or role.

## Requirements

- Authorized lab, owned app, in-scope target, or defensive review.
- One object ID the requester is allowed to read.
- One object ID the requester should not be allowed to read.
- Do not store live secrets, flags, cookies, tokens, or private URLs in reusable files.

## Baseline Denied Object

```graphql
query($targetId: ID!) {
  object(id: $targetId) {
    id
    sensitiveField
  }
}
```

Expected secure signal:

```text
Not authorized
```

## Allowed-First Alias Test

```graphql
query($allowedId: ID!, $targetId: ID!) {
  allowed: object(id: $allowedId) {
    id
    visibility
  }
  target: object(id: $targetId) {
    id
    sensitiveField
  }
}
```

Variables:

```json
{
  "allowedId": "<allowed-object-id>",
  "targetId": "<denied-object-id>"
}
```

Vulnerable signal:

```text
target.sensitiveField is returned
```

## Denied-First Negative Control

```graphql
query($allowedId: ID!, $targetId: ID!) {
  target: object(id: $targetId) {
    id
    sensitiveField
  }
  allowed: object(id: $allowedId) {
    id
    visibility
  }
}
```

Useful signal:

```text
target is denied
allowed may also be denied
```

If reversing the order changes authorization behavior, suspect a cache key or memoization issue.

## Paste-Specific Variant

```graphql
query($publicId: ID!, $privateId: ID!) {
  allowed: paste(id: $publicId) {
    id
    title
    visibility
  }
  target: paste(id: $privateId) {
    id
    title
    content
    visibility
    owner { id username }
  }
}
```

## Why This Works

GraphQL aliases let one operation execute the same field more than once with different arguments. If the authorization layer caches a decision for the field without including the arguments or object ID, the first decision can affect later sibling fields.

## Common Mistake

Testing only this:

```graphql
query($targetId: ID!) {
  object(id: $targetId) {
    id
  }
}
```

A single-field request can correctly deny access while a multi-alias request still bypasses authorization.

## Fix Signal

After a fix, the allowed-first query should return:

```text
allowed = object data
target = Not authorized
```

