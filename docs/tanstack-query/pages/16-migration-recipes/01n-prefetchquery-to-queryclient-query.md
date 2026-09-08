---
title: "A global find-and-replace of prefetchQuery to query compiles cleanly, passes review, and converts a category of harmless cache warm-ups into unhandled rejections — because your forty prefetch call sites are four different call sites wearing the same method name"
sidebar_label: "01n · Prefetch → `query()`"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Prefetching & Router Integration](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching), [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5), and the [`QueryClient` reference](https://tanstack.com/query/latest/docs/reference/QueryClient) (quotes banked 2026-09-06; the reference URL returned `{"isNotFound":true}` on re-check 2026-09-08, so the reference quotes below are **banked, not re-fetched today**). Documentation-validated; **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# 🔁 One Rename, Four Ports

**`prefetchQuery` and `ensureQueryData` are deprecated in favour of `queryClient.query()`, and the two methods differ in exactly one way that matters: the old one swallowed failures and the new one throws.** That makes the rename mechanical in *syntax* and semantic in *behaviour* — the worst combination, because `sed -i 's/prefetchQuery/query/g'` produces a diff that compiles, type-checks, passes review in thirty seconds, and changes what happens on every unhappy path in the codebase. This page is not another explanation of what `query()` does; [topic 09](../09-prefetching-and-ssr/01-server-rendered-data-flow.md), [topic 10](../10-suspense-integration/01d-fetch-on-render-and-streaming.md) and [topic 07](../07-pagination-and-infinite-queries/01-paged-data-patterns.md) already cover the mechanism. **This is the worklist.** You have forty call sites; they sort into four classes; each class has a different correct port, and one of them is an outage. Three of them are below. The fourth — the infinite variant, which needs two options no rename supplies — opens [`01p`](./01p-prefetch-scheduling-and-staletime.md), because its problem is not the throw at all.

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
| *any of the above, but infinite* | **(d)** `prefetchInfiniteQuery` → [`01p` §1](./01p-prefetch-scheduling-and-staletime.md) | `infiniteQuery` + `pages` + `initialPageParam` |

Finding them. Match on the **method names alone**, never on `queryClient.` — half a codebase reaches the client through `qc`, `props.queryClient`, or a helper that closes over it:

```bash
# 1 — the worklist. Every deprecated entry point, with file and line.
grep -rnE \
  --include='*.ts' --include='*.tsx' \
  '\b(prefetchQuery|fetchQuery|prefetchInfiniteQuery|fetchInfiniteQuery|ensureQueryData|ensureInfiniteQueryData)\b' \
  src/ \
  | tee prefetch-audit.txt

# 2 — class (a) candidates: nothing on the line handles the promise.
grep -v 'await'    prefetch-audit.txt \
  | grep -v '\.catch' \
  | grep -v '\.then'

# 3 — class (b) candidates: a Promise.all within four lines above the call.
grep -rn -B4 \
  --include='*.ts' --include='*.tsx' \
  '\b(prefetchQuery|ensureQueryData)\b' \
  src/ \
  | grep 'Promise\.all'

# 4 — class (d): the infinite variants, which need two options no rename supplies.
grep -rnE \
  --include='*.ts' --include='*.tsx' \
  '\b(prefetchInfiniteQuery|fetchInfiniteQuery|ensureInfiniteQueryData)\b' \
  src/
```

⚠️ **`grep` finds the call, not the class.** Commands 2–4 are candidate filters, not answers; a prefetch three lines below a `Promise.all([` is still inside it, and a prefetch wrapped in a helper is classified by the helper's *callers*, not by the helper. Read every hit in command 1's output. Check `prefetch-audit.txt` into the branch — it is the checklist you tick off, and it is the thing a reviewer asks to see.

## 3. Class (a) — the speculative warm-up

`onMouseEnter` on a link, a route-hover prefetch, "warm page N+1 while the user reads page N". It is **fire-and-forget by design**: nobody awaits it, nobody reads its value, and its failing is *supposed* to be a non-event, because the component that eventually mounts will fetch the key itself.

```tsx
// ⛔ WRONG PORT — the find-and-replace output. Compiles. Type-checks. Rejects into the void.
import { useQueryClient } from '@tanstack/react-query';

function ProductLink({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  return (
    <Link
      to={`/products/${productId}`}
      onMouseEnter={() => {
        queryClient.query({
          queryKey: ['product', productId],
          queryFn: () => fetchProduct(productId),
        });
      }}
    >
      View
    </Link>
  );
}
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
          .query({
            queryKey: ['product', productId],
            queryFn: () => fetchProduct(productId),
          })
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
// ⛔ WRONG PORT — this is the one that 500s the page.
import { QueryClient, dehydrate } from '@tanstack/react-query';

export async function loader({ params }: { params: { id: string } }) {
  const queryClient = new QueryClient();

  await Promise.all([
    queryClient.query({ queryKey: ['user', params.id], queryFn: () => fetchUser(params.id) }),
    queryClient.query({ queryKey: ['orders', params.id], queryFn: () => fetchOrders(params.id) }),
    queryClient.query({ queryKey: ['recommendations'], queryFn: fetchRecommendations }),
  ]);

  return { dehydratedState: dehydrate(queryClient) };
}
```

**Before the rename**, `prefetchQuery` swallowed. A flaky recommendations service left `['recommendations']` unresolved in the dehydrated cache, the page rendered with the other two keys hydrated, and the client's `useQuery` fetched recommendations itself — a degraded widget, not an incident.

**After the rename**, `Promise.all` rejects on the *first* rejection. The loader throws. The server render fails. **A best-effort recommendations panel now takes down the whole route**, and the blast radius is proportional to how many keys you were warming.

🔴 **Two v5 changes compound here.** [`01f`](./01f-v4-to-v5-mechanical-versus-semantic.md) records the other one: *"`retry` now defaults to `0` instead of `3`"* on the server. So the same transient blip that previously got three attempts *and* was swallowed now gets one attempt and throws. Neither change is wrong; together they turn a class of soft failure into a hard one, and only one of them is on any migration guide.

```tsx
// ✅ RIGHT PORT — allSettled preserves the old resilience explicitly.
import { QueryClient, dehydrate } from '@tanstack/react-query';

export async function loader({ params }: { params: { id: string } }) {
  const queryClient = new QueryClient();

  const results = await Promise.allSettled([
    queryClient.query({ queryKey: ['user', params.id], queryFn: () => fetchUser(params.id) }),
    queryClient.query({ queryKey: ['orders', params.id], queryFn: () => fetchOrders(params.id) }),
    queryClient.query({ queryKey: ['recommendations'], queryFn: fetchRecommendations }),
  ]);

  // The rename is now the moment you get to CHOOSE, per key, instead of inheriting a swallow.
  for (const r of results) {
    if (r.status === 'rejected') {
      logger.warn({ err: r.reason }, 'prefetch failed; client will refetch');
    }
  }

  return { dehydratedState: dehydrate(queryClient) };
}
```

**The better version distinguishes critical from optional keys**, which `prefetchQuery` never let you do:

```tsx
// ✅ BEST PORT — the user is the page; recommendations are a nice-to-have.
import { QueryClient, dehydrate } from '@tanstack/react-query';

export async function loader({ params }: { params: { id: string } }) {
  const queryClient = new QueryClient();

  // No catch: if the user 404s, this route legitimately has no page to render,
  // and throwing here is what hands the request to the route's error boundary.
  await queryClient.query({
    queryKey: ['user', params.id],
    queryFn: () => fetchUser(params.id),
  });

  // Best effort. A failure here is a missing widget, not a missing page.
  await Promise.allSettled([
    queryClient.query({ queryKey: ['orders', params.id], queryFn: () => fetchOrders(params.id) }),
    queryClient.query({ queryKey: ['recommendations'], queryFn: fetchRecommendations }),
  ]);

  return { dehydratedState: dehydrate(queryClient) };
}
```

That is the honest upside of the deprecation: `prefetchQuery` gave every key the same failure policy — swallow — whether or not the page could render without it.

## 5. Class (c) — `ensureQueryData` used for its return value

*"Give me this data; use the cache if you have it, fetch if you don't."* Here the caller wants the value, so the throw is an **improvement**: you handle the failure at the call site instead of discovering `undefined` three lines later.

```ts
// ⛔ BEFORE — the failure surfaces as a TypeError somewhere else entirely.
async function bootstrapTheme(queryClient: QueryClient) {
  const settings = await queryClient.ensureQueryData({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });
  applyTheme(settings.theme);   // settings is undefined on failure →
                                // "Cannot read properties of undefined (reading 'theme')"
}
```

```ts
// ✅ AFTER — the error arrives where the decision is.
async function bootstrapTheme(queryClient: QueryClient) {
  try {
    const settings = await queryClient.query({
      queryKey: ['settings'],
      queryFn: fetchSettings,
    });
    applyTheme(settings.theme);
  } catch (err) {
    logger.warn({ err }, 'settings unavailable; using defaults');
    applyTheme(DEFAULT_THEME);
  }
}
```

⚠️ **Not settled by any source I have, and I am not going to guess:** whether `queryClient.query()` reuses a fresh cache entry under `staleTime` the way `ensureQueryData` did, or always initiates a fetch. `ensureQueryData`'s documented contract was "return the cached value if present, otherwise fetch"; the `query()` description quoted above says only that it *"can be used to fetch and cache a query"* and settles nothing about cache-hit behaviour. **This is load-bearing for exactly this class** — if `query()` always fetches, an `ensureQueryData` call inside a hot path becomes a request per call. **Verify against the installed build before porting class (c) at scale**, and until then treat every class-(c) site as a possible new network call.

That same gap limits how much a `staleTime` on the prefetch call itself can be trusted, which is why [`01p` §4](./01p-prefetch-scheduling-and-staletime.md) puts the reliable half of the `staleTime` fix on the *consumer* rather than on the prefetch.

## Gotchas

**★ Symptom: after the rename, `Uncaught (in promise)` errors appear in the console in bursts while a user moves the mouse down a list.** Cause: class-(a) hover prefetches. `query()` *"will either resolve with the data or throw with an error"*, so every warm-up of a key whose request fails is now a floating rejection, and a mouse sweep fires many. Fix: `.catch(() => {})` with a comment saying why, on every fire-and-forget prefetch.

**★ 🔴 Symptom: a route that renders fine in dev starts returning 500s in production whenever one non-critical upstream is degraded.** Cause: several `query()` calls in a `Promise.all` inside an SSR loader. `Promise.all` rejects on the first rejection and the render throws — where `prefetchQuery` left the key unresolved and the page rendered. Fix: `Promise.allSettled`, or split the array into "the page cannot render without this" (plain `await`, no catch) and "best effort" (`allSettled`). §4 shows both.

**★ Symptom: the same route now fails on transient errors that used to ride through.** Cause: two independent v5 changes compounding — *"`retry` now defaults to `0` instead of `3`"* on the server, **and** the prefetch method now throwing. The first removes the retries that hid the blip; the second turns the resulting failure into a thrown one. Fix: fix the throw with `allSettled`, and set `retry` explicitly on the server client if you were genuinely relying on retries.

**★ Symptom: a Node route handler or a script exits with a non-zero code after a prefetch fails, with no error handler having run.** Cause: modern Node treats an unhandled rejection as fatal by default (`--unhandled-rejections=throw`). A swallowed prefetch in v4 was inert; in v5 an uncaught one can terminate the process. Fix: the same explicit `.catch` — and note this makes class (a) *more* dangerous on the server than in the browser, where it is only console noise.

**★ Symptom: a reviewer deletes your `.catch(() => {})` in a follow-up PR as "swallowing errors".** Cause: an empty catch is a legitimate smell everywhere else in a codebase, and the reason it is correct here is invisible from the diff. Fix: a comment on the catch stating that this is a speculative prefetch and that `query()` throws where `prefetchQuery` did not. Uncommented, it will be removed and the bug will come back.

**★ Symptom: the audit turns up eight call sites and the app has forty.** Cause: the greps in §2 matched `queryClient.prefetchQuery` but the codebase reaches the client through an alias (`qc`, `props.queryClient`) or, worse, through a wrapper — `prefetchProduct(id)` in a `lib/prefetch.ts` that nobody's grep pattern mentions. Fix: match on the **method names alone**, as command 1 does; then grep for each wrapper's own name to find its callers, because a wrapper is classified by its callers and one wrapper can have sites in three different classes.

**★ Symptom: a call site you filed as class (a) turns out to be class (b) in production.** Cause: the `Promise.all` is in a different file. A helper `warmDashboard(queryClient)` that itself contains bare prefetches looks fire-and-forget in isolation, but its caller does `await Promise.all([warmDashboard(qc), warmSidebar(qc)])` — so the helper's rejections propagate into a render path. Fix: classify **from the outermost caller inwards**, and give each helper an explicit failure policy in its own body rather than leaving it to whoever awaits it.

**★ Symptom: after porting class (c), a genuine 404 renders the default state instead of a not-found page.** Cause: the `try`/`catch` you added is doing exactly what the old `undefined` did, only tidier — it turns *every* failure into the fallback, including the ones that should change the route. Fix: branch inside the catch on the error, not around it: rethrow (or `throw notFound()`) for a 404, fall back to defaults for a timeout or a 5xx. The improvement in class (c) is that you now *have* the error object; discarding it wastes the whole point of the deprecation.

**★ Symptom: a test that asserted "prefetch failure does not break the page" now fails after the rename.** Cause: that test was asserting the *old* swallow, and it is doing its job — it caught the semantic change. Fix: do not delete it. Change it to assert the new deliberate policy: that a failing speculative prefetch is caught, and that a failing loader prefetch is handled by `allSettled`. Harness setup is in [topic 15](../15-testing-tanstack-query/01-isolated-and-integration-testing.md).

## Interview questions

**★ Why is `sed -i 's/prefetchQuery/query/g'` a dangerous change even though it produces a clean build?**
Because the rename is mechanical in syntax and semantic in behaviour. `prefetchQuery` swallowed failures; `query()` *"will either resolve with the data or throw with an error."* The types are compatible enough that TypeScript is satisfied, so nothing in the toolchain reports that every unhappy path in the codebase just changed. The resulting diff looks like a pure rename to a reviewer, which is precisely why it gets approved quickly — and the failures it introduces appear only when an upstream service misbehaves, which is not when CI runs.

**★ You have forty prefetch call sites. What single question do you ask at each one, and what does each answer imply?**
*"If this rejects, who catches it?"* If nobody does, it is a speculative warm-up and the port is an explicit, commented `.catch` restoring the old swallow. If a `Promise.all` inside a loader or Server Component does, it is the dangerous class — one failing key now fails the whole render — and the port is `Promise.allSettled` or a split between critical and optional keys. If the caller wants the value, it was an `ensureQueryData` and the port is a `try`/`catch` at the call site, which is genuinely better than the old shape. And if it is infinite, it additionally needs `pages` and `initialPageParam`.

**★ Describe precisely how this rename can cause a page to return 500 rather than merely log an error.**
An SSR loader warming several keys in `Promise.all`. With `prefetchQuery`, a failing key resolved anyway, was simply absent from the dehydrated cache, and the client refetched it — so a broken recommendations service produced a page missing one widget. Renamed to `query()`, that key rejects; `Promise.all` rejects on the first rejection; the loader throws; the render fails. The entire route is down because a best-effort panel could not load. It compounds with v5's other server-side change, *"`retry` now defaults to `0` instead of `3`"*, which removes the retries that used to hide the transient case.

**★ Why is an empty `.catch(() => {})` the *correct* code here when it is a smell nearly everywhere else?**
Because it is not new error suppression — it is the restoration of a semantic the previous API provided implicitly. A speculative prefetch has no user-visible success and should have no user-visible failure: the component that eventually mounts will fetch the key itself and surface any error in the place a user can act on. The docs' own examples import a `noop` purely to attach to a prefetch. What makes it defensible in review is the comment; without one, the next reader sees an empty catch and deletes it.

**★ Your grep finds eight call sites and you are certain there are more. Where are the others?**
Behind aliases and behind wrappers. A pattern anchored on `queryClient.` misses `qc.prefetchQuery(...)`, `props.queryClient.ensureQueryData(...)` and every destructured form, so match on the method names alone. Wrappers are worse than misses: a `lib/prefetch.ts` helper contains one prefetch and forty callers, and those callers are not all in the same class — some fire it on hover, one awaits it inside a loader's `Promise.all`. The right unit of triage is the outermost caller, so you find the wrappers first, then grep for each wrapper's own name, and give the wrapper an explicit failure policy in its own body so its class stops depending on who called it.

**★ Is there anything about this deprecation that is an improvement rather than a tax?**
Two things. First, `prefetchQuery` applied one failure policy — swallow — to every key regardless of whether the page could render without it; `query()` forces you to choose per key, which is how you discover that your "prefetch everything in a `Promise.all`" loader never distinguished critical data from decoration. Second, the `ensureQueryData` class gets strictly better: the error arrives at the call site in a `catch` rather than as `undefined` propagating into a property access several lines later — provided you then branch on the error rather than flattening every failure into one fallback.

**★ What is genuinely unsettled about `queryClient.query()` and why does it matter for the port?**
Its cache-hit behaviour. `ensureQueryData` documented a "return the cached value, otherwise fetch" contract; the current `query()` description says only that it *"can be used to fetch and cache a query"* and does not state whether a fresh entry under `staleTime` short-circuits the fetch. I could not confirm it from the docs available — the `QueryClient` reference URL was not resolving on re-check. It matters because if `query()` always fetches, every `ensureQueryData` in a hot path becomes a request per call after a mechanical port. The honest position is to verify against the installed build before porting that class at scale, and to say so rather than guess.

**★ Why does this deprecation not appear on the v4 → v5 migration guide, and what follows from that?**
It landed inside the v5 line rather than at the version boundary, so it is documented on the prefetching guide instead. What follows is that no amount of diligence with the migration guide will surface it: a team can complete a textbook upgrade and still have forty deprecated call sites. It is also invisible to the codemod, which targets the positional-to-object signature change. The only thing that finds it is a grep for the six method names — which is why it earns its own row in [`01f`](./01f-v4-to-v5-mechanical-versus-semantic.md)'s audit table.

---

← [Auditing a codebase for the rotation](./01j-auditing-a-codebase-for-the-rotation.md) · [Topic index](../README.md) · Next → [Prefetch timing & `staleTime`](./01p-prefetch-scheduling-and-staletime.md)
