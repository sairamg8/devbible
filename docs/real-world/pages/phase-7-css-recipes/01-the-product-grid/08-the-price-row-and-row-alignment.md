---
title: "The price row and row alignment"
sidebar_label: "08 · Price row and row alignment"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 — MDN *`font-variant-numeric`*, MDN *`align-items`* and
> baseline alignment, MDN *`flex-wrap`*, and MDN *`grid-template-rows: subgrid`*.
> Composes
> [CSS 5·06](../../../../css/pages/phase-5-grid/06-subgrid.md),
> [CSS 4·05](../../../../css/pages/phase-4-flexbox/05-main-and-cross-axis.md) and
> [chapter 5·06](../../phase-5-js-functions/06-money-and-dates/README.md), which
> formats the number this row displays. No sandbox, no console output.

Two rows are left in the card: the price, and the action. Both look trivial and
both have a failure that only appears once the app has more than one locale or
more than one product.

## The price row

```css
@layer components {
  .product-card__price-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    flex-wrap: wrap;
    min-inline-size: 0;
  }

  .product-card__price {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .product-card__compare-at {
    font-variant-numeric: tabular-nums;
    text-decoration: line-through;
    color: var(--text-muted);
  }
}
```

- **`align-items: baseline`** so the discounted price and the struck-through
  original sit on the same text baseline despite being different sizes.
  `center` aligns their *boxes*, which puts the baselines a pixel or two apart —
  subtly wrong in a way that is hard to name and easy to see, especially next to
  a percentage badge.
- **`font-variant-numeric: tabular-nums`** gives every digit the same advance
  width, so prices line up in a column and do not shimmer when a value changes.
  In the catalog it stops `$9.99` and `$11.00` reading as ragged; on the cart
  and order screens, where prices genuinely stack, it is not optional.
- **`flex-wrap: wrap`** because a long currency string plus a compare-at price
  plus a badge does not always fit, and the honest failure is a second line
  rather than an overflow.
- **`min-inline-size: 0`** for the reason
  [chunk 07](07-the-text-squeeze-and-clamping.md) gives: without it this flex
  container will not shrink below its content and takes the card with it.

### What CSS must not assume about a price

The *content* of this row is not a CSS decision. Currency symbol position,
decimal separator, digit grouping and even digit shape come from
`Intl.NumberFormat` in
[chapter 5·06](../../phase-5-js-functions/06-money-and-dates/README.md).

The only thing the stylesheet must not do is **assume its width**. `1 234,56 €`
is materially wider than `$1,234.56`, and some locales use digits that are wider
still. Every fixed width, every `white-space: nowrap`, and every hard-coded
column in a price row is a bug waiting for a locale change — which is why the
rules above contain none of the three.

⚠️ **`tabular-nums` is not universal across typefaces.** It selects a font
feature, and a font that does not ship tabular figures silently keeps its
proportional ones. If alignment matters, it is a font-selection requirement, not
only a CSS declaration.

## The action row

```css
@layer components {
  .product-card__buy {
    inline-size: 100%;
    min-block-size: 2.75rem;      /* a comfortable touch target */
  }
}
```

`display: none` below 15 rem was already set by the container query in
[chunk 03](03-the-card-adapts-to-its-column.md) — the rail shows no buy button,
because there is no room for one that is still tappable. The minimum block size
is the reason: a control the user is meant to hit with a thumb needs a real
target, and shrinking the button to fit is the wrong trade. Hiding it and
letting the card itself be the link is the right one.

## Aligning rows across cards

Names wrap to one or two lines, so without help the price row and buy button sit
at different heights across a row of cards even though the cards themselves are
equal height. Grid gave us equal cards for free; it does not align their
insides, because each card is its own formatting context.

```css
@layer components {
  .product-card {
    display: grid;
    grid-row: span 3;
    grid-template-rows: subgrid;     /* media+name · price · action */
    row-gap: var(--space-2);
  }
}
```

Because the card's rows **are** the parent's rows, every card's price row shares
one track and every buy button shares another. The result is a grid that reads
as columns of information rather than a set of independently laid-out boxes.

**Subgrid and the line clamp need each other.** With names capped at two lines
([chunk 07](07-the-text-squeeze-and-clamping.md)), the name track has a
predictable maximum, so one pathological product cannot make every card in the
row tall. Without the clamp, subgrid faithfully shares a track sized to the
worst name on screen. Without subgrid, the rows are the right height and still
not aligned.

### The fallback, and what it does not do

```css
/* where subgrid is unavailable */
.product-card       { display: flex; flex-direction: column; }
.product-card__buy  { margin-block-start: auto; }
```

`margin-block-start: auto` absorbs the free space above the button, pushing it
to the bottom of the card. That aligns the **buttons** and nothing else — the
price rows above them still stagger, because each card distributes its own
slack independently. It is a genuine fallback rather than an equivalent, and
naming the difference is the point: choose subgrid, and reach for this only
when a support matrix forces it.

## Gotchas

- **Symptom:** prices look ragged down a column, and a live-updating total
  visibly shimmers as digits change. **Cause:** proportional figures, where `1`
  is narrower than `8`. **Fix:** `font-variant-numeric: tabular-nums` anywhere
  numbers are compared vertically or updated in place.

- **Symptom:** `tabular-nums` was added and nothing changed. **Cause:** the
  typeface does not ship tabular figures, so the feature request is ignored.
  **Fix:** this is a font choice; verify the family supports the feature before
  relying on the alignment.

- **Symptom:** the discounted price and the struck-through original look
  misaligned by a hair. **Cause:** `align-items: center` aligns boxes, and two
  font sizes have different box heights. **Fix:** `baseline`, which is what the
  eye actually reads against.

- **Symptom:** the price row overflows in one locale and is fine in others.
  **Cause:** something assumed a width — a fixed size, a `nowrap`, or a
  hard-coded column. **Fix:** let the row wrap; the formatted length is not
  knowable in advance and is not CSS's to predict.

- **Symptom:** buy buttons line up but price rows still stagger. **Cause:**
  `margin-block-start: auto` equalises only the last item in the column.
  **Fix:** subgrid, which shares every track rather than pushing one item down.

- **Symptom:** subgrid was added and nothing changed. **Cause:**
  `grid-template-rows: subgrid` without `grid-row: span N` gives the card a
  single row to inherit, which is a no-op. **Fix:** declare the span, and make
  sure the parent grid actually has that many row tracks.

- **Symptom:** subgrid was added and one long-named product made every card in
  the row tall. **Cause:** the name track sizes to the tallest name and nothing
  capped it. **Fix:** the line clamp — the two techniques are a pair, not
  alternatives.

- **Symptom:** the `row-gap` on the card and the `gap` on the grid produce
  uneven spacing. **Cause:** with subgrid, the card can either inherit the
  parent's gaps or set its own, and setting its own overrides them for the
  spanned tracks. **Fix:** decide deliberately which one owns the rhythm; having
  both specify different values is the actual bug.

- **Symptom:** the buy button is hard to hit on a phone. **Cause:** the button
  was allowed to shrink with the card. **Fix:** a minimum block size, and hide
  the button entirely where there is not room for a real target — a small
  button is worse than no button, because it invites a tap it will not reliably
  receive.

- **Symptom:** a sale badge overlaps the price on narrow cards. **Cause:** it
  was positioned absolutely rather than being a flex item in this row.
  **Fix:** put it in the flow and let `flex-wrap` handle the overflow; absolute
  positioning inside a card also collides with the containing-block behaviour
  from [chunk 04](04-container-units-and-containment.md).

## Interview questions

1. **★ What is `font-variant-numeric: tabular-nums` for, and when does it
   matter?** It selects fixed-width digit glyphs so numbers align vertically and
   do not change width as their value changes. It matters wherever prices stack
   — cart lines, order totals, an admin table — and wherever a number updates in
   place, because proportional figures make a live total visibly shimmer as it
   changes.

2. **★ Why `align-items: baseline` on the price row rather than `center`?**
   Because the two prices are different sizes, and centring aligns their boxes
   rather than their text. The baselines then sit slightly apart, which reads as
   "off" without being obviously identifiable. Baseline alignment matches how
   the text is actually read.

3. **★ What must CSS *not* assume about a formatted price?** Its width, symbol
   position, separators, or digit count — all of which come from
   `Intl.NumberFormat` and vary by locale. Any fixed width or `nowrap` in a
   price row is a latent bug that surfaces the first time the app ships a second
   locale.

4. **★ Why do subgrid and line-clamping need each other?** Subgrid shares row
   tracks across every card, so the tallest name defines the name track for the
   whole row — without a clamp, one pathological product makes every card tall.
   Clamping alone bounds the height but leaves each card laying out
   independently, so rows still do not align. Together they give bounded,
   aligned rows.

5. **What does the `margin-block-start: auto` fallback actually achieve, and
   what does it miss?** It absorbs the free space above the last item, so the
   buy buttons align at the bottom of every card. It misses everything else —
   the price rows above still stagger, because each card distributes its own
   slack. It is a fallback, not an equivalent, and describing it as one is how
   teams end up confused about why the design still looks uneven.

6. **Why does subgrid sometimes appear to do nothing?** Because
   `grid-template-rows: subgrid` only inherits the tracks the element actually
   spans. Without `grid-row: span N` the element spans one row, so there is one
   track to inherit and no visible effect. The parent also has to have those row
   tracks to share.

7. **Why hide the buy button on a very narrow card rather than shrink it?**
   Because a control below a usable touch target invites taps it will not
   reliably receive, which is worse than not offering it — the user tries,
   misses, and does not know why. The card as a whole remains a link to the
   product page, so nothing is lost but the shortcut.

8. **`tabular-nums` was added and the numbers still do not line up. What now?**
   Check the typeface. The property requests an OpenType feature, and a family
   that does not ship tabular figures silently keeps proportional ones. Digit
   alignment is a font-selection requirement as much as a CSS one.

9. **Why should a sale badge be a flex item rather than absolutely
   positioned?** Because in the flow it participates in wrapping, so a narrow
   card pushes it to a second line instead of overlapping the price. Absolute
   positioning also interacts badly with the card's containment — the card is
   already a containing block and a stacking context, so an escaping overlay is
   not going to escape.

---

← Prev [The text squeeze and clamping](07-the-text-squeeze-and-clamping.md) ·
Next → [The loading state and announcements](09-the-loading-state-and-announcements.md)
