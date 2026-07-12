# OAuth Referer Trust — Missing-Code Callback Recon Checklist

## Goal

Determine whether an OAuth callback leaks or accepts authorization codes via the Referer header, whether multi-account state binding enables cross-identity takeover, and whether a reviewer bot’s privileged IdP session can be exploited through iframe vs document rendering differences.

## 1. Scope Confirmation

- Confirm lab, owned app, in-scope target, or defensive review.
- Record app host, IdP host, `client_id`, report endpoint, default credentials.
- Do not copy live flags, cookies, tokens, or private collector URLs into reusable notes.

```text
App host:
IdP host:
client_id:
Report endpoint:
Date:
```

## 2. Map OAuth Surface

Routes to enumerate:

```text
/  /profile  /callback  /report  /logout
/auth  /init  /error  /logger   (sl4: absent)
```

Record OAuth `state` format:

```text
Plain hex / UUID:
Base64 JSON (sl1-style):
Cookie binding (tk, connect.sid):
```

Test redirect URI matrix:

```text
/callback
/callback?x=1
/attacker-host/callback
```

Test response types:

```text
code
code token / code+token
code id_token
id_token,code
```

Record whether IdP returns `#code=` in fragment (hybrid) vs query string (plain code).

## 3b. Test Hybrid Fragment (Voorivex signal)

```bash
curl -sS -D - -o /dev/null \
  "${IDP}/o/oauth2/v2/auth?client_id=...&redirect_uri=...&response_type=code+token&scope=openid%20email%20profile&prompt=none&state=TEST"
```

```text
Hybrid returns #code= in Location: yes/no
Non-happy callback bounces popup to opener: yes/no (browser test)
```

## 3. Test Missing-Code Referer Trust

With and without session cookie:

```bash
curl -sS -D - -o /dev/null \
  -H "Referer: ${APP}/callback?code=PROBE&state=PROBESTATE" \
  "${APP}/callback?state=PROBESTATE"

curl -sS -D - -o /dev/null \
  -H "Referer: https://example.com/x?code=PROBE" \
  "${APP}/callback"
```

Record:

```text
Referer echoed in Location: yes/no
Open redirect via Referer: yes/no
Exchange completes with Referer only: yes/no
```

## 4. Test Referer-Only Exchange

1. Login; save session cookie (follow redirects on first OAuth).
2. Bind fresh `state` from logged-in homepage.
3. Mint a known code (manual IdP login or `prompt=none`).
4. Exchange using Referer header only (no `code` in request URL).

```text
Exchange result identity:
Flag / privileged role: yes/no
```

## 5. Test Sec-Fetch-Dest Split

With bound `state` and valid `code`:

```bash
# document (default)
curl -sS -D - "${APP}/callback?code=...&state=..."

# iframe
curl -sS -D - -H "Sec-Fetch-Dest: iframe" \
  "${APP}/callback?code=...&state=..."
```

Record for each: status, redirect target, body length, images present, keeper URLs in HTML.

```text
document + anon:
iframe + anon:
document + attacker cookie:
iframe + attacker cookie:
```

## 6. Test Portrait / Subresource Referer Policy

On profile and callback error/conflict pages:

```text
referrerpolicy="no-referrer" present: yes/no
External portrait hosts (l30on.top/k/...): yes/no
```

If keeper paths appear, poll keeper logs after bot report for HeadlessChrome — confirms page render, not Referer content.

## 7. Test Attacker Bind + Bot Identity Flow

1. Login as low-privilege user; bind `Sa` (do not spend).
2. Build `prompt=none` OAuth URL with `Sa`.
3. Report **once** via bot endpoint.
4. Exfil options (try in order on sl4):
   - **hybrid `window.open` + hash OAST beacon** (confirmed)
   - iframe oauth → `callback?state=Sa` → subkeeper `document.referrer` capture
   - direct plain `code` OAuth URL report + OAST poll
   - top-level `<img referrerpolicy="unsafe-url">` + iframe oauth

Poll OAST for `#code=` or `code=` in beacon `d=` param for ~60–120s.

**Do not:** manually navigate cross-origin popup to callback; do not spam `callback?state=Sa` polling.

```text
Bot visited exploit: yes/no
Keeper portrait hits: yes/no
code captured: yes/no
Referer exchange → privileged profile: yes/no
```

## 8. Rule Out Sibling Lab Patterns Early

| Signal | Try first |
|--------|-----------|
| `/auth` + `/init` + `tk` cookie | sl2 OAuth CSRF — no Referer exfil needed |
| base64 JSON `state.message` + `/error` + DOMPurify | sl1 Referer via HTMLi |
| `/logger` + hybrid fragment | sl3 postMessage exfil |
| none of above + Referer reflect on `/callback` | sl4: hybrid popup exfil + Referer exchange |

## 9. Capture Minimal Proof

Preferred order:

1. Referer reflect curl proof
2. Referer-only exchange to any identity
3. Stolen reviewer code in OAST/capture beacon
4. Referer exchange to privileged profile + flag

## 10. Fix Checklist

- ignore Referer for OAuth credential recovery
- never reflect Referer into redirects
- `Referrer-Policy: no-referrer` on callback/conflict pages
- `referrerpolicy="no-referrer"` on all OAuth-flow images
- bind state to session + identity; PKCE; single-use codes
- uniform callback behavior regardless of Sec-Fetch-Dest

## Decision Checklist

- [ ] Routes mapped; sibling lab patterns ruled out.
- [ ] Missing-code Referer trust tested.
- [ ] Open redirect via Referer tested.
- [ ] Referer-only exchange tested with known code.
- [ ] Sec-Fetch-Dest matrix recorded.
- [ ] Portrait Referer policy inspected.
- [ ] State bind + single bot report + exfil attempted.
- [ ] No live secrets stored in reusable KB files.
