---
title: "03 · debounce and throttle"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`setTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout), [`clearTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/clearTimeout), [`Date.now()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now), [`performance.now()`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now), [`requestAnimationFrame()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame). Documentation-validated; **no timings**.

**Debounce waits for quiet; throttle enforces a rate.** Both are five lines and both hide the same
four problems — `this`, the return value, lifecycle, and being recreated on every render.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[debounce](./01-debounce.md)** | The five-line version and 🔴 **why the wrapper must be a `function` and the callback an arrow**; `leading`/`trailing`, and ⚠️ **why both-edges fires twice for a burst**; `cancel` as a **leak fix**, not a testing convenience — a pending timer retains the component; `flush` and `pending`; 🔴 **the return-value problem** and the promise version, including the decision about whether superseded callers resolve or reject; and 🔴 **the render-scope trap** where a debounce rebuilt per render debounces nothing |
| 2 | **[throttle](./02-throttle.md)** | The **timestamp** and **timer** versions as genuinely different behaviours — leading-with-no-tail versus trailing-with-a-delayed-start — and the both-edges implementation; ⚠️ **the clock-jump guard**, because `Date.now()` can move backwards, and why `performance.now()` is the better clock; a chooser table for debounce vs throttle vs 🔴 **`requestAnimationFrame`, which beats both for anything that paints**; and the lifecycle problems both share, including that **neither is a rate limiter for a shared resource** |

## The three sentences to keep

1. **Debounce waits for quiet; throttle enforces a rate.** That one sentence answers the question
   most of the time.
2. **Both must be created once and cancelled on teardown** — rebuilt per render they do nothing,
   and a pending timer retains everything it closed over.
3. **For anything that paints, use `requestAnimationFrame`** — a 16 ms `setTimeout` is not aligned
   to the frame and keeps running in a hidden tab.

## Phase gate

You are done with this topic when you can write both from an empty file with `this` and arguments
forwarded, add `cancel`/`flush`, say which edge your throttle fires on and why it matters, and name
the two lifecycle bugs they share.

## Where this connects

- [02 · `call`, `apply` and `bind`](../02-call-apply-bind/README.md) — the `fn.apply(this, args)` that forwards the receiver
- [Phase 3 · Functions, scope and closures](../../phase-3-functions/README.md) — the closure holding the timer
- [Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md) — why a pending timer retains a component
- [Phase 11 · 03 · 06 · Retries](../../phase-11-network-storage/03-fetch-wrapper/06-retries.md) — real rate limiting, which this is not

---

Start → [01 · debounce](./01-debounce.md)
