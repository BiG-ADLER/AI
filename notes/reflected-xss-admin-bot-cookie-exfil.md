# Reflected XSS With Admin Bot Cookie Exfil

## Date

2026-07-08

## Target Type

Web applications with reflected user input and an admin/support bot that visits reported URLs

## Bug Class

Reflected XSS, bot abuse, session/secret cookie disclosure

## Initial Signal

An app repeats, previews, or mirrors user input and also exposes a feature such as:

- send to admin
- report URL
- request review
- share with moderator
- trigger support preview

Lab copy may mention that an admin "enjoys repetition" or will visit submitted links.

## Working Theory

If reflected input reaches HTML without encoding, the attacker can craft a same-origin URL containing XSS. Reporting that URL to the bot makes the payload execute in the victim browser. If sensitive cookies are not `HttpOnly`, `document.cookie` may contain flags, sessions, or admin tokens.

## Trust Boundary

Reflected user content must never become active HTML in another user's browser. Bot browsers with privileged cookies are especially sensitive because they combine XSS execution with high-value session state.

## Minimal Reproduction

1. Find the reflected parameter or field.
2. Confirm HTML tags render unencoded.
3. Identify the bot/report endpoint and its URL allowlist.
4. Craft a same-origin XSS URL.
5. Exfiltrate cookies or fetch admin-only content to an attacker webhook.
6. Submit the malicious URL through the report form/API.

Example reflection test:

```bash
curl -sS -G "https://[host]/" --data-urlencode "q=<img src=x onerror=alert(1)>"
```

Example bot submission:

```bash
curl -sS -X POST "https://[host]/api/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://[host]/?q=<script>...</script>"}'
```

## Common Reflection Contexts

- search boxes
- error messages
- "transcription" or "preview" fields
- nickname/display name previews
- URL unfurl previews
- markdown/HTML preview panes

## Why Failed Tests May Fail

- Output is HTML-encoded or rendered with `textContent`.
- Bot only visits paths on an allowlist narrower than same-origin.
- Sensitive cookies are `HttpOnly`, forcing fetch-based exfil of admin-only pages instead.
- Strong CSP blocks inline script and external script gadgets.
- Bot uses an isolated session without privileged cookies.

## Why Working Test Works

The bot loads attacker HTML in a real browser session. Reflected tags or event handlers execute immediately. If the flag or session is stored in a readable cookie, exfiltration is one JavaScript line.

## Impact

- Flag or session theft from bot/admin context.
- Access to admin-only pages via in-browser fetch/XHR.
- Potential account takeover if stolen cookies are replayable.
- Broader internal action if the bot session can mutate state.

## Fix

- Context-aware output encoding for all reflected fields.
- `HttpOnly`, `Secure`, and suitable `SameSite` cookie flags.
- Do not browse user-controlled pages with privileged bot cookies.
- Use dedicated sandbox domains or stripped-down bot sessions.
- Add CSP and regression tests for reflected parameters.

## Regression Test

- Reflected `<`, `>`, quotes, and tag names render safely.
- Bot/report endpoints reject or sandbox untrusted URLs.
- Sensitive cookies are not exposed to `document.cookie`.
- Reported XSS URLs do not execute in admin/support bot sessions.

## Future Checklist Item

When a feature sends a URL to an admin bot and another feature repeats user input, test reflected XSS and cookie exfil before blind XSS or complex CSP bypass work.
