---
title: "14 · Yielding to the main thread"
sidebar_label: "14 · Yielding to the main thread"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Scheduler.yield()`](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield), [`Scheduler.postTask()`](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/postTask), [`Window.requestIdleCallback()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback), [`IdleDeadline`](https://developer.mozilla.org/en-US/docs/Web/API/IdleDeadline), [`TaskController`](https://developer.mozilla.org/en-US/docs/Web/API/TaskController), [`PerformanceLongTaskTiming`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming), [Prioritized Task Scheduling API](https://developer.mozilla.org/en-US/docs/Web/API/Prioritized_Task_Scheduling_API). Documentation-validated; **no timings and no console output**. ⚠️ Support for `scheduler.yield`/`postTask` and `requestIdleCallback` is uneven — feature-detect, and check MDN's compatibility tables.

A task that runs for 200 ms is 200 ms in which a click cannot be handled and a frame cannot be
painted. **Yielding is how long work stops being one long task** — and it is the cheaper
alternative to a Web Worker, worth trying first ([07 · 03](./07-web-workers/03-deciding-and-patterns.md)).

## Why it matters, in one line

The browser can only respond between tasks. A **long task** — over 50 ms — is by definition a
window in which input sits waiting, which is exactly what INP measures
([06 · 03 · The metrics](./06-performanceobserver/03-the-metrics.md)).

## The four ways to yield, and what each costs

| Mechanism | Continuation runs | Use for |
|---|---|---|
| `await scheduler.yield()` | **ahead of** other tasks of the same priority | breaking up work you want to finish soon |
| `await new Promise(r => setTimeout(r, 0))` | at the **back** of the task queue | the universal fallback |
| `scheduler.postTask(fn, {priority})` | as a task at a chosen priority | scheduling a *unit* of work |
| `requestIdleCallback(fn)` | only when the browser is idle | work that can genuinely wait |

🔴 **`scheduler.yield()` is the one that fixes the classic problem.** Yielding with `setTimeout(0)`
puts your continuation behind everything else already queued — including other people's work — so
a loop that yields politely can take far longer to finish. `yield()` returns a promise whose
continuation is prioritised, so responsiveness improves *without* the work being starved.

```js
async function processAll(items) {
  let last = performance.now();
  for (const item of items) {
    process(item);
    if (performance.now() - last > 50) {           // 🔴 yield on TIME, not on count
      await yieldToMain();
      last = performance.now();
    }
  }
}

const yieldToMain = () =>
  'scheduler' in globalThis && 'yield' in scheduler
    ? scheduler.yield()
    : new Promise((r) => setTimeout(r, 0));
```

⚠️ **Yield on elapsed time, never every N items.** Item cost varies by machine and by data; a
count that is right on your laptop is a long task on a phone, or a pointless thousand yields on a
fast one.

## `scheduler.postTask`: priorities

```js
const controller = new TaskController({ priority: 'background' });

scheduler.postTask(() => buildSearchIndex(), { priority: 'background', signal: controller.signal });
scheduler.postTask(() => renderVisibleRows(), { priority: 'user-blocking' });

controller.setPriority('user-visible');   // 🔴 promote it when the user asks for it
controller.abort();                       // and cancel what is no longer wanted
```

| Priority | Meaning |
|---|---|
| `'user-blocking'` | the user is waiting on it right now |
| `'user-visible'` | default — visible, but not blocking |
| `'background'` | nobody is waiting |

**`TaskController` is the part worth remembering**: a task's priority can be *changed* after it is
queued, and it can be aborted with the same signal API as `fetch`. That is what makes "prefetch
this in the background, promote it when the user clicks" expressible.

## `requestIdleCallback`: only for work that can wait

```js
requestIdleCallback((deadline) => {
  while (deadline.timeRemaining() > 0 && queue.length) processOne(queue.shift());
  if (queue.length) requestIdleCallback(arguments.callee);
}, { timeout: 2000 });                      // 🔴 a timeout, or it may never run
```

The callback receives an `IdleDeadline` with `timeRemaining()` and `didTimeout`. **Respect
`timeRemaining()`** — ignoring it and running for 100 ms defeats the entire purpose, because idle
callbacks run in the gap before the next frame.

⚠️ **Without a `timeout` it may never fire on a busy page**, and it does not run at all in a
background tab. It is for analytics flushes, prefetching, cache warming, non-urgent logging — never
for anything the user is waiting to see.

## Deciding

```
Is the work needed for what the user is looking at right now?
├─ yes → do it, but chunk it and yield every ~50 ms
├─ soon → scheduler.postTask('user-visible'), or yield
├─ eventually → requestIdleCallback with a timeout
└─ it is CPU-heavy and self-contained → a Web Worker (07)
```

🔴 **Before any of this, ask whether the work is necessary.** Yielding makes 200 ms of work feel
better; not doing it is better still. Virtualise the list, paginate the data, index once instead of
scanning per keystroke, and let CSS `content-visibility` skip rendering what is off screen.

**`navigator.scheduling?.isInputPending()`** exists in some engines and answers "is a click waiting
right now" — a finer-grained signal than a fixed budget, and worth knowing about even though it is
not portable.

## Gotchas

**Symptom: the page responds better after chunking, but the job takes far longer.**
Cause — `setTimeout(0)` puts each continuation at the back of the queue.
Fix — `scheduler.yield()` where available; keep `setTimeout` only as the fallback.

**Symptom: chunking helps on desktop and not on mobile.**
Cause — yielding every N items rather than on measured time.
Fix — measure with `performance.now()` and yield past a ~50 ms budget.

**Symptom: an idle callback never runs.**
Cause — the page is never idle, or the tab is in the background.
Fix — pass a `timeout`; accept that idle work stops when hidden.

**Symptom: idle work still causes jank.**
Cause — the callback ignored `deadline.timeRemaining()`.
Fix — loop while there is time left and re-request for the rest.

**Symptom: a background task keeps running after the user navigated away.**
Cause — no signal.
Fix — `TaskController.abort()` in teardown; the same pattern as `AbortController`.

**Symptom: `scheduler is not defined`.**
Cause — the engine does not implement it.
Fix — the `yieldToMain` helper above, with a `setTimeout` fallback.

## Interview questions

**★ Why is `await new Promise(r => setTimeout(r, 0))` a poor way to yield?**
Because the continuation goes to the back of the task queue behind everything already scheduled,
so the work can be starved while the page stays responsive. `scheduler.yield()` prioritises the
continuation, giving responsiveness without the starvation.

**★ How do you decide when to yield inside a loop?**
On elapsed time — track `performance.now()` and yield once you pass roughly 50 ms, the threshold at
which a task counts as long. Counting items bakes in an assumption about per-item cost that is
wrong on a different device.

**★ When is `requestIdleCallback` the right tool?**
For work nobody is waiting for: flushing analytics, warming a cache, prefetching. Always with a
`timeout`, because a busy page may never be idle — and never for anything the user expects to see.

**★ What does `TaskController` add over `AbortController`?**
Priority. A task can be posted as `background` and later promoted to `user-visible` when the user
asks for it, using the same signal that can also abort it.

**★ Yielding or a Web Worker?**
Yield when the work must touch the DOM or is naturally chunkable; a worker when it is CPU-bound,
self-contained and long enough to justify the message cost. Yielding is cheaper to adopt, so it is
the thing to try first.

**What beats both?**
Doing less: virtualising, paginating, indexing once, and letting `content-visibility` skip
off-screen rendering.

---

← [13 · What belongs on the server](./13-what-belongs-on-the-server/README.md) · [Phase index](./README.md) · [15 · Cross-tab coordination](./15-cross-tab-coordination/README.md) →
