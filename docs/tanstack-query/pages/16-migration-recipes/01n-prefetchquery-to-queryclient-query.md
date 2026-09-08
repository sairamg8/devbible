---
title: "A global find-and-replace of prefetchQuery to query compiles cleanly, passes review, and converts a category of harmless cache warm-ups into unhandled rejections — because your forty prefetch call sites are four different call sites wearing the same method name"
sidebar_label: "01n · Prefetch → `query()`"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Prefetching & Router Integration](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching), [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5), and the [`QueryClient` reference](https://tanstack.com/query/latest/docs/reference/QueryClient) (quotes banked 2026-09-06; the reference URL returned `{"isNotFound":true}` on re-check 2026-09-08, so the reference quotes below are **banked, not re-fetched today**). Documentation-validated; **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# 🔁 One Rename, Four Ports

**`prefetchQuery` and `ensureQueryData` are deprecated in favour of `queryClient.query()`, and the two methods differ in exactly one way that matters: the old one swallowed failures and the new one throws.** That makes the rename mechanical in *syntax* and semantic in *behaviour* — the worst combination, because `sed -i 's/prefetchQuery/query/g'` produces a diff that compiles, type-checks, passes review in thirty seconds, and changes what happens on every unhappy path in the codebase. This page is not another explanation of what `query()` does; [topic 09](../09-prefetching-and-ssr/01-server-rendered-data-flow.md), [topic 10](../10-suspense-integration/01d-fetch-on-render-and-streaming.md) and [topic 07](../07-pagination-and-infinite-queries/01-paged-data-patterns.md) already cover the mechanism. **This is the worklist.** You have forty call sites; they sort into four classes; each class has a different correct port, and one of them is an outage.

## 1. The deprecation, and why it is not on the migration guide

The prefetching guide states it directly:

> *"These tips replace the use of the now deprecated `prefetchQuery` and `ensureQueryData` methods."*
> *"those methods will be removed in the next major version of TanStack Query"*
> *"Prefetching a query uses the `query` method."*

🔴 **Structural evidence, banked 2026-09-06:** `prefetchQuery`, `fetchQuery`, `prefetchInfiniteQuery` and `ensureQueryData` **no longer appear in the `QueryClient` reference at all.** `queryClient.query` and `queryClient.infiniteQuery` do. A method that is gone from the reference but still exported is the shape of a deprecation mid-major-line, not a removal.

`query()` is described as:

> *"an asynchronous method that can be used to fetch and cache a query. It will either resolve with the data or throw with an error."*

[`01f`](./01f-v4-to-v5-mechanical-versus-semantic.md) classifies this as a class-3 change — still compiles, means something else — and makes the point this page builds on: **it landed *inside* the v5 line, so it is not on the v4 → v5 migration guide.** A team working that guide top to bottom finishes the upgrade with every one of these call sites untouched and unaudited. Nothing in the toolchain will raise it. You have to go looking.

## 2. The triage question, and how to find every site

One question sorts a call site into its class:

> 🔴 **"If this rejects, who catches it?"**

| Answer | Class | The port |
|---|---|---|
| *Nobody — it is fire-and-forget* | **(a)** speculative warm-up | explicit, commented `.catch` |
| *A `Promise.all` that renders a page* | **(b)** SSR / route loader | `allSettled` or per-key catch |
| *The caller, which wants the data* | **(c)** `ensureQueryData` for its value | `try`/`catch` at the call site |
| *any of the above, but infinite* | **(d)** `prefetchInfiniteQuery` | `infiniteQuery` + `pages` + `initialPageParam` |

Finding them:

```bash
# Every deprecated prefetch/fetch entry point, with file and line, as a worklist
grep -rnE --include='*.ts' --include='*.tsx' \
  '(prefetch|ensure|fetch)(Query|InfiniteQuery|QueryData|InfiniteQueryData)\b' src/ \
  | tee prefetch-audit.txt

grep -v 'await\|\.catch\|\.then' prefetch-audit.txt        # class (a) candidates
grep -rn -B4 'prefetchQuery\|ensureQueryData' src/ | grep 'Promise.all'   # class (b)
```

⚠️ **`grep` finds the call, not the class.** The last two commands are candidate filters, not answers; a prefetch three lines below a `Promise.all([` is still inside it. Read every hit.

## 3. Class (a) — the speculative warm-up

`onMouseEnter` on a link, a route-hover prefetch, "warm page N+1 while the user reads page N". It is **fire-and-forget by design**: nobody awaits it, nobody reads its value, and its failing is *supposed* to be a non-event, because the component that eventually mounts will fetch the key itself.

```tsx
// ⛔ WRONG PORT — the find-and-replace output. Compiles. Type-checks. Rejects into the void.
onMouseEnter={() => {
  queryClient.query({ queryKey: ['product', productId], queryFn: () => fetchProduct(productId) });
}}
```

Under `prefetchQuery` a hover over a link to a 404ing product was silent. Under `query()` it is a **floating rejected promise**: a `window.onunhandledrejection` event, a red overlay in the Vite/Next dev server, and — because a user sweeps the mouse across a list — a burst of identical events in Sentry from a code path that has no user-visible consequence at all.

```tsx
// ✅ RIGHT PORT — the swallow is the semantics, restored deliberately.
import { useQueryClient } from '@tanstack/react-query';

function ProductLink({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  return (
    <Link
      to={`/products/${productId}`}
      onMouseEnter={() => {
        queryClient
          .query({ queryKey: ['product', productId], queryFn: () => fetchProduct(productId) })
          // Speculative warm-up. If it fails, the page's own useQuery will fetch and
          // surface the error there. Swallowing is intentional: query() throws where
          // prefetchQuery did not.
          .catch(() => {});
      }}
    >
      View
    </Link>
  );
}
```

**The comment is not decoration.** A bare `.catch(() => {})` is normally a review smell — this is the one place it is the correct semantics being restored, and without the comment the next reviewer deletes it. The docs' own examples import a `noop` for exactly this purpose, which is the strongest available signal that a deliberate swallow is the sanctioned shape here.

## 4. Class (b) — the SSR / route-loader `Promise.all`. 🔴 This is the outage

A route loader or Server Component warming several keys at once:

```tsx
// ⛔ WRONG PORT — this is the one that 500s the page. (Inside a loader; see the fix below.)
await Promise.all([
  queryClient.query({ queryKey: ['user', params.id], queryFn: () => fetchUser(params.id) }),
  queryClient.query({ queryKey: ['orders', params.id], queryFn: () => fetchOrders(params.id) }),
  queryClient.query({ queryKey: ['recommendations'], queryFn: fetchRecommendations }),
]);
```

**Before the rename**, `prefetchQuery` swallowed. A flaky recommendations service left `['recommendations']` unresolved in the dehydrated cache, the page rendered with the other two keys hydrated, and the client's `useQuery` fetched recommendations itself — a degraded widget, not an incident.

**After the rename**, `Promise.all` rejects on the *first* rejection. The loader throws. The server render fails. **A best-effort recommendations panel now takes down the whole route**, and the blast radius is proportional to how many keys you were warming.

🔴 **Two v5 changes compound here.** [`01f`](./01f-v4-to-v5-mechanical-versus-semantic.md) records the other one: *"`retry` now defaults to `0` instead of `3`"* on the server. So the same transient blip that previously got three attempts *and* was swallowed now gets one attempt and throws. Neither change is wrong; together they turn a class of soft failure into a hard one, and only one of them is on any migration guide.

```tsx
// ✅ RIGHT PORT — allSettled preserves the old resilience explicitly.
const results = await Promise.allSettled([
  queryClient.query({ queryKey: ['user', params.id], queryFn: () => fetchUser(params.id) }),
  queryClient.query({ queryKey: ['orders', params.id], queryFn: () => fetchOrders(params.id) }),
  queryClient.query({ queryKey: ['recommendations'], queryFn: fetchRecommendations }),
]);
// The rename is now the moment you get to CHOOSE, per key, instead of inheriting a swallow.
for (const r of results) {
  if (r.status === 'rejected') logger.warn({ err: r.reason }, 'prefetch failed; client will refetch');
}
return { dehydratedState: dehydrate(queryClient) };
```

**The better version distinguishes critical from optional keys**, which `prefetchQuery` never let you do:

```tsx
// ✅ BEST PORT — the user is the page; recommendations are a nice-to-have.
const [user] = await Promise.all([
  queryClient.query({ queryKey: ['user', params.id], queryFn: () => fetchUser(params.id) }),
]); // no catch: if the user 404s, this route legitimately has no page to render

await Promise.allSettled([
  queryClient.query({ queryKey: ['orders', params.id], queryFn: () => fetchOrders(params.id) }),
  queryClient.query({ queryKey: ['recommendations'], queryFn: fetchRecommendations }),
]);
```

That is the honest upside of the deprecation: `prefetchQuery` gave every key the same failure policy — swallow — whether or not the page could render without it.

## 5. Class (c) — `ensureQueryData` used for its return value

*"Give me this data; use the cache if you have it, fetch if you don't."* Here the caller wants the value, so the throw is an **improvement**: you handle the failure at the call site instead of discovering `undefined` three lines later.

```ts
// ⛔ BEFORE — the failure surfaces as a TypeError somewhere else entirely.
const settings = await queryClient.ensureQueryData({ queryKey: ['settings'], queryFn: fetchSettings });
applyTheme(settings.theme);   // settings is undefined on failure → "Cannot read properties of undefined"

// ✅ AFTER — the error arrives where the decision is.
try {
  const settings = await queryClient.query({ queryKey: ['settings'], queryFn: fetchSettings });
  applyTheme(settings.theme);
} catch (err) {
  logger.warn({ err }, 'settings unavailable; using defaults');
  applyTheme(DEFAULT_THEME);
}
```

⚠️ **Not settled by any source I have, and I am not going to guess:** whether `queryClient.query()` reuses a fresh cache entry under `staleTime` the way `ensureQueryData` did, or always initiates a fetch. `ensureQueryData`'s documented contract was "return the cached value if present, otherwise fetch"; the `query()` description quoted above says only that it *"can be used to fetch and cache a query"* and settles nothing about cache-hit behaviour. **This is load-bearing for exactly this class** — if `query()` always fetches, an `ensureQueryData` call inside a hot path becomes a request per call. **Verify against the installed build before porting class (c) at scale**, and until then treat every class-(c) site as a possible new network call.

## 6. Class (d) — `prefetchInfiniteQuery`

```ts
// ✅ v5 shape. Two traps live in this one call.
await queryClient
  .infiniteQuery({
    queryKey: ['feed', filter],
    queryFn: ({ pageParam }) => fetchFeed({ cursor: pageParam, filter }),
    initialPageParam: null,                       // trap 1: now REQUIRED
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    pages: 3,                                     // trap 2: without this you get ONE page
  })
  .catch(() => {});
```

> *"By default, only the first page gets prefetched."*

So a straight rename of `prefetchInfiniteQuery` → `infiniteQuery` warms one page where the old call may have warmed several, and `initialPageParam` is now mandatory — in JavaScript its absence means your `queryFn` is called with `pageParam: undefined`. Both traps and the sequential cost of `pages: n` are covered in [topic 07](../07-pagination-and-infinite-queries/01d-infinite-cache-refetch-and-manual-updates.md); do not re-derive them, but do check every site.

## 7. The RTK Query angle: `usePrefetch` is always class (a)

`api.usePrefetch('endpoint')` returns a function that **returns nothing** — RTK Query's prefetch is fire-and-forget by construction, and there is no promise for a caller to reject. [`01b`](./01b-rtk-query-the-option-by-option-map.md)'s mapping table sends it to `queryClient.query({ queryKey, queryFn })`, and that row is only correct with the catch attached:

```ts
// RTK Query                                    // TanStack Query — the ONLY faithful port
const prefetchUser = api.usePrefetch('getUser'); const qc = useQueryClient();
prefetchUser(userId);                           // qc.query({ queryKey: ['user', userId],
                                                //            queryFn: () => fetchUser(userId) })
                                                //   .catch(() => {});   // ← not optional
```

🔴 **A literal port of `usePrefetch` to a bare `query()` is the fastest way to manufacture this bug**, and it is worse during an RTK migration than during a v5 upgrade: there is no deprecated method in the diff to grep for afterwards, because the new call sites were *born* wrong. Every `usePrefetch` in the source repo is a class-(a) site by definition — port them as a batch, with the catch, and review the batch as one commit.

## 8. Urgency: not now, but not never

Both methods still work in **5.102.8**. They are deprecated, not removed. So:

- **Do it on your own schedule**, as its own reviewable diff, while nothing else is on fire. A rename whose entire risk is *error handling* is the last thing you want landing inside a major-version upgrade where every other bug is also new.
- **The honest counter-argument:** deprecated calls left in place accumulate. *"those methods will be removed in the next major version"* — at that point the change is forced, it is bundled with everything else in that major, and the four-class triage happens under time pressure instead of over an afternoon. Doing it early converts a future rushed change into a present deliberate one.
- **A useful middle:** ban new uses today (lint rule or review convention), port the existing ones by class over a few PRs.

## 9. The `staleTime: 0` interaction — the prefetch that bought nothing

[`01b`](./01b-rtk-query-the-option-by-option-map.md) names this in one line; here is the mechanism. A cache entry's freshness is judged against `staleTime`, which defaults to `0` — meaning data is stale the instant it lands. A prefetch writes the entry; the component mounts a moment later; a stale query refetches when a new instance mounts. **So the key is in cache, the render still shows a loading state, and you paid for two requests instead of one.**

The prefetch did not fail. It expired.

```tsx
// The prefetch and the consumer must AGREE on staleTime, or the prefetch is decorative.
const PRODUCT_STALE_TIME = 60_000;
const opts = { queryKey: ['product', id], queryFn: () => fetchProduct(id), staleTime: PRODUCT_STALE_TIME };

queryClient.query(opts).catch(() => {});   // on hover
useQuery(opts);                            // in the component that mounts moments later
```

⚠️ Whether `staleTime` on the `query()` call itself is honoured identically to the way `prefetchQuery` honoured it is part of the unverified gap in §5. The *reliable* half of the fix is the consumer's `staleTime` — or a `staleTime` in the client's `defaultOptions` ([topic 13](../13-global-configuration/01-defaultoptions.md)) — because that is what decides whether the mount refetches.

## Gotchas

**★ Symptom: after the rename, `Uncaught (in promise)` errors appear in the console in bursts while a user moves the mouse down a list.** Cause: class-(a) hover prefetches. `query()` *"will either resolve with the data or throw with an error"*, so every warm-up of a key whose request fails is now a floating rejection, and a mouse sweep fires many. Fix: `.catch(() => {})` with a comment saying why, on every fire-and-forget prefetch.

**★ 🔴 Symptom: a route that renders fine in dev starts returning 500s in production whenever one non-critical upstream is degraded.** Cause: several `query()` calls in a `Promise.all` inside an SSR loader. `Promise.all` rejects on the first rejection and the render throws — where `prefetchQuery` left the key unresolved and the page rendered. Fix: `Promise.allSettled`, or split the array into "the page cannot render without this" (plain `Promise.all`, no catch) and "best effort" (`allSettled`). §4 shows both.

**★ Symptom: the same route now fails on transient errors that used to ride through.** Cause: two independent v5 changes compounding — *"`retry` now defaults to `0` instead of `3`"* on the server, **and** the prefetch method now throwing. The first removes the retries that hid the blip; the second turns the resulting failure into a thrown one. Fix: fix the throw with `allSettled`, and set `retry` explicitly on the server client if you were genuinely relying on retries.

**★ Symptom: a Node route handler or a script exits with a non-zero code after a prefetch fails, with no error handler having run.** Cause: modern Node treats an unhandled rejection as fatal by default (`--unhandled-rejections=throw`). A swallowed prefetch in v4 was inert; in v5 an uncaught one can terminate the process. Fix: the same explicit `.catch` — and note this makes class (a) *more* dangerous on the server than in the browser, where it is only console noise.

**★ Symptom: a reviewer deletes your `.catch(() => {})` in a follow-up PR as "swallowing errors".** Cause: an empty catch is a legitimate smell everywhere else in a codebase, and the reason it is correct here is invisible from the diff. Fix: a comment on the catch stating that this is a speculative prefetch and that `query()` throws where `prefetchQuery` did not. Uncommented, it will be removed and the bug will come back.

**★ Symptom: the codemod/`sed` diff is a hundred lines of pure rename and gets approved in seconds.** Cause: that is exactly what a mechanical-looking, semantically-loaded diff looks like — the same trap [`01f`](./01f-v4-to-v5-mechanical-versus-semantic.md) records for the official v5 codemod. Fix: never land this as one commit. One commit per class, with each commit's message naming the class and the failure policy it chose.

**★ Symptom: an infinite list is warm for one page after porting `prefetchInfiniteQuery`, where it used to be warm for three.** Cause: *"By default, only the first page gets prefetched."* The `pages` option is not implied by anything in the old call. Fix: pass `pages: n` explicitly, and expect `n` sequential requests, since each page's param comes from the previous response.

**★ Symptom: `queryFn` is called with `pageParam: undefined` after the infinite-query port, and the API returns page one forever.** Cause: `initialPageParam` is required in v5 and its absence is silent in JavaScript. Fix: pass it explicitly — `initialPageParam: null` or `initialPageParam: 1`, matching what your cursor scheme's first request actually sends.

**★ Symptom: you prefetch a key on hover and the component still shows a spinner when the user clicks through.** Cause: `staleTime: 0` — the entry was stale before the component mounted, and a stale query refetches on mount. Fix: give the key a real `staleTime` on the consuming `useQuery` (or in `defaultOptions`), not only on the prefetch. §9.

**★ Symptom: memory and cache-entry count grow on a page with aggressive hover prefetching.** Cause: a prefetched key that no hook ever observes is still a cache entry. It parks until `gcTime` collects it — *"If the query is not utilized by a query hook within the default `gcTime`, the query will be garbage collected. If the default `gcTime` has not been configured, it defaults to 5 minutes."* Fix: prefetch on intent (hover, focus, viewport), not on render of every row; consider a shorter `gcTime` for speculative keys.

**★ Symptom: a prefetch fires on every re-render.** Cause: the port moved the call from an event handler into a `useEffect` — or into the component body — during the rewrite. `prefetchQuery`'s silence made this cheap to get wrong; `query()` makes it loud, which is the only good news in the gotcha. Fix: keep speculative prefetches in event handlers. If a prefetch genuinely belongs in an effect, its dependency array must be the query key's inputs and nothing else.

**★ Symptom: `queryClient.query` is not a function.** Cause: the installed version predates the `query()`/`infiniteQuery()` methods — they are the v5-line replacements, not v4 API. Fix: check the installed version before the rename (`node -p "require('@tanstack/react-query/package.json').version"`); this page pins **5.102.8**.

**★ Symptom: a test that asserted "prefetch failure does not break the page" now fails after the rename.** Cause: that test was asserting the *old* swallow, and it is doing its job — it caught the semantic change. Fix: do not delete it. Change it to assert the new deliberate policy: that a failing speculative prefetch is caught, and that a failing loader prefetch is handled by `allSettled`. Harness setup is in [topic 15](../15-testing-tanstack-query/01-isolated-and-integration-testing.md).

**★ Symptom: a prefetch keeps running after the user navigates away.** Cause: nothing about the rename changes this — a prefetch is a request like any other, and cancellation needs the `signal` passed through to `fetch`. Fix: accept and forward the `signal` in the `queryFn`, per [topic 12](../12-query-cancellation/01-abortsignal-integration.md). Worth doing at the same time, because you are already editing every prefetch call site.

## Interview questions

**★ Why is `sed -i 's/prefetchQuery/query/g'` a dangerous change even though it produces a clean build?**
Because the rename is mechanical in syntax and semantic in behaviour. `prefetchQuery` swallowed failures; `query()` *"will either resolve with the data or throw with an error."* The types are compatible enough that TypeScript is satisfied, so nothing in the toolchain reports that every unhappy path in the codebase just changed. The resulting diff looks like a pure rename to a reviewer, which is precisely why it gets approved quickly — and the failures it introduces appear only when an upstream service misbehaves, which is not when CI runs.

**★ You have forty prefetch call sites. What single question do you ask at each one, and what does each answer imply?**
*"If this rejects, who catches it?"* If nobody does, it is a speculative warm-up and the port is an explicit, commented `.catch` restoring the old swallow. If a `Promise.all` inside a loader or Server Component does, it is the dangerous class — one failing key now fails the whole render — and the port is `Promise.allSettled` or a split between critical and optional keys. If the caller wants the value, it was an `ensureQueryData` and the port is a `try`/`catch` at the call site, which is genuinely better than the old shape. And if it is infinite, it additionally needs `pages` and `initialPageParam`.

**★ Describe precisely how this rename can cause a page to return 500 rather than merely log an error.**
An SSR loader warming several keys in `Promise.all`. With `prefetchQuery`, a failing key resolved anyway, was simply absent from the dehydrated cache, and the client refetched it — so a broken recommendations service produced a page missing one widget. Renamed to `query()`, that key rejects; `Promise.all` rejects on the first rejection; the loader throws; the render fails. The entire route is down because a best-effort panel could not load. It compounds with v5's other server-side change, *"`retry` now defaults to `0` instead of `3`"*, which removes the retries that used to hide the transient case.

**★ Why is an empty `.catch(() => {})` the *correct* code here when it is a smell nearly everywhere else?**
Because it is not new error suppression — it is the restoration of a semantic the previous API provided implicitly. A speculative prefetch has no user-visible success and should have no user-visible failure: the component that eventually mounts will fetch the key itself and surface any error in the place a user can act on. The docs' own examples import a `noop` purely to attach to a prefetch. What makes it defensible in review is the comment; without one, the next reader sees an empty catch and deletes it.

**★ How does `api.usePrefetch` map onto TanStack Query, and why is the obvious port wrong?**
`usePrefetch` returns a function that returns nothing — RTK Query's prefetch is fire-and-forget by construction, so there is no promise a caller could ever handle. The mapping is to `queryClient.query({ queryKey, queryFn })`, but only with a `.catch` attached; a bare `query()` gives the call a rejection channel that the original never had and nobody downstream is written to handle. It is worse than the v5 rename case because there is no deprecated identifier left in the codebase to audit afterwards — the new sites were born wrong.

**★ Is there anything about this deprecation that is an improvement rather than a tax?**
Two things. First, `prefetchQuery` applied one failure policy — swallow — to every key regardless of whether the page could render without it; `query()` forces you to choose per key, which is how you discover that your "prefetch everything in a `Promise.all`" loader never distinguished critical data from decoration. Second, the `ensureQueryData` class gets strictly better: the error arrives at the call site in a `catch` rather than as `undefined` propagating into a property access several lines later.

**★ What is genuinely unsettled about `queryClient.query()` and why does it matter for the port?**
Its cache-hit behaviour. `ensureQueryData` documented a "return the cached value, otherwise fetch" contract; the current `query()` description says only that it *"can be used to fetch and cache a query"* and does not state whether a fresh entry under `staleTime` short-circuits the fetch. I could not confirm it from the docs available — the `QueryClient` reference URL was not resolving on re-check. It matters because if `query()` always fetches, every `ensureQueryData` in a hot path becomes a request per call after a mechanical port. The honest position is to verify against the installed build before porting that class at scale, and to say so rather than guess.

**★ Should you do this rename during a v4 → v5 upgrade?**
No — do it as its own change, on your own schedule. Both methods still work in 5.102.8; they are deprecated, not removed. A change whose whole risk surface is error handling is exactly what you do not want buried in an upgrade where every other bug is also new and attribution is already hard. The counter-argument is real though: *"those methods will be removed in the next major version"*, and leaving them accumulates a forced change that will then arrive bundled with everything else in that major, done under time pressure. Ban new uses now, port the existing ones by class over a few PRs.

**★ Why does this deprecation not appear on the v4 → v5 migration guide, and what follows from that?**
It landed inside the v5 line rather than at the version boundary, so it is documented on the prefetching guide instead. What follows is that no amount of diligence with the migration guide will surface it: a team can complete a textbook upgrade and still have forty deprecated call sites. It is also invisible to the codemod, which targets the positional-to-object signature change. The only thing that finds it is a grep for the four method names — which is why it earns its own row in [`01f`](./01f-v4-to-v5-mechanical-versus-semantic.md)'s audit table.

**Why can a prefetch succeed and still buy you nothing?**
Because freshness, not presence, decides whether a mount refetches. `staleTime` defaults to `0`, so a prefetched entry is stale the moment it is written; when the component mounts a second later, the query is stale, and a stale query refetches on mount. The key is in the cache, the spinner still shows, and you made two requests instead of one. The fix is a non-zero `staleTime` on the *consumer* — or in the client's `defaultOptions` — not merely on the prefetch call.

**Where does a prefetch belong: an event handler or an effect?**
An event handler, in almost every case. Prefetching is a bet on intent — hover, focus, a viewport intersection, a route transition beginning — and intent is an event. Putting it in a `useEffect` means it re-runs whenever the dependencies churn, and a prefetch fired on every render is the sort of thing `prefetchQuery`'s silence let you ship without noticing. The exception is a route-level prefetch tied to route params, where the "event" genuinely is the parameter changing.

---

← [The status rename](./01h-the-status-rename-and-the-isloading-trap.md) · [Topic index](../README.md) · *End of the TanStack Query track*
