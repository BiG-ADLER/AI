# Hidden Service Catalogue + Undocumented API Parameter IDOR

## Date

2026-07-10

## Target Type

Multi-tenant or multi-sub-app SPAs that load per-context **service catalogues** (JSON maps of backend proxy paths) and render widgets from those maps

## Bug Class

- Security through obscurity / incomplete service map exposure
- Undocumented query-parameter behavior (field-level disclosure)
- IDOR on object references discoverable via enumeration

## Initial Signal

Look for:

- Client fetches config from a templated path such as `/apiendpoints/{subApp}/serviceConfigs.json`
- Sub-app selection via URL suffix, hash, cookie, or header
- Dashboard/main app catalogue missing services that exist under another sub-app catalogue
- Bundle references config keys (`shieldapi.contactInformation`, `contactSubResource`) but not hardcoded hostnames — grep for service names fails
- Error messages that leak supported enum values (`supported: ["summary","email","phone"]`)
- UI widgets that call APIs with conservative/default parameters while richer types exist server-side

## Pattern

```text
Dashboard subApp  -> catalogue A (no contact service)
Aegis subApp      -> catalogue B (contact service + subResource)
Direct fetch of B -> attacker learns proxy paths without loading aegis UI
Catalogue lists path + subResource but NOT query params or response shapes
Widget uses type=summary; server type=phone adds sensitive fields (flag)
Backend accepts any application ARN for authenticated users (IDOR)
```

Authentication proves portal access. It does not prove access to every application record referenced by an ARN.

## Trust Boundary

The service catalogue is treated as an authorization boundary ("if it's not on the dashboard map, users won't find it"). Direct HTTP access to alternate catalogues and proxy paths bypasses that assumption.

## Minimal Reproduction

1. Log in with any valid portal account.
2. Fetch all plausible catalogues: `/apiendpoints/{name}/serviceConfigs.json` for `dashboard`, `aegis`, `admin`, etc.
3. Diff catalogues — note services present in one but not another.
4. Call discovered proxy paths with documented path segments from config.
5. Fuzz query parameters (`type`, `view`, `format`, `detail`) — use error messages for enum leaks.
6. Test IDOR by varying object ids (ARNs, quote refs) beyond the current user's `/me` value.

## Why Failed Tests Fail

- Only one catalogue exists (no hidden map).
- Proxy paths require role/sub-app context the low user lacks (403 on UI route but API may still work).
- Sensitive fields gated by server-side ownership check.
- Flag only populated for certain record states (draft vs finalised) — enumeration still needed.

## Why Working Tests Work

Alternate catalogue exposes backend paths. Undocumented `type=phone` (or similar) returns extra fields. Contact/read API binds to supplied ARN without verifying session user owns that application.

## Impact

- Read other customers' PII (name, email, phone).
- Extract internal flags/tokens from finalised records.
- Enumerate valid application ids via response differences (`200` + JSON vs `application reference not found`).

## Fix

- Treat all catalogues and proxy routes as part of the attack surface regardless of which UI loads them.
- Enforce object-level authorization on every proxy handler.
- Never return sensitive fields on customer-facing types; split internal/admin DTOs.
- Document allowed query params; reject unknown types without leaking full enum in production (or keep enum but enforce auth).
- Rate-limit id/ARN scanning; use non-sequential opaque ids.

## Regression Test

```text
User A session + User A ARN + type=phone -> allowed, no foreign flag
User A session + User B ARN + type=phone -> denied
Unauthenticated + any ARN -> denied
Dashboard catalogue user cannot infer paths only in aegis catalogue -> still blocked at proxy (authz), not obscurity
```

## Future Checklist Item

When a lab says "the bug is in what the catalogue doesn't tell you": diff sub-app catalogues, fuzz undocumented query params on discovered paths, and IDOR-enumerate object ids. UI hints (notifications naming other users / finalised applications) identify high-value enumeration targets.

## Recurring Lab Pattern

**Aegis Flex** (pwnbox): dashboard catalogue omits contact service; aegis catalogue at `/apiendpoints/aegis/serviceConfigs.json` exposes `shieldapi.contactInformation` + `contactSubResource`. `?type=phone` returns `flag`. Mira Patel ARN `1743465601904` (finalised) holds flag; Jordan Demo `1743465601777` (draft) returns `flag: null`. See `writeups/aegis-flex-hidden-service-catalogue-idor.md`.
