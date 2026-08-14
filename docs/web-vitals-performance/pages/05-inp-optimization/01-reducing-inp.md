---
title: "INP Optimization: Yielding, Debouncing & Prioritized Updates"
sidebar_label: "INP Optimization"
sidebar_position: 1
---

# 🚀 INP Optimization: Yielding, Debouncing & Prioritized Updates

## 1. Under-The-Hood Mechanics

INP measures the full round trip from user input to the next visually-reflected frame: **input delay** (main thread busy with something else when the input arrives) + **processing time** (the event handler's own synchronous work) + **presentation delay** (time to actually paint the result). Any single-threaded JavaScript task longer than 50ms blocks all three phases for whatever interaction happens to land during it.

```
User clicks ──► [Input Delay: main thread busy?] ──► [Processing: handler runs] ──► [Presentation: paint]
                        │                                      │
                 Long task from an                     Handler itself does
                 UNRELATED prior action                 too much synchronous
                 still running                            work (big loop, heavy re-render)
```

### `scheduler.yield()` / Cooperative Yielding
Breaking a large synchronous task into smaller chunks, yielding back to the main thread between them, lets the browser process any pending user input or paint a frame **between** chunks instead of blocking for the task's entire duration. `scheduler.yield()` is the modern, purpose-built API for this (returning a Promise that resolves at the next opportunity the browser has to handle higher-priority work); `setTimeout(fn, 0)` is the older, less precise fallback with roughly the same intent but coarser browser-imposed minimum delays.

### `isInputPending()`
An alternative cooperative-scheduling primitive: rather than unconditionally yielding on a fixed schedule, code can poll `navigator.scheduling.isInputPending()` inside a long-running loop and yield **only when there's actually a pending interaction to prioritize** — avoiding the overhead of yielding when nothing is waiting.

### React's `useTransition`/`startTransition`
React's built-in mechanism for the same underlying goal at the component level: marking a state update as **low priority**, letting React interrupt rendering it if a higher-priority update (like direct user input) needs to happen first — effectively automatic yielding for React re-render work specifically, without manually chunking anything.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Data Grid's Filter Input Feeling Laggy on Every Keystroke.
A 5,000-row data table re-filters and re-renders synchronously on every keystroke in a search box — each keystroke triggers a ~180ms synchronous filter+re-render pass, well past the 200ms "needs improvement" INP threshold, and the input itself visibly stutters. Wrapping the filter+re-render state update in `startTransition` lets React keep the text input's own re-render (echoing the typed character) at high priority, while deferring the expensive table re-render as a lower-priority, interruptible update — the input feels instantly responsive even though the table's actual filtered results appear a beat later.

---

## 3. Production-Grade Code Example

```tsx
// SearchableDataGrid.tsx — useTransition to keep input responsive during an expensive re-render
import { useState, useTransition, useDeferredValue } from 'react';

function SearchableDataGrid({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  const deferredQuery = useDeferredValue(query);
  const filteredRows = useMemo(
    () => rows.filter((r) => r.name.toLowerCase().includes(deferredQuery.toLowerCase())),
    [rows, deferredQuery]
  );

  return (
    <div>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value); // HIGH priority — the input echoes instantly, every keystroke
          startTransition(() => { /* the filteredRows recompute above is implicitly deferred via useDeferredValue */ });
        }}
      />
      {isPending && <span className="text-xs text-slate-400">Updating…</span>}
      <DataTable rows={filteredRows} />
    </div>
  );
}
```

```typescript
// lib/yieldToMain.ts — cooperative time-slicing for a non-React, vanilla-JS heavy synchronous task
export async function yieldToMain() {
  if ('scheduler' in window && 'yield' in (window as any).scheduler) {
    await (window as any).scheduler.yield();
  } else {
    await new Promise((resolve) => setTimeout(resolve, 0)); // fallback for browsers without scheduler.yield
  }
}

export async function processLargeDataset<T>(items: T[], processItem: (item: T) => void) {
  let chunkStart = performance.now();
  for (let i = 0; i < items.length; i++) {
    processItem(items[i]);
    if (performance.now() - chunkStart > 50) { // yield before crossing the 50ms long-task threshold
      await yieldToMain();
      chunkStart = performance.now();
    }
  }
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Debouncing an Input's Visual Feedback, Not Just Its Side Effect
```tsx
// ❌ WRONG: debouncing the setState call itself means the INPUT FIELD's displayed value
// also lags behind actual typing — the field itself now feels laggy, which is worse for INP,
// not better, since the debounce delays the very re-render the user is watching
const debouncedSetQuery = useMemo(() => debounce(setQuery, 300), []);
<input onChange={(e) => debouncedSetQuery(e.target.value)} />

// ✅ CORRECT: keep the input's OWN state update synchronous/instant; debounce only the
// expensive DOWNSTREAM work (a search API call, an expensive filter) derived from it
const [query, setQuery] = useState('');
const debouncedQuery = useDebouncedValue(query, 300); // used only for the expensive side effect
```

### ⚠️ Pitfall 2: Yielding Too Frequently, Turning a Fast Task Slow
Calling `scheduler.yield()`/`setTimeout` after every single tiny unit of work (e.g. every array element instead of every ~50ms chunk) adds scheduling overhead that can make an otherwise-fast synchronous operation take noticeably longer in total wall-clock time, even though no single chunk now blocks the main thread long enough to matter. Yield based on elapsed time crossing a threshold (as shown above), not per-item.

### ⚠️ Pitfall 3: Wrapping Genuinely Urgent Updates in `startTransition`
`startTransition` marks an update as **interruptible and lower priority** — appropriate for a big re-render whose data can lag behind by a frame or two, but wrong for anything the user needs to see reflected immediately (e.g. a toggle switch's own visual on/off state, a modal's open/close). Marking the wrong update as a transition makes the UI feel unresponsive to the exact interaction the user just performed.
