# OAuth postMessage Review Bot Recon Checklist

## Goal

Determine whether an OAuth login flow can leak authorization artifacts through a cross-window logger and whether a reviewer bot's IdP session can be bound to an attacker-controlled app session.

## 1. Scope Confirmation

- Confirm lab, owned app, in-scope target, or defensive review.
- Record app host, IdP host, report endpoint, and default credentials if any.
- Do not copy live flags, cookies, tokens, or private collector URLs into reusable notes.

Record:

```text
App host:
IdP host:
Review endpoint:
Date:
```

## 2. Map OAuth Surface

Identify:

- authorize URL and supported `response_type` values
- registered `redirect_uri` values
- callback handler behavior for query vs fragment
- profile/session requirements for flag or privileged data

Test redirect URI acceptance:

```text
/callback
/callback#
/callback?x=1
/attacker-host/callback
```

Test response types:

```text
code
token
code token
code id_token token
```

Record:

```text
Accepted redirect_uri values:
Hybrid response supported: yes/no
Callback query-only: yes/no
Fragment preserved to /error: yes/no
```

## 3. Find Cross-Window Logger Channels

Search for:

```text
addEventListener('message'
postMessage(
localStorage.setItem(
/logger
/error
iframe
```

Record:

```text
Logger endpoint:
Allowed origin check:
Stored data type:
Read primitive exposed to opener: yes/no
Error page logs location.href: yes/no
```

## 4. Test Origin Allowlist Bypass Families

Check whether allowlists are exact or regex-based.

Priority tests:

```text
https://trusted.example.attacker.tld
https://trusted.example@attacker.tld
https://trusted.example/...@attacker.tld
missing $ anchor on regex
```

From bypass origin, test:

```javascript
loggerWindow.postMessage({ type: 'get' }, '*');
loggerWindow.postMessage({ type: 'put', data: { type:'put', data:'probe' } }, '*');
```

Record:

```text
Bypass origin:
get works: yes/no
put works: yes/no
```

## 5. Test Fragment Exfil Path

Drive OAuth to callback with secrets in hash.

Variants:

```text
redirect_uri=/callback#
response_type=token
response_type=code token
```

Confirm whether final logged URL includes:

```text
code=
access_token=
state=
```

Record:

```text
Variant:
Logged secret fields:
```

## 6. Test Exchange Path Separately

With attacker-controlled session:

1. `GET /` and save `state` + session cookie
2. obtain a code through IdP
3. `GET /callback?code=...&state=...` with saved cookie

Record result:

```text
invalid_state
token_exchange_failed
/profile
/other
```

If hash-exfil works but exchange fails, compare authorize-time and exchange-time redirect URIs.

## 7. Test Attacker-Preshot State + Bot Identity

Check whether attacker can:

1. create app session and read OAuth `state`
2. send bot to OAuth URL embedding that `state`
3. use `prompt=none` against bot IdP session
4. steal code via logger
5. exchange on attacker session

Record:

```text
Attacker state reusable: yes/no
Bot identity privileged: yes/no
Exchange succeeds after theft: yes/no
```

## 8. Rule Out False Leads Early

- bearer token userinfo without app session
- cross-origin popup `javascript:` injection in modern headless browsers
- query-string code theft when callback immediately 302s to `/error` without logging code
- client_secret guessing unless source leak exists

## 9. Capture Minimal Proof

Preferred order:

1. logger read from bypass origin
2. stolen OAuth artifact in collector
3. successful exchange to privileged profile
4. flag or role proof

## 10. Fix Checklist

- anchor origin regexes and compare parsed origins exactly
- stop logging callback URLs or fragments cross-window
- disable hybrid/implicit OAuth if unnecessary
- enforce exact redirect_uri match at authorize and token endpoints
- use PKCE and one-time state
- treat reviewer bots with active IdP sessions as high-value OAuth victims

## Decision Checklist

- [ ] OAuth redirect_uri and response_type matrix tested.
- [ ] Logger/error cross-window channel mapped.
- [ ] Origin allowlist bypass tested.
- [ ] Fragment logging confirmed.
- [ ] Exchange result classified separately from exfil result.
- [ ] Attacker-preshot state flow tested.
- [ ] Minimal proof captured without live secrets in reusable notes.
