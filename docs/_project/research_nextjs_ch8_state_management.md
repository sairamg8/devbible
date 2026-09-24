---
name: research-nextjs-ch8-state-management
description: Banked primary-source research for Next.js chapter 08 (state management in an RSC world) — verbatim quotes with URLs and lastUpdated dates for searchParams, the RSC boundary, Server Actions, the React 19 hooks, nuqs, zustand, jotai, TanStack Query and RTK. Spend this instead of re-fetching in ch10, ch15 and ch18.
metadata:
  type: reference
---

# Research bank — Next.js ch08 · State management in an RSC world

**Collected 2026-09-05, session `989fb824`, across four `devbible-author` forks (~25 fetches).**
🔴 **Do not re-fetch any of this.** Every quote is verbatim with its URL and the doc's own
`lastUpdated:`. Target **Next.js 16.3.4**, **React 19.2.8**.

🔴 **Method note that saved this chapter once:** `nextjs.org/docs` serves Markdown — append `.md`
or send `Accept: text/markdown`. The frontmatter `version:` is the docs build and is identical
everywhere (never evidence); `lastUpdated:` is the real review date. A wrong path returns a
readable "Page Not Found" body that summarises like real content.

## `searchParams` and query state

`/docs/app/api-reference/file-conventions/page` · `lastUpdated: 2026-06-09`
- *"A promise that resolves to an object containing the search parameters of the current URL."*
- *"`searchParams` is a plain JavaScript object, not a `URLSearchParams` instance."*
- 🔴 *"`searchParams` is a **Request-time API** whose values cannot be known ahead of time. Using it will opt the page into **dynamic rendering** at request time."*
- *"With Cache Components, where you access `searchParams` in the component tree determines how much of the page can be prerendered."*
- *"Types are generated during `next dev`, `next build`, or with `next typegen`."*
- `/shop?a=1&a=2` → `Promise<{ a: ['1', '2'] }>`

`/docs/app/api-reference/functions/use-search-params` · `lastUpdated: 2026-07-14`
- 🔴 *"If a route is prerendered, calling `useSearchParams` will cause the Client Component tree up to the closest `Suspense` boundary to be client-side rendered."*
- 🔴 *"In development, routes are rendered on-demand, so `useSearchParams` doesn't suspend and things may appear to work without `Suspense`."* — the works-in-dev-fails-in-prod trap.
- *"Prefer using `connection()` instead, as it semantically ties dynamic rendering to the incoming request."*

`/docs/app/api-reference/file-conventions/layout` · `lastUpdated: 2026-05-27`
- *"Layouts do not rerender on navigation, so they cannot access search params which would otherwise become stale."*

`/docs/app/api-reference/functions/use-router` · `lastUpdated: 2026-07-01`
- *"`router.replace(href, …)`: Perform a client-side navigation to the provided route without adding a new entry into the browser's history stack."*
- 🔴 *"You must not send untrusted or unsanitized URLs to `router.push` or `router.replace` … `javascript:` URLs … will be executed in the context of your page."*
- ⚠️ **The reference documents the options as `{ scroll, transitionTypes }` and says nothing about transitions or a pending flag.** `router.replace` inside `startTransition` is ecosystem practice, not a documented Next.js guarantee — ch08 says so explicitly rather than asserting it. `useLinkStatus` is the *documented* pending signal, and only for `<Link>`.

`/docs/app/api-reference/components/link` · `lastUpdated: 2026-08-25`
- *"if the Page is not visible in the viewport, Next.js will scroll to the top of the first Page element."*
- *"**Prefetching is only enabled in production**."*

## Caching and prerendering

`/docs/app/getting-started/caching` · `lastUpdated: 2026-08-25`
- *"The deeper your async work sits in the tree, the more of the page can be prerendered."*
- *"`<Suspense>` provides a fallback UI while async work completes, but it does not itself opt a component into dynamic rendering."*
- *"Because `<CachedContent />` is gated behind request data, it isn't added to the prerendered static shell. At runtime it's cached in-memory by default, which doesn't persist across serverless requests… Reach for `'use cache: remote'` for durable, shared caching."*
- *"It costs a server invocation per prefetchable link."*
- *"When a `<Link>` to `/search?q=shoes` is prefetched, the framework resolves `searchParams` from the link's URL, so the cached `search` result is included in the runtime prerender before the click."*
- *"Every produced static shell can be served directly from a CDN, without going through to the upstream server."*

⚠️ **Not settled after one attempt:** how a `'use cache'` function's arguments form its cache key.
ch08 argues "keep user-controlled values out of cached-function arguments" **from cardinality, as
a design rule**, and says on the page that it is not a quoted framework guarantee.

## Server Actions and invalidation

`/docs/app/guides/server-actions` · `lastUpdated: 2026-06-17`
- 🔴 *"`revalidateTag` with a stale-while-revalidate profile is the exception: it marks the tag for background refresh and does **not** include a re-render in the action response. The page reflects the change on a later read."* — **every optimistic snap-back in this chapter traces here.**
- *"When `updateTag`, `revalidatePath`, or `refresh` runs, Next.js re-renders the current route server-side and includes a newly rendered RSC Payload in the action's response…"*
- 🔴 *"Next.js dispatches Server Actions one at a time per client. If a user triggers three actions in quick succession, the second waits for the first to finish, then the third waits for the second."*
- *"Treat every action as an untrusted entry point."* · *"Render-time gating … is not a security boundary."* · *"Constrain return values."*
- *"Schema validation (zod or similar) only checks the *shape* of the input. A well-formed `Item` object can still refer to a row the caller does not own."*
- *"Action requests are capped at 1MB by default."* · *"set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to a stable key shared across instances."*

`/docs/app/api-reference/functions/revalidateTag` · `lastUpdated: 2026-08-25`
- 🔴 *"Tags are case-sensitive and must not exceed 256 characters. A tag that exceeds the limit is never assigned to cached data, so revalidating it does nothing."* — a silent no-op.
- *"A revalidation is triggered by a request, not by the `revalidateTag` call, so pages using the tag revalidate as they are visited rather than all at once."*
- *"No second argument (deprecated): Behaves like `{ expire: 0 }`."*

`/docs/app/api-reference/functions/cookies` · `lastUpdated: 2026-06-09`
- *"Setting cookies is not supported during Server Component rendering."*
- *"HTTP does not allow setting cookies after streaming starts, so you must use `.set` in a Server Function or Route Handler."*
- *"After you set or delete a cookie in a Server Function, Next.js can return both the updated UI and new data in a single server roundtrip…"* / *"The UI is not unmounted, but effects that depend on data coming from the server will re-run."*

## The server/client boundary

`/docs/app/guides/server-and-client-boundary` · `lastUpdated: 2026-08-25`
- *"**Code** crosses through imports. Whatever a Client Component imports is pulled into the client bundle."* / *"**Data** crosses through props, and it must be serializable, so functions like event handlers cannot cross."*
- *"A Server Function is not distinguishable from a plain function by its type. The TypeScript plugin allows a Client Component prop typed as a function when its name is `action` or ends in `Action`."*
- *"A rendered React element can cross the boundary because it is serializable data."*
- 🔴 Compound components: *"A Server Component that imports a Client Component receives a client reference instead of the function. As a result, `Menu.Item` is `undefined`, and React throws "Element type is invalid.""*
- *"Identical `fetch` requests are memoized during a server render."*

`/docs/app/getting-started/server-and-client-components` · `lastUpdated: 2026-08-25`
- *"Once a file is marked with `"use client"`, **all of its imports and the components it directly renders are included in the client bundle**. […] It does not apply to Server Components passed as children or other props."*
- *"React context is not supported in Server Components."* / *"You should render providers as deep as possible in the tree"*
- *"In Next.js, installing `server-only` or `client-only` is **optional**."*

`/docs/app/guides/data-security` · `lastUpdated: 2026-08-25`
- *"Use classes to avoid accidentally passing the whole object to the client."* · *"Functions and classes are already blocked from being passed to Client Components by default."*
- *"only the Data Access Layer should access `process.env`."*
- Server Action IDs *"are created during compilation and are cached for a maximum of 14 days."*

`react.dev/reference/rsc/use-client` — serializable set: string, number, bigint, boolean, undefined, null, globally-registered symbols; String/Array/Map/Set/TypedArray/ArrayBuffer; Date, plain objects, Server Functions, JSX elements, **Promises**. Not serializable: non-exported functions, *"Classes"*, class instances, null-prototype objects, non-global symbols.
⚠️ **Unsettled:** whether React ever preserves referential identity of a deserialized prop across payloads. Neither source states it; ch08 calls it unspecified.

## The React 19 hooks

`react.dev/reference/react/useOptimistic`
- *"It is equal to `value` unless an Action is pending, in which case it is equal to the state returned by `reducer`."*
- 🔴 *"The set function must be called inside an Action. If you call the setter outside an Action, React will show a warning and the optimistic state will briefly render."*
- *"There's no extra render to 'clear' the optimistic state."* · *"If `items` changes while the Action is pending, React re-runs your `reducer` with the new `items`…"*
- Error strings: `An optimistic state update occurred outside a Transition or Action.` · `Cannot update optimistic state while rendering.`

`react.dev/reference/react/useActionState`
- 🔴 **react.dev has renamed the first parameter to `reducerAction` and generalised the payload to `actionPayload`.** The `(previousState, formData)` shape is now documented as the `<form action>` case specifically.
- *"React queues and executes multiple calls to `dispatchAction` sequentially."* · *"When a `reducerAction` throws, React skips all subsequently queued `dispatchAction` calls."*

`react.dev/reference/react/useFormStatus`
- 🔴 *"It will not return status information for any `<form>` rendered in that same component or children components."*

`react.dev/reference/react/useTransition`
- *"Transition updates can't be used to control text inputs."* · *"A state update marked as a Transition will be interrupted by other state updates."*

`react.dev/reference/react/useContext` — *"React automatically re-renders all the children that use a particular context starting from the provider that receives a different `value`. The previous and the next values are compared with the `Object.is` comparison."*

`react.dev/reference/react/useSyncExternalStore` — *"The server snapshot must be the same between the client and the server… If you omit this argument, rendering the component on the server will throw an error."*

`/docs/app/guides/interactive-apps` · `lastUpdated: 2026-08-25` — **a guide this track had not used before, and it is directly on-topic**
- 🔴 *"`useActionState` runs the action as a transition… State updates after the `await` aren't automatically part of that transition… Without it, the dialog closes first and the board updates a frame later."*
- *"The `key` in the returned state controls form reset. On success, `key` increments, which remounts the `<div key={key}>` and resets every input inside it."*
- *"Split the comment list into two parts. A server component renders the persisted comments, and a client component tracks only the **pending** comments using `useOptimistic([])` with an empty initial array."*

`/docs/app/guides/forms` · `lastUpdated: 2026-08-25`
- *"In React 19, `useFormStatus` includes additional keys on the returned object, like data, method, and action."*
- *"With the **experimental** `useOffline` config enabled, a Server Action interrupted by a connectivity drop stays pending and completes when the network returns…"*

## The libraries (versions read from the npm registry 2026-09-05)

**nuqs 2.10.1** — `nuqs.dev/docs/options`: *"Safari's rate limits are much stricter and use a default throttle of 120ms (320ms for older versions of Safari)."* · `/docs/limits`: *"Exceeding the 2,000-character range may indicate the need to reconsider your state management approach."* · 🔴 `/docs/server-side`: *"Loaders **don't validate** your data."*

**zustand 5.0.15** — `github.com/pmndrs/zustand/blob/main/docs/learn/guides/nextjs.md`: 🔴 *"**No global stores** - Because the store should not be shared across requests, it should not be defined as a global variable."* · *"React Server Components should not read from or write to the store."* · *"Having different outputs on both the client and the server will result in 'hydration errors.'"* · `migrating-to-v5`: *"If a selector returns a new reference, it may cause infinite loops."* (→ `Maximum update depth exceeded`; `useShallow` is the fix). ⚠️ The Next.js guide carries an upstream banner saying it will be updated (discussion #2740).

**jotai 2.20.3** — `docs/guides/nextjs.mdx`: 🔴 *"this global store is kept alive and is shared between multiple requests, which can lead to bugs and security risks."* · `docs/utilities/ssr.mdx`: *"Atoms can only be hydrated once per store."* ⚠️ `atomWithHash` documents a dependency on `Router.events`, which the App Router does not expose — ch08 quotes that and redirects to query-string mechanisms rather than asserting current behaviour.

**TanStack Query 5.102.8** (`@tanstack/query-core` and `@tanstack/react-query-next-experimental` share the version)
- 🔴 *"If you are just starting out with a new Server Components app, we suggest you start out with any tools for data fetching your framework provides you with and avoid bringing in React Query until you actually need it."*
- *"From the React Query perspective, treat Server Components as a place to prefetch data, nothing more."*
- *"We do **not** recommend using Next.js Server Actions to _fetch_ data in a `queryFn`… Server Actions remain a good fit for **mutations** (`useMutation`)."*
- 🔴 **The docs on `main` show `queryClient.query()` and `environmentManager.isServer()`, which read as unreleased v6 API. They are not.** Fork C read the published type declarations at `cdn.jsdelivr.net/npm/@tanstack/query-core@5.102.8/build/modern/…` and confirmed both ship in 5.102.8. **Reading published `.d.ts` from a CDN is a legitimate T1 probe when the package is not installed locally — reuse this.**

**Redux Toolkit 2.12.0 / react-redux 9.3.0**
- *"RSCs should not read or write the Redux store… only use Redux for globally shared, mutable data."* · *"We recommend using RTK Query for data fetching **on the client only**."*
- ⚠️ **No documented server-prefetch equivalent of `HydrationBoundary` exists.** The docs say *"In the future, RTK Query may be able to receive data fetched on the server via React Server Components, but that is a future capability…"* ch08 teaches prop-seeded slices instead rather than inventing one.

**MDN Pointer events** — *"Pointer capture will cause the target to capture all subsequent pointer events… Accordingly, `pointerover`, `pointerenter`, `pointerleave`, and `pointerout` will not fire as long as this capture is set."* · *"For touchscreen browsers… an implicit pointer capture will be called on the element when a `pointerdown` event triggers."* · `pointercancel` fires when *"the browser decided to interpret the interaction as a pan/zoom instead"*.

## Deliberately not asserted anywhere in the chapter

A maximum URL length (no spec limit exists to cite) · per-browser touch support for the HTML5
drag events · any latency, frame-rate, request-count or dataset threshold · whether a client cache
beats a warm Router Cache on navigation (*"a latency question with an actual number attached, and
you should measure it rather than assume it"*) · when React will fix the post-`await` transition
limitation.
