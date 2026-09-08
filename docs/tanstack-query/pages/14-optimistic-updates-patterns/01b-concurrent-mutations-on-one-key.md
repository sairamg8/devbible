---
title: "Snapshot-and-rollback is a single-writer protocol: two mutations on one key make each rollback restore a value the other mutation had already optimistically overwritten"
sidebar_label: "01b · Concurrent mutations on one key"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates), [Mutations (v5 path)](https://tanstack.com/query/v5/docs/framework/react/guides/mutations), [Query Cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation), [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

**The snapshot-and-rollback recipe in [`01`](01-advanced-rollback-strategies.md) is correct for exactly one in-flight mutation per query key. It has no concept of a second writer, and the library will happily give you one: *"Per default, all mutations run in parallel — even if you invoke `.mutate()` of the same mutation multiple times."* The second mutation snapshots a cache that already contains the first one's optimistic write, and the first one's rollback restores a cache that predates the second one's. Each mutation is individually correct and the pair is wrong. This is the reason optimistic updates need a topic of their own, and it is the failure that survives every obvious fix.**

## The interleaving, step by step

Two todos are toggled quickly — mutation **A** on todo 1, mutation **B** on todo 2, both writing `['todos']`. Both use the textbook recipe. Call the server-truth list at the start `S`.

| # | Event | What `['todos']` holds afterwards | What that mutation is holding as its snapshot |
|---|---|---|---|
| 1 | A `onMutate`: cancel, snapshot, write | `S+a` | A holds `S` |
| 2 | B `onMutate`: cancel, snapshot, write | `S+a+b` | B holds **`S+a`** — A's optimistic write, not server truth |
| 3 | A's request **fails** | — | — |
| 4 | A `onError`: `setQueryData(key, S)` | **`S`** | b is gone from the UI while B is still in flight and will succeed |
| 5 | B's request succeeds | `S` | the UI shows neither a nor b |
| 6 | B `onSettled`: invalidate → refetch | `S+b` | correct again, one network round-trip later |

Step 4 is the defect. A's rollback is a *whole-value restore*, so it does not undo "a" — it undoes **everything since A's snapshot**, and B's optimistic write is in that window. The user watches their second toggle flip back for no reason, then flip forward again when the refetch lands.

Reverse the failure and it is worse. If **B** fails and A succeeds, B's rollback restores `S+a` — which is right by luck, because B's snapshot happened to include A's write. The pattern's correctness now depends on the *order* in which two independent network requests fail. That is not a race you can test into submission.

### Why "it converges eventually" is not a defence

Step 6 fixes it, and that is the argument people reach for. Three things break it:

- **The invalidation is not guaranteed to run.** `onSettled` on the hook always runs; `onSettled` passed to `mutate(vars, { onSettled })` does not — *"those additional callbacks won't run if your component unmounts before the mutation finishes"*. A row that unmounts because the list re-rendered takes its reconciliation with it.
- **Offline, the refetch cannot settle.** The converging step is a network call. The state that "converges" is the state you are stuck in.
- **The refetch that converges can be cancelled by the next mutation.** Every `onMutate` starts with `cancelQueries` on that key. A third toggle starting while step 6's refetch is in flight aborts it, and the corrected value never arrives — the correction and the next optimistic write are competing for the same key by design.

So the transient is not bounded by one round-trip. On a busy list it is bounded by the user stopping.

## Fix 1 — serialise: make the second writer wait

The library ships the answer to "two mutations must not overlap":

> *"Per default, all mutations run in parallel - even if you invoke `.mutate()` of the same mutation multiple times. Mutations can be given a `scope` with an `id` to avoid that. All mutations with the same `scope.id` will run in serial"*

```typescript
function useToggleTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (todo: Todo) => api.patch(`/todos/${todo.id}`, { done: !todo.done }),
    // every toggle against the todo list queues behind the previous one
    scope: { id: 'todos' },
    onMutate: async (todo) => {
      await queryClient.cancelQueries({ queryKey: ['todos'] });
      const previousTodos = queryClient.getQueryData<Todo[]>(['todos']);
      queryClient.setQueryData<Todo[]>(['todos'], (old) =>
        (old ?? []).map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t)),
      );
      return { previousTodos };
    },
    onError: (err, todo, onMutateResult) => {
      if (!onMutateResult) return;
      queryClient.setQueryData(['todos'], onMutateResult.previousTodos);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });
}
```

**Scope the id to the cache key you write, not to the mutation.** `scope: { id: 'todos' }` on every mutation that writes `['todos']` — the toggle, the delete, the rename — is the invariant that makes the snapshot valid, because it guarantees no other scoped mutation's optimistic write is in the cache when you take it. Scoping by entity id (``scope: { id: `todo-${todo.id}` }``) does *not* fix this: two different todos still both write the one list key, which is the exact interleaving above.

🔴 **What serialisation costs you is the point of optimistic updates.** Serial mutations means the second `mutationFn` does not start until the first has fully settled, invalidation included if you return that promise. Ten rapid toggles become ten sequential round-trips. The *UI* still updates instantly for each — `onMutate` for a queued mutation runs when its turn comes, not on click. ⚠️ **The documentation states the mutations run in serial; it does not state at what point a queued mutation's `onMutate` fires relative to the previous one's settling.** I could not confirm it, so do not build a "the optimistic write is still instant" claim on it — measure it in your app before promising a product manager anything.

## Fix 2 — stop restoring, start un-applying

The deeper problem is that `setQueryData(key, snapshot)` is a *destructive* undo: it discards everything, including writes that were not yours. If your optimistic change is expressible as a reversible function of one item, roll back by inverting it rather than by replacing the list.

```typescript
// A targeted rollback: undo THIS todo, leave every other concurrent write alone.
onError: (err, todo, onMutateResult) => {
  if (!onMutateResult) return;
  queryClient.setQueryData<Todo[]>(['todos'], (old) =>
    (old ?? []).map((t) => (t.id === todo.id ? onMutateResult.previousTodo : t)),
  );
},

onMutate: async (todo) => {
  await queryClient.cancelQueries({ queryKey: ['todos'] });
  // snapshot the ONE ITEM, not the whole list
  const previousTodo = queryClient
    .getQueryData<Todo[]>(['todos'])
    ?.find((t) => t.id === todo.id);
  queryClient.setQueryData<Todo[]>(['todos'], (old) =>
    (old ?? []).map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t)),
  );
  return { previousTodo };
},
```

Now A's failure restores todo 1 and leaves todo 2's optimistic state untouched, whichever order the two requests fail in. The snapshot is item-scoped, so it is unaffected by concurrent writes to *other* items.

**This is not free, and the limits are sharp:**

- **Two mutations on the *same item* are still broken.** Both snapshot the same todo, and the loser's rollback discards the winner's change to it. For same-item concurrency, `scope.id` is the only correct answer.
- **It does not work for insert or delete.** An optimistic append has no "previous item" to put back — you must remove by identity, which requires an identity the server has not assigned yet (see the gotcha on temporary ids below).
- **It reorders badly.** If the optimistic write moved an item within the list, un-applying it by id restores the object but not its position.

## Fix 3 — do not write the cache at all

The documentation's own first answer to concurrency is to keep optimistic state out of the cache entirely and render it from the mutation's own `variables`. That is [`01c`](01c-in-flight-state-and-ui-variables.md), and it has no rollback code at all, because there is nothing to roll back — when the mutation ends, the temporary row disappears and the query's data is the only source of truth. The docs put the choice plainly: use `variables` for a single-location update, and cache manipulation *"if you have multiple places on the screen that would require to know about the update."*

## Gotchas

**★ 🔴 The second mutation's snapshot contains the first mutation's optimistic write, and nothing marks it as provisional.** `getQueryData` returns whatever is in the cache, and an optimistic write is indistinguishable from fetched data — there is no "pending" flag on a cache entry, no version, no writer id. So a snapshot taken during another mutation's flight records a value the server never confirmed, and restoring it later re-asserts an unconfirmed guess as though it were truth. Every defence in this page is ultimately a way of not taking that snapshot.

**★ Reversing which mutation fails changes whether the naive pattern is correct.** If the *later* mutation fails, its snapshot already includes the earlier one's write, so the rollback looks right. If the *earlier* one fails, its rollback erases the later one. Same code, same two mutations, opposite outcomes decided by network timing — which is why this reproduces in production and not in review, and why "I tested it, it worked" is not evidence about this bug.

**★ `scope.id` keyed by entity id does not fix a shared list key.** The natural instinct is `scope: { id: todo.id }` — one queue per todo. But the interleaving is over the *cache key*, `['todos']`, which every todo's mutation writes. Two different todos are in different scopes, run in parallel, and reproduce the failure exactly. The scope id must name the thing being contended: the query key.

**★ An optimistic insert has no id, so a targeted rollback cannot find it.** The server assigns the id. Optimistic appends therefore need a client-generated temporary id (`crypto.randomUUID()`) placed on the item in `onMutate`, both to give React a stable `key` and to give `onError` something to filter on: `(old) => old.filter((t) => t.id !== tempId)`. Without it the only available rollback is the destructive whole-list restore, which is the pattern this page is about avoiding. And when the write *succeeds*, the temporary id is still in the cache until the invalidation refetch replaces it — anything that clicks through to `/todos/${id}` in that window requests a row that does not exist.

**★ `onSettled` fires once per mutation, so N concurrent mutations schedule N invalidations of the same key.** They deduplicate at the fetch layer as concurrent refetches of one key, but they do not deduplicate as *decisions*: the last one to fire refetches after the last mutation settles, which is what you want, while the earlier ones refetch mid-flight and pull server state that is missing the still-pending writes. Combined with `cancelQueries` in the next `onMutate`, a burst of mutations produces a burst of refetches most of which are cancelled or immediately superseded. Serialising with `scope.id` collapses this too.

**★ A mid-flight invalidation refetch erases other mutations' optimistic writes, and it is your own code that triggers it.** Mutation B settling invalidates `['todos']`; the refetch returns server state, which does not contain still-pending mutation A's change, so A's optimistic row vanishes and reappears when A settles. This is not a race with an external actor — it is one mutation's reconciliation stepping on another's optimism. It is the strongest single argument for the `variables`-based approach in [`01c`](01c-in-flight-state-and-ui-variables.md), where pending state lives outside the cache and a refetch cannot touch it.

**★ ⚠️ What `cancelQueries` "reverts to" is not defined relative to your own interleaved writes.** The cancellation guide says it *"will cancel the query and revert it back to its previous state"*. With one writer that is unambiguous. With a `setQueryData` from another mutation landing between the fetch starting and the cancel, the documentation does not say whether "previous state" means the value before the fetch began or the value currently in the cache. **I could not confirm this and it is not safe to assume.** Do not design a scheme that depends on the revert preserving a concurrent optimistic write.

**★ Deduplicating clicks with `disabled={isPending}` fixes one component and hides the bug.** `isPending` is per-hook-instance. Two rows, two `useMutation` instances, two independent `isPending` flags, both writing one key. The button guard is still worth having for double-submit protection, but it is not concurrency control and it makes the real defect harder to reproduce because the easiest reproduction — clicking the same button twice — no longer works.

**★ Structural sharing does not save you here.** Query results are *"structurally shared to detect if data has actually changed"*, which keeps references stable across refetches; it says nothing about merging two writers' intentions. A whole-value `setQueryData(key, snapshot)` replaces the entry outright. There is no three-way merge anywhere in this library — the reconciliation strategy is "refetch and believe the server", which is why `onSettled` invalidation is mandatory rather than a nicety.

**★ The bug is invisible in a single-user manual test and obvious in a slow-network one.** Everything here needs two mutations to overlap, which on a fast connection means clicking twice within one round-trip. Throttle the network in devtools, click two different rows, and force one of the two requests to fail — that is the reproduction, and it takes about a minute once you know to construct it.

## Interview questions

**★ Two rows in a list are toggled a moment apart. The first request fails. Describe exactly what the user sees, and why.**
The first mutation's `onError` restores the snapshot it took *before* either write — so the second row's optimistic change disappears along with the first's, even though the second request is still in flight and will succeed. The user sees their second toggle flip back for no visible reason, then flip forward again a round-trip later when the second mutation's `onSettled` invalidation refetches. The cause is that a whole-value restore undoes everything since the snapshot, not just this mutation's contribution, and an optimistic write from another mutation is inside that window with nothing marking it as provisional.

**★ Why is "the `onSettled` invalidation fixes it anyway" not an adequate answer?**
Because the correction is a network round-trip that three ordinary things prevent. Callbacks passed to `mutate()` rather than to `useMutation` do not run if the component unmounted first — *"those additional callbacks won't run if your component unmounts before the mutation finishes"* — and list rows unmount routinely. Offline, the refetch never settles, so the wrong state is the resting state. And the next mutation's `onMutate` calls `cancelQueries` on that key, which aborts the in-flight correction; on a list being edited quickly the correction can be cancelled repeatedly. Eventual consistency is real here but it is not bounded by anything the code controls.

**★ How does `scope.id` fix it, and what does it cost?**
It serialises: *"All mutations with the same `scope.id` will run in serial"*, so the second mutation's `onMutate` cannot take its snapshot while the first is in flight — which restores the invariant the snapshot-and-rollback pattern silently assumes, namely one writer per key. The cost is throughput: ten rapid edits become ten sequential round-trips, including whatever the returned invalidation promise adds. The id must name the **query key** being contended, not the entity — scoping per todo id leaves every todo mutation writing the same `['todos']` entry in a different queue, which is the original bug with extra ceremony.

**★ Show a rollback that survives a concurrent mutation, and say where it stops working.**
Snapshot the individual item rather than the collection, and roll back with an updater that replaces only that item: `(old) => old.map(t => t.id === id ? previousTodo : t)`. Concurrent writes to *other* items are untouched, so the order in which two requests fail no longer changes the outcome. It stops working in three places: two mutations against the *same* item (the loser's rollback still discards the winner's change — that needs `scope.id`), inserts and deletes (there is no previous item to restore, so you need a client-generated temporary id to filter on), and any change that moves an item, since restoring the object does not restore its position.

**★ When would you not do a cache-based optimistic update at all?**
When the pending state is needed in one place on the screen. The docs' own guidance is to render from the mutation's `variables` for a single-location update and reach for cache manipulation *"if you have multiple places on the screen that would require to know about the update."* The `variables` approach has no snapshot, no rollback and no interaction with other mutations, because it never writes the cache — the optimistic row lives in the mutation's own state and vanishes when the mutation settles. Every failure mode on this page is a cost of choosing the cache, so it should be a choice and not a default.

**★ Why does `disabled={isPending}` not count as concurrency control?**
Because `isPending` belongs to one `useMutation` instance. A list renders one instance per row, so two rows have two independent flags while writing the same cache key; and two components elsewhere in the tree calling the same mutation hook each get their own. It prevents a double-submit of one button, which is worth doing, and it removes the easiest reproduction of the real bug, which makes it actively misleading during debugging.

**★ Does structural sharing or any built-in merge protect concurrent optimistic writes?**
No. Structural sharing exists so that *"the data reference remains unchanged"* when a refetch returns equal data — a re-render optimisation over fetched results. It does not merge two writers, and `setQueryData` with a plain value replaces the entry wholesale. The library has no conflict resolution: its reconciliation strategy is to refetch and take the server's answer, which is exactly why the invalidation in `onSettled` is load-bearing rather than tidy-up, and why anything you need to be *correct* rather than *fast* has to survive being overwritten by a refetch.

---

← [The rollback contract](01-advanced-rollback-strategies.md) · [Topic index](../README.md) · Next → [In-flight state and UI variables](01c-in-flight-state-and-ui-variables.md)
