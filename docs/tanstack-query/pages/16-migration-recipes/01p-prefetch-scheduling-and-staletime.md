---
title: "The three prefetch problems the throw does not explain — an infinite port that needs two options no rename supplies, an RTK usePrefetch that arrives already broken, and a prefetch that succeeds, lands in the cache, and still leaves the user watching a spinner"
sidebar_label: "01p · Prefetch timing & `staleTime`"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Prefetching & Router Integration](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr), [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation), [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), and the [`QueryClient` reference](https://tanstack.com/query/latest/docs/reference/QueryClient) (quotes banked 2026-09-06; the reference URL returned `{"isNotFound":true}` on re-check 2026-09-08, so the `gcTime` and `query()` quotes below are **banked, not re-fetched today**). Documentation-validated; **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# ⏱️ The Prefetch That Bought Nothing

**[`01n`](./01n-prefetchquery-to-queryclient-query.md) sorted the deprecation by one question — *if this rejects, who catches it?* — and answered it for three of the four classes. This page takes the fourth, and then the two prefetch failures that have nothing to do with the throw at all.** The infinite variant needs two options no rename supplies, so it is silently wrong rather than loudly wrong. An RTK Query `usePrefetch` port is *born* wrong, with no deprecated identifier left behind to grep for. And the last one is the cruellest, because nothing failed: the prefetch fired, the request succeeded, the key is in the cache, and the component still renders a loading state — because `staleTime` defaults to `0` and presence was never what decided whether a mount refetches. Ports one and two are work; the third is the one that makes an entire prefetching strategy decorative.

## 1. Class (d) — `prefetchInfiniteQuery`

```ts
// ✅ v5 shape. Two traps live in this one call.
import { QueryClient, dehydrate } from '@tanstack/react-query';

export async function feedLoader({ params }: { params: { filter: string } }) {
  const queryClient = new QueryClient();

  await queryClient
    .infiniteQuery({
      queryKey: ['feed', params.filter],
      queryFn: ({ pageParam }) => fetchFeed({ cursor: pageParam, filter: params.filter }),
      initialPageParam: null,                       // trap 1: now REQUIRED
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      pages: 3,                                     // trap 2: without this you get ONE page
    })
    .catch(() => {});

  return { dehydratedState: dehydrate(queryClient) };
}
```

> *"By default, only the first page gets prefetched."*

So a straight rename of `prefetchInfiniteQuery` → `infiniteQuery` warms one page where the old call may have warmed several, and `initialPageParam` is now mandatory — in JavaScript its absence means your `queryFn` is called with `pageParam: undefined`. Both traps and the sequential cost of `pages: n` are covered in [topic 07](../07-pagination-and-infinite-queries/01d-infinite-cache-refetch-and-manual-updates.md); do not re-derive them, but do check every site.

**Then decide the class of *this* call as well.** `pages: 3` is three sequential round trips — each page's param comes from the previous page's response — so the same call is simultaneously a shape problem and a failure-policy problem from [`01n`](./01n-prefetchquery-to-queryclient-query.md). The `.catch` above says "this loader renders without a warm feed"; a loader that cannot, drops the catch and lets it throw.

## 2. The RTK Query angle: `usePrefetch` is always class (a)

`api.usePrefetch('endpoint')` returns a function that **returns nothing** — RTK Query's prefetch is fire-and-forget by construction, and there is no promise for a caller to reject:

```tsx
// RTK Query — the source shape. Nothing here can reject at the call site.
import { api } from './api';

function UserLink({ userId }: { userId: string }) {
  const prefetchUser = api.usePrefetch('getUser');
  return (
    <a href={`/users/${userId}`} onMouseEnter={() => prefetchUser(userId)}>
      Profile
    </a>
  );
}
```

[`01b`](./01b-rtk-query-the-option-by-option-map.md)'s mapping table sends that to `queryClient.query({ queryKey, queryFn })`, and **that row is only correct with the catch attached**:

```tsx
// ✅ TanStack Query — the only faithful port.
import { useQueryClient } from '@tanstack/react-query';

function UserLink({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  return (
    <a
      href={`/users/${userId}`}
      onMouseEnter={() => {
        queryClient
          .query({ queryKey: ['user', userId], queryFn: () => fetchUser(userId) })
          // usePrefetch had no rejection channel at all. query() does, and nothing
          // downstream is written to handle it. Restoring the old silence is the port.
          .catch(() => {});
      }}
    >
      Profile
    </a>
  );
}
```

🔴 **A literal port of `usePrefetch` to a bare `query()` is the fastest way to manufacture this bug**, and it is worse during an RTK migration than during a v5 upgrade: there is no deprecated method in the diff to grep for afterwards, because the new call sites were *born* wrong. Every `usePrefetch` in the source repo is a class-(a) site by definition — so audit the **source** repo, not the target: `grep -rn 'usePrefetch' src/` before you delete it. Port them as a batch, with the catch, and review the batch as one commit.

## 3. Urgency: not now, but not never

Both methods still work in **5.102.8**. They are deprecated, not removed. So:

- **Do it on your own schedule**, as its own reviewable diff, while nothing else is on fire. A rename whose entire risk is *error handling* is the last thing you want landing inside a major-version upgrade where every other bug is also new.
- **The honest counter-argument:** deprecated calls left in place accumulate. *"those methods will be removed in the next major version of TanStack Query"* — at that point the change is forced, it is bundled with everything else in that major, and the four-class triage happens under time pressure instead of over an afternoon. Doing it early converts a future rushed change into a present deliberate one.
- **A useful middle:** ban new uses today, port the existing ones by class over a few PRs.

Banning new uses is a lint rule, not a review convention — a convention is exactly what fails on the sprint where everyone is busy:

```json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "MemberExpression[property.name=/^(prefetchQuery|fetchQuery|prefetchInfiniteQuery|fetchInfiniteQuery|ensureQueryData|ensureInfiniteQueryData)$/]",
        "message": "Deprecated: use queryClient.query()/infiniteQuery() and choose a failure policy explicitly — see 16/01n."
      }
    ]
  }
}
```

⚠️ That selector matches property access by name, so it catches `qc.prefetchQuery(...)` as well as `queryClient.prefetchQuery(...)`, and misses computed access (`client['prefetchQuery']`) and any wrapper you wrote yourself. It is a ratchet on new code, not an audit — the audit is [`01n` §2](./01n-prefetchquery-to-queryclient-query.md).

## 4. The `staleTime: 0` interaction — the prefetch that bought nothing

[`01b`](./01b-rtk-query-the-option-by-option-map.md) names this in one line; here is the mechanism. Two sentences from Important Defaults do all the work:

> *"Query instances via `useQuery` or `useInfiniteQuery` by default consider cached data as stale."*
> *"Stale queries are refetched automatically in the background when: New instances of the query mount, The window is refocused, The network is reconnected"*

A prefetch writes the entry. The component mounts a moment later — a **new instance** of a query the client already considers **stale**. So it refetches. **The key is in cache, the render still shows a loading state, and you paid for two requests instead of one.**

The prefetch did not fail. It expired.

```tsx
// ⛔ Decorative. The prefetch lands, and the mount immediately refetches it.
function ProductLink({ id }: { id: string }) {
  const queryClient = useQueryClient();
  return (
    <Link
      to={`/products/${id}`}
      onMouseEnter={() => {
        queryClient
          .query({ queryKey: ['product', id], queryFn: () => fetchProduct(id) })
          .catch(() => {});
      }}
    >
      View
    </Link>
  );
}

// …and, in the page that mounts a moment later:
function ProductPage({ id }: { id: string }) {
  const { data, isPending } = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
  });                                     // staleTime defaults to 0 → refetch on mount
  // ...
}
```

The fix is a `staleTime` the two ends **agree** on, and the half that reliably decides the refetch is the **consumer's**:

```tsx
// ✅ The consuming hook is what decides whether the mount refetches.
function ProductPage({ id }: { id: string }) {
  const { data, isPending } = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
    staleTime: 60_000,
  });
  // ...
}
```

⚠️ Whether `staleTime` on the `query()` call itself is honoured identically to the way `prefetchQuery` honoured it is part of the unverified gap recorded in [`01n` §5](./01n-prefetchquery-to-queryclient-query.md). That is precisely why the snippet above puts the number on the consumer: the consumer's `staleTime` is what Important Defaults describes, and it settles the mount refetch on its own.

**The durable version stops writing the number twice.** A shared `queryOptions` factory ([`01c`](./01c-rtk-query-endpoints-to-query-options.md)) makes the key, the fetcher and the freshness one object that both ends import:

```ts
// queries/product.ts — one definition, two call sites.
import { queryOptions } from '@tanstack/react-query';

export const productQuery = (id: string) =>
  queryOptions({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
    staleTime: 60_000,
  });
```

```tsx
queryClient.query(productQuery(id)).catch(() => {});   // on hover
useQuery(productQuery(id));                            // in the page that mounts
```

A `staleTime` in the client's `defaultOptions` ([topic 13](../13-global-configuration/01-defaultoptions.md)) is the blunter form of the same fix, and it is the right one on the server: *"With SSR, we usually want to set some default staleTime above 0 to avoid refetching immediately on the client"*.

## Gotchas

**★ Symptom: an infinite list is warm for one page after porting `prefetchInfiniteQuery`, where it used to be warm for three.** Cause: *"By default, only the first page gets prefetched."* The `pages` option is not implied by anything in the old call. Fix: pass `pages: n` explicitly, and expect `n` sequential requests, since each page's param comes from the previous response.

**★ Symptom: `queryFn` is called with `pageParam: undefined` after the infinite-query port, and the API returns page one forever.** Cause: `initialPageParam` is required in v5 and its absence is silent in JavaScript. Fix: pass it explicitly — `initialPageParam: null` or `initialPageParam: 1`, matching what your cursor scheme's first request actually sends.

**★ 🔴 Symptom: a codebase that has never run TanStack Query v4 still has the unhandled-rejection bug.** Cause: an RTK Query migration. `usePrefetch` returns nothing, so a mechanical port to a bare `query()` gives every hover prefetch a rejection channel the original never had — and there is no deprecated identifier left in the tree to audit afterwards. Fix: grep the **source** repo for `usePrefetch` before you delete it, port that list as one batch with `.catch` attached, and keep the list in the PR description.

**★ Symptom: you prefetch a key on hover and the component still shows a spinner when the user clicks through.** Cause: `staleTime: 0`. *"Query instances via `useQuery` or `useInfiniteQuery` by default consider cached data as stale"*, and stale queries refetch when *"New instances of the query mount"* — so the entry was stale before the component existed. Fix: a real `staleTime` on the consuming `useQuery` (or in `defaultOptions`), not only on the prefetch. §4.

**★ Symptom: an SSR page hydrates with data and then immediately refetches every key you dehydrated.** Cause: the same default, on the boundary where it costs most — you paid for the server fetch, the serialisation *and* a duplicate client fetch. Fix: the docs are explicit: *"With SSR, we usually want to set some default staleTime above 0 to avoid refetching immediately on the client"*. Set it in the server client's `defaultOptions`, not on individual prefetches.

**★ Symptom: a prefetch with a generous `staleTime` still refetches on mount, and only on some routes.** Cause: something invalidated the key between the prefetch and the mount — a mutation's `onSuccess`, usually. *"It is marked as stale. This stale state overrides any `staleTime` configurations being used in `useQuery` or related hooks"*. Fix: nothing to fix in the prefetch; the invalidation is correct and it wins by design. Move the prefetch after the invalidation, or accept the refetch. Chasing it with a larger `staleTime` cannot work.

**★ Symptom: the prefetch fires, the request succeeds, and the component fetches the same URL anyway — with no spinner explanation and no invalidation involved.** Cause: the two ends built different keys. `['product', id]` where `id` is a number on hover and a string from `useParams` is two entries, because *"Query Keys are hashed deterministically!"* and *"Array item order matters!"* — the hash is of the exact array. Fix: a shared `queryOptions` factory, so key, fetcher and `staleTime` are written once ([`01c`](./01c-rtk-query-endpoints-to-query-options.md)); normalise the param inside the factory, not at each call site.

**★ Symptom: memory and cache-entry count grow on a page with aggressive hover prefetching.** Cause: a prefetched key that no hook ever observes is still a cache entry. It parks until `gcTime` collects it — *"If the query is not utilized by a query hook within the default `gcTime`, the query will be garbage collected. If the default `gcTime` has not been configured, it defaults to 5 minutes."* Fix: prefetch on intent (hover, focus, viewport), not on render of every row; consider a shorter `gcTime` for speculative keys.

**★ Symptom: a prefetch fires on every re-render.** Cause: the port moved the call from an event handler into a `useEffect` — or into the component body — during the rewrite. `prefetchQuery`'s silence made this cheap to get wrong; `query()` makes it loud, which is the only good news in the gotcha. Fix: keep speculative prefetches in event handlers. If a prefetch genuinely belongs in an effect, its dependency array must be the query key's inputs and nothing else.

**★ Symptom: a prefetch keeps running after the user navigates away.** Cause: nothing about the rename changes this — a prefetch is a request like any other, and cancellation needs the `signal` passed through to `fetch`. Fix: accept and forward the `signal` in the `queryFn`, per [topic 12](../12-query-cancellation/01-abortsignal-integration.md). Worth doing at the same time, because you are already editing every prefetch call site.

**★ Symptom: the codemod/`sed` diff is a hundred lines of pure rename and gets approved in seconds.** Cause: that is exactly what a mechanical-looking, semantically-loaded diff looks like — the same trap [`01f`](./01f-v4-to-v5-mechanical-versus-semantic.md) records for the official v5 codemod. Fix: never land this as one commit. One commit per class, with each commit's message naming the class and the failure policy it chose.

**★ Symptom: you finish the port, and three new `prefetchQuery` calls appear the following sprint.** Cause: nothing stops them. The methods still exist and still work in 5.102.8, and a review convention is not enforcement. Fix: the `no-restricted-syntax` rule in §3, landed in the *same* PR as the port so the count can only go down. Note it matches on property name, so it also catches `qc.prefetchQuery`, and misses computed access and your own wrappers.

**★ Symptom: `queryClient.query` is not a function.** Cause: the installed version predates the `query()`/`infiniteQuery()` methods — they are the v5-line replacements, not v4 API. Fix: check the installed version before you plan the port (`node -p "require('@tanstack/react-query/package.json').version"`); this page pins **5.102.8**.

## Interview questions

**★ How does `api.usePrefetch` map onto TanStack Query, and why is the obvious port wrong?**
`usePrefetch` returns a function that returns nothing — RTK Query's prefetch is fire-and-forget by construction, so there is no promise a caller could ever handle. The mapping is to `queryClient.query({ queryKey, queryFn })`, but only with a `.catch` attached; a bare `query()` gives the call a rejection channel that the original never had and nobody downstream is written to handle. It is worse than the v5 rename case because there is no deprecated identifier left in the codebase to audit afterwards — the new sites were born wrong, so the audit has to happen in the repo you are migrating *away* from, before you delete it.

**★ What must you add when porting `prefetchInfiniteQuery`, and what does each addition cost?**
Two options that no rename supplies. `initialPageParam` is now required, and its absence is silent in JavaScript — the `queryFn` receives `pageParam: undefined` and most APIs cheerfully return page one, so the list is warm with the wrong page and nothing errors. And `pages: n`, because *"By default, only the first page gets prefetched"*; without it a call that used to warm three pages warms one, which shows up as a spinner at the first scroll rather than as an error. The cost of `pages: n` is `n` **sequential** round trips — page two's param comes out of page one's response — so it is not free, and on a slow upstream it is the reason a loader's time-to-first-byte moves.

**★ Should you do this rename during a v4 → v5 upgrade?**
No — do it as its own change, on your own schedule. Both methods still work in 5.102.8; they are deprecated, not removed. A change whose whole risk surface is error handling is exactly what you do not want buried in an upgrade where every other bug is also new and attribution is already hard. The counter-argument is real though: *"those methods will be removed in the next major version of TanStack Query"*, and leaving them accumulates a forced change that will then arrive bundled with everything else in that major, done under time pressure. Ban new uses now, port the existing ones by class over a few PRs.

**★ You have decided to defer the port. What do you do today so the debt stops growing?**
Three things, in order of how much they survive turnover. A lint rule — `no-restricted-syntax` on the six method names — so new uses fail CI rather than depending on a reviewer remembering; it lands as its own PR and needs no behaviour change. The checked-in `prefetch-audit.txt` from [`01n` §2](./01n-prefetchquery-to-queryclient-query.md), so the size of the debt is a number in the repo rather than a feeling. And a note on the highest-risk class — the SSR loaders — because that is the one whose eventual port can take a route down, and it is the one you want done deliberately rather than in the hour the next major lands.

**★ Why can a prefetch succeed and still buy you nothing?**
Because freshness, not presence, decides whether a mount refetches. `staleTime` defaults to `0` — *"Query instances via `useQuery` or `useInfiniteQuery` by default consider cached data as stale"* — so a prefetched entry is stale the moment it is written; when the component mounts a second later it is a *"new instance"* of a stale query, and new instances of stale queries refetch. The key is in the cache, the spinner still shows, and you made two requests instead of one. The fix is a non-zero `staleTime` on the *consumer* — or in the client's `defaultOptions` — not merely on the prefetch call. On the server the docs say it outright: *"With SSR, we usually want to set some default staleTime above 0 to avoid refetching immediately on the client"*.

**★ How do you keep a prefetch and the hook that consumes it in agreement over time?**
Stop writing the pair twice. A prefetch and its consumer must agree on the query key *and* the freshness window, and both drift the moment someone edits one file — a param normalised to a string on one side, a `staleTime` raised on the other. A `queryOptions` factory exported from one module makes the key, the fetcher and the `staleTime` a single object that both the `queryClient.query(...)` call and the `useQuery(...)` call import, so drift becomes a type error or nothing at all. It matters more than it looks because a key mismatch fails *silently*: both requests succeed, the cache holds two entries, and the only symptom is a duplicated network call.

**★ Where does a prefetch belong: an event handler or an effect?**
An event handler, in almost every case. Prefetching is a bet on intent — hover, focus, a viewport intersection, a route transition beginning — and intent is an event. Putting it in a `useEffect` means it re-runs whenever the dependencies churn, and a prefetch fired on every render is the sort of thing `prefetchQuery`'s silence let you ship without noticing. The exception is a route-level prefetch tied to route params, where the "event" genuinely is the parameter changing.

---

← [Prefetch → `query()`](./01n-prefetchquery-to-queryclient-query.md) · [Topic index](../README.md) · *End of the TanStack Query track*
