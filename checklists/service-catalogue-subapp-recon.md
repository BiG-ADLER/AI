# Service Catalogue / Sub-App Recon Checklist

## Goal

Find sensitive backend paths omitted from the primary UI catalogue, undocumented query parameters that expand response fields, and IDOR on object references exposed by discovered proxies.

## 1. Scope Confirmation

- Confirm lab, owned app, in-scope target, or defensive review.
- Record host, login method, and date.
- Do not copy live flags, tokens, cookies, or private URLs into reusable notes.

Record:

```text
Target:
Primary UI route:
Login:
Date:
```

## 2. Map Sub-App Selection

Identify how the client chooses which service catalogue to load:

- URL path suffix (`/aegis/pib#/`, `/aegis/flexi#/`)
- hash routes
- cookies or headers
- build-time constants

Search bundle for:

```text
serviceConfigs.json
apiendpoints/
subApp
contactSubResource
shieldapi
```

Record:

```text
Catalogue URL pattern:
Sub-app values observed:
Hardcoded service hostnames in bundle: yes/no
```

## 3. Enumerate Catalogues

Fetch candidate maps directly (do not rely on UI alone):

```text
/apiendpoints/dashboard/serviceConfigs.json
/apiendpoints/aegis/serviceConfigs.json
/apiendpoints/{guess}/serviceConfigs.json
```

Diff keys and `serviceUrl` sections between catalogues.

Record:

```text
Catalogue A services:
Catalogue B services (not in A):
contactSubResource present: yes/no
```

## 4. Call Discovered Proxy Paths

For each new path in alternate catalogues:

- construct URL from config keys + session user's object id (`/api/v1/user/me`)
- test GET with documented sub-resources from config
- note which config keys are unused by current UI widgets

Record:

```text
Proxy path:
Config key:
Used by UI: yes/no
Auth required: yes/no
```

## 5. Fuzz Undocumented Query Parameters

On read endpoints, probe:

```text
type, view, format, detail, scope, include, fields, role
```

Use invalid values to harvest `supported` arrays from error JSON.

Record:

```text
Parameter:
Valid values:
Extra fields in response:
Sensitive field names:
```

## 6. Test Object-Reference IDOR

Vary object ids beyond the current user:

- ARN / quote ref from `/me`
- sequential or timestamp-shaped ids
- ids hinted in notifications or announcements (other users, "finalised" apps)

Record:

```text
Own id + type=phone:
Foreign id + type=phone:
Flag/null pattern:
Enumeration range if needed:
```

## 7. Correlate UI Hints

Check notifications, announcements, policy lists for:

- other user names
- application states (draft vs finalised)
- numeric references not linked in UI

Record:

```text
Hint source:
Target user/state:
ARN discovered:
```

## 8. Minimal Proof

Prefer one request showing:

- hidden catalogue path used
- undocumented param (`type=phone`) changing response shape
- foreign user's sensitive field or lab flag

## 9. Fix Checklist

- Authorize every proxy route regardless of catalogue visibility.
- Split internal vs external response DTOs; omit flags from customer types.
- Do not rely on omitting services from one sub-app map.
- Rate-limit object id enumeration.

## Decision Checklist

- [ ] Sub-app catalogue URL pattern identified.
- [ ] All plausible `/apiendpoints/{subApp}/` catalogues fetched and diffed.
- [ ] Proxy paths from alternate catalogues called directly.
- [ ] Query params fuzzed; error enums captured.
- [ ] IDOR tested on object ids (own vs foreign).
- [ ] UI hints mapped to enumeration targets.
- [ ] Root cause documented (obscurity + param disclosure + IDOR).
- [ ] Reusable notes exclude live secrets.
