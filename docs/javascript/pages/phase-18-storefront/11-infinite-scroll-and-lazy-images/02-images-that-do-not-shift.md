---
title: "02 · Images that do not shift"
sidebar_label: "02 · Images that do not shift"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`<img>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img) (`loading`, `decoding`, `fetchpriority`, `srcset`, `sizes`, `width`/`height`, `alt`), [Responsive images](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Responsive_images), [`<picture>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/picture), [`aspect-ratio`](https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio), [`content-visibility`](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility), [Cumulative Layout Shift](https://developer.mozilla.org/en-US/docs/Glossary/CLS). Documentation-validated; **no timings and no console output**.

A product grid is mostly images, and images are where a storefront loses both its bandwidth and its
layout stability. The good news is that almost none of this needs JavaScript: the platform does
lazy loading, responsive selection and space reservation in attributes.

## The whole thing, in one element

```html
<img
  src="/p/1234-400.jpg"
  srcset="/p/1234-400.jpg 400w, /p/1234-800.jpg 800w, /p/1234-1200.jpg 1200w"
  sizes="(width <= 600px) 50vw, 300px"
  width="400" height="400"
  loading="lazy" decoding="async"
  alt="Blue enamel kettle, 1.7 litre" />
```

| Attribute | What it is doing |
|---|---|
| `srcset` + `sizes` | lets the browser pick the right file for the layout and screen |
| `width` + `height` | 🔴 reserves the space — this is the anti-layout-shift line |
| `loading="lazy"` | defers the fetch until the image nears the viewport |
| `decoding="async"` | decode after the surrounding content is presented |
| `alt` | mandatory; describes the product, or `alt=""` if genuinely decorative |

## 🔴 Reserving space is the whole layout-shift story

MDN puts it plainly: including `height` and `width` *"enables the aspect ratio of the image to be
calculated by the browser prior to the image being loaded. This aspect ratio is used to reserve the
space needed to display the image, reducing or even preventing a layout shift."* And it adds that
while the attributes are recommended for all images, they are *"especially important for
lazy-loaded ones"* — because those arrive late, after the user has started reading.

```css
.product-card img { width: 100%; height: auto; }   /* the attributes still supply the ratio */
.product-card img { aspect-ratio: 1 / 1; object-fit: cover; }   /* or state it explicitly */
```

Those two attributes plus `height: auto` are how a responsive image keeps its reserved box. Layout
shift is one of the Core Web Vitals ([Phase 12 · 06 · The metrics](../../phase-12-browser-platform/06-performanceobserver/03-the-metrics.md)),
and images without dimensions are its most common cause.

## 🔴 Never lazy-load the image the user is already looking at

```html
<!-- the hero / first row: eager, and asked for early -->
<img src="/hero-1200.jpg" width="1200" height="600" fetchpriority="high" alt="…" />
```

`loading="lazy"` on an above-the-fold image delays the very thing the page is being measured on —
and MDN records a second, sharper consequence: *"Lazy-loaded images will never be loaded if they do
not intersect a visible part of an element, even if loading them would change that, because
unloaded images have a `width` and `height` of `0`."* An unloaded lazy image with no reserved
dimensions can therefore never become visible enough to load.

MDN also notes that lazy images inside the viewport *"may not yet be visible when the `load` event
is fired"*, because that event only counts eager images — which is why "wait for `load`, then
measure" quietly stops being true.

**The rule for a storefront:** the first screen of products is `loading="eager"`, and the
LCP candidate gets `fetchpriority="high"`. Everything below the fold is `lazy`.

## Choosing the file: `srcset` and `sizes`

- **`w` descriptors** state each file's real intrinsic width. The browser divides it by the slot
  width from `sizes` to work out the effective density it would get. It is the right choice for
  images whose displayed size depends on layout — which is every product grid.
- **`x` descriptors** are for a fixed display size at different screen densities: a logo, an icon.
- ⚠️ **Never mix `w` and `x` in one `srcset`** — MDN says it is invalid, as are duplicate
  descriptors.
- **`sizes` defaults to `100vw`**, which is almost always wrong for a grid and makes the browser
  download a much larger file than the slot needs. If you set `srcset` with `w`, set `sizes`.

**`<picture>` is for a different question:** art direction (a different crop on mobile) or format
negotiation (`<source type="image/avif">` with a JPEG fallback). If all you are doing is offering
the same image at several sizes, `srcset` on a plain `<img>` is enough.

## Where JavaScript still has a job

The platform covers the common path, so keep JS for what attributes cannot express:

- **A blur-up or dominant-colour placeholder** — a tiny inline image or a background colour behind
  the reserved box, removed on `load`.
- **A broken-image fallback** — listen for `error` on the image and swap in a placeholder, because a
  404 in a product grid otherwise renders as the browser's own broken icon.
- **Priority hints from data you have and the browser does not** — the first N cards eager, the rest
  lazy, computed while rendering the list.
- **Preloading the next page's images** once the sentinel is within reach
  ([01 · The endless list](./01-the-endless-list.md)).

```js
img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
img.addEventListener('error', () => img.replaceWith(placeholderFor(product)), { once: true });
```

⚠️ **Do not hand-roll lazy loading with `IntersectionObserver` and `data-src` any more.** It was the
right pattern before `loading="lazy"` existed; today it means images do not load without JavaScript,
do not participate in the browser's own priority scheduling, and are one bug away from never
appearing at all.

## And the row nobody thinks about: rendering cost

Even loaded images cost layout and paint. For a very long grid, `content-visibility: auto` with a
`contain-intrinsic-size` hint lets the browser skip rendering off-screen cards entirely — a
one-declaration version of what windowing does in JavaScript, and worth trying first.

## Gotchas

**Symptom: the page jumps while images arrive.**
Cause — no `width`/`height` (or `aspect-ratio`) to reserve space.
Fix — always set them; keep `height: auto` in CSS for responsive scaling.

**Symptom: LCP got worse after adding lazy loading everywhere.**
Cause — the hero or first-row image is lazy.
Fix — `loading="eager"` above the fold, plus `fetchpriority="high"` on the LCP image.

**Symptom: some lazy images never load at all.**
Cause — an unloaded lazy image has zero width and height, so it never intersects.
Fix — reserve dimensions so the placeholder box occupies real space.

**Symptom: mobile downloads the desktop-sized image.**
Cause — `srcset` with `w` descriptors and no `sizes`, which defaults to `100vw`.
Fix — a `sizes` value that matches the grid slot.

**Symptom: `srcset` is ignored entirely.**
Cause — mixing `w` and `x` descriptors, or duplicate descriptors — invalid.
Fix — pick one descriptor type per `srcset`.

**Symptom: a broken image shows the browser's placeholder icon in the grid.**
Cause — no `error` handling.
Fix — an `error` listener that swaps in your own placeholder.

**Symptom: images do not appear for users where the bundle failed.**
Cause — hand-rolled `data-src` lazy loading.
Fix — native `loading="lazy"`; the markup works without JavaScript.

## Interview questions

**★ How do you stop images shifting the layout?**
Give every `<img>` `width` and `height` so the browser can compute the aspect ratio and reserve the
box before the file arrives — or state `aspect-ratio` in CSS. It matters most for lazy-loaded
images, which arrive after the user has begun reading.

**★ Which images should not be lazy-loaded?**
Anything in the first viewport, especially the LCP candidate — lazy loading delays exactly the
paint being measured, and an unloaded lazy image with no reserved size may never intersect enough
to load at all.

**★ When do you use `w` descriptors versus `x`?**
`w` when the displayed size depends on layout — grids, article images — paired with `sizes`. `x`
for a fixed display size across densities, like a logo. Mixing them in one `srcset` is invalid.

**★ What happens if you use `srcset` with `w` and omit `sizes`?**
`sizes` defaults to `100vw`, so the browser assumes the image fills the viewport and picks a file
far larger than the slot needs.

**★ Is there still a reason to write JavaScript lazy loading?**
No — use `loading="lazy"`. JavaScript is for what attributes cannot do: placeholders, error
fallbacks, prioritising the first N cards, and prefetching the next page.

---

← [01 · The endless list](./01-the-endless-list.md) · [Topic index](./README.md)
