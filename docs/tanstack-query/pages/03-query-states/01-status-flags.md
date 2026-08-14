---
title: "Query States: `status` vs `fetchStatus` & the Loading Flag Family"
sidebar_label: "Query States"
sidebar_position: 1
---

# 🔄 Query States: `status` vs `fetchStatus` & the Loading Flag Family

## 1. Under-The-Hood Mechanics

TanStack Query tracks **two independent state dimensions** simultaneously — whether data is available at all, and whether a network request is currently active — a distinction that resolves most confusion about which loading flag to actually check.

```
status: 'pending' | 'error' | 'success'      ──► DATA AVAILABILITY: do we have usable data (or an error) at all?
fetchStatus: 'fetching' | 'paused' | 'idle'     ──► NETWORK ACTIVITY: is a request CURRENTLY in flight right now?

These are INDEPENDENT axes — all four combinations are meaningful:
  status: 'success', fetchStatus: 'idle'       ──► have data, nothing currently fetching (the common resting state)
  status: 'success', fetchStatus: 'fetching'      ──► have (POSSIBLY STALE) data, a BACKGROUND refetch is in progress
  status: 'pending', fetchStatus: 'fetching'         ──► the FIRST-EVER load — no data yet, actively fetching
  status: 'pending', fetchStatus: 'paused'              ──► no data yet, fetch is PAUSED (e.g. offline, no network)
```

### The Derived Boolean Flags: Each Answers a Different Question
- **`isPending`** — `status === 'pending'` — true only when there's genuinely no data yet (first load, or a reset cache).
- **`isFetching`** — `fetchStatus === 'fetching'` — true for ANY active fetch, including background refetches of already-cached data.
- **`isLoading`** — a convenience combination: `isPending && isFetching` — specifically "the FIRST load, actively in flight" — the correct flag for "show a full-page loading spinner," since it excludes background refetches of data already being displayed.
- **`isPlaceholderData`** — true when currently-displayed data is placeholder/previous data shown while the REAL data for a new query key is being fetched (see the [pagination doc](../07-pagination-and-infinite-queries/01-paged-data-patterns.md)'s `keepPreviousData` pattern).
- **`isStale`** — whether the current data has passed its `staleTime` window — informational, rarely needed directly in UI logic, but useful for debugging/devtools inspection.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Full-Page Loading Spinner Flashing Unnecessarily on Every Background Refetch.
A page checked `isFetching` to decide whether to show a full-page loading spinner — but `isFetching` is `true` for **any** active fetch, including routine background refetches triggered by window-focus refetching of data the page was already displaying correctly. Every time a user switched back to the tab, the page would flash its loading spinner over perfectly good, already-visible data, purely because a background refresh had started. Switching the spinner's condition to `isLoading` (which specifically means "no data yet AND actively fetching") fixed this — background refetches of already-cached data no longer triggered the disruptive full-page spinner, since `isPending` was correctly `false` once initial data existed.

---

## 3. Production-Grade Code Example

```tsx
// Correctly distinguishing "first load" from "background refetch" for UI treatment
function ProductList() {
  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  if (isLoading) return <FullPageSpinner />; // ONLY the genuine first-load case — no data exists yet at all
  if (isError) return <ErrorBanner message={error.message} />;

  return (
    <div>
      {isFetching && <RefreshIndicator />} {/* a SMALL, non-disruptive indicator for background refetches */}
      <ul>{data.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
    </div>
  );
}
```

```tsx
// Distinguishing status from fetchStatus explicitly, for a nuanced offline-aware UI
function OfflineAwareWidget() {
  const { status, fetchStatus, data } = useQuery({ queryKey: ['metrics'], queryFn: fetchMetrics });

  if (status === 'pending' && fetchStatus === 'paused') {
    return <OfflineMessage />; // no data yet, AND the fetch itself is paused (offline) — a distinct state from "loading"
  }
  if (status === 'pending') return <Spinner />;
  if (status === 'error') return <ErrorMessage />;

  return <MetricsView data={data} isRefreshing={fetchStatus === 'fetching'} />;
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Using `isFetching` Where `isLoading` Was Actually Needed
```tsx
// ❌ WRONG: isFetching is true for background refetches TOO — shows a disruptive full-page
// spinner even when perfectly good data is already being displayed to the user
if (isFetching) return <FullPageSpinner />; // flashes on EVERY background refetch

// ✅ CORRECT: isLoading specifically means "no data yet, first load in progress"
if (isLoading) return <FullPageSpinner />;
```

### ⚠️ Pitfall 2: Assuming `status: 'success'` Means "Definitely Fresh, Just-Fetched Data"
```tsx
// ❌ MISUNDERSTANDING: status 'success' just means DATA EXISTS in the cache — it says
// NOTHING about freshness; the data could be minutes/hours stale, still sitting in cache
// waiting for its next background refetch trigger
if (status === 'success') { /* assumes this is CURRENT — not necessarily true */ }

// ✅ CORRECT: check isStale (or staleTime configuration) if freshness specifically matters
// to a decision, rather than assuming 'success' implies "just fetched"
```

### ⚠️ Pitfall 3: Not Handling the `pending` + `paused` (Offline) Combination Distinctly
```tsx
// ❌ INCOMPLETE: treating ALL pending states as "loading" conflates a genuinely offline user
// (fetch paused, waiting for connectivity) with an active, in-progress fetch — a confusing
// experience if the loading spinner spins indefinitely with no indication of WHY
if (status === 'pending') return <Spinner />; // spins forever if actually offline, no distinct messaging

// ✅ CORRECT: distinguish the offline/paused case for a more honest, actionable UI state
if (status === 'pending' && fetchStatus === 'paused') return <OfflineMessage />;
if (status === 'pending') return <Spinner />;
```
