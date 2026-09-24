---
name: research-nextjs-ch3-boundaries
description: Banked primary-source research for Next.js devbible chapter 3 (server/client boundary) — the COMPILER SOURCE enforcing the boundary and its verbatim error strings, React 19.2 stability settled by T1 probe, useEffectEvent and Activity caveats, package-bundling and Web Vitals. Fetched 2026-09-04; do not re-fetch.
metadata:
  type: reference
---

# Next.js chapter 3 — banked research, 2026-09-04

Surfaced by the `devbible-author` agent while writing ch3 pages 04/04b/05/05b/06/06b.
**Do not re-fetch any of this.**

## 🔴 The compiler source is better evidence than the prose docs

`crates/next-custom-transforms/src/transforms/react_server_components.rs`, branch `canary`,
read 2026-09-04 —
https://github.com/vercel/next.js/blob/canary/crates/next-custom-transforms/src/transforms/react_server_components.rs

**This is the actual enforcement.** The prose docs describe the boundary; this file *is* it.

- `invalid_client_imports`: **`server-only`, `next/headers`, `next/root-params`**
- `invalid_server_imports`: **`client-only`, `react-dom/client`, `react-dom/server`,
  `next/router`**

Verbatim error strings:

> *"You're importing a module that depends on \"{source}\" into a React Client Component
> module. This API is only available in Server Components but one of its parents is marked
> with \"use client\", so this module is also a Client Component."*

> *"You're importing a component that imports {source}. It only works in a Client Component but
> none of its parents are marked with \"use client\", so they're Server Components by default."*

> *"The \"use client\" directive must be placed before other expressions. Move it to the top of
> the file to resolve this issue."*

> *"It's not possible to have both \"use client\" and \"use server\" directives in the same
> file."* — and the same for `"use client"` + `"use cache"`.

⚠️ The compiler branches on `is_in_app_dir`; the agent captured the app-dir string in full and
the Pages-Router variant only truncated. **The Pages variant is NOT banked** — do not quote a
fragment of it.

## React 19.2 stability — settled by T1 probe, not by assumption

`Object.keys(require('react'))` on the **installed `react` 19.2.8** (matches the pin):

- **Present, unprefixed:** `Activity`, `useEffectEvent`, `cacheSignal`, `cache`
- **Absent:** `ViewTransition`

Neither react.dev reference page carries a channel banner. 🔴 **Unconfirmed: whether the App
Router's built-in React canary exposes `ViewTransition`.** Next.js does not state it; the
stable-channel absence above is what the page asserts.

## react.dev — `useEffectEvent`

https://react.dev/reference/react/useEffectEvent — all four caveats banked, notably:

> *"Effect Event functions do not have a stable identity. Their identity intentionally changes
> on every render."*

## react.dev — `Activity`

https://react.dev/reference/react/Activity

> *"The children's DOM is preserved when hidden using `display: \"none\"` CSS property."*

> *"When an Activity boundary is hidden during its initial render, its children won't be visible
> on the page — but they will still be rendered, albeit at a lower priority than the visible
> content, and without mounting their Effects."*

> *"Activity boundaries naturally divide your component tree into independent units, allowing
> them to participate in Selective Hydration."*

🔴 **Two things react.dev does NOT settle, both written as explicitly uncertain on the pages:**

1. **Whether `Activity` can be rendered *from* a Server Component.** Neither react.dev nor the
   Next.js docs address it. The page only demonstrates it inside a Client Component.
2. **Whether scroll position survives a hide.** ⚠️ **The old imported stub CLAIMED it did**
   (*"keeping a background tab's scroll position … intact"*). React documents preservation of
   **state and DOM only**, and `display: none` destroys the layout box. The page corrects the
   stub: not documented, do not assume, capture it yourself.

## Package bundling and the analyzer

https://nextjs.org/docs/app/guides/package-bundling (`version: 16.3.4`, `lastUpdated`
2026-06-01)

- `npx next experimental-analyze` — **experimental, v16.1+**; `--output` writes to
  `.next/diagnostics/analyze`
- *"Packages imported inside Server Components and Route Handlers are automatically bundled by
  Next.js"*

## Web Vitals

https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals (`version: 16.3.4`,
`lastUpdated` 2026-02-27):

> *"Since the `useReportWebVitals` hook requires the `'use client'` directive, the most
> performant approach is to create a separate component that the root layout imports. This
> confines the client boundary exclusively to the `WebVitals` component."*

From web.dev: **LCP sub-part budget** — TTFB ~40%, resource load delay <10%, resource load
duration ~40%, element render delay <10%. **INP thresholds** 200 ms / 500 ms at the 75th
percentile.

⚠️ **FID's retirement date as a Core Web Vital was NOT confirmed** — the `useReportWebVitals`
reference still lists `FID`. The page says so and tells the reader to act on INP.

Related: [[research-nextjs-ch1-foundations]] · [[progress-nextjs-import]]
