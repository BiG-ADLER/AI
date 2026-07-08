# PostgreSQL Dollar-Quoted Strings As SQLi Token Boundaries

## Date

2026-06-08

## Target Type

CTF/lab web application with PostgreSQL-backed article routing

## Bug Class

SQL injection, filter bypass, authorization condition bypass

## Initial Signal

The route accepted arithmetic expressions where an integer ID should have been required:

```text
/article/2-id -> article 1
```

That signal means the input is reaching SQL as expression syntax, not as a bound integer parameter.

## Pattern

When a PostgreSQL injection point blocks spaces and single quotes but allows letters, digits, `$`, and arithmetic operators, dollar-quoted strings may create token boundaries:

```text
$a$0$a$
```

This is a PostgreSQL string literal. It can separate keywords from values without needing a normal quote character.

`NOTNULL` is PostgreSQL syntax equivalent to an `IS NOT NULL` style test and can avoid space requirements in restricted payload contexts.

## Failed Assumptions

Do not assume that blocking spaces prevents SQL keyword injection.

Do not assume that blocking single quotes prevents string literals in PostgreSQL.

Do not assume that comments alone can bypass an earlier authorization condition:

```sql
published = true AND id = 6--
```

still requires `published = true`.

## Working Theory

If the original query is:

```sql
WHERE published = true AND id = <input>
```

then an injected `OR` after the ID expression can bypass the publish filter:

```sql
(published = true AND id = '0') OR (<always true expression>)
```

## Minimal Reproduction

1. Confirm expression evaluation with arithmetic:

```text
/article/2-id
```

2. Confirm the authorization filter blocks direct hidden IDs:

```text
/article/[hidden-id]
```

3. Confirm PostgreSQL type leakage if safely available:

```text
/article/published
```

4. Test a dollar-quote token-boundary bypass:

```text
/article/%24a%240%24a%24OR-0-%24b%240%24b%24NOTNULL--
```

5. Compare response content against the direct hidden ID request.

## Why Working Test Worked

The payload uses PostgreSQL grammar features instead of generic SQL punctuation:

- `$a$0$a$` creates a string literal without single quotes.
- `OR` starts a new boolean branch.
- `$b$0$b$` creates a second string literal.
- `NOTNULL` creates a nullness check without spaces.
- `--` comments the remainder if comments are allowed in that specific route.

## Fix

- Bind ID values as parameters.
- Parse and validate the ID as an integer before querying.
- Keep authorization filters in the SQL query, but do not rely on string concatenation to enforce them.
- Hide database error messages from end users.

## Future Checklist Item

For PostgreSQL injection points with tight allowlists, test database-specific literal forms and keyword aliases before concluding separators are impossible.
