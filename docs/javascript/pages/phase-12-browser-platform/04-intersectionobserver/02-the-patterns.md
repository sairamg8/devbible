---
title: "02 · The patterns: lazy loading, infinite scroll, impressions"
sidebar_label: "02 · The patterns"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Intersection Observer API guide](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API), [Lazy loading](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Lazy_loading), [`HTMLImageElement.loading`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/loading), [`content-visibility`](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility), [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion), [`Element.animate()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate). Documentation-validated; **no timings and no console output**.

Four questions cover almost every real use of the observer: *load this when it is near*,
*fetch more when the end is near*, *count this as seen*, and *which section am I in*. Each has
a shape, and each has a version that is not JavaScript at all — check that one first.

## Before you write an observer: the declarative versions

| The job | The declarative answer |
|---|---|
| Lazy-load an image or iframe | `loading="lazy"` on `<img>`/`<iframe>` — no script at all |
| Skip rendering work for offscreen sections | CSS `content-visibility: auto` with `contain-intrinsic-size` |
| Animate as an element scrolls through | Scroll-driven CSS animations |
| Stick and restyle at an edge | `position: sticky` ([Phase 9 · 14 · 03](../../phase-9-dom/14-scrolling/03-scroll-containers-and-sticky.md)) |

🔴 **`loading="lazy"` replaces the classic `data-src` observer** for images and iframes. Write
the observer only when the thing being deferred is not an image — a chart that must fetch, a
comment thread, a map widget.

## Lazy-loading something that is not an image

```js
const lazy = new IntersectionObserver((entries, observer) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    observer.unobserve(entry.target);      // 🔴 first line of the body — one shot only
    hydrate(entry.target);
  }
}, { rootMargin: '0px 0px 400px 0px' });

document.querySelectorAll('[data-lazy]').forEach((el) => lazy.observe(el));
```

**`unobserve` before the work, not after.** If `hydrate` is async and the user scrolls back and
forth, an observer that is still watching fires again and you load twice.

The `rootMargin` is the whole tuning knob: too small and the user watches a spinner, too large
and you load things nobody reaches. Bias it downward — content below the fold is what people
scroll toward.

## Infinite scroll: observe a sentinel, never the last item

```html
<ul id="feed">…</ul>
<div id="sentinel" style="height: 1px"></div>
```

```js
let loading = false;

const io = new IntersectionObserver(async ([entry]) => {
  if (!entry.isIntersecting || loading) return;
  loading = true;
  try {
    const page = await fetchNextPage();
    if (!page.hasMore) io.disconnect();     // stop asking once the data ends
    feed.append(...page.items);
  } finally {
    loading = false;                        // re-check happens on the next crossing
  }
}, { root: null, rootMargin: '0px 0px 600px 0px' });

io.observe(sentinel);
```

⚠️ **Three failure modes, all common:**

- **No `loading` guard** → several crossings while the first request is in flight, and the same
  page is fetched three times.
- **A zero-height sentinel that never intersects** → give it a real height (`1px` is enough, and
  it must not be `display: none`).
- **The sentinel stays in view after appending** → if the new content is shorter than the
  viewport the observer does not re-fire, because the ratio never crossed the threshold. Keep
  loading in a loop until the sentinel is pushed off screen, or check again after appending.

**The end of the data is a `disconnect`.** An infinite scroll that keeps hitting a server for
an empty page is the version of this that reaches production.

Accessibility is not optional here: an infinitely growing list traps keyboard users away from
anything below it, and a "Load more" button that the observer *also* clicks is the honest
implementation. The full storefront treatment is **Phase 18 · 11 · Infinite scroll and lazy
images** *(not written yet)*.

## Impression tracking: seen means visible *and* for long enough

"Was this seen" is two conditions. The observer gives you the first; a timer gives you the
second, and cancelling that timer on the way out is the part people forget.

```js
const pending = new Map();   // element → timeout id

const impressions = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      pending.set(entry.target, setTimeout(() => {
        report(entry.target.dataset.id);
        impressions.unobserve(entry.target);   // count each element once
        pending.delete(entry.target);
      }, 1000));
    } else {
      clearTimeout(pending.get(entry.target)); // scrolled past too fast — not an impression
      pending.delete(entry.target);
    }
  }
}, { threshold: 0.5 });
```

🔴 **Send the batch with `sendBeacon`, not `fetch`, when the page may be closing** — a normal
request is cancelled on unload. That is **Phase 11 · 20 · `sendBeacon` and keepalive** *(not
written yet)*; the lifecycle side is
[Phase 10 · 10 · 02 · Shutdown](../../phase-10-events/10-page-lifecycle/02-shutdown.md).

⚠️ **A background tab does not stop the observer from having already fired.** Combine with
`document.visibilityState` if "seen" is supposed to mean a human looked at it
([Phase 10 · 09 · 02](../../phase-10-events/09-scroll-resize-visibility/02-visibility-and-lifecycle.md)).

## Scrollspy: the middle-of-the-screen line

Instead of asking "which heading is nearest the top", shrink the root to a line and let the
browser answer:

```js
const spy = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) setActive(entry.target.id);
  }
}, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });

document.querySelectorAll('section[id]').forEach((s) => spy.observe(s));
```

The negative margins leave a ~10% band across the middle; whichever section crosses it is the
current one. Tune the two numbers rather than writing comparison logic.

**Reflect the result in the markup, not just in a class** — `aria-current="true"` on the active
link is what makes a table of contents usable with a screen reader
([Phase 9 · 15 · 03 · ARIA from JavaScript](../../phase-9-dom/15-focus-and-accessibility/03-aria-from-javascript.md)).

## Detecting "stuck": a sentinel above the sticky element

`position: sticky` gives you no event. The standard trick is a one-pixel sentinel just above
the sticky header: when the sentinel leaves the top of the viewport, the header is stuck.

```js
new IntersectionObserver(([e]) => header.classList.toggle('is-stuck', !e.isIntersecting), {
  threshold: 0,
}).observe(sentinel);
```

## Pausing work that nobody can see

The observer is a good switch for anything expensive attached to an offscreen element — a
canvas loop, an autoplaying video, a polling widget:

```js
new IntersectionObserver(([e]) => (e.isIntersecting ? chart.start() : chart.stop()))
  .observe(chart.canvas);
```

That pairs with the frame loop in [03 · 02 · Frames](../03-timers-and-frames/02-frames.md):
`requestAnimationFrame` already stops for a hidden *tab*, but not for an element scrolled off
the *page*. This is the missing half.

## Reveal-on-scroll, done respectfully

```js
const reveal = new IntersectionObserver((entries, obs) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    obs.unobserve(entry.target);
    entry.target.classList.add('revealed');
  }
}, { threshold: 0.15 });

if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('.reveal').forEach((el) => reveal.observe(el));
} else {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('revealed'));
}
```

🔴 **The content must be readable with JavaScript disabled or the observer never firing.**
Start from visible and let the class *animate*, or ship the fallback branch above — a reveal
pattern whose default state is `opacity: 0` turns a scripting failure into a blank page.

## Gotchas

**Symptom: infinite scroll fetches the same page several times.**
Cause — multiple crossings while the first request is in flight.
Fix — an in-flight flag reset in `finally`, and `disconnect()` when the data runs out.

**Symptom: loading stops even though there is more data.**
Cause — the appended content was shorter than the viewport, so the sentinel never crossed the
threshold again.
Fix — after appending, check whether the sentinel is still intersecting and keep going.

**Symptom: lazy content loads twice.**
Cause — the target was still observed while the async load ran.
Fix — `unobserve` as the first statement in the intersecting branch.

**Symptom: impressions are counted for content the user flew past.**
Cause — the callback reported on crossing rather than on dwell.
Fix — start a timer on entry, clear it on exit, report only when the timer survives.

**Symptom: the reveal animation leaves content invisible for some users.**
Cause — the initial state is hidden and the observer never fired.
Fix — degrade to visible; honour `prefers-reduced-motion`.

**Symptom: the sticky-detection sentinel never fires.**
Cause — it collapsed to zero height, or it is inside the sticky element rather than above it.
Fix — give it height and put it in the normal flow, before the sticky element.

## Interview questions

**★ How do you build infinite scroll with `IntersectionObserver`?**
Put a sentinel after the list, observe it with a generous bottom `rootMargin`, and load the next
page when it intersects — guarded by an in-flight flag, and disconnected when the server says
there is no more. Observe the sentinel, never the last rendered item, so appending does not
change what is being watched.

**★ Is `IntersectionObserver` still the way to lazy-load images?**
Not usually. `loading="lazy"` on `<img>` and `<iframe>` is declarative, needs no script, and is
what MDN points at first. Keep the observer for deferred work that is not a resource load —
hydrating a widget, starting a fetch, beginning an animation.

**★ How do you count an impression properly?**
Two conditions: a threshold crossing (say 50% visible) *and* a dwell time. Start a timer on
entry, clear it on exit, report only if it fires, then `unobserve` so the element counts once.
Send the batch with `sendBeacon` if the page might be closing.

**★ How would you highlight the current section in a table of contents?**
An observer with a negative `rootMargin` on both sides — `-45% 0px -45% 0px` — so the root is a
band across the middle of the screen. Whichever section intersects it is current. No scroll
handler, no measuring.

**★ Why observe a sentinel rather than the element you care about?**
Because the sentinel's geometry is stable and trivial. The list grows, items are recycled, the
sticky header has no event — a one-pixel element in a known place turns all of those into a
plain intersection question.

**How do you stop an offscreen canvas animation?**
Observe the canvas and start/stop the `rAF` loop on `isIntersecting`. `requestAnimationFrame`
pauses for a hidden tab, but not for an element scrolled out of view.

---

← [01 · The API](./01-the-api.md) · [Topic index](./README.md)
