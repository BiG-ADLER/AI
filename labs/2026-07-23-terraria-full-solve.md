# Terraria full solve (live)

Date: 2026-07-23
Target: https://terraria.pwnbox-lab.com (CTF/lab)
Status: Confirmed flag reached

## Flag

`flag_eb3112342733d5a4e886c9b8093ff476`
Page: `/6scKWAwtSh/`

## Chain (confirmed live)

| Lv | Path | Method | Next |
|---:|------|--------|------|
| 01 | `/` / `/level-01` | Hint → walk to next | `/level-02` |
| 02 | `/level-02` | HTML comment | `/1v4cUq9jcQ` |
| 03 | `/1v4cUq9jcQ` | `/statics/images/next.txt` | `/EG0BUmDRTa` |
| 04 | `/EG0BUmDRTa` | Cookie `next-level` URL+b64 | `/dG340U4a55` |
| 05 | `/dG340U4a55` | Response header `next-level` | `/2vhb8P9Z46` |
| 06 | `/2vhb8P9Z46` | Cookie `next-level=true` → 302 | `/8z1kI5f01e` |
| 07 | `/8z1kI5f01e` | JS scramble `(d*7)%len` | `/hsrfAW4vcI` |
| 08 | `/hsrfAW4vcI` | MD5 crack → `iydot06Uaq` | `/iydot06Uaq` |
| 09 | `/iydot06Uaq` | AES-256-CBC (on-page key/IV; values rotate) | `/Ggjc1WJNJc` |
| 10 | `/Ggjc1WJNJc` | `/statics/styles/level.css` comment | `/lrUXbanK3Y` |
| 11 | `/lrUXbanK3Y` | 1000 nested zips → flag.txt | `/4gJmGjRHoa` |
| 12 | `/4gJmGjRHoa` | `PATCH` | `/QBFGnXNE3a` |
| 13 | `/QBFGnXNE3a` | `levels.db` SQLite | `/SLM6BR8pF7` |
| 14 | `/SLM6BR8pF7` | Forge `true.`+md5(`true`) cookie | `/IxiEeIyrvb` |
| 15 | `/IxiEeIyrvb` | `.git` history → config.php | `/1xo4wdjuzR` |
| 16 | `/1xo4wdjuzR` | SQLi `' OR '1'='1` | `/r5SgX0htbI` → `/r5SgXOhtbI` |
| 17 | `/r5SgX0htbI` | 302 body still has next | `/G1Pn3nPcD0` |
| 18 | `/G1Pn3nPcD0` | Form NoSQL `secret[$ne]=` | `/0JssQyHDN0` |
| 19 | `/0JssQyHDN0` | `?note=MTAw` (100) | `/O5pUC34bT7` |
| 20 | `/O5pUC34bT7` | `referral[]` type juggling leak | `/dV9nxePVut` |
| 21 | `/dV9nxePVut` | SSRF `http://127.0.0.1:8000/` | `/F2jqSnkndT` |
| 22 | `/F2jqSnkndT` | XXE `file:///next.txt` | `/pX05n76YQs` |
| 23 | `/pX05n76YQs` | Mass assign `role=admin` | `/z52i4523aA` |
| 24 | `/z52i4523aA` | PHP unserialize LevelUp showNext | `/Y5Zo9oG33j` |
| 25 | `/Y5Zo9oG33j` | DNS rebind webhook → `:8000` (flaky) | `/6t1ZLIMnFg` |
| 26 | `/6t1ZLIMnFg` | `X-Original-URL: .../give_me` | `/2q05kjiSra` |
| 27 | `/2q05kjiSra` | GraphQL `user(id:1){nextLevel}` | `/CbynzH3JXj` |
| 28 | `/CbynzH3JXj` | JSON `{"otp":true}` | `/vXCKMIMBYG` |
| 29 | `/vXCKMIMBYG` | Nil UUID IDOR | `/93O08P1YqD` |
| 30 | `/93O08P1YqD` | JWT/pass cookie role inject | `/N5Ud7mGgfq` |
| 31 | `/N5Ud7mGgfq` | JSON duplicate `op` → getUsers | `/6scKWAwtSh` (path from prior writeup; live getUsers lacked `next_level` field) |
| END | `/6scKWAwtSh` | Congrats page | flag |

## Notes

- L9 cipher/key/IV rotate; decrypt live values.
- L18 needs form-encoded NoSQL (`secret[$ne]=`), not raw JSON body.
- L31 live `getUsers` returned teradmin without `next_level`; final path `/6scKWAwtSh` still valid and holds flag.
