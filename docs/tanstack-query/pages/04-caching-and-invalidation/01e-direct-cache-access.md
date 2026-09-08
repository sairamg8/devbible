---
title: "setQueryData writes to the cache synchronously and hands your updater T or undefined, which makes every unguarded old.foo in the codebase a production bug waiting for a cold cache"
sidebar_label: "01e · Direct cache access"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates), [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Filters](https://tanstack.com/query/latest/docs/framework/react/guides/filters) — plus the `setQueryData` and `gcTime` sentences banked from the [`QueryClient` reference](https://tanstack.com/query/latest/docs/reference/QueryClient) on 2026-09-06. Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# ✍️ Direct Cache Access: `getQueryData`, `setQueryData` and the `T | undefined` Trap

**Everything else in this topic asks the library to go and get data. These four methods write it, synchronously, with no network involved — which is what makes optimistic updates, cross-query seeding and websocket patches possible, and what makes them the sharpest edge in the API. The single most repeated bug in this track is an updater written as if its argument were `T`.**

🔴 **Provenance note.** The `QueryClient` reference page returns `{"isNotFound":true}` on the docs
site as of 2026-09-08. Two sentences from it were captured on 2026-09-06 and are quoted below; any
claim about this API that is *not* one of those two is described from behaviour and marked ⚠️ where
it is load-bearing.

## 1. The four shapes

```ts
// SINGULAR — take an exact query key. Not a filter.
const todos = queryClient.getQueryData<Todo[]>(['todos', 'list']);
queryClient.setQueryData<Todo[]>(['todos', 'list'], (old) => /* … */ old);

// PLURAL — take a FILTER, and answer for every match.
const all = queryClient.getQueriesData<Todo[]>({ queryKey: ['todos', 'list'] });
//    ^ array of [queryKey, data] pairs — data may be undefined for a match that never resolved
queryClient.setQueriesData<Todo[]>({ queryKey: ['todos', 'list'] }, (old) => /* … */ old);
```

The plural forms are how you patch a value that lives in many cached variants at once — the same
todo appearing on page 1, in the "active" filter and in the "assigned to me" filter — without
enumerating those variants. They accept the whole filter grammar from
[01b](./01b-query-filters-the-matching-surface.md) and
[01c](./01c-filtering-by-state-type-stale-predicate.md), so `{ queryKey: ['todos','list'], type: 'active' }`
patches only what is on screen.

There is also `getQueryState(queryKey)`, which returns the whole state object rather than just the
data — the route to `dataUpdatedAt`, `error` and the invalidation flag when you need to decide
*whether* to write.

## 2. 🔴 The updater is handed `T | undefined`, and the docs say why

The `QueryClient` reference sentence, banked verbatim:

> *"If the query does not exist, it will be created."*

That is the whole defect class. `setQueryData` does not require an existing entry; it will make
one. So the updater's parameter is `T | undefined`, and every path that reaches it with no entry —
a cold start, a deep link that skipped the list view, a cache garbage-collected while a dialog sat
open, a user who arrived from an email — hits `undefined`.

```ts
// ❌ Type-checks if you annotate the parameter yourself. Throws on the path nobody clicked.
queryClient.setQueryData<Todo[]>(['todos', 'list'], (old: Todo[]) =>
  old.map((t) => (t.id === id ? { ...t, done: true } : t))
);

// ✅ Optional chain — and note what it returns when there is nothing to update.
queryClient.setQueryData<Todo[]>(['todos', 'list'], (old) =>
  old?.map((t) => (t.id === id ? { ...t, done: true } : t))
);

// ✅ Default parameter, when "no entry" should mean "start from empty".
queryClient.setQueryData<Todo[]>(['todos', 'list'], (old = []) => [...old, newTodo]);
```

⚠️ The two forms are *not* equivalent, and the difference is documented on the page that does not
resolve: an updater returning `undefined` is understood as "do not write", whereas `(old = []) =>
[...old, x]` creates an entry containing just `x`. **I could not re-confirm the bail-out rule on
2026-09-08; verify against the version you install.** The distinction matters: seeding a list with a
single optimistically-added item, when the real list was never fetched, produces a screen showing
one todo out of two hundred until a refetch corrects it.

Always pass the type argument. `setQueryData(key, updater)` without it gives the updater an
untyped parameter, which is how `(old: Todo[])` gets written in the first place.

## 3. Writes must produce a new reference

A cache write is only visible to React if it changes the reference the observers compare. Mutating
in place changes the value and notifies nobody.

```ts
// ❌ Mutates the cached array in place: observers are never notified, nothing re-renders.
const data = queryClient.getQueryData<Todo[]>(['todos', 'list']);
data!.push(newTodo);

// ✅ A new array, through the sanctioned write path.
queryClient.setQueryData<Todo[]>(['todos', 'list'], (old = []) => [...old, newTodo]);
```

The same rule applies one level down. `old.map(t => { t.done = true; return t; })` returns a new
*array* but the same *objects*, and a memoised row component comparing its `todo` prop by reference
will not re-render. Copy at every level you change: `{ ...t, done: true }`.

This also interacts with structural sharing, covered in
[`01g`](./01g-structural-sharing.md) — the library's own deep-equality pass is what keeps unchanged
sub-trees referentially stable, and hand-mutation defeats the assumption it rests on.

## 4. `getQueryData` gives you a live reference, not a snapshot

This is the half of the immutability rule that costs an evening rather than a re-render. The value
`getQueryData` returns *is* the object in the cache. Capturing it as `previous` for a rollback and
then mutating anything reachable from it changes your rollback target too.

```ts
onMutate: async (id) => {
  await queryClient.cancelQueries({ queryKey: ['todos', 'list'] });
  const previous = queryClient.getQueryData<Todo[]>(['todos', 'list']); // the LIVE object

  // Every write below is a copy, so `previous` stays a true snapshot.
  queryClient.setQueryData<Todo[]>(['todos', 'list'], (old) =>
    old?.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
  );
  return { previous };
},
```

The `cancelQueries` on the first line is not optional; the optimistic-updates guide's own example
opens with it and explains it in a comment:

> *"Cancel any outgoing refetches (so they don't overwrite our optimistic update)"*

## 5. Patching many cached variants at once

`setQueriesData` is the answer to "this entity appears in nine cached lists". It takes a filter and
runs the updater against every match — and every one of those updaters gets its own `T | undefined`.

```ts
// One todo changed. Patch it wherever it is cached, without listing the variants.
queryClient.setQueriesData<Todo[]>({ queryKey: ['todos', 'list'] }, (old) =>
  old?.map((t) => (t.id === updated.id ? updated : t))
);
```

⚠️ A filter that is too broad here is worse than a broad invalidation, because it *writes*. If
`['todos']` also matches `['todos', 'detail', id]` — whose cached value is a `Todo`, not a
`Todo[]` — then an updater calling `.map` on it throws, or worse, a permissive updater silently
stores a wrongly-shaped value that no refetch will correct until that key is invalidated. Name the
narrowest prefix that covers the shape your updater assumes, and put the shape in the type argument
so a mismatch is a compile error.

Infinite queries are the same hazard in sharper form: their cached value is not the array your
component renders but the paged container the hook assembles, so an updater written against the
flattened list corrupts the entry. Patch `.pages` explicitly, or invalidate instead — see
[07 · Pagination and Infinite Queries](../07-pagination-and-infinite-queries/01d-infinite-cache-refetch-and-manual-updates.md).

## Gotchas

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

**★ An optimistic write races the refetch that is already running.** A background refetch started
before your `onMutate` resolves after it and writes the server's pre-mutation value straight over your
optimistic one — the UI flickers back, then forward again when the invalidation lands. The
`QueryClient` reference lists `queryClient.cancelQueries` for exactly this; `await` it on the same key
before the first `setQueryData`, as the example above does.

**★ Symptom: `setQueryData` "does nothing" and the component keeps showing the old value.** Cause:
the key you wrote to is not the key the hook reads. `['todos','list']` and `['todos','list',{}]` are
different queries; so are `['todo', id]` and `['todos','detail', id]`; so are a string `id` and a
number `id`, because the key is hashed. Fix: import the key from the same factory the hook uses —
this is the single strongest argument for [key factories](./01h-query-key-factories.md) — and, while
debugging, `getQueryData` the key first: `undefined` on a screen that is clearly showing data proves
the mismatch in one line.

**★ Symptom: a nested field changed but a memoised row did not re-render.** Cause: the updater
returned a new array containing the *same* item objects, so `React.memo` on the row saw an
unchanged prop. Fix: copy every level you touch — `old?.map(t => t.id === id ? { ...t, done: true } :
t)` — and never `t.done = true` inside a `map`. The array identity is what tells the list to
re-render; the item identity is what tells each row.

**★ Symptom: `setQueriesData` threw `old.map is not a function`.** Cause: the filter matched cached
values of more than one shape — typically because the prefix caught both `['todos','list',…]`
(an array) and `['todos','detail',…]` (an object). Fix: narrow the filter to the prefix whose shape
your updater assumes, pass the type argument so TypeScript checks the updater against it, and use
the `predicate` field when the shape boundary is not expressible as a prefix.

**★ Symptom: after a websocket patch via `setQueryData`, the next mount does not refetch even though
the data is incomplete.** Cause: ⚠️ a direct write updates the entry's last-updated timestamp, which
restarts its `staleTime` window — so a query with a generous `staleTime` is now considered fresh on
the strength of *your* partial write. **I could not re-confirm the timestamp behaviour against a
resolving doc page on 2026-09-08; verify against the version you install.** Fix: if a manual write
is a partial patch rather than the authoritative value, follow it with an
`invalidateQueries` on the same key, whose stale marking *"overrides any `staleTime`
configurations"* regardless.

**★ Symptom: an optimistic add appears, then the list shows only that one item.** Cause: the entry
did not exist, the updater used `(old = [])`, and so a brand-new one-element list was created and
rendered as if it were the whole collection. Fix: decide deliberately which of the two "no entry"
behaviours you want. If the correct response to a missing entry is "do not invent a list", return
the updater's input unchanged — `(old) => old?.map(...)` — and let the invalidation that follows
the mutation fetch the real thing.

**★ Symptom: `getQueriesData` returned entries whose data is `undefined`.** Cause: the filter matches
*queries*, not resolved data, and a query that was created but never resolved — or one that errored
— is a legitimate match with no value. Fix: destructure and guard:
`getQueriesData<Todo[]>(filter).filter(([, data]) => data !== undefined)`. Code that maps straight
over the pairs and indexes into `data` fails the first time a component mounts a new variant a tick
before its fetch resolves.

## Interview questions

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

**★ Why does an optimistic update need `cancelQueries` before it writes?**
Because a refetch that started before your mutation will finish after it, and when it does it writes
the server's *old* value into the cache on top of your optimistic one. The user sees the change apply,
revert, and then apply again a moment later when the post-mutation invalidation resolves —
indistinguishable from a flaky backend. Cancelling the in-flight queries for that key first removes
the race entirely, and it must be awaited, because the point is to be sure nothing is still running
when `setQueryData` executes.

**★ `setQueryData` or `setQueriesData` — how do you choose?**
By whether the thing you are patching lives at one key or at an unknown number of them.
`setQueryData` takes an exact key and addresses exactly one entry, which is right for a detail view
or for seeding. `setQueriesData` takes the full filter object and runs your updater once per match,
which is right when the same entity is embedded in several cached lists — page 1, the "active"
filter, the "assigned to me" filter — and you do not want to enumerate them. The risk moves with
the power: a broad filter on a *write* can push a wrongly-shaped value into an entry, which no
refetch will notice until that key happens to be invalidated, so narrow the filter to the prefix
whose shape your updater assumes.

**★ When would you write to the cache directly instead of invalidating?**
Three cases, and they are all "I already have the authoritative value, so a request would be waste".
A mutation response that returns the updated entity — write it into the detail key rather than
refetching it. A push channel delivering the change — patch the affected keys as messages arrive. A
list response that already contains the full objects a detail view will need — seed those detail
keys so the click is instant. Outside those, invalidation is the safer default, because it lets the
server remain the authority on the shape and on the fields your write does not know about.

**★ How do you tell, from the symptoms alone, that a `setQueryData` call is writing to the wrong
key?**
The write appears to succeed — it never throws, because a missing entry is created rather than
rejected — and the UI does not change. That combination is nearly diagnostic: an exception would
point at the updater, and a re-render with wrong data would point at the merge logic, but silence
plus no visual change means you created a second cache entry that nothing observes. Confirm it by
reading the key back with `getQueryData` before the write, or by opening the devtools and looking
for a key that appeared with no observers.

---

← [Invalidate vs refetch vs reset vs remove](./01d-invalidate-refetch-reset-remove.md) · [Topic index](../README.md) · Next → [`staleTime` vs `gcTime`](./01f-staletime-vs-gctime.md)
