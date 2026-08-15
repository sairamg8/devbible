---
title: "01 · The API: root, margin, threshold"
sidebar_label: "01 · The API"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`IntersectionObserver`](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver), [`IntersectionObserver()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/IntersectionObserver), [`IntersectionObserverEntry`](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserverEntry), [`rootMargin`](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/rootMargin), [`thresholds`](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/thresholds), [Intersection Observer API guide](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API). Documentation-validated; **no timings and no console output**.

`IntersectionObserver` answers one question — **how much of this element overlaps that box** —
and answers it without you ever reading a position. That is the whole reason it exists: the
scroll-handler version of the same question calls `getBoundingClientRect()` on every frame, and
each of those calls can force the browser to lay out
([Phase 9 · 12 · The forced reflow](../../phase-9-dom/12-layout-thrashing/01-the-forced-reflow.md)).

## The shape

```js
const io = new IntersectionObserver(callback, {
  root: null,          // the intersection box; null = the viewport
  rootMargin: '0px',   // grow or shrink that box
  threshold: 0,        // how much overlap counts as a change
});

io.observe(el);
io.unobserve(el);      // stop watching one target
io.disconnect();       // stop watching all of them
```

One observer can watch **many** targets — the callback receives an array — and one target can
be watched by several observers with different thresholds. Creating one observer and calling
`observe()` per element is the normal shape; a new observer per element works but wastes the
batching.

🔴 **The callback fires once as soon as you observe an element**, with the element's current
state, whether or not it is on screen. Code that assumes the first call means "it just came
into view" is wrong from the first frame — check `isIntersecting`.

## `root` — the box everything is measured against

`null` (the default) means the **viewport**. Any other value must be an **ancestor** of the
target; if it is not, the target simply never intersects and no bug is reported.

```js
new IntersectionObserver(cb, { root: document.querySelector('#feed') });
```

Use an element root when the scrolling happens inside a container rather than the page
([Phase 9 · 14 · 03 · Scroll containers](../../phase-9-dom/14-scrolling/03-scroll-containers-and-sticky.md)).
⚠️ **`overflow: hidden` on an ancestor clips the intersection too** — the observer measures
against what is actually visible, so an element inside a clipped container reports a ratio of
0 even when the container is on screen.

## `rootMargin` — the most useful option, and the one that surprises

It is CSS margin syntax (`'100px'`, `'0px 0px 200px 0px'`, `'10%'`) applied to the root box
before the comparison. **Positive values grow the box, negative values shrink it.**

| Value | Effect |
|---|---|
| `'0px 0px 300px 0px'` | Fires **300 px before** the element scrolls into view — preloading |
| `'-100px 0px 0px 0px'` | Only fires once the element is 100 px **past** the top edge |
| `'-50% 0px -50% 0px'` | A one-pixel line across the middle of the screen — scrollspy |

**Only `px` and `%` are accepted.** `em`, `rem` and `vh` throw — percentages resolve against
the root's own dimensions, which is usually what you meant anyway.

⚠️ **`rootMargin` is ignored when the document is in a cross-origin iframe** and the root is
the viewport, because the observer cannot see outside the frame; MDN documents the same
restriction on `rootBounds`, which is `null` in that case.

## `threshold` — the ratios that produce a callback

A number, or an array of numbers, between 0 and 1. The callback fires **each time the ratio
crosses** one of them, in either direction.

| Threshold | Means |
|---|---|
| `0` (default) | fires the moment **one pixel** appears, and again when the last one leaves |
| `1.0` | fires only when the element is **fully** inside the root |
| `[0, 0.5, 1]` | three crossing points — the usual choice for "how visible is this" |
| `Array.from({length: 101}, (_, i) => i / 100)` | continuous tracking, and a callback per percent |

🔴 **Thresholds are crossings, not a stream.** With `threshold: 0` an element that scrolls
past gives you exactly two callbacks. If you need a value while it moves — a parallax offset,
a progress readout — that is a `scroll` listener or a scroll-driven CSS animation, not this.

⚠️ **A target larger than the root can never reach ratio 1.** A full-height hero with
`threshold: 1` never fires; the ratio is measured against the *target's* area, and the root
cannot contain it. Use `0.99`-style thresholds only as a workaround; better, ask a question
the geometry can answer.

## The entry

```js
function callback(entries, observer) {
  for (const entry of entries) {
    entry.isIntersecting;        // boolean — the answer, most of the time
    entry.intersectionRatio;     // 0…1 — how much of the target overlaps
    entry.target;                // the observed element
    entry.time;                  // DOMHighResTimeStamp of the change
    entry.boundingClientRect;    // the target's rect, already computed
    entry.intersectionRect;      // the overlapping part
    entry.rootBounds;            // the root's rect — null across origins
  }
}
```

🔴 **Every rectangle on the entry is already computed** — reading them costs nothing, where
calling `getBoundingClientRect()` yourself inside the callback can force a fresh layout. If
you find yourself measuring inside an observer callback, the number you want is probably on
the entry.

**`isIntersecting` is a boolean about crossing, not about being seen.** An element covered by
a modal, at `opacity: 0`, or behind another element is still "intersecting" — the observer is
geometry, not visibility.

## Delivery: batched, and not in your scroll path

Callbacks are queued and delivered by the browser during its rendering steps, batched across
all the targets that changed. Three consequences worth holding on to:

- **Nothing runs per scroll event.** The cost does not scale with how fast the user scrolls.
- **The callback is still main-thread work**, so a slow one still causes jank. MDN says to keep
  it fast and defer real work.
- **It is asynchronous.** State you read in the callback may already have moved on; act on the
  entry, not on a fresh measurement.

`observer.takeRecords()` synchronously returns any entries queued but not yet delivered, and
clears the queue — the one escape hatch, mostly used in teardown so a pending callback does
not fire against a removed element.

## Version 2: "actually visible", where supported

The second-level API adds `trackVisibility: true` with a `delay` (100 ms or more), which makes
the browser check whether the element is really being *shown* — not covered, not transformed
into invisibility — and reports it on `entry.isVisible`. It exists for honest ad-impression and
click-tracking, and it is deliberately expensive.

```js
new IntersectionObserver(cb, { threshold: 0.5, trackVisibility: true, delay: 100 });
```

⚠️ **Feature-detect it rather than assuming it.** Support is not universal; `'isVisible' in
IntersectionObserverEntry.prototype` is the check, and the fallback is plain geometry.

## Cleanup

The observer holds its targets. Nothing releases them but you:

```js
class LazyImage extends HTMLElement {
  #io = new IntersectionObserver(([e]) => { if (e.isIntersecting) this.#load(); });
  connectedCallback()    { this.#io.observe(this); }
  disconnectedCallback() { this.#io.disconnect(); }
}
```

🔴 **There is no `signal` option.** Unlike `addEventListener`, an observer cannot be torn down
by an `AbortController`, so every `observe()` needs a matching `unobserve()` or `disconnect()`
in the teardown path. For one-shot work — lazy loading, a reveal animation — call `unobserve`
**inside** the callback the moment the work is done; that is both the cleanup and the guard
against firing twice.

## Gotchas

**Symptom: the callback fires immediately on page load for elements far down the page.**
Cause — `observe()` always produces an initial observation.
Fix — branch on `entry.isIntersecting`; do not treat the first call as an entry event.

**Symptom: nothing ever fires.**
Cause — the `root` is not an ancestor of the target, the target is `display: none`, or the
target has zero size.
Fix — check the ancestry; give a sentinel an explicit height rather than letting it collapse.

**Symptom: `rootMargin` throws or is ignored.**
Cause — a unit other than `px` or `%`, or a cross-origin iframe.
Fix — convert to px or a percentage; across origins, use an element root inside your own frame.

**Symptom: `threshold: 1` never fires for a tall section.**
Cause — the target is bigger than the root, so the ratio cannot reach 1.
Fix — pick a threshold the geometry can reach, or observe a smaller sentinel instead.

**Symptom: the callback fires twice for one appearance.**
Cause — the element crossed the threshold in both directions, or two observers watch it.
Fix — `unobserve` after one-shot work; check `isIntersecting` before acting.

**Symptom: the observer reports an element as intersecting while a modal covers it.**
Cause — intersection is geometry; occlusion is not part of it.
Fix — `trackVisibility` with `isVisible` where supported, or track the modal state yourself.

**Symptom: memory grows as list items are recycled.**
Cause — targets were observed and never unobserved.
Fix — `unobserve` on removal, `disconnect` on teardown; there is no signal-based cleanup.

## Interview questions

**★ Why is `IntersectionObserver` cheaper than a scroll handler that measures?**
Because the browser computes the intersections as part of work it already does and hands you
finished rectangles, batched. The scroll version runs your code on every scroll event and each
`getBoundingClientRect()` can force a synchronous layout, so its cost scales with scroll speed.

**★ What do `root`, `rootMargin` and `threshold` each control?**
`root` is the box the target is compared against — the viewport by default, otherwise an
ancestor. `rootMargin` grows or shrinks that box, which is how you preload before an element
appears. `threshold` is the set of overlap ratios whose crossings produce a callback.

**★ Your callback fires as soon as the page loads. Is that a bug?**
No — `observe()` queues an initial observation so you learn the current state. Check
`entry.isIntersecting` rather than assuming a callback means "just became visible".

**★ How do you preload an image 300 px before it enters the viewport?**
`rootMargin: '0px 0px 300px 0px'`, and `unobserve` the element inside the callback once loading
has started.

**★ Does `isIntersecting: true` mean the user can see the element?**
No. It means the geometry overlaps. Occlusion, `opacity: 0` and `visibility: hidden` are not
considered — that is what the version-2 `trackVisibility`/`isVisible` pair is for.

**What does `takeRecords()` do?**
Returns the entries queued but not yet delivered and empties the queue. It is mainly useful in
teardown, so a pending callback does not run against something you have already removed.

---

[Topic index](./README.md) · [02 · The patterns](./02-the-patterns.md) →
