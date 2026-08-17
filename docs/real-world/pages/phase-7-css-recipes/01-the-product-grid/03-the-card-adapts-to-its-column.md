---
title: "The card adapts to its column"
sidebar_label: "03 · The card adapts to its column"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 — MDN *CSS container queries*, MDN *`container-type`* and
> *`container-name`*, and the CSS Containment Level 3 specification (query
> containers, the container shorthand, range syntax). Composes
> [CSS 6·01](../../../../css/pages/phase-6-container-queries/01-container-queries.md)
> and [6·02](../../../../css/pages/phase-6-container-queries/02-layouts-that-need-no-query.md).
> No sandbox, no console output.

The grid decides how wide a column is. The card has the second half of the
problem: **the same `ProductCard` renders in three places of very different
widths on the same viewport.**

| Where | Typical inline size | What it should look like |
|---|---|---|
| The catalog grid | 16–24 rem | Image on top, name, price, buy button |
| The "related products" rail on a product page | 11–14 rem | Image on top, name and price, no button |
| A cart drawer line item | 20 rem, but short | Thumbnail *beside* name and price |

A viewport media query cannot express a single one of these, because in all
three the viewport is identical. The question the card needs answered is *how
much room did my parent actually give me*, and that is what container queries
are for.

## Making the card a container

```css
@layer components {
  .product-card {
    container-type: inline-size;
    container-name: card;

    display: grid;
    gap: var(--space-3);
  }
}
```

Or with the shorthand, which is the form worth getting used to:

```css
.product-card { container: card / inline-size; }
```

Two declarations doing two separate things:

- **`container-type: inline-size`** makes the element a *query container* whose
  inline size can be asked about, and applies inline-size containment — the
  element's own width is no longer allowed to depend on its contents. That is
  the price of admission, and it is why the type is `inline-size` and not
  `size`: block-axis containment would also fix the height, and a product card
  must be free to grow as its name wraps.
- **`container-name: card`** labels it, so a query can name which ancestor it
  means. Naming is optional and you should do it anyway — see the nesting
  gotcha below.

Everything else `container-type` quietly switches on — the containing block for
positioned descendants, the stacking context, the `cqi` unit — is
[chunk 04](04-container-units-and-containment.md), and it is not optional
knowledge.

## Querying it

🔴 **The trap that catches everyone once: a container cannot query itself.**
`@container` rules resolve against the nearest *ancestor* container, so styles
inside the query must target the card's **descendants**, never `.product-card`.

```css
@layer components {
  /* the default: narrow. Stacked, and it is the layout that needs no query. */
  .product-card__media { aspect-ratio: 4 / 3; }
  .product-card__body  { display: grid; gap: var(--space-2); }
  .product-card__buy   { display: none; }

  /* enough room for the buy button */
  @container card (inline-size >= 15rem) {
    .product-card__buy { display: block; }
  }

  /* ⛔ WRONG — this rule can never match, at any width */
  @container card (inline-size >= 26rem) {
    .product-card { grid-template-columns: 8rem 1fr; }
  }
}
```

The last block is the mistake written out. The card is the container, so it
cannot be styled by its own query. The fix is to move the layout onto an inner
wrapper that *is* a descendant:

```css
@layer components {
  .product-card__inner { display: grid; gap: var(--space-3); }

  /* the drawer shape: thumbnail beside the text */
  @container card (inline-size >= 26rem) {
    .product-card__inner {
      grid-template-columns: 8rem 1fr;
      align-items: start;
    }
  }
}
```

The Phase 4 markup gains one wrapper element for this, which is a real cost and
the honest one to pay: **container queries buy you a component that is correct
everywhere, and charge you one div.**

## Breakpoints that belong to the component

The numbers above — 15 rem, 26 rem — are not screen sizes and were not chosen
by looking at devices. They are answers to *"at what width does this card's
content stop working?"*, which is a question about the card and stays true
forever. That is the durable difference from media queries: **a viewport
breakpoint encodes a guess about the world; a container breakpoint encodes a
fact about the component.**

The range syntax (`inline-size >= 15rem`) is the modern form;
`(min-width: 15rem)` inside `@container` means the same thing and reads worse.
Queries also combine with `and`, `or` and `not`, and can test
`block-size` — though a block-size query needs `container-type: size`, which
almost nothing text-bearing can afford.

## When the card needs no query at all

Before reaching for `@container`, check whether the layout is intrinsically
flexible. A card whose image is `aspect-ratio`-sized and whose text is a simple
column already adapts from 11 rem to 24 rem with no query — the only genuine
*changes* are the buy button appearing and the thumbnail moving beside the
text. Two queries, not five.

[CSS 6·02](../../../../css/pages/phase-6-container-queries/02-layouts-that-need-no-query.md)
is the argument in full, and it is the reason this chapter has two breakpoints
instead of a container-query version of the pile-up it replaced. A component
needing five container queries usually has an intrinsic-sizing problem
underneath that the queries are papering over.

## Gotchas

- **Symptom:** an `@container` rule targeting `.product-card` never applies, at
  any width. **Cause:** a container cannot query itself; the rule resolves
  against the nearest *ancestor* container, and the card is the container.
  **Fix:** style a descendant — add an inner wrapper if the markup does not
  already have one.

- **Symptom:** the query works on the catalog page and matches the wrong
  breakpoint inside the drawer. **Cause:** the drawer is *also* a container, and
  an unnamed `@container` query binds to the **nearest** container ancestor.
  **Fix:** name every container and always name it in the query —
  `@container card (…)`. This is why naming is not optional in practice.

- **Symptom:** the card's height collapses or its text is clipped.
  **Cause:** `container-type: size` was used instead of `inline-size`, which
  contains the block axis too and makes the height independent of the content.
  **Fix:** `inline-size` for anything whose height should follow its text —
  which is nearly everything.

- **Symptom:** a `display: contents` wrapper was used to avoid the extra div and
  the query stopped working. **Cause:** an element with `display: contents`
  generates no box, and a query container needs a box to have a size.
  **Fix:** the wrapper has to be a real box. This is the cost named above, and
  it cannot be optimised away.

- **Symptom:** styles inside `@container` lose to styles outside it that look
  less specific. **Cause:** `@container` adds no specificity of its own — the
  selector inside is weighed exactly as written, so a plain `.product-card__buy`
  inside a query does not beat a `.product-card .product-card__buy` outside it.
  **Fix:** keep both at the same specificity and let layer order and source
  order decide, which is what the `components` layer is for.

- **Symptom:** a `block-size` query never matches. **Cause:** querying the block
  axis requires `container-type: size`, and the container is declared
  `inline-size`. **Fix:** usually, do not query the block axis — a text-bearing
  element that fixes its own height is a clipping bug waiting for a long
  product name.

- **Symptom:** the design team asks for a breakpoint "at tablet" for this card.
  **Cause:** device thinking leaking into a component that no longer has a
  device. **Fix:** ask what *content* stops working and at what width — that
  number is the breakpoint, and it will still be right after the next device
  generation.

- **Symptom:** the card looks right in the grid and the rail but wrong in a
  context nobody tested. **Cause:** the breakpoints were derived from the three
  known placements rather than from the content. **Fix:** the content test —
  shrink the card continuously and note where it first looks wrong; that width
  is the query, and it holds in placements you have not invented yet.

## Interview questions

1. **★ What question does a container query answer that a media query cannot?**
   "How much inline space did my parent actually give me?" A media query only
   ever describes the viewport, so a component reused in a drawer, a sidebar or
   a modal gets an answer about a box it is not being laid out in. Container
   queries move the condition to the box that actually constrains the component.

2. **★ Why can a container not query itself?** Because the query has to be
   resolved *before* the matched rules are applied, and if a rule inside the
   query could change the container's own size, matching would depend on its own
   outcome. The spec cuts the loop by resolving `@container` against ancestor
   containers only — which is why the practical pattern is a container element
   plus an inner wrapper that carries the layout.

3. **★ Why `inline-size` rather than `size`?** `size` contains both axes, so the
   element's block size stops depending on its content — text that wraps to
   three lines gets clipped instead of growing the card. `inline-size` contains
   only the axis you are querying, leaving height free, which is what almost
   every text-bearing component needs.

4. **★ Why name containers?** Because an unnamed `@container` query binds to the
   *nearest* container ancestor, and the nearest one changes when the component
   is nested inside another container — the drawer, a dashboard panel. The
   breakpoints then resolve against the wrong box, silently, with no error and
   no visual clue on the page you were testing.

5. **How do you choose container breakpoints?** By asking at what width the
   component's *content* stops working — where the buy button no longer fits
   beside the price, where the name is forced to three lines. Those numbers are
   properties of the component and stay true; device widths are properties of
   the market and do not.

6. **Does `@container` affect specificity?** No. The at-rule is a condition, not
   a selector — the rule inside is weighed exactly as written. If a query's rule
   is losing, the cause is ordinary specificity or layer order, not the query.

7. **What is the markup cost of container queries, and can you avoid it?** One
   extra element in the common case, because the container and the thing you
   restyle cannot be the same element. You cannot avoid it with
   `display: contents` — an element that generates no box cannot be a query
   container. Treat the wrapper as part of the pattern rather than a smell.

8. **When would you *not* reach for a container query?** When the layout is
   already intrinsically flexible — an `aspect-ratio` image over a text column
   adapts across a wide range with no query at all. Container queries are for
   genuine *changes* of layout; a component needing five of them usually has an
   intrinsic-sizing problem the queries are hiding.

9. **Why is a container breakpoint more durable than a viewport one?** Because
   it is a statement about the component's own content, which changes only when
   the component's design changes. A viewport breakpoint is a statement about
   the relationship between the viewport and some assumed page layout, and it
   silently becomes false when the component is placed anywhere new.

---

← Prev [`auto-fill`, grid over flexbox, and the list reset](02-autofill-grid-and-the-list-reset.md) ·
Next → [Container units, and what containment does to you](04-container-units-and-containment.md)
