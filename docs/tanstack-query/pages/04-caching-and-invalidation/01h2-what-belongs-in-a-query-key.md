---
title: "The only rule the docs state about a key's contents is that it serialises and is unique to the query's data — and both halves fail silently, one by collapsing distinct queries onto one entry and the other by minting a fresh entry on every render"
sidebar_label: "01h2 · What belongs in a key"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Filters](https://tanstack.com/query/latest/docs/framework/react/guides/filters) — plus the `gcTime` sentence banked from the [`QueryClient` reference](https://tanstack.com/query/latest/docs/reference/QueryClient) on 2026-09-06 (that URL returns `{"isNotFound":true}` on re-check today, so it is **banked, not re-fetched**). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# 🧬 What Goes In A Key, What Must Never, And How To Retrofit A Factory

**[01h](./01h-query-key-factories.md) settled the *shape* of a key — position is identity, the hierarchy is an invalidation API, the factory is what stops forty call sites disagreeing. This page settles the *contents*. The docs give exactly one rule, it has two halves, and each half fails in the opposite direction: a value that does not serialise collapses distinct queries onto one shared entry, and a value that is fresh on every render mints a new entry on every render. Then the three places where the contents question is genuinely hard — a gated key, an infinite key, and a key that has to carry an identity — and finally the retrofit path onto a codebase that has none.**

## 1. The rule, and both of its halves

> *"As long as the query key is serializable using `JSON.stringify`, and unique to the query's data, you can use it!"*

Read as a specification, that is two independent requirements, and violating either is silent.

**Serialisable.** `JSON.stringify` has no enumerable own properties to work with on a `Map` or a
`Set`, so both stringify to `{}` — every distinct `Map` in a key collapses onto the same hash. A
class instance stringifies to its own enumerable fields, so its methods and any private state vanish
and two instances of *different* classes with matching fields become the same key. `undefined` inside
an array does not survive the round trip. `BigInt` throws outright. In every collapsing case the
symptom is identical and misleading: two screens showing the same data, or one screen showing another
screen's data, with a single healthy-looking cache entry behind both.

```ts
// ⛔ collapses: the filters carry no identity once serialised.
useQuery({ queryKey: ['todos', new Map([['status', 'done']])], queryFn });

// ⛔ collapses: a Set of selected ids stringifies to {}. Every selection is the same query.
useQuery({ queryKey: ['report', new Set(selectedIds)], queryFn });

// ✅ plain data, sorted so that the same selection always produces the same array.
useQuery({ queryKey: ['report', [...selectedIds].sort()], queryFn });
```

That last line carries a second lesson. Object *keys* are order-independent — *"no matter the order
of keys in objects, all of the following queries are considered equal"* — but an **array** built from
a `Set` or from user click order is not, because *"Array item order matters!"* applies at every depth.
`[3, 1]` and `[1, 3]` are two caches for one report. Sort inside the factory.

**Unique to the query's data.** The mirror failure. Anything in the key that changes without the
*data* changing creates a new cache entry that nobody will ever look up again:

```ts
// ⛔ a new key on every render. Every entry is a fresh fetch and a fresh gcTime timer.
useQuery({ queryKey: ['todos', Date.now()], queryFn });
useQuery({ queryKey: ['todos', Math.random()], queryFn });
useQuery({ queryKey: ['todos', new Date()], queryFn });        // over-precise: ms granularity
useQuery({ queryKey: ['todos', filtersRef], queryFn });        // a ref object is not data
```

`new Date()` is the cruel one, because it *is* serialisable — it becomes an ISO string with
millisecond precision, so it passes the first half of the rule and fails the second comprehensively.
Anything genuinely time-bucketed belongs in the key as the bucket, not the instant:
`['metrics', startOfDay(new Date()).toISOString()]`.

## 2. Anything the result depends on must be in the key

The rule reads in both directions, and the omission is the more common bug:

```ts
// ⛔ the fetcher reads `status`, the key does not mention it. Switch the filter and the cache
//    hands back the previous status's data as a fresh hit, with no request at all.
useQuery({ queryKey: ['todos'], queryFn: () => http(`/todos?status=${status}`) });

// ✅ every input to the fetcher is a segment.
useQuery({ queryKey: todoKeys.list({ status, page, q }), queryFn: () => fetchTodos({ status, page, q }) });
```

The inputs people forget are the ones that are not function parameters: a locale that a header
carries, the tenant id baked into the base URL, a feature flag that changes the response shape, an
auth scope that decides which fields come back. If two users, two locales or two tenants can get
*different bytes* from the same URL, that difference is part of the query's identity and belongs in
the key. Building keys through a factory helps here in a way that is easy to miss — the factory's
parameter list is a written-down claim about what the query depends on, and adding a dependency to
the fetcher without adding it to the factory becomes a visible inconsistency in one file.

## 3. The three hard cases

### A gated key

A query behind `enabled: false` or `skipToken` still *has* a key, and the key is still constructed
while the gate is shut. `['todo', id]` where `id` is `undefined` is a real key with a real entry, and
several such queries across the app share it. The gate stops the fetch; it does not stop the identity.

```ts
// ⛔ the non-null assertion lies, and `undefined` does not survive JSON.stringify.
useQuery({ queryKey: todoKeys.detail(id!), queryFn: () => fetchTodo(id!), enabled: !!id });

// ✅ skipToken: the gate is in the queryFn slot, and the key is only built from a real id.
useQuery({
  queryKey: todoKeys.detail(id ?? '__none__'),
  queryFn: id ? () => fetchTodo(id) : skipToken,
});
```

Better still, keep the placeholder out of the key space entirely by not rendering the hook's owner
until the id exists. The mechanics of the gate — what state it leaves behind, and why `refetch` stops
working under `skipToken` — are [`02/01b`](../02-usequery-deep-dive/01b-enabled-and-skiptoken.md).

### An infinite key

The page parameter is **not** part of the key. All pages of an infinite query live under one entry, so
the key identifies the list, not a position in it — which is exactly what makes one invalidation
refresh the whole accumulated list. Every filter or search term the list depends on still belongs in
the key, because changing one means a different list rather than a different page.
[`07/01b`](../07-pagination-and-infinite-queries/01b-infinite-queries.md) has the full treatment. In a
factory, give the infinite variant its own discriminator so a prefix can address it separately from
the paged one:

```ts
export const todoKeys = {
  all:       ['todos'] as const,
  lists:     () => [...todoKeys.all, 'list'] as const,
  list:      (filters: TodoFilters) => [...todoKeys.lists(), filters] as const,
  infinite:  (filters: Omit<TodoFilters, 'page'>) => [...todoKeys.all, 'infinite', filters] as const,
  details:   () => [...todoKeys.all, 'detail'] as const,
  detail:    (id: string) => [...todoKeys.details(), id] as const,
} as const;
```

### A key that carries an identity

Two designs, and the choice is about whether two identities can be live at once.

**Namespace the keys** — `[userId, 'todos', 'list', filters]`, or a factory taking the id. Nothing
can leak between accounts because nothing shares an entry. The cost is real: every factory call needs
the id threaded to it, every invalidation needs it too, and a mutation handler that does not have the
current user in scope now needs it. It also does not solve logout on its own — the previous user's
data stays resident until garbage collection, and *"If the query is not utilized by a query hook
within the default `gcTime`, the query will be garbage collected. If the default `gcTime` has not been
configured, it defaults to 5 minutes."* Five minutes of another person's data in memory is a finding
in a security review.

**One cache per session** — plain keys, and on logout throw the cache away:

```ts
async function logout() {
  await api.logout();
  queryClient.clear();          // every entry, every key, immediately
}
```

🔴 **Do this regardless of which design you chose.** Namespacing prevents *collisions*; it does not
evict. `clear()` is the only step that removes the previous user's data now rather than eventually.
Reach for namespacing only when two identities genuinely coexist — admin impersonation, a tenant
switcher that does not reload, a support console showing two accounts side by side — because in every
other case it is per-call-site cost paying for a property `clear()` already gives you.

## 4. Keys as a package's public API

Export a key factory from a shared package and the key *shape* becomes semver-relevant. A consumer
that calls `invalidateQueries({ queryKey: pkgKeys.lists() })` breaks silently when you reorder the
segments — their build succeeds, their invalidation matches zero, and their UI stops refreshing after
mutations. Treat a change to the segment order or the discriminator strings as a **major** version
bump, and never let a consumer hand-write the array: exporting the factory is what makes the shape
yours to change at all. [`16/01c`](../16-migration-recipes/01c-rtk-query-endpoints-to-query-options.md)
makes the same point from the RTK Query side, where `tagTypes` had let consumers extend a registry
that keys have no equivalent of.

⚠️ **Identical keys are necessary and not sufficient across package boundaries.** Two packages agree
on every key and still miss each other's cache if they are talking to two different `QueryClient`
instances — a second provider mounted somewhere in the tree, or a duplicated copy of the library in
the dependency graph. That is a provider and dependency-resolution question, not a key question, and
no amount of factory discipline detects it. Check the instance before you debug the key.

## 5. Retrofitting a factory, without changing behaviour on the way

The mistake is doing it in one commit. Introducing the factory *and* fixing the key shapes at the
same time means every behavioural change — a prefix that now matches more, an entry that moved — is
tangled with a mechanical refactor of hundreds of lines, and the review cannot separate them.

1. **One entity at a time.** Pick the one with the most call sites, not the smallest.
2. **Mirror the existing literals exactly**, wrong order and all. If today's key is
   `['todos', filters, 'list']`, the first version of the factory returns exactly that. This commit
   changes no cache behaviour whatsoever, which is what makes it reviewable at any size.
3. **Replace the literals.** Now every key for that entity comes from one function.
4. **Fix the shape in its own commit.** Reorder to `['todos', 'list', filters]`, and now the diff is
   one function — and every consequence of the reorder is in a change small enough to reason about.
5. **Lock it.** `grep -rn "queryKey: \['" src/` in CI, or an ESLint `no-restricted-syntax` rule
   rejecting an array literal in a `queryKey` property. Without step 5 the codebase regresses to
   inline keys within a quarter, and the factory then makes things *worse* by making a grep look
   authoritative when it is not.

Steps 2 and 4 are the whole trick: a pure refactor and a behavioural change, never in the same commit.

⚠️ **One caveat if you persist the cache to storage.** A key-shape change orphans everything already
persisted under the old shape — it is not corrupt, it is simply unreachable, and it occupies storage
until eviction. The persistence plugins expose a cache-buster string for exactly this situation;
**I did not re-verify the plugin's option names against 5.102.8 in this pass**, so check them against
the version you install before relying on it.

## Gotchas

**★ Symptom: two different report screens show each other's data, and the devtools show one entry.** Cause: a `Map` or a `Set` in the key. Neither has enumerable own properties, so both stringify to `{}` and every distinct value hashes identically — the docs' rule, *"serializable using `JSON.stringify`"*, is not satisfied and nothing warns you. Fix: convert to plain data in the factory — `Object.fromEntries(map)` or `[...set].sort()` — so the contents are actually in the key.

**★ Symptom: the cache grows without bound and the devtools list keeps filling with near-identical keys.** Cause: an unstable segment — `Date.now()`, `Math.random()`, a raw `new Date()` — usually added deliberately as a cache-buster. Every render mints a new entry with its own five-minute `gcTime`. Fix: delete the buster and use the mechanism built for it: `staleTime: 0` to always refetch on mount, or an explicit `invalidateQueries` at the moment the data actually became wrong.

**★ Symptom: changing a filter shows the previous filter's results instantly, with no network request.** Cause: the filter is read by the `queryFn` but absent from the key, so both filters share one entry and the cached value is served as a fresh hit. Fix: every input the fetcher reads becomes a segment. The factory's parameter list is the checklist — if the fetcher closes over something the factory does not take, one of the two is wrong.

**★ Symptom: a disabled query occupies a cache entry keyed on `undefined`, and several unrelated screens share it.** Cause: `todoKeys.detail(id!)` with `enabled: !!id` — the assertion silences TypeScript, the gate silences the fetch, and the key is built anyway. `undefined` does not survive `JSON.stringify` either. Fix: pass `skipToken` in the `queryFn` slot so the type narrows honestly, or do not mount the hook's owner until the id exists; see [`02/01b`](../02-usequery-deep-dive/01b-enabled-and-skiptoken.md).

**★ Symptom: the page parameter ended up in an infinite query's key and only the last page ever refreshes.** Cause: treating `useInfiniteQuery` like `useQuery` with a page. All pages belong to one entry; a key per page defeats the accumulation and makes one invalidation impossible. Fix: keep `pageParam` out of the key entirely and give the infinite list its own discriminator, as in §3.

**★ Symptom: after logging out and back in as someone else, the first paint shows the previous account's data.** Cause: plain keys and no eviction — the entries are still resident, and *"Stale queries are refetched automatically in the background"* means the correct data arrives *after* the wrong data has already rendered. Fix: `queryClient.clear()` in the logout path, before the redirect. Namespacing keys by user id prevents the collision but does not evict, so it is not a substitute.

**★ Symptom: a report keyed on an array of selected ids caches a new entry every time the user reorders their selection.** Cause: *"Array item order matters!"* applies inside nested arrays too, so `[3, 1]` and `[1, 3]` are two queries for one report. Fix: sort inside the factory — `[...ids].sort()` — so click order cannot leak into identity. Note the asymmetry: had the ids been object keys, order would have been free.

**★ Symptom: a shared package's data cannot be invalidated by the host app, or stops being invalidated after a minor version bump.** Cause: the consumer hand-wrote the array, or the package reordered segments in what it considered an internal change. Fix: export the factory, and treat segment order and discriminator strings as part of the package's public API — a change to either is a major bump, because the failure it causes in consumers is silent.

**★ Symptom: the keys match exactly and the two halves of the app still cannot see each other's cache.** Cause: two `QueryClient` instances — a second provider in the tree, or the library resolved twice in the dependency graph. Fix: verify the instance identity first; no key discipline can detect or repair this, and hours get spent on the key because the key is the thing that looks suspicious.

**★ Symptom: the factory retrofit landed and half the app's lists stopped refreshing after mutations.** Cause: the introduction commit also fixed the segment order, so a mechanical refactor and a behavioural change shipped together and the review had no chance. Fix: mirror the existing literals exactly first — including the wrong order — then reorder in a separate commit whose diff is one function.

## Interview questions

**★ The docs say a key must be "serializable using `JSON.stringify`, and unique to the query's data". Why are those two separate requirements rather than one?**
They fail in opposite directions and have opposite fixes. Failing serialisability *merges* queries: a `Map`, a `Set` or anything whose distinguishing state is not an enumerable own property collapses to the same hash, so two different questions share one answer. Failing uniqueness *splits* them: a timestamp or a random value in the key means every render asks a new question, so the cache fills with entries that will never be read again and every mount is a cold fetch. One shows you the wrong data with no network activity; the other shows you the right data with far too much. A key can satisfy either half and violate the other, which is why the sentence names both.

**★ Why is `new Date()` in a query key worse than a `Map`, given that it serialises correctly?**
Precisely *because* it serialises correctly. A `Map` fails loudly enough to be found — the data is visibly wrong on screen and someone eventually inspects the key. A `Date` produces a valid, unique, millisecond-precision segment, so the code looks right, behaves plausibly, and quietly turns off caching for that query while filling the cache with dead entries. If time genuinely is part of the identity, the segment should be the *bucket* — the day, the hour, whatever granularity the data actually changes at — not the instant the component rendered.

**★ A query is behind `enabled: false`. Does its key still matter?**
Yes. The gate suppresses the fetch, not the identity: the key is constructed on every render and the entry exists. `todoKeys.detail(id!)` with an `undefined` id gives a real cache entry keyed on something that does not serialise, and every gated detail query in the app shares it — so the moment one of them writes to it, the others see it. `skipToken` is the better tool because it puts the gate where TypeScript can narrow the parameter, which means the key is only ever built from a value that exists.

**★ Should query keys be namespaced by user or tenant id?**
Only when two identities can be live in one session — impersonation, a tenant switcher without a reload, a support view showing two accounts. Namespacing buys collision-freedom and nothing else; it does not evict, so the previous user's data still sits in memory until `gcTime` expires, which the reference puts at five minutes by default. The cheaper property is `queryClient.clear()` on logout, which you need in either design, and which handles the ordinary single-identity case completely. Namespacing everything by default is per-call-site cost paying for a guarantee you already have.

**★ How do you introduce a key factory into a codebase with three hundred inline keys without breaking anything?**
Two commits per entity, in a strict order. First, a factory that reproduces the current literals *exactly* — including the segment order you know is wrong — and the call sites replaced with it. That commit cannot change behaviour, which is what makes a large mechanical diff reviewable. Second, fix the shape inside the factory, where the diff is one function and every behavioural consequence is visible in a few lines. Then lock inline keys out with a grep in CI or a lint rule, because a factory with an easier alternative available regresses, and a half-adopted factory is worse than none — it makes `grep` look like a complete answer when it is not.

**★ Two packages in a monorepo import the same key factory and still fetch the same resource twice. What are you looking for?**
Not the key. If both sides call the same function, the keys are identical by construction, so the duplication is happening at the level above: two `QueryClient` instances. Either a second `QueryClientProvider` is mounted inside the tree, or the library has been resolved twice in the dependency graph so the two halves are using two different React contexts. Check the client identity first; the key is the thing that looks suspicious and it is the thing you have already proven correct.

**★ Where does a key factory stop helping?**
At the boundary of anything it does not construct. It guarantees shape, order and spelling; it cannot guarantee that two callers pass the same runtime *type* into `detail(id)`, that every dependency of the fetcher was declared as a parameter, or that both halves of the app are pointed at the same `QueryClient`. Those are the three failures that survive full adoption, and all three present the same way — a duplicate entry in the devtools — which is why the diagnostic order matters: instance first, then parameter types, then declared dependencies.

---

← [Query key factories](./01h-query-key-factories.md) · [Topic index](../README.md) · Next → [`useMutation`](../05-usemutation/01-mutation-lifecycle.md)
