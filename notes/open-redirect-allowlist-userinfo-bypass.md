# Open Redirect Allowlist Bypass With Userinfo

## Date

2026-07-08

## Target Type

Web application redirectors, link shorteners, OAuth return handlers, and admin/report bots

## Bug Class

Open redirect, URL parser confusion, allowlist bypass, sensitive redirect parameter leakage

## Initial Signal

An app redirects users through a parameter such as `to`, `url`, `next`, `redirect`, or `return`, and the UI or docs mention an allowed destination host:

- `allowed · example.com`
- only trusted domains
- route map
- send admin to a URL

There may also be a report/admin bot that only visits same-origin links.

## Working Theory

If validation checks only for substring presence of an allowed host, payloads like:

```text
https://allowed.example@attacker.com
https://allowed.example.attacker.com
https://attacker.com/allowed.example
```

may behave differently depending on which component validates the string and which component performs the redirect.

The most common useful bypass is userinfo confusion:

```text
https://allowed.example@evil.com
```

Validators that search for `allowed.example` pass, while browsers interpret `evil.com` as the host.

## Trust Boundary

Redirect targets must be restricted to an explicit set of safe destinations. Admin/report bots with privileged redirect side effects are a separate high-value boundary.

## Minimal Reproduction

1. Identify the redirect endpoint and parameter.
2. Confirm a normal external URL is blocked.
3. Test allowlist-host payloads with userinfo:
   ```text
   https://allowed.host@collaborator
   ```
4. Confirm a `302` Location header or client-side navigation reaches the attacker host.
5. If an admin bot exists, report a same-origin wrapper URL such as:
   ```text
   https://lab/go?to=https://allowed.host@collaborator
   ```
6. Inspect collaborator traffic for leaked query parameters, cookies, or tokens.

## Common Bypass Families

Userinfo confusion:

```text
https://allowed.example@attacker.com
https://allowed.example:443@attacker.com
```

Subdomain confusion:

```text
https://allowed.example.attacker.com
```

Path confusion:

```text
https://attacker.com/allowed.example
```

Encoding confusion:

```text
https://allowed.example%40attacker.com
https://allowed.example%2f@attacker.com
```

Fragment/query smuggling when appended paths exist:

```text
https://allowed.example@attacker.com#/
```

## Why Failed Tests May Fail

- Validator parses with `new URL()` and checks `hostname` correctly.
- Browser and server both reject userinfo for the target scheme.
- Admin bot does not follow external redirects.
- Redirect is only client-side and still blocked by runtime checks.
- Sensitive values are not appended for non-admin sessions.

## Why Working Test Works

A substring allowlist is not a URL security control. Once the attacker can make the application issue a redirect to an attacker host, any privileged data added to the outbound redirect URL is exposed in the request line, Referer chain, or collaborator logs.

## Impact

- Phishing and trusted-domain abuse.
- OAuth/token theft when redirects participate in auth flows.
- Forced navigation of admin/support bots.
- Leakage of secrets appended to redirect targets.

## Fix

- Parse and normalize URLs before validation.
- Allowlist exact hostnames or registered suffixes after parsing.
- Reject userinfo unless explicitly needed.
- Do not append secrets, flags, or session values to redirect URLs.
- Restrict admin bot destinations and log outbound redirect targets.

## Regression Test

- `https://allowed.example@attacker.com` is rejected.
- Encoded and subdomain bypasses are rejected.
- Admin/report flows do not leak sensitive query parameters.
- Normal approved destinations still redirect correctly.

## Future Checklist Item

When a redirector displays an allowed host, test `https://allowed@collaborator` before spending time on double-encoding or protocol smuggling.
