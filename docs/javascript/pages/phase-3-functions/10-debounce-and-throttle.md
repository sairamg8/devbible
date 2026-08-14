---
title: "10 · Debounce and throttle"
sidebar_label: "10 · Debounce and throttle"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`setTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout), [`clearTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/clearTimeout), [`requestAnimationFrame()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), [`Element: input` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/input_event). Documentation-validated; **no timings**.

**Both are closures over a timer** — which is why they live in this phase — and the question this
page answers is *which one*, not *how*.

🔵 **The implementations, with `cancel`/`flush`, both throttle edges, the clock-jump guard and the
return-value problem, are
[Phase 17 · 03 · `debounce` and `throttle`](../phase-17-machine-coding/03-debounce-throttle/README.md).**
This page is the concept and the choice; that page is the code.

## The difference in one line

> **Debounce waits for quiet. Throttle enforces a rate.**

```js
// debounce: runs once, `wait` after the calls STOP
let timer;
const debounced = (...args) => {
  clearTimeout(timer);                                   // 🔴 the reset is what makes it debounce
  timer = setTimeout(() => fn(...args), wait);
};

// throttle: runs at most once per `interval` WHILE calls continue
let last = 0;
const throttled = (...args) => {
  const now = Date.now();
  if (now - last < interval) return;                     // 🔴 the gate is what makes it throttle
  last = now;
  fn(...args);
};
```

**Ten rapid calls, `wait`/`interval` = 100 ms:**

| | Calls that run |
|---|---|
| Debounce | **1** — the last, 100 ms after the burst ends |
| Throttle | **~1 per 100 ms** during the burst |

🔴 **So debounce can run *never*** if the calls never stop — a resize handler on a window being
dragged continuously fires nothing until the drag ends. That is usually correct for resize and
wrong for a scroll-position indicator, and it is the sharpest way to feel the difference.

## Why both are closures

Each returns a function that keeps a private timer or timestamp alive between calls. Nothing else
in the language gives you per-instance private state on a plain function
([06 · Closures](./06-closures/README.md)).

🔴 **Which is why creating them inside a render or a loop breaks them completely.** A new closure
means a new timer, so nothing ever cancels anything and every call fires. It is the single most
common mistake with both, and it is a *closure* mistake rather than a timing one — which is why
the topic sits here.

```js
// ❌ a new debounced function per render → a fresh timer per keystroke
function Search() {
  const onChange = debounce(search, 300);
  …
}
```

## Choosing

| Situation | Use | Why |
|---|---|---|
| Search-as-you-type | **debounce** | only the final term matters |
| Autosave a form | **debounce** | save once the user pauses |
| Resize recalculation | **debounce** | only the final size matters |
| Submit button | **debounce, leading only** | act now, ignore repeats |
| Scroll position / sticky header | **throttle** | a steady sample during continuous movement |
| Drag or mousemove analytics | **throttle** | you want samples, not the last one |
| Infinite-scroll trigger | **throttle** | must fire *during* the scroll |
| Anything that paints | 🔴 **`requestAnimationFrame`** | frame-aligned, and idle in a hidden tab |

**The test:** *"do I need this to run while the activity continues?"* Yes → throttle. No → debounce.

⚠️ **`requestAnimationFrame` is a third option, not a variant of these two.** For animation and
layout reads it beats both — it cannot produce more work than the display can show, and it does not
run in a background tab.

## The two things that bite in both

🔴 **They hold references.** A pending timer keeps its arguments and receiver alive, so a handler
attached to a removed component retains that component
([Phase 8 · 04 · Leaks](../phase-8-modules-errors/04-leaks/README.md)). **Both need a `cancel` in
teardown** — which is why the implementations carry one.

🔴 **Neither is a rate limiter for a shared resource.** They are per-closure and per-tab: two
components with their own throttled fetch make two requests per interval, and two tabs double it
again. Real rate limiting is server-side
([Phase 11 · 03 · 06 · Retries](../phase-11-network-storage/03-fetch-wrapper/06-retries.md)).

## Gotchas

**Symptom:** A debounced handler never runs
**Cause:** The calls never stop — debounce waits for quiet.
**Fix:** Throttle if it must run during the activity.

**Symptom:** Debouncing or throttling has no effect
**Cause:** The function is recreated on every render, so each call gets a fresh timer.
**Fix:** Create it once — a closure mistake, not a timing one.

**Symptom:** A scroll indicator lags behind the scroll
**Cause:** Debounce used where throttle was needed.
**Fix:** Throttle, or `requestAnimationFrame` if it paints.

**Symptom:** A search fires for every prefix of the word
**Cause:** Throttle used where debounce was needed.
**Fix:** Debounce.

**Symptom:** Animation is janky despite throttling at 16 ms
**Cause:** `setTimeout` is not frame-aligned and runs in hidden tabs.
**Fix:** `requestAnimationFrame`.

**Symptom:** A removed component is not collected
**Cause:** A pending timer retaining its arguments and receiver.
**Fix:** `cancel` in teardown.

**Symptom:** Two components each hit the API once per interval
**Cause:** Throttling is per-closure, not global.
**Fix:** Share the instance, or rate-limit server-side.

## Interview questions

**★ Debounce or throttle — the difference in one sentence.**
Debounce waits for **quiet** and runs once the calls stop; throttle enforces a **rate** and runs at
most once per interval while they continue.

**★ Give the sharpest consequence of that difference.**
A debounced handler can run **never** — if the calls never stop, nothing fires until they do. That
is right for resize and wrong for a scroll indicator.

**★ Why do these belong in a chapter about closures?**
Because both are a closure over a private timer, and the most common bug with both is a *closure*
bug: creating them inside a render gives every call its own timer, so nothing cancels anything.

**★ How do you choose?**
Ask whether it must run **while the activity continues**. Yes → throttle. No → debounce. And if it
paints, neither — `requestAnimationFrame` is frame-aligned and idle in a hidden tab.

**★ What do both need that people forget?**
A `cancel` called in teardown. A pending timer retains its arguments and receiver, so a handler on
a removed component keeps it alive.

**★ Can you rate-limit an API with a throttle?**
Not a shared resource. It is per-closure and per-tab, so two components or two tabs multiply the
rate. Real rate limiting belongs on the server.

**Where is the implementation?**
[Phase 17 · 03](../phase-17-machine-coding/03-debounce-throttle/README.md) — with `cancel`/`flush`,
leading and trailing edges, the clock-jump guard, and the return-value problem.

---

← [09 · Higher-order functions](./09-higher-order-functions.md) · [Phase index](./README.md)
