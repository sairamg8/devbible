---
title: "02 · A windowing list from scratch"
sidebar_label: "02 · Windowing from scratch"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Element: scroll` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/scroll_event), [`Element.scrollTop`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollTop), [`Window.requestAnimationFrame()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), [`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver), [`transform: translate()`](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/translate), [`will-change`](https://developer.mozilla.org/en-US/docs/Web/CSS/will-change), [`aria-setsize`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-setsize), [`aria-posinset`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-posinset). Documentation-validated; **no timings and no console output**.

Windowing is one sentence: **keep the scrollbar honest with an empty element of the full height, and
render only the rows that fall inside the viewport.** Everything difficult about it comes from that
first half — the browser must believe the list is 20,000 rows tall while the document contains 15.

This chunk builds the fixed-height version end to end. Fixed height is not a simplification you undo
later; it is the version you should design *for*, because rows of a known height make the maths
exact. [03 · Variable heights, and what windowing breaks](./03-what-windowing-breaks.md) handles the
case where you cannot.

## The three elements

```html
<div id="viewport">          <!-- the scroll container: fixed height, overflow-y: auto -->
  <div id="sizer">           <!-- empty, height = total rows × row height. Owns the scrollbar -->
    <div id="layer"></div>   <!-- holds the visible rows, moved into place with a transform -->
  </div>
</div>
```

```css
#viewport { height: 70vh; overflow-y: auto; }
#sizer    { position: relative; }
#layer    { position: absolute; inset-inline: 0; top: 0; will-change: transform; }
.row      { height: 96px; contain: content; }   /* the height the maths assumes */
```

**Why a transform on a layer rather than positioning each row.** One `translateY` on the container
moves everything, so a scroll step writes a single style property instead of N. It also stays on the
compositor rather than triggering layout for each row. ⚠️ **`will-change` is a hint, and MDN is
explicit that it should be used sparingly** — one long-lived layer element is exactly the case it is
for; do not put it on the rows.

**Why the sizer is empty.** Its only job is to be tall. It cannot contain the rows *and* be the
scroll height, because removing off-screen rows would collapse it.

## The maths

```js
const ROW_H = 96;        // must match the CSS exactly
const OVERSCAN = 4;      // rows rendered beyond each edge

function windowFor(scrollTop, viewportH, total) {
  const first = Math.floor(scrollTop / ROW_H);
  const visible = Math.ceil(viewportH / ROW_H);

  const start = Math.max(0, first - OVERSCAN);
  const end = Math.min(total, first + visible + OVERSCAN);

  return { start, end, offset: start * ROW_H };   // offset = where the layer sits
}
```

Three numbers, and each one earns its place:

- **`start`** — the first row index to render.
- **`end`** — one past the last. `Math.ceil` on the viewport, not `floor`: a viewport showing two and
  a half rows needs three.
- **`offset`** — how far down the sizer the rendered block belongs. This is the number that keeps
  row 500 under the scrollbar position for row 500.

🔴 **`OVERSCAN` is what stops the blank flash.** Scroll and paint are not synchronous: the user can
move past the edge of the rendered block before your handler has run, and with no overscan they see
empty space. Four rows above and below is a reasonable default — enough to cover a frame's worth of
fast scrolling, small enough that it is not free rendering nobody sees.

## The scroll loop

```js
let ticking = false;
let viewportH = viewport.clientHeight;

viewport.addEventListener('scroll', () => {
  if (ticking) return;                 // 🔴 coalesce: many scroll events, one render per frame
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    render(viewport.scrollTop);
  });
});

new ResizeObserver(([entry]) => {      // the viewport can change size — rotation, split view, zoom
  viewportH = entry.contentRect.height;
  render(viewport.scrollTop);
}).observe(viewport);
```

**Coalescing is not optional.** MDN notes that scroll events *can fire at a high rate* and
recommends throttling them; `requestAnimationFrame` is the right throttle here because the work is
visual — there is no point producing two layouts for one painted frame.

⚠️ **Read `scrollTop` and nothing else in the handler.** Any other geometry read —
`getBoundingClientRect()`, `offsetHeight` — forces a layout flush mid-scroll, which is the exact
jank you set out to remove ([Phase 9 · 12 · Layout thrashing](../../phase-9-dom/12-layout-thrashing/README.md)).
Cache the viewport height and let `ResizeObserver` update it
([Phase 12 · 05 · `ResizeObserver`](../../phase-12-browser-platform/05-resizeobserver/README.md)).

## Rendering, without churning nodes

The naive render empties the layer and rebuilds it every frame. That works and it is wasteful — it
throws away nodes the very next frame needs, and it destroys focus and selection inside them. Keep a
**pool** instead, and only touch what actually changed:

```js
const pool = [];                        // reusable row elements, index-agnostic
let last = { start: 0, end: 0 };

function render(scrollTop) {
  const { start, end, offset } = windowFor(scrollTop, viewportH, items.length);
  if (start === last.start && end === last.end) {
    layer.style.transform = `translateY(${offset}px)`;   // scrolled within the same window
    return;                                              // 🔴 the common case: no DOM writes at all
  }

  const need = end - start;
  while (pool.length < need) {                           // grow once, then never again
    const el = document.createElement('div');
    el.className = 'row';
    pool.push(el);
    layer.append(el);
  }
  while (pool.length > need) pool.pop().remove();

  for (let i = 0; i < need; i++) {
    fillRow(pool[i], items[start + i], start + i);       // update text/attrs in place
  }

  layer.style.transform = `translateY(${offset}px)`;
  last = { start, end };
}
```

**The early return is most of the performance.** With 96px rows, most frames of a scroll do not
change which rows are visible at all — they only change where the block sits. That path writes one
transform.

`fillRow` mutates an existing element rather than building a new one:

```js
function fillRow(el, item, index) {
  el.dataset.id = item.id;                     // 🔴 delegation reads this on click
  el.querySelector('.name').textContent = item.name;
  el.setAttribute('aria-posinset', index + 1); // 1-based
  el.setAttribute('aria-setsize', items.length);
}
```

⚠️ **A recycled node keeps whatever state you do not overwrite** — a checked checkbox, an expanded
panel, a CSS class from the previous row. Every mutable thing on the row must be set on every fill,
including the ones that are usually false. This is the bug that makes a virtual list appear to
select the wrong item after a fast scroll.

## Making it accessible, from the start

A windowed list is exactly the case ARIA's set attributes exist for. MDN states it plainly: when
only a subset of items is loaded into the DOM, the browser's count is wrong and **`aria-setsize`
should be used to override it**, with `aria-posinset` giving each item its position in the complete
set.

```html
<div id="layer" role="listbox" aria-label="Products">
  <div class="row" role="option" aria-setsize="20000" aria-posinset="501">…</div>
</div>
```

- **`aria-setsize`** is the *real* total, not the rendered count — the same value on every row.
- **`aria-posinset`** is 1-based and absolute: row index 500 is `aria-posinset="501"`.
- Pick the role from what the list actually is. `listbox`/`option` for a selectable list; a
  `grid` for a data table; plain `list`/`listitem` for a static one. The wrong role is worse than
  none ([Phase 12 · 11 · Accessibility from JavaScript](../../phase-12-browser-platform/11-accessibility-from-javascript/README.md)).

## Wiring it into the page

- **One delegated click handler on the viewport**, reading `event.target.closest('.row').dataset.id`
  ([Phase 10 · 04 · Event delegation](../../phase-10-events/04-event-delegation/README.md)). Per-row
  listeners on recycled nodes leak into the wrong rows, which is a subtle and very annoying bug.
- **Scrolling to an item is arithmetic**, and this is the payoff of fixed heights:
  `viewport.scrollTop = index * ROW_H`. Then render — do not wait for the scroll event, or the frame
  after the jump is blank ([Phase 9 · 14 · Scrolling](../../phase-9-dom/14-scrolling/README.md)).
- **Changing the data resets the window.** After a filter or a sort, set `sizer.style.height` from
  the new total, force `last = { start: -1, end: -1 }` so the early return cannot skip the rebuild,
  and reset `scrollTop` to 0 — a scroll position from the old list is meaningless in the new one.
- **Teardown**: disconnect the `ResizeObserver` and drop the scroll listener when the view goes away.

## Gotchas

**Symptom: rows sit at the wrong scroll position, drifting further the more you scroll.**
Cause — `ROW_H` in JS does not match the rendered row height (padding, border, or a margin the box
model includes and your constant does not).
Fix — one source of truth: a CSS custom property read once, or a measured first row. Watch for
`box-sizing` and for margins that collapse.

**Symptom: blank gaps flash while scrolling fast.**
Cause — no overscan, or the render is not coalesced into a frame.
Fix — `OVERSCAN` of a few rows, and one `requestAnimationFrame` per scroll burst.

**Symptom: the wrong row appears selected / a checkbox is checked on a row you never touched.**
Cause — recycled nodes carrying state that `fillRow` does not overwrite.
Fix — set every mutable property on every fill, including resetting to the default.

**Symptom: scrolling is smooth going down and janky going up.**
Cause — asymmetric overscan, or a render path that rebuilds the pool when the window moves backwards.
Fix — overscan both edges; make the pool size depend only on the window size, not the direction.

**Symptom: the scrollbar is the wrong length, or the list ends early.**
Cause — the sizer height was not updated after items were added, filtered or removed.
Fix — recompute `sizer.style.height = total * ROW_H` wherever `items` changes.

**Symptom: it works in a page scroll but not inside a modal or a split pane.**
Cause — reading `window.scrollY` instead of the container's `scrollTop`, or a stale cached viewport
height.
Fix — always measure the scroll container; keep the `ResizeObserver` on it.

**Symptom: clicking a row opens the wrong product after scrolling.**
Cause — a per-row listener bound to the item it was created with, on a node that has since been
recycled.
Fix — delegation, reading the id from the DOM at click time.

## Interview questions

**★ How does a virtual list keep the scrollbar correct?**
An empty sizer element whose height is `total × rowHeight` owns the scroll extent. The rendered rows
live in a layer positioned at `startIndex × rowHeight` inside it, so the visible block always lines
up with the scroll position.

**★ Which index range do you render?**
`floor(scrollTop / rowHeight)` to that plus `ceil(viewportHeight / rowHeight)`, widened by an
overscan at both edges and clamped to the list bounds.

**★ Why overscan?**
Scrolling can outrun the render, so without a few rows beyond each edge the user sees blank space
during a fast scroll.

**★ Why a transform on one layer instead of positioning every row?**
It is a single style write per scroll step instead of N, and it moves the block on the compositor
rather than re-laying-out each row.

**★ How do you keep it accessible when most rows are not in the DOM?**
`aria-setsize` with the real total and `aria-posinset` with the absolute 1-based index on every
rendered row, plus a role that matches what the list is. Without them the screen reader announces
"item 3 of 15" for a list of 20,000.

**★ What is the danger of recycling row elements?**
Any state left over from the previous item — classes, checked inputs, expanded sections — bleeds
into the new row. Every fill must write every mutable property.

**★ Why coalesce the scroll handler with `requestAnimationFrame`?**
Scroll events fire at a high rate and MDN recommends throttling; the work here is visual, so more
than one render per painted frame is wasted, and doing it inside the frame callback keeps the write
next to the paint.

---

← [01 · Why a long list freezes](./01-why-a-long-list-freezes.md) · [Topic index](./README.md) · [03 · Variable heights, and what windowing breaks](./03-what-windowing-breaks.md) →
