---
title: "Images without layout shift"
sidebar_label: "05 · Images without layout shift"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 — MDN *`aspect-ratio`*, *`object-fit`*, *`object-position`*,
> the HTML specification's `width`/`height` attributes and their default
> aspect-ratio behaviour, and web.dev's Cumulative Layout Shift definition.
> Composes
> [CSS 0·04](../../../../css/pages/phase-0-how-css-runs/04-render-blocking-css.md)
> and [CSS 0·06](../../../../css/pages/phase-0-how-css-runs/06-user-agent-stylesheets.md).
> No sandbox, no measured timings.

A catalog is mostly photographs, and every photograph arrives after the layout
around it has already been painted. If nothing reserved its space, the grid
reflows as each one lands — text jumps out from under the reader's eye, and a
tap intended for "Add to cart" lands on the next card. **The product grid is
the single worst layout-shift offender in the storefront**, because it has the
most images per screen and they all arrive at unpredictable times.

Reserving the space is not an optimisation. It is the difference between a
usable list and one that fights the user.

## The media box

```css
@layer components {
  .product-card__media {
    aspect-ratio: 4 / 3;
    background-color: var(--surface-2);   /* the reserved space, made visible */
    border-radius: var(--radius-2);
    overflow: hidden;
  }

  .product-card__media img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    object-position: center;
    display: block;
  }
}
```

Five decisions, each with a failure it prevents:

- **`aspect-ratio` on the wrapper** reserves a box of known proportions before
  any image byte arrives. The grid computes its row heights from it immediately,
  so nothing moves later.
- **`object-fit: cover`** makes a photo of any real-world dimensions fill that
  box without distorting — it crops instead of stretching. Product photography
  is never uniformly sized, and `cover` is what makes a mixed catalog look
  deliberate rather than neglected.
- **`object-position`** decides *what* gets cropped. `center` is the right
  default; a catalog whose photography is consistently top-weighted is the case
  for changing it, and it is a content decision rather than a styling one.
- **`display: block` on the image** removes the inline-layout descender gap
  beneath it — the few pixels of unexplained space that otherwise appear under
  every image and that no padding rule accounts for.
- **The background colour** means the reserved box reads as a product slot
  rather than a hole, which matters precisely because the reservation is doing
  its job while the image is absent.

`overflow: hidden` on the wrapper is what makes the border radius apply to the
cropped photo; without it the image's corners paint over the rounded wrapper.

## The two attributes CSS cannot replace

```jsx
<img
  src={product.image.src}
  width={800}
  height={600}
  alt={product.name}
/>
```

⚠️ **`width` and `height` still matter even though the CSS above overrides
both.** The browser divides them to derive a *default aspect ratio*, and it can
do that from the HTML **before the stylesheet has arrived**. On a slow
connection — the one where shift hurts most — the CSS `aspect-ratio` rule is not
yet available, and the attributes are the only reservation in effect. They are
cheap insurance against your own render-blocking CSS being slow
([CSS 0·04](../../../../css/pages/phase-0-how-css-runs/04-render-blocking-css.md)).

Give them the **intrinsic** dimensions of the source file, not the displayed
size. They are being read as a ratio, not as a layout instruction — and the CSS
rules above will override the used values anyway.

## Where the ratio comes from

`4 / 3` is not arbitrary and it is not a CSS decision. It is whatever ratio the
product photography is actually shot and cropped at, and the stylesheet's job is
to state it once so that every card agrees. Two consequences worth being
deliberate about:

- **A catalog with mixed ratios must pick one and crop to it.** `cover` does the
  cropping; the alternative — letting each card take its image's natural ratio —
  produces a grid whose rows are all different heights, which is the ragged look
  the grid was chosen to avoid.
- **If the ratio ever needs to differ per placement** — a wide hero card, a
  square rail thumbnail — that is a custom property, not a second rule:

```css
.product-card__media { aspect-ratio: var(--card-ratio, 4 / 3); }
.product-rail .product-card { --card-ratio: 1; }
```

which is the component-API pattern from
[CSS 3·01](../../../../css/pages/phase-3-custom-properties/01-custom-properties-as-a-component-api.md):
the component declares what may be varied, and the context varies it, without
either side reaching into the other's selectors.

## Gotchas

- **Symptom:** the grid jumps as images load and taps land on the wrong card.
  **Cause:** nothing reserved the image's space. **Fix:** `aspect-ratio` on the
  media wrapper *and* `width`/`height` attributes on the `<img>` — the CSS for
  the steady state, the attributes for the window before the CSS arrives.

- **Symptom:** photos are squashed or stretched. **Cause:** the image is being
  sized into a box of a different ratio with no `object-fit`, so it distorts to
  fit. **Fix:** `object-fit: cover` to crop, or `contain` if the whole product
  must always be visible — `contain` letterboxes, which is exactly why the
  wrapper needs a background colour.

- **Symptom:** a few pixels of stubborn space under every image that no padding
  rule explains. **Cause:** an `<img>` is an inline-level box sitting on the
  text baseline, so room is reserved for descenders below it. **Fix:**
  `display: block` on the image.

- **Symptom:** `aspect-ratio` seems to be ignored entirely. **Cause:** something
  gave the element a definite size in both axes — an explicit `height` in CSS,
  or the element being a stretched flex or grid item. `aspect-ratio` derives one
  axis from the other, so it has nothing to do when neither is free.
  **Fix:** remove the competing size, usually by letting the row track size
  itself.

- **Symptom:** rounded corners on the card, square corners on the photo.
  **Cause:** the image paints over the wrapper's rounded box. **Fix:**
  `overflow: hidden` on the wrapper — the radius clips the child rather than
  being restated on it.

- **Symptom:** rows are all different heights even though every card is in the
  same grid. **Cause:** each media box took its image's natural ratio instead of
  a declared one. **Fix:** one `aspect-ratio` for the component; cropping is the
  price of a uniform grid and `cover` is how you pay it.

- **Symptom:** a rail of square thumbnails needed a different ratio, and a
  second selector was written to override the first. **Cause:** the variation
  was expressed as a competing rule rather than as a parameter. **Fix:** a
  custom property with a default, set by the context.

- **Symptom:** the reserved box flashes white before the photo appears, despite
  the background colour. **Cause:** the `<img>` element is painting its own
  empty box over the wrapper. **Fix:** the background belongs on the wrapper,
  and the image should have no background of its own — the arrangement above.

- **Symptom:** the placeholder colour is invisible in dark mode, or blinding in
  light mode. **Cause:** a hard-coded grey. **Fix:** a surface token
  (`--surface-2`), which is what [chapter 05 · Dark mode](../05-dark-mode/README.md)
  exists to define — the placeholder is a surface like any other.

- **Symptom:** a product photo has an `alt` that reads out a file name.
  **Cause:** `alt` filled in mechanically from the asset. **Fix:** in a catalog
  the image *is* the product, so `alt` is the product name. Empty `alt` is
  correct only when the same information is already adjacent in text and the
  image genuinely adds nothing.

## Interview questions

1. **★ What causes Cumulative Layout Shift on a product grid, and what is the
   complete fix?** Images whose space was not reserved: the grid lays out
   without them, then reflows as each one arrives, moving everything below it.
   The complete fix is two-part — `aspect-ratio` on the wrapper for the steady
   state, and `width`/`height` attributes on the `<img>` so the browser can
   derive the ratio from HTML alone before the stylesheet lands. Doing only one
   leaves a window where shift still happens.

2. **★ Why do `width` and `height` attributes still matter when CSS overrides
   both?** Because the browser uses their ratio to reserve space at parse time,
   before the render-blocking CSS arrives. On the slow connections where shift
   is worst, they are the only reservation in effect — so they are insurance
   against your own stylesheet's latency, not a legacy habit.

3. **★ `object-fit: cover` or `contain` — how do you choose?** `cover` fills the
   box and crops; `contain` fits the whole image and letterboxes. For a catalog
   of inconsistent photography, `cover` gives a uniform grid at the cost of
   cropping edges; `contain` guarantees the whole product is visible at the cost
   of ragged whitespace, which then needs the wrapper background to look
   intentional. It is a content decision that CSS merely executes.

4. **★ Why `display: block` on an image?** An `<img>` is inline-level by default
   and therefore sits on the text baseline, which reserves room for descenders
   below it. That descender space is the source of the mysterious few pixels
   under images inside a container, and no amount of padding hunting will find
   it.

5. **When does `aspect-ratio` get ignored?** When both axes are already
   definite — an explicit height, or a stretched flex or grid item. The property
   derives one axis from the other, so it has nothing to do when neither is
   free. The usual real-world cause is a stretch alignment nobody remembers
   setting.

6. **Why does the rounded card need `overflow: hidden` rather than a radius on
   the image?** Because the radius has to clip the *content* of the media box,
   and the image is that content. Restating the radius on the image works until
   something else is layered in the same box — a badge, a gradient — at which
   point each layer needs its own copy. Clipping once at the wrapper is the
   version that keeps working.

7. **How would you support a different image ratio in a different placement
   without a second rule?** A custom property with a default —
   `aspect-ratio: var(--card-ratio, 4 / 3)` — set by the context. The component
   declares what may vary and the context varies it, so neither side has to know
   the other's selectors, and there is no specificity contest to win.

8. **Why put the placeholder background on the wrapper rather than the image?**
   Because the wrapper exists whether or not the image has loaded, and it is the
   element whose space was reserved. A background on the `<img>` only paints
   once the element has a box to paint, which is the moment you no longer need
   the placeholder.

---

← Prev [Container units, and what containment does to you](04-container-units-and-containment.md) ·
Next → [Image delivery: lazy loading, `srcset` and long grids](06-image-delivery-and-long-grids.md)
