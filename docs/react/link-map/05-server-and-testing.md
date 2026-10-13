---
title: "Link map · React · Part 5 (phases 10–11–14)"
sidebar_label: "05 · server and testing"
sidebar_position: 5
---

# Link map · React · Part 5 (phases 10–11–14)

Covers every topic row of phase 10 (T10-01 to T10-19, Server Components and Server Functions) and phase 11 (T11-01 to T11-17, server rendering, hydration and the DOM APIs) in `docs/react/syllabus/03-concurrent-and-server.md`, and phase 14 (T14-01 to T14-14, testing React) in `docs/react/syllabus/04-building-an-app.md`. That is 50 rows, and all 50 have a written page of ours.
*read* = the passage that supports the claim was read; *headings only* = fetched, headings checked; *200 only* = the URL returned 200 but the page was not read (none remain after verification). Third-party links carry a date only where the page shows one. No `#anchors` are given.

🔴 **Search coverage, said plainly.** The researcher reported 13 searches, all in phase 10 (T10-01 to T10-10, T10-13, T10-15); those were not re-run. The verifier's own spot-check searches (six were attempted) were refused because the shared web-search budget was already used up, so **no row was spot-checked by search**. Instead, six canonical pages I already knew of were fetched and read directly: web.dev "Rendering on the Web", two Kent C. Dodds posts, the Next.js Vitest guide, the Next.js data-security guide and the `@vitejs/plugin-rsc` README. Rows with no "Beyond the docs" line were not searched for by anyone; treat the absence of a "Beyond" line as "not found", never as "none exists".

🔴 **Version note.** Our syllabus targets **React 19.2.8** (`docs/react/README.md`). Every URL below was re-fetched on 2026-10-13 and read. The Next.js pages fetched were version 16.4.0 (boundary guide last updated 2026-10-05, data-security guide 2026-10-06, Vitest guide 2026-08-25). The Vitest guide documents v5.0.4 and the Jest guide 30.5. The React Router RSC page calls RSC support experimental and subject to breaking changes in minor and patch releases. Kent C. Dodds's testing posts date from 2017 to 2020 and show no update note; the `act`, `common mistakes` and `stop mocking fetch` posts predate user-event v14, where `userEvent.setup()` is called first. The hooks post, as fetched, imports `renderHook` from `@testing-library/react`, so it was evidently revised after its 2020 date; the page shows no revision date.

---

## Phase 10 — Server Components and Server Functions

### T10-01 · What a Server Component is — Master · ✅ written `docs/react/pages/phase-10-server-components/01-what-a-server-component-is/01-the-definition.md`
- **Read this:** [Server Components](https://react.dev/reference/rsc/server-components) · react.dev · the official definition: components rendered "before bundling, in an environment separate from your client app or SSR server", at build time or per request (*read*) · covers our angle: **partial** — no single list of what is not allowed; the restrictions are scattered (`useState`, creating context) · fetched 2026-10-13
- **Beyond the docs:** [Making Sense of React Server Components](https://www.joshwcomeau.com/react/server-components/) · Josh W. Comeau, published 2023-09-06, updated 2025-05-09 · explains that Server Component code is not in the bundle and never hydrates, and that Client Components also render on the server, which the name hides · fetched 2026-10-13 (*read*)
- **Our delta:** the `async` component and the list of what is not allowed, as one rule.

### T10-02 · The two module graphs — Master · ✅ written `docs/react/pages/phase-10-server-components/02-two-module-graphs.md`
- **Read this:** [The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary) · Next.js docs, v16.4.0 · opens with the sentence that RSC splits a tree between server and client module graphs, and says the client graph never imports the server graph (*read*) · covers our angle: **full**, but framework-specific (Next.js compiles a shared module once per environment) · fetched 2026-10-13
- **Beyond the docs:** [How Imports Work in RSC](https://overreacted.io/how-imports-work-in-rsc/) · Dan Abramov, 2025-06-05 · each environment keeps its own module cache, and `server-only` and `client-only` act as build-time poison pills · fetched 2026-10-13 (*read*)
- **Our delta:** "which graph is this file in" as the first debugging question.

### T10-03 · `'use client'` — Master · ✅ written `docs/react/pages/phase-10-server-components/03-use-client.md`
- **Read this:** [`'use client'`](https://react.dev/reference/rsc/use-client) · react.dev · the boundary marks the module and all its transitive dependencies as Client modules; has the serializable-props list (*read*) · fetched 2026-10-13
- **Also good:** [The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary) · Next.js docs · "you only need the directive at the entry to a client subtree"; everything imported from there joins the client graph (*read*) · fetched 2026-10-13
- **Beyond the docs:** [What Does "use client" Do?](https://overreacted.io/what-does-use-client-do/) · Dan Abramov, 2025-04-25 · frames the directive as a typed door from server to client rather than a label on a component · fetched 2026-10-13 (*read*)
- **Our delta:** the bundle-doubling consequence of one careless directive.

### T10-04 · `'use server'` — Master · ✅ written `docs/react/pages/phase-10-server-components/04-use-server.md`
- **Read this:** [`'use server'`](https://react.dev/reference/rsc/use-server) · react.dev · says the directive is for Server Functions and lists the serializable-argument types (*read*) · covers our angle: **partial** — does not name the "directive at the top of a component file" mistake · fetched 2026-10-13
- **Beyond the docs:** [What Does "use client" Do?](https://overreacted.io/what-does-use-client-do/) · Dan Abramov, 2025-04-25 · `'use server'` is the opposite door, from client to server, an import that becomes an HTTP call; read it for the symmetry with `'use client'` (*read*) · fetched 2026-10-13
- **Our delta:** the mistake of putting `'use server'` at the top of a component file.

### T10-05 · What crosses the boundary — Master · ✅ written `docs/react/pages/phase-10-server-components/05-what-crosses-the-boundary.md`
- **Read this:** [The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary) · Next.js docs · "Crossing the boundary": code crosses through imports, data through props and must be serializable; passing a function such as `onClick` throws; a Server Function crosses as a reference (*read*) · covers our angle: **partial** — no per-type error text · fetched 2026-10-13
- **Also good:** [`'use server'`](https://react.dev/reference/rsc/use-server) · react.dev · the list of argument types that are not supported (React elements, class instances, non-global symbols, events) (*read*) · [`'use client'`](https://react.dev/reference/rsc/use-client) · the serializable-props list (*read*) · fetched 2026-10-13
- **Beyond the docs:** [React for Two Computers](https://overreacted.io/react-for-two-computers/) · Dan Abramov, 2025-04-09 · builds the idea that what travels between machines is data describing a call, not live functions; serializability is implicit in the argument rather than stated as a rule, and the post is long and conceptual (*read*, first 100k of 121k characters) · fetched 2026-10-13
- **Our delta:** the exact error each violation produces.

### T10-06 · Server Function security — Master · ✅ written `docs/react/pages/phase-10-server-components/06-server-function-security/01-everything-is-an-endpoint.md`
- **Read this:** [How to Think About Security in Next.js](https://nextjs.org/blog/security-nextjs-server-components-actions) · Sebastian Markbåge, Next.js blog, 2023-10-23 · `'use server'` exposes an endpoint callable "with any arguments"; validate the user and each argument; closed-over variables are encrypted but `.bind()` arguments are not (*read*) · covers our angle: **full**, though the closure encryption is Next.js 14 behaviour, not React's · fetched 2026-10-13
- **Also good:** [React Server Components in React Router](https://reactrouter.com/how-to/react-server-components) · React Router docs · "Treat every Server Function as a public endpoint"; do not rely on route middleware for authentication or authorization (*read*) · fetched 2026-10-13
- **Also good:** [How to think about data security in Next.js](https://nextjs.org/docs/app/guides/data-security) · Next.js docs, v16.4.0 · a page-level auth check does not cover an action defined on it; check authorization (ownership), not only authentication; return only what the UI needs; do not rely on closure encryption alone (*read*) · fetched 2026-10-13
- **Our delta:** the caller-ignores-the-UI framing. A Makerkit vendor post was dropped in verification: no named author, a publish date that disagrees with the versions it cites, and a spoofable rate-limit example.

### T10-07 · Passing Server Components as `children` — Understand · ✅ written `docs/react/pages/phase-10-server-components/07-server-components-as-children.md`
- **Read this:** [The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary) · Next.js docs · a `Modal` Client Component receives a server-rendered `Cart` as `children`, and the "owner versus parent" box explains why that works (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Making Sense of React Server Components](https://www.joshwcomeau.com/react/server-components/) · Josh W. Comeau · the Workarounds section moves state into a small `'use client'` provider so the parent stays a Server Component (*read*) · fetched 2026-10-13
- **Our delta:** none beyond the page above. The researcher searched; the results were tutorials that were not fetched.

### T10-08 · Async components — Understand · ✅ written `docs/react/pages/phase-10-server-components/08-async-components.md`
- **Read this:** [Server Components](https://react.dev/reference/rsc/server-components) · react.dev · async components section: "When you `await` in an async component, React will suspend"; shows an un-awaited promise passed to a Client Component and read with `use` (*read*) · covers our angle: **partial** — no section on removing loading-state boilerplate · fetched 2026-10-13
- **Also good:** [The Big "Server Waterfall Problem" with RSCs](https://www.epicreact.dev/server-waterfall-problem-rscs) · Kent C. Dodds, Epic React, no date shown · argues a server waterfall is the old colocate-versus-pass-down problem and cheaper than a client one; includes a newsletter and workshop plug (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Fetch Waterfall in React](https://blog.sentry.io/fetch-waterfall-in-react) · Lazar Nikolov, Sentry blog, 2023-12-15 · sequential `await` calls create a server waterfall, fixed with `Promise.all` and Suspense; "a concurrency problem, not a rendering problem"; written when `use` was canary only (*read*) · fetched 2026-10-13
- **Our delta:** Suspense removes loading boilerplate rather than hiding it.

### T10-09 · Calling Server Functions from the client — Understand · ✅ written `docs/react/pages/phase-10-server-components/09-calling-server-functions.md`
- **Read this:** [Server Functions](https://react.dev/reference/rsc/server-functions) · react.dev · form `action`, `startTransition` for `isPending`, `onClick`, and `useActionState` with progressive enhancement (*read*) · covers our angle: **partial** — states that React "will send a request to the server" but says nothing about network failure, timeouts or retries · fetched 2026-10-13
- **Our delta:** every call is a network round trip that can fail. The researcher searched; nothing verified to add.

### T10-10 · Composition rules — Understand · ✅ written `docs/react/pages/phase-10-server-components/10-composition-rules.md`
- **Read this:** [The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary) · Next.js docs · a Server Component importing a Client Component gets a client reference; static members such as `Menu.Item` break across the boundary (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Making Sense of React Server Components](https://www.joshwcomeau.com/react/server-components/) · Josh W. Comeau · "Client Components can only import other Client Components" (*read*) · fetched 2026-10-13
- **Our delta:** Server Functions as the one thing that crosses inward.

### T10-11 · Where interactivity goes — Understand · ✅ written `docs/react/pages/phase-10-server-components/11-where-interactivity-goes.md`
- **Read this:** [Making Sense of React Server Components](https://www.joshwcomeau.com/react/server-components/) · Josh W. Comeau · moves state into a small separate Client Component so the parent stays a Server Component (*read*) · covers our angle: **partial** — no bundle measurement · fetched 2026-10-13
- **Also good:** [The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary) · Next.js docs · `<details>` and a form with a Server Function need no Client Component (*read*) · fetched 2026-10-13
- **Our delta:** measuring the bundle difference. Not searched.

### T10-12 · The December 2025 advisories — Understand · ✅ written `docs/react/pages/phase-10-server-components/12-december-2025-advisories.md`
- **Read this:** [Critical Security Vulnerability in React Server Components](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components) · react.dev blog, 2025-12-03 · CVE-2025-55182, unauthenticated remote code execution, CVSS 10.0, in `react-server-dom-webpack`, `-parcel` and `-turbopack` 19.0 to 19.2.0; patched in 19.0.1, 19.1.2 and 19.2.1; the page was updated later with follow-up CVEs (*read*) · fetched 2026-10-13
- **Also good:** [Denial of Service and Source Code Exposure in React Server Components](https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components) · react.dev blog, 2025-12-11, updated 2026-01-26 · CVE-2025-55184, CVE-2025-67779, CVE-2026-23864 (denial of service) and CVE-2025-55183 (source exposure); the earlier patches 19.0.3, 19.1.4 and 19.2.3 are incomplete, current fixes are 19.0.4, 19.1.5 and 19.2.4 (*read*) · fetched 2026-10-13
- **Our delta:** why an RSC app must not float its React version. Not searched. The 2026-01-26 follow-up fix is later than the two dates in the syllabus row.

### T10-13 · The RSC payload — Understand · ✅ written `docs/react/pages/phase-10-server-components/13-the-rsc-payload.md`
- **Read this:** [The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary) · Next.js docs · the RSC Payload is "a serialized description of the UI" carrying references to Client Components; the server graph emits references and serialized props (*read*) · covers our angle: **partial** — no row format · fetched 2026-10-13
- **Beyond the docs:** [RSC From Scratch. Part 1: Server Components](https://github.com/reactwg/server-components/discussions/5) · Dan Abramov, React Working Group, 2023-06-02 · builds a server that sends a JSX tree to the client, starting from a PHP-style blog; the tree is sent with `JSON.stringify` and a custom replacer (not streamed, not Flight rows), and Part 2 was unwritten when read (*read*) · fetched 2026-10-13
- **Our delta:** reading rows in the network tab. The researcher searched; the Flight results were security write-ups that were not fetched.

### T10-14 · `react-server-dom-*` renderer packages — Understand · ✅ written `docs/react/pages/phase-10-server-components/14-renderer-packages.md`
- **Read this:** [`@vitejs/plugin-rsc` README](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-rsc) · vite-plugin-react repository · the rsc environment loads modules "with `react-server` condition", the ssr environment without it; the plugin vendors `react-server-dom-webpack` unless the project installs it (*read*) · covers our angle: **partial** — Vite only, no `-turbopack` or `-parcel`, and the `'use client'` and `'use server'` transforms are not explained · fetched 2026-10-13
- **Also good:** [React Server Components in React Router](https://reactrouter.com/how-to/react-server-components) · React Router docs · shows a framework wiring an RSC bundler (`@vitejs/plugin-rsc`) with separate rsc, ssr and client entries (*read*); never names `react-server-dom-webpack` or the `react-server` condition · fetched 2026-10-13
- **Our delta:** the export condition across all three bundlers. The researcher searched; results were skill summaries, not primary. The README was found by direct fetch in verification.

### T10-15 · Data fetching in RSC — Understand · ✅ written `docs/react/pages/phase-10-server-components/15-data-fetching-in-rsc.md`
- **Read this:** [`cache`](https://react.dev/reference/react/cache) · react.dev · "only for use with React Server Components"; the cache is invalidated for each server request (*read*) · covers our angle: **partial** — nothing on parallelizing awaits · fetched 2026-10-13
- **Also good:** [`cacheSignal`](https://react.dev/reference/react/cacheSignal) · react.dev · an `AbortSignal` that aborts when React has finished rendering; returns `null` in Client Components and outside rendering (*read*) · fetched 2026-10-13
- **Our delta:** parallelizing sibling awaits (see the Sentry post under T10-08). The researcher searched; the preload-pattern article was not fetched.

### T10-16 · Next.js App Router vs React Router 7/8 — Understand · ✅ written `docs/react/pages/phase-10-server-components/16-nextjs-vs-react-router.md`
- **Read this:** [React Server Components in React Router](https://reactrouter.com/how-to/react-server-components) · React Router docs · RSC is experimental, in Framework and Data Mode, with `ServerComponent` route exports (*read*) · covers our angle: **partial** — one side only · fetched 2026-10-13
- **Also good:** [The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary) · Next.js docs, the other side (*read*) · fetched 2026-10-13
- **Our delta:** which knowledge transfers. Not searched. The React Router page says RSC support is "experimental and subject to breaking changes in minor/patch releases"; check it before relying on it.

### T10-17 · When RSC is the wrong choice — Understand · ✅ written `docs/react/pages/phase-10-server-components/17-when-rsc-is-wrong.md`
- **Also good:** [Making Sense of React Server Components](https://www.joshwcomeau.com/react/server-components/) · Josh W. Comeau · the Advantages section is the case for RSC, useful as the other side of this page (*read*) · fetched 2026-10-13
- **Our delta:** the whole topic; no opinionated "when not" page was found. Not searched.

### T10-18 · Server Components without a framework — Know · ✅ written `docs/react/pages/phase-10-server-components/18-without-a-framework.md`
- **Read this:** [RSC From Scratch. Part 1: Server Components](https://github.com/reactwg/server-components/discussions/5) · Dan Abramov, 2023-06-02 · an RSC server and an SSR server built by hand; Client Components are deferred to an unwritten Part 2 (*read*) · covers our angle: **partial** — a teaching toy, not the bundler integration · fetched 2026-10-13
- **Our delta:** why every practical setup uses a framework. Not searched.

### T10-19 · Taint APIs — Know · ✅ written `docs/react/pages/phase-10-server-components/19-taint-apis.md`
- **Read this:** [`experimental_taintObjectReference`](https://react.dev/reference/react/experimental_taintObjectReference) · react.dev · experimental, not for production; protects only an unchanged object, and "Do not rely on just tainting for security" (*read*) · fetched 2026-10-13
- **Also good:** [`experimental_taintUniqueValue`](https://react.dev/reference/react/experimental_taintUniqueValue) · react.dev · registers a unique secret; derived values such as uppercased or base64 copies are not tainted (*read*) · [How to Think About Security in Next.js](https://nextjs.org/blog/security-nextjs-server-components-actions) · says taint does not stop extracting fields or derived values, and prefers a data access layer (*read*) · fetched 2026-10-13
- **Our delta:** none. Not searched.

---

## Phase 11 — Server rendering, hydration and the DOM APIs

None of the 17 rows below was searched (see the search coverage note). Every react.dev page below was read in verification.

### T11-01 · CSR vs SSR vs SSG vs streaming SSR vs RSC — Master · ✅ written `docs/react/pages/phase-11-ssr-hydration/01-csr-ssr-ssg-streaming-rsc.md`
- **Read this:** [The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary) · Next.js docs · "Rendering environments": "Server-rendered" describes how HTML was produced, "Server Component" where code runs (*read*) · covers our angle: **partial** — Next.js terms, no CSR or streaming comparison · fetched 2026-10-13
- **Also good:** [The Perils of Hydration](https://www.joshwcomeau.com/react/the-perils-of-rehydration/) · Josh W. Comeau, published 2020-03-02, updated 2025-12-03 · CSR versus SSR versus build-time generation, and hydration, which "is not the same thing as a render" (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Rendering on the Web](https://web.dev/articles/rendering-on-the-web) · Addy Osmani and Jason Miller, web.dev, published 2019-02-06, updated 2026-01-05 · the clearest side-by-side of CSR, SSR, static rendering and streaming with rehydration, in TTFB, FCP and TBT/INP terms; it predates RSC, so it covers four of the five terms and some framework examples are dated (*read*) · fetched 2026-10-13
- **Our delta:** costs and combinations of all five, including RSC.

### T11-02 · Hydration mismatches — Master · ✅ written `docs/react/pages/phase-11-ssr-hydration/02-hydration-mismatches.md`
- **Read this:** [Text content does not match server-rendered HTML](https://nextjs.org/docs/messages/react-hydration-error) · Next.js docs · lists the causes (bad tag nesting, `window` checks, `Date`, extensions, CSS-in-JS, CDN rewriting, iOS auto-links) with three fixes (*read*) · covers our angle: **full** on causes; `Math.random` and locale formatting not listed · fetched 2026-10-13
- **Beyond the docs:** [The Perils of Hydration](https://www.joshwcomeau.com/react/the-perils-of-rehydration/) · Josh W. Comeau · why a `typeof window` branch breaks hydration, with a `useHasMounted` hook and `ClientOnly` wrapper (*read*) · fetched 2026-10-13
- **Our delta:** ordering the causes by frequency.

### T11-03 · `renderToString` vs `renderToPipeableStream` vs `renderToReadableStream` — Understand · ✅ written `docs/react/pages/phase-11-ssr-hydration/03-the-server-renderers.md`
- **Read this:** [`renderToString`](https://react.dev/reference/react-dom/server/renderToString) · react.dev · "does not support streaming or waiting for data"; a suspended component immediately sends its nearest fallback as HTML; names the three alternatives (*read*) · covers our angle: **full** on the Suspense-fallback point · fetched 2026-10-13
- **Also good:** [`renderToPipeableStream`](https://react.dev/reference/react-dom/server/renderToPipeableStream) · react.dev · Node streams, with `onShellReady` and `onAllReady` (*read*) · [`renderToReadableStream`](https://react.dev/reference/react-dom/server/renderToReadableStream) · react.dev · Web Streams, `stream.allReady`; Node should use the pipeable variant (*read*) · fetched 2026-10-13

### T11-04 · `hydrateRoot` — Understand · ✅ written `docs/react/pages/phase-11-ssr-hydration/04-hydrateroot.md`
- **Read this:** [`hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot) · react.dev · hydrating server-rendered HTML, the error options, and the `suppressHydrationWarning` and `isClient` sections (*read*) · covers our angle: **partial** — no account of hydration cost versus a full render · fetched 2026-10-13

### T11-05 · `suppressHydrationWarning` and the two-pass render — Understand · ✅ written `docs/react/pages/phase-11-ssr-hydration/05-suppresshydrationwarning.md`
- **Read this:** [`hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot) · react.dev · `suppressHydrationWarning` "only works one level deep" and React will not patch mismatched text; the `isClient` Effect pattern "makes hydration slower because your components have to render twice" (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Text content does not match server-rendered HTML](https://nextjs.org/docs/messages/react-hydration-error) · Next.js docs · `suppressHydrationWarning` "only works one level deep" and React will not patch mismatched text (*read*) · fetched 2026-10-13
- **Beyond the docs:** [The Perils of Hydration](https://www.joshwcomeau.com/react/the-perils-of-rehydration/) · Josh W. Comeau · the two-pass render with a `hasMounted` flag, and its cost to time-to-interactive (*read*) · fetched 2026-10-13
- **Our delta:** when each escape is honest rather than a cover-up.

### T11-06 · Streaming SSR with Suspense — Understand · ✅ written `docs/react/pages/phase-11-ssr-hydration/06-streaming-ssr.md`
- **Read this:** [`renderToPipeableStream`](https://react.dev/reference/react-dom/server/renderToPipeableStream) · react.dev · fallback first, then the real HTML with an inline `script`; `onShellReady` to stream, `onAllReady` for crawlers and static generation, with the trade-off stated (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [New Suspense SSR Architecture in React 18](https://github.com/reactwg/react-18/discussions/37) · Dan Abramov (gaearon), React Working Group, 2021-06-05 · placeholder first, later HTML in the same response, patched in by a small inline script; written for React 18, and neither `onShellReady` nor `onAllReady` appears in it (*read*) · fetched 2026-10-13
- **Our delta:** `onShellReady` vs `onAllReady` and which a crawler needs.

### T11-07 · Selective hydration — Understand · ✅ written `docs/react/pages/phase-11-ssr-hydration/07-selective-hydration.md`
- **Read this:** [New Suspense SSR Architecture in React 18](https://github.com/reactwg/react-18/discussions/37) · Dan Abramov (gaearon), React Working Group, 2021-06-05 · hydration per Suspense boundary, and a click on an unhydrated part makes React hydrate it synchronously during the capture phase (*read*) · covers our angle: **full** on the mechanism, as of React 18 · fetched 2026-10-13

### T11-08 · Prerendering — `prerender` and `prerenderToNodeStream` — Understand · ✅ written `docs/react/pages/phase-11-ssr-hydration/08-prerendering/01-the-static-apis.md`
- **Read this:** [`prerender`](https://react.dev/reference/react-dom/static/prerender) · react.dev · "Unlike `renderToString`, `prerender` waits for all data to load before resolving"; returns `prelude` and `postponed` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [`prerenderToNodeStream`](https://react.dev/reference/react-dom/static/prerenderToNodeStream) · react.dev · the Node streams variant (*read*) · [react-dom/static](https://react.dev/reference/react-dom/static) · react.dev · the four APIs, two for Web Streams and two for Node (*read*) · fetched 2026-10-13

### T11-09 · Partial Pre-rendering (19.2) — Understand · ✅ written `docs/react/pages/phase-11-ssr-hydration/09-partial-prerendering/01-the-idea-and-the-four-apis.md`
- **Read this:** [React 19.2](https://react.dev/blog/2025/10/01/react-19-2) · react.dev blog, 2025-10-01 · the Partial Pre-rendering section: `prerender` with an `AbortController`, save the `postponed` state, later `resume` to an SSR stream or `resumeAndPrerender` for static HTML (*read*) · covers our angle: **partial** — the post is short and does not explain the postponed-state model · fetched 2026-10-13
- **Also good:** [`resume`](https://react.dev/reference/react-dom/server/resume) · react.dev · takes the opaque `postponedState`, re-renders from the root and skips only fully prerendered components (*read*) · [`resumeToPipeableStream`](https://react.dev/reference/react-dom/server/resumeToPipeableStream) · react.dev · the Node variant; `bootstrapScripts` must be passed to `prerender` (*read*) · [`resumeAndPrerender`](https://react.dev/reference/react-dom/static/resumeAndPrerender) · react.dev (*read*) · fetched 2026-10-13

### T11-10 · Document metadata (19) — Understand · ✅ written `docs/react/pages/phase-11-ssr-hydration/10-document-metadata/01-hoisting.md`
- **Read this:** [`<title>`](https://react.dev/reference/react-dom/components/title) · react.dev · React always places `title` in the head wherever it renders; text only; render one at a time (*read*) · covers our angle: **partial** — nothing on what it replaces · fetched 2026-10-13
- **Also good:** [`<meta>`](https://react.dev/reference/react-dom/components/meta) · react.dev · hoisted to the head, except with `itemProp` (*read*) · [`<link>`](https://react.dev/reference/react-dom/components/link) · react.dev (*read*) · fetched 2026-10-13

### T11-11 · Resource preloading — Understand · ✅ written `docs/react/pages/phase-11-ssr-hydration/11-resource-preloading/01-the-six-apis.md`
- **Read this:** [`preload`](https://react.dev/reference/react-dom/preload) · react.dev · a hint to download a resource early; on the server it only takes effect while rendering a component; repeated calls with the same `href` count once (*read*) · covers our angle: **partial** — `preloadModule` and `preinitModule` have no page here · fetched 2026-10-13
- **Also good:** [`preinit`](https://react.dev/reference/react-dom/preinit) · react.dev · eagerly fetches and evaluates a script or stylesheet (*read*) · [`preconnect`](https://react.dev/reference/react-dom/preconnect) · react.dev (*read*) · [`prefetchDNS`](https://react.dev/reference/react-dom/prefetchDNS) · react.dev (*read*) · fetched 2026-10-13

### T11-12 · `flushSync` — Understand · ✅ written `docs/react/pages/phase-11-ssr-hydration/12-flushsync.md`
- **Read this:** [`flushSync`](https://react.dev/reference/react-dom/flushSync) · react.dev · "uncommon and can hurt the performance of your app"; legitimate uses are third-party integrations and `onbeforeprint`; ignored with a warning inside render or Effects (*read*) · covers our angle: **partial** — no `document.startViewTransition` case · fetched 2026-10-13

### T11-13 · Root error options (19) — Understand · ✅ written `docs/react/pages/phase-11-ssr-hydration/13-root-error-options/01-the-three-client-callbacks.md`
- **Read this:** [`createRoot`](https://react.dev/reference/react-dom/client/createRoot) · react.dev · documents `onCaughtError`, `onUncaughtError` and `onRecoverableError`, with an "Error logging in production" example (*read*) · covers our angle: **partial** — client side only; the server `onError` is on the renderer pages · fetched 2026-10-13
- **Also good:** [`hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot) · react.dev · the same three options for hydration (*read*) · fetched 2026-10-13

### T11-14 · `renderToStaticMarkup` — Know · ✅ written `docs/react/pages/phase-11-ssr-hydration/14-rendertostaticmarkup.md`
- **Read this:** [`renderToStaticMarkup`](https://react.dev/reference/react-dom/server/renderToStaticMarkup) · react.dev · "output cannot be hydrated"; for static pages and emails (*read*) · covers our angle: **full** · fetched 2026-10-13

### T11-15 · Stylesheet support and `precedence` (19) — Know · ✅ written `docs/react/pages/phase-11-ssr-hydration/15-stylesheets-and-precedence.md`
- **Read this:** [`<link>`](https://react.dev/reference/react-dom/components/link) · react.dev · `precedence` ranks stylesheets in the head, the rendering component suspends while the stylesheet loads, and links with the same `href` are de-duplicated (*read*) · covers our angle: **partial** — nothing on CSS-in-JS · fetched 2026-10-13

### T11-16 · `<script async>` support (19) — Know · ✅ written `docs/react/pages/phase-11-ssr-hydration/16-async-scripts.md`
- **Read this:** [`<script>`](https://react.dev/reference/react-dom/components/script) · react.dev · hoisting needs both `src` and `async={true}`; scripts with the same `src` are de-duplicated; inline scripts are not moved; React may leave the script in the DOM after unmount (*read*) · covers our angle: **full**; the page is ambiguous on whether `onLoad` disables the special treatment · fetched 2026-10-13

### T11-17 · Portals and SSR — Know · ✅ written `docs/react/pages/phase-11-ssr-hydration/17-portals-and-ssr.md`
- **Read this:** [`createPortal`](https://react.dev/reference/react-dom/createPortal) · react.dev · portals into a page that is only partly React, with browser-API examples (*read*) · covers our angle: **none** — the page does not say what portals do during server rendering, so it supports the portal API but not the SSR claim · fetched 2026-10-13
- **Our delta:** the whole SSR behaviour and the mount-guard pattern. No page verified; not searched.

---

## Phase 14 — Testing React

None of the 14 rows below was searched (see the search coverage note). The third-party picks are Kent C. Dodds posts from 2017 to 2020, read enough to confirm the claim; the Testing Library pages are the primary source and were all read in verification.

### T14-01 · What to test, and what not to — Master · ✅ written `docs/react/pages/phase-14-correctness/01-what-to-test/01-implementation-details.md`
- **Read this:** [Guiding Principles](https://testing-library.com/docs/guiding-principles/) · Testing Library docs · "The more your tests resemble the way your software is used, the more confidence they can give you." (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Testing Implementation Details](https://kentcdodds.com/blog/testing-implementation-details) · Kent C. Dodds, 2020-08-17 · tests tied to internal state break on harmless refactors (false negatives) and pass while the app is broken (false positives), shown with an accordion whose handler is unwired (*read*) · fetched 2026-10-13
- **Our delta:** the refactor-survival gate.

### T14-02 · React Testing Library's model — Master · ✅ written `docs/react/pages/phase-14-correctness/02-the-rtl-model/01-render-and-screen.md`
- **Read this:** [React Testing Library intro](https://testing-library.com/docs/react-testing-library/intro/) · Testing Library docs · works on real DOM nodes, not component instances; not a test runner; no tools for testing implementation details (*read*) · covers our angle: **partial** — the page names neither `render` nor `screen` · fetched 2026-10-13
- **Beyond the docs:** [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) · Kent C. Dodds, 2020-05-04 · fifteen concrete mistakes, including not using `screen` and needless `act` wrapping (*read*) · fetched 2026-10-13

### T14-03 · The query families — Master · ✅ written `docs/react/pages/phase-14-correctness/03-the-query-families/01-get-query-find.md`
- **Read this:** [About Queries](https://testing-library.com/docs/queries/about/) · Testing Library docs · the `getBy`, `queryBy` and `findBy` behaviour table, and a priority list that ends at test IDs (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) · Kent C. Dodds, 2020-05-04 · use `query*` only to check non-existence, `find*` instead of `waitFor` for elements, and prefer `*ByRole` (*read*) · fetched 2026-10-13

### T14-04 · `user-event` over `fireEvent` — Master · ✅ written `docs/react/pages/phase-14-correctness/04-user-event-over-fireevent/01-what-an-interaction-is.md`
- **Read this:** [user-event introduction](https://testing-library.com/docs/user-event/intro/) · Testing Library docs · "`fireEvent` dispatches DOM events, whereas `user-event` simulates full interactions"; visibility and interactability checks; call `userEvent.setup()` before rendering (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) · Kent C. Dodds, 2020-05-04 · `type` fires keystroke events per character where `fireEvent.change` fires one; written for user-event before v14, so it does not show the `setup()` call (*read*) · fetched 2026-10-13
- **Our delta:** the setup call people forget.

### T14-05 · Async testing and `act()` — Master · ✅ written `docs/react/pages/phase-14-correctness/05-async-testing-and-act/01-the-waiting-tools.md`
- **Read this:** [Async Utilities](https://testing-library.com/docs/dom-testing-library/api-async/) · Testing Library docs · `findBy` is `getBy` plus `waitFor`; `waitFor` retries until the callback stops throwing; `waitForElementToBeRemoved` throws if the element is already gone (*read*) · covers our angle: **partial** — nothing on what the `act` warning means · fetched 2026-10-13
- **Also good:** [`act`](https://react.dev/reference/react/act) · react.dev · needs `IS_REACT_ACT_ENVIRONMENT`; recommends React Testing Library because its helpers are already wrapped; does not explain the "not wrapped in act" warning or fake timers (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Fix the "not wrapped in act(...)" warning](https://kentcdodds.com/blog/fix-the-not-wrapped-in-act-warning) · Kent C. Dodds, 2020-02-03 · the warning means a component updated when the test did not expect it; a passing test can hide a UI that never settles, fixed by asserting on the end state (the "Saving" text disappearing); RTL async utilities are already wrapped in `act` (*read*) · fetched 2026-10-13

### T14-06 · Mocking the API — Master · ✅ written `docs/react/pages/phase-14-correctness/06-mocking-the-api/01-the-right-seam.md`
- **Read this:** [MSW introduction](https://mswjs.io/docs/) · MSW docs · intercepts at the network level in browser and Node; the same mocks reused across development, testing, Storybook and demos (*read*) · covers our angle: **partial** — no loading and error path testing · fetched 2026-10-13
- **Also good:** [MSW philosophy](https://mswjs.io/docs/philosophy) · MSW docs · "API mocking deserves a layer of its own in your application"; handlers describe the server's behaviour (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Stop mocking fetch](https://kentcdodds.com/blog/stop-mocking-fetch) · Kent C. Dodds, 2020-06-03 · mocking `fetch` means "re-implementing your entire backend... everywhere in your tests"; MSW handlers are written once, overridden per test with `server.use()`, and the same handlers serve development (*read*) · fetched 2026-10-13

### T14-07 · Jest or Vitest — Understand · ✅ written `docs/react/pages/phase-14-correctness/07-jest-or-vitest.md`
- **Read this:** [Getting Started](https://vitest.dev/guide/) · Vitest docs, v5.0.4 · requires Vite 6.4.0 or newer and Node 22.12.0 or newer (*read*) · covers our angle: **partial** — no Jest comparison on this page · fetched 2026-10-13
- **Also good:** [Comparisons with Other Test Runners](https://vitest.dev/guide/comparisons.html) · Vitest docs · Vitest shares `vite.config.js` where Jest needs a separate pipeline; the Jest section says nothing on ESM or jsdom, and the page is written by the Vitest project (*read*) · [Jest Getting Started](https://jestjs.io/docs/getting-started) · Jest docs, 30.5 · Babel or ts-jest setup, no ESM coverage, and it points Vite users to Vitest (*read*) · [Vitest environments](https://vitest.dev/guide/environment) · jsdom or happy-dom via config or a `@vitest-environment` comment (*read*) · fetched 2026-10-13

### T14-08 · Testing forms and Actions — Understand · ✅ written `docs/react/pages/phase-14-correctness/08-testing-forms-and-actions.md`
- **Read this:** [`<form>`](https://react.dev/reference/react-dom/components/form) · react.dev · action functions receive `FormData` and run in a Transition; pending state via `useFormStatus`; a thrown error goes to the nearest error boundary (*read*) · covers our angle: **none** — no testing content · fetched 2026-10-13
- **Also good:** [`useActionState`](https://react.dev/reference/react/useActionState) · react.dev · `isPending`, returned errors versus thrown errors (*read*); no testing content · fetched 2026-10-13
- **Our delta:** all of it; these pages cover the API, not testing it.

### T14-09 · Testing hooks — Understand · ✅ written `docs/react/pages/phase-14-correctness/09-testing-hooks.md`
- **Read this:** [React Testing Library API](https://testing-library.com/docs/react-testing-library/api/) · Testing Library docs · has a `renderHook` section with its options and result, and the `wrapper` option (*read*) · covers our angle: **partial** — no guidance on when a hook deserves its own test · fetched 2026-10-13
- **Beyond the docs:** [How to test custom React hooks](https://kentcdodds.com/blog/how-to-test-custom-react-hooks) · Kent C. Dodds, 2020-03-22 · test through a small example component first, and use `renderHook` for hooks that wait on async work, rerender with new props or unmount (*read*) · covers our angle: **full**; the fetched text imports `renderHook` from `@testing-library/react` · fetched 2026-10-13

### T14-10 · Wrappers — context, providers and the router — Understand · ✅ written `docs/react/pages/phase-14-correctness/10-wrappers-and-providers.md`
- **Read this:** [React Testing Library setup](https://testing-library.com/docs/react-testing-library/setup/) · Testing Library docs · the "Custom Render" section wraps components in global providers through the `wrapper` option and re-exports everything from RTL (*read*) · covers our angle: **full** on the helper; the router case is not shown · fetched 2026-10-13
- **Also good:** [React Testing Library API](https://testing-library.com/docs/react-testing-library/api/) · Testing Library docs · the `wrapper` option for `render` and `renderHook`; with `initialProps` the props are not passed to the wrapper (*read*) · fetched 2026-10-13

### T14-11 · Roles are the query surface — Understand · ✅ written `docs/react/pages/phase-14-correctness/11-roles-as-the-query-surface.md`
- **Read this:** [`ByRole`](https://testing-library.com/docs/queries/byrole/) · Testing Library docs · "the most preferred query to use as it most closely resembles the user experience"; the `name` option matches the accessible name (*read*) · covers our angle: **partial** — nothing on hard-to-query components being hard to use · fetched 2026-10-13
- **Beyond the docs:** [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) · Kent C. Dodds, 2020-05-04 · "Not using `*ByRole` most of the time", plus a separate section on adding `aria-` and `role` attributes incorrectly (*read*) · fetched 2026-10-13

### T14-12 · Snapshot tests — Know · ✅ written `docs/react/pages/phase-14-correctness/12-snapshot-tests.md`
- **Read this:** [Snapshot Testing](https://jestjs.io/docs/snapshot-testing) · Jest docs · Best Practices: treat snapshots as code, keep them short and focused, and "fight against the habit of regenerating snapshots" (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Snapshot](https://vitest.dev/guide/snapshot) · Vitest docs · `toMatchInlineSnapshot`; in CI mismatches and missing snapshots fail the run (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Effective Snapshot Testing](https://kentcdodds.com/blog/effective-snapshot-testing) · Kent C. Dodds, 2017-10-30 · snapshots over "more than a few dozen lines" suffer maintenance problems; keep them small and prefer explicit assertions; written for Jest-era tooling and does not cover inline snapshots (*read*) · fetched 2026-10-13

### T14-13 · Testing Server Components and async components — Know · ✅ written `docs/react/pages/phase-14-correctness/13-testing-server-components.md`
- **Read this:** [How to set up Vitest with Next.js](https://nextjs.org/docs/app/guides/testing/vitest) · Next.js docs, v16.4.0, last updated 2026-08-25 · "Vitest currently does not support" `async` Server Components; unit-test synchronous Server and Client Components and use E2E tests for `async` ones (*read*) · covers our angle: **partial** — one framework and one runner, no advice on pushing logic out of components · fetched 2026-10-13
- **Also good:** [Server Components](https://react.dev/reference/rsc/server-components) · react.dev · the concept only; no testing content (*read*) · fetched 2026-10-13
- **Our delta:** how to push logic out of async components so it can be unit-tested; no page found. Not searched.

### T14-14 · Flaky tests, fake timers and CI — Know · ✅ written `docs/react/pages/phase-14-correctness/14-flaky-tests-and-ci.md`
- **Read this:** [Timer Mocks](https://jestjs.io/docs/timer-mocks) · Jest docs · `useFakeTimers`, `runAllTimers`, `advanceTimersByTime`; `runAllTimers` throws after 100,000 timers on recursive timers (*read*) · covers our angle: **partial** — timers only, not unawaited promises or CI · fetched 2026-10-13
- **Also good:** [Mocking timers](https://vitest.dev/guide/mocking/timers) · Vitest docs · `vi.useFakeTimers()` and `vi.advanceTimersByTime` (*read*) · [`act`](https://react.dev/reference/react/act) · react.dev (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Test Isolation with React](https://kentcdodds.com/blog/test-isolation-with-react) · Kent C. Dodds, 2018-07-02 · rendering once at module level makes tests share mutable state, so skipping one breaks later ones; render per test (*read*) · covers our angle: **partial** — never says "flaky" and has nothing on timers; it notes its first example would not work with RTL 9.0.0 or later · fetched 2026-10-13
