---
title: "Image delivery: lazy loading, srcset and long grids"
sidebar_label: "06 · Delivery and long grids"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 — MDN *Responsive images* (`srcset`, `sizes`), the HTML
> specification's `loading`, `decoding` and `fetchpriority` attributes, MDN
> *`content-visibility`* and *`contain-intrinsic-size`*, and web.dev's Largest
> Contentful Paint definition. Composes
> [chapter 4·03](../../phase-4-react-ui/03-the-infinite-product-list.md), whose
> sentinel decides which cards exist at all. No sandbox, no measured timings.

[Chunk 05](05-images-without-layout-shift.md) reserved the space. This chunk is
about what goes into it, when, and at what size — the part that decides whether
the catalog is fast or merely stable.

## Eager above the fold, lazy below it

```jsx
<img
  src={product.image.src}
  srcSet={product.image.srcSet}
  sizes="(min-width: 64rem) 20rem, (min-width: 40rem) 33vw, 50vw"
  width={800}
  height={600}
  alt={product.name}
  loading={eager ? 'eager' : 'lazy'}
  fetchPriority={eager ? 'high' : 'auto'}
  decoding="async"
/>
```

Lazy loading defers an image until it approaches the viewport, which is exactly
right for the 200 products below the fold and exactly wrong for the ones already
on screen. **The first visible row usually contains the Largest Contentful Paint
element**, and deferring it delays the metric it defines — a self-inflicted
regression that looks like a best practice.

In this app the boundary is knowable rather than guessed. The first page of
results is above the fold; every page the sentinel appends is below it by
definition, because the sentinel is what triggered the fetch:

```jsx
<ProductCard product={p} eager={pageIndex === 0 && index < 4} />
```

- **`fetchpriority="high"`** asks the browser to move a genuine LCP candidate up
  the queue. Applied to everything it means nothing — a priority every resource
  shares is just the original ordering with extra markup.
- **`decoding="async"`** lets the browser decode off the main thread, so a large
  image landing mid-scroll does not stall interaction.

⚠️ **`loading="lazy"` also suppresses the request entirely for cards that never
scroll into view**, which on an infinite list is most of them. That is the real
saving; the LCP carve-out is the exception that keeps it from costing more than
it saves.

## `sizes` is the attribute people get wrong

`srcset` offers the browser a set of files. **`sizes` tells it how wide the
image will be laid out**, so it can choose one *before layout has happened*.

Get `sizes` wrong and the browser downloads a 2000 px file for a 260 px slot.
The markup is valid, the page renders perfectly, and the bytes are wasted
silently — there is no visual symptom at all, which is why this survives review
in a way a broken layout never would.

An `auto-fill` grid makes it genuinely hard, because the column width is the
*output* of the track-sizing algorithm and `sizes` must be evaluated before
that. Two honest options:

- **Approximate it from the grid's own logic.** The floor is 16 rem, so a slot
  is never far below 256 px and rarely above about 24 rem. The `sizes` list
  above encodes that. Being slightly wrong costs a slightly oversized download,
  not a bug — and it is deterministic, which makes it reviewable.
- **`sizes="auto"`** lets the browser use the image's actual laid-out size, and
  is defined for lazy-loaded images specifically. **Support is recent and not
  universal at the time of writing** — treat it as a progressive enhancement and
  keep a length-based `sizes` as the fallback, rather than depending on it.

The honest summary: `sizes` on a fully intrinsic grid is an approximation, and
the goal is to be approximately right rather than precisely wrong.

## Very long grids: `content-visibility`

Infinite scroll accumulates. After a few pages the grid holds hundreds of cards,
and the engine styles, lays out and paints every one of them even though most
are far off screen.

```css
@layer components {
  .product-card {
    content-visibility: auto;
    contain-intrinsic-size: auto 22rem;
  }
}
```

`content-visibility: auto` lets the browser skip rendering work for elements
outside the viewport. **`contain-intrinsic-size` is not optional alongside it** —
it supplies the size a skipped element should be assumed to have. Without it
every off-screen card measures zero, the document's height changes as you
scroll, the scrollbar jumps, and scroll anchoring fights the user. The `auto`
keyword in `contain-intrinsic-size: auto 22rem` tells the browser to remember the
real size once it has measured it and use that in place of the guess.

Two things to be clear-eyed about:

- **It applies to the repeated child, not the container.** The grid itself is on
  screen, so nothing about it can be skipped; skipping happens per element that
  leaves the viewport.
- **It is a trade, and it belongs behind a real need.** It helps a grid holding
  hundreds of cards and does nothing measurable for one holding twenty. Reaching
  for it by default adds a class of scroll-position bugs in exchange for
  nothing.

## The relationship with the sentinel

None of this replaces [chapter 4·03](../../phase-4-react-ui/03-the-infinite-product-list.md)'s
pagination, and the distinction is worth stating plainly:

| Mechanism | Decides |
|---|---|
| The sentinel + cursor | **Which cards exist in the DOM at all** |
| `loading="lazy"` | Which existing cards have fetched their image |
| `content-visibility` | Which existing cards are being rendered right now |

They compose, and each one is doing a job the others cannot. A page that
accumulates 500 cards has a DOM-size problem that lazy loading will not touch;
a page that fetches 500 full-size images has a bandwidth problem that
virtualisation would have solved differently. Naming which of the three is
actually hurting is the whole diagnosis.

## Gotchas

- **Symptom:** the LCP metric regressed after lazy loading was applied
  everywhere. **Cause:** the above-the-fold image is now deferred, so the
  browser deliberately delays fetching the thing the metric measures.
  **Fix:** eager plus `fetchpriority="high"` for the first visible row, lazy for
  everything after.

- **Symptom:** `fetchpriority="high"` was added to every card image and nothing
  improved. **Cause:** priority is relative; raising everything restores the
  original order. **Fix:** reserve it for the one or two genuine LCP candidates.

- **Symptom:** huge images downloaded into small slots — the network panel shows
  2000 px files in a 260 px grid. **Cause:** `sizes` is missing or wrong, so the
  browser assumed `100vw`. **Fix:** a `sizes` value that reflects the real slot
  width. This never appears as a visual bug, so it has to be looked for
  deliberately.

- **Symptom:** `srcset` was added and the browser still picks the largest file.
  **Cause:** with a `w` descriptor set and no `sizes`, the default assumption is
  `100vw`; on a desktop that is the biggest candidate every time. **Fix:**
  `sizes` is not optional when `srcset` uses width descriptors.

- **Symptom:** images look soft on a high-density display. **Cause:** `sizes`
  describes CSS pixels and the browser multiplies by device pixel ratio — if the
  `srcset` has no candidate large enough, it upscales the best it has.
  **Fix:** include candidates at roughly twice the largest slot width.

- **Symptom:** the scrollbar length jitters and scroll position drifts after
  adding `content-visibility: auto`. **Cause:** no `contain-intrinsic-size`, so
  off-screen cards measure zero and the document height changes as they enter
  and leave. **Fix:** always pair the two, and prefer the `auto <length>` form.

- **Symptom:** `content-visibility` was applied to the grid and nothing is
  skipped. **Cause:** the container is on screen, so its content renders.
  **Fix:** apply it to the repeated child.

- **Symptom:** in-page search or anchor navigation behaves oddly on a very long
  grid. **Cause:** skipped subtrees are not laid out until they are needed, and
  anything that jumps directly into one forces a synchronous pass. **Fix:**
  expect it, and treat it as another reason not to apply `content-visibility`
  where it is not earning its place.

- **Symptom:** memory grows without bound as the user scrolls. **Cause:** an
  accumulating list keeps every card in the DOM; neither lazy loading nor
  `content-visibility` removes nodes. **Fix:** this is a virtualisation
  question, not a CSS one — the table above is the map for deciding which of the
  three mechanisms the problem actually belongs to.

## Interview questions

1. **★ When is `loading="lazy"` the wrong choice?** Above the fold, and
   especially on the LCP element. Lazy loading defers the fetch until the image
   nears the viewport; for something already visible that is pure delay, and it
   directly regresses the metric measuring how fast the main content appeared.

2. **★ What does `sizes` actually tell the browser, and what happens if it is
   wrong?** How wide the image will be laid out, expressed so the browser can
   evaluate it *before* layout and pick from `srcset` accordingly. Wrong values
   are silent: the page looks perfect and the browser downloads a file several
   times larger than needed. It is a bandwidth bug with no visual symptom, which
   is exactly why it survives review.

3. **★ Why is `sizes` hard for an `auto-fill` grid specifically?** Because the
   column width is the *output* of the track-sizing algorithm — it depends on the
   container width and the floor — and `sizes` has to be evaluated before layout
   runs. You either approximate from the grid's own logic or use `sizes="auto"`
   on lazy images where support allows, keeping a length-based fallback.

4. **★ What is the difference between lazy loading, `content-visibility`, and
   virtualisation?** They act at three different levels: virtualisation controls
   which elements exist in the DOM, `content-visibility` controls which existing
   elements are rendered, and `loading="lazy"` controls which existing elements
   have fetched their images. A 500-card DOM-size problem is untouched by the
   other two, and diagnosing which level hurts is most of the work.

5. **`fetchpriority="high"` on every image — what happens?** Nothing useful.
   Priority is relative, so raising everything restores the original order while
   adding noise for whoever reads the markup next. It is only meaningful on the
   one or two resources you genuinely want ahead of the queue.

6. **Why is `contain-intrinsic-size` mandatory with `content-visibility:
   auto`?** Because skipped elements have no laid-out size and therefore measure
   zero. The document height then changes as elements enter and leave the
   viewport: the scrollbar jumps, scroll anchoring fights the user, and
   scrolling feels broken. The intrinsic-size hint supplies placeholder
   dimensions, and its `auto` form lets the browser reuse real measurements once
   it has them.

7. **What does `decoding="async"` buy you?** It permits image decoding off the
   main thread, so a large image arriving mid-scroll does not block interaction
   while it is decoded. It does not affect *when* the image is fetched — that is
   `loading` and `fetchpriority`.

8. **How do you decide which cards are "eager"?** From structure rather than
   measurement: in this app the first page of results is above the fold and
   every appended page is below it by construction, because the sentinel is what
   triggered the fetch. Guessing a pixel offset would be fragile; deriving it
   from the pagination is not.

9. **Why do images look soft on high-density screens even with `srcset`?**
   Because `sizes` is expressed in CSS pixels and the browser multiplies by the
   device pixel ratio when choosing a candidate. If no candidate is large
   enough, it upscales the largest available — so the `srcset` needs entries at
   roughly twice the biggest slot width.

---

← Prev [Images without layout shift](05-images-without-layout-shift.md) ·
Next → [The text squeeze and clamping](07-the-text-squeeze-and-clamping.md)
