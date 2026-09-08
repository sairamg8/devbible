---
title: "Two migrations wear the same word: porting RTK Query to TanStack Query is a translation, upgrading v4 to v5 is an audit"
sidebar_label: "01 · RTK Query → TanStack Query"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5) — and, for the RTK side, this corpus's own validated Redux Toolkit pages. Documentation-validated; **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8** · **@reduxjs/toolkit 2.12.0**.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

# 🔄 Two Migrations, One Word

**This topic covers two things called "migration" that have nothing in common except the word.** Porting **RTK Query → TanStack Query** is a *translation*: nothing in your codebase is wrong, every line has to be rewritten, and the compiler helps you the whole way because the identifiers do not exist on the other side. Upgrading **TanStack Query v4 → v5** is an *audit*: almost nothing has to be rewritten, most of it can be done by a codemod — and the handful of changes that matter are the ones where your existing code still compiles and now means something narrower. The second is far more dangerous, and it is the one this topic spends most of its pages on.

## 1. The two migrations, side by side

| | RTK Query → TanStack Query | TanStack Query v4 → v5 |
|---|---|---|
| What moves | every fetch, every cache write, every invalidation | option names, one hook signature, a handful of flags |
| Who finds the mistakes | the compiler — `useGetUsersQuery` simply does not exist | **nobody**, for the changes that matter |
| Codemod | none possible; the models differ | yes, official, for the signature change only |
| Blast radius | the whole data layer, plus the Redux store | every component that reads `isLoading` |
| How you know you are done | the `createApi` file is deleted | you cannot know from the code; you have to check behaviour |
| The characteristic failure | two caches holding the same resource — see [`01e`](./01e-running-both-caches-at-once.md) | a spinner that stopped rendering — see [`01h`](./01h-the-status-rename-and-the-isloading-trap.md) |

🔴 **The last row is the whole point of this topic.** A translation fails loudly. An audit fails silently.

## 2. The idea both migrations turn on: mechanical vs semantic

Every change in a migration falls into one of two buckets, and they need completely different treatment:

- **Mechanical** — the old name and the new name mean the same thing. `cacheTime` → `gcTime`. A codemod, or `sed`, is correct here, and a review that reads "renamed, no behaviour change" is an honest review.
- **Semantic** — the code still compiles and now behaves differently. `isLoading` survives the upgrade untouched and means something narrower than it used to. No tool can find these, because there is nothing wrong with the syntax.

The classification for the entire v4 → v5 surface is in [`01f`](./01f-v4-to-v5-mechanical-versus-semantic.md). The rest of this page is the RTK Query translation, because that is what the original version of this page covered and it is still the harder *design* problem — just not the more dangerous one.

## 3. RTK Query and TanStack Query solve the same problem with different cache identity

Both libraries deduplicate in-flight requests, cache by argument, and refetch on a lifecycle. They differ in **how a mutation finds the queries it invalidated**, and everything else follows from that.

```text
RTK Query                                    TanStack Query
─────────────────────────────────────────────────────────────────────────
Tag GRAPH: providesTags / invalidatesTags →  Key HIERARCHY: array queryKeys +
  Late-bound. A query declares what it          prefix-matched invalidateQueries().
  provides; a mutation declares what it         Early-bound. The mutation names the
  invalidates. NEITHER names the other.         query's key prefix directly.

createApi() + endpoints                    →  Plain useQuery / useMutation, optionally
  (codegen: use*Query / use*Mutation)          centralised in a queryOptions() factory.
                                               No codegen step, no generated hooks.

keepUnusedDataFor (default 60s)            →  gcTime (default 5 minutes)
onQueryStarted + queryFulfilled            →  onMutate / onError / onSettled
api.util.updateQueryData (Immer + undo())  →  queryClient.setQueryData (no patch handle)

REQUIRES a Redux store: reducerPath,       →  Requires NO store. A QueryClient and a
  middleware, configureStore wiring             QueryClientProvider, nothing else.
```

### The translation rule, stated precisely

A tag is `{ type, id }`. A query key is an array, matched by prefix. So:

- **tag *type* becomes key element 0** — `'User'` → `['users', …]`
- **tag *id* becomes a later element** — `{ type: 'User', id: '7' }` → `['users', 'detail', '7']`
- **the `'LIST'` pseudo-id becomes the absence of further elements** — a prefix, not a value

That last one is why hunting for a `'LIST'` equivalent is wasted effort: `invalidateQueries({ queryKey: ['users', 'list'] })` already matches every page and every filter variant under it, because filters are prefix matches by default. See [Caching & Invalidation](../04-caching-and-invalidation/01-cache-management-apis.md) for the full filter surface — prefix, `exact: true`, and `predicate`.

The keys themselves are order-sensitive in one direction only:

> *"Query Keys are hashed deterministically!"*
> *"no matter the order of keys in objects, all of the following queries are considered equal"*
> *"Array item order matters!"*

That is a genuine ergonomic win over RTK Query: the RTK habit of hoisting or memoising an argument object to stop a refetch loop is **unnecessary here**. `queryKey: ['users', 'list', { page }]` rebuilt inline on every render hashes to the same key.

### 🔴 The one tag pattern that has no key-based translation

RTK Query's idiomatic `providesTags` returns a tag **per returned row**:

```typescript
providesTags: (result) =>
  result
    ? [{ type: 'User', id: 'LIST' }, ...result.map((u) => ({ type: 'User' as const, id: u.id }))]
    : [{ type: 'User', id: 'LIST' }],
```

That index is derived from the **response**. `invalidatesTags: [{ type: 'User', id: '7' }]` therefore refetches *any* cached list that happened to contain user 7, and leaves every list that did not alone.

**TanStack Query cannot express that through keys, because a key describes the request, not the response.** There is no response-derived index. You have two honest translations, and choosing between them is a real design decision rather than a lookup:

```typescript
// (a) BROAD — refetch every cached list under the prefix. Correct, one line,
//     and refetches lists that did not contain the user. Right answer for most apps.
onSettled: () => queryClient.invalidateQueries({ queryKey: ['users', 'list'] }),

// (b) SURGICAL — write the change into the list you are actually looking at,
//     then invalidate only the detail entry. No wasted refetch, but you now own
//     the correctness of the patch.
onSuccess: (updated, { id }) => {
  queryClient.setQueryData<User[]>(['users', 'list', currentFilters], (old) =>
    old?.map((u) => (u.id === id ? updated : u)),
  );
  queryClient.invalidateQueries({ queryKey: ['users', 'detail', id], exact: true });
},
```

⚠️ There is also a filter-based bulk form, `queryClient.setQueriesData(filters, updater)`, which is the closest thing to RTK's `selectInvalidatedBy` loop. **I could not re-confirm its documentation on 2026-09-08** — `https://tanstack.com/query/latest/docs/reference/QueryClient` returns `{"isNotFound":true}` today, the same failure the `useQuery` reference has. Check it against the version you install rather than taking it from this page.

## 4. What leaves the Redux store, and what that costs

RTK Query's cache **is** Redux state, mounted at `reducerPath`. TanStack Query's cache is an object graph inside a `QueryClient` that Redux has never heard of. Concretely, you lose:

- **Server state in Redux DevTools.** Every cache write was an action with a diff and a time-travel slider. It is gone. You get [React Query Devtools](../11-devtools/01-react-query-devtools.md) instead, which is better at query state and shows you nothing about the rest of your app.
- **One store snapshot in a bug report.** `store.getState()` used to contain the data the user was looking at. Now it contains half of it.
- **Persistence for free.** Whatever persisted your store persisted the API cache with it. TanStack Query's cache is outside that mechanism entirely and needs its own persister package; this page does not pin one — check the current docs before adopting it.
- **`resetApiState()` on logout.** The replacement is `queryClient.clear()`, and it is easy to forget precisely because the old one was wired into a reducer you already reset.

And you gain: no store to configure before the first query works, no middleware to forget to install, no `injectEndpoints` code-splitting dance, and a cache that a component in a library can use without the host app owning a Redux store.

## 5. The audit worth doing once the translation is done

Once every `createApi` endpoint is gone, look at what is actually left in the store. In most apps that adopted RTK Query early, the great majority of the store *was* the API cache, and the remainder is a sidebar boolean and a theme string — which does not need Redux, `react-redux`, a `Provider` and a middleware chain. That is a real opportunity the migration hands you, and the honest counter-argument is that Redux is also carrying your synchronous cross-cutting state (auth session, feature flags, undo stacks) and a large app usually still wants somewhere to put it. Decide it by measuring the leftover, not by momentum in either direction.

## Gotchas

**★ Symptom: you go looking for the `'LIST'` tag equivalent and cannot find one.** Cause: `'LIST'` is a pseudo-id RTK Query needs because tags are flat `{ type, id }` pairs with no hierarchy — there is nowhere else to put "the whole collection". Fix: stop looking. A key array *is* hierarchical, so `['users', 'list']` is the list tag, and `invalidateQueries({ queryKey: ['users', 'list'] })` matches every page and filter under it because filters prefix-match by default.

**★ Symptom: per-item invalidation that used to be surgical now refetches every list, or refetches nothing.** Cause: RTK Query's per-row `providesTags` builds a response-derived index; TanStack Query has no such index because keys describe requests. A literal port of `invalidatesTags: [{ type: 'User', id }]` to `invalidateQueries({ queryKey: ['users', id] })` matches nothing, since no list query has that key. Fix: pick (a) or (b) from §3 deliberately — broad prefix invalidation, or a `setQueryData` patch plus an `exact: true` detail invalidation.

**★ Symptom: an invalidation fires and the on-screen list does not refetch.** Cause: this one behaves the *same* in both libraries and people expect it not to — an invalidated query refetches immediately only while something is observing it. TanStack states both halves: *"It is marked as stale. This stale state overrides any `staleTime` configurations"* and *"If the query is currently being rendered via `useQuery` or related hooks, it will also be refetched in the background"*. Fix: nothing, usually. If a background entry genuinely must be warm, keep an observer mounted or refetch on mount.

**★ Symptom: you hoisted and memoised every query argument out of habit, and the code is now noisier for no reason.** Cause: RTK Query keys a cache entry on the serialised arg but also compares the arg by reference to decide whether it changed, so a fresh `{ page: 1 }` literal per render is a real problem there. TanStack Query hashes the key — *"Query Keys are hashed deterministically!"* — so an inline literal is fine. Fix: inline it; delete the `useMemo`.

**★ Symptom: `['users', page, filters]` and `['users', filters, page]` behave as two different caches and nobody can see why.** Cause: *"Array item order matters!"* — array position is identity, unlike object key order. Fix: build every key through one factory module so the order is written once, not at 40 call sites. This is the single highest-value piece of structure to add on day one of the migration.

**★ Symptom: after logout, the next user briefly sees the previous user's data.** Cause: `resetApiState()` was dispatched from your logout reducer and there is no reducer any more. Fix: `queryClient.clear()` in the logout handler, and treat it as a checklist item rather than something the store does for you.

**★ Symptom: the migrated screen makes far more network requests than the RTK Query version did.** Cause: the two libraries have different *defaults*, not different capabilities — TanStack Query considers cached data stale immediately and refetches on mount, focus and reconnect out of the box. Fix: this needs its own page; it is [`01b`](./01b-rtk-query-the-option-by-option-map.md), and it is the most common complaint after this migration.

## Interview questions

**★ RTK Query and TanStack Query both cache server state. What is the actual structural difference?**
How a mutation finds the queries it invalidated. RTK Query uses a late-bound tag graph: queries declare the tags they provide, mutations declare the tags they invalidate, and neither names the other — so a new query that provides `{ type: 'User', id: 'LIST' }` is automatically refreshed by mutations that already existed. TanStack Query uses early-bound key prefixes: the mutation names the key prefix it is invalidating, so a new query is only covered if its key was authored to sit under a prefix somebody already invalidates. The RTK model is more decoupled; the TanStack model is more visible, because the relationship is a string you can grep for.

**★ Which part of the tag model has no translation, and what do you do about it?**
Per-row `providesTags`. It builds an index from the response — "this cached list contains user 7" — and no query key can express that, because a key describes the request. The two honest answers are a broader prefix invalidation that refetches lists which did not contain the row, or a manual `setQueryData` patch of the entry you know is affected plus an exact invalidation of the detail entry. Anyone who claims a one-to-one mapping has not hit it yet.

**★ Why is the RTK Query migration safer than a v4 → v5 upgrade, even though it is ten times more work?**
Because none of the identifiers survive. `useGetUsersQuery`, `providesTags`, `queryFulfilled` and `api.util.updateQueryData` do not exist in TanStack Query, so an incomplete port is a build error. A v4 → v5 upgrade leaves `isLoading` in place with a narrower meaning and `status === 'loading'` as a branch that can never be true in plain JavaScript. Loud failure is cheap; silent failure is what pages a team at 2am.

**What happens to Redux itself after the migration?**
That is worth measuring rather than assuming. In an app that adopted RTK Query early, most of the store is the API cache, and the leftover is often small enough for `useState` and context — at which point keeping `configureStore`, the `Provider`, the middleware and `react-redux` is complexity you are paying for a theme toggle. But an app with real client state — an undo stack, a multi-step wizard, feature flags read from twenty places — still wants a store. Delete Redux because the remainder is genuinely trivial, not because the migration created momentum.

**What do you lose by moving the cache out of the store?**
Time-travel debugging over server state, a single `getState()` snapshot that contains everything the user was looking at, persistence that came for free with whatever persisted the store, and `resetApiState()` being part of a reducer you already reset on logout. Those are real losses and the honest answer names them; the compensations are React Query Devtools, no store setup as a precondition for fetching, and a data layer a shared component can use without imposing Redux on its host.

---

← [Testing TanStack Query](../15-testing-tanstack-query/01-isolated-and-integration-testing.md) · [Topic index](../README.md) · Next → [The option-by-option map](./01b-rtk-query-the-option-by-option-map.md)
