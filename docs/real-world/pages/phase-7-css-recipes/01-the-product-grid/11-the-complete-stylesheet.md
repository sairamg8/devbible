---
title: "The complete stylesheet"
sidebar_label: "11 · The complete stylesheet"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 — assembles the rules established and sourced in chunks
> 01–10 of this topic; every declaration's justification is on the chunk it came
> from. No sandbox, no console output.

Everything the previous ten chunks decided, in one file, in the order it should
be read. Nothing here is new — this is the copyable form.

## The markup contract

The stylesheet assumes exactly this, and every class in it appears here:

```jsx
<section className="catalog">
  <ul className="product-grid" role="list" aria-busy={loading}>
    <li className="product-card">
      <div className="product-card__inner">
        <div className="product-card__media">
          <img src={…} width={800} height={600} alt={product.name}
               loading={eager ? 'eager' : 'lazy'} decoding="async" />
        </div>
        <div className="product-card__body">
          <h3 className="product-card__name">{product.name}</h3>
          <p className="product-card__price-row">
            <span className="product-card__price">{formatted}</span>
            <s className="product-card__compare-at">{formattedWas}</s>
          </p>
        </div>
        <button className="product-card__buy">Add to cart</button>
      </div>
    </li>
  </ul>

  <p className="catalog__end">That's everything</p>
  <div className="catalog__sentinel" aria-hidden="true" />
</section>

<p role="status" className="visually-hidden">{statusText}</p>
```

Two additions to the Phase 4 markup, both argued for where they were introduced:
**`role="list"`** ([chunk 02](02-autofill-grid-and-the-list-reset.md)) and the
**`__inner` wrapper** ([chunk 03](03-the-card-adapts-to-its-column.md), because
a container cannot query itself).

## `src/styles/components/product-grid.css`

```css
@layer components {
  /* ── the page shell ─────────────────────────────────────── */
  .catalog {
    max-inline-size: 90rem;
    margin-inline: auto;
    padding-inline: var(--space-4);
  }

  /* ── the grid ───────────────────────────────────────────── */
  .product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(16rem, 100%), 1fr));
    gap: var(--space-5);

    list-style: none;
    margin: 0;
    padding: 0;
  }

  /* ── the card ───────────────────────────────────────────── */
  .product-card {
    container: card / inline-size;

    display: grid;
    grid-row: span 3;
    grid-template-rows: subgrid;
    row-gap: var(--space-2);
  }

  .product-card__inner,
  .product-card__body,
  .product-card__price-row {
    min-inline-size: 0;
  }

  .product-card__inner { display: grid; gap: var(--space-3); }

  /* ── the media box ──────────────────────────────────────── */
  .product-card__media {
    aspect-ratio: var(--card-ratio, 4 / 3);
    background-color: var(--surface-2);
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

  /* ── the text ───────────────────────────────────────────── */
  .product-card__body { display: grid; gap: var(--space-2); }

  .product-card__name {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    overflow-wrap: break-word;
    text-wrap: pretty;
  }

  /* ── the price ──────────────────────────────────────────── */
  .product-card__price-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .product-card__price      { font-variant-numeric: tabular-nums; font-weight: 600; }
  .product-card__compare-at {
    font-variant-numeric: tabular-nums;
    text-decoration: line-through;
    color: var(--text-muted);
  }

  /* ── the action ─────────────────────────────────────────── */
  .product-card__buy { display: none; inline-size: 100%; min-block-size: 2.75rem; }

  /* ── container-driven changes, and only genuine ones ────── */
  @container card (inline-size >= 15rem) {
    .product-card__buy { display: block; }
  }

  @container card (inline-size >= 26rem) {
    .product-card__inner { grid-template-columns: 8rem 1fr; align-items: start; }
  }

  /* ── states ─────────────────────────────────────────────── */
  .catalog__empty,
  .catalog__error,
  .catalog__end {
    grid-column: 1 / -1;
    display: grid;
    justify-items: center;
    gap: var(--space-3);
    padding-block: var(--space-8);
    text-align: center;
  }

  .catalog__end {
    padding-block: var(--space-5);
    color: var(--text-muted);
    font-size: 0.9375rem;
  }

  .catalog__retry    { min-block-size: 2.75rem; padding-inline: var(--space-4); }
  .catalog__sentinel { block-size: 1px; }

  .product-card--skeleton .product-card__media { background: var(--surface-3); }
  .product-card--skeleton .product-card__name  { min-block-size: 2lh; }

  @media (prefers-reduced-motion: reduce) {
    .catalog__spinner,
    .product-card--skeleton::after { animation: none; }
  }
}

@layer utilities {
  .visually-hidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
```

## `content-visibility` is deliberately absent

[Chunk 06](06-image-delivery-and-long-grids.md) introduced
`content-visibility: auto` for very long grids, and it is **not** in this file.

The reason is a genuine conflict rather than an oversight: `subgrid` needs the
card's rows to participate in shared parent tracks, and `content-visibility`
lets the browser skip laying out off-screen cards entirely — so the shared
tracks would depend on measurements that are deliberately not being taken.
Both features are legitimate; applying them to the same element is asking for
alignment and skipping at once.

**The catalog chooses alignment.** A grid long enough to need skipping is a
grid that should probably be virtualised, which is the third row of that
chunk's table.

## The three things this file does not do

- **It does not decide state.** Empty, loading, end and error are rendered by
  the component; CSS styles what it is given
  ([chunk 10](10-empty-end-and-error-states.md)).
- **It does not format the price.** That is `Intl.NumberFormat` in
  [chapter 5·06](../../phase-5-js-functions/06-money-and-dates/README.md), and
  the stylesheet is careful to assume nothing about its width.
- **It does not define a single colour.** Every colour is a token — the
  dependency contract is [chunk 12](12-tokens-layers-and-the-contract.md).

## Gotchas

- **Symptom:** the buy button never appears, at any width. **Cause:** the card
  is not actually a query container — `container: card` sets the *name* only,
  while `container: card / inline-size` sets name and type. **Fix:** check the
  computed `container-type`; a missing type makes every `@container` rule fail
  to match, which looks exactly like a typo in the condition.

- **Symptom:** the card ignores every container query when reused outside
  `.catalog`. **Cause:** the `__inner` wrapper was dropped when the markup was
  copied. **Fix:** the wrapper is part of the contract, not an implementation
  detail — there is nothing else for the query's rules to target.

- **Symptom:** the grid looks right but every card is the same height as the
  tallest one on the page rather than the tallest in its row. **Cause:**
  `grid-row: span 3` without the parent having three row tracks per card row, so
  the spans overlap. **Fix:** the parent's implicit row tracks and the card's
  span have to agree; count them.

- **Symptom:** cards collapse or flicker while scrolling a long catalog.
  **Cause:** `content-visibility: auto` was added back onto a subgridded card.
  **Fix:** pick one — see the section above.

- **Symptom:** the file is correct in isolation and wrong once imported.
  **Cause:** layer order, which [chunk 12](12-tokens-layers-and-the-contract.md)
  covers. **Fix:** declare the order in the entry stylesheet before any import.

- **Symptom:** editing this file requires re-reading it to find anything.
  **Cause:** it grew past the point where source order alone communicates
  structure. **Fix:** the section comments are load-bearing; keep them in the
  order the page is read — shell, grid, card, media, text, price, action,
  queries, states.

- **Symptom:** a designer's change to the card requires edits in four places.
  **Cause:** the change is a *parameter* being expressed as a rule. **Fix:**
  check whether it belongs as a custom property with a default, the way
  `--card-ratio` does.

## Interview questions

1. **★ `container: card` versus `container: card / inline-size` — what is the
   difference?** The shorthand's second value is the type. Without it you have
   named a container that has no query type, so nothing can query it — and the
   failure is silent, because every `@container` rule simply never matches. It
   presents identically to a mistake in the query condition, which is what makes
   it worth recognising by shape.

2. **★ Why is `content-visibility` absent from a file that argued for it?**
   Because it conflicts with `subgrid` on the same element: subgrid needs the
   card's rows to contribute to shared parent tracks, and `content-visibility`
   exists precisely to avoid laying out off-screen elements. The catalog chooses
   cross-card alignment; a grid long enough to need skipping is a
   virtualisation problem, not a CSS one.

3. **★ Which parts of this component's markup are contract rather than
   incidental?** The `__inner` wrapper (a container cannot query itself),
   `role="list"` (WebKit drops list semantics when markers are removed), and the
   `width`/`height` attributes on the image (space reservation before the CSS
   arrives). All three look like details a tidy-up would remove, and all three
   break the component when removed.

4. **The stylesheet is ~120 lines and replaces four media queries and a
   breakpoint table. What did that trade cost?** One extra DOM element per card,
   and a dependency on container queries. What it bought is a component whose
   correctness does not depend on where it is placed — which is the failure
   mode the media-query version could not fix at any length.

5. **Why keep the section comments?** Because at this size source order is the
   only structure a stylesheet has, and the order chosen — shell, grid, card,
   media, text, price, action, queries, states — is the order someone debugging
   will read it in. It is documentation of the layout's shape, not decoration.

6. **How would you tell whether a new requirement belongs as a rule or a
   parameter?** If satisfying it means editing this file for a *placement*
   rather than for the component, it is a parameter — a custom property with a
   default, set by the context. `--card-ratio` is the worked example: a square
   thumbnail variant needs no change here at all.

---

← Prev [Empty, end and error states](10-empty-end-and-error-states.md) ·
Next → [Tokens, layers and the component contract](12-tokens-layers-and-the-contract.md)
