---
title: "Query Cancellation: Automatic Unmount Cancellation & Manual `signal` Usage"
sidebar_label: "Query Cancellation"
sidebar_position: 1
---

# 🔄 Query Cancellation: Automatic Unmount Cancellation & Manual `signal` Usage

## 1. Under-The-Hood Mechanics

TanStack Query automatically cancels in-flight requests under specific circumstances — but this automatic behavior only takes effect if the `queryFn` itself cooperates by actually using the `AbortSignal` it's given.

```
useQuery({ queryKey, queryFn: ({ signal }) => fetch(url, { signal }) })
                                    │
                                    └── TanStack Query passes an AbortSignal into queryFn automatically
        │
        ▼
Automatic cancellation triggers:
  - the component UNMOUNTS while the query is still in flight
  - the queryKey CHANGES (e.g. a search term updates) before the previous request resolved
        │
        ▼
IF queryFn passed `signal` into its actual fetch() call ──► the REAL network request is aborted,
                                                                 server stops processing, browser
                                                                 stops waiting for the response
IF queryFn IGNORES `signal`                                  ──► TanStack Query stops WAITING for the
                                                                     result, but the underlying network
                                                                     request keeps running to completion anyway
```

### Why Ignoring `signal` Doesn't Cause Bugs, But Does Waste Resources
Even if a `queryFn` never uses `signal`, TanStack Query's own internal bookkeeping still correctly discards a now-irrelevant result when it eventually arrives (no stale-data bugs from this specifically) — but the actual network request, and whatever server-side processing it triggered, continues running to completion regardless, wasting bandwidth and server resources for a result nobody will ever use. Threading `signal` through to the actual `fetch()` call is what makes cancellation **genuinely** stop the underlying work, not just TanStack Query's own internal waiting.

### Automatic Cancellation on Query Key Change: Avoiding a Race Condition
When a search input's query key changes on every keystroke (`['search', term]`), each new term triggers a new fetch — without cancellation, several requests for different, now-superseded search terms could all be in flight simultaneously, and an OLDER, slower request resolving AFTER a newer one would risk showing stale results (the exact race condition covered in the JS browser APIs doc). TanStack Query's automatic query-key-change cancellation means the superseded request is aborted the moment a new one starts, as long as the `queryFn` cooperates with `signal`.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Search-As-You-Type Feature Reducing Server Load Significantly Once `signal` Was Threaded Through.
A search feature's `queryFn` made a `fetch()` call but didn't pass `signal` into it — every keystroke's request continued running to completion server-side, even though TanStack Query itself correctly discarded each superseded result client-side, meaning the actual backend search index was doing full work for every single keystroke of every user's search session, most of it entirely wasted on now-irrelevant, already-superseded queries. Passing `signal` into the underlying `fetch()` call meant a genuinely real HTTP-level abort was sent for every superseded request — the browser stopped waiting, and (for a server respecting the abort) the backend stopped processing too, meaningfully reducing real server load during heavy search usage.

---

## 3. Production-Grade Code Example

```typescript
// Correctly threading `signal` through to the actual fetch() call
function useSearchResults(term: string) {
  return useQuery({
    queryKey: ['search', term],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/search?q=${term}`, { signal }); // signal genuinely propagated
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: term.length > 0,
  });
}
```

```tsx
// Demonstrating automatic cancellation on rapid query key changes (rapid typing)
function SearchBox() {
  const [term, setTerm] = useState('');
  const { data, isFetching } = useSearchResults(term);
  // Each keystroke changes the queryKey (['search', term]) — TanStack Query automatically
  // aborts the PREVIOUS in-flight request (since queryFn passes `signal` through) the
  // instant a new one starts, avoiding both wasted server work AND any stale-result race

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
// Axios equivalent — signal works the same way with any fetch-compatible or AbortSignal-aware client
function useSearchResultsAxios(term: string) {
  return useQuery({
    queryKey: ['search', term],
    queryFn: ({ signal }) => axios.get(`/api/search?q=${term}`, { signal }).then((res) => res.data),
  });
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting to Pass `signal` Into the Actual Network Call
```typescript
// ❌ WASTEFUL: TanStack Query's internal cancellation logic still discards the result
// correctly, but the REAL network request/server processing continues to completion,
// unaware it was ever "cancelled" at all
queryFn: async () => {
  const res = await fetch(`/api/search?q=${term}`); // ❌ signal never passed — no real cancellation happens
  return res.json();
},

// ✅ CORRECT: thread signal through so cancellation genuinely stops the underlying work
queryFn: async ({ signal }) => {
  const res = await fetch(`/api/search?q=${term}`, { signal });
  return res.json();
},
```

### ⚠️ Pitfall 2: Treating an `AbortError` as a Genuine Application Error
```typescript
// ❌ WRONG: a cancelled request throws an AbortError — treating this the SAME as a genuine
// network/server failure can trigger unnecessary error UI/retries for what's actually
// EXPECTED, benign behavior (a superseded, intentionally-cancelled request)
queryFn: async ({ signal }) => {
  const res = await fetch(url, { signal });
  return res.json(); // an AbortError here propagates as if it were a REAL failure
},

// ✅ AWARENESS: TanStack Query already handles AbortError specially internally (it does NOT
// treat a cancelled query as a genuine error state) — but custom retry/error-handling logic
// layered on top should be aware of this distinction too, if it inspects errors directly
```

### ⚠️ Pitfall 3: Manually Managing Cancellation Elsewhere, Duplicating What TanStack Query Already Provides
```typescript
// ❌ REDUNDANT: hand-rolling a separate AbortController lifecycle OUTSIDE of queryFn's
// automatically-provided signal reimplements what TanStack Query already manages correctly
const controller = new AbortController();
useEffect(() => { return () => controller.abort(); }, []); // duplicate, unnecessary cancellation management

// ✅ CORRECT: rely on the signal TanStack Query ALREADY passes into queryFn — no separate,
// manually-managed AbortController needed for queries specifically
```
