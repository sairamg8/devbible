---
title: "When to switch to TanStack Query"
sidebar_label: "12 · When TanStack Query"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the TanStack Query docs. Concept home: the
> [TanStack Query section](../../../tanstack-query/README.md) teaches the
> library; this chapter is only the decision.

## The problem

Phases 4's hand-rolled hooks — `useAsync`, the infinite list, the cart's
optimistic reducer — overlap what TanStack Query ships. Writing them was
not a mistake: the hooks are the *pedagogy* (you now know what a data
library must solve) and, at this app's size, a defensible production
choice. But "when would we switch?" deserves a real answer, not loyalty —
this chapter is that answer.

## What the hand-rolled layer does not have

Honesty first. The hooks cover lifecycle (race, leak, retry) per call
site. They do **not** have:

| Capability | What it means concretely here |
|---|---|
| **A shared cache keyed by query** | Two components fetching `/products/walnut-desk` fire two requests; with a cache, one — and navigation back to a seen product renders instantly from cache while revalidating |
| **Cross-component invalidation** | After checkout, the cart, the order list and the product's stock are all stale; today each screen refetches on its own schedule. `invalidateQueries(['cart'])` is a *system* for that |
| **Background refetch policies** | stale-while-revalidate, refetch-on-focus/reconnect — the admin table's focus-refetch gotcha (ch. 10) is one config flag there |
| **Request dedupe within a render pass** | The badge and the drawer both asking for the cart collapse into one flight |
| **Devtools** | The cache is inspectable; "why is this stale" becomes a panel, not a debugging session |

What the switch does *not* buy: the API client (`api`, the 401 broadcast,
the error taxonomy) — that layer sits under any data library. Nor the
cart's *server-authoritative* design — optimistic updates in TanStack
Query follow the same rollback-to-truth shape the reducer implements;
the choreography knowledge transfers one-to-one.

## The threshold, stated as signals

Switch when **two or more** of these are true:

1. **Duplicate-fetch pain is measured** — the same endpoint fetched by
   siblings in one screen, and lifting state up would couple unrelated
   components.
2. **Invalidation webs form** — a mutation needs three unrelated regions
   to refresh, and the hand-rolled answer is a growing event bus of
   "please refetch" callbacks.
3. **Caching becomes UX** — product pages should render instantly on
   back-navigation; "loading" on data seen ten seconds ago starts
   costing conversions.
4. **The team stops reading the hooks** — new features copy-paste
   `useAsync` variants instead of composing it; owned code that is no
   longer understood is the worst of both worlds.

This storefront at spec scale hits none reliably; a storefront with
wishlists, recommendations, live stock and five teams hits all four.
The signals matter more than the verdict — they are the reusable part.

## If the switch happens

The shape of the migration, so it is a series of diffs and not a rewrite:

1. `QueryClientProvider` at the shell; the `api` client and error
   contract unchanged underneath.
2. `useAsync((s) => api(path, {signal: s}), deps)` becomes
   `useQuery({queryKey, queryFn: ({signal}) => api(path, {signal})})` —
   mechanical, screen by screen; the `status` discriminant maps
   directly.
3. The infinite list's generation/cursor machinery collapses into
   `useInfiniteQuery` with `getNextPageParam: (last) => last.next_cursor`
   — the [keyset contract](../phase-3-express-api/05-catalog-endpoints.md)
   was already the exact shape it wants.
4. The cart provider stays longest: its reducer *is* an app-level
   policy. When it moves, `onMutate`/`onError`/`onSettled` reproduce
   optimistic/rollback/settle — same states, library-managed.
5. The mirror (ch. 05), auth (ch. 09) and boundaries (ch. 11) don't
   move at all.

That the migration is this clean is not luck — it is what the layering
(client under hooks, contract under client) was for. The
[library's own section](../../../tanstack-query/README.md) takes over
from here.

## Gotchas

- **Symptom:** the switch is proposed as "our hooks are buggy".
  **Cause:** usually one specific missing behaviour (focus refetch,
  dedupe) being generalized into a rewrite mandate. **Fix:** name the
  behaviour, check the signals list; adding focus-refetch to `useAsync`
  is ten lines, and a library adopted to dodge ten lines brings its own
  learning curve as interest.
- **Symptom:** post-migration, everything refetches constantly and the
  API's rate limits trip. **Cause:** defaults — `staleTime: 0` with
  refetch-on-focus means every tab switch re-hits every mounted query.
  **Fix:** set `staleTime` deliberately per query family (the cache
  budgets from [3·05](../phase-3-express-api/05-catalog-endpoints.md)
  translate directly); the library's defaults assume data far livelier
  than a catalog.

## Interview questions

1. **★ What does a server-state library actually manage that component
   state doesn't?** A normalized, shared, time-aware cache of *someone
   else's data*: identity (two subscribers, one entry), freshness
   (stale vs revalidating), and invalidation as a first-class
   operation. Component state owns data the client authors; server
   state is a replica, and replicas need cache semantics — that
   distinction, not "less boilerplate", is the argument.
2. **★ You built the hooks — argue for and against replacing them.**
   For: the five capabilities above arrive tested, plus devtools;
   invalidation webs and back-nav caching are where hand-rolled code
   grows worst. Against: a dependency with its own model to learn,
   defaults tuned for livelier data, and the hooks' pedagogical value
   as team-owned code. The tiebreaker is the signals list — measured
   pain, not fashion, in either direction.
3. **Why does the migration preserve the API client layer?** Because
   transport concerns — auth cookies, the 401 broadcast, error
   taxonomy, base URLs — are orthogonal to cache semantics. TanStack
   Query calls *your* `queryFn`; a design that had welded fetching into
   the hooks would now be unpicking transport from lifecycle. Layering
   is what made the library swappable in both directions.

---

← Prev: [Error boundaries and retry UX](11-error-boundaries-and-retry.md) ·
Phase index: [Phase 4 — The React UI](README.md) ·
Next phase → [Phase 5 · JavaScript custom functions](../phase-5-js-functions/README.md)
