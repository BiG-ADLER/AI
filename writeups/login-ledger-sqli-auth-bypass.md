# Login Ledger SQL Injection Auth Bypass

## What Is Happening

The Login Ledger lab exposes a staff login form at `/login` with `username` and `password` fields. Valid demo credentials authenticate as a staff user and show limited ledger notes. The administrator account can see the final audit note, but the password is unknown.

After a normal login, the application reflects the executed SQL query in the HTML response.

## Why It Happens

The login handler builds SQL by concatenating user input into a string literal:

```sql
SELECT username, role, display_name AS displayName
FROM users
WHERE username = '<username>' AND password = '<password>'
```

Neither field is parameterized. A single quote in `username` can break out of the string literal and inject SQL syntax. A trailing SQL comment can remove the password check entirely.

## Exact Test

1. Confirm normal login behavior with the provided demo account.
2. Read the reflected query to learn the exact SQL shape.
3. Submit a username payload that closes the string and comments out the remainder:

```text
username=admin'--
password=x
```

Resulting query:

```sql
SELECT username, role, display_name AS displayName
FROM users
WHERE username = 'admin'--' AND password = 'x'
```

## Expected Signal

- Demo login succeeds and shows role `staff`.
- Reflected SQL confirms both fields are interpolated as quoted strings.
- The auth-bypass payload succeeds without knowing the admin password.
- The response shows role `admin` and additional ledger notes not visible to staff.

## Result Interpretation

The payload authenticated as the administrator by targeting the `username` field and commenting out the password predicate. The exact flag value is intentionally not stored in this writeup.

## Root Cause

The application trusts login form input as SQL syntax. There is no parameter binding, escaping, or type-safe lookup layer between the HTTP request and the database query.

## Impact

An unauthenticated attacker can bypass authentication and access the administrator account, including privileged ledger content.

## Fix

- Use parameterized queries or prepared statements for both fields.
- Prefer a constant-time password verification flow instead of embedding passwords in SQL.
- Do not reflect raw SQL queries to end users.
- Add regression tests proving quote and comment characters cannot alter query structure.

## Key Lesson

When a login form reflects the final SQL query, treat that as confirmation of string interpolation and test classic auth-bypass comment payloads on the username field before attempting noisier extraction techniques.
