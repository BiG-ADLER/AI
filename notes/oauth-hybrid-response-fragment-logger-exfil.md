# OAuth Hybrid Response + Fragment Logger Exfil

## Date

2026-07-10

## Target Type

OAuth login flows with admin/reviewer bots, hidden iframes, postMessage logging widgets, and authorization-code exchange backends

## Bug Class

OAuth response_type / redirect_uri parser confusion, fragment vs query handling mismatch, postMessage origin suffix bypass, cross-window secret exfiltration

## Initial Signal

Look for flows where:

- OAuth callback returns server-side redirect to `/error` when the code is missing from the query string
- error pages embed a hidden iframe and `postMessage` the full `window.location.href` elsewhere
- a `/logger` or debug widget exposes `{type:'get'}` to `window.opener`
- origin allowlists use prefix/suffix regex without `$`
- a reviewer bot has an IdP session and can be driven through `POST /report`
- profile/flag data requires a full app session, not just bearer token userinfo

## Pattern

### A. Fragment exfil without exchange

`redirect_uri=/callback#` sends the authorization code in the hash. The backend only reads query parameters, redirects to `/error?type=missing_code`, and the hash survives into the logged URL.

Stealing the code is easy. Exchanging it fails because the token endpoint expects `redirect_uri=/callback`, not `/callback#`.

### B. Hybrid response fixes exchange

`response_type=code token` with `redirect_uri=/callback` still delivers:

```text
/callback#code=...&access_token=...&state=...
```

So:

- exfiltration path: hash → error page → logger → attacker
- exchange path: code remains valid for `/callback` because that is the registered redirect URI

This splits parser behavior across browser fragment handling, logger storage, and server-side code exchange.

### C. Attacker-controlled OAuth state

If `state` is generated on `GET /` and stored in session, the attacker can:

1. create a session and read `state` from the HTML OAuth link
2. embed that `state` in the bot OAuth URL
3. steal the reviewer's code via logger
4. exchange the code on the attacker's pre-seeded session

The bot supplies Google identity (`prompt=none`). The attacker supplies app session/state.

## Example

```text
Attacker GET /
-> state=Sa, connect.sid=...

Bot opens:
  response_type=code token
  redirect_uri=https://app/callback
  prompt=none
  state=Sa

Bot lands:
  /callback#code=C&access_token=T&state=Sa
  -> /error?type=missing_code#code=C&access_token=T&state=Sa
  -> logger put(full href)

Attacker logger get -> steal C

Attacker GET /callback?code=C&state=Sa with saved cookie
-> /profile as privileged identity
```

## Why Failed Paths Failed

- `redirect_uri=callback#` + normal code exchange → `token_exchange_failed`
- stolen bearer token alone → userinfo works, app session/profile does not
- cross-origin `javascript:` popup navigation → blocked in modern HeadlessChrome
- query-string code theft from bot with `redirect_uri=/callback` → code not copied into logger; invalid_state leaves no code in error URL
- custom OAuth state in bot session without attacker preshot → `invalid_state`

## Common Mistake

Assuming hash-exfiltrated authorization codes from `callback#` can always be exchanged. Compare the redirect URI used at authorize time with the one used at token exchange time.

Also assuming hybrid flows are harmless because the backend "only supports code flow". Hybrid responses can still leak a valid code in the fragment.

## Defensive Fix

- Disallow hybrid/implicit response types unless explicitly required
- Compare redirect URIs exactly at authorize and token steps
- Never log callback URLs, fragments, or tokens in cross-window messaging channels
- Anchor origin regexes; use parsed origin equality
- Bind codes to PKCE and one-time state nonces
- Avoid `prompt=none` for privileged identities unless strictly necessary

## Drill

Given:

- `/callback` accepts query codes
- `/callback#` is registered
- `/error` logs `location.href` into `/logger`
- logger allowlist regex has no `$`

List three OAuth request variants and predict whether each supports both exfil and exchange.

## Checklist Update

See `checklists/oauth-postmessage-review-bot-recon.md`.
