# Login SQL Injection Auth Bypass Checklist

## Goal

Confirm whether a login form builds SQL from user input, then reduce the result to one reproducible authentication bypass.

Start with reflected-query analysis and comment termination before UNION or blind extraction.

## 1. Scope Confirmation

- Confirm the target is a lab, owned app, in-scope bug bounty target, or defensive review.
- Record the exact route, method, and time.
- Avoid copying live secrets, tokens, cookies, flags, or private URLs into reusable notes.

Record:

```text
Target:
Authorization basis:
Endpoint:
Date:
```

## 2. Map The Login Flow

Identify:

- form action and method
- field names for username/email and password
- whether login succeeds with known demo credentials
- whether failed login differs from successful login
- whether the response reflects SQL, errors, or role-specific content

Record:

```text
Endpoint:
Fields:
Known valid account:
Known privileged account:
Response differences:
SQL reflected: yes/no
```

## 3. Read The Reflected Query

If the app shows the executed SQL:

- copy the exact query shape
- identify quoted vs unquoted interpolation
- identify which field is inside a string literal
- note comment characters already visible in the output

Record:

```text
Reflected query:
Likely injectable field:
Quote character:
Comment support: yes/no/unknown
```

## 4. Test String Breakout

Test one character at a time on the most likely field:

```text
'
''
admin'
admin'--
admin'#
```

Expected signals:

```text
syntax error
changed reflected SQL
successful login without valid password
```

Record:

```text
Payload:
Field:
Response signal:
Confirmed / possible / false positive:
```

## 5. Confirm Privilege Change

Compare:

```text
known low-privilege login
auth-bypass login targeting privileged username
```

The bypass is confirmed only when privileged content or role changes appear.

Record:

```text
Control role/content:
Bypass role/content:
Protected content revealed:
Limitations:
```

## 6. Try Field Alternatives

If username injection fails, repeat the same breakout tests on:

- password
- email
- remember-me or hidden fields
- JSON login bodies

Record:

```text
Field tested:
Result:
```

## 7. Report Root Cause

Separate the issues:

```text
The login form concatenates user input into SQL string literals.
The root cause is missing parameter binding and escaping.
The impact is authentication bypass and access to privileged accounts/content.
```

## 8. Fix Checklist

- Use parameterized login queries.
- Verify passwords outside SQL or with a dedicated password API.
- Remove SQL reflection and database errors from login responses.
- Add negative tests for quotes, comments, and boolean payloads in all login fields.

## 9. Decision Checklist

- [ ] Login SQL interpolation is confirmed.
- [ ] Injectable field is identified.
- [ ] Comment or boolean bypass is reproduced.
- [ ] Privileged account or content access is confirmed.
- [ ] Reusable notes do not include live secrets, tokens, cookies, flags, or private URLs.
