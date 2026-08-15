---
title: "01 · Timers: what the delay actually means"
sidebar_label: "01 · Timers"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`setTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout), [`setInterval()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setInterval), [`clearTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/clearTimeout), [`Window.requestIdleCallback()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback) — and the [HTML Standard § Timers](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#timers) and [Node.js Timers](https://nodejs.org/api/timers.html). Documentation-validated; **no timings and no console output**.

The number you pass to `setTimeout` is not "run this in 100 ms". It is **"do not run this
before 100 ms"** — a floor on a callback that then has to queue behind everything else the
main thread is doing. Every timer bug in a browser comes from reading it as a promise
instead of a floor.

## The one-sentence model

`setTimeout(fn, d)` asks the browser to **queue a task** for `fn` after at least `d`
milliseconds have elapsed. The task runs when the event loop next picks it up — after the
current task finishes, after every microtask drains, and after any task already ahead of it
([Phase 7 · 03 · The drain order](../../phase-7-async/03-microtasks-vs-macrotasks/01-the-drain-order.md)).

🔴 **Four separate things can push a timer late**, and only the first is under your control:

| Cause | Effect |
|---|---|
| The main thread is busy | The task waits for the current one to finish — a 300 ms handler delays every timer by up to 300 ms |
| **Nesting clamp** | From nesting level 5, delays below 4 ms become 4 ms |
| **Background-tab throttling** | Hidden tabs get ≥ 1 s; Chrome can drop to once per minute |
| Power / battery modes | Documented as implementation-defined, unbounded |

## The signature, including the parts people miss

```js
const id = setTimeout(callback, delay, ...args);
clearTimeout(id);
```

**Extra arguments after `delay` are passed to the callback.** This is the clean way to
capture a value without a closure:

```js
setTimeout(retry, 1000, request, attempt + 1);   // retry(request, attempt + 1)
```

⚠️ **`this` inside a non-arrow callback is the global object**, not the object the call was
written in. MDN documents this explicitly: the callback runs in a separate execution
context, so `this` becomes `globalThis` (the `Window`). An arrow function or an explicit
`.bind(this)` is the fix.

```js
class Poller {
  start() {
    setTimeout(function () { this.tick(); }, 1000);   // ❌ this is Window → TypeError
    setTimeout(() => this.tick(), 1000);              // ✅
  }
}
```

⛔ **Never pass a string.** `setTimeout("doThing()", 100)` is evaluated the way `eval` is —
MDN calls it a security risk, and a Content Security Policy without `unsafe-eval` blocks it
outright.

**The delay is stored as a 32-bit signed integer.** Anything above **2 147 483 647 ms**
(≈ 24.8 days) overflows, and the timer fires **immediately** instead of far in the future.
A "remind me in a month" timer is not a timer; it is a stored timestamp you check on load.

## The nesting clamp — where `setTimeout(fn, 0)` stops being 0

The HTML Standard defines a **nesting level** on timers: a timer scheduled from inside a
timer callback has its parent's level plus one. Once that level is **greater than 5** and
the requested delay is under **4 ms**, the delay is raised to **4 ms**.

```js
let n = 0;
(function loop() {
  n++;
  setTimeout(loop, 0);   // levels 1-5 are ~0; from level 6 the browser makes it 4 ms
})();
```

🔴 **This is why a `setTimeout(…, 0)` chain is not a fast loop.** It settles at roughly 250
iterations a second, whatever the machine. A single top-level `setTimeout(fn, 0)` is *not*
clamped by this rule — the clamp is about chains — but it is still a task, so it never runs
before the microtask queue drains.

**If what you wanted was "after this task, before rendering", that is `queueMicrotask`, not
a zero timer** ([Phase 7 · 03 · 02 · Using microtasks](../../phase-7-async/03-microtasks-vs-macrotasks/02-using-microtasks.md)).
If what you wanted was "in the next paint", that is `requestAnimationFrame`
([02 · Frames](./02-frames.md)). A zero timer is the answer to neither.

## `setInterval` has two failure modes, and both are silent

```js
setInterval(poll, 1000);
```

**1 · Drift.** The interval is measured from when the browser *schedules* the next run, not
from an absolute clock. Every late run pushes the following one later, and the error
accumulates. After an hour, an interval-driven clock is visibly wrong — and it is wrong by
an amount that depends on how busy the page was, so it is not reproducible.

**2 · Pile-up.** If the callback takes longer than the interval, the runs do not overlap
(JavaScript is single-threaded) but they **queue back to back with no gap**, and the page
never gets an idle moment again. An interval that calls `fetch` and awaits it is the usual
shape of this bug: the network gets slow, the interval does not.

🔴 **The fix for both is the same: chain a `setTimeout` instead of repeating an interval.**

```js
async function poll() {
  try { await refresh(); }
  finally { timer = setTimeout(poll, 1000); }   // next run scheduled only after this one ends
}
let timer = setTimeout(poll, 1000);
```

The gap is now guaranteed, the work never overlaps itself, and stopping is one
`clearTimeout`. The `finally` matters — without it, one rejection ends the poll silently
and forever.

### When the schedule genuinely must not drift

Correct against a real clock rather than trusting the timer:

```js
const started = performance.now();
let ticks = 0;

function tick() {
  ticks++;
  render(ticks);
  const drift = performance.now() - started - ticks * 1000;
  setTimeout(tick, Math.max(0, 1000 - drift));   // each run absorbs the accumulated error
}
setTimeout(tick, 1000);
```

⚠️ **Never derive elapsed time by counting ticks.** `ticks * 1000` is a fiction; the elapsed
time is `performance.now() - started`, and nothing else. This is the single most common
timer bug in a countdown, a stopwatch or a progress estimate — and it only shows up on a
slow machine or a backgrounded tab, which is to say, on a user's machine and not yours.

## Background tabs: the throttling that breaks polling

MDN documents a tiered set of throttles for timers in pages that are not visible:

| Situation | Documented behaviour |
|---|---|
| Tab hidden (Chrome, Firefox) | Timeouts throttled to **at least 1000 ms** |
| Chrome, hidden **more than 5 minutes**, chained timers, no audio playing and no active WebSocket/WebRTC | **Intensive throttling** — timer wake-ups aligned to **once per minute** |
| Firefox, tracking scripts in a background tab | Minimum delay raised to **10 000 ms**, starting a while after load |
| Hidden cross-origin iframes | Throttled with their parent, and budget-based in Chrome |

🔴 **A one-second poll in a background tab is a one-minute poll.** Anything that assumes
regular delivery — a session-expiry countdown, a "new messages" poll, an auto-save — is
wrong the moment the user switches tabs.

**What to do instead, in order of preference:**

1. **Do not poll.** A `WebSocket` or Server-Sent Events connection is not throttled the way
   a timer is, and it is the reason the audio/connection exemptions exist.
2. **Recompute from a timestamp on the way back.** Listen for `visibilitychange`, and on
   `'visible'` compute the truth from `Date.now()` rather than from how many ticks you got
   ([Phase 10 · 09 · 02 · Visibility and background throttling](../../phase-10-events/09-scroll-resize-visibility/02-visibility-and-lifecycle.md)).
3. **Stop the timer while hidden**, and restart it on the way back. A throttled timer still
   costs battery for a result you are about to discard.

```js
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { clearTimeout(timer); timer = null; }
  else { syncFromServer(); timer ??= setTimeout(poll, 1000); }
});
```

## Cancelling, and the id pool

`clearTimeout(id)` and `clearInterval(id)` both take the value the scheduler returned. Per
the HTML Standard the two share **one** map of active timers, so either function cancels
either kind — but write the matching one anyway, because the mismatch reads as a bug to
every reviewer.

**Clearing an id that has already fired, or an id that never existed, is a no-op** — there
is no error to catch and nothing to guard.

🔴 **In a browser the id is a positive integer, in Node it is a `Timeout` object.** Code that
stores a timer in a field and checks `if (timer > 0)` works in one and not the other; check
`!= null` instead. Node's timers also differ in the small print — a delay under 1 or above
2 147 483 647 becomes 1 ms, and `unref()`/`ref()` decide whether a pending timer keeps the
process alive. Neither has a browser equivalent.

**Every timer needs an owner that clears it.** A timer scheduled in a component that unmounts
keeps its closure — and everything the closure captured — alive until it fires:

```js
class Toast extends HTMLElement {
  #timer;
  connectedCallback()    { this.#timer = setTimeout(() => this.remove(), 4000); }
  disconnectedCallback() { clearTimeout(this.#timer); }
}
```

## The honest list of what replaces a timer

| What you were timing | The API that actually answers it |
|---|---|
| Animating a value over time | `requestAnimationFrame` ([02](./02-frames.md)) |
| "Has the user stopped typing" | a debounce — still a timer, and correctly so |
| "Give up on this request" | `AbortSignal.timeout()` — **Phase 11 · 08 · Aborting and timing out** *(not written yet)* |
| "Is this element visible yet" | `IntersectionObserver` — **04 · `IntersectionObserver`** *(not written yet)* |
| "Run when the page is idle" | `requestIdleCallback` / `scheduler` — **14 · Yielding to the main thread** *(not written yet)* |
| "Wait for the DOM to settle" | `MutationObserver` ([Phase 9 · 17](../../phase-9-dom/17-mutationobserver/README.md)) |
| Retrying with backoff | a timer, wrapped — **Phase 7 · 15 · Timeouts, retries, backoff** *(not written yet)* |

⚠️ **`setTimeout(…, 100)` used to "wait for the DOM to be ready" is always a bug.** It works
on your machine and fails on a slow one. Whatever you were waiting for has an event, a
promise or an observer.

## Gotchas

**Symptom: a countdown finishes minutes late after the user switched tabs.**
Cause — the timer was throttled while hidden and the code counted ticks.
Fix — store the target `Date.now()` and recompute on `visibilitychange`; never accumulate.

**Symptom: `this` is `undefined` or `Window` inside a `setTimeout` callback.**
Cause — the callback runs in its own execution context, with `this` set to the global object.
Fix — an arrow function, or `.bind(this)`.

**Symptom: a `setTimeout(fn, 0)` loop runs far slower than expected.**
Cause — the nesting clamp raises delays under 4 ms to 4 ms from nesting level 5.
Fix — accept it, or use `requestAnimationFrame` (visual work) or `MessageChannel`/`scheduler`
(non-visual chunking).

**Symptom: a polling interval hammers the server after the network gets slow.**
Cause — `setInterval` keeps queueing while an `await` inside the callback is still pending.
Fix — chain `setTimeout` from a `finally`, so the next run is scheduled only when this one ends.

**Symptom: a timer set for weeks in the future fires immediately.**
Cause — the delay overflowed the 32-bit signed limit of ≈ 24.8 days.
Fix — persist the target time and schedule in bounded steps, or check it on load.

**Symptom: a component is removed but its callback still runs and throws.**
Cause — nothing cleared the timer on teardown.
Fix — keep the id and `clearTimeout` in the teardown path; timer ids are not garbage-collected away.

**Symptom: `if (this.timer > 0)` behaves differently in Node and the browser.**
Cause — Node returns a `Timeout` object, the browser returns a number.
Fix — compare against `null`/`undefined`, not against zero.

## Interview questions

**★ What does the delay argument to `setTimeout` actually guarantee?**
Only a minimum. It schedules a **task** no earlier than the delay; the task then waits for the
current task and all microtasks to finish, and for anything already queued ahead of it. Nesting
clamps, background-tab throttling and a busy main thread can all push it later.

**★ Why does a chained `setTimeout(fn, 0)` settle at about 4 ms?**
The HTML Standard clamps timers whose **nesting level exceeds 5** to a minimum of 4 ms. The
first few links of the chain run at ~0; after that, every one is clamped.

**★ `setInterval` versus a chained `setTimeout` — when does the difference matter?**
Whenever the callback can take longer than the interval, or the schedule must not drift.
`setInterval` queues regardless of whether the last run finished, so slow work piles up
back-to-back; a chained `setTimeout` scheduled in a `finally` guarantees a gap and stops
cleanly.

**★ Your one-second poll runs once a minute. Why?**
The tab is hidden. Chrome's intensive throttling aligns timer wake-ups to once per minute
once a page has been hidden for more than five minutes with chained timers, no audio and no
active WebSocket/WebRTC. The fix is not a shorter interval — it is a connection that is not
throttled, or recomputing state on `visibilitychange`.

**★ How do you measure elapsed time correctly in a timer-driven loop?**
Subtract two `performance.now()` readings. Never multiply the tick count by the interval —
that number is what you *asked for*, not what happened.

**Can `clearInterval` cancel a `setTimeout`?**
Yes — the spec keeps one map of active timers, so the ids are interchangeable. Write the
matching call anyway; the mismatch looks like a mistake.

---

[Topic index](./README.md) · [02 · Frames and `requestAnimationFrame`](./02-frames.md) →
