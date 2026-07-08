# GraphQL Authorization Cache IDOR

## Date

2026-06-11

## Target Type

GraphQL API with object-level authorization rules.

## Bug Class

IDOR / broken object-level authorization caused by unsafe authorization decision caching.

## Initial Signal

A direct object lookup is denied, but the same object is returned when another allowed object of the same field is requested first in the same GraphQL operation.

Signal pattern:

```text
paste(id: privateId) -> Not authorized

allowed: paste(id: publicId) -> allowed
target: paste(id: privateId) -> returned
```

## Working Theory

Some GraphQL authorization middlewares cache rule decisions. If a rule depends on arguments such as `id`, but the cache key does not include those arguments, one object's allow decision can be reused for another object.

This often appears as an order-dependent bug:

- Allowed object first: later denied object becomes readable.
- Denied object first: later allowed object may also be denied.

## Trust Boundary

The object ID crosses from an untrusted GraphQL argument into a resolver or data-access lookup. Authorization must be enforced for that exact object and requester, not just for the field name.

## Minimal Reproduction

```graphql
query($allowedId: ID!, $targetId: ID!) {
  allowed: object(id: $allowedId) {
    id
    visibility
  }
  target: object(id: $targetId) {
    id
    visibility
    sensitiveField
  }
}
```

Use:

```text
allowedId = object the requester may read
targetId = object the requester must not read
```

## Negative Control

Reverse the alias order:

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

If the reversed query denies both fields, the bug is likely authorization result reuse rather than a simple missing resolver check.

## Why Failed Tests May Fail

- Testing only one `object(id)` field does not exercise same-operation caching.
- Testing only mutations may miss a query-level rule cache issue.
- Testing authenticated-only flows may miss unauthenticated reads if public objects can seed the cache.
- Treating GraphQL aliases as cosmetic can hide the fact that they execute the same field multiple times with different arguments.

## Why Working Test Works

The first aliased field produces an allowed authorization result for the field's rule. The second aliased field uses the same GraphQL field name but different arguments. If the middleware cache ignores the changed arguments, the second object inherits the first object's decision.

## Impact

Impact depends on the object type:

- Private paste/document/message: confidential content disclosure.
- User/account object: cross-user data exposure.
- Tenant-scoped object: cross-tenant access.
- Mutation object: unauthorized update or deletion if the same caching mistake applies to mutations.

## Fix

- Disable authorization caching for rules that depend on `args`, `parent`, object state, tenant, ownership, or request identity.
- If caching is used, key decisions by user identity, field, arguments, object ID, tenant, and relevant state.
- Re-check ownership in the resolver or data-access layer before returning sensitive data.
- Add same-operation alias regression tests.
- Test both field orders so deny and allow cache pollution are detected.

## Regression Test

For each object-level field:

```text
1. Query denied object alone: must deny.
2. Query allowed object then denied object with aliases: denied object must deny.
3. Query denied object then allowed object with aliases: allowed object should still follow its own policy.
4. Repeat as unauthenticated, normal user, owner, and admin where applicable.
```

## Future Checklist Item

For GraphQL IDOR testing, always test multiple aliases of the same object-fetching field with different IDs in one operation, and run both allowed-first and denied-first field orders.

