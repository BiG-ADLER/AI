# OAuth Referer Trust — Missing-Code Callback + Multi-Account Gate

## Date

2026-07-11 (confirmed solved 2026-07-12, instance `38b794f40a24`)

## Target Type

OAuth login flows where:

- `/callback` accepts authorization codes in the **Referer** header when `code=` is absent from the request URL
- OAuth `state` is session-bound server-side (multi-account / “gate” semantics)
- reviewer bot has a **different** Google IdP identity than the attacker
- privileged flag identity requires the **reviewer’s** authorization code, not the default user’s

Observed in: Solo Leveling Referer Gate (sl4) lab series.

## Bug Class

- Missing server-side validation of Referer on OAuth callback
- Open redirect via reflected Referer in `Location`
- Referer-as-input authorization code recovery (“Referer-only exchange”)
- Sec-Fetch-Dest–dependent callback rendering (document vs iframe)
- OAuth code exfiltration via Referer (portrait subresource or cross-origin navigation)

## Initial Signal

- Quest / copy mentions “Referer”, “multi-account gate”, “leak the reviewer’s authorization”
- Callback without `code=` behaves differently when `Referer` contains `callback?code=...`
- pwnu profile portrait uses `referrerpolicy="no-referrer"` — suggests another identity’s portrait may not
- Prior bot run loads hardcoded keeper paths: `/k/reviewer-avatar`, `/k/statue`, etc.

## Pattern

### A. Referer-only exchange primitive

Server trusts Referer when `code` is missing from the request line:

```http
GET /callback?state=<Sa>
Referer: https://app/callback?code=<stolen>&state=<Sa>
→ 302 Location: https://app/callback?code=<stolen>&state=<Sa>
```

Attacker with bound session cookie completes exchange without ever receiving the redirect from IdP:

```bash
curl -b attacker.sid -H "Referer: $APP/callback?code=$R&state=$Sa" -L "$APP/callback?state=$Sa"
```

**Confirmed for default-user codes → low-privilege profile.**  
**Hypothesis:** same primitive with reviewer code `R` → privileged profile (Statue of God).

### B. State bind (“preshot” state)

Unlike sl2’s `/init` + `tk` cookie, sl4 binds plain hex `state` when attacker is **logged in** and mints a fresh homepage OAuth link:

1. Login → `connect.sid`
2. `GET /` while logged in → unspent `Sa`
3. Send bot to OAuth URL embedding `Sa`
4. Do not consume `Sa` as attacker before bot completes

### C. Sec-Fetch-Dest split

Same `code` + bound `state` may:

- **document + anon:** redirect to `/profile` (consumes code on bot side — bad for theft)
- **iframe + anon + bound state:** error / conflict page (~400, “Invalid state parameter”) — code may remain in iframe URL
- **document + attacker cookies + bound state:** 400 invalid state

Design intent: force reviewer OAuth completion inside **iframe** so code stays in URL on conflict page.

### D. Exfil channels (priority order — confirmed on sl4)

1. **Hybrid OAuth + `window.open` + fragment leak (Voorivex non-happy path)** — **confirmed working**  
   Popup OAuth with `response_type=code+token` (or `code token`, `id_token,code`) + `prompt=none`. Non-happy callback client-redirects popup back to opener with `#code=R&access_token=...`. Exploit page beacons `location.hash` to OAST.  
   Reference: [Voorivex OAuth Non-Happy Path to ATO](https://blog.voorivex.team/oauth-non-happy-path-to-ato)

2. **Referer-only exchange (second half)** — **confirmed working**  
   After stealing `R`, attacker session: `GET /callback?state=Sa` + `Referer: .../callback?code=R&state=Sa` → follow redirect → privileged profile.

3. **Referer reflect + iframe `document.referrer` capture** — **failed on sl4**  
   Parent-initiated iframe nav keeps exploit-host Referer; cross-origin `w.location` to callback blocked.

4. **Multi-account portrait Referer leak** — **unconfirmed on sl4**  
   Keeper logs API does not expose Referer; portrait hits alone insufficient.

5. **Direct OAST Referer on iframe navigation** — **failed**  
   OAST saw exploit-host Referer only.

### E. Open redirect (secondary)

Forged Referer to arbitrary URL reflected in `Location` — useful for SSRF-style chains or delivering reflected URL to another primitive; not sufficient alone for flag.

## Trust Boundary Failures

| Boundary | Failure |
|----------|---------|
| Callback handler | Treats Referer as trusted storage for `code` |
| Multi-account gate | Same `state` shared across identities without isolating code exchange |
| Rendering split | iframe vs document changes whether code is consumed or displayed |
| Portrait markup | Missing `referrerpolicy="no-referrer"` on sensitive identity images |

## Common Mistakes

- Applying **sl1** DOMPurify `/error` + base64 JSON state — sl4 has no `/error` route and plain hex state
- Applying **sl2** `/auth` CSRF staged code — sl4 has no `/auth`; must steal real reviewer `code`
- Applying **sl3** hybrid `/logger` postMessage — no `/logger` on sl4; sl4 uses hybrid for **fragment exfil to opener**, not postMessage
- Using **`response_type=code` only** in popup — happy path consumes code; must use hybrid (`code+token`)
- **Manual `w.location = callback?state=Sa`** on cross-origin popup — blocked by browser; rely on non-happy path bounce to opener
- Using **top-level** OAuth report or iframe Referer chain when hybrid popup exfil works
- **Not following redirects** on first login → no `connect.sid` → Referer exchange fails
- Spending bound `Sa` on attacker OAuth before bot visit
- Expecting local `prompt=none` to mint reviewer codes — only bot IdP session has reviewer identity
- Polling keeper logs for Referer — API logs paths/UA, not Referer header
- Multiple `/report` submissions confusing bot or hitting rate limits

## Minimal Tests

```bash
APP='https://[app-host]'
IDP='https://[idp-host]'

# 1. Referer reflect
curl -sS -D - -o /dev/null \
  -H "Referer: ${APP}/callback?code=TESTCODE&state=TESTSTATE" \
  "${APP}/callback?state=TESTSTATE"
# Expect: Location: .../callback?code=TESTCODE&state=TESTSTATE

# 2. Open redirect
curl -sS -D - -o /dev/null \
  -H "Referer: https://example.com/evil?code=x" \
  "${APP}/callback"
# Expect: Location: https://example.com/evil?code=x

# 3. iframe vs document (with bound state + valid code)
curl -sS -D - -o /dev/null \
  -H "Sec-Fetch-Dest: iframe" \
  "${APP}/callback?code=[CODE]&state=[SA]"
# Compare to same request without Sec-Fetch-Dest header
```

## Fix

- Never recover OAuth parameters from Referer; require `code` in query or POST body only
- Bind `state` to initiating session **and** identity; reject cross-identity code reuse
- `Referrer-Policy: no-referrer` on all OAuth callback and error pages carrying secrets
- `referrerpolicy="no-referrer"` on all profile / conflict page subresources
- Single-use authorization codes; invalidate on first exchange attempt regardless of context
- Do not reflect Referer into `Location` (fix open redirect)

## Regression Test

1. Bind `state` as user A; complete OAuth as user B with same `state` in iframe.
2. Assert callback does not render attacker-controlled subresources with full Referer.
3. Assert `GET /callback?state=` without `code` never exchanges a code from Referer.
4. Assert Referer containing external URL is not reflected in redirects.

## Solo Leveling series map

| Lab | Mechanism |
|-----|-----------|
| sl1 HTMLi Gate | DOMPurify `referrerpolicy` in base64 `state.message` → Referer leak on `/error` |
| sl2 State Gate | OAuth CSRF; server-staged code; `GET /auth` |
| sl3 Origin Gate | Hybrid fragment + `/logger` postMessage |
| sl4 Referer Gate | Referer trust on missing-code `/callback` + multi-account state + iframe split |

## Drill

On a fresh sl4 instance:

1. Confirm Referer reflect with curl.
2. Confirm IdP hybrid: `response_type=code+token` → `#code=` in fragment.
3. Bind `Sa` as pwnu; host subkeeper with `window.open(hybrid_oauth)` + hash beacon.
4. Single `/report`; poll OAST ~60s for `#code=` in beacon.
5. Referer exchange with stolen code → Statue of God on `/profile`.

## Checklist update

See `checklists/oauth-referer-trust-missing-code-recon.md`.
