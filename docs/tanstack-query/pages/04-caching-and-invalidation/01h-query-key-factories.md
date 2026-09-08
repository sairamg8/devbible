---
title: "A query key is a public API with no compiler behind it — array position is identity, nothing type-checks it, and a key written slightly differently at two call sites is two caches rather than an error, which is the whole reason key factories exist"
sidebar_label: "01h · Query key factories"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [Filters](https://tanstack.com/query/latest/docs/framework/react/guides/filters), [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5) — plus the `setQueryData` sentence banked from the [`QueryClient` reference](https://tanstack.com/query/latest/docs/reference/QueryClient) on 2026-09-06 (that URL returns `{"isNotFound":true}` on re-check today, so it is **banked, not re-fetched**). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# 🔑 Query Key Factories: Turning A Stringly-Typed Public API Into A Module

**Every page before this one in topic 04 has assumed the key you pass and the key the cache holds are the same array. That assumption is the one nothing in the library enforces. A query key is an array literal you write at forty call sites; it is matched by *prefix*, position by position; it is hashed rather than compared, so nothing is ever "close"; and there is no schema, no registry and no compiler error waiting for you when two of those forty sites disagree. What you get instead is a second cache entry that looks perfectly healthy in the devtools. A key factory is the smallest structure that converts that class of silent failure into an ordinary import — and its hierarchy is not tidiness, it is the set of prefixes your invalidations are allowed to name.**

## 1. The three properties that make a wrong key silent

Take one product page, prefetched on hover and read on the route:

```tsx
// ProductRow.tsx — id comes off the list payload, where it is a number
onMouseEnter={() => queryClient.query({ queryKey: ['product', product.id], queryFn })}

// ProductPage.tsx — id comes off the router, where everything is a string
const { id } = useParams();
useQuery({ queryKey: ['product', id], queryFn });
```

`['product', 42]` and `['product', '42']` are two queries. The prefetch fires, the request
succeeds, the entry lands in the cache, and the page still shows a spinner and fetches the same
URL a second time. Three separate properties of the design conspire to keep that quiet:

- **There is no schema.** The docs state the entire constraint on a key as a serialisation rule,
  not a type: *"As long as the query key is serializable using `JSON.stringify`, and unique to the
  query's data, you can use it!"* Anything array-shaped is a legal key, so `['product', id]`,
  `['products', id]` and `['product', 'detail', id]` are all equally valid — and all different.
- **A missing key is not an error, it is a creation.** From the `QueryClient` reference on
  `setQueryData`: *"If the query does not exist, it will be created."* The same is true of a
  `useQuery` mounting on a typo. You never get "no such query"; you get a new one.
- **Matching is by prefix, so a wrong prefix matches nothing and reports success.**
  `invalidateQueries` returns a resolved promise whether it hit forty queries or zero. [01b](./01b-query-filters-the-matching-surface.md)
  covers the matching surface; [01d](./01d-invalidate-refetch-reset-remove.md) covers what
  invalidation then does to the matches it found. Neither has anything to say about a filter that
  found none, because from the library's point of view nothing went wrong.

The prefetch half of this — the version where the fetch genuinely happens and is genuinely
wasted — is owned by [`16/01p`](../16-migration-recipes/01p-prefetch-scheduling-and-staletime.md).
Read it for the scheduling; this page is about the shape of the key itself.

## 2. What is identity and what is free

The two halves of the equality rule are asymmetric, and the guide says both out loud:

> *"Query Keys are hashed deterministically!"*
> *"no matter the order of keys in objects, all of the following queries are considered equal"*
> *"Array item order matters!"*

So the object you drop into a key is compared by *value*, at any depth, in any key order:

```ts
// Same query. All three. No memoisation required, no useMemo, no stable reference.
useQuery({ queryKey: ['todos', { status: 'done', page: 2 }], queryFn });
useQuery({ queryKey: ['todos', { page: 2, status: 'done' }], queryFn });
useQuery({ queryKey: ['todos', { ...filters }], queryFn });        // fresh object every render
```

That last line matters for anyone arriving from Redux or RTK Query, where a new object identity
in a selector or an argument is a re-subscription. Here it is nothing — the key is hashed, so a
freshly allocated literal with the same contents hashes to the same string. Memoising a filter
object purely to stabilise a query key is work that buys zero.

And the array is the opposite. `['todos', 'list', filters]` and `['todos', filters, 'list']` are
two unrelated caches, and — the consequence that costs real time — **only the first is reachable
by a `['todos', 'list']` prefix.** Position is identity, so segment order is a schema decision made
once for the whole codebase. That is exactly the trap
[`16/01`](../16-migration-recipes/01-rtk-query-to-tanstack-query.md) lists among its migration
gotchas, and its fix is this page.

## 3. The canonical shape

```ts
// api/todo-keys.ts — no fetchers, no imports, nothing that pulls a network layer into a bundle.
export type TodoFilters = { status: 'all' | 'open' | 'done'; page: number; q: string };

export const todoKeys = {
  all:      ['todos'] as const,
  lists:    () => [...todoKeys.all, 'list'] as const,
  list:     (filters: TodoFilters) => [...todoKeys.lists(), filters] as const,
  details:  () => [...todoKeys.all, 'detail'] as const,
  detail:   (id: string) => [...todoKeys.details(), id] as const,
} as const;
```

Four things in that block are load-bearing and none of them are formatting.

**The levels are built from each other, not written out.** `list()` spreads `lists()`, which
spreads `all`. Renaming the root from `'todos'` to `'tasks'` is a one-character edit that
propagates to every derived key, and it cannot propagate to only some of them.

**`as const` on every return.** Without it TypeScript widens `['todos', 'detail', id]` to
`string[]`, and the tuple — the thing that lets `queryOptions` tie a key to a return type, and
lets `getQueryData(todoKeys.detail(id))` come back typed instead of `unknown` — is gone. The
readonly-ness is a bonus: nothing downstream can `push` a segment onto a shared key array.

**Discriminators are strings, and they come before the variable part.** `'list'` and `'detail'`
exist so that a prefix can name a *category* of query. Put the filters before the discriminator and
no prefix names "all lists" any more; you would have to enumerate every filter value that has ever
been used.

**`all` is a value, the rest are functions.** Both conventions exist in the wild — some codebases
make `all` a function too. Pick one and never mix, because `todoKeys.all` and `todoKeys.all()` in
the same file is a runtime error at best and, if the value form is spread into a key, a wrong key
at worst.

## 4. The hierarchy is an invalidation API, not decoration

`todoKeys.lists()` is a key that no `useQuery` in the app will ever be mounted on. That is the
point. It exists to be an *addressable prefix*:

| Call | Key | Reaches |
|---|---|---|
| `todoKeys.all` | `['todos']` | every todo query — lists and details |
| `todoKeys.lists()` | `['todos', 'list']` | every filtered and paged list, **no detail entries** |
| `todoKeys.list(f)` | `['todos', 'list', f]` | exactly one list |
| `todoKeys.details()` | `['todos', 'detail']` | every detail entry, **no lists** |
| `todoKeys.detail(id)` | `['todos', 'detail', id]` | exactly one todo |

Which turns three different mutations into three different, precise invalidations:

```ts
// Created a todo: every list is now wrong; no existing detail entry changed.
onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.lists() }),

// Edited one todo: write the authoritative response into its detail entry, and refresh the
// lists, because the edit may have changed its position under a filter or a sort.
onSuccess: (updated) => {
  queryClient.setQueryData(todoKeys.detail(updated.id), updated);
  return queryClient.invalidateQueries({ queryKey: todoKeys.lists() });
},

// Deleted: the detail entry is not stale, it is gone — remove it rather than refetching a 404.
onSuccess: (_, id) => {
  queryClient.removeQueries({ queryKey: todoKeys.detail(id), exact: true });
  return queryClient.invalidateQueries({ queryKey: todoKeys.lists() });
},
```

Without the `'list'` segment, the first of those has to be `invalidateQueries({ queryKey: ['todos'] })`
— which also marks every detail entry stale and, per the invalidation guide, refetches any of them
that is currently mounted. One create becomes N background requests. The intermediate level is what
buys the precision, and it only buys it because the discriminator sits *before* the variable part.

The same hierarchy is a **defaults** target, not only an invalidation target. `setQueryDefaults` is
prefix-matched too, and v5 changed how overlapping registrations combine — *"`queryClient.getQueryDefaults`
will now merge together all matching registrations instead of returning only the first"* — so
`setQueryDefaults(todoKeys.details(), { staleTime: 60_000 })` gives one branch of the tree its own
policy. Registration order matters there; [`13/01`](../13-global-configuration/01-defaultoptions.md)
has the rule and the quote.

## 5. Greppability is the argument you can actually demonstrate

Ask a codebase *"what invalidates this query?"*.

With inline arrays there is no answer. You grep `'todos'`, get every string literal in the app that
mentions todos, read each surrounding array by eye to work out which are keys, and then decide by
inspection whether `['todos']`, `['todos', 'list']` and `['todos', 'list', filters]` overlap. Nothing
tells you about the invalidation someone wrote last week in a mutation you have not opened.

With a factory it is one identifier:

```bash
grep -rn "todoKeys.lists()" src/          # every read and every write of that prefix
grep -rn "todoKeys\." src/                # the query surface of the whole entity
grep -rn "queryKey: \['" src/             # 🔴 the audit: any key still authored inline
```

That third line is the one worth putting in CI during an adoption. It is a static check for a
failure that has no runtime signal at all.

The refactor story is the same argument in the other direction. Reordering segments in a factory is
a change to one function; the call sites keep compiling because they never see the array.
Reordering segments that were authored inline is a text search you cannot complete with confidence,
and every one you miss is a cache that silently stops being invalidated.

## 6. A key factory is not a `queryOptions` factory

They are different objects with different owners. **A key factory owns identity and nothing else** —
it is pure, it imports nothing, and its output is legal input to `invalidateQueries`,
`setQueryData`, `getQueryData`, `removeQueries` and `useIsFetching`. **A `queryOptions` factory owns
identity *plus* the fetcher and the per-query options** — key, `queryFn`, `staleTime`, `select` — and
its output is legal input to `useQuery`, `useSuspenseQuery` and `queryClient.query`. The second
usually calls the first. The deep treatment of `queryOptions`, and specifically the type tie that
makes `getQueryData(opts.queryKey)` come back typed, lives at
[`02/01g`](../02-usequery-deep-dive/01g-queryoptions-factories-and-type-inference.md).

**When one file should hold both:** when every key in the factory has exactly one fetcher, which is
the normal case for an app's own resources — put `todoKeys` and `todoQueries` in `api/todos.ts` and
be done. **When they must be separate modules:** when the keys have consumers that must not pull in
the fetcher. A shared package that exports keys so host apps can invalidate its data; a mutation
module that only needs prefixes; a components package that would otherwise drag an HTTP client into
its bundle. [`16/01c`](../16-migration-recipes/01c-rtk-query-endpoints-to-query-options.md) works the
same split from the RTK Query direction, where `createApi` had bundled the two together for you.

The rest of the design — what may go in a key, what silently must not, and how to retrofit a
factory onto a codebase that has none — is [01h2](./01h2-what-belongs-in-a-query-key.md).

## Gotchas

**★ Symptom: someone reordered a key "for readability" and every invalidation stopped working, with no error anywhere.** Cause: `['todos', filters, 'list']` reads nicely and destroys the prefix — *"Array item order matters!"*, so `['todos', 'list']` matches zero entries and `invalidateQueries` resolves cleanly. The UI just stops updating after mutations. Fix: the discriminator segment goes before the variable part, always, and the order is written once in the factory. Changing it there is a single edit; changing it across inline call sites is a text search you will not finish.

**★ Symptom: a prefetch lands in the cache and the page it was for fetches the same URL anyway.** Cause: the two ends built keys of different *types* — a number `id` off a list payload, a string `id` off `useParams`. Keys are hashed, so `42` and `'42'` are unrelated entries. Fix: normalise inside the factory, never at the call site, so no caller can get it wrong:

```ts
detail: (id: string | number) => [...todoKeys.details(), String(id)] as const,
```

**★ Symptom: `getQueryData(todoKeys.detail(id))` returns `unknown` and every consumer needs a cast.** Cause: a missing `as const`, so the return type widened to `string[]` and the tuple that carries the type tie is gone. Fix: `as const` on every branch of the factory. Also add `as const` to the object literal itself — it stops a call site reassigning `todoKeys.lists` to something else.

**★ Symptom: an invalidation after "create" fires a burst of background requests for detail pages nobody is looking at.** Cause: `invalidateQueries({ queryKey: todoKeys.all })` when only the lists changed. Marking is cheap, but the invalidation guide is explicit that *"If the query is currently being rendered via `useQuery` or related hooks, it will also be refetched in the background"* — so every mounted detail refetches. Fix: name the narrowest prefix that is actually wrong, `todoKeys.lists()`, which is precisely what the intermediate level was built for.

**★ Symptom: `invalidateQueries({ queryKey: todoKeys.list(filters) })` refreshes the list the user is on and leaves every other filtered list stale-looking-fresh.** Cause: the mutation invalidated the *specific* list it could see rather than the category. The other filter combinations are still cached and still considered fresh. Fix: invalidate `todoKeys.lists()`; use `todoKeys.list(filters)` only when you genuinely mean "this one list and no other", and pair it with `exact: true` if it has children.

**★ Symptom: `['user']` invalidations do not touch `['users', 'list']`, even though one string is a prefix of the other.** Cause: prefix matching is per array *element*, not per character — `'user'` and `'users'` are different elements, so the two trees never meet. Fix: this is a naming discipline, not a bug. One root string per entity, singular or plural chosen once, and both trees hanging off a factory so the mismatch is visible in one file rather than distributed across call sites.

**★ Symptom: `todoKeys.lists` (no parentheses) ends up in a key and the entry behaves as if it were keyed on nothing.** Cause: a function is not serialisable, so the guarantee the docs give — *"As long as the query key is serializable using `JSON.stringify`"* — simply does not hold, and what you cached is keyed on something that is not the value you meant. ⚠️ **I could not confirm the exact hashed representation of a function segment without running it, so do not reason about what it collapses to** — treat it as undefined behaviour. Fix: make the two forms impossible to confuse by keeping `all` a value and everything else a function, and let `as const` on the object surface the mistake in the tuple type.

**★ Symptom: importing the key factory pulled the HTTP client, the auth token helper and a date library into a route bundle.** Cause: the keys were exported from a barrel that also exports the fetchers, so a mutation module that wanted three prefixes imported the whole data layer. Fix: the keys module has **zero imports** — that is the discipline that makes it safe to depend on from anywhere, including a shared package and a service worker.

**★ Symptom: the factory exists, is documented in the README, and half the components still write arrays inline.** Cause: nothing enforces it; a factory is a convention, and a convention with an easier alternative loses. This is worse than having no factory, because `grep -rn "todoKeys\."` now looks like a complete answer and is not. Fix: make the inline form mechanically findable and then forbidden — `grep -rn "queryKey: \['" src/` in CI, or an ESLint `no-restricted-syntax` rule on an array-literal `queryKey` property. The retrofit path is in [01h2](./01h2-what-belongs-in-a-query-key.md).

**★ Symptom: two developers each add a factory for the same entity, in different modules, with different roots.** Cause: no single owner for the key namespace. `productKeys.detail(id)` in the catalogue feature and `itemKeys.detail(id)` in the basket feature are two caches for one resource, and both are "using the factory pattern correctly". Fix: one keys module per *entity*, not per feature, and the root string is the entity's name — the cheapest review check is that no two files in the repo export a factory whose `all` starts with the same string.

## Interview questions

**★ Why does the order of keys inside an object in a query key not matter, while the order of items in the array does?**
Because they are compared by different mechanisms with different goals. The array is the *path* — matching is inclusive and positional, so `['todos', 'list']` matching `['todos', 'list', {…}]` is exactly the prefix semantics that make one invalidation refresh a subtree. That only works if position carries meaning, hence *"Array item order matters!"*. The object inside a segment is *data*, and it is hashed deterministically with a stable key ordering, which is why the docs can say *"no matter the order of keys in objects, all of the following queries are considered equal"*. The practical consequence is two rules that pull in opposite directions: never rely on object key order for identity, and never treat array order as cosmetic.

**★ `todoKeys.lists()` is never passed to a `useQuery`. Why is it in the factory?**
Because it is the invalidation target. The set of keys you can *name* is the set of keys some function returns, and if the only functions are `list(filters)` and `detail(id)` then the only granularities available to a mutation are "one exact list" and "absolutely everything under `['todos']`". The intermediate levels create the middle granularity — every list, no details — which is the one nearly every create/update/delete actually wants. It also documents the shape: reading the factory tells you the key schema without reading a single call site.

**★ What does `as const` actually buy in a key factory, and what breaks without it?**
It preserves the tuple type. Without it TypeScript infers `string[]`, which erases both the length and the position of each segment — and those are precisely the things `queryOptions` uses to tie a key to the type of what the fetcher returns. Downstream, `getQueryData(todoKeys.detail(id))` comes back `unknown` and every caller adds a cast, which is how a wrong-shape assumption gets into the codebase with the compiler's blessing. The readonly-ness is a secondary win: a shared key array cannot be mutated by a consumer.

**★ A colleague memoises the filter object with `useMemo` before putting it in a query key, citing re-render churn. Are they right?**
No, and the belief is usually imported from Redux or RTK Query, where argument identity is meaningful. Query keys are *"hashed deterministically"*, so a freshly allocated `{ status, page }` on every render hashes to the same string as the previous one and the query does not re-subscribe or refetch. The `useMemo` is dead weight. The habit is worth naming explicitly during a migration, because it is invisible — it does not break anything, it just adds ceremony that new readers assume is load-bearing.

**★ How do you answer "what invalidates this query?" in a codebase you did not write?**
If the codebase has a key factory, you grep one identifier — `todoKeys.lists()` — and get every read and every write of that prefix, including invalidations in mutation files you have never opened. If it does not, the question has no reliable answer: you grep the root string, filter out the non-key matches by eye, and then reason manually about which of the surviving arrays are prefixes of which. That asymmetry, rather than tidiness, is the strongest argument for the pattern, because it is the difference between a mechanical answer and a judgement call that is wrong occasionally and silently.

**★ What is the difference between a key factory and a `queryOptions` factory, and when do you need both as separate modules?**
A key factory owns identity: pure functions returning `as const` arrays, no imports, output valid for every `queryClient` method. A `queryOptions` factory owns identity plus behaviour: it calls the key factory and adds `queryFn`, `staleTime`, `select` and so on, producing an object you hand straight to `useQuery` or `queryClient.query`. In the normal case both live in one module per entity. You split them when the keys have a consumer that must not pull in the fetcher — a shared package whose data the host app needs to invalidate, or a component library that would otherwise ship an HTTP client. See [`02/01g`](../02-usequery-deep-dive/01g-queryoptions-factories-and-type-inference.md) for the typing, and [`16/01c`](../16-migration-recipes/01c-rtk-query-endpoints-to-query-options.md) for the same split arrived at from RTK Query.

**★ Someone proposes deriving query keys automatically from the request URL. What goes wrong?**
Two things. The URL is not a hierarchy in the shape invalidation needs: `/todos?status=done&page=2` gives you one opaque string, so there is no `['todos', 'list']` level to invalidate and no way to say "every list but no detail" — you are back to all-or-one. And the URL encodes things that are not identity (parameter order, encoding differences, a cache-busting timestamp) while sometimes omitting things that are (the auth scope, the tenant, a header that changes the response). The key must be *unique to the query's data*, which is a statement about the response, not about the request string that happened to produce it.

**★ Your app has a factory and the devtools show two entries for what is obviously the same resource. Where do you look first?**
At the *types* of the variable segments before anything else, because that is the failure that survives having a factory. A factory guarantees the shape and the order; it does not guarantee that every caller passes the same runtime type into `detail(id)`, and a numeric `42` from a payload and a string `'42'` from a router hash differently. Confirm it in one line with `getQueryData` — an `undefined` for a key you can see rendered on screen proves the mismatch — then fix it by normalising inside the factory so no call site can reintroduce it.

---

← [Structural sharing](./01g-structural-sharing.md) · [Topic index](../README.md) · Next → [What belongs in a query key](./01h2-what-belongs-in-a-query-key.md)
