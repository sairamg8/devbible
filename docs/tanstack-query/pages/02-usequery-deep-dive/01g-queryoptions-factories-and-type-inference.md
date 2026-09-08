---
title: "`queryOptions()` is not a convenience wrapper — it is the only place a query key and the type of the data behind it are bound together, and without it every `getQueryData` call site in the codebase pays a cast"
sidebar_label: "01g · queryOptions factories"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [TypeScript](https://tanstack.com/query/latest/docs/framework/react/typescript) (fetched today), [Render Optimizations](https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations), [Prefetching & Router Integration](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching), [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults). ⚠️ Every page under `…/docs/reference/` and `…/framework/react/reference/` returns `{"isNotFound":true}` on the live site today, so the **exact generic signature of `queryOptions` is not quoted anywhere on this page** — every place this page extrapolates the type surface is marked `⚠️ Extrapolated`. Documentation-validated; **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# 🧬 `queryOptions()`: the Key Learns What Is Behind It

**A query key is a hashed array of anything, so the cache cannot know what type of data lives under it — which is why `queryClient.getQueryData(['users', id])` returns `unknown` and why every codebase that skipped this helper has a `<Todo[]>` type argument pasted at each call site, each of them an unchecked assertion that nothing revalidates when the endpoint's shape changes.** `queryOptions()` is the fix, and it is a compiler-only fix: it takes the options object, captures the `queryFn`'s awaited return type, and hands back a key that carries that type with it. One object then feeds `useQuery`, `useSuspenseQuery`, `queryClient.query()`, `getQueryData`, `setQueryData` and `invalidateQueries`, and every one of them is typed from the same source. The reuse is the obvious half. The type link is the half that deletes the casts.

## 1. What it is: an identity for the compiler

Inline options are contextually typed and everything works. The guide says so:

> *"you'll get automatic type inference"*

The inference is lost the moment you extract the object into a shared function, because a function's return type is inferred structurally and nothing connects `queryKey` to `queryFn` any more. `queryOptions` re-establishes the connection. The docs' own example:

```ts
import { queryOptions } from '@tanstack/react-query';

function groupOptions() {
  return queryOptions({
    queryKey: ['groups'],
    queryFn: fetchGroups,
    staleTime: 5 * 1000,
  });
}

useQuery(groupOptions());
queryClient.query(groupOptions());
```

And the property that makes it worth importing at all:

> *"the `queryKey` returned from `queryOptions` knows about the `queryFn` associated with it"*

```ts
const data = queryClient.getQueryData(groupOptions().queryKey);
//    ^? Group[] | undefined      ← the docs print exactly this
```

Drop the helper and keep the factory, and the reuse survives while the typing does not:

```ts
// ⛔ Same reuse, no type link. This is what most "we already have a factory" codebases have.
function groupOptionsPlain() {
  return { queryKey: ['groups'], queryFn: fetchGroups, staleTime: 5 * 1000 };
}

const raw = queryClient.getQueryData(groupOptionsPlain().queryKey);
//    ^? unknown   → back to getQueryData<Group[]>(…) at every single call site
```

That `unknown` is documented behaviour of the untyped read, not a quirk of the factory — [`04/01e`](../04-caching-and-invalidation/01e-direct-cache-access.md) covers the read API itself. What the factory changes is *who* supplies the type: one module, or forty call sites each free to be wrong.

⚠️ **Extrapolated:** the guide describes `queryOptions` purely in terms of type inference and never prints its signature or describes a runtime effect. Treat it as a typing helper that returns your options object and **build nothing on the call having runtime behaviour** — in either direction. One thing you can rely on is plain JavaScript: an object literal constructed inside a function body is a **new object on every call**, which §5 turns out to depend on.

## 2. One object, every consumer

The payoff is not "less typing". It is that the six places a query is referenced can no longer disagree, because there is one place to edit and it is typed.

```ts
// api/groups.ts
import { queryOptions } from '@tanstack/react-query';

export const groupsQuery = () =>
  queryOptions({
    queryKey: ['groups', 'list'] as const,
    queryFn: ({ signal }) => http<Group[]>('/groups', { signal }),
    staleTime: 60_000,
  });
```

```tsx
// every consumer, typed from that one definition
import { useQuery, useSuspenseQuery, useQueries } from '@tanstack/react-query';
import { groupsQuery } from '../api/groups';

useQuery(groupsQuery());                            // data: Group[] | undefined
useSuspenseQuery(groupsQuery());                    // data: Group[]  — never undefined
useQueries({ queries: [groupsQuery()] });           // results[0].data: Group[] | undefined

queryClient.query(groupsQuery()).catch(() => {});   // the v5 prefetch method
queryClient.getQueryData(groupsQuery().queryKey);   // Group[] | undefined
queryClient.setQueryData(groupsQuery().queryKey, (old) =>
  old ? old.filter((g) => !g.archived) : old,       // `old` is Group[] | undefined, checked
);
queryClient.invalidateQueries({ queryKey: groupsQuery().queryKey });
```

Two of those lines are load-bearing beyond the typing:

- **`queryClient.query(...)`, not `prefetchQuery`.** The prefetching guide is explicit — *"Prefetching a query uses the `query` method."* and *"These tips replace the use of the now deprecated `prefetchQuery` and `ensureQueryData` methods."* The docs' own `queryOptions` example uses `queryClient.query(groupOptions())`. The deprecation and its four migration classes are [`16/01n`](../16-migration-recipes/01n-prefetchquery-to-queryclient-query.md).
- **`useSuspenseQuery(groupsQuery())` narrows `data`.** The same object gives a *different* `data` type to a different hook, which is exactly the point: the type comes from the `queryFn`, the optionality comes from the hook. Topic 10 covers what suspense mode removes — [`10/01b`](../10-suspense-integration/01b-what-suspense-mode-removes.md).

## 3. A key factory and a queryOptions factory are different objects

They are constantly conflated and they solve two different problems. A **key factory** is a tree of key builders — `userKeys.detail(id)` — and its job is *matching*: it guarantees that the prefix a mutation invalidates and the key a query registers are constructed by the same code, so `invalidateQueries` cannot silently match zero entries. A **queryOptions factory** is a tree of whole query definitions — `userQueries.detail(id)` — and its job is *identity plus behaviour plus type*: key, fetcher, freshness and the data type, in one value.

You want both, and the options factory consumes the key factory:

```ts
export const userKeys = {
  all: ['users'] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

export const userQueries = {
  detail: (id: string) =>
    queryOptions({
      queryKey: userKeys.detail(id),
      queryFn: ({ signal }) => http<User>(`/users/${id}`, { signal }),
      staleTime: 30_000,
    }),
};
```

A mutation invalidates `userKeys.details()` — a prefix that no options factory exposes, because no query is registered at exactly that key. That is the one job a key factory does that an options factory cannot: **name a node in the hierarchy that has no query at it.** Key factory design, prefix matching and the invalidation blast radius are [`04/01h`](../04-caching-and-invalidation/01h-query-key-factories.md); do not design keys from this page.

## 4. `staleTime` belongs next to the key, and that is structural

Look again at the docs' own example: `staleTime: 5 * 1000` sits *inside* `queryOptions`, alongside the key and the fetcher. That is not incidental. Freshness is a property of **the resource** — how often the underlying data actually changes — not of the screen that happens to be showing it.

The failure this prevents is owned by [`16/01p`](../16-migration-recipes/01p-prefetch-scheduling-and-staletime.md): a prefetch lands, the consumer mounts with the default `staleTime: 0`, the entry is already stale, and you paid for two requests and still showed a spinner. That page has the mechanism and the quotes. This page has the structural answer, and it is one sentence: **a prefetch and its consumer cannot disagree about freshness if there is one object and both import it.**

There is a second, quieter version of the same disagreement, and it happens without any prefetch at all. One cache entry can have many observers, each with its own options, and the entry refetches whenever *any* observer's rules say it should — so the component that carefully set five minutes gets thirty-second data from the component that did not ([`01c`](./01c-staletime-and-the-refetchon-family.md)). A factory removes the possibility rather than the symptom.

**When a call site genuinely needs different freshness, write a second named factory — never an override.**

```ts
export const groupsQuery = () =>
  queryOptions({ queryKey: ['groups', 'list'] as const, queryFn: fetchGroups, staleTime: 60_000 });

// ✅ The admin console watches the same resource with a different tolerance.
// A NAME makes the exception greppable; an inline `staleTime: 0` at one call site does not.
export const groupsQueryLive = () =>
  queryOptions({ ...groupsQuery(), staleTime: 0, refetchInterval: 5_000 });
```

The blunter instrument for policy-by-prefix is `queryClient.setQueryDefaults(userKeys.all, { staleTime: 30_000 })`, or the client's `defaultOptions` ([topic 13](../13-global-configuration/01-defaultoptions.md)). Use defaults for a whole-app floor; use factories for a specific resource. Note the v5 semantic change if you rely on the first: *"`queryClient.getQueryDefaults` will now merge together all matching registrations instead of returning only the first"*.

## 5. 🔴 The `select` stability trap — the factory does *not* fix it for free

This is the subtlest thing on the page and it is routinely stated wrong. The Render Optimizations guide settles the rule:

> *"The `select` function will only re-run if: the `select` function itself changed referentially [or] `data` changed"*
> *"This means that an inlined `select` function, as shown above, will run on every render."*

Read the first quote precisely: **the comparison is on the `select` function, not on the options object.** So the fact that a factory returns a brand-new object on every call is irrelevant to `select`. What matters is only whether the value sitting in the `select` property is the same function reference as last render.

Which means a factory gives you stability **only if the function it puts there is defined outside the factory body**:

```ts
// ⛔ A factory, and STILL a new arrow on every call → select re-runs every render.
export const groupNamesQuery = () =>
  queryOptions({
    queryKey: ['groups', 'list'] as const,
    queryFn: fetchGroups,
    select: (groups) => groups.map((g) => g.name),   // new function value per call
  });

// ✅ Module-level function: one reference for the lifetime of the module.
const toGroupNames = (groups: Group[]) => groups.map((g) => g.name);

export const groupNamesQueryStable = () =>
  queryOptions({
    queryKey: ['groups', 'list'] as const,
    queryFn: fetchGroups,
    select: toGroupNames,
  });
```

There is a third form worth knowing, because for an unparameterised query it is the simplest thing that can possibly work — call the factory **once, at module scope**, and export the frozen object:

```ts
// ✅ Called once. Everything inside it, including an inline arrow, is stable forever.
export const groupNamesOptions = queryOptions({
  queryKey: ['groups', 'list'] as const,
  queryFn: fetchGroups,
  select: (groups) => groups.map((g) => g.name),
});
```

It stops working the instant the query takes a parameter, which is why the module-level-function form is the one to reach for by default. The mechanism, the cost of `select` and its other failure modes are [`01f`](./01f-select.md) — this section is only about where the reference comes from.

**A `select` that closes over a parameter cannot be module-level**, and this is where people give up and accept the per-render re-run. Two real fixes:

```tsx
// ✅ Fix A — stabilise at the call site with useCallback, and spread the factory for the rest.
function GroupName({ id }: { id: string }) {
  const select = useCallback((groups: Group[]) => groups.find((g) => g.id === id), [id]);
  const { data } = useQuery({ ...groupsQuery(), select });
  return <span>{data?.name ?? '—'}</span>;
}
```

```ts
// ✅ Fix B — one memoised selector per parameter, so the factory stays self-contained.
const selectorsById = new Map<string, (groups: Group[]) => Group | undefined>();

function selectGroupById(id: string) {
  let fn = selectorsById.get(id);
  if (!fn) {
    fn = (groups: Group[]) => groups.find((g) => g.id === id);
    selectorsById.set(id, fn);
  }
  return fn;
}

export const groupByIdQuery = (id: string) =>
  queryOptions({ ...groupsQuery(), select: selectGroupById(id) });
```

⚠️ Fix B's map is unbounded and never evicts. That is fine for a closed id space (a few dozen tabs, statuses, locales) and is a leak for user-generated ids. For an open id space use Fix A, where the closure dies with the component.

## Gotchas

**★ Symptom: `data` became `unknown` the day someone "cleaned up" the duplicated options into a shared function.** Cause: inline options are contextually typed — *"you'll get automatic type inference"* — and extracting them into a function's return type severs the link between `queryKey` and `queryFn`. Fix: wrap the returned object in `queryOptions({ … })`. Nothing else about the refactor changes, and the diff is one import plus one call.

**★ Symptom: the team's response to that `unknown` was `getQueryData<Group[]>(key)` everywhere.** Cause: the type argument is an *assertion*, not a check — it makes the compiler agree with you and verifies nothing. Fix: delete every one of them and read through `groupsQuery().queryKey`, so the day `fetchGroups` starts returning `{ items: Group[] }` the error appears at the definition instead of nowhere at all.

**★ Symptom: the factory types `getQueryData` but `getQueriesData` is still `unknown`.** Cause: documented and deliberate — `getQueriesData` returns an array of entries whose data types are heterogeneous, so a single key's brand cannot describe them. Fix: pass the type explicitly on that one method — `queryClient.getQueriesData<Group[]>(groupOptions().queryKey)` — and understand it is an assertion again, so keep the filter narrow enough that it is true.

**★ Symptom: `setQueryData` will not compile because `old` might be `undefined`.** Cause: correct typing finally arriving. The key's brand resolves to `Group[] | undefined` because *"If the query does not exist, it will be created."* — you can be handed nothing. Fix: handle it (`old ? … : old`), and never `old!`. A patch applied to a cache entry that was never fetched creates an entry out of thin air; see [`04/01e`](../04-caching-and-invalidation/01e-direct-cache-access.md).

**★ Symptom: `select` still runs on every render after you moved everything into a factory.** Cause: the `select` arrow is written *inside* the factory body, so each call constructs a new function value, and *"The `select` function will only re-run if: the `select` function itself changed referentially"*. The factory being a factory changes nothing. Fix: hoist the selector to module scope and reference it by name (§5), or call the factory once at module scope if it takes no parameters.

**★ Symptom: someone "fixes" that by wrapping the factory call in `useMemo`.** Cause: a reasonable but wrong diagnosis — the options *object*'s identity is not what anything compares. Keys are hashed by value (*"Query Keys are hashed deterministically!"*), and `select` is compared as a function. Fix: drop the `useMemo`, which was buying nothing, and stabilise the function. Calling the factory fresh in the render body is correct and idiomatic.

**★ Symptom: two factories exist for the same key with different `queryFn`s, and which data you get depends on which route mounted first.** Cause: the key is the cache identity and the `queryFn` is not part of it — the docs require the key to be *"unique to the query's data"* and say nothing about the function. Fix: one factory per key, exported from one module, and a code review rule that a `queryKey` literal never appears outside `api/`. This is the failure the factory pattern exists to make impossible, and it survives the pattern if you keep two of them.

**★ Symptom: `invalidateQueries({ queryKey: userQueries.detail(id).queryKey })` does not refresh the list that contains that user.** Cause: you invalidated a leaf. Matching is by prefix, and `['users','detail',id]` is not a prefix of `['users','list',filters]`. Fix: invalidate the node, not the leaf — `queryClient.invalidateQueries({ queryKey: userKeys.all })` — which is precisely the key a *key* factory exposes and an options factory does not (§3, and [`04/01h`](../04-caching-and-invalidation/01h-query-key-factories.md)).

**★ Symptom: a factory with `staleTime: 60_000` still refetches immediately at one screen.** Cause: that screen spread the factory and overrode `staleTime` — or a second component observes the same entry with a shorter one. One entry, many observers, and the entry refetches when any observer's rules say so. Fix: no inline overrides. Export a second *named* factory for the exception (`groupsQueryLive`), so the exception is greppable and reviewable instead of buried in a spread at a call site.

## Interview questions

**★ What does `queryOptions()` give you that a plain function returning the same object does not?**
The type link, and only the type link. Both give you reuse — one definition, imported by the hook, the prefetch and the invalidation. What the helper adds is that *"the `queryKey` returned from `queryOptions` knows about the `queryFn` associated with it"*, so `getQueryData(opts.queryKey)` resolves to `Group[] | undefined` instead of `unknown`, and `setQueryData`'s updater is checked against the real shape. Put concretely: without it, every direct cache read in the codebase carries a hand-written type argument that nothing revalidates when the endpoint changes shape; with it, that change is a compile error at one file. The pattern is worth adopting even if you never import the helper — you just keep paying the casts.

**★ Why is `getQueryData(['users', id])` typed `unknown` in the first place? Isn't that just bad typing?**
No, it is the honest type. A query key is an arbitrary hashed array — *"As long as the query key is serializable using `JSON.stringify`, and unique to the query's data, you can use it!"* — and the cache is a map from a hash to whatever some `queryFn` happened to put there. Nothing in `['users', id]` tells TypeScript which function fetched it, and two different fetchers can legally write to the same key. `unknown` is what the API can actually prove. `queryOptions` does not add a lookup table; it attaches the type to the key *value* you got out of the factory, which is why the typing only works when you read the key from the factory rather than retyping the literal.

**★ You have a factory and you still get `unknown` from `getQueriesData`. Bug or design?**
Design, and the guide calls it out. `getQueriesData` takes a filter and returns an array of key/data pairs for every match, and a prefix filter can match queries with entirely different data types — a list, a detail, a count. There is no single type that describes the result, so the brand on one key cannot help. You pass the type explicitly on that method. The important part of the answer is knowing that this reintroduces an assertion, so the filter had better be narrow enough that the assertion is true; a broad prefix with a confident type argument is exactly the kind of lie the factory was adopted to eliminate.

**★ Where should `staleTime` live — the prefetch, the hook, or the factory — and why does it matter?**
The factory, because freshness is a property of the resource and not of the screen. The two failure modes it prevents are the same bug from two directions. A prefetch and its consumer that disagree produce a warm cache entry that the mount refetches anyway, so you paid twice and still showed a spinner. Two mounted components that disagree produce one cache entry with two observers, and the entry refetches whenever *either* observer's rules call for it — so the shorter value effectively wins and the component that set five minutes silently gets thirty seconds. One object, imported by both ends, makes both impossible rather than rare. When a screen genuinely needs different tolerance, that is a second named factory, not an override at a call site.

**★ Does putting `select` in a `queryOptions` factory make it stable? Be precise.**
Only if the function itself is defined outside the factory body. The rule is that *"The `select` function will only re-run if: the `select` function itself changed referentially [or] `data` changed"* — the comparison is on the function, not on the options object. A factory called during render builds a new object every render, which is harmless, but if the `select` property holds an arrow written inline in that body, that arrow is also new every render and the memoisation you wanted is gone: *"an inlined `select` function, as shown above, will run on every render."* So hoist the selector to module scope and reference it by name, or — for a query with no parameters — call the factory once at module scope and export the resulting object. A `select` that closes over a parameter cannot be hoisted at all, and then you either `useCallback` it at the call site or keep one memoised selector per parameter value.

**★ Is it wasteful to call `userQueries.detail(id)` on every render?**
No, and wrapping it in `useMemo` is a fix for a problem that does not exist. It allocates a small object and an array; nothing downstream compares them by identity. The key is hashed by value — *"Query Keys are hashed deterministically!"* — so a structurally identical key is the same cache entry however many times you construct it, exactly as an inline `queryKey: ['todos', filters]` literal is safe. The one property inside that object that *is* compared by reference is `select`, and `useMemo` on the whole object does not help with it, because the arrow inside the factory body is rebuilt before the memo ever sees it.

**★ A colleague says "we already have factories, we don't need this". How do you check whether that is true?**
Grep for the type arguments. `getQueryData<`, `setQueryData<` and `useQuery<` with explicit generics are the signature of a codebase whose factories return plain objects: the reuse landed, the typing did not, and every cache read is an unverified assertion. The second grep is for `queryKey: [` outside the `api/` directory — each hit is a call site that can drift from the factory's key, and drift there is silent, because a mismatched key is a second cache entry rather than an error.

---

← [`select`](./01f-select.md) · [Topic index](../README.md) · Next → [Parameterised factories & composition](./01g2-parameterised-factories-and-composition.md)
