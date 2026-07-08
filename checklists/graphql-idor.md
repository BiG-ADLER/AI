# GraphQL IDOR Checklist

## Goal

Find broken object-level authorization in GraphQL APIs, including alias/order-dependent authorization cache bugs.

## 1. Scope Confirmation

- Confirm the target is a lab, owned app, in-scope target, or defensive review.
- Record authorization basis and target host.
- Avoid copying real secrets, flags, cookies, tokens, or private URLs into reusable notes.

Record:

```text
Target:
Authorization basis:
Date:
```

## 2. Map GraphQL Surface

Identify:

- GraphQL endpoint path.
- Whether GET and POST behave differently.
- Whether introspection is enabled.
- Object-fetching queries with `id`, `uuid`, `slug`, `key`, or similar arguments.
- Mutations that update or delete objects by ID.

Record:

```text
Endpoint:
Query fields:
Mutation fields:
Object ID fields:
Auth header/cookie:
```

## 3. Establish Identities And Objects

Collect safe test objects:

- unauthenticated requester
- normal user
- owner user
- non-owner user
- public/readable object
- private/denied object

Record:

```text
Requester:
Allowed object:
Denied object:
Expected policy:
```

## 4. Baseline Direct Access

For each object-fetching field:

```graphql
query($id: ID!) {
  object(id: $id) {
    id
  }
}
```

Compare:

- allowed public object
- own private object
- another user's private object
- nonexistent object

Record:

```text
Direct allowed result:
Direct denied result:
Nonexistent result:
```

## 5. Test Alias Authorization Cache

Allowed object first:

```graphql
query($allowedId: ID!, $targetId: ID!) {
  allowed: object(id: $allowedId) {
    id
  }
  target: object(id: $targetId) {
    id
    sensitiveField
  }
}
```

Denied object first:

```graphql
query($allowedId: ID!, $targetId: ID!) {
  target: object(id: $targetId) {
    id
    sensitiveField
  }
  allowed: object(id: $allowedId) {
    id
  }
}
```

Record:

```text
Allowed-first result:
Denied-first result:
Order-dependent: yes/no
```

## 6. Test Mutations Separately

Do not assume query and mutation rules are the same.

For update/delete mutations:

- First use no-op or reversible changes where possible.
- Confirm denied object mutation alone is blocked.
- Test aliases only if mutation side effects are controlled and in scope.

Record:

```text
Mutation:
Object:
Expected owner:
Actual result:
Side effect:
```

## 7. Identify The Trust Boundary

Trace:

- identity source
- session source
- role source
- object ID argument
- ownership/visibility lookup
- authorization middleware
- resolver
- data-access layer

Record:

```text
Identity source:
Object identifier:
Ownership check location:
Authorization cache involved:
Missing or unsafe check:
```

## 8. Confirm Impact

For confirmed IDOR:

- Keep proof minimal.
- Show one denied direct request.
- Show one bypass request.
- Show sensitive field exposure or unauthorized state change.
- Redact secrets and flags from reusable notes.

Record:

```text
Data/action exposed:
Attacker:
Victim:
Preconditions:
Limitations:
```

## 9. Fix Checklist

- Enforce object-level authorization server-side.
- Disable authorization caching for argument-dependent rules.
- If caching remains, key by user identity, arguments, object ID, tenant, and relevant object state.
- Re-check ownership in resolvers or data-access functions.
- Add tests for direct access, aliases, allowed-first order, and denied-first order.
- Disable verbose production stack traces.

## 10. Decision Checklist

- [ ] Endpoint and schema are mapped.
- [ ] Direct denied access is confirmed.
- [ ] Allowed object and denied object are both known.
- [ ] Alias allowed-first order is tested.
- [ ] Alias denied-first order is tested.
- [ ] Query and mutation paths are considered separately.
- [ ] Confirmed behavior is separated from hypothesis.
- [ ] Reusable files contain no live secrets, flags, cookies, or tokens.

