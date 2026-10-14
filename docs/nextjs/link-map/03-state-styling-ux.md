---
title: "Link map · Next.js · Part 3 (chapters 8–10)"
sidebar_label: "03 · state styling ux"
sidebar_position: 3
---

# Link map · Next.js · Part 3 (chapters 8–10)

Covers every topic row of chapters 8, 9 and 10 in `docs/nextjs/syllabus/03-state-styling-ux.md`: state management in an RSC world (T08-01 to T08-06), styling and UI (T09-01 to T09-05), and forms, authentication and security hardening (T10-01 to T10-05). That is 16 rows, and every one has a written page of ours (a chunked topic shows its first chunk file). The three "Project Milestone" bullets (T08-07, T09-06, T10-06) are not topics and are skipped.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line.

🔴 **Version note.** Target is **Next.js 16.3, React 19.2**. Official links point at the current nextjs.org/docs App Router pages (the pages themselves carry `lastUpdated` stamps of 2026-03 to 2026-10 and were live on 2026-10-14). Picks that predate Next 16 or the App Router are flagged in their block.
🔴 **Security note (chapter 9).** The syllabus carries a live correction: the August 2026 release disabled AVIF optimization (GHSA-2xp9-vwfh-vxw4). The Image API reference still documents the `formats` option with AVIF, so do not treat that page as a recommendation to enable it. Source: [August 2026 Security Release](https://nextjs.org/blog/august-2026-security-release) · nextjs.org, 2026-08-25 · fetched 2026-10-14 (*read*).

---

## Chapter 8 — State Management in an RSC World

### T08-01 · The server-state / client-state split — ✅ written `docs/nextjs/pages/08-state-management-in-an-rsc-world/01-the-fundamental-split-server-state-data-on-the-server-cached.md`
- **Read this:** [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) · nextjs.org (16.x) · when state, effects and browser APIs force a Client Component, how the RSC Payload carries server output, and context providers as Client Components (*read*) · covers our angle: **partial** — draws the runtime split, never uses the words "server state" or "client state" · fetched 2026-10-14
- **Also good:** [Server Components](https://react.dev/reference/rsc/server-components) · react.dev · what runs ahead of time and how it composes with Client Components (*headings only*) · fetched 2026-10-14
- **Our delta:** the data taxonomy (who owns the truth, who may mutate it) and the stale-mirror failure mode.

### T08-02 · When RSC data flow is enough — ✅ written `docs/nextjs/pages/08-state-management-in-an-rsc-world/02-when-rsc-data-flow-is-enough.md`
- **Read this:** [Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data) · nextjs.org (16.x) · the single-roundtrip model where an action returns new UI plus data, `refresh`, `revalidatePath`, and the pointer to optimistic UI (*read*) · covers our angle: **partial** — shows the server-driven loop but not where it stops being enough · fetched 2026-10-14
- **Also good:** [Server Components](https://react.dev/reference/rsc/server-components) · react.dev · why server rendering removes the client fetch waterfall (*headings only*) · fetched 2026-10-14
- **Our delta:** the checklist of symptoms that mean it is not enough (optimistic UI, cross-component client state, real-time sync).

### T08-03 · URL as state — ✅ written `docs/nextjs/pages/08-state-management-in-an-rsc-world/03-url-as-state-searchparams-nuqs-style-patterns-shareable-filt.md`
- **Read this:** [useSearchParams](https://nextjs.org/docs/app/api-reference/functions/use-search-params) · nextjs.org (16.x) · the hook is read-only and client-only, the page `searchParams` prop for Server Components, the Suspense requirement when prerendered, and why layouts get no `searchParams` (*read*) · covers our angle: **partial** — the reading side and a hand-rolled `createQueryString`; nothing on typing or parsing · fetched 2026-10-14
- **Also good:** [nuqs](https://nuqs.dev) · nuqs docs · the library's own pitch: `useState`-like hooks bound to the query string, typed parsers, a server cache for nested Server Components, shallow updates by default (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Managing search parameters in Next.js with nuqs](https://blog.logrocket.com/managing-search-parameters-next-js-nuqs) · Jude Miracle, LogRocket, 2024-11-27 · a product-list app using `useQueryState`, parsers, `createSearchParamsCache` and a Zod-validated sort param; written against nuqs v2 and Next 14/15, so re-check the adapter setup · fetched 2026-10-14 (*read*)
- **Our delta:** canonical URLs, prefetch behaviour of query-driven routes, and when to hand-roll instead of adding nuqs.

### T08-04 · Context, Zustand, Jotai compared — ✅ written `docs/nextjs/pages/08-state-management-in-an-rsc-world/04-client-state-tools-compared-react-context-zustand-jotai.md`
- **Read this:** [Setup with Next.js](https://zustand.docs.pmnd.rs/learn/guides/nextjs) · Zustand docs · a Next server handles many requests so no global store, create the store per request, initialise on server and client with the same data to avoid hydration errors, and RSCs must not read or write the store (*read*) · covers our angle: **partial** — Zustand only · fetched 2026-10-14
- **Also good:** [Next.js](https://jotai.org/docs/guides/nextjs) · Jotai docs · the default store is shared across SSR requests, so wrap in a `Provider`; `useHydrateAtoms` for server values; guard `localStorage` (*read*) · fetched 2026-10-14
- **Also good:** [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) · nextjs.org · the Context provider section: providers must be Client Components, render them as deep as possible (*read*) · fetched 2026-10-14
- **Our delta:** the side-by-side trade-off table and Context re-render containment.

### T08-05 · TanStack Query / RTK Query in the App Router — ✅ written `docs/nextjs/pages/08-state-management-in-an-rsc-world/05-tanstack-query-rtk-query-in-app-router-when-a-client-cache-s.md`
- **Read this:** [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr) · TanStack Query docs · create a QueryClient per request, prefetch in a Server Component, pass `dehydrate` state to `HydrationBoundary`, stream pending queries (v5.40+), and set `staleTime` above 0 (*read*) · covers our angle: **partial** — how to wire it, not whether you still need it · fetched 2026-10-14
- **Beyond the docs:** [Advanced Server Rendering: React Query with Next.js App Router](https://dev.to/rayenmabrouk/advanced-server-rendering-react-query-with-nextjs-app-router-bi7) · Rayen Mabrouk, DEV Community, 2024-05-30 · a worked example including per-request client creation and `gcTime` tuning; predates Next 16 and Cache Components (*read*) · fetched 2026-10-14
- **Our delta:** ⚠️ the line moved: `use cache: private` makes client-memory-only caching a framework primitive. I did not find a primary-source explanation of that shift, so none is linked. RTK Query is also not covered by any pick here.

### T08-06 · `useOptimistic` and `useActionState` — ✅ written `docs/nextjs/pages/08-state-management-in-an-rsc-world/06-useoptimistic-and-useactionstate-as-framework-native-alterna.md`
- **Read this:** [useOptimistic](https://react.dev/reference/react/useOptimistic) · react.dev · must be called inside an Action or transition, automatic rollback when the transition ends, reducer vs updater, how to detect pending state (*read*) · covers our angle: **full** — for the hook; the "replaces a heavy store" argument is ours · fetched 2026-10-14
- **Also good:** [useActionState](https://react.dev/reference/react/useActionState) · react.dev · actions are queued one at a time, expected failures should be returned as state, the `permalink` argument for progressive enhancement, pairing with `useOptimistic` (*read*) · fetched 2026-10-14
- **Our delta:** where these hooks stop (cross-route state, multi-tab, real-time).

---

## Chapter 9 — Styling and UI

### T09-01 · CSS Modules, global CSS, Tailwind — ✅ written `docs/nextjs/pages/09-styling-and-ui/01-css-modules-global-stylesheets-utility-first-tailwind-config.md`
- **Read this:** [CSS](https://nextjs.org/docs/app/getting-started/css) · nextjs.org (16.3, updated 2026-08-25) · Tailwind via `@tailwindcss/postcss` and one `@import`, CSS Modules scoping, global CSS in the root layout, import-order merging, and the `cssChunking` option (*read*) · covers our angle: **partial** — setup only; no v4 CSS-first theme configuration · fetched 2026-10-14
- **Our delta:** Tailwind v4 CSS-first config, coexisting with Modules, and what CSS costs per route.

### T09-02 · CSS-in-JS at Server Component boundaries — ✅ written `docs/nextjs/pages/09-styling-and-ui/02-css-in-js-caveats-at-server-component-boundaries.md`
- **Read this:** [How to use CSS-in-JS libraries](https://nextjs.org/docs/app/guides/css-in-js) · nextjs.org (updated 2026-03-24) · libraries work only in Client Components, the three-step registry plus `useServerInsertedHTML` plus client wrapper setup, the styled-components registry (*read*) · covers our angle: **partial** — the how, little on the cost of the client boundary · fetched 2026-10-14
- **Our delta:** why the registry is a Client Component, and the decision between CSS-in-JS and zero-runtime options. The page still lists emotion as "working on support"; re-check before relying on that.

### T09-03 · `next/font` and zero layout shift — ✅ written `docs/nextjs/pages/09-styling-and-ui/03-font-optimization-with-next-font-zero-layout-shift.md`
- **Read this:** [Font Optimization](https://nextjs.org/docs/app/getting-started/fonts) · nextjs.org (updated 2026-05-27) · build-time self-hosting, no requests to Google from the browser, Google and local fonts, variable fonts recommended, scope via the root layout (*read*) · covers our angle: **partial** — states "no layout shift" but not the fallback size-adjust mechanism · fetched 2026-10-14
- **Our delta:** the adjusted-fallback mechanism, subsetting and preload, CSS variables with Tailwind. A third-party write-up on how `next/font` works (blog.mathpresso.com) refused a scripted fetch with 403, so it is not linked.

### T09-04 · `next/image` — ✅ written `docs/nextjs/pages/09-styling-and-ui/04-next-image-priority-blur-placeholders-remote-patterns-avif-w.md`
- **Read this:** [Image Component](https://nextjs.org/docs/app/api-reference/components/image) · nextjs.org (updated 2026-09-28) · 🔴 Next 16 change: `priority` is deprecated in favour of `preload`, and the page says to prefer `loading="eager"` or `fetchPriority="high"` in most cases; `blurDataURL` is automatic for static imports of jpg, png, webp, avif; the `formats` option (*read*) · covers our angle: **partial** — reference, no explanation of why `remotePatterns` is a security control. 🔴 It still documents enabling AVIF; the August 2026 release disabled it (see the security note above)
- **Also good:** [Image Optimization](https://nextjs.org/docs/app/getting-started/images) · nextjs.org (16.4 page, updated 2026-04-01) · local vs remote images, the manual `width`, `height`, `blurDataURL` for remote, and "be as specific as possible" in `remotePatterns` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [next/image Deep Dive: Optimization, Lazy Loading, and the Props That Actually Matter](https://dev.to/aon_infotech_3a1b6ff525fc/nextimage-deep-dive-optimization-lazy-loading-and-the-props-that-actually-matter-4kpg) · Aon infotech, DEV Community, posted July 14 (year not shown) · `sizes`, `priority`, `fill`, `placeholder` and `remotePatterns` in one pass; likely uses the pre-16 `priority` name and treats AVIF as safe, so read with the corrections above · fetched 2026-10-14 (*headings only*)
- **Our delta:** the AVIF security correction, bounding the optimizer, and when not to use it.

### T09-05 · `next/script` loading strategies — ✅ written `docs/nextjs/pages/09-styling-and-ui/05-next-script-loading-strategies-for-third-party-scripts.md`
- **Read this:** [Script Component](https://nextjs.org/docs/app/api-reference/components/script) · nextjs.org (16.4 page, updated 2026-08-21) · `beforeInteractive`, `afterInteractive` (default), `lazyOnload`, and `worker` (experimental, and the page says it does not yet work with the App Router); `onLoad`, `onReady`, `onError` are Client Component only (*read*) · covers our angle: **full** — for the strategies · fetched 2026-10-14
- **Also good:** [How to load and optimize scripts](https://nextjs.org/docs/app/guides/scripts) · nextjs.org (updated 2026-10-05) · layout vs root-layout scripts load once, inline scripts need an `id`, extra attributes such as `nonce` are forwarded (*read*) · fetched 2026-10-14
- **Our delta:** the Partytown trade-offs and what to use instead of `worker`.

---

## Chapter 10 — Forms, Authentication, and Security Hardening

### T10-01 · Server Actions with `useActionState` and `useOptimistic` — ✅ written `docs/nextjs/pages/10-forms-authentication-and-security-hardening/01-server-actions-for-mutations-with-useactionstate-and-useopti.md`
- **Read this:** [How to create forms with Server Actions](https://nextjs.org/docs/app/guides/forms) · nextjs.org (updated 2026-10-06) · `FormData` in actions, `bind` for extra arguments, `useActionState` changes the action signature to take previous state first, `pending`, `useFormStatus`, and an optimistic message thread (*read*) · covers our angle: **full** — for the wiring · fetched 2026-10-14
- **Also good:** [useActionState](https://react.dev/reference/react/useActionState) · react.dev · queuing and error semantics behind the hook (*read*) · fetched 2026-10-14
- **Our delta:** the verification warning that every action is a public POST endpoint, repeated from the Data Security guide.

### T10-02 · Boundary validation: React Hook Form plus Zod — ✅ written `docs/nextjs/pages/10-forms-authentication-and-security-hardening/02-boundary-validation-react-hook-form-zod-schemas-shared-acros.md`
- **Read this:** [How to create forms with Server Actions](https://nextjs.org/docs/app/guides/forms) · nextjs.org · server-side validation with Zod or Valibot via `safeParse`, flattened field errors returned as state (*read*) · covers our angle: **partial** — server half only, no React Hook Form. Its Zod example uses the v3-style `invalid_type_error` option; the authentication guide's example uses the Zod 4 `error` option, so check which Zod you have · fetched 2026-10-14
- **Also good:** [react-hook-form/resolvers](https://github.com/react-hook-form/resolvers) · GitHub · `zodResolver(schema)` passed to `useForm`, the full list of supported schema libraries, and a caveat on `.default()` with a generic passed to `useForm` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Both-sides form validation with Next.js (React Hook Form and next-safe-action)](https://dev.to/arnaudrenaud/both-sides-form-validation-with-nextjs-react-hook-form-next-safe-action-1di1) · Arnaud Renaud, DEV Community, 2025-04-09 · one Zod schema reused in the browser and in the Server Action, with loading, success and error states; uses the next-safe-action library, which our chapter does not (*read*) · fetched 2026-10-14
- **Our delta:** the same schema on both sides without a wrapper library, and re-validating on the server as the real gate. The react-hook-form.com docs returned 403 to a scripted fetch, so they are not linked.

### T10-03 · Authentication patterns — ✅ written `docs/nextjs/pages/10-forms-authentication-and-security-hardening/03-authentication-patterns-authjs-clerk-supabase-jwt-strategies.md`
- **Read this:** [How to implement authentication in Next.js](https://nextjs.org/docs/app/guides/authentication) · nextjs.org (updated 2026-09-16) · authentication vs session management vs authorization, stateless (Jose, cookie) vs database sessions, cookie options, and a library list including Auth.js, Clerk, Supabase and Better Auth (*read*) · covers our angle: **partial** — hand-rolled flow and a library list, no side-by-side of providers · fetched 2026-10-14
- **Also good:** [Auth.js getting started](https://authjs.dev/getting-started) · Auth.js · 🔴 the page now states "The Auth.js project is now part of Better Auth" and links a migration guide; covers `next-auth@5.0.0-beta` and later (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Next.js Authentication Guide 2026](https://clerk.com/articles/nextjs-authentication-guide-2026) · Clerk (vendor), no author or date shown, product details verified 2026-07-29 · layered defence and lessons from the proxy-bypass CVEs, with Clerk setup; part 2 compares providers. It is vendor content, so weigh the comparisons accordingly · fetched 2026-10-14 (*headings only*)
- **Our delta:** Supabase and JWT strategy trade-offs, edge-native sessions, and the Auth.js-into-Better-Auth status for a syllabus that names Auth.js.

### T10-04 · Defense in depth: `proxy.ts` and the data-access layer — ✅ written `docs/nextjs/pages/10-forms-authentication-and-security-hardening/04-defense-in-depth-proxyts-as-a-coarse-filter.md`
- **Read this:** [How to think about data security in Next.js](https://nextjs.org/docs/app/guides/data-security) · nextjs.org (updated 2026-10-06) · the DAL that runs server-only, authorizes and returns DTOs; actions are reachable by direct POST so re-verify inside each; IDOR ownership checks; return-value filtering; an audit checklist that names `proxy.ts` (*read*) · covers our angle: **full** — for the DAL as the gate; lighter on proxy specifics · fetched 2026-10-14
- **Also good:** [How to implement authentication in Next.js](https://nextjs.org/docs/app/guides/authentication) · nextjs.org · "Optimistic checks with Proxy": read only the cookie, no database in Proxy, and Proxy "should not be your only line of defense" (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Next.js Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nextjs_Security_Cheat_Sheet.html) · OWASP Cheat Sheet Series · do not rely on Proxy alone (a `matcher` can omit a route; cites CVE-2025-29927), secure Server Actions as endpoints, protect Route Handlers separately (*read*) · fetched 2026-10-14
- **Our delta:** per-route runtime checks and the cache-scoping interaction with Cache Components.

### T10-05 · RSC serialization hardening (React2Shell) — ✅ written `docs/nextjs/pages/10-forms-authentication-and-security-hardening/05-rsc-serialization-hardening-lessons-from-react2shell-cve-202.md`
- **Read this:** [Critical Security Vulnerability in React Server Components](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components) · react.dev, 2025-12-03 (updated 2026-01-26) · CVE-2025-55182, CVSS 10.0, unauthenticated RCE via deserialization of Server Function requests, affected `react-server-dom-*` 19.0 to 19.2.0, fixed in 19.0.1, 19.1.2, 19.2.1, plus the follow-up CVEs (*read*) · covers our angle: **partial** — the incident and fixes, not the design lessons · fetched 2026-10-14
- **Also good:** [August 2026 Security Release](https://nextjs.org/blog/august-2026-security-release) · nextjs.org, 2026-08-25 · the two 2026 critical items the syllabus flags as missing: GHSA-2xp9-vwfh-vxw4 (AVIF) and CVE-2026-75604 (Windows hosting), fixed in 16.3.3 and 15.5.24 (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Max-severity vulnerability in React, Node.js patched, update ASAP](https://www.helpnetsecurity.com/2025/12/04/react-node-js-vulnerability-cve-2025-55182/) · Zeljka Zorz, Help Net Security, 2025-12-04 · plain-language account of the flaw, affected frameworks and WAF mitigations; written on day two, before follow-up CVEs (*read*) · fetched 2026-10-14
- **Our delta:** keeping internal objects off the wire, cross-origin prefetch policy, and the KEV-catalog monitoring habit. I did not verify KEV or CSP sources in this pass.
