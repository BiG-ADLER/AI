# Terraria Level 29 — Nil UUID IDOR

Date: 2026-07-18
Target type: CTF/lab
Host: `https://terraria.pwnbox-lab.com/vXCKMIMBYG/`
Bug class: IDOR / hidden object access via Nil UUID

## Observation

Level hint: "Even nothing has an identity"

Listing shows three public docs with UUID v4 ids. Detail view is `?id=<uuid>`.

## Hypothesis

"Nothing" maps to the Nil UUID (`00000000-0000-0000-0000-000000000000`), a real identity in UUID space that often backs sentinel/hidden records.

## Evidence

```text
GET ?id=00000000-0000-0000-0000-000000000000
→ Internal Memo | /93O08P1YqD
```

Public ids only return `status: public`. Empty/`null` ids return "No item found."

## Conclusion

Confirmed: hidden memo is keyed by the Nil UUID; status field holds the next-level path.

## Next

`https://terraria.pwnbox-lab.com/93O08P1YqD/` → Level 30
