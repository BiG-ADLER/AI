# Solo Leveling: Origin Gate - OAuth + postMessage logger exfil

Date: 2026-07-10
Target type: CTF/lab
Bug class: OAuth redirect_uri / response_type confusion, postMessage origin regex bypass, cross-window data leak, reviewer bot abuse

## Observation

App: `https://solo-leveling-3-f8c7823797de.pwnbox-lab.com/`
Google IdP: `https://google-f8c7823797de.pwnbox-lab.com/`
Default creds: `pwnu` / `pwnp`

Routes: `/`, `/callback`, `/profile`, `/report`, `/logger`, `/error`

`/logger` listener:

```javascript
const allowedOriginPatterns = [
    new RegExp('^https:\\/\\/([a-zA-Z0-9-]+\\.)*solo-leveling-3-f8c7823797de\\.pwnbox-lab\\.com'),
    new RegExp('^http:\\/\\/localhost(:\\d+)?$')
];
// no $ anchor -> suffix bypass: ...pwnbox-lab.com.l30on.top
```

`/error` logs `window.location.href` (including hash) into logger via hidden iframe `postMessage({ type:'put', data: href })`.

OAuth:
- client_id: `solo-leveling-3-client`
- registered redirect_uri: `/callback` and `/callback#`
- state bound to session on `GET /`
- reviewer bot has Google IdP session; use `prompt=none`

## Hypothesis

1. Suffix origin bypass allows `{type:'get'}` against `/logger` from attacker host.
2. OAuth artifacts in URL hash reach logger through `/error`.
3. Attacker can pre-seed OAuth `state` and exchange stolen code on own session.
4. `redirect_uri=callback#` codes fail exchange (`token_exchange_failed`) due to redirect_uri mismatch.
5. Hybrid `response_type=code token` may put code in hash while issued for `/callback`.

## Evidence

Confirmed suffix bypass host: `https://solo-leveling-3-f8c7823797de.pwnbox-lab.com.l30on.top/`

Confirmed reviewer identity via stolen token userinfo: Statue of God / `statuegod@pwnbox.io`

Failed paths:
- `javascript:` navigation from cross-origin opener (HeadlessChrome blocks)
- direct exchange of `callback#` stolen codes (`token_exchange_failed`)
- bearer token on `/profile` without SL session
- Google client_secret bruteforce
- state fixation via URL params
- state correlated with connect.sid (random per `/` load)

Working hybrid flow locally and against bot:
- Pre-seed attacker session + `state` from `GET /`
- Bot OAuth: `response_type=code token`, `redirect_uri=/callback`, `prompt=none`, attacker `state`
- Redirect: `/callback#code=...&access_token=...&state=...`
- Server misses hash -> `/error?type=missing_code#...` -> logger stores full href
- OAST receives code via logger `get`
- Attacker `GET /callback?code=STOLEN&state=ATTACKER_STATE` with saved cookie -> profile as Statue of God

## Test

Exploit hosted on Subkeeper suffix host, reported via `POST /report`.

## Result

```text
exchange url https://solo-leveling-3-f8c7823797de.pwnbox-lab.com/profile
h1 Statue of God
FLAG pwnbox{b931c8f34e352c8bdd0f6f65b6ae2b21}
```

## Conclusion

Confirmed cross-window trust failure on `/logger` plus OAuth parser confusion. The hybrid response type exfiltrates an authorization code through the hash/logger channel while the code remains valid for server-side exchange against `/callback`.

## Fix

- Anchor origin regex (`$`) and compare parsed origins exactly
- Do not log OAuth URLs cross-window; treat logger as sensitive
- Reject hybrid/implicit flows if only code flow is intended
- Bind authorization codes to client + redirect_uri + PKCE
- Do not rely on `prompt=none` against active IdP sessions for privileged identities

## Flag

`pwnbox{b931c8f34e352c8bdd0f6f65b6ae2b21}`
