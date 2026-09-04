---
title: "A board has four kinds of state and only one of them belongs in a store — the milestone is the ownership table, and every bug in this chapter is a row filed under the wrong owner"
sidebar_label: "07 · Milestone: state ownership"
sidebar_position: 43
description: "Chapter 8's capstone, act one: enumerating every piece of SprintDesk board state, assigning each to the URL, the server cache, the scoped client store or the optimistic overlay by four yes/no questions, and the build order that falls out of those assignments."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-05 against the Next.js [`page.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/page)
> (`lastUpdated: 2026-06-09`), the [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions)
> (`lastUpdated: 2026-06-17`), the [`revalidateTag` reference](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
> (`lastUpdated: 2026-08-25`), React's [`useOptimistic`](https://react.dev/reference/react/useOptimistic)
> and the Zustand [Setup with Next.js](https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/nextjs.md) guide.
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · **zustand 5.0.15** · **zod 4.4.3** ·
> TypeScript 7.0.2. Documentation-verified; **no sandbox run** — no timings, no request counts and
> no console transcripts appear anywhere in this milestone.

**"Where does this state live?" has exactly four answers in an App Router application, and a board is the one screen that needs all four at once.** SprintDesk's board holds filters, columns, cards, a drag in progress, a multi-select, an open card and a set of collapsed columns — and if you file any of them under the wrong owner you get a specific, reproducible bug: a filter that cannot be shared, a drag that survives a navigation, a card that snaps back after a successful move, or a user seeing another user's board because a store outlived a request. This page is act one: the table that assigns every row an owner, the four questions that produce the assignment, and the build order the assignments imply. Every later chunk implements one row of it.

## The board, and everything it remembers

The route is `app/(dashboard)/boards/[boardId]/page.tsx`. Rendered, it is columns of cards you can filter, drag between columns, multi-select and open. Enumerated as state, it is eleven distinct things:

| # | State | Example value | Owner |
|---|---|---|---|
| 1 | Status filter | `?status=doing` | **URL** |
| 2 | Assignee filter | `?assignee=u_7g2` | **URL** |
| 3 | Free-text query | `?q=flaky+test` | **URL** |
| 4 | The card rows | 240 rows from Postgres | **server cache** (tagged) |
| 5 | Per-column counts | `{ todo: 12, doing: 4 }` | **server cache** (same tag) |
| 6 | The card being dragged | `card_91`, offset `(14, 22)` | **client store** |
| 7 | The column the pointer is over | `col_doing` | **client store** |
| 8 | Multi-select set | `Set { card_91, card_44 }` | **client store** |
| 9 | Collapsed columns | `Set { col_done }` | **client store** |
| 10 | The open card | `card_91` | **URL** — see below |
| 11 | The move that has not been confirmed | `card_91 → col_done @ rank 3.5` | **optimistic overlay** |

Eleven rows, four owners. Row 10 is the one people argue about and it is settled by the same questions as every other row.

## The four questions that assign an owner

Ask them in order. The first `yes` wins.

**1 · Must it survive a full page reload *and* appear in a link the user pastes into Slack?**
→ **URL.** Filters (1–3) and the open card (10). A teammate pasting `?status=doing&assignee=u_7g2` must see what you saw. There is no other mechanism that gives you reload-safety, back/forward and shareability for free; a store gives you none of the three.

**2 · Is it derived from the database, and would two users looking at the same board expect the same value?**
→ **server cache.** The rows and the counts (4–5). This is the answer the whole chapter defends: RSC already has a cache, it is tagged, and it invalidates on mutation. Copying those rows into a client store gives you a second cache with no invalidation protocol, which is the "same fact in two places" failure named below.

**3 · Is it meaningless outside this mount — would restoring it on a fresh page load be wrong rather than merely unnecessary?**
→ **client store.** Rows 6–9. A drag in progress restored after a reload is nonsense. A collapsed column is *nearly* URL-worthy, and the boundary is that nobody shares a link meaning "with the Done column folded".

**4 · Does the user need to see the result before the server has confirmed it?**
→ **optimistic overlay.** Row 11 only. This is not a store. It is a value that exists for the duration of one transition and then ceases to exist, which is exactly what `useOptimistic` gives you:

> *"`optimisticState`: The current optimistic state. It is equal to `value` unless an Action is pending, in which case it is equal to the state returned by `reducer`."*
> — [`useOptimistic`, Returns](https://react.dev/reference/react/useOptimistic#returns)

The word doing the work is **pending**. An optimistic value has no lifetime of its own; it borrows the transition's. Anything that must outlive the transition is one of the other three owners, and trying to make `useOptimistic` hold it produces [07j](07j-milestone-the-drop-the-action-and-reconciliation.md)'s hardest bug.

### Why the open card is URL state and the multi-select is not

Both are "a card id the UI is holding". They differ on question 1. A card detail panel is a thing you send someone — `?card=card_91` deep-links to it, the back button closes it, and a refresh keeps it open. A multi-select of nine cards is a thing you build in ten seconds and destroy in one; putting it in the URL means every checkbox click is a navigation and a history entry, and pasting the link gives a colleague a selection they did not make. Same shape, different answer, and the questions say which.

### Where each owner is taught in this chapter

The milestone assembles four things the chapter has already argued for separately. If an owner's assignment looks arbitrary, the argument is there, not here:

| Owner | The chapter topic that argues for it |
|---|---|
| URL | [URL as state — `searchParams`, `nuqs`-style patterns, shareable filters](03-url-as-state-searchparams-nuqs-style-patterns-shareable-filt.md) |
| Server cache | [The fundamental split: server state, data on the server, cached](01-the-fundamental-split-server-state-data-on-the-server-cached.md) and [When RSC data flow is enough](02-when-rsc-data-flow-is-enough.md) |
| Client store | [Client state tools compared: React Context, Zustand, Jotai](04-client-state-tools-compared-react-context-zustand-jotai.md) |
| Optimistic overlay | [`useOptimistic` and `useActionState` as framework-native alternatives](06-useoptimistic-and-useactionstate-as-framework-native-alterna.md) |
| The client cache you did *not* need | [TanStack Query / RTK Query in App Router](05-tanstack-query-rtk-query-in-app-router-when-a-client-cache-s.md) |

## The build order, and why it is this order

1. **The filter contract** — [07b](07b-milestone-filters-on-the-server.md). The parse-and-validate module is the thing every other piece reads: the page reads it, the filter bar writes URLs that satisfy it, and the drop handler needs the same predicate to know whether a moved card still matches. Build the contract first and the other three have something to conform to; build it last and you retrofit three call sites.
2. **Reading it in the page** — [07c](07c-milestone-reading-filters-in-the-page.md). Where the `await` goes, what the cached read takes as an argument, and why a filter change invalidates nothing.
3. **The filter bar** — [07d](07d-milestone-the-filter-bar.md). Pure client, no store, no server dependency beyond the URL shape from step 1. It can be finished and verified on its own.
4. **The scoped store** — [07e](07e-milestone-the-scoped-zustand-store.md), then [07f](07f-milestone-selectors-resets-and-hydration.md) for using it without a re-render storm. Before the drag layer, because the drag layer is nothing but a writer into this store. Getting the provider factory wrong here is the only defect in the milestone with a security consequence, so it gets its own step rather than being an implementation detail of step 5.
5. **The drag layer** — the gesture in [07g](07g-milestone-the-drag-layer.md), the drop target in [07h](07h-milestone-finding-the-drop-target.md), ranks and the keyboard path in [07i](07i-milestone-ranks-and-the-accessible-move-path.md). No network, no server, no optimism: it ends by producing a `MoveIntent` object and nothing else.
6. **The drop and the reconciliation** — the optimistic client half in [07j](07j-milestone-the-drop-the-action-and-reconciliation.md), the Server Action and the invalidation in [07k](07k-milestone-the-action-and-what-invalidates-what.md). The only step that cannot be verified by reading, because it is the only one whose behaviour depends on what the server says back.
7. **The bill** — [07l](07l-milestone-what-it-costs-and-where-it-generalises.md). What this design costs, where a reader will be tempted to deviate, and the same pattern on a screen that is not a board.

The order is *contract → readers → writers → network*. Reversing any two steps means writing a call site against an interface that does not exist yet, and the interface is where all four owners meet.

## The failure this milestone exists to prevent

Every bug in this chapter is the same bug wearing a different hat: **one fact, two homes, no protocol for keeping them equal.**

- The filter is in the URL *and* in a `useState` inside the filter bar → back button changes the URL, the input still shows the old text.
- The card rows are in the server cache *and* in a Zustand store → a second tab makes a move, the first tab's store never hears about it.
- The card's column is in the database *and* in an optimistic overlay → the overlay expires at a moment the framework chooses, and if the server did not re-render, it expires back onto data that predates the move.
- The filter predicate is in the server query *and* in the optimistic reducer → a card dragged out of the filtered set flickers, because the two predicates disagree for one frame.

Three of those four are genuinely two-homed and are *fixed by deleting one home*. The fourth — the predicate — cannot be deleted, because the optimistic reducer must run on the client and the query must run on the server. That one is paid for with a shared module and a test, and it is the honest cost of optimistic UI. [07l](07l-milestone-what-it-costs-and-where-it-generalises.md) prices it.

## The files this milestone produces

```text
app/(dashboard)/boards/[boardId]/
├── page.tsx                    Server Component: awaits searchParams, parses, queries
├── actions.ts                  'use server': moveCard, with auth + ownership + zod
├── board.tsx                   'use client': the optimistic layer and the drop handler
├── filter-bar.tsx              'use client': writes the URL inside a transition
├── column.tsx                  'use client': registers its element, renders cards
├── rect-registry.tsx           'use client': a ref Map of column and card elements
├── use-card-drag.ts            'use client': the pointer gesture → MoveIntent
├── hit-test.ts                 pure: coordinates + rects → DropTarget
├── optimistic-move.ts          pure: the useOptimistic reducer
├── move-menu.tsx               'use client': the keyboard path to the same MoveIntent
└── move-announcer.tsx          'use client': the aria-live region

lib/board/
├── filters.ts                  the zod schema, the Filters type, the predicate
├── query.ts                    'use cache' + cacheTag: the board read
├── access.ts                   the session-scoped board authorisation check
└── rank.ts                     fractional rank arithmetic and renormalisation

stores/board-ui-store.ts        createStore factory — drag, selection, collapse
providers/board-ui-provider.tsx 'use client': per-mount instance + typed useStore
```

Sixteen files, and the ownership table decides which of them may import which. `stores/` and `providers/` are never imported by `page.tsx`; `lib/board/query.ts` is never imported by a Client Component; `lib/board/filters.ts` is imported by both, on purpose, and it is the only module that is.

## Acceptance criteria you can check by reading the tree

None of these needs the app running. All of them are grep-able or eyeball-able, which is the point — a criterion you can only check by clicking is a criterion nobody checks.

| # | Criterion | How you check it |
|---|---|---|
| 1 | No module-level `create(...)` store holding user data | `grep -rn "^export const use.*= create(" stores/` returns nothing |
| 2 | The store provider creates its instance inside a hook, not at module scope | `board-ui-provider.tsx` contains `useState(() =>` |
| 3 | No server data in the store | the store's state type mentions no `Card` and no `Column` row type, only ids |
| 4 | Filters are parsed exactly once | `filters.ts` exports the schema; `page.tsx` is the only caller of `parseFilters` |
| 5 | Every `searchParams` read is awaited | no `searchParams.` without a preceding `await` |
| 6 | The filter bar writes with `replace`, not `push`, for the text query | `filter-bar.tsx` contains `router.replace` in the debounced path |
| 7 | Every `useSearchParams` caller sits under a `Suspense` boundary | the filter bar is rendered inside `<Suspense>` in `page.tsx` |
| 8 | The action re-reads ownership from the session | `actions.ts` never trusts a `boardId` from the client without a lookup |
| 9 | The move invalidates with `updateTag`, not bare `revalidateTag` | see [07k](07k-milestone-the-action-and-what-invalidates-what.md) — this is the snap-back bug |
| 10 | The optimistic setter is only ever called inside `startTransition` | `grep -n "applyOptimistic" board.tsx` shows every call within a transition body |
| 11 | Drag is not the only way to move a card | a keyboard-accessible move control exists in `card.tsx` |

## Gotchas

**★ You cannot decide ownership per component; you decide it per fact.** The instinct is to ask "should this component use Zustand?" — the wrong unit. Two pieces of state rendered by the same component routinely have different owners: `filter-bar.tsx` reads the status filter from the URL and the "filters panel is expanded" flag from the store, in adjacent lines. Ask the four questions of the *value*, never of the file it happens to be rendered in.

**★ "It needs to be fast" is not an argument for the client store.** The reflex that puts filters in Zustand is latency, not correctness — and it trades a round trip for the loss of sharing, reload-safety and back/forward, three things you then rebuild badly. If the round trip is genuinely the problem, the fix is a smaller round trip (a narrower query, a `Suspense` boundary around only the columns) or client-side filtering *of an already-loaded set*, not a change of owner. [07l](07l-milestone-what-it-costs-and-where-it-generalises.md) gives the decision procedure for when that flips.

**★ A collapsed column is the row that will tempt you into the URL, and the cost is a history entry per click.** `?collapsed=done,archive` is shareable, reload-safe and completely correct — and it also means the back button now un-collapses a column instead of returning to the previous filter, which is not what a user pressing Back is asking for. If you do want it persistent, `localStorage` keyed by board id is the third option that neither the URL nor a store gives you, and it is the right one for "remember how *I* like this board".

**★ Row 11 is not a store row, and treating it as one is the chapter's most expensive mistake.** "Optimistic state" sounds like state, so it gets a `pendingMoves` array in Zustand, and now nothing removes entries from it when the server confirms — because there is no event that says "confirmed", only a re-render with new props. `useOptimistic` exists precisely because that removal is not your job: the value evaporates when the transition ends. Keep the pending move inside the hook.

**★ Multi-tenant boards make the store's scope a security property, not a tidiness one.** `stores/board-ui-store.ts` exporting a ready-made hook created at module scope is a module-level singleton, and on the server a module is shared by every request the process handles. The Zustand guide is explicit:

> *"**No global stores** - Because the store should not be shared across requests, it should not be defined as a global variable. Instead, the store should be created per request."*
> — [Zustand, *Setup with Next.js*](https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/nextjs.md)

The implementation that satisfies this is in [07e](07e-milestone-the-scoped-zustand-store.md); the reason it is step 4 rather than a footnote is this paragraph.

**★ An ownership table with no "nothing owns this" row is usually incomplete.** SprintDesk has one: the pointer's current coordinates during a drag. They live in a ref and never enter React state at all, because a `setState` per `pointermove` re-renders the board sixty times a second to move one element four pixels. "Owned by a ref, written to the DOM directly" is a legitimate fifth answer and [07g](07g-milestone-the-drag-layer.md) uses it.

## Interview questions

**★ You have a filter UI. What is the actual argument for putting its state in the URL rather than a client store, beyond "shareable links"?**
Three things you would otherwise have to build, and one you cannot. Reload-safety: a refresh keeps the view. Back/forward: the browser's history stack becomes your undo for filter changes, for free. Shareability: a pasted link reproduces the view. And the one you cannot build — the server already needs those values to run the query, so if they live in a store you must ship them to the server on every change anyway, which means the URL's job is being done by a POST body with none of the URL's benefits. In the App Router the server reads them straight off the request as the `searchParams` prop; the store version adds a hop and subtracts three features.

**★ A colleague says "let's just load the board into Zustand once and mutate it locally — it'll feel instant." What breaks?**
You have created a second cache with no invalidation protocol. The first tab's copy never learns about the second tab's move. A `revalidateTag` fired by another user's action updates the server cache and the store does not care. Any RSC re-render now fights the store for what renders, and whichever wins is a race. You will then rebuild the missing protocol — polling, or a websocket, or a manual refetch on focus — which is TanStack Query, badly, and at that point you should have used TanStack Query. The narrower version, "hold only the move that has not been confirmed yet", is correct and is what `useOptimistic` does.

**★ Why is the open-card id in the URL but the multi-select is not, when both are just card ids?**
Because the assignment is by behaviour, not by type. The open card passes question 1 — you send someone a link to a card, refreshing should keep the panel open, and Back should close it, all three of which the URL gives you for nothing. The multi-select fails question 1 and passes question 3: it is meaningless outside this mount, and encoding it would put a history entry on the stack per checkbox and hand a pasted link a selection the recipient did not make. Same data type, opposite answers.

**★ What is the difference between "state that lives in the server cache" and "props passed from a Server Component", and does the distinction matter to the client?**
To the client, nothing: it receives rendered output and serialised props either way. The distinction matters to *invalidation*. If the value came from a `'use cache'` function with a `cacheTag`, there is a name a Server Action can call to make it stale, and the framework decides when to re-read. If it came from an uncached read, there is nothing to invalidate and the only way to see a new value is to re-render the route — which is what `refresh()` is for, covered in [10 · `refresh()`](10-refresh.md). Both arrive as props; only one has a handle you can pull.

**★ Where in this design does the same fact deliberately live in two places, and why is that acceptable?**
The filter predicate. The server runs it as a SQL `WHERE`; the optimistic reducer runs it in JavaScript to decide whether a card dragged into `Done` should still be visible under `?status=doing`. It cannot be deleted from either side — the server must filter to avoid shipping 240 rows, and the client must filter to avoid a one-frame flicker where the card sits in a column it no longer belongs to. It is acceptable because it is *one* module (`lib/board/filters.ts`), the duplication is a compiled-in structural fact rather than a runtime copy, and a disagreement between the two produces a visible flicker rather than silent data loss. Every other two-homed fact in the chapter is fixed by deleting a home; this one is fixed by making the two homes share a definition.

**★ What would you check first if a card visually snapped back to its old column immediately after a successful drag?**
Which invalidation the action called. A `revalidateTag` with a stale-while-revalidate profile deliberately does not include a re-render in the action's response — the docs say so directly — so when the transition ends, `useOptimistic` reverts to the `value` prop, which is still the pre-move render. The move committed; the screen disagrees. The fix is `updateTag`, or `revalidateTag(tag, { expire: 0 })`, or `refresh()` if the board read was never cached. Full mechanism in [07k](07k-milestone-the-action-and-what-invalidates-what.md) and the comparison in [10b](10b-refresh-against-the-alternatives.md).

---

← [06g · Where the hooks stop](06g-where-the-framework-hooks-stop.md) · [Chapter 8 overview](01-explanation.md) · Next → [07b · The filter contract](07b-milestone-filters-on-the-server.md)
