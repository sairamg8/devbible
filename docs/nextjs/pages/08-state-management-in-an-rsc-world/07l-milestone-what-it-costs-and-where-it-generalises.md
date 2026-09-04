---
title: "Nine files and four owners for one screen is a real bill, and it is worth paying only when you can name what each owner buys — here is the price list, the three deviations people reach for, and the same design mapped onto a table that is not a board"
sidebar_label: "07l · Milestone: the bill"
sidebar_position: 54
description: "Chapter 8's capstone, closing: what the four-owner design actually costs in round trips, duplicated predicates, privacy and action latency; the three deviations engineers reach for and what each one breaks; and the pattern remapped onto a server-sorted, server-paginated data table."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-05 against the Next.js [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions)
> (`lastUpdated: 2026-06-17`), the [`revalidateTag` reference](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
> (`lastUpdated: 2026-08-25`) and the [`page.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/page)
> (`lastUpdated: 2026-06-09`). Target: **Next.js 16.3.4** App Router · **React 19.2.8** ·
> **zustand 5.0.15** · **zod 4.4.3**. Documentation-verified; **no sandbox run** — 🔴 **no latency
> figures, request counts or payload sizes appear on this page.** Every threshold below is a
> decision procedure, not a measurement.

**A reference page that only lists benefits is marketing.** The design this milestone built — filters in the URL, rows in the tagged server cache, gesture state in a per-mount store, the unconfirmed move in `useOptimistic` — costs nine files, four serialisation formats, one predicate that necessarily exists on both sides of the network, and a mutation path that is measurably slower than fire-and-forget. It is worth it for a board. It is not automatically worth it for your screen, and the three places people deviate are the three places the cost is most visible. This page prices it, names the deviations, and maps the whole thing onto a data table so the pattern is portable rather than board-shaped.

## The bill

**Every filter change is a server round trip.** That is the deliberate consequence of the URL owning filters: the render happens on the server, so narrowing a list is a navigation. The read itself is cached and tagged ([07c](07c-milestone-reading-filters-in-the-page.md)) so it does not re-query, but the round trip is real. The decision procedure, not a number: **if the entire filterable set is already in the client's hands and small enough that you would have rendered it all anyway, client-side filtering of that set is correct and the URL still holds the filter** — you read it with `useSearchParams` and filter in memory. The moment the set is larger than you would ship, the server must do the narrowing and the round trip is the price of not shipping it.

**The filter predicate exists on both sides.** `matchesFilters` runs on the server to narrow the rows and in the optimistic reducer to decide whether a moved card leaves the view ([07j](07j-milestone-the-drop-the-action-and-reconciliation.md)). One module, two runtimes — structurally a single definition, but two executions that can disagree if the server version is ever rewritten as SQL for size reasons. That is the only genuinely two-homed fact the design keeps, and it keeps it because deleting either side produces a visible defect.

**Search terms in the URL are search terms in your logs.** `?q=jane.doe@example.com` lands in access logs, in the `Referer` header sent to any third-party asset on the page, in browser history on a shared machine, and in whatever analytics tool records page paths. Nothing in the framework does this to you; putting the value in the URL does. If the query can contain personal data, either keep it out of the URL — accepting the loss of shareability — or tighten `Referrer-Policy` and scrub the parameter at the log boundary, and know that browser history is still holding it.

**URL length is a real ceiling with no single number.** There is no specification limit you can rely on; servers, proxies and CDNs each impose their own, and a request that exceeds one is rejected before your code runs. So URL state is for a bounded set of short values — a handful of filters, a page number, a sort key — not for an arbitrary-length selection or a serialised object graph.

**`updateTag` makes the action slower than `revalidateTag` does, on purpose.** The next read waits for fresh data so the response can carry the post-move render ([07k](07k-milestone-the-action-and-what-invalidates-what.md)). That is the right trade for a mutation the user is watching and the wrong one for a mutation nobody is: a webhook that calls `updateTag` pays for a re-render that no browser is waiting to receive.

**Optimistic UI is a second implementation of the mutation's effect.** The reducer must reproduce, in TypeScript on the client, what the action does in SQL on the server: move the card, recompute a rank, re-apply the filter. That code exists only to make the interface feel immediate. It is a genuine duplication and it is the first thing to delete if the feature turns out not to need it.

**The store is per-mount, so its contents do not survive a reload.** For drag state and selection that is exactly right. It becomes a cost the moment somebody wants collapsed columns remembered across sessions, at which point the honest options are `localStorage` with a hydration flash, or a cookie the server can read — both of which are described in [07f](07f-milestone-selectors-resets-and-hydration.md), and neither of which is free.

## Deviation 1 — "put the filters in the store, it'll be faster"

**What happens.** You lose three properties immediately: a pasted link no longer reproduces the view, a refresh clears the filters, and the back button does nothing. You gain a fourth problem you did not have: the filter now exists in the store *and* in whatever the server used to render, so the two can disagree — and they will, the first time a navigation lands while a filter is set.

**And the speed does not arrive.** The server still needs those values to run the query, so you send them anyway, as a POST body or an action argument. You have replaced a navigation with a mutation, kept the round trip, and paid for it with the three lost properties.

**What to do instead**, when the round trip genuinely is the problem:

```tsx
// Narrow the Suspense boundary so only the columns re-suspend, not the chrome.
<Suspense fallback={<ColumnsSkeleton />}>
  <BoardData boardId={boardId} searchParams={props.searchParams} />
</Suspense>

// Keep the previous results visible and dim them, rather than showing a skeleton.
<div data-pending={isPending || undefined}>{children}</div>
```

Both are in [07c](07c-milestone-reading-filters-in-the-page.md) and [07d](07d-milestone-the-filter-bar.md). Between them they remove almost all of the *perceived* cost without moving the owner.

## Deviation 2 — "load the board into the store and mutate it locally"

**What happens.** You have a second cache with no invalidation protocol. A move made in another tab never reaches this one. A `revalidateTag` fired by another user's action updates the server cache while the store carries on. Any RSC re-render now races the store for what is displayed, and which one wins depends on render order.

[Then you rebuild the missing protocol** — a focus refetch, a poll, a websocket — and at that point you have written a worse TanStack Query. If you genuinely need a client-owned cache, because the data is fed by a socket or polled independently of navigation, use one and let it own that data outright rather than mirroring the server cache. That trade-off is **TanStack Query / RTK Query in App Router](05-tanstack-query-rtk-query-in-app-router-when-a-client-cache-s.md).

**The narrow version is correct and is what the milestone does:** hold only the move that has not been confirmed yet, for the length of one transition, in `useOptimistic`.

## Deviation 3 — "skip the optimism, just await and revalidate"

This one is legitimate and is often right. Price it honestly:

| | With `useOptimistic` | Without |
|---|---|---|
| Perceived latency of a move | immediate | one round trip |
| Code to maintain | reducer, revert animation, conflict UI, per-item pending flag | none |
| Predicate duplication | required | none |
| Failure story | must be designed — revert, animate, explain | the move simply does not happen |
| Right for | high-frequency, low-stakes, reversible | infrequent, high-stakes, or slow-by-nature |

A drag is high-frequency, low-stakes and trivially reversible, so it earns the optimism. A payment, a permission change or an irreversible delete does not — showing the user a result you are not sure of is a worse experience than a spinner, because the correction is the thing they remember. The version without optimism is genuinely simpler and still correct:

```tsx
function onMove(intent: MoveIntent) {
  startTransition(async () => {
    const result = await moveCard(intent)
    if (!result.ok) setError('That move was not allowed.')
  })
}
```

With `updateTag` in the action, the card arrives in its new column in the same response. The user waits one round trip and never sees anything wrong.

## If your app is not a board: a server-sorted, server-paginated table

The board is a bad shape to generalise from because it has a stored order. A table does not, and the mapping is cleaner:

| Board | Table | Owner |
|---|---|---|
| `?status=&assignee=&q=` | `?q=&status=&page=&per=&sort=&dir=` | **URL** |
| Card rows + counts, `cacheTag('board:<id>')` | The page of rows + the total count, `cacheTag('invoices:<orgId>')` | **server cache** |
| Drag state, drop target | Column widths, density, which row is expanded | **client store** |
| Multi-select of cards | Multi-select of rows | **client store** |
| The unconfirmed move | The unconfirmed inline cell edit | **`useOptimistic`** |
| `rank` on each card | *nothing* — order is derived from `sort`/`dir` | — |

Three differences are worth naming because they change the code, not just the labels.

**There is no rank.** Order is a function of the URL's `sort` and `dir`, computed by the query, so the entire [07i](07i-milestone-ranks-and-the-accessible-move-path.md) apparatus — fractional ranks, renormalisation, the index-versus-rank trust boundary — disappears. Ordering only needs storing when the *user* owns it.

**Pagination gives the predicate problem a sharper edge.** An optimistic edit that changes a sorted column can move the row off the current page entirely — editing an invoice's date under `?sort=date&page=2` may mean the row belongs on page 1 now. The optimistic reducer has to decide: drop the row (correct, matches what the server will render, jarring) or leave it in place with a pending marker (soothing, and then it vanishes). This is exactly the board's "card dragged out of the filter" case, and the resolution is the same — apply the same predicate the server will.

**The total count is a second fact behind the same tag.** `Showing 21–40 of 137` is derived from the same read and invalidated by the same mutation, so it comes along for free with `updateTag('invoices:<orgId>')`. Teams that cache the rows and compute the count separately end up with a count that is stale relative to the rows on screen, which is the "same fact, two homes" failure in its most embarrassing form.

The wizard shape is even smaller and worth stating for completeness: the **step** is URL state (deep-linkable, back button works), the **draft** is server state saved per step, and there is **no store at all** — every field is a form input, and the only client state is what the current form holds.

## Gotchas

**★ Symptom: after moving filters into a store "for speed", QA bug reports stop being reproducible.** Cause: the URL no longer describes the view, so "the board looked like this" cannot be pasted into a ticket. Fix: put them back. This is not a nice-to-have — a URL that reproduces a view is the cheapest debugging tool a web application has, and it is the first thing lost and the last thing anyone thinks to attribute.

**★ Symptom: customer email addresses appear in your CDN access logs.** Cause: a free-text search parameter in the URL, faithfully logged by every hop. Fix: decide per parameter whether it can carry personal data. If it can, either keep it out of the URL (losing shareability, which is a real loss — say so rather than pretending it is free) or scrub it at the log boundary and set a strict `Referrer-Policy` so the value does not travel to third-party assets. Browser history still holds it either way.

**★ Symptom: a saved-view link stops working after a filter is renamed.** Cause: the URL is a public serialisation format and someone treated it as an internal detail. Fix: this is what `.catch()` in [07b](07b-milestone-filters-on-the-server.md) buys — a renamed parameter degrades to "no filter" and renders a board rather than an error. If a filter must be renamed and its old links kept working, map the old name to the new one in the parser rather than deleting it:

```ts
const raw = { ...input, status: input.status ?? input.state } // `state` was the old name
```

**★ Symptom: every Server Action in the app got slower after a "consistency" pass replaced every `revalidateTag` with `updateTag`.** Cause: `updateTag` makes the next read wait for fresh data so the action's response can carry a render — which is exactly what you want when a user is watching and pure cost when nobody is. Fix: the invalidation table in [07k](07k-milestone-the-action-and-what-invalidates-what.md). Actions triggered by a person get `updateTag`; actions triggered by a webhook, a cron or a queue get `revalidateTag(tag, 'max')`.

**★ Symptom: the table version of this design shows a row that has just been edited off the page, and the paging counts do not add up for a moment.** Cause: the optimistic reducer changed a sorted field but did not consider pagination, so the optimistic page holds a row the server's page will not. Fix: apply the server's own predicate — including the sort window — in the reducer, and accept that the honest optimistic result is sometimes "the row leaves". A row that disappears with an explanation is better than a row that lingers and then disappears without one.

**★ Symptom: the store grew from four fields to twenty and is now imported by half the app.** Cause: a per-resource store used as a general-purpose one, which loses the `key={id}` reset and reintroduces the leak-across-navigation class of bug. Fix: one store per bounded piece of UI, mounted at the level whose lifetime it should share. A genuinely app-wide preference belongs in a different provider mounted higher, without a key, holding only what is genuinely app-wide.

**★ Symptom: a screen adopted the whole pattern and it is obviously too much machinery for what it does.** Cause: the pattern was applied rather than derived. Fix: run the four questions in [07](07-project-milestone-sprintdesk-board-filters-in-the-url.md) against your screen's actual state. A read-only report has one owner — the server cache — and needs no store, no optimism and possibly no URL state beyond a date range. The design in this milestone is what a board needs because a board has all four kinds of state; most screens have two.

## Interview questions

**★ What does this design cost, concretely?**
A round trip per filter change, which the tagged cache makes cheap but does not eliminate. One predicate that must be executable on both the server and the client. A duplicated implementation of the mutation's effect, existing only to make the UI feel immediate. Search terms in logs, history and referrer headers. An action that is slower than a fire-and-forget invalidation because its response carries a render. And nine files where a single-store SPA would have had one. What it buys is that each failure is localised: a bad filter cannot corrupt the board, a store bug cannot leak across users, a failed move reverts visibly, and a URL reproduces a view.

**★ How do you decide whether optimistic UI is worth building?**
Three properties of the mutation. Frequency: a gesture people perform dozens of times an hour justifies work that a monthly action does not. Stakes: showing a result you are not certain of is acceptable for moving a card and unacceptable for taking a payment, because the correction is what the user remembers. Reversibility: if the failure story is "it goes back", optimism is cheap; if it is "we have to explain what partially happened", it is not. A drag scores well on all three. Most CRUD forms score badly on the first, and the version that just awaits the action with `updateTag` is simpler and indistinguishable to the user.

**★ Map this design onto a data table with server-side sorting and pagination.**
The URL grows `page`, `per`, `sort` and `dir` alongside the filters and stays the single source of truth for what is displayed. The server cache holds the page of rows *and* the total count under one tag, so one `updateTag` keeps the rows and the "showing 21–40 of 137" line consistent. The client store holds column widths, density, the expanded row and the row selection — all ephemeral, all mount-scoped. `useOptimistic` holds an unconfirmed inline cell edit. And the whole rank apparatus disappears, because order is derived from the URL rather than stored per row; storing an order is only necessary when the user owns it.

**★ Which single piece of this would you keep if you could only keep one?**
Filters in the URL. It is the cheapest to implement, it is the one whose absence is felt by everyone including the people supporting the product, and it is the only one that makes a view communicable. The scoped store matters most when it is wrong — a module-level store is a security defect — but a screen with no store at all is a perfectly good screen. Optimistic updates are a refinement. URL state is the one that changes what the application *is*.

**★ Where in this design would you expect a new engineer to make their first mistake?**
Awaiting `searchParams` at the top of the page component. It compiles, it renders identically, every test passes, and it silently gives up the static shell because a Request-time API read pulls its enclosing scope into request-time rendering. Nothing in local development shows it. The second most likely is a selector returning an object literal, which at least announces itself with `Maximum update depth exceeded`, and the third is `revalidateTag` where `updateTag` was needed — which produces a visible bug that is very hard to attribute, because the data is correct and the screen is not.

**★ You have thirty minutes and an existing screen with everything in one Zustand store. What do you move first?**
The filters, into the URL — the highest ratio of benefit to effort, and it can be done without touching the mutation path. Second, check whether the store is created at module scope, because that is a security defect rather than a design preference and it is a three-line fix. Third, delete any copy of server data from the store and read it from props instead; if something breaks because a client component needed it and had no way to receive it, that is a boundary problem worth surfacing rather than papering over. Optimism last, if at all — it is the only item on the list whose absence is merely a slower interface rather than a wrong one.

---

← [07k · The action and the tags](07k-milestone-the-action-and-what-invalidates-what.md) · [Chapter 8 overview](01-explanation.md) · Next → [10 · `refresh()`](10-refresh.md)
