---
title: "03 · Drift, and repeating work properly"
sidebar_label: "03 · Drift and repeating work"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`setInterval()` § Ensure that execution duration is shorter than interval frequency](https://developer.mozilla.org/en-US/docs/Web/API/Window/setInterval), [`setTimeout()` § Reasons for delays longer than specified](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout#reasons_for_delays_longer_than_specified), [`Performance.now()`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now), [`Date.now()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now), [`requestAnimationFrame()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) — and the [HTML Standard § Timers](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#timers). Documentation-validated; **no timings, no console blocks**.

[02](./02-why-zero-is-not-zero.md) established that a single timer fires *no earlier* than its
delay, and often much later. Repeat that a thousand times and the small, unpredictable lateness
of each tick becomes the defining behaviour of your program.

🔴 **The rule this whole page reduces to: never count ticks. Read a clock.** Every timer bug
that survives code review — the countdown that ends early, the "every 5 minutes" job that runs
every 4 minutes 50, the progress bar that finishes before the work does — is a program that
believed *n* ticks of `setInterval(fn, 1000)` meant *n* seconds had passed.

## `setInterval` versus a self-rescheduling `setTimeout`

They look interchangeable and guarantee different things:

```js
// A — setInterval: aims at a fixed period
const id = setInterval(poll, 5000);

// B — recursive setTimeout: a fixed GAP after the work finishes
(function loop() {
  poll();
  setTimeout(loop, 5000);
})();
```

| | `setInterval` | recursive `setTimeout` |
|---|---|---|
| The 5000 measures | period between **starts** (as scheduled) | gap between **end** of one run and start of the next |
| If the callback takes 6 s | the next run is already due | the next run starts 5 s *after* it finished |
| Callback overlap | possible for **async** work | impossible for sync work; **still possible for async work** |
| Changing the delay | needs clear + re-create | just pass a different number next time |
| Cancelling | `clearInterval(id)` | `clearTimeout(id)` — and you must hold the *current* id |
| Backing off after an error | ❌ not expressible | ✅ trivially |

**MDN's own guidance is explicit**: if there is any chance the work takes longer than the
interval, use a recursive named `setTimeout` instead — and the example it gives is exactly the
common one, polling a remote server every five seconds, where latency and an unresponsive
server leave you with queued-up requests that need not return in order.

🔴 **That last clause is the real damage.** The bug is not "an extra request". It is that
response #3 can land after response #4, and the newest data on screen gets overwritten by older
data. Timers turn into a lost-update bug, which is the same failure mode as
**17 · Race conditions in a UI** *(not written yet)*.

### Async callbacks overlap under *both* shapes

Neither form waits for a promise, so the naive `async` version of either can re-enter:

```js
setInterval(async () => { await fetchStatus(); }, 5000);   // ❌ overlaps if fetch takes > 5 s
```

The fix is to make the *next* schedule the last thing the completed work does:

```js
async function loop({ signal }) {
  while (!signal.aborted) {
    try {
      await fetchStatus({ signal });
    } catch (err) {
      if (signal.aborted) return;
      report(err);
    }
    await delay(5000, { signal });     // the `delay` helper from 01
  }
}
```

**One run at a time, by construction** — no guard flag, no `isRunning` boolean, and one place
to cancel. The retry-and-backoff refinement of this shape is
**15 · Timeouts, retries, backoff and jitter** *(not written yet)*.

## Drift: why the lateness accumulates

Each fire is late by some unknown amount — a busy main thread, the clamp, a throttled tab. Two
different things then go wrong, and they are worth separating:

**Cadence drift.** A recursive `setTimeout(loop, 1000)` re-arms *after* the callback ran, so
every tick's lateness plus the callback's own duration is added to the next tick's start. Sixty
"seconds" is reliably more than a minute, and the excess grows without bound.

**Counting drift.** Anything that derives a *value* from the number of ticks — `secondsLeft--`,
`progress += 1` — is wrong the moment a single tick is skipped or delayed. Background
throttling ([02](./02-why-zero-is-not-zero.md)) skips ticks by the hundred.

⚠️ **`setInterval` fixes neither.** It re-arms on its own schedule rather than after your
callback, which keeps the *average* rate closer to the target, but individual ticks still land
late and throttling still drops them entirely. The period is a request, not a contract.

### The self-correcting scheduler

Anchor to a timestamp taken once, and compute the next delay from where you *should* be:

```js
function everySecond(tick, { signal } = {}) {
  const start = performance.now();
  let count = 0;

  function schedule() {
    count += 1;
    const target = start + count * 1000;               // where tick #count belongs
    const wait = Math.max(0, target - performance.now());  // correct for however late we are
    const id = setTimeout(() => {
      if (signal?.aborted) return;
      tick(count);
      schedule();
    }, wait);
    signal?.addEventListener('abort', () => clearTimeout(id), { once: true });
  }

  schedule();
}
```

Every tick's delay is computed against the anchor, so **a late tick shortens the next wait
instead of pushing it further out**. Nothing accumulates. If the page was hidden long enough
that several targets have already passed, `wait` clamps to `0` and the loop catches up on the
next turn — decide deliberately whether to replay those ticks or skip to the current one.

### `performance.now()` for durations, `Date.now()` for deadlines

| | `performance.now()` | `Date.now()` |
|---|---|---|
| Origin | page load (or worker start) | the Unix epoch |
| Monotonic | ✅ never goes backwards | ❌ follows the system clock |
| Survives a reload | ❌ | ✅ |
| Use it for | elapsed time, scheduling, animation | wall-clock deadlines, timestamps you persist |

🔴 **`Date.now()` can jump backwards.** An NTP correction or a user changing the system clock
moves it, and a scheduler that subtracts two `Date.now()` readings can compute a negative
elapsed time and fire a burst of catch-up ticks. Use `performance.now()` for anything measuring
a duration; keep `Date.now()` for "this session expires at 14:05", which must survive a reload
and therefore has to be wall-clock.

## Do not animate with timers

A timer cannot align with the display's refresh, so timer-driven animation tears and stutters —
and in a background tab it either keeps burning work or is throttled to a crawl.
`requestAnimationFrame` is the documented answer: the browser calls you once per frame, before
paint, and **stops calling you entirely while the tab is hidden**.

```js
// ❌ approximately 60 fps, on a good day, on this machine
setInterval(() => { x += 2; el.style.left = `${x}px`; }, 16);

// ✅ frame-aligned, and driven by elapsed time rather than frame count
let startTs;
requestAnimationFrame(function frame(ts) {
  startTs ??= ts;
  const elapsed = ts - startTs;
  el.style.left = `${(elapsed / 1000) * 120}px`;    // 120 px per second, whatever the frame rate
  if (elapsed < 2000) requestAnimationFrame(frame);
});
```

**The same "read a clock" rule applies inside `rAF`.** Moving by a fixed number of pixels per
frame means the animation runs at different speeds on a 60 Hz and a 144 Hz display, and pauses
and resumes wrong across a hidden tab. `rAF` hands you a timestamp precisely so you do not have
to count frames. Frames, the clamp and the paint pipeline in full are
**Phase 12 · 03 · Timers and frames** *(not written yet)*.

## Re-entrancy and teardown

Two disciplines make repeating timers safe, and both are one line:

```js
let id = null;

function restart(delay) {
  clearTimeout(id);                 // 🔴 always clear before scheduling
  id = setTimeout(run, delay);
}
```

**Clear before you schedule.** A `restart()` called twice without the clear leaks a timer that
nobody holds an ID for — it cannot be cancelled, and it will fire. This is how a debounce ends
up firing three times, and how an interval that is "cleared on unmount" survives it.

**Own the teardown.** A repeating timer must have exactly one owner and one cancel path,
ideally an `AbortSignal` shared with the listeners and requests it drives
([01](./01-the-api.md)). A pending timer holds its closure alive, which is the leak catalogued
in [Phase 8 · 04 · The four leaks](../../phase-8-modules-errors/04-leaks/02-the-four-leaks.md).

## Gotchas

**Symptom: an "every 60 seconds" job drifts minutes off over a day.**
Cause — cadence drift; each re-arm adds the previous tick's lateness and the callback's duration.
Fix — compute the next delay from a fixed anchor: `target - performance.now()`.

**Symptom: a countdown reaches zero late, or shows the wrong number after the tab was hidden.**
Cause — the value was derived from tick count, and ticks were throttled away.
Fix — store the deadline and render `deadline - Date.now()` on every tick.

**Symptom: polling piles up requests, and stale data overwrites fresh data.**
Cause — `setInterval` with an async callback; responses return out of order.
Fix — re-schedule only after the previous request settles, and key responses to their request.

**Symptom: elapsed time comes out negative, or a burst of ticks fires at once.**
Cause — `Date.now()` moved backwards or forwards with the system clock.
Fix — measure durations with `performance.now()`.

**Symptom: an animation runs at double speed on a high-refresh-rate monitor.**
Cause — the animation moves a fixed amount per frame.
Fix — drive it from the `rAF` timestamp, in units per second.

**Symptom: a timer keeps firing after the component unmounted.**
Cause — a re-schedule ran between the last `clearTimeout` and teardown, so the live ID was not
the one that was cleared.
Fix — clear before every schedule, keep one handle, and cancel through a single `AbortSignal`.

**Symptom: the interval callback occasionally runs twice in quick succession.**
Cause — a late tick followed immediately by the next scheduled one.
Fix — expect it: make the callback idempotent, or guard it with a single-flight loop.

## Interview questions

**★ `setInterval(fn, 1000)` versus a recursive `setTimeout(fn, 1000)` — what is the difference?**
`setInterval` aims at a fixed period between starts; the recursive `setTimeout` guarantees a
fixed gap after the previous run *finishes*. If the callback can take longer than the interval,
the recursive form is the one that cannot overlap — MDN recommends it for exactly that case.

**★ Why does a `setInterval` clock drift, and how do you fix it?**
Because each fire is late by an unpredictable amount and throttling can drop ticks entirely, so
counting ticks accumulates the error. Fix by anchoring: record a start time, compute each
tick's target, and set the next delay to `target - performance.now()`.

**★ What goes wrong with `setInterval(async () => { await fetch(...) }, 5000)`?**
Nothing waits for the promise, so a request slower than 5 s overlaps with the next one.
Responses can then return out of order and older data overwrites newer. Re-schedule after the
request settles instead.

**★ `performance.now()` or `Date.now()`?**
`performance.now()` for durations — it is monotonic and cannot go backwards. `Date.now()` for
wall-clock deadlines you persist or show to a user, accepting that the system clock can move.

**★ Why not animate with `setInterval(fn, 16)`?**
It has no relationship to the display refresh, so frames tear and stutter, and it keeps running
(or is heavily throttled) in a hidden tab. `requestAnimationFrame` runs before paint, once per
frame, and stops in a background tab.

**★ Why does clearing before scheduling matter?**
Because scheduling without clearing orphans the previous timer — no one holds its ID, so it can
never be cancelled, and it fires anyway. It is the standard cause of a "debounced" handler that
still runs several times.

**Can a repeating timer's callbacks overlap?**
Not for synchronous callbacks — the event loop runs one task at a time. For `async` callbacks,
yes, under both `setInterval` and a recursive `setTimeout` that re-arms before awaiting.

---

← [02 · Why `0` is not `0`](./02-why-zero-is-not-zero.md) · [Topic index](./README.md)
