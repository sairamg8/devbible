---
title: "The rendering pipeline"
sidebar_label: "02 · The rendering pipeline"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex01-pipeline-and-cssom.mjs`.

**Every CSS property costs a different amount, and the reason is which stage of
the rendering pipeline it invalidates.** Learn the stages once and half of CSS
performance stops being folklore.

## The stages

```
HTML  →  DOM  ─┐
               ├─→  style  →  layout  →  paint  →  composite  →  pixels
CSS   →  CSSOM ┘
```

| Stage | What it decides | Also called |
|---|---|---|
| **Style** | which rules match, and the computed value of every property | recalculate style |
| **Layout** | the geometry — size and position of every box | reflow |
| **Paint** | what pixels go in each box — colours, borders, text, shadows | repaint |
| **Composite** | how the painted layers are assembled and transformed | — |

The stages run in that order, and **a change at one stage forces every stage
after it**. Change geometry and you must repaint and recomposite. Change a
colour and layout is untouched, so the box never moves.

That asymmetry is the whole point: there is no way to change layout cheaply, and
there is a way to move something without changing layout at all.

## Measuring which stage a property touches

The test: mutate one property, then read the element's box back. If the box
changed, layout ran.

```js
// sandbox/css/ex01-pipeline-and-cssom.mjs
const el = document.querySelector('.card');
el.style.display = 'inline-block';       // so the box depends on its own padding
const box = () => {
  const r = el.getBoundingClientRect();
  return {w: r.width, h: r.height, x: r.x};
};

const before = box();
el.style.color = 'purple';               // paint only
const afterPaint = box();
el.style.padding = '3em';                // layout
const afterLayout = box();
el.style.transform = 'translateX(50px)'; // composite only
const afterTransform = box();
```

```console
$ node ex01-pipeline-and-cssom.mjs
=== Which pipeline stage a change costs ===
  before                 (w,h,x)  [98.78334045410156,58,0]
  after color: purple    (w,h,x)  [98.78334045410156,58,0]
  after padding: 3em     (w,h,x)  [130.78334045410156,122,0]
  after translateX(50px) (w,h,x)  [130.78334045410156,122,50]
  color changed the box?          no
  padding changed the box?        yes
  transform changed w/h?          no — only position
```

Three results, three stages:

- **`color`** changed nothing about the box — `[98.78, 58, 0]` before and after.
  Paint only.
- **`padding`** changed both width and height, 98.78 → 130.78 and 58 → 122.
  Layout, then paint, then composite.
- **`transform`** moved `x` from 0 to 50 while width and height stayed at
  130.78 and 122. **The element moved without its box changing** — that is
  compositing, and it is why `transform` is the cheap way to move something.

:::note The element had to be `inline-block`
Measured first on a block-level `width: auto` div, `padding: 3em` left the
border-box width at exactly 900px both times — because a block box fills its
containing block regardless of padding. The measurement was real and proved
nothing. Making the element `inline-block` lets its own box depend on its own
padding, which is what the test is actually about.
:::

## The list worth memorising

**Composite only** — animate these freely:

- `transform`
- `opacity`

**Paint, no layout** — cheap-ish, safe in most animations:

- `color`, `background-color`, `background-image`
- `border-color`, `box-shadow`, `outline`
- `visibility`

**Layout** — expensive, and never animate them:

- `width`, `height`, `padding`, `margin`, `border-width`
- `top`, `right`, `bottom`, `left`, `inset`
- `font-size`, `line-height`, `display`, `position`, `float`
- everything in flex and grid track sizing

The trade-off to name: `transform: translateX()` and `left` can move an element
to the same place, and they are not interchangeable. `left` recomputes the
layout of everything that depends on that box, every frame.
`transform` does not touch layout at all — which also means **other elements do
not react to it**. A transformed element overlaps its neighbours rather than
pushing them; if you wanted the neighbours to move, `transform` is the wrong
tool and the expensive property is the correct one.

## Style is not free either

Before layout there is style resolution: matching every selector against every
element and computing every property. It is usually not your bottleneck — see
**Phase 14** — but it is the stage that a huge
`:has()` invalidation set or a stylesheet with tens of thousands of rules
actually costs.

## Gotchas

**Symptom:** an animation is smooth on desktop and janky on a phone, animating
`left` or `width`.
**Cause:** every frame runs layout for the whole subtree, and layout does not
get faster on a slower device.
**Fix:** animate `transform` instead. Position the element where it should end
up and translate it from there.

**Symptom:** you switch an animation to `transform` and now the elements around
it no longer move out of the way.
**Cause:** that is the mechanism working. `transform` runs after layout, so
layout has no idea the element moved.
**Fix:** if neighbours must react, you need a layout change — accept the cost,
or restructure so the moving element is out of flow
(**Phase 7**).

**Symptom:** a `box-shadow` animation is nearly as janky as animating `width`.
**Cause:** it does not trigger layout, but a large blur radius is genuinely
expensive to paint, every frame, over a large area.
**Fix:** animate `opacity` on a pseudo-element that already carries the shadow,
so the frames are composite-only.

## Interview questions

**★ Why is animating `transform` faster than animating `left`?**
`left` is a layout property: each frame recomputes the geometry of the box and
anything depending on it, then repaints, then composites. `transform` is applied
at the composite stage, after layout and paint are already done, so the frame
only re-assembles existing layers. The measured tell is that `transform` moves
the element's `x` while leaving its width and height untouched.

**★ Name the pipeline stages in order.**
Style (match selectors, compute values) → layout (geometry) → paint (pixels
within boxes) → composite (assemble layers). A change at any stage forces the
stages after it, never the ones before.

**Which properties can be animated without triggering layout?**
`transform` and `opacity` are composite-only. Paint-only properties like
`color` and `background-color` skip layout but still repaint. Everything that
affects geometry — sizes, spacing, offsets, font-size, display — triggers
layout.

**Does `visibility: hidden` cost the same as `display: none`?**
No. `visibility: hidden` keeps the box in layout, so toggling it is a paint
change. `display: none` removes the box, so toggling it forces layout of
everything that reflows to fill the gap.

**If `transform` doesn't affect layout, what happens to the elements around a
transformed element?**
Nothing — they stay where layout put them, and the transformed element can
overlap them. This is a feature for animation and a trap when you expected the
neighbours to reflow.

**Why might a page with a small stylesheet still have slow style recalculation?**
Because cost is driven by how much has to be *re-matched and re-computed*, not
by file size — a broad selector invalidating a large subtree, or a change high
in the tree that forces restyling of everything beneath it.

---

← [01 · What CSS is](./01-what-css-is.md) · Next: [03 · How stylesheets reach the page](./03-how-stylesheets-reach-the-page.md) →
