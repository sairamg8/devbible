---
title: "Seeding a detail view from a list row is where the cache-write/render-value distinction stops being academic — and hydration, `dataUpdatedAt` and suspense each break the pair in a different direction"
sidebar_label: "01e2 · Seeding, hydration & suspense"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Initial Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/initial-query-data), [Placeholder Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data), [Advanced SSR](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr), [Suspense](https://tanstack.com/query/latest/docs/framework/react/guides/suspense), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5), [`QueryClient`](https://tanstack.com/query/latest/docs/reference/QueryClient). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# 🧬 Seeding From a List, Hydration, and the Query That Has No Placeholder

**[`01e`](./01e-initialdata-vs-placeholderdata.md) established the sentence: `initialData` is a cache write, `placeholderData` is not.** This page runs it through the four situations where the distinction stops being a definition and becomes a decision — seeding a detail view from a list you already fetched, choosing between `initialData` and `HydrationBoundary` for server-rendered data, reading `dataUpdatedAt` when a placeholder is on screen, and discovering that under suspense one half of the pair does not exist at all.

## 1. The classic pattern: a detail view seeded from a list row

Master/detail is the pattern everybody writes and the one where both options look defensible. The list is already in the cache; the user clicks a row; the detail view could render immediately instead of spinning. Here are both ports of the same intention.

```tsx
// PORT A — initialData: the row goes INTO the detail cache entry
function TodoDetail({ todoId }: { todoId: string }) {
  const queryClient = useQueryClient();

  const todo = useQuery({
    queryKey: ['todo', todoId],
    queryFn: () => fetchTodo(todoId),
    initialData: () => queryClient.getQueryData<Todo[]>(['todos'])?.find((t) => t.id === todoId),
    initialDataUpdatedAt: () => queryClient.getQueryState(['todos'])?.dataUpdatedAt,
    staleTime: 30_000,
  });

  return <TodoCard todo={todo.data} />;
}
```

```tsx
// PORT B — placeholderData: the row is DISPLAYED, the cache entry stays empty
function TodoDetail({ todoId }: { todoId: string }) {
  const queryClient = useQueryClient();

  const todo = useQuery({
    queryKey: ['todo', todoId],
    queryFn: () => fetchTodo(todoId),
    placeholderData: () => queryClient.getQueryData<Todo[]>(['todos'])?.find((t) => t.id === todoId),
    staleTime: 30_000,
  });

  return <TodoCard todo={todo.data} provisional={todo.isPlaceholderData} />;
}
```

### Which is right, and why it is usually B

**The list row is almost never the detail shape.** `GET /todos` returns `id`, `title`, `done`. `GET /todos/:id` returns those plus `description`, `comments`, `assignee`, `history`. Port A writes a `Todo` **partial** into `['todo', todoId]`, and the guide's warning is precisely about that:

> *"`initialData` is persisted to the cache, so it is not recommended to provide placeholder, partial or incomplete data."*

Three things then go wrong, in order of how long they take to be noticed:

1. **Every other observer of `['todo', todoId]` reads the partial.** A breadcrumb, a modal, a `getQueryData` in a mutation's `onMutate` — none of them passed `initialData`, all of them get the truncated record.
2. **The type is a lie.** `useQuery` types `data` from the `queryFn`'s return, so `todo.data.description` compiles and is `undefined` at runtime. TypeScript signs off on the seed because you cast the shapes into agreement to make the `find` type-check in the first place.
3. **🔴 The fetch that would have repaired it may never happen.** `staleTime: 30_000` plus a seed whose age is inherited from a list fetched five seconds ago means the entry is fresh, and a fresh entry is not refetched. The partial is the final answer for the rest of the window.

Port B has none of these. The partial is rendered and never stored, `isPlaceholderData` marks it so `TodoCard` can hide the fields it knows are missing, the cache entry stays empty so nothing else can read the guess, and the fetch is unconditional — `staleTime` has no entry to evaluate.

**Port A is right when the list row genuinely is the whole record.** A lookup table, a settings row, a flat entity with no expansion on the detail endpoint. Then the write is a benefit: the next component to observe that key gets a cache hit rather than a request, which is the entire point of putting it there. The test is not "do I have data" but "would I be happy for a component I have never read to render this value as fetched?"

The dependent-chain variant of this decision — where the key itself is derived from another query's data — is [`08/01f`](../08-dependent-and-parallel-queries/01f-placeholder-and-initial-data-in-a-chain.md) and [`08/01g`](../08-dependent-and-parallel-queries/01g-placeholderdata-in-a-chain.md).

## 2. `initialData` from SSR versus `HydrationBoundary`

Both put server data into the client. They are not the same tool and the difference is scope.

`initialData` is **per hook**. You serialise the data, thread it down as a prop or read it from a global bootstrap object, and pass it to one `useQuery` call. It is a manual, explicit seed of one key, and it inherits everything from [`01e`](./01e-initialdata-vs-placeholderdata.md) §3: with no `initialDataUpdatedAt` the server's data claims to have been fetched in the browser, just now.

`HydrationBoundary` is **per cache**. The server dehydrates a `QueryClient` and the boundary rehydrates the whole set of entries at once — every key that was prefetched, with its state, and without any component having to know it was seeded.

> *"HydrationBoundary is a Client Component, so hydration will happen there."*

> *"Server: always make a new query client"*

> *"With SSR, we usually want to set some default staleTime above 0 to avoid refetching immediately on the client"*

That last line is the one that connects the two. A dehydrated entry carries its own state across, so the client's staleness calculation has something real to work with; an `initialData` seed carries nothing unless you supply `initialDataUpdatedAt` yourself. **`initialDataUpdatedAt` is the manual re-implementation of the one thing hydration gives you for free.**

Practical rule: if you are server-rendering more than one or two queries, use prefetch + dehydrate + `HydrationBoundary` and stop threading props. Reserve `initialData` for a single value you happen to have — a bootstrap payload, a config blob, a record embedded in the document — where standing up a server-side `QueryClient` would be more machinery than the case deserves. The full SSR flow is [09 · Prefetching & SSR](../09-prefetching-and-ssr/01-server-rendered-data-flow.md).

🔴 **`useHydrate` and the `Hydrate` component are gone in v5** — *"the `Hydrate` component has been renamed to `HydrationBoundary` and the `useHydrate` hook has been removed"*. A v4 SSR page copied forward will not compile against the current import.

## 3. What each does to `dataUpdatedAt`

`dataUpdatedAt` is the entry's timestamp — the value the staleness calculation reads, exposed both on the hook result and through `queryClient.getQueryState(key)?.dataUpdatedAt`. It is also the value you pass forward when seeding one query from another, as Port A does above.

For `initialData`, the timestamp is what `initialDataUpdatedAt` sets, and in its absence the seed behaves as *"totally fresh, as if it were just fetched"*. That is the whole content of §3 in [`01e`](./01e-initialdata-vs-placeholderdata.md), viewed from the cache's side rather than the option's.

⚠️ **For `placeholderData` I could not confirm what `dataUpdatedAt` reports while the placeholder is on screen.** There is no cache entry with data, so there is no fetch timestamp to report, but no sentence in the Initial Query Data or Placeholder Query Data guides states the value — and the hook's own reference page does not exist on the current docs site. Do not build cache-age logic on `dataUpdatedAt` while `isPlaceholderData` is `true`; branch on the flag instead, and verify against the version you install if you need the number.

The safe rule that does not depend on the unknown: **`isPlaceholderData` is the authoritative "this is not real" signal, and `dataUpdatedAt` is only meaningful once it is `false`.**

## 4. Under suspense, `placeholderData` does not exist

`useSuspenseQuery` removes the option outright:

> *"`placeholderData` also doesn't exist for this Query. To prevent the UI from being replaced by a fallback during an update, wrap your updates that change the QueryKey into [startTransition](https://react.dev/reference/react/Suspense#preventing-unwanted-fallbacks)."*

The reason is structural. `placeholderData` exists to stop a key change collapsing the UI to a loading state; under suspense the loading state is a React fallback, and React already owns the mechanism for suppressing it. Keeping the previous UI on screen during a key change is `startTransition`'s job, not the query layer's.

```tsx
import { startTransition, useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

function PaginatedTodos() {
  const [page, setPage] = useState(1);
  const { data } = useSuspenseQuery({ queryKey: ['todos', page], queryFn: () => fetchTodos(page) });

  return (
    <>
      <TodoTable rows={data} />
      {/* without startTransition, this unmounts the table and shows the Suspense fallback */}
      <button onClick={() => startTransition(() => setPage((p) => p + 1))}>Next</button>
    </>
  );
}
```

**`initialData` survives suspense**, because it is a cache write and the suspense hooks read the same cache. A key whose entry is already populated does not suspend at all — which makes `initialData` (and prefetching) the way to avoid a fallback on first render under suspense, where `placeholderData` is not available to you. The rest of what suspense removes is [`10/01b`](../10-suspense-integration/01b-what-suspense-mode-removes.md).

⚠️ `enabled` is gone under suspense too — *"you therefore can't conditionally enable / disable the Query"* — which removes the gated-query interaction described in [`01b`](./01b-enabled-and-skiptoken.md). The `initialData`-written-behind-a-closed-gate case simply cannot arise there.

## Gotchas

**★ Symptom: a detail page shows a record with half its fields blank, and refreshing does not fix it.** Cause: `initialData` seeded from a list row, and the list row is a partial of the detail shape — *"not recommended to provide placeholder, partial or incomplete data"*. The partial went into the cache; `staleTime` then declared it fresh; the repairing fetch never ran. Fix: `placeholderData` for the same seed, so the partial renders but never persists and the fetch is unconditional. If you keep `initialData`, the seed must be the complete record.

**★ Symptom: TypeScript is happy and `data.description` is `undefined` at runtime.** Cause: to make `initialData: () => list.find(...)` type-check against a detail type, someone widened a type or added a cast, so the compiler now believes a `Todo` list row is a `TodoDetail`. Fix: type the list query as its own shape and let the mismatch be a compile error — it is telling you the truth. If the shapes really differ, that is the argument for `placeholderData` and a `provisional` prop on the card.

**★ Symptom: seeding works when you click through from the list and not when you deep-link.** Cause: `queryClient.getQueryData(['todos'])` returns `undefined` because the list was never fetched in this session, or was collected — the default `gcTime` for an unused query is five minutes. Fix: nothing; that is correct behaviour, and returning `undefined` from the seed function is how you say "no seed". The bug to avoid is an unguarded `.find(...)` on the `undefined`.

**★ Symptom: SSR data renders instantly and then flashes as it is replaced.** Cause: the client refetched immediately on mount, because the hydrated or seeded entry was stale on arrival — *"With SSR, we usually want to set some default staleTime above 0 to avoid refetching immediately on the client"*. Fix: set a non-zero default `staleTime` on the client's `QueryClient`, and — if you used `initialData` rather than hydration — pass `initialDataUpdatedAt` so the window is measured from the server render rather than from mount.

**★ Symptom: a v4 SSR page fails to build after the v5 upgrade with an unresolved import.** Cause: *"the `Hydrate` component has been renamed to `HydrationBoundary` and the `useHydrate` hook has been removed"*. Fix: import `HydrationBoundary` and delete the `useHydrate` call; there is no hook replacement, the component is the API.

**★ Symptom: adding `placeholderData` to a `useSuspenseQuery` does nothing and no error appears.** Cause: the option *"doesn't exist for this Query"* under suspense. An unknown option is not a runtime error, so the code reads as if it should work. Fix: wrap the state update that changes the key in `startTransition`; that is the documented replacement for the behaviour you were reaching for.

**★ Symptom: under suspense, the first paint of a route always shows the fallback even though the data was prefetched.** Cause: the prefetch wrote a different key than the component reads, so the entry the hook looks up is empty and it suspends. Fix: share the key through a `queryOptions` factory rather than writing the array literal twice — the prefetch and the hook must hash identically, and *"Query Keys are hashed deterministically!"* means a single differing element is a different query.

**★ Symptom: a piece of "cache age" UI ("updated 3 minutes ago") reads wrong on first render.** Cause: it is reading `dataUpdatedAt` while a placeholder is displayed, and there is no fetch behind that value. Fix: render the age only when `isPlaceholderData` is `false`. ⚠️ What the field actually reports during a placeholder is not stated in the guides — do not reverse-engineer a rule from one observation.

## Interview questions

**★ You need a detail page to render instantly from a row already in a cached list. Talk me through the choice.**
Start with the shape. If the detail endpoint returns strictly more than the list row does, the row is *partial* data, and the guide is explicit that partial data does not belong in `initialData` because it is persisted. So `placeholderData` — the row renders, `isPlaceholderData` lets the card hide or grey the fields it knows are missing, nothing is written, and the real fetch happens unconditionally. If the list row genuinely is the entire record, `initialData` is better, because the write is a benefit: every other observer of that key gets a cache hit instead of a request. In that case pair it with `initialDataUpdatedAt` read from `getQueryState(['todos'])?.dataUpdatedAt`, so the detail entry inherits the list's age rather than claiming to be brand new.

**★ What actually goes wrong when a partial record is written into a detail cache entry?**
Three things, and they surface at different times. Immediately, any other observer of that key — a breadcrumb, a modal, a `getQueryData` inside `onMutate` — renders the partial as if it were fetched, because there is nothing in the cache that distinguishes it. Soon after, the type system stops helping, since `data` is typed from the `queryFn` and the missing fields are `undefined` at runtime while compiling fine. And the repair may never arrive: `initialData` is *"treated as totally fresh"*, so any non-zero `staleTime` suppresses the fetch that would have replaced the partial with the whole record.

**★ `initialData` or `HydrationBoundary` for server-rendered data?**
Scope decides. `initialData` seeds one hook and needs the value threaded to that hook, so it suits a single bootstrap payload where standing up a server-side `QueryClient` is more machinery than the case earns. `HydrationBoundary` restores an entire dehydrated cache — every prefetched key at once, with its state, and with no component knowing it was seeded — which is the right shape as soon as you have more than a couple of queries. The load-bearing difference is provenance: a dehydrated entry brings its own timestamp, whereas an `initialData` seed claims to have been fetched in the browser unless you pass `initialDataUpdatedAt` yourself. That option is the manual version of what hydration does for free.

**★ Why is there no `placeholderData` under suspense, and what do you use instead?**
Because the two mechanisms would be solving the same problem in different layers. `placeholderData` exists to stop a key change from collapsing the UI into a loading state; under suspense the loading state is a React fallback, and React's own tool for suppressing a fallback during an update is `startTransition`. The docs say so directly — *"`placeholderData` also doesn't exist for this Query. To prevent the UI from being replaced by a fallback during an update, wrap your updates that change the QueryKey into startTransition"*. So: wrap the `setPage`. Note that `initialData` is unaffected, because it writes to the cache and a populated key does not suspend at all — which makes it, and prefetching, the way to avoid a first-render fallback.

**★ Can you tell from the outside whether a value in the cache came from `initialData` or from the network?**
No, and that is the design, not a gap. Once `initialData` is persisted, it is the query's data — there is nothing left to distinguish. The contrast with `isPlaceholderData` is the proof: the library can flag placeholder data precisely because that data never entered the cache. If your application needs to know a value was seeded, the marker has to live in your own data shape or in a separate key, because no library flag will tell you.

**★ Under what circumstances would you deliberately want `initialData` to suppress the fetch?**
When you have data that is both complete and demonstrably current, and a request would be pure cost — a config blob written into the document by the same server process that would answer the API call, or a value you just received from a mutation response. Then `initialData` plus a `staleTime` covering the period you trust it is the correct configuration, and the suppressed fetch is the feature. What makes it a bug in the common case is not the suppression but the false provenance: the seed had an age nobody declared. Declare it with `initialDataUpdatedAt` and the suppression becomes a decision the library makes on evidence rather than one you made by accident.

---

← [`initialData` vs `placeholderData`](./01e-initialdata-vs-placeholderdata.md) · [Topic index](../README.md) · Next → [`select`](./01f-select.md)
