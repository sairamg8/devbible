---
title: "auto-fill, grid over flexbox, and the list reset"
sidebar_label: "02 · auto-fill, grid, list reset"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 — MDN *`grid-template-columns`* (`auto-fill` / `auto-fit`
> definitions), MDN *Basic concepts of flexbox* (line-by-line free-space
> distribution), MDN *`list-style`*, and WebKit's documented removal of list
> semantics for lists with no marker. Composes
> [CSS 5·01](../../../../css/pages/phase-5-grid/01-repeat-minmax-autofit.md),
> [5·06](../../../../css/pages/phase-5-grid/06-subgrid.md),
> [5·10](../../../../css/pages/phase-5-grid/10-grid-vs-flexbox-vs-flow.md) and
> [0·06](../../../../css/pages/phase-0-how-css-runs/06-user-agent-stylesheets.md).
> No sandbox, no console output.

[Chunk 01](01-the-track-sizing-decision.md) settled how wide a column is. Three
decisions ride along with it, and each one has a version that looks fine in the
mockup and fails on real data.

## `auto-fill` or `auto-fit` — this app wants `auto-fill`

The two keywords differ in exactly one situation: **when there are fewer items
than tracks that would fit.**

- `auto-fill` creates the tracks anyway and leaves the surplus ones empty. The
  items keep their natural size and the row ends early.
- `auto-fit` creates them and then **collapses the empty ones to zero**, so the
  `1fr` ceiling redistributes all of that space into the tracks that do have
  items.

On a 1600 px catalog that fits six columns, a filter matching two products
gives you:

| Keyword | Result |
|---|---|
| `auto-fill` | Two normal cards, left-aligned, four empty columns of space |
| `auto-fit` | **Two cards roughly 780 px wide each** |

The second is not a narrow-results layout, it is a bug that only appears when
someone filters aggressively. A product card is designed at a size; stretching
it to half the screen because the result set was small produces an image blown
past its intrinsic resolution and a name floating in emptiness.

**`auto-fill` is the right default for any list whose length is
data-dependent**, and a catalog — where the count is whatever the filter
returned — is the definitive case.

`auto-fit` earns its place where the item count is *fixed and small* and
filling the row is the design. This app has exactly one: the three-photo row on
the review upload form
([chapter 4·08](../../phase-4-react-ui/08-upload-with-progress.md)), where three
slots should always span the available width.

The cost of `auto-fill` is real and worth naming: on a wide screen a two-result
search leaves a lot of empty space to the right. That is a *content* problem —
the fix is a "no more results, try these instead" module, not a track keyword.

### The test that tells them apart

Neither keyword changes anything when the items outnumber the tracks, which is
why this bug survives review. **Filter the catalog down to one or two results
on the widest screen you have.** If the cards grow, the stylesheet says
`auto-fit`.

## Why grid and not a wrapping flexbox

Flexbox can approximate this:

```css
/* the flexbox approximation — and where it gives itself away */
.product-grid { display: flex; flex-wrap: wrap; gap: var(--space-5); }
.product-card { flex: 1 1 16rem; }
```

It survives most of the way and fails in one visible place: **flex items on the
last row do not line up with the tracks above them.** Flex distributes free
space within each line *independently*, so a final row holding two cards
stretches them to fill the width while the rows above show five. Grid's columns
are shared by every row, so the last row is aligned by construction.

The general comparison is
[CSS 5·10](../../../../css/pages/phase-5-grid/10-grid-vs-flexbox-vs-flow.md).
The specific reason it decides this component is that **a catalog's final row
is almost always partial** — with a page size of 24 and any column count that
is not a divisor of 24, the ragged row is on screen every single time. It is
not an edge case to be tolerated; it is the default state of the screen.

The rule of thumb that follows: **flexbox when the items should decide how to
distribute space, grid when you want a shared skeleton they all sit in.** A
toolbar is the first; a catalog is the second.

## The list reset is not cosmetic

`<ul>` arrives with a user-agent `padding-inline-start` of 40 px and a marker
box on each `<li>`. Inside a grid container that padding is subtracted from the
space the tracks get to share, which on a 320 px viewport is more than a tenth
of the screen spent on invisible indentation — often the difference between
fitting two columns and fitting one. Removing it is a layout fix, not a style
preference; the UA sheet's role is
[CSS 0·06](../../../../css/pages/phase-0-how-css-runs/06-user-agent-stylesheets.md).

⚠️ **Removing `list-style` costs list semantics in WebKit.** Safari drops the
`list` role from a list styled with `list-style: none`, so a screen reader stops
announcing "list, 24 items" — which on a catalog is genuinely useful
information, because it is the user's only cue that more results loaded. The
fix is one attribute in the Phase 4 markup:

```jsx
<ul className="product-grid" role="list">
```

Restating the implicit role is redundant in every engine except WebKit, and
harmless there. It belongs in the markup rather than the stylesheet because it
repairs *semantics*, and semantics are not something a stylesheet should be
trusted to carry.

## Equal heights, and the row that will not line up

Grid's default `align-items: stretch` makes every card in a row the height of
the tallest — which is the design, and it is free. What is *not* free is the
alignment of the card's **internals**: product names wrap to one, two or three
lines, so the price and the "Add to cart" button sit at different heights
across a row even though the cards match.

The parent grid aligns cards, not their contents, because each card is its own
formatting context. Two ways out:

```css
/* subgrid — the card's rows become the PARENT's rows */
.product-grid { grid-auto-rows: auto auto auto; }
.product-card { display: grid; grid-row: span 3; grid-template-rows: subgrid; }
```

```css
/* the fallback — a column flex card pushes its last row down */
.product-card       { display: flex; flex-direction: column; }
.product-card__buy  { margin-block-start: auto; }
```

They are not equivalent. `subgrid`
([CSS 5·06](../../../../css/pages/phase-5-grid/06-subgrid.md)) aligns **every**
row — name, price and action all line up across the whole row of cards. The
`margin-block-start: auto` fallback aligns only the last item, so the buttons
line up and the price rows still stagger. Choose subgrid; the fallback is what
you write when a supported-browsers matrix says you must.

The card's internal layout is [chunk 07](07-the-text-squeeze-and-clamping.md)
and [chunk 08](08-the-price-row-and-row-alignment.md).

## Gotchas

- **Symptom:** two search results render as two enormous cards; everything looks
  fine with a full page of products. **Cause:** `auto-fit` collapsed the empty
  tracks and `1fr` handed all their space to the survivors. **Fix:** `auto-fill`
  for any data-driven list — and test with a one-result filter, because a full
  grid cannot reveal this.

- **Symptom:** the last row of cards is stretched wider than the rows above it.
  **Cause:** the layout is a wrapping flexbox, whose lines distribute free space
  independently. **Fix:** grid, whose columns are shared by every row.

- **Symptom:** the grid is indented and the right column is clipped on mobile.
  **Cause:** the `<ul>` user-agent `padding-inline-start` was never removed.
  **Fix:** `padding: 0` on the grid container.

- **Symptom:** VoiceOver on Safari no longer announces the catalog as a list or
  reports how many items it has. **Cause:** `list-style: none` removed the
  implicit list role. **Fix:** `role="list"` on the `<ul>`.

- **Symptom:** cards in the same row have different heights and the design
  called for equal ones. **Cause:** `align-items: start` (or `center`) was set
  on the grid, overriding the default `stretch`. **Fix:** leave the default —
  equal-height rows are what grid gives you for nothing, and the card's
  internals are what should absorb the spare height.

- **Symptom:** cards are equal height but the "Add to cart" buttons sit at
  different heights across a row. **Cause:** the parent grid aligns cards, not
  their contents; each card lays out independently. **Fix:** `grid-template-rows:
  subgrid` on the card, spanning the parent's rows.

- **Symptom:** subgrid was added and nothing changed. **Cause:** `subgrid` needs
  the card to *span* parent tracks — `grid-template-rows: subgrid` with no
  `grid-row: span N` gives it a single row to inherit, which is a no-op.
  **Fix:** declare the span, and make sure the parent actually has that many row
  tracks.

- **Symptom:** the three-photo review row leaves a gap on the right when only
  two photos are attached. **Cause:** `auto-fill` was copied from the catalog
  into a fixed-count component. **Fix:** this is the one place `auto-fit` is
  correct — the slots are meant to fill the row.

- **Symptom:** a designer asks for the cards to be centred when there are only
  a few. **Cause:** `auto-fill` left-aligns by leaving real empty tracks, and
  `justify-content: center` on the grid centres the *whole track set* — which
  also shifts a full grid off its page alignment. **Fix:** decide which one the
  design actually wants; centring a partial row and left-aligning a full one is
  not something one declaration expresses, and usually the honest answer is to
  keep it left-aligned so the first card is always in the same place.

## Interview questions

1. **★ What is the difference between `auto-fill` and `auto-fit`, and which
   would you use for a product catalog?** They differ only when there are fewer
   items than fitting tracks: `auto-fill` keeps the empty tracks, `auto-fit`
   collapses them to zero so `1fr` redistributes their space into the remaining
   items. A catalog has a data-dependent item count, so `auto-fit` means a
   two-result filter renders two half-screen-wide cards. Use `auto-fill`, and
   reserve `auto-fit` for fixed small counts that are *meant* to fill the row.

2. **★ How would you catch an `auto-fit`/`auto-fill` mistake in review?** By
   filtering to one or two results on the widest available screen. The two
   keywords are indistinguishable whenever items outnumber tracks, which is
   every screenshot anyone takes of a healthy catalog — so the bug ships unless
   the test is specifically the empty-ish case.

3. **★ Why grid rather than a wrapping flexbox here?** Flex lines size
   independently, so the partial last row — which a catalog always has, since
   the page size is rarely divisible by the column count — stretches out of
   alignment with the rows above. Grid columns are shared by every row, so
   alignment is structural rather than something you fight for.

4. **When *is* a wrapping flexbox the better choice?** When the items should
   decide how to distribute the space rather than sit in a shared skeleton — a
   toolbar, a tag list, a row of chips of naturally different widths. The tell
   is whether alignment *across rows* matters; if it does not, flex's
   independent lines are a feature.

5. **How would you make the "Add to cart" button line up across cards whose
   names wrap to different numbers of lines?** Give the card
   `grid-template-rows: subgrid` and span it across the parent's rows, so the
   name, price and action rows are the *parent's* tracks and align across every
   card in the row. Without subgrid, the fallback is `margin-block-start: auto`
   on the action row of a column-flex card, which equalises the button's
   position but leaves the price rows staggered.

6. **The `<ul>` needs `list-style: none` for the design. What does that cost
   and how do you pay it back?** WebKit removes the implicit `list` role from a
   list with no markers, so screen readers stop announcing the item count.
   Adding `role="list"` back to the element restores it, and is a no-op in
   engines that never removed it. It goes in the markup, because it is a
   semantic repair rather than a style.

7. **Why is the list reset a layout fix rather than a cosmetic one?** The
   user-agent `padding-inline-start` on `<ul>` is 40 px, and it is subtracted
   from the width the grid tracks share before track sizing even runs. On a
   320 px viewport that is more than a tenth of the screen given to invisible
   indentation, which can be the difference between fitting two columns and
   fitting one.

8. **Why do cards in a grid row come out equal height without any code?**
   `align-items` defaults to `stretch`, so each item fills its row track, and
   the row track is sized to the tallest item. It is worth knowing because the
   common "fix" for a ragged card row — setting a fixed height — is undoing
   something the layout already did correctly.

9. **What does `justify-content: center` do to a grid with `auto-fill`, and why
   is it usually not what people want?** It centres the entire set of tracks
   within the container, which does centre a sparse result set — and also
   shifts a full grid inward so the first card no longer aligns with the page's
   other content. It cannot centre only the partial rows, because alignment
   applies to the track set as a whole.

---

← Prev [The track-sizing decision](01-the-track-sizing-decision.md) ·
Next → [The card adapts to its column](03-the-card-adapts-to-its-column.md)
