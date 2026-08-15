---
title: "02 · The loop, the timing and the cost"
sidebar_label: "02 · The loop and timing"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver), [`ResizeObserver.observe()`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver/observe), [`Window: error` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/error_event), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap) — and the [Resize Observer specification](https://drafts.csswg.org/resize-observer/). Documentation-validated; **no timings and no console output**.

`ResizeObserver` is the one observer that can *cause* the thing it observes. That is what the
loop error is about, and understanding when the callback runs is what makes the fixes obvious
rather than superstitious.

## When the callback runs

Delivery happens inside the browser's rendering step — **after layout, before paint**. It is
the property that makes the API worth using:

| | `resize` event handler | `ResizeObserver` callback |
|---|---|---|
| Runs | after the frame is painted | **before** the frame is painted |
| Visible result | one frame of the wrong layout, then a correction | the correction ships in the same frame |

🔴 **The flip side is that your callback is on the critical path of a frame.** Everything it
does happens between layout and paint, so a slow callback delays the pixels directly. Keep it
to arithmetic and a write; anything heavier belongs in a task you schedule from it.

**Do not measure inside the callback.** The entry already carries the sizes; calling
`getBoundingClientRect()` there asks the browser to lay out again, in the middle of the layout
it was finishing ([Phase 9 · 12 · The forced reflow](../../phase-9-dom/12-layout-thrashing/01-the-forced-reflow.md)).

## The loop error

```
ResizeObserver loop completed with undelivered notifications.
```

(Older Chromium builds phrase it `ResizeObserver loop limit exceeded`.)

**What it means:** the browser could not finish delivering resize notifications within one
frame. The specification delivers observations in passes, shallowest element first, and repeats
the pass while callbacks keep producing new size changes. If a pass changes the size of
something at the same depth or shallower, the pass cannot converge; the browser stops,
**defers the remaining notifications to the next frame**, and reports the error.

```js
// ❌ the callback resizes what it observes — a new observation every pass
new ResizeObserver(([entry]) => {
  entry.target.style.width = `${entry.contentBoxSize[0].inlineSize + 10}px`;
}).observe(box);
```

⚠️ **It arrives as a `window` error event, not as an exception.** A `try`/`catch` around the
callback does not see it, and error-reporting tools log it with no stack and no filename, which
is why it shows up in dashboards as a mystery. Suppressing it in the reporter is a reasonable
last step — but only after establishing that the layout does settle, because the error also
means **the user saw at least one frame of the wrong size**.

### Fix 1 — do not write sizes at all

The real fix, most of the time. If the callback's output is a CSS length, a container query,
`clamp()` or intrinsic sizing does the job in the style engine, where a loop is impossible
([01 · Element-level responsiveness](./01-element-level-responsiveness.md)).

### Fix 2 — write to a different element

A loop needs a cycle. Observing a wrapper and sizing a child inside it is not a cycle, provided
the child's size cannot feed back into the wrapper's — which means the wrapper's size must not
depend on its content (`position: absolute`, a fixed grid track, `contain: size`).

### Fix 3 — skip the write when the size is already right

MDN's documented approach: remember what you last set, and do nothing when the element already
matches.

```js
const expected = new WeakMap();   // 🔴 Weak: the entry keeps no element alive

const ro = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const width = entry.contentBoxSize[0].inlineSize;
    if (expected.get(entry.target) === width) continue;   // our own write coming back
    const next = compute(width);
    expected.set(entry.target, next);
    entry.target.style.width = `${next}px`;
  }
});
```

This converges because the second pass is a no-op. A plain `Map` would work identically and
leak every element it ever saw ([Phase 9 · 10 · 02 · Cleanup](../../phase-9-dom/10-removing-and-replacing/02-cleanup.md)).

### Fix 4 — defer the write out of the delivery

```js
new ResizeObserver((entries) => {
  requestAnimationFrame(() => applyLayout(entries));
});
```

The pass finishes with nothing changed, so the browser converges and the error stops. ⚠️ **This
buys silence, not correctness** — the write now lands in a later frame, which is exactly the
one-frame-late behaviour the observer existed to avoid, and if `applyLayout` still feeds back
you have an oscillation that no longer reports itself. Reach for fix 1, 2 or 3 first.

## Cost: what observing actually charges you

Resize observations are computed as part of layout work the browser is already doing, so a
single observer on a handful of elements is cheap. Three things make it not cheap:

- **Thousands of observed elements.** Every one is checked each frame in which layout ran. A
  virtualised list should observe the rows that exist, and `unobserve` them on recycling.
- **A callback that touches the DOM in a loop.** Read from the entries, batch the writes; the
  batching argument is [Phase 9 · 11 · Batching DOM work](../../phase-9-dom/11-batching-dom-work/README.md).
- **Observers created per element.** A hundred observers means a hundred callback invocations
  where one observer would have delivered one array.

**There is no `takeRecords()` on `ResizeObserver`** — unlike `MutationObserver` and
`IntersectionObserver`, there is no way to drain pending observations synchronously. Teardown is
`disconnect()`, and a notification already queued for a disconnected observer is dropped.

## Testing and environments without one

`ResizeObserver` is a browser API; jsdom does not implement it, so a component that constructs
one in its constructor throws in a Node test runner. The usual shape is a small stub in test
setup, and a feature check in code that must also run on the server:

```js
if (typeof ResizeObserver !== 'undefined') { /* observe */ }
```

That check belongs with the rest of the feature-detection argument in **12 · Feature detection**
*(not written yet)*; the testing side is **Phase 8 · 14 · Testing JavaScript** *(not written yet)*.

## Gotchas

**Symptom: "ResizeObserver loop completed with undelivered notifications" floods the console.**
Cause — a callback changes the size of something observed, so the delivery pass cannot converge.
Fix — stop writing sizes (container queries), write to an element outside the cycle, or skip the
write when the size already matches. Deferring into `requestAnimationFrame` silences it but
delays the correction by a frame.

**Symptom: the error appears in the error tracker with no stack and cannot be caught.**
Cause — it is reported as a `window` error event, not thrown into your callback.
Fix — listen on `window` if you want to count it; fix the cycle rather than wrapping the callback
in `try`/`catch`, which never sees it.

**Symptom: layout visibly oscillates between two sizes.**
Cause — two rules feed each other — usually a callback that sets a width from a height, or two
observers writing to each other's targets.
Fix — break the cycle with an authoritative source of truth; a `WeakMap` of expected values makes
the second pass a no-op.

**Symptom: frames get slower as a list grows.**
Cause — one observer per row, or thousands of live observations.
Fix — one observer for all rows, and `unobserve` on recycle or unmount.

**Symptom: the component throws in unit tests.**
Cause — jsdom has no `ResizeObserver`.
Fix — stub it in test setup, and feature-detect in code that may run outside a browser.

**Symptom: reading `getBoundingClientRect()` in the callback makes scrolling janky.**
Cause — a forced synchronous layout inside the rendering step.
Fix — use the sizes on the entry; they are already computed.

## Interview questions

**★ What causes "ResizeObserver loop completed with undelivered notifications"?**
The callback changed the size of an observed element, so the browser's delivery passes could not
converge within the frame. It defers the rest to the next frame and reports the error — which
also means the user saw a frame with the wrong size.

**★ How do you fix it properly?**
Best: stop writing sizes from JavaScript and let a container query do it. Otherwise write to an
element that cannot feed back, or record the size you set in a `WeakMap` and skip the write when
the element already matches. Deferring into `requestAnimationFrame` only hides it.

**★ Why a `WeakMap` and not a `Map` for the expected sizes?**
Because the keys are elements. A `Map` keeps every element it has ever seen alive, so a
long-lived observer becomes a leak; a `WeakMap` lets a removed element be collected.

**★ When exactly does the callback run, and why does that matter?**
Inside the rendering step, after layout and before paint. That is why a correction ships in the
same frame instead of one frame late — and why a slow callback delays the frame directly.

**★ Is `ResizeObserver` expensive?**
Per observation, no — it rides on layout the browser is already doing. It becomes expensive with
thousands of live observations, with an observer per element instead of one shared observer, or
with a callback that measures and writes in an interleaved loop.

**Can you drain pending observations synchronously?**
No. `ResizeObserver` has no `takeRecords()`; `disconnect()` is the whole teardown story.

---

← [01 · Element-level responsiveness](./01-element-level-responsiveness.md) · [Topic index](./README.md)
