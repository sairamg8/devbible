---
title: "Background Refetching: Window Focus, Reconnect & Polling Intervals"
sidebar_label: "Background Refetching"
sidebar_position: 1
---

# 🔄 Background Refetching: Window Focus, Reconnect & Polling Intervals

## 1. Under-The-Hood Mechanics

TanStack Query automatically keeps cached data fresh through several **event-triggered** refetch mechanisms, layered on top of the `staleTime`-based freshness model — each responding to a specific real-world signal that data might have changed.

```
refetchOnWindowFocus (default: true)  ──► browser tab regains focus ──► refetch ACTIVE, STALE queries
refetchOnReconnect (default: true)       ──► network connectivity restored ──► refetch ACTIVE, STALE queries
refetchInterval: N                          ──► POLLS on a fixed interval, regardless of focus/staleness,
                                                   for as long as the query has an active observer

refetchInterval: (query) => query.state.data?.status === 'processing' ? 2000 : false
                                                ──► CONDITIONAL polling — e.g. poll every 2s ONLY while a
                                                      background job is still processing, stop once complete
```

### Why Refetch-on-Focus Is the Default
A user switching back to a tab after being away for a while is a strong, common-sense signal that cached data might now be stale — refetching at that moment (if the data has actually passed its `staleTime`) keeps the UI honest without requiring a manual refresh, at essentially zero cost for data that's still fresh (the staleTime check means an focus-triggered refetch is a no-op for data that hasn't gone stale yet).

### Conditional `refetchInterval`: Polling That Stops Itself
Passing a **function** to `refetchInterval` (rather than a fixed number) lets the polling behavior depend on the **current cached data itself** — the standard pattern for "poll while a background job is processing, stop automatically once it completes," without needing separate manual logic to start/stop an interval timer.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Video Processing Status Indicator That Correctly Stops Polling Once Processing Completes.
A video upload feature needed to show live processing status ("uploading," "transcoding," "ready") by polling a status endpoint — polling indefinitely, even after the video reached "ready," would waste both client and server resources on pointless repeated requests for data that would never change again. A conditional `refetchInterval` function checked the current cached status on each poll: returning `2000` (poll again in 2 seconds) while status was `'processing'`, and `false` (stop polling entirely) once status reached `'ready'` or `'failed'` — the polling behavior automatically, correctly self-terminated based on the data's own current state, with no manual interval management code required.

---

## 3. Production-Grade Code Example

```typescript
// Conditional polling that stops itself once processing completes
function useVideoStatus(videoId: string) {
  return useQuery({
    queryKey: ['video', videoId, 'status'],
    queryFn: () => fetchVideoStatus(videoId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'processing' ? 2000 : false; // poll every 2s WHILE processing, then STOP
    },
  });
}
```

```typescript
// Tuning refetchOnWindowFocus/reconnect per-query, for data with genuinely different freshness needs
function useLiveStockPrice(ticker: string) {
  return useQuery({
    queryKey: ['stock', ticker],
    queryFn: () => fetchStockPrice(ticker),
    staleTime: 0, // ALWAYS considered stale — every focus/reconnect event triggers a fresh fetch
    refetchOnWindowFocus: true, // explicit, though this IS the default — documenting intent
  });
}

function useUserPreferences() {
  return useQuery({
    queryKey: ['user', 'preferences'],
    queryFn: fetchUserPreferences,
    staleTime: 60 * 60 * 1000, // rarely changes — an hour of freshness
    refetchOnWindowFocus: false, // explicitly OPT OUT — this data doesn't need focus-triggered refetching at all
  });
}
```

```tsx
// A processing indicator UI driven entirely by the self-stopping polling query
function VideoProcessingStatus({ videoId }: { videoId: string }) {
  const { data } = useVideoStatus(videoId);

  if (data?.status === 'processing') return <ProcessingSpinner progress={data.progress} />;
  if (data?.status === 'ready') return <VideoPlayer videoId={videoId} />; // polling has already stopped by now
  return <ErrorState />;
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Fixed-Interval Polling That Never Stops, Wasting Resources Indefinitely
```typescript
// ❌ WASTEFUL: polls FOREVER, even long after the video has finished processing and will
// never change state again — unnecessary server load and client battery/network usage
useQuery({ queryKey: ['video', id, 'status'], queryFn: fetchStatus, refetchInterval: 2000 }); // NEVER stops

// ✅ CORRECT: a conditional function stops polling once the data reaches a terminal state
useQuery({
  queryKey: ['video', id, 'status'],
  queryFn: fetchStatus,
  refetchInterval: (query) => (query.state.data?.status === 'processing' ? 2000 : false),
});
```

### ⚠️ Pitfall 2: Leaving `refetchOnWindowFocus: true` for Data That Should Never Change Mid-Session
```typescript
// ❌ SUBOPTIMAL: refetching app-configuration/feature-flag data on every tab focus, when it
// genuinely never changes within a single session, adds unnecessary network requests for no benefit
useQuery({ queryKey: ['app-config'], queryFn: fetchAppConfig }); // default refetchOnWindowFocus: true

// ✅ CORRECT: explicitly disable focus-refetching for genuinely session-stable data
useQuery({ queryKey: ['app-config'], queryFn: fetchAppConfig, refetchOnWindowFocus: false, staleTime: Infinity });
```

### ⚠️ Pitfall 3: Assuming Background Refetches Show a Loading Spinner
```tsx
// ❌ WRONG: a refetchOnWindowFocus-triggered background refetch does NOT reset status to
// 'pending' — the ALREADY-CACHED data remains visible throughout; only isFetching becomes
// true, briefly, in the background — checking `isLoading` here would NEVER show a spinner
// for a focus-triggered refetch, which is actually the CORRECT, intended behavior
if (isLoading) return <Spinner />; // correctly stays false during a background focus refetch

// ✅ AWARENESS: this is a FEATURE, not a bug — background refetches are meant to be
// invisible/non-disruptive by default; use isFetching specifically if a SUBTLE indicator is wanted
```
