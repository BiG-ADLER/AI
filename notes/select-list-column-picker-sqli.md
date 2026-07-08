# SELECT-List SQLi In Column Pickers

## Date

2026-07-08

## Target Type

Web application dashboards with configurable columns, views, reports, or field selectors

## Bug Class

SQL injection in SELECT list / expression context, weak allowlist bypass, cross-table data exfiltration

## Initial Signal

An internal dashboard lets users choose which columns to show:

- preset column views
- custom column expression input
- "pick fields to surface"
- report builder / table view selector
- API parameter such as `view`, `fields`, `columns`, `select`

Normal use returns expected table rows. The lab or app copy mentions hidden audit/admin tables outside the visible schema.

## Working Theory

If user input is inserted into the SELECT clause rather than a bound value or fixed identifier list, attacker-controlled expressions may include:

- scalar subqueries
- function calls
- CASE expressions
- concatenated expressions

A validator that only checks for presence of allowed column names may still permit:

```sql
name, (SELECT value FROM secrets WHERE label='flag') as flag
```

## Trust Boundary

Column/view selectors are user-controlled query shape input. They must map to a fixed set of known-safe identifiers, never to arbitrary SQL expressions.

## Minimal Reproduction

1. Submit a normal allowed view such as `name, price`.
2. Break syntax with a quote or parenthesis and inspect the error for query shape.
3. Inject a harmless scalar subquery:

```sql
name, (SELECT 1) as x
```

4. Enumerate hidden tables/functions appropriate to the DBMS.
5. Exfiltrate target rows through the subquery alias.

## Common Query Shapes

```sql
SELECT id, {view} FROM items ...
SELECT {view} FROM reports ...
SELECT id, name, {extra_columns} FROM inventory ...
```

Error clues:

```text
' FROM items ORDER BY id
near "{input}": syntax error
unrecognized token
```

## DBMS Enumeration Patterns

SQLite:

```sql
(SELECT group_concat(name) FROM sqlite_master WHERE type='table') as t
(SELECT sql FROM sqlite_master WHERE name='secrets') as ddl
```

MySQL:

```sql
(SELECT group_concat(table_name) FROM information_schema.tables WHERE table_schema=database()) as t
```

PostgreSQL:

```sql
(SELECT string_agg(tablename, ',') FROM pg_tables WHERE schemaname='public') as t
```

## Why Failed Tests May Fail

- Input is only used in `ORDER BY`, which may still be injectable but with different payloads.
- Validation rejects subqueries but allows stacked queries elsewhere.
- Hidden data is in another database/schema and current DB user cannot read it.
- Output is truncated, aggregated incorrectly, or filtered after query execution.
- Direct `FROM hidden_table` injection is blocked, but expression subqueries still work.

## Why Working Test Works

Expression-context injection turns each returned row into a carrier for attacker-chosen scalar subquery output. Even read-only inventory endpoints can disclose audit or secret tables if they share a database connection.

## Impact

- Disclosure of hidden tables and secret columns.
- Bypass of UI-level schema separation.
- Source for usernames, tokens, signing keys, or flags stored outside the primary table.
- Possible escalation if write-capable SQL functions or stacked queries are available.

## Fix

- Replace free-form expressions with a fixed allowlist of column names.
- Use query builders that treat columns as identifiers, not raw SQL fragments.
- Split sensitive audit data into separate databases or restrict DB user permissions.
- Validate server-side with exact string matches, not substring checks for allowed column names.
- Add tests for commas, parentheses, `SELECT`, and function calls in view parameters.

## Regression Test

- Custom view input accepts only exact allowed tokens like `name, price`.
- Subquery payloads are rejected or sanitized with no hidden-table data in responses.
- DB user for inventory reads cannot select from audit/secret tables.
- Error messages do not reveal full query structure in production.

## Future Checklist Item

Any time an app exposes a "custom column" or "view expression" field, test `name, (SELECT 1) as x` before UNION- or auth-focused payloads.
