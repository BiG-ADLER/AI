# Session-Secured Endpoint IDOR Bypass

## Date

2026-07-08

## Target Type

Web applications that bind user identity to a signed session on some endpoints but still expose alternate lookup routes with numeric or UUID object references

## Bug Class

IDOR / broken access control through inconsistent authorization across endpoints

## Initial Signal

Look for flows where:

- the developer claims "the id is tied to the session"
- the primary profile endpoint uses `GET /api/me` or equivalent with no id parameter
- session cookies are signed and tamper-resistant
- other JavaScript files, OpenAPI docs, or comments reference endpoints like `/api/user/:id`, `/api/teamMemberInfo/:id`, `/api/profile?id=`
- dormant or feature-flagged widgets ship API helpers that are not invoked on the current page

Common examples:

```text
GET /api/me                 -> derives user from session
GET /api/users/123          -> accepts raw id
GET /api/teamMemberInfo/1   -> accepts raw id
```

## Pattern

The application correctly protects one trust boundary:

```javascript
fetch('/api/me', { credentials: 'same-origin' });
```

But a parallel code path still does:

```javascript
fetch('/api/teamMemberInfo/' + id, { credentials: 'same-origin' });
```

Authentication proves who you are. Authorization must still prove you may access the requested object. A valid session plus another user's id is a classic IDOR.

## Trust Boundary

Session integrity protects the identity claim. It does not automatically protect every endpoint that accepts a separate object identifier.

## Minimal Reproduction

1. Log in with a low-privilege account.
2. Confirm `/api/me` or equivalent returns only your own data.
3. Confirm session tampering fails on that route.
4. Recon JS bundles, HTML comments, and API docs for id-based lookups.
5. Replay the alternate endpoint with another user's id.

Generic proof:

```bash
curl -sS -b cookies.txt 'https://[host]/api/teamMemberInfo/1'
```

## Why Failed Tests Fail

- The alternate endpoint also derives the user from session and ignores the path id.
- The endpoint checks `session.uid === requested_id`.
- Sensitive fields are omitted for non-owner callers.
- The endpoint requires an admin role in addition to authentication.

## Why Working Tests Work

A second endpoint returns object-specific data based only on the supplied id, with authentication but without object-level authorization.

## Impact

- Read other users' emails, titles, internal notes, or secrets.
- Enumerate valid user ids through response differences (`200` vs `404`).
- Access admin-only fields when high-value ids are discoverable from UI hints.

## Fix

- Centralize authorization: every object lookup must verify ownership or role.
- Prefer session-derived identity over client-supplied ids where possible.
- Strip sensitive fields from generic lookup endpoints.
- Audit all routes with `:id`, `?userId=`, or similar parameters.

## Regression Test

For every authenticated endpoint that accepts an object id:

```text
user A session + user A id -> allowed
user A session + user B id -> denied
user A session + admin id -> denied unless admin
```

Unsigned or tampered sessions must still fail authentication.

## Future Checklist Item

When a lab or app says the id is session-tied, test that claim only on the endpoint mentioned — then immediately hunt for other endpoints that still accept raw ids in paths, query strings, or JSON bodies.
