# Session-Secured Endpoint IDOR Recon Checklist

## Goal

Determine whether an application secures user identity on one endpoint while leaving alternate id-based lookup routes vulnerable to IDOR.

## 1. Scope Confirmation

- Confirm lab, owned app, in-scope target, or defensive review.
- Record host, endpoints, and date.
- Do not copy live flags, tokens, cookies, or private URLs into reusable notes.

Record:

```text
Target:
Claim about session/id binding:
Login endpoint:
Primary profile endpoint:
Date:
```

## 2. Map Authentication State

Identify:

- login method and response shape
- session cookie names and whether signatures exist
- decoded session fields such as `uid`, `userId`, `sub`

Record:

```text
Login method:
Session cookie:
Decoded identity claim:
Signature cookie present: yes/no
```

## 3. Test The Primary Profile Route

Use the normal authenticated session on the main "me" endpoint.

Record:

```text
Endpoint:
Id parameter accepted: yes/no
Response fields:
Sensitive fields present: yes/no
```

## 4. Confirm Session Tamper Resistance

Mutate the session identity claim with an invalid or missing signature.

Record:

```text
Tampered session:
/api/me status:
Authentication bypassed: yes/no
```

## 5. Hunt Alternate Object-Reference Endpoints

Search:

- all loaded and unloaded JavaScript bundles
- matching `.js.map` / `sourcesContent` when the UI ships a single minified bundle
- `team.js`, `admin.js`, `adminInfo.js`, `directory.js`, feature-flagged widgets
- OpenAPI/Swagger, GraphQL schema, HTML comments, announcement metadata
- paths/queries containing `:id`, `userId`, `memberId`, `accountId`, `principal`, `uid`

Record:

```text
Alternate endpoint:
Parameter location:
Documented sensitive fields:
Invoked by current page: yes/no
Discovered via: separate JS / source map / docs
```

## 6. Enumerate Object Ids

Use UI hints such as `(#1, admin)`, usernames, or sequential integers.

Test one id at a time:

```text
id=1
id=2
id=self
id=admin
```

Record:

```text
Requested id:
Status:
Fields returned:
Ownership check present: yes/no
```

## 7. Compare Endpoint Behavior

Document differences clearly:

```text
/api/me -> session-derived only
/api/.../:id -> accepts arbitrary id
Sensitive field exposure:
```

## 8. Minimal Proof

Prefer one read-only request showing access to another user's data.

Examples:

- another user's email or secret field
- admin profile by numeric id
- lab flag in a non-owner response

## 9. Fix Checklist

- Apply object-level authorization on every id-based route.
- Remove or gate dormant endpoints.
- Omit sensitive fields unless caller is owner or authorized role.
- Add regression tests for all object-reference APIs.

## Decision Checklist

- [ ] Login and session format mapped.
- [ ] Primary profile route tested.
- [ ] Session tampering ruled out or confirmed.
- [ ] JavaScript and docs scanned for alternate id routes.
- [ ] If only a minified bundle ships, `.js.map` / `sourcesContent` checked.
- [ ] Odd param names (`principal`, etc.) tested, not only `id`.
- [ ] At least one foreign id tested (prefer UI hints like `#1, admin`).
- [ ] IDOR confirmed or ruled out.
- [ ] Root cause documented as inconsistent authorization.
- [ ] Reusable notes exclude live secrets.
