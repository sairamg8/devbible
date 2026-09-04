---
title: "08 · State management in an RSC world"
sidebar_label: "Overview"
sidebar_position: 0
description: "Almost every state-management bug in an App Router application is the same fact stored in two places — and the work is deciding which of four owners holds a value, not choosing a library."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js
> [`page.js`](https://nextjs.org/docs/app/api-reference/file-conventions/page) (`lastUpdated: 2026-06-09`),
> [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (`2026-08-25`),
> [the server/client boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary) (`2026-08-25`),
> [Caching](https://nextjs.org/docs/app/getting-started/caching) (`2026-08-25`),
> [Server Actions](https://nextjs.org/docs/app/guides/server-actions) (`2026-06-17`),
> [Interactive apps](https://nextjs.org/docs/app/guides/interactive-apps) (`2026-08-25`),
> [Forms](https://nextjs.org/docs/app/guides/forms) (`2026-08-25`),
> [Data security](https://nextjs.org/docs/app/guides/data-security) (`2026-08-25`),
> [`useSearchParams`](https://nextjs.org/docs/app/api-reference/functions/use-search-params) (`2026-07-14`),
> [`useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router) (`2026-07-01`),
> [`cookies`](https://nextjs.org/docs/app/api-reference/functions/cookies) (`2026-06-09`) and
> [`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag) (`2026-08-25`);
> the react.dev references for `useActionState`, `useOptimistic`, `useFormStatus`,
> `useSyncExternalStore`, `useContext` and `useTransition`; and the published docs for
> **nuqs 2.10.1**, **zustand 5.0.15**, **jotai 2.20.3**, **TanStack Query 5.102.8** and
> **Redux Toolkit 2.12.0**.
> Target: **Next.js 16.3.4**, **React 19.2.8**, App Router. Documentation-verified; **no sandbox run**.

**In the App Router, "state management" is mostly a placement decision, and the library question comes last.** A value in a running application is owned by exactly one of four things: the **server** and the framework cache that holds its output, the **URL**, a **cookie or session**, or **client memory**. Choosing wrongly is not a style mistake — it is what produces the bugs this chapter is made of, and nearly all of them reduce to one sentence: *the same fact is stored in two places and they have drifted.* A filter kept in `useState` produces a link that opens somebody else's board unfiltered. A board mirrored into a store shows a card that the database moved ten minutes ago. A store instantiated at module scope on the server hands one user's data to the next request.

The chapter is ordered as the decision itself: what the four owners are and how a value crosses between them, when the framework's own data flow is already enough, then the three answers when it is not — the URL, a client store, a client cache — and finally the two React hooks that remove the need for a store in the most common case of all.

Two framework facts run through every page and are worth carrying in before you start:

- 🔴 **`searchParams` is a request-time API, and *where* you await it decides how much of the page can be prerendered.** *"Using it will opt the page into dynamic rendering at request time."* Query state is therefore free in shareability and never free in rendering strategy — which is why topic 03 spends four pages on the static shell, caching and prefetching rather than on parsing.
- 🔴 **`revalidateTag` under a stale-while-revalidate profile ships no re-render in the Server Action's response.** It marks the tag for background refresh and returns; the page reflects the change on a later read. Every "my optimistic update snapped back" report in this chapter traces to that sentence, and `updateTag` or `refresh()` is usually the call that was wanted.

## Chunks

### 01 · The fundamental split

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The fundamental split](01-the-fundamental-split-server-state-data-on-the-server-cached.md)** | The two axes — lifetime and ownership — and why "which component renders it" is the wrong question |
| 2 | **[The categories the table omits](01b-the-categories-the-table-omits.md)** | Cookies, sessions and DOM state, plus the five-question decision procedure the rest of the chapter applies |
| 3 | **[The payload is the transport](01c-the-rsc-payload-is-the-transport.md)** | Serialization across the boundary, what may cross as a prop, and what throws |
| 4 | **[Request vs process scope](01d-request-scope-versus-process-scope.md)** | The module-level singleton that leaks one user's data into the next request |
| 5 | **[Stale mirrors and drift](01e-the-stale-mirror-and-the-drifting-store.md)** | The failure the whole chapter is about: one fact, two homes |

### 02 · When RSC data flow is enough

| # | Chunk | Covers |
|---|---|---|
| 6 | **[When RSC data flow is enough](02-when-rsc-data-flow-is-enough.md)** | The four moves the framework already gives you, and the signals that they are not sufficient |
| 7 | **[The symptom that lies](02b-the-symptom-that-lies.md)** | Diagnosing "we need a state manager" when the real fault is a boundary in the wrong place |
| 8 | **[Look-alikes: URL, cookies, optimistic](02c-look-alikes-url-cookies-and-optimistic.md)** | Three cases that look like they need a store and do not |
| 9 | **[Look-alikes: forms, boundaries, streaming](02d-look-alikes-forms-boundaries-and-streaming.md)** | Three more, including the form that needs no client state at all |
| 10 | **[The cost of getting it wrong](02e-the-cost-of-getting-it-wrong.md)** | What a needless store costs, what a missing one costs, and a review checklist |

### 03 · URL as state

| # | Chunk | Covers |
|---|---|---|
| 11 | **[URL as state — the store you already ship](03-url-as-state-searchparams-nuqs-style-patterns-shareable-filt.md)** | `searchParams` as a promise, what the URL gives you for free, and what it costs |
| 12 | **[URL state and the static shell](03b-url-as-state-and-the-static-shell.md)** | Where you await `searchParams` decides how much prerenders |
| 13 | **[Caching query-driven routes](03c-caching-query-driven-routes.md)** | `use cache`, cardinality, and why user-controlled values make poor cache keys |
| 14 | **[Prefetching, and opting out](03d-prefetching-query-driven-routes-and-opting-out.md)** | A server invocation per prefetchable link, and when to turn it off |
| 15 | **[Reading the URL from a client component](03e-url-as-state-reading-from-a-client-component.md)** | `useSearchParams`, the Suspense requirement, and why it works in dev and fails in prod |
| 16 | **[Writing the URL declaratively](03f-url-as-state-writing-declaratively.md)** | `<Link>` and `<form method="get">`, the versions that work without JavaScript |
| 17 | **[Writing the URL programmatically](03g-url-as-state-writing-programmatically.md)** | `router.replace`, `scroll: false`, transitions, and the input that must not lock up |
| 18 | **[Shallow updates and the History API](03h-url-as-state-shallow-updates-and-the-history-api.md)** | What the App Router does not have, and what `history.replaceState` does instead |
| 19 | **[Encoding and parsing query state](03i-url-as-state-encoding-and-parsing.md)** | Arrays, ranges, booleans and dates, and reading them back defensively |
| 20 | **[Validating query state, and canonical URLs](03j-url-as-state-validating-and-canonical-urls.md)** | `searchParams` is user input: zod at the edge, and one canonical form per view |
| 21 | **[nuqs — search params as a library](03k-nuqs-typed-search-params-as-a-library.md)** | Typed parsers, batching and throttling, and the browser rate limits behind them |
| 22 | **[nuqs on the server, and when to hand-roll](03l-nuqs-on-the-server-and-when-to-hand-roll.md)** | Its loaders parse and do not validate — and when hand-rolling is the right call |

### 04 · Client state tools compared

| # | Chunk | Covers |
|---|---|---|
| 23 | **[Context is not a state manager](04-client-state-tools-compared-react-context-zustand-jotai.md)** | What Context is actually for, and the provider placement rule RSC imposes |
| 24 | **[Context re-renders, and containing them](04b-context-re-renders-and-how-to-contain-them.md)** | The fan-out, split contexts, and the `Object.is` comparison that drives it |
| 25 | **[useSyncExternalStore, the escape hatch](04c-usesyncexternalstore-the-escape-hatch.md)** | Subscribing to an external store, and the server snapshot that must match |
| 26 | **[Zustand in an RSC app](04d-zustand-in-an-rsc-app.md)** | The per-request provider factory, selectors, and `useShallow` in v5 |
| 27 | **[Jotai in an RSC app](04e-jotai-in-an-rsc-app.md)** | Atoms, the default store's request-sharing problem, and `Provider` |
| 28 | **[Jotai under SSR](04f-jotai-under-ssr.md)** | Hydrating atoms once per store, and `atomWithHash` against the App Router |
| 29 | **[Choosing, and when it is none of them](04g-choosing-a-client-state-tool.md)** | The decision table, and the cases React already answers |

### 05 · Client caches

| # | Chunk | Covers |
|---|---|---|
| 30 | **[Client caches: do you need one?](05-tanstack-query-rtk-query-in-app-router-when-a-client-cache-s.md)** | What a client cache does that the framework cache structurally cannot |
| 31 | **[Prefetch + HydrationBoundary](05b-server-prefetch-and-hydrationboundary.md)** | Seeding a client cache from a Server Component without duplicating it |
| 32 | **[Nested prefetch and streaming](05c-nested-prefetch-and-streaming.md)** | Prefetching deeper in the tree, and how it interacts with streaming |
| 33 | **[When the two caches disagree](05d-when-the-two-caches-disagree.md)** | The drift failure in its most expensive form |
| 34 | **[Invalidating both caches](05e-invalidating-both-caches.md)** | One mutation, two invalidations, and the order that works |
| 35 | **[RTK Query and Redux](05f-rtk-query-and-the-redux-question.md)** | Why its own docs recommend client-only fetching, and prop-seeded slices instead |

### 06 · The framework-native hooks

| # | Chunk | Covers |
|---|---|---|
| 36 | **[useActionState](06-useoptimistic-and-useactionstate-as-framework-native-alterna.md)** | The signature, the first argument people forget, and error state without a store |
| 37 | **[Queuing and errors](06b-queuing-and-errors.md)** | Actions dispatch one at a time per client, and what a throw does to the queue |
| 38 | **[Reset, transitions, permalink](06c-reset-transitions-and-permalink.md)** | Resetting a form by key, the post-`await` transition trap, and progressive enhancement |
| 39 | **[useOptimistic](06d-useoptimistic.md)** | Why the optimistic value only lives inside an Action, and how it re-bases |
| 40 | **[Optimistic patterns](06e-optimistic-patterns-and-pending-feedback.md)** | Pending lists, the two-part split, and updater functions over stale values |
| 41 | **[Pending feedback](06f-pending-feedback-and-useformstatus.md)** | `useFormStatus` and the child-of-the-form rule that trips everyone once |
| 42 | **[Where the hooks stop](06g-where-the-framework-hooks-stop.md)** | The cases these two genuinely do not cover, and what returns then |

### 07 · Project milestone — SprintDesk

| # | Chunk | Covers |
|---|---|---|
| 43 | **[Milestone: state ownership](07-project-milestone-sprintdesk-board-filters-in-the-url.md)** | The board's four owners, decided before a line is written |
| 44 | **[The filter contract](07b-milestone-filters-on-the-server.md)** | One validated module that parses, defaults and serialises every filter |
| 45 | **[Filters in the page](07c-milestone-reading-filters-in-the-page.md)** | Reading the contract in a Server Component, and keeping the shell prerenderable |
| 46 | **[The filter bar](07d-milestone-the-filter-bar.md)** | Writing the URL without locking the input or scrolling the board |
| 47 | **[The scoped store](07e-milestone-the-scoped-zustand-store.md)** | A per-mount provider factory holding only ephemeral UI |
| 48 | **[Selectors and resets](07f-milestone-selectors-resets-and-hydration.md)** | Selector discipline, resetting on navigation, and hydration |
| 49 | **[The drag gesture](07g-milestone-the-drag-layer.md)** | Pointer events and capture, with no drag-and-drop library |
| 50 | **[The drop target](07h-milestone-finding-the-drop-target.md)** | Hit-testing columns, and the events capture suppresses |
| 51 | **[Ranks and keyboard moves](07i-milestone-ranks-and-the-accessible-move-path.md)** | Fractional ranks, and a move path that never needs a mouse |
| 52 | **[The optimistic drop](07j-milestone-the-drop-the-action-and-reconciliation.md)** | `useOptimistic` across the drop, and reconciling a server that disagrees |
| 53 | **[The action and the tags](07k-milestone-the-action-and-what-invalidates-what.md)** | What invalidates what, and the snap-back that means you picked the wrong one |
| 54 | **[The bill](07l-milestone-what-it-costs-and-where-it-generalises.md)** | What this design costs, where readers deviate, and the same pattern on a table |

### Invalidating from an action

| # | Chunk | Covers |
|---|---|---|
| 55 | **[refresh()](10-refresh.md)** | The one `next/cache` function that invalidates nothing, and why that is the point |
| 56 | **[refresh() vs the alternatives](10b-refresh-against-the-alternatives.md)** | Against `revalidateTag`, `revalidatePath`, `updateTag` and `router.refresh()` |

---

[Chapter 7 · Error handling, loading states and resilience](../07-error-handling-loading-states-and-resilience/01-explanation.md) · Next → [01 · The fundamental split](01-the-fundamental-split-server-state-data-on-the-server-cached.md)
