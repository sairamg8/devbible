---
title: "Polling Runs on a Separate Clock: `refetchInterval`, Hidden Tabs and Why Two Components Make Two Timers"
sidebar_label: "01c · Polling"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the TanStack Query docs — [Polling](https://tanstack.com/query/latest/docs/framework/react/guides/polling), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Disabling/Pausing Queries](https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries) — plus the interval scheduling in [`queryObserver.ts`](https://github.com/TanStack/query/blob/a1119e5a3ffa52534de7390f17c7183d17658051/packages/query-core/src/queryObserver.ts), the `isValidTimeout` helper in [`utils.ts`](https://github.com/TanStack/query/blob/a1119e5a3ffa52534de7390f17c7183d17658051/packages/query-core/src/utils.ts) and the option TSDoc in [`types.ts`](https://github.com/TanStack/query/blob/a1119e5a3ffa52534de7390f17c7183d17658051/packages/query-core/src/types.ts) (`query-core` reads **5.102.8** at that commit). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-07 · claims + output provenance · session 352cf446

# 🔄 Polling: `refetchInterval`, Hidden Tabs & Per-Observer Timers

## 1. Under-The-Hood Mechanics

`refetchInterval` is **not** a fourth refetch trigger. It does not pass through the staleness gate that governs mount, focus and reconnect ([01](01-automatic-freshness.md)); it is a timer owned by the observer, with rules of its own. The Polling guide states the separation in one line — *"Polling is independent of `staleTime`. A query can be fresh and still poll on schedule"* — and everything surprising about polling follows from it.

```text
refetchInterval: N        ──► setInterval on THIS observer, every N ms
                                        │
                                  each tick asks:
                                        │
                       refetchIntervalInBackground === true  OR  focusManager.isFocused()
                                        │
                              ──no──►  tick does NOTHING (the timer keeps running)
                              ──yes─►  executeFetch()  ──► then the networkMode gate (01d)
```

The guide's summary of the timer's lifetime: *"Set it to a number in milliseconds and the query runs every N ms while there's at least one active observer."* No observer, no timer — the observer clears its interval when it is destroyed, which is why polling stops on unmount with no cleanup code of yours. What the fetch then does when there is no network is [01d](01d-network-mode-and-offline.md).

### The function form, and how polling stops itself

> *"Pass a function instead of a number to compute the interval from the current query. The function receives the `Query` object and should return a number in ms or `false` to stop polling"*
> *"Returning `false` clears the interval timer. If the query result changes so the function would return a positive number again, polling resumes automatically."*

The option's TSDoc confirms both shapes and the default: *"If set to a number, the query will continuously refetch at this frequency in milliseconds. If set to a function, the function will be executed with the latest data and query to compute a frequency. Defaults to `false`."*

### 🔴 A hidden tab does not stop the timer — it makes each tick a no-op

The guide states the behaviour: *"By default, polling pauses when the browser tab loses focus."* The mechanism matters, because it decides what happens when the tab comes back. In `queryObserver.ts` the interval is scheduled unconditionally and the *fetch* is what is guarded:

```typescript
// query-core/src/queryObserver.ts — #updateRefetchInterval, 5.102.8
this.#refetchIntervalId = timeoutManager.setInterval(() => {
  if (this.options.refetchIntervalInBackground || focusManager.isFocused()) {
    this.#executeFetch()
  }
}, this.#currentRefetchInterval)
```

So a tab hidden for an hour with `refetchInterval: 5_000` fires several hundred ticks that do nothing, and on return there is **no backlog** — the next tick simply fetches. Nothing queues, nothing bursts. (Whether the browser itself throttles background timers is a browser policy; the library documents no position on it, so do not count on a precise tick count while hidden.)

`refetchIntervalInBackground` removes the guard: *"If set to `true`, the query will continue to refetch while their tab/window is in the background. Defaults to `false`."* "Background" here means **hidden**, in exactly the `document.visibilityState` sense described in [01](01-automatic-freshness.md) — another application holding OS focus does not count.

### Timers are per-observer; deduplication is per-query

This is the paragraph most people have never read, and it explains request counts that look impossible:

> *"Each `QueryObserver` (each component using `useQuery` with `refetchInterval`) runs its own timer. Two components subscribed to the same key with `refetchInterval: 5000` each fire their timer every 5 seconds. What gets deduplicated is concurrent in-flight fetches: if two timers fire at the same time, only one network request goes out. The timers are observer-level; the deduplication is query-level."*

Two components mounted a second apart therefore hold two independent five-second schedules offset by a second, and because their ticks do not coincide, **both** produce requests. Dedup only saves you when a tick lands while a fetch is already in flight.

### When the interval is not scheduled at all

`#shouldScheduleTimer` refuses in three cases: on the server (`isServerEnvironment()`), when `enabled` resolves to `false`, and when the value fails `isValidTimeout` — which is `typeof value === 'number' && value >= 0 && value !== Infinity`. There is also an explicit `=== 0` check before it. So `refetchInterval: 0` and `refetchInterval: Infinity` both poll **never**, and `enabled: false` disables polling along with everything else.

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

```tsx
// A processing indicator UI driven entirely by the self-stopping polling query
function VideoProcessingStatus({ videoId }: { videoId: string }) {
  const { data } = useVideoStatus(videoId);

  if (data?.status === 'processing') return <ProcessingSpinner progress={data.progress} />;
  if (data?.status === 'ready') return <VideoPlayer videoId={videoId} />; // polling has already stopped by now
  return <ErrorState />;
}
```

```typescript
// A wall-mounted dashboard: the screen is often not the foreground tab, and the numbers
// must still be current. This is the one case refetchIntervalInBackground exists for.
function useOpsMetrics() {
  return useQuery({
    queryKey: ['ops', 'metrics'],
    queryFn: fetchOpsMetrics,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true, // default is false — ticks are skipped while hidden
    staleTime: 30_000,                 // stops focus/mount refetches piling on top of the poll
  });
}
```

```typescript
// Polling in exactly ONE place. Every other consumer reads the same cache entry with no
// timer of its own, because timers are per-observer and would otherwise multiply.
function useOrderCount({ poll = false } = {}) {
  return useQuery({
    queryKey: ['orders', 'count'],
    queryFn: fetchOrderCount,
    refetchInterval: poll ? 5000 : false,
    staleTime: 5000, // the readers get the polled value without triggering their own fetches
  });
}

function OrdersDashboard() { return useOrderCount({ poll: true }); } // the single owner
function HeaderBadge()     { return useOrderCount(); }               // read-only subscriber
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

### ⚠️ Pitfall 2: A Dashboard That Silently Stops Updating on a Second Monitor
```typescript
// ❌ WRONG for a wall display: with the default refetchIntervalInBackground: false, every
// tick while the tab is HIDDEN does nothing, so the numbers freeze the moment someone
// switches tabs — and thaw silently on return, so the staleness is never visible
useQuery({ queryKey: ['ops'], queryFn: fetchOps, refetchInterval: 30_000 });

// ✅ CORRECT: opt in explicitly for displays that must stay current while unattended
useQuery({
  queryKey: ['ops'],
  queryFn: fetchOps,
  refetchInterval: 30_000,
  refetchIntervalInBackground: true,
});
```

### ⚠️ Pitfall 3: `enabled: false` Combined With `refetchInterval`
```typescript
// ❌ DOES NOT POLL: #shouldScheduleTimer requires `enabled !== false`, so no interval is
// scheduled at all. The Disabling guide: "The query will not automatically refetch in the
// background." That includes the timer.
useQuery({ queryKey: ['job', id], queryFn: fetchJob, enabled: false, refetchInterval: 2000 });

// ✅ CORRECT: express the condition inside refetchInterval, which is re-evaluated on each update
useQuery({
  queryKey: ['job', id],
  queryFn: fetchJob,
  refetchInterval: (query) => (query.state.data?.done ? false : 2000),
});
```

### ⚠️ Pitfall 4: `refetchInterval: 0` Read as "As Fast As Possible"
```typescript
// ❌ POLLS NEVER: the observer checks `=== 0` before scheduling, and isValidTimeout also
// rejects Infinity — both of these are silently equivalent to `false`
useQuery({ queryKey: ['ticks'], queryFn: fetchTicks, refetchInterval: 0 });
useQuery({ queryKey: ['ticks'], queryFn: fetchTicks, refetchInterval: Infinity });

// ✅ CORRECT: a real interval, and a computed one that disables itself explicitly
useQuery({ queryKey: ['ticks'], queryFn: fetchTicks, refetchInterval: 1000 });
useQuery({ queryKey: ['ticks'], queryFn: fetchTicks, refetchInterval: () => (paused ? false : 1000) });
```

### ⚠️ Pitfall 5: Assuming Two Components Polling One Key Cost One Request
```typescript
// ❌ WRONG ASSUMPTION: "they share a cache entry, so they share a poll." They do not.
// Each observer runs its own timer; only CONCURRENT in-flight fetches are deduplicated.
function Header()  { useOrderCount(); } // refetchInterval: 5000, mounted at t=0
function Sidebar() { useOrderCount(); } // refetchInterval: 5000, mounted at t=1s
// → two schedules, offset by a second, roughly twice the requests you budgeted for

// ✅ CORRECT: give exactly one call site the interval — see useOrderCount above
```

---

## Gotchas

**★ 🔴 Polling ignores `staleTime` completely.** *"Polling is independent of `staleTime`. A query can be fresh and still poll on schedule… `refetchInterval` fires on its own clock regardless of freshness."* Important Defaults says it from the other direction: a `refetchInterval` triggers refetches periodically *"which is independent of the `staleTime` setting"*. So the usual advice — raise `staleTime` to cut requests — has no effect whatsoever on the poll. The only levers are the interval itself and a function form that returns `false`.

**★ 🔴 A hidden tab does not pause the timer, only the fetch.** The interval keeps firing; each tick evaluates `refetchIntervalInBackground || focusManager.isFocused()` and does nothing when both are false. The user-visible consequence is the good one — no thundering herd of catch-up requests when a laptop wakes and forty tabs become visible at once — but it also means "polling paused" is not a state you can observe or await. Nothing in the result object tells you ticks are being dropped, so a frozen dashboard looks exactly like a dashboard whose numbers have not changed.

**★ "Background" means hidden, not unfocused.** The guard is `focusManager.isFocused()`, which is `document.visibilityState !== 'hidden'`. A browser window sitting behind your editor is still `visible`, so polling continues; a background *tab* is hidden, so it stops. Teams debugging "the dashboard froze" often test by clicking another window, see polling continue, and wrongly conclude `refetchIntervalInBackground` is irrelevant to them.

**★ Every observer runs its own timer.** *"The timers are observer-level; the deduplication is query-level."* Two components using the same polling hook produce two schedules, and unless their ticks coincide, two requests per cycle. A header badge and a sidebar panel that each render a live count is the standard way a 5-second poll becomes an effective 2.5-second one. Give exactly one call site the interval and let the others read the cache.

**★ `refetchInterval: 0` and `refetchInterval: Infinity` both mean "never".** The observer bails on `=== 0` before scheduling, and `isValidTimeout` is `typeof value === 'number' && value >= 0 && value !== Infinity`. Neither warns, and both read at a glance as an extreme value rather than as `false`. A computed interval derived from arithmetic — a remaining-seconds countdown, a backoff that decays — silently switches polling off at exactly the moment it produces zero.

**★ `enabled: false` kills the interval too.** `#shouldScheduleTimer` requires `enabled !== false`, and the Disabling guide lists the consequence among the rest: *"The query will not automatically refetch in the background."* People reach for `enabled` to pause a poll and then cannot work out why flipping it back does not resume where it left off — there was no timer to resume, and the query re-enters through the normal mount path instead. The guide's own answer is to keep the query enabled and put the condition in the interval: *"Pass a function to `refetchInterval` and close over component state to control when polling runs."*

**★ A polling query still refetches on mount and focus, and those stack on the poll.** `refetchInterval` does not replace the event triggers; it runs beside them. A 2-second poll on a query with the default `staleTime: 0` also refetches every time a new component mounts and every time the tab becomes visible. Giving the query a `staleTime` at least as long as its interval is what stops the two mechanisms compounding — which is the one case where `staleTime` matters to a polling query, even though it cannot slow the poll itself.

**★ The interval is recomputed, not fixed at mount.** `#updateTimers` recomputes `refetchInterval` whenever the observer updates, so a function form is re-evaluated against the latest query state and the timer is cleared and rescheduled when the value changes. That is what makes self-stopping polls work — and it also means an interval derived from a value that changes every render tears down and recreates a timer every render.

**★ Polling does not keep an unmounted query alive.** The timer dies with the observer, and the data then follows the ordinary `gcTime` rules — collected five minutes after the last observer unmounts by default. "Poll in the background to keep the cache warm" is not a thing you can express with `refetchInterval`; there has to be a mounted observer somewhere for any of it to run.

## Interview questions

**★ Does raising `staleTime` reduce the number of requests a polling query makes?**
Not one. Polling runs on its own timer and the docs are explicit that it is *"independent of `staleTime`"*: *"A query can be fresh and still poll on schedule."* The staleness gate governs the three event triggers — mount, focus, reconnect — and `refetchInterval` is not one of them. If a polling query is making too many requests, the interval is the lever, or a function form that returns `false` once further polling is pointless. Raising `staleTime` on a polling query is still worth doing, but for a different reason: it stops mount and focus refetches stacking on top of the poll.

**★ What happens to a 5-second poll when the user switches to another tab for an hour?**
The timer keeps firing every five seconds; each tick checks `refetchIntervalInBackground || focusManager.isFocused()`, finds both false, and does nothing. So many ticks occur and zero requests go out, and when the tab becomes visible again the next tick simply fetches — there is no queue and no catch-up burst. The guide's one-line version is *"By default, polling pauses when the browser tab loses focus"*, but knowing that it is the fetch and not the timer that pauses is what tells you the return is cheap. If the data must stay current while hidden — a wall dashboard, a trading screen on a second monitor — `refetchIntervalInBackground: true` removes the guard.

**★ Two components use the same polling hook on the same key. How many requests per interval?**
Two, in the general case. The Polling guide addresses it directly: *"Each `QueryObserver` … runs its own timer… The timers are observer-level; the deduplication is query-level."* Deduplication only collapses fetches that are concurrently in flight, so two timers started a second apart produce two separate requests every cycle. The fix is not a library setting; it is to poll in one place — a single hook instance high in the tree, or a parameter that enables the interval for exactly one caller — and let the other components read the shared cache entry without a timer of their own.

**★ Why does polling stop when the component unmounts, without any cleanup code?**
Because the timer belongs to the `QueryObserver`, not to the query or the cache. The guide phrases the lifetime as *"while there's at least one active observer"*; in the source, losing the last listener destroys the observer, and `destroy()` clears both the stale timeout and the refetch interval. This is also why polling cannot be used to keep a cache entry warm in the background: an unmounted query has no observer, so it has no timer, and after `gcTime` it has no data either.

**★ A teammate writes `refetchInterval: remainingSeconds` where `remainingSeconds` counts down to zero. What happens?**
Polling stops when it reaches zero, silently. The observer checks `=== 0` before it does anything else, and `isValidTimeout` independently rejects anything that is not a number, is negative, or is `Infinity`. So the last tick before zero polls at one millisecond — its own problem — and the countdown reaching zero is indistinguishable from `refetchInterval: false`. A computed interval should return an explicit `false` for "stop" and never let arithmetic produce that sentinel by accident.

**★ How do you pause and resume a poll?**
With the function form, not with `enabled`. The guide shows it: *"Pass a function to `refetchInterval` and close over component state to control when polling runs"* — return `false` while paused and a number otherwise, and the docs guarantee the resume, *"If the query result changes so the function would return a positive number again, polling resumes automatically."* Using `enabled: false` also stops the poll, because no timer is scheduled at all when `enabled` is false, but it takes the whole query offline with it: no mount refetch, no focus refetch, and the query even *"ignore[s] query client `invalidateQueries` and `refetchQueries` calls"*. That is a much larger hammer than "pause the timer".

**★ You need a query polled every 10 seconds and you also want a manual Refresh button. Anything to watch for?**
Two things. The manual path is `refetch()`, which fetches unconditionally and does not reset the interval, so a click one second before a tick produces two requests a second apart — usually harmless, occasionally not, and worth a disabled button while `isFetching`. The second is that `refetchQueries` and `invalidateQueries` from elsewhere in the app also reach a polling query, so the effective request rate is the poll plus every unrelated invalidation that matches the key prefix. When a "10-second poll" shows up in logs at three seconds, the interval is rarely the thing to look at first.

---

← [Refetch render cost](./01b-refetch-render-cost.md) · [Topic index](../README.md) · Next → [Network mode & offline](./01d-network-mode-and-offline.md)
