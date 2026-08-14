---
title: "03.2 · throttle"
sidebar_label: "02 · throttle"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`setTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout), [`Date.now()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now), [`performance.now()`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now), [`requestAnimationFrame()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame). Documentation-validated; **no timings**.

**Throttle enforces a rate.** While calls keep coming, the function runs at most once per interval
— it does not wait for quiet, which is the entire difference from debounce.

## The two implementations, and why they differ

**Timestamp-based** — leading edge, no trailing call:

```js
function throttle(fn, interval) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= interval) {
      last = now;
      return fn.apply(this, args);
    }
  };
}
```

**Timer-based** — trailing edge, fires after the interval:

```js
function throttle(fn, interval) {
  let timer = null;
  let lastArgs, lastThis;
  return function (...args) {
    lastArgs = args;
    lastThis = this;
    if (timer === null) {
      timer = setTimeout(() => {
        timer = null;
        fn.apply(lastThis, lastArgs);
      }, interval);
    }
  };
}
```

🔴 **These are not two ways of writing the same thing.** The first fires **immediately** and drops
the tail — the last call in a burst never runs. The second fires **at the end** of each interval,
so the final position is always delivered but the first is delayed.

**For a scroll handler that positions a sticky header, the difference is visible**: the timestamp
version reacts instantly and can leave the header one frame stale when scrolling stops; the timer
version is always correct at rest but starts a beat late. Most real uses want **both edges**.

## Both edges

```js
function throttle(fn, interval, { leading = true, trailing = true } = {}) {
  let last = 0;
  let timer = null;
  let lastArgs = null;
  let lastThis = null;

  function run(time) {
    last = time;
    timer = null;
    fn.apply(lastThis, lastArgs);
    lastArgs = lastThis = null;                       // 🔴 release the references
  }

  function throttled(...args) {
    const now = Date.now();
    if (!last && !leading) last = now;                // suppress the first call

    const remaining = interval - (now - last);
    lastArgs = args;
    lastThis = this;

    if (remaining <= 0 || remaining > interval) {     // 🔴 the clock-jump guard
      if (timer) { clearTimeout(timer); timer = null; }
      run(now);
    } else if (!timer && trailing) {
      timer = setTimeout(() => run(Date.now()), remaining);
    }
  }

  throttled.cancel = () => {
    clearTimeout(timer);
    timer = null;
    last = 0;
    lastArgs = lastThis = null;
  };

  return throttled;
}
```

⚠️ **`remaining > interval` is the clock-jump guard.** `Date.now()` is wall-clock time and can move
**backwards** — NTP correction, a user changing the system clock, a laptop resuming from sleep.
Without the guard, a backwards jump makes `remaining` larger than the interval and the function
stops firing until the clock catches up.

🔴 **`performance.now()` is monotonic and does not have this problem**, and is the better choice
for measuring elapsed time. `Date.now()` is used above because it is what most implementations
show; naming the difference is the stronger answer.

## Which one, and when

| Need | Use |
|---|---|
| Search-as-you-type | **debounce**, trailing |
| Submit button (prevent double-submit) | **debounce**, leading + no trailing |
| Scroll position, sticky headers | **throttle**, both edges |
| Resize handler recomputing layout | **debounce** — you only care about the final size |
| Analytics events during a drag | **throttle** — you want a sample, not the last one |
| Rate-limiting API calls | **throttle**, plus a queue if calls must not be dropped |
| Animating on scroll | 🔴 **neither — `requestAnimationFrame`** |

🔴 **For anything that paints, `requestAnimationFrame` beats both.** It fires once per frame,
aligned with the browser's paint, so it cannot produce more work than the display can show and it
does not run in a background tab:

```js
function rafThrottle(fn) {
  let queued = false;
  let lastArgs;
  return function (...args) {
    lastArgs = args;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn.apply(this, lastArgs);
    });
  };
}
```

⚠️ **A `setTimeout`-based throttle at 16 ms is not the same thing** — it is not aligned to the
paint, so it can fire twice in one frame or miss one, and it keeps running when the tab is hidden.

## Both share the same lifecycle problems

**They hold references.** A pending timer keeps `lastThis` and `lastArgs` alive, which is the
component-retention leak from [01 · `debounce`](./01-debounce.md). 🔴 **Both need `cancel` in
teardown.**

**They must be created once.** A throttled function rebuilt every render has a fresh `last` and
`timer`, so it throttles nothing — the same trap, and it is worth stating for both.

**Neither is a rate limiter for a shared resource.** They are per-closure and per-tab: two
components each with their own throttled fetch make two requests per interval, and two browser tabs
double it again. **A real rate limiter is server-side or shared state**
([Phase 11 · 03 · 06 · Retries](../../phase-11-network-storage/03-fetch-wrapper/06-retries.md)).

## Gotchas

**Symptom:** The last event in a burst is lost
**Cause:** A leading-edge-only (timestamp) throttle.
**Fix:** Add the trailing edge.

**Symptom:** The first event is delayed
**Cause:** A trailing-edge-only (timer) throttle.
**Fix:** Add the leading edge.

**Symptom:** A throttled function stops firing
**Cause:** `Date.now()` jumped backwards — NTP, a manual clock change, or resume from sleep.
**Fix:** The `remaining > interval` guard, or use `performance.now()`.

**Symptom:** Throttling has no effect in a component
**Cause:** The throttled function is recreated each render, so `last` and `timer` reset.
**Fix:** Create it once.

**Symptom:** A component is retained after unmount
**Cause:** A pending timer holding `this` and the arguments.
**Fix:** `cancel` in teardown.

**Symptom:** Scroll animation is janky despite throttling at 16 ms
**Cause:** `setTimeout` is not aligned to the paint and can fire twice in a frame or miss one.
**Fix:** `requestAnimationFrame`.

**Symptom:** Work continues in a background tab
**Cause:** `setTimeout` keeps running (throttled by the browser, but running).
**Fix:** `requestAnimationFrame` does not fire in a hidden tab.

**Symptom:** Two components each make one request per interval
**Cause:** Throttling is per-closure, not global.
**Fix:** Share the throttled function, or rate-limit server-side.

## Interview questions

**★ Debounce or throttle — how do you choose?**
Debounce when only the **final** state matters and you can wait for quiet: search-as-you-type,
resize, autosave. Throttle when you need a **steady rate** during continuous activity: scroll
position, drag analytics. And for anything that paints, `requestAnimationFrame` beats both.

**★ Write a throttle. Which edge does yours fire on?**
The timestamp version fires on the **leading** edge and drops the tail; the timer version fires on
the **trailing** edge and delays the first call. They are genuinely different behaviours, so say
which you implemented — most real uses want both edges.

**★ What is the `remaining > interval` check for?**
A clock jump. `Date.now()` is wall-clock and can move backwards — NTP correction, a manual change,
resume from sleep — which would otherwise stop the function firing until the clock caught up.
`performance.now()` is monotonic and avoids it.

**★ Why is `requestAnimationFrame` better than a 16 ms throttle for animation?**
It is aligned with the browser's paint, so it cannot produce more work than the display can show,
it never fires twice in a frame, and it does not run in a hidden tab. A `setTimeout` at 16 ms
gives none of those guarantees.

**★ What do debounce and throttle share as bugs?**
Both must be **created once** — rebuilt per render, they throttle and debounce nothing. Both
**retain `this` and the arguments** in a pending timer, so both need `cancel` in teardown.

**★ Can you use a throttle as a rate limiter?**
Not for a shared resource. It is per-closure and per-tab, so two components or two tabs multiply
the rate. Real rate limiting is server-side, or at least shared state.

**Why does the timer-based version need `lastArgs` and `lastThis` as outer variables?**
Because the call that schedules the timer is usually not the call whose arguments should be used —
the most recent call's arguments are, and they arrive after the timer was set.

---

← [01 · debounce](./01-debounce.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
