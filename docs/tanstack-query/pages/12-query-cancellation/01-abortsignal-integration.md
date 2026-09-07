---
title: "Query Cancellation: `AbortSignal`, What Is Automatic & What Is Not"
sidebar_label: "Query Cancellation"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the TanStack Query docs — [Query Cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation), [`QueryClient`](https://tanstack.com/query/latest/docs/reference/QueryClient), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-07 · claims + output provenance · session 352cf446

# 🔄 Query Cancellation: `AbortSignal`, What Is Automatic & What Is Not

## 1. Under-The-Hood Mechanics

TanStack Query hands every `queryFn` an `AbortSignal` and aborts it at well-defined moments — but the signal being aborted and the *query* being cancelled are two different events, and only one of them happens on its own.

```
useQuery({ queryKey, queryFn: ({ signal }) => fetch(url, { signal }) })
                                    │
                                    └── the signal is passed in automatically, always
        │
        ▼
"When a query becomes out-of-date or inactive, this `signal` will become aborted."
        │
        ├── queryFn CONSUMED the signal ──► fetch() rejects with AbortError ──► the promise is
        │                                     cancelled, "and therefore, also the Query must be
        │                                     cancelled" — real network abort, nothing cached
        │
        └── queryFn IGNORED the signal  ──► the request runs to completion, and
                                              🔴 "after the promise has resolved, the resulting
                                              data will be available in the cache."
```

### 🔴 Unmounting does not cancel anything

This is the sentence that overturns the common mental model, and it is stated flatly in the guide:

> *"queries that unmount or become unused before their promises are resolved are _not_ cancelled."*

There is no unmount-cancellation feature to rely on. What the library gives you is an aborted signal at the right moment; **consuming it is the mechanism**, not an optimisation on top of one. The guide closes the loop explicitly: *"if you consume the `AbortSignal`, the Promise will be cancelled (e.g. aborting the fetch) and therefore, also the Query must be cancelled."* Cancellation propagates upward from your `fetch`, not downward from the library.

### 🔴 Ignoring `signal` is not merely wasteful — the result still lands in the cache

The tempting summary is "the request keeps running, but the library throws the answer away". The guide says otherwise: *"after the promise has resolved, the resulting data will be available in the cache."* So a superseded request that you never aborted is not inert. It resolves, it is written under its own key, and anything observing that key sees it.

Whether that is visible depends on the shape of the key. Search-as-you-type keyed on `['search', term]` writes each result under its own term, so a late arrival lands on a key nobody is watching any more — invisible, but still memory and still server load. A query whose key does *not* change between attempts — a refetch of `['dashboard']`, a retry after a network blip — writes to the key you are looking at, and a slow earlier response can be the one that wins.

### Manual cancellation, and the part that matters for optimistic updates
> *"you just need to call `queryClient.cancelQueries({ queryKey })`, which will cancel the query and revert it back to its previous state."*

The **revert** is why `cancelQueries` appears in every optimistic-update recipe. It is not only stopping a request; it is putting the query back to where it was, so the `setQueryData` write that follows in `onMutate` is not racing a half-applied fetch.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Search-As-You-Type Feature Reducing Server Load Significantly Once `signal` Was Threaded Through.
A search feature's `queryFn` made a `fetch()` call but didn't pass `signal` into it — every keystroke's request continued running to completion server-side, and each one resolved into the cache under its own `['search', term]` key, so the backend search index was doing full work for every keystroke of every user's session, nearly all of it for terms already superseded. Passing `signal` into the underlying `fetch()` call meant a genuinely real HTTP-level abort was sent for every superseded request — the browser stopped waiting, the entries stopped being written, and for a server that respects a client disconnect the backend stopped processing too, meaningfully reducing real load during heavy search usage.

---

## 3. Production-Grade Code Example

```typescript
// Correctly threading `signal` through to the actual fetch() call
function useSearchResults(term: string) {
  return useQuery({
    queryKey: ['search', term],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal });
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: term.length > 0,
  });
}
```

```tsx
// Rapid typing: each keystroke changes the queryKey, so the previous query goes
// out-of-date and ITS signal is aborted. Because queryFn consumed the signal, the
// in-flight fetch rejects and the query is cancelled — no late write to the cache.
function SearchBox() {
  const [term, setTerm] = useState('');
  const { data, isFetching } = useSearchResults(term);

  return (
    <div>
      <input value={term} onChange={(e) => setTerm(e.target.value)} />
      {isFetching && <SmallSpinner />}
      <SearchResultsList results={data} />
    </div>
  );
}
```

```typescript
// Axios — signal works the same way with any AbortSignal-aware client
function useSearchResultsAxios(term: string) {
  return useQuery({
    queryKey: ['search', term],
    queryFn: ({ signal }) => axios.get(`/api/search?q=${term}`, { signal }).then((res) => res.data),
  });
}
```

```typescript
// Manual cancellation — and the revert that optimistic updates depend on
onMutate: async (postId) => {
  // "will cancel the query and revert it back to its previous state"
  await queryClient.cancelQueries({ queryKey: ['post', postId] });
  const previousPost = queryClient.getQueryData<Post>(['post', postId]);
  queryClient.setQueryData<Post>(['post', postId], (old) =>
    old ? { ...old, likes: old.likes + 1 } : old,
  );
  return { previousPost };
},
```

```typescript
// A queryFn that composes work still has ONE signal to thread — pass it to every leg
queryFn: async ({ signal }) => {
  const [profile, prefs] = await Promise.all([
    fetch('/api/profile', { signal }).then((r) => r.json()),
    fetch('/api/prefs', { signal }).then((r) => r.json()), // ❌ omitting it here leaks this one
  ]);
  return { profile, prefs };
},
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Believing Unmount Cancels the Request
```typescript
// ❌ WRONG MODEL: "the component unmounted, so the request was cancelled".
// "queries that unmount or become unused before their promises are resolved are not cancelled."
queryFn: async () => {
  const res = await fetch(`/api/search?q=${term}`); // no signal — nothing is cancelled, ever
  return res.json();
},

// ✅ CORRECT: consuming the signal is what makes cancellation happen at all
queryFn: async ({ signal }) => {
  const res = await fetch(`/api/search?q=${term}`, { signal });
  return res.json();
},
```

### ⚠️ Pitfall 2: Assuming an Un-Cancelled Result Is Discarded
```typescript
// ❌ The reassuring version of the bug: "the library throws away superseded results anyway".
// It does not — "after the promise has resolved, the resulting data will be available in
// the cache." On a key that does not change between attempts, a slow earlier response can
// be the one that lands last and wins.
```

### ⚠️ Pitfall 3: Treating an `AbortError` as a Genuine Application Error
```typescript
// A cancelled request rejects with an AbortError. Custom error plumbing — a global error
// toast, a Sentry hook, a hand-written retry wrapper INSIDE queryFn — will see it and
// report a failure for something that was deliberate and expected.
queryFn: async ({ signal }) => {
  try {
    const res = await fetch(url, { signal });
    return res.json();
  } catch (err) {
    // ❌ swallowing it here converts a cancellation into a resolved query with no data
    reportToSentry(err);
    throw err;
  }
},
// ✅ let an AbortError propagate untouched, or filter on `signal.aborted` before reporting
```

### ⚠️ Pitfall 4: Hand-Rolling a Second `AbortController`
```typescript
// ❌ REDUNDANT: a separate controller outside queryFn duplicates the lifecycle the library
// already manages, and the two can disagree — yours aborts on unmount, which the library
// deliberately does not do, so a refetch after a remount can start already-aborted
const controller = new AbortController();
useEffect(() => () => controller.abort(), []);

// ✅ CORRECT: use the signal queryFn is handed. For deliberate cancellation from outside,
// the API is queryClient.cancelQueries({ queryKey })
```

---

## Gotchas

**★ 🔴 Unmounting does not cancel the request.** *"Queries that unmount or become unused before their promises are resolved are not cancelled."* Nearly every developer arriving from a hand-written `useEffect` + `AbortController` pattern assumes the opposite, because that pattern *did* abort on unmount. What the library guarantees is that the signal is aborted at the right moment — *"When a query becomes out-of-date or inactive, this signal will become aborted"* — and that is inert unless your `queryFn` is listening to it.

**★ 🔴 An un-cancelled request still writes to the cache.** The comfortable half-truth is that the library discards superseded results. It does not: *"after the promise has resolved, the resulting data will be available in the cache."* Whether that hurts depends on the key. Under `['search', term]` the late result lands on a key nobody observes, so it is only waste. Under a key that is the same across attempts, the late result is written where you are looking — and the last write wins, which is the classic out-of-order race arriving through a library people assume prevents it.

**★ Cancellation propagates upward, not downward.** *"If you consume the AbortSignal, the Promise will be cancelled (e.g. aborting the fetch) and therefore, also the Query must be cancelled."* Read the direction carefully: your `fetch` rejecting is the cause and the query's cancellation is the effect. There is no library-level switch to turn cancellation on, which is why the fix for "cancellation isn't working" is always in the `queryFn` and never in the options.

**★ `cancelQueries` reverts, and that is the point in an optimistic update.** It *"will cancel the query and revert it back to its previous state"*, so it is not only a stop signal — it restores the entry before your `onMutate` writes over it. That is why the recipe awaits it *first*: without it, a refetch that was already resolving can land on top of the optimistic write and undo it.

**★ One signal, every leg of the request.** A `queryFn` that fires several requests gets a single signal, and each call has to receive it. Passing it to the first `fetch` in a `Promise.all` and forgetting the second leaves that one running after cancellation, so the network panel still shows a pending request and the "cancellation doesn't work" report is half right.

**★ An `AbortError` reaches your own error handling.** A cancelled fetch rejects, so any `try`/`catch` inside `queryFn`, any global error reporter, and any hand-written retry wrapper sees it. Catching it and returning a fallback is the worst outcome: it converts a cancellation into a successful query holding empty data, which is then cached. Let it propagate, or check `signal.aborted` before reporting.

**★ The server has to cooperate for the load saving to be real.** Aborting is a client-side act; whether the backend stops working depends on it noticing the disconnect. A Node handler streaming a response will typically see it, a query already executing in the database usually will not, and anything that has already been enqueued for background work certainly will not. The bandwidth and the cache write are saved either way — the server-side saving is a reasonable expectation, not a guarantee.

**★ Cancellation and `enabled` solve different problems.** `enabled: false` stops the request from being made; cancellation stops one already in flight. Search-as-you-type usually needs both — `enabled` to avoid firing on an empty box, `signal` to abort the one still running when the next keystroke arrives — and debouncing is a third, separate lever that reduces how many are started at all.

## Interview questions

**★ A user navigates away mid-request. Was the request cancelled?**
No — *"queries that unmount or become unused before their promises are resolved are not cancelled."* If the `queryFn` consumed the signal, then whenever that query goes out-of-date or inactive the signal aborts, the fetch rejects, and the query is cancelled as a consequence. If it did not, the request runs to completion and the result is written to the cache. The distinction matters in review because "we unmount, so it's fine" is a very common and confident wrong answer.

**★ What actually breaks if a `queryFn` ignores `signal`?**
Three things, in increasing severity. Bandwidth and server work are spent on a result nobody asked for any more. The resolved value is written into the cache — *"the resulting data will be available in the cache"* — so it is retained memory, not a discarded response. And on any key that is stable across attempts, an older, slower response can resolve after a newer one and become the value on screen, which is the out-of-order race people assume the library already handles.

**★ How does cancellation actually get triggered?**
By your own code, indirectly. The library aborts the signal when a query becomes out-of-date or inactive; the `fetch` you gave that signal to then rejects; and *"therefore, also the Query must be cancelled"*. The causation runs from your request outward, which is why there is no option to enable and why a `queryFn` that never touches `signal` can never be cancelled no matter how it is configured.

**★ Why does `onMutate` await `cancelQueries` before writing?**
Because `cancelQueries` *"will cancel the query and revert it back to its previous state"*, and both halves matter. Cancelling stops an in-flight refetch that would otherwise resolve after the optimistic write and overwrite it with pre-mutation data. Reverting guarantees the entry you then snapshot with `getQueryData` is a settled value rather than something mid-flight. Not awaiting it reintroduces the race, intermittently — which reads in a bug report as "the like count flickers back sometimes".

**★ Your `queryFn` makes three parallel calls. What do you have to be careful about?**
The single signal has to reach all three. It is handed to `queryFn` once, and each `fetch` or client call needs it passed explicitly; omitting it on one leg leaves that request running past cancellation. The symptom is partial: the network panel still shows a pending request after the component is gone, and load on that one endpoint never drops, while the other two behave correctly — which makes it look like a server problem rather than a missing argument.

**★ Should you catch errors inside `queryFn`?**
Be careful, because a cancellation arrives as a rejection there. A blanket `catch` that logs and returns a fallback turns an intentional abort into a successful query holding empty data, which is then cached and rendered — strictly worse than the failure it was trying to smooth over. If you need error handling inside `queryFn`, let `AbortError` through untouched, or check `signal.aborted` before deciding it was a real failure.

**★ Does aborting actually reduce backend load?**
Sometimes, and it is worth being honest about which parts are guaranteed. The client stops waiting and the cache write does not happen — those are certain. Whether the server stops working depends on it observing the disconnect: a handler still writing a response usually will, a query already running in the database usually will not, and anything already queued for asynchronous processing will not. Threading `signal` is still right, because the client-side guarantees alone justify it; promising a proportional drop in server cost does not.

---

← [DevTools](../11-devtools/01-react-query-devtools.md) · [Topic index](../README.md) · Next → [Global Configuration](../13-global-configuration/01-defaultoptions.md)
