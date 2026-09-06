---
title: "Caching & Invalidation: `invalidateQueries()`, `refetchQueries()` & Direct Cache Access"
sidebar_label: "Caching & Invalidation"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the TanStack Query docs — [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation), [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [`QueryClient`](https://tanstack.com/query/latest/docs/reference/QueryClient), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

# 🔄 Caching & Invalidation: `invalidateQueries()`, `refetchQueries()` & Direct Cache Access

## 1. Under-The-Hood Mechanics

TanStack Query's cache invalidation APIs each solve a distinct problem — marking data stale vs forcing an immediate refetch vs directly manipulating cache contents synchronously — and picking the wrong one produces either unnecessary network traffic or stale UI that doesn't update when it should.

```
invalidateQueries({ queryKey: ['todos'] })
        │
        ▼
Marks EVERY matching query STALE, AND triggers an immediate refetch for any query
that's CURRENTLY ACTIVE (has a mounted component observing it) — INACTIVE queries
are just marked stale, refetched lazily whenever next observed

refetchQueries({ queryKey: ['todos'] })
        │
        ▼
Forces an IMMEDIATE refetch of matching queries REGARDLESS of staleness — even
data that's still perfectly fresh gets refetched right now

setQueryData(queryKey, updater) / getQueryData(queryKey)
        │
        ▼
SYNCHRONOUS, direct cache read/write — no network request at all — the mechanism
optimistic updates use to apply an assumed-successful change INSTANTLY
```

### Hierarchical Keys Enabling Partial-Match Invalidation
`invalidateQueries({ queryKey: ['todos'] })` matches **every** query whose key starts with `'todos'` — `['todos', 'list', {status: 'active'}]`, `['todos', 'detail', '123']`, all of it — a single, broad invalidation call correctly refreshes every related view without needing to enumerate every specific filtered variant that happens to exist.

### `setQueryData()`: The Foundation of Optimistic Updates
Because `setQueryData()` writes directly and synchronously to the cache (no network round-trip), it's what lets a mutation's `onMutate` callback apply an assumed-successful UI change **instantly** — the actual optimistic-update pattern (covered in depth in the [useMutation doc](../05-usemutation/01-mutation-lifecycle.md)) is built entirely on this one primitive.

---

## 2. Real-World Engineering Scenario

**Scenario**: A "Mark as Read" Action Needing to Update Both a Notification List AND a Badge Count, From One Invalidation Call.
Marking a notification as read needed to refresh both the notification list view (`['notifications', 'list']`) and a separate unread-count badge (`['notifications', 'unreadCount']`) — rather than tracking and invalidating each specific query key individually (fragile, easy to miss one when a new notification-related view is added later), a single `invalidateQueries({ queryKey: ['notifications'] })` call correctly refreshed **every** query under that hierarchical prefix, including both existing views and any future ones added under the same key structure, with zero additional invalidation code needed as the app grew.

---

## 3. Production-Grade Code Example

```typescript
// Broad, hierarchical invalidation — refreshes EVERY related query with one call
async function markNotificationRead(id: string) {
  await api.post(`/notifications/${id}/read`);
  queryClient.invalidateQueries({ queryKey: ['notifications'] }); // refreshes list, unreadCount, detail views, ALL of it
}
```

```typescript
// Narrow invalidation — only refreshing a SPECIFIC query, leaving sibling queries untouched
async function updateTodoStatus(id: string, status: string) {
  await api.patch(`/todos/${id}`, { status });
  queryClient.invalidateQueries({ queryKey: ['todos', 'detail', id] }); // ONLY this specific todo's detail view
  // NOT invalidating ['todos', 'list', ...] here — deliberately, if the list view doesn't need refreshing yet
}
```

```typescript
// refetchQueries() — forcing an immediate refresh regardless of staleness (e.g. a manual "Refresh" button)
function RefreshButton() {
  const queryClient = useQueryClient();
  return (
    <button onClick={() => queryClient.refetchQueries({ queryKey: ['dashboard'] })}>
      Refresh Now {/* forces a refetch even if data is still technically "fresh" per staleTime */}
    </button>
  );
}
```

```typescript
// setQueryData/getQueryData — direct, synchronous cache manipulation for optimistic updates
function useToggleTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/todos/${id}/toggle`),
    onMutate: async (id) => {
      // Stop any refetch already in flight: it would resolve AFTER this write and overwrite it
      await queryClient.cancelQueries({ queryKey: ['todos', 'list'] });

      // Typed read — the untyped call gives you `unknown` and nothing to narrow
      const previous = queryClient.getQueryData<Todo[]>(['todos', 'list']); // snapshot BEFORE the change

      queryClient.setQueryData<Todo[]>(['todos', 'list'], (old) =>
        // `old` is `Todo[] | undefined`. setQueryData creates the entry when it is missing, so an
        // unguarded `old.map(...)` throws the first time this mutation runs on an unvisited list.
        old?.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
      );
      return { previous }; // returned as context for onError rollback — see the useMutation doc
    },
  });
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Using `refetchQueries()` Where `invalidateQueries()` Would Suffice
```typescript
// ❌ WASTEFUL: forces an immediate network request even for data that's still fresh and
// doesn't actually need refetching right now — unnecessary server load
queryClient.refetchQueries({ queryKey: ['todos'] }); // ALWAYS refetches, regardless of staleness

// ✅ CORRECT: invalidateQueries respects staleness AND active/inactive query state, only
// forcing an immediate refetch for queries with an ACTIVE observer, deferring the rest
queryClient.invalidateQueries({ queryKey: ['todos'] });
```

### ⚠️ Pitfall 2: Over-Broad Invalidation Causing Unnecessary Refetch Storms
```typescript
// ❌ WASTEFUL: invalidating the ENTIRE cache (no queryKey filter at all) after a small,
// narrowly-scoped mutation forces every single active query in the app to refetch simultaneously
queryClient.invalidateQueries(); // no filter — invalidates EVERYTHING

// ✅ CORRECT: scope invalidation to the SPECIFIC hierarchical prefix actually affected by the mutation
queryClient.invalidateQueries({ queryKey: ['todos'] }); // only todo-related queries, not the whole app
```

### ⚠️ Pitfall 3: Mutating the Object Returned by `getQueryData()` Directly
```typescript
// ❌ WRONG: mutating the returned data DIRECTLY bypasses TanStack Query's own change-detection
// and subscriber-notification mechanism — components observing this query DON'T re-render,
// since the cache was mutated OUTSIDE the sanctioned setQueryData() write path
const data = queryClient.getQueryData(['todos', 'list']);
data.push(newTodo); // ❌ directly mutates the cached array — observers never notified

// ✅ CORRECT: always use setQueryData() with an updater function, which correctly triggers
// subscriber notifications and produces a genuinely NEW reference (respecting immutability)
queryClient.setQueryData<Todo[]>(['todos', 'list'], (old = []) => [...old, newTodo]);
// note the `= []` default: `old` is `Todo[] | undefined`, and spreading undefined throws
```

---

## Gotchas

**★ `invalidateQueries` outranks every `staleTime` you configured.** The guide is unambiguous about
what invalidation does to a matched query: *"It is marked as stale. This stale state overrides any
`staleTime` configurations being used in `useQuery` or related hooks."* So `staleTime: Infinity` is
not a shield — invalidation is the deliberate escape hatch from your own freshness policy, and that is
exactly why it is the right call after a mutation.

**★ 🔴 It only refetches what is on screen.** *"If the query is currently being rendered via
`useQuery` or related hooks, it will also be refetched in the background."* Everything else that
matched is marked stale and left alone until something observes it again. This is the source of the
most-reported "invalidation did nothing" bug: the component the reporter was watching was mounted and
did update, and the one they *expected* to update was behind a closed modal, an unmounted tab or a
route they had navigated away from — so it correctly waited. Nothing is broken; the refetch happens
on next mount.

**★ Invalidation is a schedule, not a write.** The cache still holds the old value at the instant
`invalidateQueries` returns; the new value arrives when the background refetch resolves. Code that
invalidates and then immediately navigates, closes a dialog, or reads `getQueryData` gets the
pre-mutation data. If the next step genuinely depends on the refreshed value, sequence on the refetch
rather than on the invalidation call.

**★ Prefix matching is positional, and that makes key shape a design decision.** `['todos']` matches
`['todos', 'list', {…}]` and `['todos', 'detail', '123']` because it is a *prefix of the array*. It
does not match `['list', 'todos']`, and it cannot reach a discriminator you buried at index 2 while
skipping index 1. The docs note the asymmetry that makes this bite — object property order is
irrelevant (*"no matter the order of keys in objects, all of the following queries are considered
equal"*) but *"Array item order matters!"*. Put the coarsest segment first, always, and generate keys
from one factory so no call site can invent a different order.

**★ When a prefix is too broad and an exact key is too narrow, the answer is `predicate`.** The guide
documents all three levels: prefix by default, `exact: true` to *"match only queries with no
additional subkeys"*, and — *"you can pass a predicate function to the `invalidateQueries` method.
This function will receive each `Query` instance from the query cache and allow you to return `true`
or `false` for whether you want to invalidate that query"*. Use the predicate for "every todo list
whose filter mentions this project", which no prefix can express.

**★ `refetchQueries` bypasses the active/inactive distinction that makes invalidation cheap.**
Invalidation costs one network request per *mounted* observer and defers the rest; a forced refetch
does the work now, whether or not the data was fresh and whether or not anything is looking at it.
Reserve it for the cases where "now" is the requirement — a manual Refresh button, a poll you are
driving yourself — and use invalidation everywhere a mutation just changed the server.

**★ `getQueryData` gives you `unknown` unless you pass the type argument.** Write
`getQueryData<Todo[]>(key)`, not `getQueryData(key)`. The untyped call returns something you cannot
narrow and cannot safely index, and the usual reaction — casting it — throws away the only check that
would have caught a key/shape mismatch. The same applies to `setQueryData<Todo[]>`, which is also what
gives the updater argument a useful type.

**★ 🔴 The updater's argument is `T | undefined`, and the docs say why.** `setQueryData` is *"a
synchronous function that can be used to immediately update a query's cached data. If the query does
not exist, it will be created."* So the entry you are updating may not be there — the first mutation
after a cold start, a user who deep-linked past the list view, a cache that was garbage-collected
while a dialog was open. `(old) => old.map(...)` throws in every one of those cases; `(old) =>
old?.map(...)` or `(old = []) => [...old, x]` does not.

**★ Mutating the object from `getQueryData` poisons your rollback, not just your render.** The
familiar half of this is that observers are never notified, because the cache was written outside the
sanctioned path. The half that costs an evening is the optimistic-update case: `previous` from
`getQueryData` and the live cache entry are *the same object*, so an in-place mutation changes your
"snapshot" too, and the `onError` rollback restores the state you were trying to undo. The snapshot is
only a snapshot if every write goes through `setQueryData` with a new reference.

**★ Warming the cache with `setQueryData` starts a five-minute countdown.** The reference is explicit:
*"If the query is not utilized by a query hook within the default `gcTime`, the query will be garbage
collected. If the default `gcTime` has not been configured, it defaults to 5 minutes."* Seeding a
detail entry from a list response is a good pattern, but if the user does not open that detail view
within five minutes the seeded entry is gone and the fetch happens anyway.

**★ An optimistic write races the refetch that is already running.** A background refetch started
before your `onMutate` resolves after it and writes the server's pre-mutation value straight over your
optimistic one — the UI flickers back, then forward again when the invalidation lands. The
`QueryClient` reference lists `queryClient.cancelQueries` for exactly this; `await` it on the same key
before the first `setQueryData`, as the example above does.

## Interview questions

**★ `invalidateQueries` or `refetchQueries` after a successful mutation — which, and why?**
Invalidation, in almost every case. It marks everything that matched as stale and refetches only what
is currently rendered — *"If the query is currently being rendered via `useQuery` or related hooks, it
will also be refetched in the background"* — so the screens the user is looking at update now and the
ones they are not cost nothing until they are mounted again. A forced refetch does the work
unconditionally: every matched query hits the network whether it was fresh, and whether anyone is
observing it. `refetchQueries` earns its place when "now" is the actual requirement, such as a manual
Refresh control, and not as a stronger-sounding synonym for invalidation.

**★ You invalidate after a mutation. The list on screen updates; a panel behind a closed drawer does
not. Is that a bug?**
No, that is the documented behaviour and it is the behaviour you want. Everything matching the key
was marked stale; only the mounted observers refetched in the background. The closed drawer's query
has no observer, so it waits — and when the drawer opens, that mount is itself a refetch trigger for
a stale query, so the user sees fresh data the moment they can see it at all. Forcing it eagerly would
buy a request for a screen nobody is looking at.

**★ How does key matching work, and how do you invalidate exactly one query?**
By default it is a prefix match over the key array, so `['todos']` catches `['todos', 'list', filters]`
and `['todos', 'detail', id]` alike. For a single query, name the full key and add `exact: true`,
which matches *"only queries with no additional subkeys"*. Between the two there is the predicate
form, which receives each `Query` from the cache and returns a boolean — the tool for conditions that
are not expressible as a prefix, such as "every cached page of any list whose filter references this
project". Because matching is positional, the array's shape is load-bearing: coarsest segment first,
and one key factory rather than hand-written keys at call sites.

**★ What is the type of the `setQueryData` updater's argument, and what goes wrong if you get it
wrong?**
`T | undefined`. The reference notes that *"If the query does not exist, it will be created"*, so the
updater has to cope with there being nothing to update — the first mutation after a cold start, a
deep link that skipped the list view, or an entry that was garbage-collected while a dialog stayed
open. An updater typed and written as `(old: Todo[]) => old.map(...)` type-checks, passes review,
works in every manual test where you visited the list first, and throws in production on the path
nobody clicked through. Write `old?.map(...)` or give the parameter a default.

**★ Why is mutating the result of `getQueryData` worse than "the component just does not re-render"?**
Because you have also destroyed your ability to undo it. The missing re-render is the obvious symptom:
the cache was changed outside `setQueryData`, so no observer was notified and structural sharing never
saw a new reference. The subtler failure is in optimistic updates, where the value you captured as
`previous` is the very object you then mutated in place — so `onError` "rolls back" to the mutated
state and the bad value survives the rollback that was supposed to remove it. Every write through
`setQueryData` returning a new reference keeps both properties: observers are notified, and snapshots
stay snapshots.

**★ You seed a detail query with `setQueryData` from a list response and nothing ever mounts it. How
long does it live?**
Five minutes by default, then it is garbage collected — *"If the query is not utilized by a query hook
within the default `gcTime`, the query will be garbage collected. If the default `gcTime` has not been
configured, it defaults to 5 minutes."* The seeding pattern is still worth it, because the payoff case
is a click that happens seconds later, but it is not a way to preload data for a session. If you need
the entry to outlive that window, raise `gcTime` for that key via `setQueryDefaults` rather than
hoping.

**★ Why does an optimistic update need `cancelQueries` before it writes?**
Because a refetch that started before your mutation will finish after it, and when it does it writes
the server's *old* value into the cache on top of your optimistic one. The user sees the change apply,
revert, and then apply again a moment later when the post-mutation invalidation resolves —
indistinguishable from a flaky backend. Cancelling the in-flight queries for that key first removes
the race entirely, and it must be awaited, because the point is to be sure nothing is still running
when `setQueryData` executes.

**★ Does `invalidateQueries` respect `staleTime`?**
No, and deliberately so. *"This stale state overrides any `staleTime` configurations being used in
`useQuery` or related hooks."* `staleTime` encodes a guess about how long data stays valid on its own;
invalidation is you telling the library you *know* it changed, because you just changed it. If
invalidation deferred to `staleTime`, a mutation followed by an invalidation would silently do nothing
on any query with a generous freshness window — which is precisely the queries you most want to
correct.
