# Terraria — Final Level (N5Ud7mGgfq) directory listing

Date: 2026-07-18
Target type: CTF/lab
Host: `https://terraria.pwnbox-lab.com/N5Ud7mGgfq/`
Bug class: Information disclosure / directory listing

## Observation

Page title "Final Level"; body only says `FINAL LEVEL`. Background image `/statics/images/MK1zQu.jpg`. No forms, no query params change the body.

## Hypothesis

"Final" is misdirection; challenge overview emphasizes attention to details. Image path implies `/statics/images/` may list.

## Evidence

```text
GET /statics/images/
→ Index of /statics/images (Apache directory listing)
→ next.txt among image assets

GET /statics/images/next.txt
→ Bravo! Next level: /EG0BUmDRTa
```

## Conclusion

Confirmed: next path is disclosed via open directory listing + `next.txt`, not stego in the Moon Lord image.

## Next

`https://terraria.pwnbox-lab.com/EG0BUmDRTa/` → Level 04
Hint: "The messenger is carrying more than he told you."
