---
title: "02 · Fixing it"
sidebar_label: "02 · Fixing it"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Window.requestAnimationFrame()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), [`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver), [`IntersectionObserver`](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver), [CSS `contain`](https://developer.mozilla.org/en-US/docs/Web/CSS/contain), [CSS `will-change`](https://developer.mozilla.org/en-US/docs/Web/CSS/will-change), [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API), [`Element.animate()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate). Documentation-validated; **no timings**.

## The fix is a discipline, not an API

> **Read everything. Then write everything. Never alternate.**

```js
// read phase — layout is clean throughout
const measurements = rows.map((row) => ({
  row,
  height: row.getBoundingClientRect().height,
}));

// write phase — nothing reads geometry, so nothing forces layout
for (const { row, height } of measurements) {
  row.style.setProperty('--h', `${height}px`);
}
```

That is the whole technique. Libraries such as FastDom exist to enforce it by queueing reads and
writes into separate phases, but on your own code the discipline is usually enough — and it is
what an interviewer is listening for.

🔴 **The hard part is not the loop you can see.** A helper called in the write phase that reads
`offsetHeight`, a component's `measure()` call, a logging line — each reintroduces the alternation.
When batching "does not work", it is nearly always because a callee reads.

## Where to put the writes: `requestAnimationFrame`

A `requestAnimationFrame` callback runs **before** the browser's style/layout/paint for that
frame. That makes it the right place for writes that should land in the next painted frame, and
the wrong place for reads that could have been done earlier.

```js
// measure now, write in the frame
const { top } = target.getBoundingClientRect();
requestAnimationFrame(() => {
  header.style.transform = `translateY(${top}px)`;
});
```

⚠️ **Reading geometry *inside* a rAF callback still forces layout** if something already wrote in
that callback. `rAF` is not a magic barrier — it only controls *when* your code runs relative to
rendering.

The common idiom for "measure the state after my writes have taken effect" is to write in one
frame and read in the next:

```js
requestAnimationFrame(() => {
  el.classList.add('open');                 // write
  requestAnimationFrame(() => measure(el)); // read, after the browser has laid out
});
```

Double-`rAF` looks superstitious and is not: the first callback runs before this frame's layout,
the second after it.

## Measure without forcing: the observers

Better than measuring carefully is not measuring by hand at all. Both observers deliver their
data **after** layout, so reading it costs nothing extra:

```js
new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { width, height } = entry.contentRect;   // already computed — no forced layout
  }
}).observe(card);

new IntersectionObserver((entries) => {
  for (const e of entries) e.target.classList.toggle('is-visible', e.isIntersecting);
}, { rootMargin: '200px' }).observe(sentinel);
```

- **`ResizeObserver`** replaces "listen for `resize`, then measure everything" — it fires per
  element, only when that element's size actually changed.
- **`IntersectionObserver`** replaces "on scroll, call `getBoundingClientRect()` on every item to
  see what is visible" — which is the single most common thrashing pattern in the wild, and the
  reason lazy-loading and infinite scroll used to be janky.

⚠️ **`ResizeObserver` can loop.** Writing a size inside its own callback can trigger another
observation; browsers detect this and report *"ResizeObserver loop completed with undelivered
notifications"*. If you see that error, something in the callback is changing the size it is
watching.

Remember from [10 · Removing and replacing](../10-removing-and-replacing/README.md): both
observers hold their targets, so `disconnect()` when the UI goes away.

## Animate the properties that skip layout

`transform` and `opacity` can be handled by the **compositor**, so an animation using only those
can avoid layout and paint entirely.

```css
/* ✅ compositor-friendly */
.panel { transition: transform .2s, opacity .2s; }

/* ⚠️ animates layout on every frame */
.panel { transition: left .2s, height .2s; }
```

Animating `left`, `top`, `width`, `height` or `margin` invalidates layout **every frame** — the
worst version of this topic, sixty times a second. Use `transform: translate()` instead of
`left`/`top`, and `scale()` instead of `width`/`height`.

`will-change: transform` hints that an element is about to be animated so the browser can prepare.
⚠️ MDN's own guidance is to use it **sparingly and as a last resort** — it costs resources, and
leaving it on permanently is a common way to make things worse rather than better.

`Element.animate()` (the Web Animations API) is the JavaScript-side equivalent, and it runs off
the main thread for compositor-friendly properties, which is a genuine advantage over animating
with a `rAF` loop that writes styles.

## Limit the blast radius: CSS `contain`

Layout cost depends on how much of the tree must be recomputed. CSS containment tells the browser
that a subtree's internals cannot affect anything outside it:

```css
.card { contain: layout paint; }
.list-item { content-visibility: auto; contain-intrinsic-size: auto 72px; }
```

`contain: layout` means a change inside the card cannot change the layout of anything outside it,
so the engine can stop there. `content-visibility: auto` goes further and skips rendering work for
off-screen subtrees entirely — with `contain-intrinsic-size` supplying a placeholder size so
scrolling stays stable.

This is the one fix on the page that needs **no JavaScript at all**, which usually makes it the
first one to try.

## The order to try things

1. **Do not measure** — `IntersectionObserver`/`ResizeObserver` instead of scroll-and-measure.
2. **Do not animate layout properties** — `transform`/`opacity`.
3. **Batch** reads and writes into phases.
4. **Contain** the subtree so what remains is cheaper.
5. **Profile** to confirm, because every claim above is about mechanism, not about your app.

## Gotchas

**Symptom:** Batching reads and writes changed nothing
**Cause:** A function called in the write phase reads geometry.
**Fix:** Check the callees; the read may be one call away.

**Symptom:** A measurement inside `requestAnimationFrame` still forced layout
**Cause:** Something wrote earlier in the same callback; `rAF` is not a barrier.
**Fix:** Write in one frame, read in the next (double-`rAF`).

**Symptom:** *"ResizeObserver loop completed with undelivered notifications"*
**Cause:** The callback changes the size of the element it observes.
**Fix:** Break the cycle — write to a different element, or guard with a comparison.

**Symptom:** A scroll-driven effect janks on a long page
**Cause:** Measuring every item on every scroll event.
**Fix:** `IntersectionObserver`, which is delivered after layout and costs no forced reflow.

**Symptom:** An animation is smooth on desktop and janky on a phone
**Cause:** It animates `left`/`width`, so layout runs every frame.
**Fix:** `transform`, and check for `will-change` left on permanently.

**Symptom:** Adding `will-change` everywhere made things slower
**Cause:** It consumes resources; MDN says use it sparingly and as a last resort.
**Fix:** Apply it just before the animation, remove it after — or not at all.

**Symptom:** A small change in a card re-lays-out the whole page
**Cause:** Nothing tells the engine the card's internals are self-contained.
**Fix:** `contain: layout paint` on the card.

## Interview questions

**★ How do you fix layout thrashing?**
Separate the work into a **read phase** and a **write phase** so no read follows a write within a
task. The trap is a helper called during the write phase that reads geometry — batching only works
if the callees cooperate.

**★ Where does `requestAnimationFrame` fit?**
Its callback runs before that frame's style, layout and paint, which makes it the right place for
writes destined for the next painted frame. It is **not** a barrier: a read after a write inside
the same callback still forces layout, which is why measuring what your writes did needs a second
`rAF`.

**★ Why is `IntersectionObserver` better than measuring on scroll?**
Its entries are delivered after layout has been computed, so reading them forces nothing.
Calling `getBoundingClientRect()` on every item in a scroll handler is the textbook thrashing
pattern.

**★ Which properties are cheap to animate, and why?**
`transform` and `opacity` — they can be handled by the compositor, skipping layout and paint.
Animating `left`, `top`, `width` or `height` invalidates layout on every frame.

**★ What does CSS `contain` do for this?**
It tells the browser a subtree's internals cannot affect the outside, so layout work can stop at
that boundary. `content-visibility: auto` additionally skips rendering off-screen subtrees — the
one fix here that needs no JavaScript.

**★ When would you use `will-change`?**
Sparingly, and as a last resort — MDN's own wording. It asks the browser to prepare for a change
and consumes resources, so leaving it on permanently often makes performance worse.

**What is the "ResizeObserver loop" error telling you?**
That your callback changed the size of something it observes, so the browser could not settle
within a frame and deferred the remaining notifications. Break the feedback loop.

---

← [01 · The forced reflow](./01-the-forced-reflow.md) · [Topic index](./README.md) ·
**13 · Measuring elements** *(not written yet)* →
