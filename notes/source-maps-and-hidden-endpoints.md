# Source Maps And Hidden Endpoints

## Date

2026-06-06

## Target Type

Built JavaScript SPA, React/Vite-style bundle

## Bug Class

Information disclosure leading to endpoint discovery

## Initial Signal

The page loads a built JavaScript asset:

```text
/assets/index-[hash].js
```

If the matching source map is public:

```text
/assets/index-[hash].js.map
```

it may reveal original source file names and original source code.

## Pattern

The production `.js` file is the code the browser executes. The `.js.map` file is debug metadata that maps the built code back to original files.

Important fields:

- `sources`: original build-time file paths; these are labels, not public URLs.
- `sourcesContent`: optional embedded original source code.
- `mappings`: location map from generated code to original source.

## Failed Assumptions

Do not assume a path from `sources` is directly fetchable from the server:

```text
../../src/main.tsx
```

This usually will not open at:

```text
https://target/src/main.tsx
```

The source code may only exist inside `sourcesContent` in the map file.

Do not assume a `200` response means a route exists on an SPA. Many SPAs return fallback HTML for unknown paths. Confirm with content type and response body.

## Working Theory

Unused endpoint constants can disappear from the production bundle due to tree shaking, but still remain visible in source map `sourcesContent`.

Example:

```ts
export const USER_LOGS = '/api/users/logs'
```

If this constant is never imported by the app, it may be missing from the minified `.js` while still visible in the `.map`.

## Minimal Reproduction

1. Fetch the main HTML.
2. Identify bundled JavaScript assets.
3. Try the matching source map path.
4. Search `sourcesContent` for endpoint-like strings.
5. Request discovered endpoints directly.
6. Distinguish real JSON/API responses from SPA fallback HTML.
7. Test authorization using no cookie, normal user cookie, and privileged cookie if legitimately obtained.

## Why Working Test Worked

The source map exposed original source text, not just compiled code. The hidden route was a real backend route, not only a dead client constant.

## Fix

- Do not publish source maps for production unless there is an intentional access-control or monitoring reason.
- If source maps must exist, restrict access.
- Do not place sensitive endpoint names, comments, secrets, or operational hints in client source.
- Server-side authorization must protect every sensitive route even if the route is not used by the client UI.

## Future Checklist Item

For every JavaScript-heavy app, add a source map recon step before endpoint brute force:

```text
HTML -> JS assets -> source maps -> sourcesContent -> hidden endpoints -> real endpoint validation -> auth tests
```

## Recurring Lab Pattern

**Rolodex** (pwnbox Source Maps lab) has been confirmed on multiple instances with the same artifacts:

- public `/assets/index-DPm9vOq3.js.map`
- hidden `USER_LOGS = '/api/users/logs'` in `sourcesContent`
- unauthenticated token dump including `sable-admin`
- admin-only SVG at `/twleoknsdcsbu` referenced from CSS

See `writeups/rolodex-source-map-token-leak.md` and dated lab notes under `labs/`.
