---
title: "02 · Why `0` is not `0`"
sidebar_label: "02 · Why 0 is not 0"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against the [HTML Standard § Timers](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#timers) (timer initialisation steps, including the nesting clamp) and MDN — [`setTimeout()` § Reasons for delays longer than specified](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout#reasons_for_delays_longer_than_specified), [`Window: setTimeout()` § Nested timeouts](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout), [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API), [Node.js `timers`](https://nodejs.org/api/timers.html). Documentation-validated; **no timings, no console blocks**.

`setTimeout(fn, 0)` does not mean "run `fn` now". It does not even mean "run `fn` in zero
milliseconds". Read the specification's own wording and the promise is much weaker:

> **wait until *at least* `timeout` milliseconds have passed, then queue a task to run the
> callback.**

Two separate weakenings hide in that sentence. **"At least"** — the delay is a floor, never a
target. And **"queue a task"** — after the wait, your callback is not run; it *joins a queue*,
behind everything already in it.

🔴 **The mental model that survives every interview question:** `delay` is the earliest moment
your callback becomes *eligible* to run. When it actually runs is the event loop's decision,
and the event loop has four reasons to make you wait longer.

## The four things standing between you and your callback

| # | What delays you | How much |
|---|---|---|
| 1 | **The task queue** — a timer callback is a *task*, so the whole microtask queue drains first | unbounded |
| 2 | **The nesting clamp** — after five nested timers, the minimum becomes 4 ms | ≥ 4 ms |
| 3 | **Throttling** — background tabs, and stricter budgets after that | ≥ 1000 ms, or worse |
| 4 | **A busy main thread** — a long synchronous task cannot be interrupted | as long as that task |

Only the first is about ordering. The other three are about the clock, and all four are
routinely blamed on "`setTimeout` is inaccurate" when the code is doing it to itself.

### 1 · A timer is a task, so microtasks always win

```js
setTimeout(() => console.log('timeout'), 0);
Promise.resolve().then(() => console.log('microtask'));
console.log('sync');
```

`sync`, then `microtask`, then `timeout` — **regardless of the `0`**. The microtask queue is
drained to completion between tasks, so every pending `.then`, `await` continuation and
`queueMicrotask` callback runs before the timer gets a turn. That ordering, and why it holds in
both the browser and Node, is
[03 · The drain order](../03-microtasks-vs-macrotasks/01-the-drain-order.md).

⚠️ **A microtask that schedules another microtask can starve the timer indefinitely.** The loop
does not move on to tasks until the microtask queue is empty, so an unbounded `.then` chain
means your `setTimeout(…, 0)` never runs at all. That is a livelock, not a slow timer.

### 2 · The nesting clamp: 4 ms after five levels

This is the specification detail people are surprised by, and it is written into the timer
initialisation steps: the browser tracks a **nesting level** for timers scheduled from inside
timer callbacks, and once that level is greater than five, **a requested timeout below 4 ms is
raised to 4 ms**.

```js
let n = 0;
(function tick() {
  if (++n > 1000) return;
  setTimeout(tick, 0);   // levels 1–5 honour the 0; level 6 onward is clamped to 4 ms
})();
```

🔴 **The consequence: a self-rescheduling `setTimeout(…, 0)` loop settles at roughly 250
iterations per second, not "as fast as possible".** That is why `setTimeout(fn, 0)` is a poor
tool for chunking a long computation — the clamp makes it slow, and the first five iterations
run at a different rate from the rest, which is a wonderful way to mis-measure your own code.

The clamp is **per nesting chain**, not global: an independent `setTimeout(fn, 0)` scheduled
from a click handler starts at level one and is not clamped. Node applies its own floor
instead — a delay below `1` is set to `1`.

**What to use instead of a `setTimeout(0)` loop**, in order of preference: a `MessageChannel`
port message (a task with no clamp), the modern `scheduler.yield()` / `scheduler.postTask()`
APIs, or a Web Worker if the work does not need the DOM at all. Yielding to the main thread
properly is **Phase 12 · 14 · Yielding to the main thread** *(not written yet)*.

### 3 · Throttling: the tab you are not looking at

**MDN documents a floor of 1000 ms for timeouts in inactive tabs** — the tab is backgrounded,
so the browser stops honouring anything faster. Browsers then layer stricter policies on top:

| Policy | Effect |
|---|---|
| Inactive tab | timers clamped to **≥ 1 s** |
| Chrome *intensive throttling* | after the page has been hidden a few minutes, timers may run **once per minute** |
| Firefox tracking-script budget | timers in scripts classified as tracking get a throttled budget |
| `requestAnimationFrame` | **stops entirely** in a background tab |

🔴 **This breaks the two things people build out of timers most often: countdowns and
polling.** A countdown that decrements a counter once per tick loses minutes while the tab is
hidden, then shows the wrong number when the user returns. A poller set to five seconds
quietly becomes a one-minute poller, and the "live" dashboard is stale.

Neither is fixed by a different delay. They are fixed by not trusting ticks:

```js
// ✅ read the clock; the number of ticks is irrelevant
const deadline = Date.now() + 5 * 60_000;
const id = setInterval(() => {
  const left = Math.max(0, deadline - Date.now());
  render(left);
  if (left === 0) clearInterval(id);
}, 1000);

// ✅ and catch up the moment the tab comes back
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshNow();
});
```

The full argument for timestamp-anchored work is
[03 · Drift and repeating work](./03-drift-and-repeating-work.md); the visibility half belongs
to [Phase 10 · 09 · Visibility and lifecycle](../../phase-10-events/09-scroll-resize-visibility/02-visibility-and-lifecycle.md).

### 4 · A busy main thread simply does not check the clock

```js
setTimeout(() => console.log('after 10ms'), 10);
blockFor(3000);                    // a synchronous 3-second loop
```

The callback cannot run until the stack is empty, so it fires after roughly three seconds. The
timer was never inaccurate — **the loop had no opportunity to look**. MDN files this under
"reasons for delays longer than specified", and it is the honest explanation for most timer
bugs in a real application: a large `JSON.parse`, a synchronous layout, a 10 000-row render.

⚠️ **This is also why timers make bad benchmarks.** The gap between two timer callbacks
measures your own main thread far more than it measures the timer.

## So when *is* `setTimeout(fn, 0)` the right tool?

It has exactly one honest job: **"let the browser get on with things, then continue."** Because
a timer is a task, scheduling one yields the thread back to the event loop, and the browser can
run other tasks, style, layout and paint before your callback.

| You want | Use |
|---|---|
| run after the current call stack, **before** rendering | `queueMicrotask` — **18 · `queueMicrotask`** *(not written yet)* |
| let the browser **paint** first | `setTimeout(fn, 0)`, or better `scheduler.yield()` |
| run before the **next** paint | `requestAnimationFrame` |
| break a long job into pieces | `scheduler.postTask()`, `MessageChannel`, or a Worker |

🔴 **`setTimeout(fn, 0)` is not a fix for a race condition.** Reaching for it because "the DOM
isn't ready yet" or "the state hasn't updated yet" buys a delay that happens to be long enough
on your machine today. The value that makes it work is not a value you control. Find the event
that actually signals readiness — the `load`, the promise, the framework's own callback — and
wait on that instead. This is a named anti-pattern; the family it belongs to is
[11 · Promise anti-patterns](../11-anti-patterns/01-explicit-construction.md).

## Gotchas

**Symptom: `setTimeout(fn, 0)` runs after a `.then` that was scheduled later.**
Cause — timers are tasks; the microtask queue drains completely between tasks.
Fix — none needed; this is the specified order. Use `queueMicrotask` if you need the earlier slot.

**Symptom: a `setTimeout(…, 0)` loop processes only a couple of hundred items per second.**
Cause — the nesting clamp raises the minimum to 4 ms after five nested timers.
Fix — `MessageChannel`, `scheduler.postTask()`, or a Worker.

**Symptom: a countdown is minutes wrong after the user switches tabs and back.**
Cause — background throttling; ticks were skipped, and the code counted ticks.
Fix — compute from a stored deadline and `Date.now()`; refresh on `visibilitychange`.

**Symptom: polling every 5 s becomes polling every minute on a hidden tab.**
Cause — intensive throttling of timers in backgrounded pages.
Fix — accept it and re-sync on `visibilitychange`, or move the work to a service worker.

**Symptom: a 10 ms timer fires three seconds late.**
Cause — a long synchronous task held the main thread; the loop never got to check.
Fix — break the work up or move it off-thread. The timer is not the problem.

**Symptom: a `setTimeout(…, 0)` never fires at all.**
Cause — a microtask chain that keeps re-queueing itself, so the loop never reaches tasks.
Fix — break the chain, or move the recursive step into a task.

**Symptom: "it works if I wrap it in `setTimeout(…, 0)`".**
Cause — a real ordering bug, papered over by yielding once.
Fix — wait on the actual signal. A timer that fixes a race will un-fix it on slower hardware.

## Interview questions

**★ What does the `0` in `setTimeout(fn, 0)` actually mean?**
"Wait at least zero milliseconds, then **queue a task**." It sets the earliest moment the
callback becomes eligible, not when it runs — the whole microtask queue, the clamp, throttling
and any running task all come first.

**★ Predict the order: `setTimeout(…, 0)`, `Promise.resolve().then(…)`, and a `console.log`.**
Synchronous log, then the promise callback, then the timeout. Microtasks drain to completion
between tasks, and a timer callback is a task.

**★ What is the 4 ms clamp, and when does it apply?**
The HTML timer steps track a nesting level; once a timer is scheduled more than five levels
deep from inside timer callbacks, a requested delay under 4 ms is raised to 4 ms. It caps a
self-rescheduling `setTimeout(…, 0)` loop at roughly 250 iterations per second.

**★ Why is a `setTimeout`-based countdown wrong after the tab is backgrounded?**
Timers in inactive tabs are clamped to at least a second and may be throttled far harder, so
ticks are skipped. Counting ticks accumulates the loss; reading `Date.now()` against a stored
deadline does not.

**★ Your 10 ms timer fired 3 s late. What is the first thing you look at?**
Not the timer — the main thread. A long synchronous task blocks the event loop, and the
callback cannot run until the stack empties.

**★ When is `setTimeout(fn, 0)` legitimately the right call?**
When you deliberately want to yield to the event loop so the browser can render before your
work continues. If you want to run *before* rendering, that is `queueMicrotask` or
`requestAnimationFrame` instead.

**Why is `setTimeout(fn, 0)` a bad way to chunk a long computation?**
The nesting clamp makes each step cost at least 4 ms, so throughput collapses.
`scheduler.postTask()`, a `MessageChannel` message or a Worker have no such floor.

---

← [01 · The API and clearing](./01-the-api.md) · [Topic index](./README.md) ·
[03 · Drift and repeating work](./03-drift-and-repeating-work.md) →
