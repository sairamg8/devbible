---
title: "01.2 · Rendering and the request"
sidebar_label: "02 · Rendering and the request"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams), [`loading` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#loading), [`srcset`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#srcset), [`aria-live`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live). Documentation-validated; **no timings**.

**Once the URL is the state, the render is a pure function of it** — and the whole remaining
difficulty is that the fetch is asynchronous, so responses can arrive in the wrong order.

## The one-directional flow

```js
async function render() {
  const state = readState();                        // 1. read the URL
  const key = new URLSearchParams(location.search).toString();

  showLoading();
  try {
    const data = await api.get(`products?${key}`, { signal: currentSignal() });
    if (key !== currentKey()) return;               // 🔴 stale response — discard
    paint(data);
  } catch (err) {
    if (err.name === "AbortError") return;          // 🔴 superseded — silent
    showError(err);
  }
}
```

🔴 **Two independent guards, and both are needed.** The abort stops the network work; the key
comparison catches a response that was already in flight and completed anyway. Belt and braces
here is correct, because aborting is a request to stop, not a guarantee that nothing arrives.

**The out-of-order problem is the reason:** a user clicks filter A then filter B. If A's response
is slower, it arrives last and paints A's results under B's URL. **The grid then disagrees with the
filters shown**, and nothing in the code looks wrong — which is what makes it a classic.

Full treatment of the three search-box bugs in
[02 · Search with autocomplete](../02-search-autocomplete/README.md); the grid has the same two.

## Cancelling the previous request

```js
let controller = null;

function currentSignal() {
  controller?.abort();                              // supersede the previous
  controller = new AbortController();
  return AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]);
}
```

Combining the caller's abort with a timeout preserves the `AbortError`/`TimeoutError` distinction —
[Phase 11 · 03 · 05](../../phase-11-network-storage/03-fetch-wrapper/05-timeouts-and-cancellation.md).
🔴 **A superseded request must be silent** and a timeout must not be: one is the app working
correctly, the other is something to tell the user about.

## The four states, not two

⚠️ **"Loading" and "loaded" is not enough.** A product grid has at least four:

| State | What the user should see |
|---|---|
| **Loading (first)** | a skeleton matching the grid's shape |
| **Loading (refining)** | the previous results, dimmed — **not** a skeleton |
| **Empty** | "no products match these filters", **with a way to clear them** |
| **Error** | what failed and a retry affordance |

🔴 **Replacing results with a skeleton on every filter change is the most common UX bug here.** The
page flashes, the scroll position is lost, and the user cannot compare before and after. Keep the
old results visible and dim them while the new ones load.

⚠️ **The empty state must be actionable.** "No results" with no way to remove the filter that
caused it is a dead end — and it is usually one over-narrow filter.

## Announcing the change

The grid updates without a page load, so a screen reader is told nothing unless you say so:

```html
<div aria-live="polite" class="visually-hidden">
  Showing 24 of 312 products
</div>
```

`aria-live="polite"` announces the change after the current speech finishes. ⚠️ **`assertive`
interrupts and should be reserved for errors** — a result count is not urgent.

**And move focus deliberately on pagination.** After clicking "next page", focus should land on the
grid heading, not remain on a button that has scrolled away. Without it, keyboard users restart
from the top of the document on every page change.

## Images, which are most of the payload

```html
<img
  src="/p/123-400.jpg"
  srcset="/p/123-400.jpg 400w, /p/123-800.jpg 800w, /p/123-1200.jpg 1200w"
  sizes="(max-width: 600px) 50vw, 25vw"
  width="400" height="533"
  loading="lazy" decoding="async"
  alt="Blue running shoe, side view"
/>
```

Four attributes, four distinct jobs:

- 🔴 **`width` and `height` reserve the space**, so the layout does not shift when the image
  arrives. This is the single largest cause of layout shift on a product grid, and the attributes
  cost nothing — the browser uses them as an aspect ratio, not a fixed size.
- **`loading="lazy"`** defers offscreen images. ⚠️ **Do not put it on above-the-fold images** — it
  delays the very images that decide the largest-contentful-paint metric.
- **`srcset`/`sizes`** let the browser pick a resolution. Without them, a phone downloads the
  desktop image.
- **`alt`** describes the product; an empty `alt=""` is correct only for decoration, and a product
  image is never decoration.

## Keeping the grid fast

- **Send only what the grid renders.** A product card needs an id, title, price, one image and a
  badge — not the full description and every variant. This is a server decision the client should
  ask for.
- **Do not render 500 cards.** Paginate, or virtualise
  (**Phase 18 · 12 · Long lists without freezing**, *not written yet*).
- ⚠️ **A stable `key`/id per card matters** even without a framework: it is what lets you update in
  place rather than rebuilding the DOM, and rebuilding loses focus and scroll.
- **Prefetch the next page on hover or when the pager scrolls into view** — cheap, and it makes
  pagination feel instant. 🔴 **Prefetch, do not preload everything**; fetching all pages up front
  is worse than the problem.

## Gotchas

**Symptom:** The grid shows results that do not match the filters
**Cause:** A slower earlier request resolved last.
**Fix:** Abort the previous request **and** compare the response's key against the current one.

**Symptom:** An error toast appears whenever filters change quickly
**Cause:** `AbortError` from the superseded request treated as a failure.
**Fix:** Check `err.name` and return silently.

**Symptom:** The page flashes a skeleton on every filter change
**Cause:** The same loading state used for first load and refinement.
**Fix:** Dim the existing results while refining.

**Symptom:** "No results" with no way out
**Cause:** The empty state has no clear-filters action.
**Fix:** Make it actionable.

**Symptom:** Screen-reader users are not told the grid changed
**Cause:** No live region.
**Fix:** `aria-live="polite"` with a result count; reserve `assertive` for errors.

**Symptom:** Keyboard focus is lost after paging
**Cause:** Focus stayed on a button that scrolled away.
**Fix:** Move focus to the grid heading.

**Symptom:** The layout jumps as images load
**Cause:** No `width`/`height`.
**Fix:** Set both; the browser uses them as an aspect ratio.

**Symptom:** The largest image loads late and hurts LCP
**Cause:** `loading="lazy"` on an above-the-fold image.
**Fix:** Lazy-load only what is offscreen.

**Symptom:** Updating the grid loses focus or scroll
**Cause:** The DOM was rebuilt rather than updated in place.
**Fix:** Stable ids per card.

## Interview questions

**★ A user clicks filter A then filter B and sees A's results. What happened, and what are the two
fixes?**
A's request was slower and resolved last. Fix both ends: **abort** the superseded request with an
`AbortController`, and **compare the response's key** against the current URL before painting — the
abort is a request to stop, not a guarantee nothing arrives.

**★ How many states does a product grid have?**
At least four: first load, refining, empty, and error. 🔴 The common bug is using one loading state
for the first two — replacing results with a skeleton on every filter change flashes the page and
loses scroll. Dim the existing results while refining.

**★ How do you tell a screen-reader user that the grid updated?**
An `aria-live="polite"` region with the result count, and move focus to the grid heading after
pagination. `assertive` interrupts and is for errors, not result counts.

**★ Which image attributes matter on a grid, and why?**
`width`/`height` to reserve space (the biggest source of layout shift, and they act as an aspect
ratio); `srcset`/`sizes` so a phone does not download the desktop image; `loading="lazy"` **only
for offscreen** images, since lazy-loading the hero delays LCP; and a real `alt`.

**★ Why must a superseded request be silent?**
Because it is the application working correctly — the user changed their mind. Only a genuine
failure or a timeout should reach the user, which is why `AbortError` and `TimeoutError` must be
distinguished by name.

**★ Offset pagination shows a duplicate item. Is that a bug?**
Not in the code — offsets shift when the underlying list changes. It is the accepted cost of
numbered pages; cursors are stable and cannot express "page 5".

**What is the cheapest way to make pagination feel instant?**
Prefetch the next page on hover or when the pager scrolls into view. Prefetch, not preload
everything — fetching every page up front is worse than the problem.

---

← [01 · URL as state](./01-url-as-state.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
