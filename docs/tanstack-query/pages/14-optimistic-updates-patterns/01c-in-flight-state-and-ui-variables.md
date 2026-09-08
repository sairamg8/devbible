---
title: "The optimistic update with no rollback: render the mutation's own variables while it is pending, read them from anywhere with useMutationState, and never touch the cache"
sidebar_label: "01c · In-flight state and UI variables"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates), [Mutations (v5 path)](https://tanstack.com/query/v5/docs/framework/react/guides/mutations), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

**Every failure in [`01`](01-advanced-rollback-strategies.md) and [`01b`](01b-concurrent-mutations-on-one-key.md) is a cost of putting a guess into the query cache. The documentation's first-listed approach does not: it renders the pending row straight out of the mutation's own `variables`, so there is no snapshot to take, no rollback to guard, no interleaving with other writers, and no invalidation refetch that can wipe it. This chunk is that pattern, the `useMutationState` hook that makes it work across components, and the exact boundary where it stops being enough and you must go back to the cache.**

## The pattern: the mutation already holds the optimistic value

You passed the new todo to `mutate()`. The mutation is holding it. Render it.

The docs' own destructure:

> ```tsx
> const { isPending, submittedAt, variables, mutate, isError } = addTodoMutation
> ```

and the render:

> ```tsx
> <ul>
>   {todoQuery.items.map((todo) => (
>     <li key={todo.id}>{todo.text}</li>
>   ))}
>   {isPending && <li style={{ opacity: 0.5 }}>{variables}</li>}
> </ul>
> ```

The whole optimistic update is `{isPending && …}`. Three properties carry it:

| Property | What it is | What it is for here |
|---|---|---|
| `variables` | the argument the current mutation was called with | the content of the provisional row |
| `isPending` | `status === 'pending'` | whether to show it at all |
| `submittedAt` | when the mutation was submitted | ordering several pending rows, or "still saving…" after a threshold |
| `isError` | `status === 'error'` | keep the row and offer a retry instead of silently dropping it |

**There is no rollback because there is no write.** When the mutation errors, `isPending` goes false and the row disappears — the query's data was never modified, so "restoring" it is a no-op the framework performs for you. When it succeeds, `onSettled`'s invalidation refetches and the real row arrives with a real id, replacing the provisional one on the next render.

### The failure path this makes cheap

Mutations do not retry: *"By default, TanStack Query will not retry a mutation on error"*, against *"Queries that fail are silently retried 3 times, with exponential backoff"*. So a failed write is final unless someone acts. With the cache approach the user's typing is gone the instant the rollback runs. With this approach `variables` still holds it, and `isError` is the render condition:

```tsx
function TodoList() {
  const todoQuery = useQuery({ queryKey: ['todos'], queryFn: fetchTodos });
  const addTodo = useMutation({
    mutationKey: ['addTodo'],
    mutationFn: (text: string) => api.post('/todos', { text }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });

  return (
    <ul>
      {(todoQuery.data ?? []).map((todo) => (
        <li key={todo.id}>{todo.text}</li>
      ))}

      {addTodo.isPending && <li style={{ opacity: 0.5 }}>{addTodo.variables}</li>}

      {addTodo.isError && (
        <li style={{ color: 'crimson' }}>
          {addTodo.variables}
          <button onClick={() => addTodo.mutate(addTodo.variables!)}>Retry</button>
        </li>
      )}
    </ul>
  );
}
```

⚠️ The non-null assertion on `addTodo.variables` is the honest shape of the API: `variables` is `TVariables | undefined`, because before the first `mutate()` call there were none. Inside an `isError` branch it is populated, but the type does not know that — narrow it with an explicit check rather than `!` if your lint config forbids assertions.

## Reading it from another component: `useMutationState`

The pattern above needs the mutation and the list in one component. When they are not — a "new todo" dialog at the top of the tree, the list three levels down — the docs give the cross-component form, keyed by `mutationKey`:

> *"When the mutation and query exist in different components, use `useMutationState` with a `mutationKey`"*
>
> ```tsx
> const variables = useMutationState<string>({
>   filters: { mutationKey: ['addTodo'], status: 'pending' },
>   select: (mutation) => mutation.state.variables,
> })
> ```

Two things to read carefully.

**`mutationKey` is not a cache key.** A mutation has no cache entry and nothing dedupes it; `mutationKey` exists so filters like this one — and `setMutationDefaults` — can find it. The mutation must declare it (`useMutation({ mutationKey: ['addTodo'], … })`) or the filter matches nothing, silently, and your provisional row simply never appears.

**🔴 The result is an array, and the reason is this whole topic:**

> *"variables will be an `Array`, because there might be multiple mutations running at the same time."*

```tsx
function PendingTodos() {
  const pending = useMutationState<string>({
    filters: { mutationKey: ['addTodo'], status: 'pending' },
    select: (mutation) => mutation.state.variables as string,
  });

  // every in-flight add, not just the newest one
  return (
    <>
      {pending.map((text, i) => (
        <li key={`pending-${i}`} style={{ opacity: 0.5 }}>{text}</li>
      ))}
    </>
  );
}
```

Taking `pending[0]` is the mistake this sentence exists to prevent: submit three todos quickly and two of them are invisible until the server answers. Note also that `select` runs per matching mutation and returns that mutation's slice — `mutation.state.variables` here, but `mutation.state.status` or the whole `state` are equally valid, which is how you build a global "3 changes saving…" indicator.

## Where this approach stops

The docs draw the line themselves: `variables` for a single-location update, cache manipulation *"if you have multiple places on the screen that would require to know about the update."*

Concretely, go back to the cache when:

- **The same fact appears in two places.** Marking a notification read must change the list row *and* the unread badge. `useMutationState` can feed both, but each consumer now needs its own merge logic against its own query, and two ad-hoc merges are worse than one cache write.
- **The optimistic value must survive the component unmounting.** A provisional row rendered from `variables` disappears when its owner unmounts and reappears when it remounts, because the mutation is still running but nothing is rendering it. A cache write persists.
- **The change is an edit, not an insert.** Rendering a pending *addition* is appending one element. Rendering a pending *edit* means excluding the stale server row and substituting the pending value at the right position — reimplementing, in JSX, the merge that `setQueryData` does in one line.
- **A derived value must reflect it.** A total, a count, a sort order. Anything computed from the query's data is computed from data that does not contain your pending change.

⚠️ **The relative order of the hook-level callback and the `mutate()`-level callback is not stated in the documentation.** Both fire; which one runs first is not something I could confirm, so do not write code that depends on it — in particular, do not put a cache write in one and a read of that write in the other.

## Gotchas

**★ 🔴 `useMutationState` returns an array and the common bug is treating it as one value.** *"variables will be an `Array`, because there might be multiple mutations running at the same time."* `pending[0]` renders one provisional row for however many are in flight, so a fast typist sees the first submission and loses sight of the rest until the server answers. Map over it. This is also the clearest statement in the docs that concurrent mutations on one logical resource are expected, not exceptional.

**★ Without `mutationKey` on the mutation, the filter matches nothing and fails silently.** `useMutationState({ filters: { mutationKey: ['addTodo'] } })` returns an empty array when no mutation declares that key — not an error, not a warning. The symptom is a provisional row that never appears, which reads as "optimistic updates don't work" rather than "the filter is empty". Declare the key on the `useMutation` options, and keep it in the same shape you filter with.

**★ `variables` is `TVariables | undefined`, and it is `undefined` before the first call.** Any component rendering `mutation.variables` outside an `isPending` or `isError` branch has to handle the pre-first-mutation state. It also retains the *last* mutation's variables after settling, so `{variables && <li>{variables}</li>}` with no status guard renders a ghost row of the previous submission forever.

**★ The provisional row and the real row coexist for one refetch.** The mutation succeeds, `isPending` goes false, the row rendered from `variables` disappears — and the real row only arrives when the invalidation refetch resolves. Return the invalidation promise from `onSettled` and the mutation stays pending across that gap, so the provisional row survives until the real one exists. Omit the return and there is a visible frame with neither.

**★ A pending row rendered from `variables` needs a React `key` that will not collide with a real id.** The server has not assigned one. Prefixing (``key={`pending-${i}`}``) is enough for an append-only list; for anything reorderable, generate the id client-side in the component and pass it in `variables`, so the same identity carries through the mutation and matches the server row afterwards.

**★ Unmounting the component holding the mutation removes the optimistic UI but not the mutation.** The write continues — that is why the docs warn that call-site callbacks *"won't run if your component unmounts before the mutation finishes"* — but nothing is rendering `variables` any more, so the user's pending change appears to have been discarded. `useMutationState` at a stable level of the tree is the fix; the mutation state lives in the client, not the component.

**★ Mutations do not retry, so the `isError` branch is not optional polish.** With queries, a transient failure is invisible: three retries with exponential backoff usually succeed. With mutations, one failure is the end of it. If your optimistic UI drops the row on error without offering the user their text back, a flaky connection silently eats input — the single most common complaint about optimistic forms, and it is a default, not a bug.

**★ `useMutationState` re-renders its component on every matching mutation's state change.** Every transition of every mutation matching the filter flows through `select` into that component. Placing it high in the tree with a loose filter (no `mutationKey`, no `status`) makes an app-wide re-render source out of what looks like a read-only hook. Filter as narrowly as the feature allows and select the smallest slice you actually render.

**★ This approach does not remove the need for `onSettled` invalidation.** Nothing has written the cache, so the query still holds pre-mutation data — the provisional row was pure presentation. Without an invalidation, the moment `isPending` flips false the UI reverts to a list that does not contain the item that was just successfully created, until something else refetches.

## Interview questions

**★ Describe an optimistic update that has no rollback code, and explain why it does not need any.**
Render the pending value from the mutation itself: `{isPending && <li>{variables}</li>}` beside the rows from the query. Nothing writes the cache, so there is nothing to undo — on failure `isPending` goes false and the provisional row disappears, on success the invalidation refetch brings back the real row. Because the guess never enters the cache, it cannot be captured in another mutation's snapshot, cannot be erased by a concurrent invalidation refetch, and cannot survive as a wrong value if a rollback is skipped. The docs list it first for exactly that reason, and reserve cache manipulation for when *"you have multiple places on the screen that would require to know about the update."*

**★ Why does `useMutationState` return an array?**
Because *"there might be multiple mutations running at the same time"* — the same parallelism that makes cache-based optimistic updates hard. The hook applies your filter across the mutation cache and runs `select` on every match, so three in-flight `['addTodo']` mutations yield three variables. Reading index zero is the bug: it shows one provisional row for three submissions. Mapping over the array is also the correct UI, since each of those mutations really is a separate pending item the user created.

**★ Your provisional row never appears and there is no error anywhere. What do you check first?**
Whether the `useMutation` declares the `mutationKey` you are filtering on. `useMutationState` with a filter that matches nothing returns an empty array — no warning, no throw. After that, check the `status` in the filter (`'pending'` excludes an already-failed mutation, which is often the one you are trying to display) and check that the component calling `useMutationState` is inside the same `QueryClientProvider` as the one calling `mutate`.

**★ When is the `variables` approach the wrong choice?**
When the pending change has to be visible in more than one place, when it must survive the mutating component unmounting, when it is an edit rather than an insert, or when something derived — a count, a total, a sort — has to reflect it. All four are cases where you would be re-implementing, in render code, the merge that a single `setQueryData` performs against the one shared source of truth. The trade is real either way: the cache buys consistency across the screen and costs you the entire rollback and concurrency problem.

**★ How does the retry asymmetry between queries and mutations change your optimistic UI?**
Queries retry three times with exponential backoff, so a transient read failure is usually invisible. *"By default, TanStack Query will not retry a mutation on error"*, so a transient write failure is final and the user is the retry mechanism. That makes the `isError` render branch load-bearing rather than decorative: keep the row, keep `variables`, and offer a button that calls `mutate(variables)` again. A cache-based optimistic update that rolls back on error throws the user's input away at exactly the moment they most need it back.

**★ Do hook-level and call-site callbacks fire in a defined order?**
Both fire — the hook's `onSuccess`/`onError`/`onSettled` and any passed to `mutate(variables, { … })` — but **the documentation does not state which runs first**, and I could not confirm it. Treat the order as unspecified: never have one callback write state that the other reads. The difference that *is* documented is lifetime — *"those additional callbacks won't run if your component unmounts before the mutation finishes"* — so anything that must happen belongs on the hook regardless of ordering.

---

← [Concurrent mutations on one key](01b-concurrent-mutations-on-one-key.md) · [Topic index](../README.md) · Next → [Optimistic writes against infinite queries](01d-optimistic-writes-on-infinite-queries.md)
