---
title: "04 · Watching and restoring"
sidebar_label: "04 · Watching and restoring"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Document.scroll` event](https://developer.mozilla.org/en-US/docs/Web/API/Document/scroll_event), [`EventTarget.addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener), [`IntersectionObserver`](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver), [`History.scrollRestoration`](https://developer.mozilla.org/en-US/docs/Web/API/History/scrollRestoration), [`overflow-anchor`](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-anchor). Documentation-validated; **no timings**.

Two jobs left: reacting to the reader's scrolling, and putting them back where they were.

## The `scroll` event, and what MDN actually says about throttling

`scroll` fires at a high rate — MDN's own warning is that a handler "shouldn't execute
computationally expensive operations such as DOM modifications", and to throttle if fast scrolling
janks.

🔴 **The surprise is what MDN says about `requestAnimationFrame` here:**

> Note that you may see code that throttles the `scroll` event handler using
> `requestAnimationFrame()`. This is *useless* because animation frame callbacks are fired at the
> same rate as `scroll` event handlers. Instead, you must measure the timeout yourself, such as by
> using `setTimeout()`.

That is worth sitting with, because the rAF-with-a-ticking-flag idiom is everywhere. It is not
*wrong* — it does guarantee your work runs once per frame, before paint, which is the right place
for a DOM write — but it does **not reduce how often you run**, because scroll events are already
delivered at frame rate. If the goal is "do less work", rAF does not achieve it. The documented
throttle is a timeout:

```js
let lastKnownScrollPosition = 0;
let ticking = false;

document.addEventListener('scroll', () => {
  lastKnownScrollPosition = window.scrollY;
  if (ticking) return;
  ticking = true;
  setTimeout(() => {
    doSomething(lastKnownScrollPosition);
    ticking = false;
  }, 20);
});
```

Note the shape: **read the position in the handler, use it in the callback.** Reading `scrollY`
inside the delayed callback would give you a stale-by-design value and a forced layout at a worse
moment.

**The trade-off:** a timeout throttle runs less often and can therefore look a frame behind on a
fast scroll; rAF stays visually in step but does the work every frame. Use the timeout for
expensive work (network calls, re-rendering a list), rAF for a cheap write that must not tear
(moving a progress bar).

### `{ passive: true }` on a scroll listener is cargo cult

`passive` tells the browser the listener will never call `preventDefault()`, so it can start the
default action — the scroll — without waiting for your code. That matters for the events that can
*cancel* scrolling: `wheel`, `mousewheel`, `touchstart`, `touchmove`. MDN records that modern
browsers already default those to `passive: true` on `Window`, `Document` and `Document.body`, and
that a passive listener calling `preventDefault()` does nothing but log a warning.

The `scroll` event is not one of them. It reports a scroll that has already happened; there is no
default action left to block, so `{ passive: true }` on it changes nothing. Harmless, but it is not
the optimisation people think it is — and if you genuinely need to *prevent* a wheel-driven scroll,
you must set `passive: false` explicitly rather than relying on the default.

## Prefer an observer to a scroll handler

Most scroll listeners exist to answer "is this element on screen yet?" — and that question has a
dedicated API that costs nothing per frame and forces no layout.

```js
const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      entry.target.classList.toggle('is-visible', entry.isIntersecting);
    }
  },
  { rootMargin: '200px 0px', threshold: 0 },   // fire 200px early
);
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
```

| You want | Use |
|---|---|
| "has this come into view" | `IntersectionObserver` |
| "load more when near the bottom" | `IntersectionObserver` on a sentinel at the end |
| "has this element's size changed" | `ResizeObserver` |
| "which section is the reader in" | `IntersectionObserver` with several thresholds |
| a progress bar tracking exact offset | `scroll` — there is no observer for a continuous value |

MDN names `IntersectionObserver` as the alternative to a throttled scroll handler for exactly this
reason. Observer callbacks are delivered **after** layout, so reading their entries forces nothing
— the argument made in
[12 · Layout thrashing](../12-layout-thrashing/02-fixing-it.md).

## Scroll anchoring — the browser already fixes some of this

When content above the viewport grows — an image finally loads, an ad slot fills — the browser
adjusts the scroll offset so the reader stays on the same content instead of being pushed down.
That is **scroll anchoring**, and it is on by default.

`overflow-anchor: none` opts an element out. You want it when the browser's adjustment fights your
own scroll management — an infinite list that prepends items and does its own offset arithmetic is
the usual case.

```css
.chat-log { overflow-anchor: none; }   /* we manage the offset ourselves */
```

⚠️ MDN marks `overflow-anchor` as **not Baseline** — it does not work in some widely used browsers.
So do not *depend* on anchoring being suppressible; write the restore logic to be correct either
way.

## Restoring the scroll position

### The browser's own restoration

`history.scrollRestoration` has two values:

| Value | Meaning |
|---|---|
| `'auto'` (default) | the browser restores the previous position on history navigation |
| `'manual'` | it does not — the app takes responsibility |

```js
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
```

Leave it on `'auto'` for a server-rendered, multi-page site: the browser does it better than you
will, and it accounts for content that has not loaded yet.

Switch to `'manual'` in a client-routed app, where the browser restores a position for a document
whose content your router is about to replace — that is what produces the classic "back button
lands you halfway down a page that has not rendered yet, then jumps to the top".

### Doing it yourself

Once you are `'manual'`, the shape is: save the offset keyed to the history entry, restore it after
the content that determines the page height exists.

```js
const key = () => `scroll:${history.state?.key ?? location.pathname}`;

addEventListener('pagehide', () => {
  sessionStorage.setItem(key(), String(window.scrollY));
});

async function restoreScroll() {
  const saved = Number(sessionStorage.getItem(key()) ?? 0);
  if (!saved) return;
  await renderTheList();                       // the page must be tall enough first
  window.scrollTo({ top: saved, behavior: 'instant' });
}
```

Three things this gets right, and each is a bug when it is missing:

- 🔴 **`behavior: 'instant'`**, or `html { scroll-behavior: smooth }` turns the restore into a
  visible slide down the page — the trap from
  [01 · Moving the scroll position](./01-moving-the-scroll-position.md).
- 🔴 **Restore *after* the content exists.** Scrolling to `y = 4000` on a page that is currently
  800px tall clamps to the bottom and quietly loses the position — `scrollTop` clamps rather than
  throwing.
- **`sessionStorage`, not `localStorage`.** The position is per-tab and per-session; persisting it
  forever means a new visit opens mid-page.

`pagehide` is the save point rather than `unload` because `unload` is unreliable and blocks the
back/forward cache. Which matters, because —

### The back/forward cache does it for free

When a page is restored from the bfcache it comes back **exactly as it was** — the same JavaScript
heap, the same DOM, the same scroll offset. No restore code runs, and none is needed. Detect it so
your own logic does not fight it:

```js
addEventListener('pageshow', (event) => {
  if (event.persisted) return;      // came from bfcache — position is already correct
  restoreScroll();
});
```

## Gotchas

**Symptom: the scroll handler janks on a fast scroll.**
Cause — expensive work, often DOM writes or `getBoundingClientRect()` reads, running at frame rate.
Fix — throttle with a timeout (MDN's documented pattern), or replace the handler with an
`IntersectionObserver` if the question is really "is it visible".

**Symptom: wrapping the handler in `requestAnimationFrame` did not reduce anything.**
Cause — animation-frame callbacks fire at the same rate as scroll events, so it is not a throttle.
Fix — measure the interval yourself with `setTimeout`. Keep rAF only when the point is *where* in
the frame the write happens, not *how often*.

**Symptom: `{ passive: true }` on the scroll listener changed nothing.**
Cause — `passive` affects events that can cancel scrolling (`wheel`, `touchstart`, `touchmove`),
and browsers already default those to passive on window/document/body. `scroll` reports a scroll
that already happened.
Fix — nothing to fix; put the effort into the handler's cost instead.

**Symptom: `preventDefault()` in a wheel handler is ignored, with a console warning.**
Cause — the listener is passive by default on a document-level node.
Fix — register it with `{ passive: false }` explicitly.

**Symptom: back navigation lands at the top, or halfway down and then jumps.**
Cause — the browser restored a position for content your router had not rendered yet.
Fix — `history.scrollRestoration = 'manual'` and restore after the content is in the DOM.

**Symptom: the restored position is short of where the reader was.**
Cause — you scrolled before the page was tall enough, and the value clamped to the current maximum.
Fix — await the render, then scroll. Re-check after images with unknown height settle, or reserve
their space with `width`/`height` attributes or `aspect-ratio`.

**Symptom: prepending older messages jumps the reader down the list.**
Cause — content added above the viewport pushes everything down.
Fix — record `scrollHeight` before the insert and add the difference to `scrollTop` after it;
`overflow-anchor: none` where supported stops the browser's own adjustment fighting yours.

## Interview questions

**★ Why is throttling a `scroll` handler with `requestAnimationFrame` not really a throttle?**
Because animation-frame callbacks fire at the same rate scroll events are delivered — MDN calls the
pattern "useless" for that purpose and recommends measuring a timeout yourself. rAF still decides
*where in the frame* the work happens, which is why it is right for a DOM write and wrong as a rate
limiter.

**★ Does `{ passive: true }` help a scroll listener?**
No. `passive` lets the browser start the default action without waiting for the listener, and it
applies to the events that can cancel scrolling — `wheel`, `mousewheel`, `touchstart`, `touchmove`
— which modern browsers already default to passive on window, document and body. `scroll` has no
default action left to cancel.

**★ When would you use `IntersectionObserver` instead of a scroll handler?**
Whenever the question is "is this on screen" — lazy loading, infinite scroll sentinels, reveal
animations, which-section-am-I-in. It fires only on threshold crossings and its entries are
delivered after layout, so reading them forces nothing. Keep `scroll` only for continuous values
like a reading-progress bar.

**★ What is `history.scrollRestoration` and when do you set it to `'manual'`?**
It controls whether the browser restores scroll position on history navigation. Default `'auto'` is
right for multi-page sites. Set `'manual'` in a client-routed app, where the browser would restore
a position for content the router has not rendered yet — then save to `sessionStorage` on
`pagehide` and restore after render with `behavior: 'instant'`.

**★ What is scroll anchoring?**
The browser adjusting the scroll offset when content above the viewport changes size, so the reader
stays on the same content. `overflow-anchor: none` opts out — but it is not Baseline, so your
restore logic must be correct without it.

**Why does a restored scroll position sometimes end up short?**
Because it was applied before the page was tall enough, and out-of-range values clamp to the
current maximum rather than erroring. Restore after the content that determines height exists.

**What does the bfcache change about all this?**
A page restored from the back/forward cache returns with its scroll position, DOM and JS state
intact, so no restore should run. Check `event.persisted` in `pageshow`, and avoid `unload`
listeners, which disqualify the page from the cache.

---

← [03 · Scroll containers and sticky](./03-scroll-containers-and-sticky.md) ·
[Topic index](./README.md) ·
**15 · Focus and accessibility from JavaScript** *(not written yet)* →
