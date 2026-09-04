---
title: "Where you await searchParams decides how much of the board prerenders, and what you pass to the cached read decides whether the cache is worth having — the filters go in the render, never in the key"
sidebar_label: "07c · Milestone: filters in the page"
sidebar_position: 161
description: "Chapter 8's capstone, step two: awaiting searchParams inside a Suspense boundary rather than at the top of the page, passing the promise down un-awaited, the cached-and-tagged board read that takes only a board id, and why a filter change invalidates nothing."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the Next.js [`page.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/page)
> (`lastUpdated: 2026-06-09`) and the [`revalidateTag` reference](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
> (`lastUpdated: 2026-08-25`). Target: **Next.js 16.3.4** App Router · **React 19.2.8**.
> Documentation-verified; **no sandbox run**.

**The filter contract from [07b](07b-milestone-filters-on-the-server.md) is pure, so nothing about it can be wrong at runtime; everything that can be wrong lives in the two lines that use it.** `await props.searchParams` is a Request-time API read, and the scope that encloses it becomes request-time rendering — so the difference between awaiting in the page component and awaiting in a child under `Suspense` is the difference between a page with a static shell and a page without one, with no visible symptom in development. The second decision is what the cached board read takes as an argument, and the wrong answer there produces a cache whose entries are never hit twice.

## The rule that governs placement

> *"`searchParams` is a **Request-time API** whose values cannot be known ahead of time. Using it will opt the page into **dynamic rendering** at request time."*
>
> *"With Cache Components, where you access `searchParams` in the component tree determines how much of the page can be prerendered."*
> — [`page.js`, Props](https://nextjs.org/docs/app/api-reference/file-conventions/page#searchparams-optional)

Read the second sentence as an instruction rather than a note. It says the placement of one `await` is a performance decision you are making whether or not you know it.

## The page

```tsx filename="app/(dashboard)/boards/[boardId]/page.tsx"
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { parseFilters } from '@/lib/board/filters'
import { readBoard } from '@/lib/board/query'
import { requireBoardAccess } from '@/lib/board/access'
import { BoardUiProvider } from '@/providers/board-ui-provider'
import { FilterBar } from './filter-bar'
import { Board } from './board'
import { BoardSkeleton } from './board-skeleton'

export default async function BoardPage(
  props: PageProps<'/(dashboard)/boards/[boardId]'>,
) {
  const { boardId } = await props.params

  return (
    <BoardUiProvider key={boardId}>
      <header className="board-chrome">
        <h1>Board</h1>
        <Suspense fallback={<div className="filter-bar-skeleton" />}>
          <FilterBar />
        </Suspense>
      </header>

      <Suspense fallback={<BoardSkeleton />}>
        <BoardData boardId={boardId} searchParams={props.searchParams} />
      </Suspense>
    </BoardUiProvider>
  )
}

async function BoardData({
  boardId,
  searchParams,
}: {
  boardId: string
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = parseFilters(await searchParams)

  const access = await requireBoardAccess(boardId)
  if (!access) notFound()

  const board = await readBoard(boardId)
  return <Board board={board} filters={filters} />
}
```

Four things are load-bearing and none of them is obvious from reading the file.

**The `await searchParams` happens in `BoardData`, not in `BoardPage`.** Reading it in the page component makes the entire page request-time, including the title and the filter bar's chrome. Pushing it under a `Suspense` boundary leaves the chrome prerenderable and lets the board stream in.

**`props.searchParams` is passed down un-awaited.** It is a promise; passing the promise rather than the resolved value keeps the await inside the boundary. Awaiting it in the parent to pass a plain object defeats the previous point entirely, and it is the single most common way this pattern is broken — the code still compiles, still renders, and quietly gives up the static shell.

**`FilterBar` is wrapped in its own `Suspense` boundary** because it calls `useSearchParams`, and the `useSearchParams` reference is explicit about the consequence of not doing so:

> *"If a route is prerendered, calling `useSearchParams` will cause the Client Component tree up to the closest `Suspense` boundary to be client-side rendered."*
> — [`useSearchParams`, Prerendering](https://nextjs.org/docs/app/api-reference/functions/use-search-params#prerendering)

"Up to the closest boundary" is the whole rule. With no boundary, that tree is everything above it that is client code. The filter bar's own boundary caps the damage at the filter bar.

**`BoardUiProvider` takes `key={boardId}`.** Navigating between two boards under the same layout reuses the provider instance, and reusing it would carry board A's selection and collapse state into board B. The `key` forces a fresh store per board. That store is [07e](07e-milestone-the-scoped-zustand-store.md).

## The read stays cached; the filters stay out of the key

The board read is expensive and shared by every user of the board. The filters are cheap and unique per user. Putting them in the same function couples the two, and the coupling has a name: **cache cardinality**. Key a cached read on a free-text `q` and you have created one entry per distinct string anyone has ever typed, all of them invalidated together by one tag, none of them reused by a second user.

So the cached function takes only what identifies the resource:

```ts filename="lib/board/query.ts"
import { cacheTag } from 'next/cache'
import { db } from '@/lib/db'

export type CardRow = {
  id: string
  columnId: string
  status: 'todo' | 'doing' | 'blocked' | 'done'
  assigneeId: string | null
  title: string
  rank: number
}

export type BoardRead = {
  id: string
  columns: { id: string; name: string }[]
  cards: CardRow[]
}

export async function readBoard(boardId: string): Promise<BoardRead> {
  'use cache'
  cacheTag(`board:${boardId}`)

  const [columns, cards] = await Promise.all([
    db.column.findMany({ where: { boardId }, orderBy: { position: 'asc' } }),
    db.card.findMany({ where: { boardId }, orderBy: { rank: 'asc' } }),
  ])

  return { id: boardId, columns, cards }
}
```

One entry per board, one tag per board. The narrowing happens after, using the predicate from the contract module:

```tsx filename="app/(dashboard)/boards/[boardId]/board.tsx"
import { matchesFilters } from '@/lib/board/filters'

const visible = board.cards.filter((c) => matchesFilters(c, filters))
```

**When this stops being right.** Filtering in memory means shipping every card of the board through the cached read. That is correct up to boards of a few thousand cards and wrong at fifty thousand, where the cache entry itself is the problem. At that size the filtered query goes to the database with the filters in the `WHERE` clause and is **not** cached — it becomes a request-time read inside the same `Suspense` boundary, and you keep a separate cached read only for what is genuinely board-wide, like the column list. The decision is a size threshold, not a principle, and the shape of the code barely changes: `readBoard(boardId)` gains a sibling `searchCards(boardId, filters)`.

⚠️ I did not find documentation stating how a `'use cache'` function's arguments participate in its cache key beyond the general behaviour described in the caching guide, so the reasoning above is argued from cardinality rather than from a documented key algorithm. Treat "keep user-controlled values out of cached function arguments" as a design rule this milestone adopts, not as a quoted framework guarantee.

## What a filter change invalidates: nothing

The tag comes from `cacheTag`, which the `revalidateTag` reference names as one of the two ways to attach one:

> *"Using [`cacheTag`](https://nextjs.org/docs/app/api-reference/functions/cacheTag) inside cached functions or components with the `'use cache'` directive"*
> — [`revalidateTag`, Parameters](https://nextjs.org/docs/app/api-reference/functions/revalidateTag#parameters)

Changing a filter invalidates none of it. A filter change is a navigation: a new URL, a new render, the same cache entry read again. That is the entire payoff of URL state — the "expensive" part of a filter change is a re-render, not a re-query, because the read is keyed on the board and the board did not change.

Moving a card *does* invalidate it, and which function the action calls decides whether the user who made the move sees it. That is [07g](07j-milestone-the-drop-the-action-and-reconciliation.md), and it is where this milestone's worst bug lives.

## Gotchas

**★ Symptom: `searchParams.status` is `undefined` even though the URL clearly has `?status=doing`.** Cause: `searchParams` was destructured without being awaited, so you read a property off a `Promise`, which is `undefined` rather than an error. Fix — and note this version fails silently, so the type checker is the only thing that catches it:

```ts
// 🚩 undefined, no error, no warning
const { status } = props.searchParams
// ✅
const { status } = await props.searchParams
```

**★ Symptom: nothing on the page prerenders, including a header with no dynamic data in it.** Cause: `await props.searchParams` at the top of the page component. Every Request-time API read pulls its enclosing scope into request-time rendering, and the enclosing scope of a read in `BoardPage` is the whole page. Fix: move the read into a child under `Suspense` and pass the promise, not the value — the `BoardData` component above.

**★ Symptom: you moved the await into a child, and the page still renders entirely at request time.** Cause: the parent awaited it anyway in order to pass a plain object down. `<BoardData filters={parseFilters(await props.searchParams)} />` reads the Request-time API in the parent's scope no matter which component consumes the result. Fix: the prop's type must be a promise, and the `await` must be inside the child:

```tsx
// 🚩 the await is in the page's scope
<BoardData filters={parseFilters(await props.searchParams)} />
// ✅ the promise crosses the boundary; the await happens under Suspense
<BoardData searchParams={props.searchParams} />
```

**★ Symptom: the whole client tree above the filter bar client-side renders, and the initial HTML is nearly empty.** Cause: a `useSearchParams` call with no `Suspense` boundary between it and the top of the client tree — the reference says the tree up to the closest boundary becomes client-rendered, and with no boundary that is all of it. Fix: wrap the specific component that reads the query string, as close to it as possible, which is why `FilterBar` has its own boundary rather than sharing the board's.

**★ Symptom: a filter change leaves the previous results on screen for a moment with no indication anything is happening.** Cause: Suspense working as designed — a navigation that re-renders an already-mounted boundary does not re-show its fallback. Fix: pick one deliberately. To show the skeleton again, change the boundary's identity so React discards the subtree:

```tsx
<Suspense key={rawQueryString} fallback={<BoardSkeleton />}>
```

To keep the old results and dim them instead — the better default for a filter — do nothing here and use the `isPending` flag from the filter bar's transition ([07d](07d-milestone-the-filter-bar.md)) to style the list. Remounting throws away scroll position and any DOM state under the boundary; dimming does not.

**★ Symptom: the cache hit rate collapses after you add free-text search.** Cause: `q` became an argument to the cached read, so every distinct string typed by every user is a separate entry. Fix: cached functions take resource identity only; user-controlled narrowing is applied outside the cached scope, or, past the size threshold, done in an uncached query. `readBoard(boardId)` — never `readBoard(boardId, filters)`.

**★ Symptom: navigating from board A to board B keeps A's collapsed columns and multi-select.** Cause: the store provider is mounted in a shared position in the tree, so React reuses the instance across a sibling navigation. Fix: `key={boardId}` on the provider, as above. This is not a Zustand quirk; it is React reconciliation, and the same fix applies to any per-resource provider.

**★ Symptom: `Cannot find name 'PageProps'`.** Cause: the helper is generated, not imported — *"Types are generated during `next dev`, `next build`, or with `next typegen`"* — and this checkout has run none of them, which happens on a clean CI job that type-checks before it builds. Fix: run `next typegen` before `tsc` in CI, or write the props explicitly:

```ts
export default async function BoardPage(props: {
  params: Promise<{ boardId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {}
```

**★ Symptom: the access check passes locally and the board is empty in production for a user who should see it.** Cause: `requireBoardAccess` was called *after* `readBoard`, or the read is not itself session-scoped, so the check and the data disagree about who is asking. Fix: order matters — authorise, then read, and make the read scoped by the same identity the check used. In the page above, `requireBoardAccess` precedes `readBoard` and `readBoard` is only reachable behind it; if `readBoard` were also called from an action, the check has to be repeated there, because a Server Action is a separate request that has not run this page.

## Interview questions

**★ Why is `searchParams` a promise in the App Router, when it was a plain object in the Pages Router?**
Because the page can begin rendering before the request's dynamic data is needed. If `searchParams` were synchronous, reading it would have to happen before render started, which forces the whole route to be request-time. As a promise, the read is a suspension point: everything above it in the tree can be prerendered and only the subtree that awaits it waits for the request. The reference says as much — it is a Request-time API and *where* you access it determines how much of the page prerenders. The promise is what makes "where" a meaningful question.

**★ What breaks if you `await props.searchParams` at the top of the page component instead of inside a child?**
Nothing functionally — the page renders identically. What you lose is the static shell: the read is a Request-time API, so its enclosing scope becomes request-time, and the enclosing scope is now the entire page. The header, the navigation and the filter bar's chrome all wait for the request instead of being served from a prerender. It is a pure performance regression with no visible symptom in development, which is exactly why it survives to production.

**★ Why not just cache the filtered query — surely more caching is better?**
Because the cache key would include user-controlled free text, and the number of distinct entries is then the number of distinct strings anyone has ever typed. Each is a full board's worth of rows, all invalidated together by `board:<id>`, and none reused by a second user. A cache whose entries are never hit twice is a memory leak with a nice name. Cache what is shared and identified by a resource id; narrow afterwards.

**★ A filter change re-renders the board. Does it re-query the database?**
Not if the read is cached and keyed on the board id, which is the point of keying it that way. The navigation produces a new render; the render calls `readBoard(boardId)`; the cache entry is still valid because nothing invalidated `board:<id>`; the rows come back without touching the database, and the only new work is applying `matchesFilters` and rendering. If instead the filters were arguments to the cached read, every filter change would be a cache miss and a query — the same user experience, a completely different load profile.

**★ Both `params` and `searchParams` are promises. Is there any reason to treat them differently?**
Yes: `params` is known at build time for a prerendered route and `searchParams` never is. Awaiting `params` does not force request-time rendering for a statically generated path, so reading it in the page component is fine and is what the reference's own examples do. Awaiting `searchParams` always does. Treating them symmetrically — hoisting both to the top of the page — costs you the shell; treating them symmetrically the other way, pushing `params` down into a boundary, costs you nothing but makes the code harder to read for no gain.

**★ Where does authorisation belong in this page, and why is it not in the filter schema?**
In `requireBoardAccess`, before the read, and repeated in every Server Action that touches the board — because an action is a separate POST request that never ran this page's code. It is not in the filter schema because the schema's job is to turn text into typed values, and it has no session, no database and no business having either. Putting an ownership check inside a parser means the parser can no longer be a pure module shared with the client, which loses the property that makes the whole contract work.

---

← [07b · The filter contract](07b-milestone-filters-on-the-server.md) · [Chapter 8 overview](01-explanation.md) · Next → [07d · The filter bar](07d-milestone-the-filter-bar.md)
