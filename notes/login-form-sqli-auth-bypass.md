# Login Form SQLi Auth Bypass With Comment Termination

## Date

2026-07-08

## Target Type

CTF/lab web application with form-based staff login

## Bug Class

SQL injection, authentication bypass

## Initial Signal

- A login form accepts `username` and `password`.
- Valid demo credentials work.
- A higher-privilege account exists but its password is unknown.
- The application reflects the executed SQL query after login attempts.

## Pattern

When login SQL is built like:

```sql
WHERE username = '<input>' AND password = '<input>'
```

a username payload such as:

```text
admin'--
```

can produce:

```sql
WHERE username = 'admin'--' AND password = 'anything'
```

The `--` comment removes the password check while keeping the username predicate intact.

## Failed Assumptions

Do not assume both fields must be injectable. Often only one field is enough if the other remains syntactically dead code after comment termination.

Do not skip basic comment payloads because the lab description mentions SQL injection. Reflected query text is strong evidence that string interpolation is in use.

Do not treat a failed `' OR '1'='1` attempt as proof that SQLi is absent. Different parsers, column counts, and comment requirements change which classic payloads work first.

## Working Theory

1. Identify whether the app reflects SQL.
2. Determine which field is easier to break out of a quoted string.
3. Close the string, inject the intended username, then comment out the rest.
4. Confirm privilege change through role-specific content in the response.

## Minimal Reproduction

1. Log in with known-good credentials and capture the reflected query.
2. Test one quote in `username` and observe whether SQL shape changes or errors appear.
3. Test `admin'--` in `username` with any password value.
4. Compare staff-only content against admin-only content.

## Why Working Test Worked

The username value was inserted directly between single quotes. The injected quote closed the literal, `admin` became the compared username value, and `--` commented out the password clause before the database evaluated it.

## Fix

- Use prepared statements for login lookups.
- Compare passwords outside SQL or with a dedicated password API.
- Remove SQL reflection from responses.
- Add tests for `'`, `"`, `--`, `#`, and stacked-query separators in both fields.

## Future Checklist Item

On login forms that echo SQL, test comment-based auth bypass on the username field before moving to UNION or blind extraction workflows.
