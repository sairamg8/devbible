---
title: "01 · The four families"
sidebar_label: "01 · The four families"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Element.getBoundingClientRect()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect), [`DOMRect`](https://developer.mozilla.org/en-US/docs/Web/API/DOMRect), [`Element.getClientRects()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getClientRects), [`HTMLElement.offsetWidth`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetWidth), [`HTMLElement.offsetParent`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetParent), [`Element.clientWidth`](https://developer.mozilla.org/en-US/docs/Web/API/Element/clientWidth), [`Element.scrollWidth`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollWidth), [`Element.scrollHeight`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight), [`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver). Documentation-validated; **no timings**.

## `getBoundingClientRect()` — what is on screen

```js
const r = el.getBoundingClientRect();
r.top; r.right; r.bottom; r.left;   // viewport-relative edges
r.x; r.y; r.width; r.height;
```

Four properties of the returned `DOMRect` decide when to use it:

**1 · Coordinates are relative to the viewport**, not the document. Scroll the page and the same
element's `top` changes. Converting to document coordinates is one addition:

```js
const docTop = r.top + window.scrollY;
```

**2 · Values are fractional.** A three-column flex layout in a 1000 px container gives widths like
`333.328125`, not `333`. That precision is the point, and it is why comparing a rect width against
an `offsetWidth` with `===` fails.

**3 · It reflects transforms.** MDN describes it as the smallest rectangle containing the element
including padding and border, **as rendered** — so `transform: scale(2)` doubles the reported
`width`. If you want the untransformed layout size, that is `offsetWidth`.

**4 · Margins are never included**, in any of the four families. No API reports margin; you read
it from `getComputedStyle` if you truly need it.

⚠️ **A hidden or detached element measures as zeros.** `display: none`, or a node still sitting in
a `DocumentFragment`, has no layout box. This is the "why is my measurement 0?" bug, and the
answer is almost always that the element is not rendered yet. (`visibility: hidden` **does** have a
box and measures normally — the two hiding mechanisms differ here.)

## `offset*` — the layout box, rounded

```js
el.offsetWidth;    // content + padding + border, integer, no transform
el.offsetHeight;
el.offsetTop;      // relative to offsetParent, not the document
el.offsetLeft;
el.offsetParent;   // nearest positioned ancestor
```

`offsetWidth`/`offsetHeight` are **rounded to integers**, which is why they can differ from a rect
by up to a pixel. They include the border and, per MDN, a rendered scrollbar. And they are `0` for
an element with `display: none`.

🔴 **`offsetTop` is relative to `offsetParent`, not to the page.** `offsetParent` is the nearest
**positioned** ancestor (`position` other than `static`), or the body — so the same element
reports different `offsetTop` values depending on whether some ancestor happens to be
`position: relative`. Walking up summing `offsetTop` used to be the way to get a document
position; **`getBoundingClientRect().top + window.scrollY` replaced it** and is both simpler and
correct.

`offsetParent` is `null` for a `display: none` element (and for `position: fixed` elements) — a
cheap, if indirect, "is this rendered?" check, though `isConnected` and a zero-size rect say it
more clearly.

## `client*` — inside the border, without the scrollbar

```js
el.clientWidth;    // content + padding. No border, no margin, no scrollbar
el.clientHeight;
el.clientTop;      // the border width, effectively
el.clientLeft;
```

The useful one is the **scrollbar exclusion**. For an element with `overflow: auto`, the vertical
scrollbar eats into the visible content area, and `clientWidth` is the number that accounts for
it while `offsetWidth` does not:

```js
const scrollbarWidth = el.offsetWidth - el.clientWidth - borderLeft - borderRight;
```

On the root element the same properties describe the **viewport**:

```js
document.documentElement.clientWidth;   // viewport width EXCLUDING the scrollbar
window.innerWidth;                      // viewport width INCLUDING it
```

That pair is chunk 02's subject and the single most common source of "my layout is 15 px off".

## `scroll*` — the whole content

```js
el.scrollWidth;    // full content width, including what overflows
el.scrollHeight;
el.scrollTop;      // how far it is currently scrolled — readable AND writable
el.scrollLeft;
```

`scrollHeight` is the content's full height including the overflow; `clientHeight` is how much of
it you can see. Their relationship answers two everyday questions:

```js
const isScrollable = el.scrollHeight > el.clientHeight;
const atBottom = Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 1;
```

🔴 **The `< 1` is not sloppiness.** `scrollTop` can be fractional under zoom or on high-density
displays while `scrollHeight` and `clientHeight` are rounded integers, so an exact equality check
for "scrolled to the bottom" fails intermittently — the classic infinite-scroll bug that only
reproduces on someone else's machine.

## `getClientRects()` — when one element has several boxes

An inline element that wraps across lines has **one box per line**:

```js
link.getClientRects();          // a DOMRect per line box
link.getBoundingClientRect();   // the union of them — a rectangle covering all lines
```

For a block element there is one rect and the two agree. For a wrapped `<a>` or `<span>`, the
bounding rect covers empty space at the ends of lines, which is exactly wrong for drawing a
highlight or positioning a tooltip on the *first* line. `getClientRects()[0]` is what you want
there.

## Measuring without forcing layout

Every property on this page is on the forced-layout list from
[12 · Layout thrashing](../12-layout-thrashing/README.md). When what you need is *"tell me when
this element's size changes"*, the observer gives you the answer after layout, for free:

```js
new ResizeObserver(([entry]) => {
  const { width, height } = entry.contentRect;   // the content box, already computed
}).observe(card);
```

⚠️ **`contentRect` is the content box** — padding excluded — so it does **not** match
`getBoundingClientRect()`. `entry.borderBoxSize[0]` is the comparable one. Mixing them up produces
a measurement that is consistently short by the padding.

## Gotchas

**Symptom:** Every measurement is 0
**Cause:** The element is `display: none`, or still in a `DocumentFragment` — no layout box.
**Fix:** Measure after insertion; `visibility: hidden` still has a box if you need a hidden measurement.

**Symptom:** A rect width and `offsetWidth` disagree by a fraction
**Cause:** Rects are fractional; `offset*` is rounded to an integer.
**Fix:** Do not compare them for equality; pick one family and stay in it.

**Symptom:** A transformed element reports its original size
**Cause:** `offsetWidth` is the layout box and ignores transforms.
**Fix:** `getBoundingClientRect()`, which reports as rendered.

**Symptom:** `offsetTop` gives a different number after a parent gained `position: relative`
**Cause:** It is relative to `offsetParent`, the nearest positioned ancestor.
**Fix:** `getBoundingClientRect().top + window.scrollY` for a document coordinate.

**Symptom:** An "is at bottom" check fires unreliably
**Cause:** Fractional `scrollTop` against integer `scrollHeight`/`clientHeight`.
**Fix:** Compare with a tolerance of about 1 px.

**Symptom:** A tooltip on a wrapped link is positioned in empty space
**Cause:** `getBoundingClientRect()` returns the union of all line boxes.
**Fix:** `getClientRects()[0]`.

**Symptom:** A `ResizeObserver` size is smaller than `getBoundingClientRect()`
**Cause:** `contentRect` excludes padding and border.
**Fix:** `entry.borderBoxSize[0]`.

**Symptom:** A width computed from `offsetWidth` overflows once a scrollbar appears
**Cause:** `offsetWidth` includes the scrollbar; `clientWidth` does not.
**Fix:** `clientWidth` for usable content width.

## Interview questions

**★ `getBoundingClientRect()` versus `offsetWidth`?**
The rect is **fractional**, **viewport-relative** and reflects **transforms** — what is on screen.
`offsetWidth` is a **rounded integer** of the untransformed layout border box. Use the rect for
positioning, `offset*` when you want what layout says.

**★ `clientWidth` versus `offsetWidth`?**
`clientWidth` is the padding box — no border and **no scrollbar**. `offsetWidth` adds the border
and includes a rendered scrollbar. The difference between them is how you compute scrollbar width.

**★ How do you get an element's position in the document?**
`getBoundingClientRect().top + window.scrollY`. Not by summing `offsetTop` up the tree — that is
relative to `offsetParent`, which changes whenever an ancestor becomes positioned.

**★ How do you know an element is scrolled to the bottom?**
`scrollHeight - clientHeight - scrollTop` near zero, **with a tolerance of about a pixel** —
`scrollTop` can be fractional while the others are integers, so exact equality fails intermittently.

**★ Why would a measurement be 0?**
The element is not rendered: `display: none`, or still detached in a fragment. `visibility: hidden`
still produces a box, which is the trick for measuring something the user should not see.

**★ When do you need `getClientRects()`?**
When an inline element wraps — it returns one rect per line box, while `getBoundingClientRect()`
returns their union, which covers empty space at line ends.

**How do you watch an element's size without forcing layout?**
`ResizeObserver`. Its entries are delivered after layout, so reading them forces nothing — but note
`contentRect` is the **content** box; use `borderBoxSize` to compare with a bounding rect.

---

[Topic index](./README.md) · Next → [02 · Viewports and device pixels](./02-viewports-and-device-pixels.md)
