---
title: "A factory that takes a parameter has to decide four things the docs never spell out — whether the key is a tuple, whether the fetcher reads its arguments from the key or from a closure, what a spread is allowed to override, and what `skipToken` inside a shared definition does to every non-hook consumer of it"
sidebar_label: "01g2 · Parameterised factories"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [TypeScript](https://tanstack.com/query/latest/docs/framework/react/typescript), [Prefetching & Router Integration](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching), [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5), [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries). ⚠️ The reference pages under `…/docs/reference/` return `{"isNotFound":true}` on the live site today, so **no signature on this page is quoted** — the exact generics of `queryOptions`, `infiniteQueryOptions` and the `queryFn` context object are marked `⚠️ Extrapolated` wherever this page relies on them. Documentation-validated; **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# 🏭 Parameterised Factories, Composition and the Gated Definition

**[`01g`](./01g-queryoptions-factories-and-type-inference.md) argued that one options object should be the single definition of a query. This page is what happens when that object takes an argument.** A parameter has to reach three places — the key, the fetcher and sometimes `select` — and each route has a way to go quietly wrong: a key that widens to `string[]` and stops narrowing anything, a fetcher that reads its id from a closure while the key says something else, a spread that overrides a key and keeps a fetcher, and a `skipToken` that makes a definition safe for a hook and unsafe for every prefetch that imports it. None of these produce an error. They produce a second cache entry, which is the same thing as a bug you cannot see.

## 1. Parameterised factories: make the key a tuple

```ts
// api/users.ts
import { queryOptions } from '@tanstack/react-query';

export const userKeys = {
  all: ['users'] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

const getUser = (id: string, signal?: AbortSignal) => http<User>(`/users/${id}`, { signal });

export const userQueries = {
  detail: (id: string) =>
    queryOptions({
      queryKey: userKeys.detail(id),
      queryFn: ({ signal }) => getUser(id, signal),
      staleTime: 30_000,
    }),
};
```

Three deliberate choices in ten lines:

- **`as const` on every key builder.** Without it a key literal widens to `string[]`, and a widened key destructures inside `queryFn` to `string` at best and `unknown` at worst, which removes the one thing §2 is about. ⚠️ **Extrapolated:** whether `queryOptions` would infer a tuple *without* `as const` depends on how its key generic is constrained, and that constraint is not printed on any reachable page. `as const` costs nothing and makes the question moot — write it.
- **The parameter is typed, so normalisation happens once.** `detail(id: string)` called with a number is a compile error at the call site rather than a second cache entry at runtime. That is the whole point: `['users','detail',7]` and `['users','detail','7']` hash differently — *"Query Keys are hashed deterministically!"* — so a route param that arrives as a string and a prefetch that passes a number are two caches and two requests, with no symptom other than the duplicate.
- **The fetcher is a separate named function.** Both the total and the gated form in §4 need it, and a fetcher that is not an inline arrow is one you can unit-test without the library.

**Generics flow through the factory the way they flow through any function.** A factory can be generic in its own data type, and the hook picks it up:

```ts
export function resourceQuery<T>(resource: string, id: string, parse: (raw: unknown) => T) {
  return queryOptions({
    queryKey: [resource, 'detail', id] as const,
    queryFn: async ({ signal }) => parse(await http<unknown>(`/${resource}/${id}`, { signal })),
  });
}

const { data } = useQuery(resourceQuery('users', id, parseUser));
//      ^? User | undefined  — T is fixed at the call site and reaches the hook
```

⚠️ **Extrapolated:** the guide states the behaviour — *"the `queryKey` returned from `queryOptions` knows about the `queryFn` associated with it"* — but never says how the key type carries it. Treat the key's type as **opaque**: read it as `userQueries.detail(id).queryKey` and never re-annotate it. Writing `const key: readonly ['users', 'detail', string] = userQueries.detail(id).queryKey;` compiles fine and silently throws away whatever was carrying the data type, so the next `getQueryData(key)` is `unknown` again and nobody can see why.

## 2. What the key hands your `queryFn`

The `queryFn` receives a context object, and when the key is a literal tuple its elements are typed:

```ts
export const userQueries = {
  detail: (id: string) =>
    queryOptions({
      queryKey: userKeys.detail(id),
      queryFn: async ({ queryKey, signal }) => {
        const [, , userId] = queryKey;        // typed from the tuple, not from the closure
        return http<User>(`/users/${userId}`, { signal });
      },
    }),
};
```

**Reading the id out of the key versus closing over it is a real trade-off, not a style question.**

- *Closure* (`getUser(id, signal)`) is shorter and obviously correct at a glance, and it is what most codebases should write.
- *Key destructuring* makes it **structurally impossible** for the key and the request to disagree. If someone edits `userKeys.detail` to add a tenant segment and forgets the fetcher, the closure form keeps fetching the old URL under a new key — two caches, no error — while the destructuring form shifts the tuple index and either breaks the build or breaks loudly at the first request.

`signal` is the third element and it is not optional in a serious codebase: forward it to `fetch` or the query is uncancellable no matter what the library does ([topic 12](../12-query-cancellation/01-abortsignal-integration.md)). `pageParam` exists **only** in the infinite variant (§5); reaching for it in a plain `queryOptions` is how people end up with `undefined` in a URL.

## 3. Composition: what a spread may and may not override

Layering policy on top of a base definition is the good case, and it is the reason the factory returns a plain object at all:

```ts
export const groupsQuery = () =>
  queryOptions({ queryKey: ['groups', 'list'] as const, queryFn: fetchGroups, staleTime: 60_000 });

// ✅ Policy only. Same key, same fetcher, different tolerance — and a NAME for the exception.
export const groupsQueryLive = () =>
  queryOptions({ ...groupsQuery(), staleTime: 0, refetchInterval: 5_000 });
```

⚠️ **Extrapolated:** a bare object spread `{ ...groupsQuery(), staleTime: 0 }` preserves each property's type structurally, so the key ought to keep carrying its data type — but nothing on a reachable page says so. **Re-wrap the spread in `queryOptions()` whenever you export the result**, as above; it is one call and it removes the question. An unwrapped spread passed straight into `useQuery` at a call site is fine either way, because the hook is contextually typed from the `queryFn` in the spread.

**Overriding `select` in a spread replaces it; it never chains.** If the base already has a `select`, the composed version's `data` is whatever the *new* selector returns, computed from the raw cached value — not from the base's projection. Chaining is something you write by hand:

```ts
const toNames = (groups: Group[]) => groups.map((g) => g.name);
const firstThree = (names: string[]) => names.slice(0, 3);

export const topGroupNamesQuery = () =>
  queryOptions({ ...groupsQuery(), select: (groups: Group[]) => firstThree(toNames(groups)) });
```

⚠️ That composed arrow is built fresh on every factory call, so it re-runs every render unless you hoist it — the rule and the fixes are [`01g` §5](./01g-queryoptions-factories-and-type-inference.md) and [`01f`](./01f-select.md).

🔴 **A spread must never change the key without changing the fetcher, or the reverse.** This is the single most damaging composition mistake, because it type-checks perfectly:

```ts
// ⛔ A key that lies. Fetches ALL groups, files them under 'archived'.
export const archivedGroupsQuery = () =>
  queryOptions({ ...groupsQuery(), queryKey: ['groups', 'archived'] as const });
```

Two entries hold the same payload, the archived screen shows unarchived rows, and an invalidation of the list leaves the other copy stale. The rule that falls out: **compose for policy, write a new factory for data.** Different endpoint, different response shape, or different key → a new factory that builds its key from the same key factory. Same data, different freshness, retry, `gcTime`, `throwOnError` or projection → a spread.

## 4. `skipToken` inside a factory splits it in two

`skipToken` sits in the `queryFn` slot instead of a function, which is what gives it the narrowing that `enabled` cannot ([`01b`](./01b-enabled-and-skiptoken.md)). Inside a factory it changes the type of the exported definition, and that has a consequence beyond the hook.

```ts
const getUser = (id: string, signal?: AbortSignal) => http<User>(`/users/${id}`, { signal });

// ✅ Total. Safe for useQuery, queryClient.query(), setQueryData — everything.
export const userQuery = (id: string) =>
  queryOptions({
    queryKey: userKeys.detail(id),
    queryFn: ({ signal }) => getUser(id, signal),
    staleTime: 30_000,
  });

// ⚠️ Gated, and HOOK-ONLY. The name says so because the type does not say it loudly enough.
export const userQueryOrSkip = (id: string | undefined) =>
  queryOptions({
    queryKey: userKeys.detail(id ?? '__none__'),
    queryFn: id ? ({ signal }) => getUser(id, signal) : skipToken,
    staleTime: 30_000,
  });
```

⚠️ **Extrapolated, three ways.** The `queryFn` property's type becomes a union of your fetcher and `typeof skipToken`; the docs never print it. Contextual typing of the fetcher branch *through a ternary* whose other branch is `skipToken` is likewise undocumented — if your editor widens `signal`, annotate the parameter. And 🔴 **I could not confirm what `queryClient.query()` does when handed an options object whose `queryFn` is `skipToken`**; a prefetch has no notion of "disabled", and the documented adjacent behaviour is that *"Calling `refetch()` on a query that uses `skipToken` will result in a `Missing queryFn` error because there is no valid query function to execute."* Do not discover the answer in a route loader. Keep two functions: the total one for every non-hook consumer, the gated one for the component.

The `'__none__'` sentinel is deliberate. `undefined` is not a JSON value, and the docs require a key that is *"serializable using `JSON.stringify`"* — so an `undefined` element does not survive serialisation intact, and every "no id yet" render collapses onto one shared slot whatever the hash turns out to be. That is harmless while the query never runs and dangerous the moment anything writes to that key with `setQueryData`. A visible sentinel makes the slot obvious in the devtools ([`11/01c`](../11-devtools/01c-reading-a-query-key.md)) instead of showing a mystery entry with a hole in its key.

## 5. `infiniteQueryOptions`, the sibling helper

⚠️ **Extrapolated — read this before you copy the block.** The TypeScript guide's `queryOptions` section does not mention an infinite variant, and the reference pages are unreachable today, so **the name `infiniteQueryOptions` is not confirmed against documentation on 2026-09-08.** Check it against the typings you install: if the import does not resolve, drop back to a plain function returning the same object — you lose the type tie and nothing else.

```ts
import { infiniteQueryOptions } from '@tanstack/react-query';

export const feedQuery = (filter: string) =>
  infiniteQueryOptions({
    queryKey: ['feed', filter] as const,
    queryFn: ({ pageParam, signal }) => fetchFeed({ cursor: pageParam, filter, signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
```

```ts
useInfiniteQuery(feedQuery('all'));
queryClient.infiniteQuery({ ...feedQuery('all'), pages: 3 }).catch(() => {});
```

Everything a factory buys for a plain query it buys here, plus it centralises the two options that v5 made dangerous:

- *"you now have to pass an explicit `initialPageParam`"* — and its absence is silent in JavaScript, so the `queryFn` receives `pageParam: undefined` and most APIs cheerfully return page one forever.
- *"`getNextPageParam` or `getPreviousPageParam` now indicates that there is no further page available"* when it returns **`null`** — which is why the example above writes `?? undefined` and not `?? null`. A mapper that returns `null` for a missing cursor ends the list.
- *"By default, only the first page gets prefetched."* — so `pages: n` belongs on the **prefetch call**, not in the factory, because it is a property of that prefetch and each page is a sequential round trip.

The `data` the hook returns is the paged container, not a flat array; that shape and its refetch behaviour are [topic 07](../07-pagination-and-infinite-queries/01b-infinite-queries.md).

## 6. Where factories live: one module per resource

```
src/api/
├── http.ts          the fetch wrapper, error class, auth header
├── users.ts         userKeys · userQueries · getUser · toUser (DTO → domain)
├── groups.ts        groupKeys · groupQuery · fetchGroups
└── invoices.ts      invoiceKeys · invoiceQueries · fetchInvoice
```

**One giant `queries.ts` fails for four separate reasons, and only the first is aesthetic.**

1. Every route that wants one query imports the module that defines all of them. Code splitting dies at the import graph, not at the bundler config — the point [`16/01c`](../16-migration-recipes/01c-rtk-query-endpoints-to-query-options.md) makes about `injectEndpoints` disappearing: options factories code-split for free *because* they are ordinary modules, and one file throws that away.
2. It is the file every feature branch edits, so it is the file every merge conflicts on.
3. A single namespace invites keys that reach across resources — an invoice factory keyed under `['users', id, 'invoices']` because both were on screen — and prefix design stops being reviewable.
4. Ownership. A resource module has one team; `queries.ts` has none.

🔴 **A barrel `src/api/index.ts` re-exporting every module undoes reason 1 completely.** If you add one, expect the whole API layer in the first chunk that touches any query.

Two more rules that matter more than they look:

- **A factory module must not import React.** A router loader, a service worker and a test all import these factories; the moment one of them pulls in a hook, the loader breaks. Keep `useCallback`-stabilised selectors in the component, not in `api/`.
- **A factory module must not import server-only code.** A fetcher that reaches for a secret or a Node built-in makes the factory unimportable from a client component, and the failure arrives as a bundler error in an unrelated file.

Pick one naming shape and hold it. `userQueries.detail(id)` gives one import and discoverable autocomplete; `userDetailQuery(id)` as a named export tree-shakes better. Both are fine; two conventions in one codebase are not.

Finally, make the invariant enforceable rather than conventional — the same ratchet argument as [`16/01p` §3](../16-migration-recipes/01p-prefetch-scheduling-and-staletime.md):

```json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "Property[key.name='queryKey'][value.type='ArrayExpression']",
        "message": "Query keys are built in src/api/*. Import a queryOptions factory."
      }
    ]
  },
  "overrides": [{ "files": ["src/api/**"], "rules": { "no-restricted-syntax": "off" } }]
}
```

⚠️ The `[value.type='ArrayExpression']` clause is what keeps `invalidateQueries({ queryKey: userKeys.all })` legal in a component while banning `queryKey: ['users', id]`. It is a ratchet on new code, not an audit; the audit is a one-off grep for `queryKey: [` outside `src/api/`.

## Gotchas

**★ Symptom: destructuring `queryKey` inside `queryFn` gives you `string` where you expected a literal, or `unknown`.** Cause: the key builder has no `as const`, so the array literal widened before `queryOptions` ever saw it. Fix: `as const` on every key builder — `detail: (id: string) => [...userKeys.details(), id] as const` — and read the key only through the factory.

**★ Symptom: `getQueryData` went back to `unknown` after a refactor that "only extracted a variable".** Cause: somebody annotated the extracted key with a hand-written tuple type, discarding whatever the helper attached to it. Fix: never annotate a key variable. `const key = userQueries.detail(id).queryKey;` — let it infer, and if you need the type, take it with `typeof`.

**★ Symptom: a prefetch and a page fetch the same user twice, and the devtools show two entries whose keys look identical.** Cause: they are not identical — one has `7` and the other `'7'`, because the prefetch passed a route param before `String()` and the hook passed one after. Fix: type the factory parameter (`detail(id: string)`) so the call site fails to compile, and normalise inside the factory if the input genuinely varies. See [`16/01p`](../16-migration-recipes/01p-prefetch-scheduling-and-staletime.md).

**★ Symptom: an "archived" screen renders unarchived rows, and invalidating the list does not fix it.** Cause: a composed factory overrode `queryKey` and inherited the base's `queryFn`, so the unfiltered fetcher's output is filed under a filtered key. Fix: compose for policy only. A different key means a different fetcher, which means a new factory built from the same key factory — not a spread.

**★ Symptom: composing a factory that already had a `select` produces data of an unexpected shape.** Cause: a spread *replaces* `select`; it does not chain. The new selector receives the raw cached value, not the base's projection. Fix: compose the two selector functions explicitly (`(d) => firstThree(toNames(d))`) and hoist the composed function to module scope so it stays referentially stable.

**★ Symptom: `refetch()` throws `Missing queryFn` on a query whose options came from a shared factory.** Cause: the factory is the gated variant and returned `skipToken` — *"Calling `refetch()` on a query that uses `skipToken` will result in a `Missing queryFn` error because there is no valid query function to execute."* Fix: use the total factory and gate with `enabled` if any code path must force the fetch; keep `skipToken` for definitions where fetching without the parameter is meaningless.

**★ Symptom: a route loader's prefetch of a gated factory behaves unpredictably.** Cause: you handed `queryClient.query()` an options object whose `queryFn` is `skipToken`. ⚠️ This page could not confirm what the client does with that, which is itself the reason not to do it — a prefetch has no "disabled" state to fall into. Fix: export two functions. `userQuery(id: string)` — total, for loaders, prefetches and cache writes. `userQueryOrSkip(id: string | undefined)` — hook-only, and named so a reviewer sees it.

**★ Symptom: a mystery cache entry with a truncated-looking key.** Cause: a gated factory built its key from a raw `undefined`, which is not a JSON value and so does not survive the serialisation the docs require of every key. Fix: an explicit sentinel — `userKeys.detail(id ?? '__none__')` — so the "not chosen yet" slot is visible in the devtools and cannot be confused with a real id.

**★ Symptom: an infinite list ported into a factory is warm for one page where the old prefetch warmed three.** Cause: *"By default, only the first page gets prefetched."* and `pages` is a property of the prefetch call, not of the definition. Fix: `queryClient.infiniteQuery({ ...feedQuery(f), pages: 3 })`, and budget for three sequential round trips because each page's param comes out of the previous response.

**★ Symptom: an infinite feed stops after the first page even though the API returned a cursor.** Cause: `getNextPageParam` returned `null`. In v5 *"`getNextPageParam` or `getPreviousPageParam` now indicates that there is no further page available"* when it returns `null` — so the idiomatic `?? null` on a nullable cursor field ends the list. Fix: `?? undefined`, written once in the factory instead of at every call site, which is the best argument for putting infinite queries in factories at all.

**★ Symptom: a router loader crashes with an invalid-hook-call error after someone tidied a selector into the api module.** Cause: the factory module now imports React. Loaders, tests and workers import these modules outside any component. Fix: no hooks in `api/`. A `useCallback`-stabilised selector belongs at the call site; a module-level function belongs in the factory.

**★ Symptom: the first-loaded route's bundle contains every query in the app.** Cause: a barrel `src/api/index.ts`, or one `queries.ts`. Either one turns the whole API layer into a single import unit. Fix: one module per resource and deep imports (`from '../api/users'`). If a barrel already exists, deleting it is a mechanical find-and-replace and usually the largest single bundle win available in this layer.

## Interview questions

**★ Why does every key builder end in `as const`?**
Because without it the array literal widens, and a widened key is a key that stops proving things. `['users', 'detail', id]` infers as `string[]`, so destructuring it inside `queryFn` gives you `string` with no positional meaning, and any narrowing you hoped to do on a discriminant segment is gone. The honest caveat is that the helper's key generic may well infer a tuple on its own — that constraint is not printed on any reachable docs page today — which is exactly why you write `as const` anyway: it costs one keyword and makes the question unanswerable-but-irrelevant instead of unanswerable-and-load-bearing.

**★ Should the `queryFn` read its parameters from `queryKey` or close over them?**
Both are correct and they fail differently. The closure is shorter and is what most code should do. Destructuring the key makes it structurally impossible for the request and the cache entry to disagree — and that disagreement is the specific failure that has no symptom, because a fetcher that ignores a newly-added key segment keeps returning valid-looking data under a key that now means something else. If the key has segments that genuinely parameterise the request (a tenant, a locale, a version), read them out of the key; if the key is `['users','detail',id]` and the id is right there in scope, close over it.

**★ When do you spread a base factory and when do you write a second one?**
Spread for *policy*, write a new factory for *data*. `staleTime`, `gcTime`, `retry`, `refetchInterval`, `throwOnError` and a per-screen `select` are all layers on the same cache entry, so a spread is exactly right and gives the exception a name you can grep. Anything that changes the key, the endpoint or the response shape must be its own factory built from the same key factory, because a spread that changes one of `queryKey`/`queryFn` and inherits the other type-checks perfectly and produces a cache entry whose key does not describe its contents. That is the composition bug worth being afraid of: two entries holding the same payload, one screen showing the wrong rows, and an invalidation that only fixes half of it.

**★ What does putting `skipToken` in a shared factory do to the consumers that are not hooks?**
It makes the definition unsafe for them. `skipToken` occupies the `queryFn` slot, so the exported object no longer necessarily contains a callable fetcher — and a prefetch, an `ensure`-style read or a loader has no concept of "disabled" to fall back on. The documented neighbouring behaviour is that `refetch()` on a `skipToken` query errors with `Missing queryFn` because there is no function to execute, which tells you what the rest of the imperative surface is dealing with. I could not confirm what `queryClient.query()` does with one, and that is the answer: do not build on unconfirmed behaviour. Export a total factory for every imperative consumer and a separately-named gated factory for the hook.

**★ What does `infiniteQueryOptions` have to carry that `queryOptions` does not, and why does centralising it matter more?**
`initialPageParam` and `getNextPageParam`, and both are v5 landmines. `initialPageParam` is now required and its absence is silent in JavaScript — the `queryFn` gets `pageParam: undefined` and a forgiving API returns page one indefinitely. `getNextPageParam` now treats a `null` return as "no further page", so the reflexive `lastPage.nextCursor ?? null` ends every list at page one. Both are written once in a factory and once per call site otherwise, and both fail without an error, which is a worse combination than anything on the plain-query side. The one thing that does *not* belong in the factory is `pages: n` for a prefetch — that is a property of the prefetch, and it costs `n` sequential round trips.

**★ Argue for one module per resource over a single `queries.ts`.**
The aesthetic argument is the weakest one. The real argument is the import graph: a route that needs one query imports a module that defines all of them, so code splitting is lost before the bundler is even consulted — which is precisely the problem RTK Query needed `injectEndpoints` to solve and that ordinary modules solve for free. Then it is the file every branch edits and therefore the file every merge conflicts on; then it is a single namespace that invites keys reaching across resources, which makes prefix design unreviewable; and finally it has no owner. A barrel `index.ts` re-exporting the resource modules reintroduces the first problem in full, so deep imports are part of the pattern, not a preference.

**★ You have adopted factories. How do you stop inline `queryKey` literals reappearing next sprint?**
A lint rule, in the same PR as the migration, because a review convention fails on the week everyone is busy. A `no-restricted-syntax` selector on a `queryKey` property whose value is an array literal bans `queryKey: ['users', id]` in components while still allowing `queryKey: userKeys.all` in an `invalidateQueries` call, and an override switches it off inside `src/api/**`. Land it with the count already at zero so it can only ratchet. The audit half is a one-off grep for `queryKey: [` outside the api directory, checked into the PR description so the size of the remaining debt is a number rather than a feeling.

---

← [`queryOptions` factories](./01g-queryoptions-factories-and-type-inference.md) · [Topic index](../README.md) · Next → [Query States](../03-query-states/01-status-flags.md)
