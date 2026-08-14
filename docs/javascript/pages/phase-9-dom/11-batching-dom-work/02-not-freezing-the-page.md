---
title: "02 · Not freezing the page"
sidebar_label: "02 · Not freezing the page"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`PerformanceLongTaskTiming`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming), [`Window.requestAnimationFrame()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), [`Window.requestIdleCallback()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback), [`Scheduler.postTask()`](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/postTask), [`IntersectionObserver`](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver), [`content-visibility`](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility), [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API). Documentation-validated; **no timings**.

## Why the page freezes

JavaScript and rendering share **one thread**. While your loop runs, the browser cannot paint,
cannot scroll, cannot run a click handler. The page is not "slow" — it is **not there**.

The platform has a name for this: the Long Tasks API defines a **long task** as one occupying the
main thread for **more than 50 ms**, and exposes those tasks to `PerformanceObserver`. That
threshold exists because a task longer than about a frame is a task the user can feel.

🔴 **Batching insertions does not fix this.** Building ten thousand rows into a fragment is still
ten thousand rows of work in one uninterrupted go. The fragment removes the *rendering* cost; the
*JavaScript* cost is untouched.

So there are three real answers, in the order you should consider them:

## 1 · Do not build what nobody will look at

The best batching is not doing the work.

- **Paginate, or virtualise.** Render the rows in view plus a small buffer; swap contents as the
  user scrolls. A thousand-row table almost never needs a thousand rows in the DOM.
- **`content-visibility: auto`** lets CSS skip rendering work for off-screen subtrees while
  keeping them in the DOM — no JavaScript at all. Pair it with `contain-intrinsic-size` so the
  scrollbar does not jump as content is realised.
- **Load on demand** with an `IntersectionObserver` sentinel at the end of the list, rather than
  rendering everything up front.

This is the answer to give first in an interview, because it addresses the actual question —
*why are there a thousand rows?* — rather than optimising the loop that makes them.

## 2 · Break the work into chunks and yield

When the work genuinely must happen, hand the thread back between pieces:

```js
async function renderInChunks(items, size = 200) {
  for (let i = 0; i < items.length; i += size) {
    const frag = document.createDocumentFragment();
    for (const item of items.slice(i, i + size)) frag.append(buildRow(item));
    list.append(frag);
    await new Promise((r) => setTimeout(r, 0));   // yield: let the browser paint and respond
  }
}
```

Total work goes *up* slightly; **responsiveness** goes up a lot, because between chunks the
browser can paint, run a click handler and process a scroll.

The mechanisms, and what each is actually for:

| Tool | Use it for |
|---|---|
| `setTimeout(fn, 0)` | The universally available yield. Goes to the back of the task queue |
| `requestAnimationFrame` | Work that must be **in step with rendering** — one chunk per frame |
| `requestIdleCallback` | Genuinely optional work, run when the browser is idle. **Support is not universal — check before relying on it** |
| `scheduler.postTask()` | Prioritised scheduling (`user-blocking` / `user-visible` / `background`). Newer; **check support** |
| **Web Worker** | The heavy **computation** — parsing, sorting, diffing. A worker cannot touch the DOM, so it returns data and the main thread renders it |

⚠️ **A microtask is not a yield.** `await Promise.resolve()` resumes in the same task, before the
browser gets a chance to render — so a loop that "awaits" a resolved promise each iteration
freezes exactly as hard as one that does not. The queue distinction is
[Phase 7 · 03 · Microtasks vs macrotasks](../../phase-7-async/03-microtasks-vs-macrotasks/README.md),
and this is its most visible practical consequence.

## 3 · Coalesce repeated work into one frame

The other freeze is not one long task but *many small ones firing too often* — a `scroll`,
`pointermove` or `resize` handler that writes to the DOM on every event.

```js
let queued = false;
window.addEventListener('scroll', () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    updateHeader();          // at most once per frame
  });
}, { passive: true });
```

The flag is what makes it a coalescer rather than a queue of a hundred callbacks.
`{ passive: true }` tells the browser the handler will not call `preventDefault()`, so scrolling
need not wait for it — on a scroll listener it should be considered the default.

`ResizeObserver` and `IntersectionObserver` are already frame-aligned and are better than
listening for `resize`/`scroll` at all, where they fit.

## What to measure, since this page has no numbers

Under the no-new-sandboxes rule there are no timings here — but the tools are worth naming, and
they are the same ones you would use on your own app:

- **`PerformanceObserver`** with `entryTypes: ['longtask']` reports tasks over 50 ms as they
  happen.
- **`performance.mark()` / `measure()`** for your own spans.
- The DevTools performance panel shows which part of a long task was scripting, style, layout or
  paint — which decides whether the fix is chunking (scripting) or something from
  **12 · Layout thrashing** *(not written yet)*.

## Gotchas

**Symptom:** A fragment-based render still freezes the page
**Cause:** Batching removes rendering churn, not the JavaScript cost of building N rows.
**Fix:** Chunk and yield — or render fewer rows.

**Symptom:** `await Promise.resolve()` in the loop did not help
**Cause:** It is a microtask; it resumes in the same task, before rendering.
**Fix:** `setTimeout(…, 0)`, `requestAnimationFrame`, or a real scheduler API.

**Symptom:** A scroll handler makes scrolling stutter
**Cause:** It runs on every scroll event and writes to the DOM each time.
**Fix:** Coalesce into one `requestAnimationFrame` with a queued flag, and mark the listener `passive`.

**Symptom:** `requestIdleCallback` never fires, or is undefined
**Cause:** Support is not universal, and it only runs when the browser is idle — a busy page has no idle.
**Fix:** Feature-detect and fall back; do not put required work in it.

**Symptom:** Moving work to a Web Worker did not help the render
**Cause:** Workers cannot touch the DOM; only the computation moved.
**Fix:** That is the correct split — the worker returns data, the main thread renders it in chunks.

**Symptom:** The scrollbar jumps around with `content-visibility: auto`
**Cause:** Off-screen subtrees have no size until realised.
**Fix:** `contain-intrinsic-size` with an estimate.

**Symptom:** A long list is smooth in development and janky on a real phone
**Cause:** A mid-range device has a fraction of the CPU; 50 ms of desktop work is much more there.
**Fix:** Throttle the CPU in DevTools when testing, and prefer not rendering the rows at all.

## Interview questions

**★ How do you render a thousand rows without freezing the page?**
First ask whether they need to exist — paginate or virtualise, and let `content-visibility: auto`
skip off-screen work. If they must all be built, **chunk the work and yield between chunks** so
the browser can paint and respond. Building into a `DocumentFragment` helps the rendering side but
does nothing about the JavaScript cost.

**★ What is a long task?**
One that occupies the main thread for **more than 50 ms** — the Long Tasks API's definition,
observable via `PerformanceObserver`. Past roughly a frame, the user feels the page stop
responding.

**★ Why doesn't `await Promise.resolve()` yield to the browser?**
It queues a **microtask**, which runs before the task ends and before rendering. Yielding needs a
new task — `setTimeout(…, 0)`, `requestAnimationFrame`, or `scheduler.postTask`.

**★ `requestAnimationFrame` versus `requestIdleCallback` versus `setTimeout(0)`?**
`rAF` for work that must align with rendering (one chunk per frame). `requestIdleCallback` for
genuinely optional work, when the browser is idle — and **support is not universal**.
`setTimeout(…, 0)` is the plain, universally available yield.

**★ How do you stop a scroll handler from causing jank?**
Coalesce it into at most one `requestAnimationFrame` per frame with a queued flag, and register
the listener as `passive` so scrolling does not wait on it. Better still, use `IntersectionObserver`
or `ResizeObserver`, which are already frame-aligned.

**★ What can a Web Worker do here?**
The computation — parsing, sorting, diffing, filtering — but **not the DOM**. It returns data and
the main thread renders it, which is still the part that must be chunked.

**How would you find out where the time actually goes?**
`PerformanceObserver` for `longtask` entries, `performance.mark`/`measure` for your own spans, and
the DevTools performance panel to see whether it is scripting or layout — which decides whether
chunking or fixing forced reflow is the right fix.

---

← [01 · Build off-document](./01-build-off-document.md) · [Topic index](./README.md) ·
**12 · Layout thrashing** *(not written yet)* →
