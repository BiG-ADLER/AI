# SQL Injection Filter Bypass Checklist

## Goal

Confirm whether a restricted input still reaches SQL as executable syntax, then reduce the result to one reproducible proof.

Do not start with payload spam. First identify the expression context and parser behavior.

## 1. Scope Confirmation

- Confirm the target is a lab, owned app, in-scope bug bounty target, or defensive review.
- Record the exact route, parameter, method, and time.
- Avoid copying live secrets, tokens, cookies, flags, or private URLs into reusable notes.

Record:

```text
Target:
Authorization basis:
Endpoint:
Parameter:
Date:
```

## 2. Map The Query Context

Find whether input is used as:

- numeric expression
- string literal
- identifier / column name
- `ORDER BY`
- `LIMIT` / `OFFSET`
- boolean condition
- JSON/path expression

Record:

```text
Input:
Observed normal response:
Observed error response:
Likely SQL context:
Unknowns:
```

## 3. Test Expression Evaluation

For numeric-looking IDs, prefer arithmetic probes over destructive or noisy payloads:

```text
2-id
4-id
3-id-id
```

Expected signal:

```text
Input expression maps to a different valid row.
```

Record:

```text
Payload:
Expected row:
Actual row:
Confirmed / possible / false positive:
```

## 4. Identify Security Filters

Trace the filter being bypassed:

- publish status
- ownership
- tenant ID
- role
- deleted/archived flag
- date/window condition

Record:

```text
Security condition:
Direct unauthorized object request:
Status:
Body signal:
```

## 5. Learn The Character Allowlist

Test one class at a time:

- letters
- digits
- spaces
- tabs/newlines
- quotes
- comments
- arithmetic operators
- encoded separators
- database-specific literal syntax

Record:

```text
Allowed:
Rejected:
Decoded before validation: yes/no/unknown
Error type:
```

## 6. Use Database-Specific Token Boundaries

For PostgreSQL, check:

- dollar-quoted strings: `$a$0$a$`
- keyword variants: `NOTNULL`
- operator behavior without spaces
- cast/operator errors that reveal column types

For other databases, use the equivalent grammar-specific feature only after confirming the backend.

Record:

```text
Database evidence:
Token boundary candidate:
Why it should parse:
Expected boolean result:
```

## 7. Confirm Bypass With Controls

Always compare:

```text
Direct hidden object request
Expression-only arithmetic request
Bypass payload request
```

The bypass is confirmed only when the response crosses the protected boundary.

Record:

```text
Control result:
Bypass result:
Protected content revealed:
Limitations:
```

## 8. Report Root Cause

Separate the issues:

```text
The allowlist failed because it did not enforce type.
The root cause is SQL string interpolation instead of parameter binding.
The impact is protected content disclosure through a server-side filter bypass.
```

## 9. Fix Checklist

- Parse values into the intended type before the SQL layer.
- Use parameterized SQL.
- Keep authorization predicates server-side.
- Add negative tests for SQL expressions, keywords, comments, and database-specific string literal forms.
- Hide database errors from end users.

## 10. Decision Checklist

- [ ] SQL expression evaluation is confirmed.
- [ ] Query context is identified.
- [ ] Security condition is identified.
- [ ] Character allowlist is mapped.
- [ ] Database-specific syntax is justified by evidence.
- [ ] Bypass response reveals protected content.
- [ ] Reusable notes do not include live secrets, tokens, cookies, flags, or private URLs.
