---
title: "The text squeeze and clamping"
sidebar_label: "07 · The text squeeze and clamping"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 — MDN *`min-width`* and the automatic minimum size of flex
> and grid items, MDN *`overflow-wrap`*, *`word-break`*, *`hyphens`*,
> *`text-overflow`*, *`-webkit-line-clamp`* / *`line-clamp`* and *`text-wrap`*.
> Composes
> [CSS 4·02](../../../../css/pages/phase-4-flexbox/02-the-automatic-minimum-size/README.md)
> and [CSS 4·07](../../../../css/pages/phase-4-flexbox/07-flexbox-and-text-overflow.md).
> No sandbox, no console output.

The grid sized the column and the container query chose the card's shape. What
is left is the part that breaks on real data: **product names are not the length
the mockup used.** A catalog will contain a name with a 40-character SKU in it,
a German compound noun, and a URL somebody pasted into the description field.

## The squeeze, and `min-width: 0`

This is the bug to know before any of the styling. Both flex and grid items get
an **automatic minimum size**: they refuse to shrink below their content's
min-content width. A long unbroken string therefore pushes its container wider
than its share, and in a grid that means one card's name blows out the whole
row's track.

```css
@layer components {
  .product-card__inner,
  .product-card__body,
  .product-card__price-row {
    min-inline-size: 0;      /* let these actually shrink */
  }
}
```

`min-inline-size: 0` (or `min-width: 0` in a horizontal writing mode) opts out
of the automatic minimum and lets the item shrink to its container — at which
point overflow handling, wrapping, clamping and ellipsis finally get a chance to
run. **Without it, every text-overflow technique below silently does nothing**,
because the box is never smaller than its content in the first place.

It has to be applied at **every level** between the grid track and the text. One
un-zeroed ancestor in the chain restores the blowout, which is why this bug is
so often "fixed" and then reappears the next time somebody adds a wrapper.

[CSS 4·02](../../../../css/pages/phase-4-flexbox/02-the-automatic-minimum-size/README.md)
is the mechanism in full. The part usually left out of the folklore is that
**it applies to grid items too** — a `1fr` track is `minmax(auto, 1fr)`, and
that `auto` minimum is min-content — which is why the grid version of this bug
takes people longer to recognise than the flexbox one.

## The product name: clamp it, do not truncate it

```css
@layer components {
  .product-card__name {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;

    overflow-wrap: break-word;
    text-wrap: pretty;
  }
}
```

- **Two lines, then an ellipsis.** A product name is scannable information, so a
  single truncated line loses too much; three lines makes the cards tall enough
  that fewer fit on screen. Two is the usual answer, and it is a design decision
  the stylesheet should state once rather than rediscover per placement.
- **`-webkit-line-clamp` with `display: -webkit-box`** is the long-standing form
  and works across engines despite the prefix. The unprefixed `line-clamp` is
  the standardised property; **writing both is the correct move today** — the
  prefixed set for current engines, the standard one so the rule stops being
  legacy the moment support lands.
- **`overflow-wrap: break-word`** is the safety net for a string with no break
  opportunity. It breaks a word *only* when it would otherwise overflow, which
  is exactly what makes it the right default rather than a blunt instrument.
- **`text-wrap: pretty`** asks the engine to avoid leaving one word alone on the
  last line. It is a refinement — where unsupported the text wraps as it always
  did, so it needs no guard and no fallback.

⚠️ **Do not reach for `white-space: nowrap` + `text-overflow: ellipsis` here.**
That combination is single-line only, and on a card it reduces every name longer
than the column to the same useless prefix — "Stainless Steel Insulated…" for
nine different products. It is the right tool for a table cell or a breadcrumb,
not for the primary label of the thing being sold.

## `overflow-wrap` vs `word-break` vs `hyphens`

Three properties that look interchangeable and are not:

| Property | What it does | Use for |
|---|---|---|
| `overflow-wrap: break-word` | Breaks a word **only if** it would otherwise overflow | The default safety net |
| `word-break: break-all` | Breaks **any** word at any character, always | CJK text, and almost nothing else in a Latin catalog |
| `hyphens: auto` | Breaks at *linguistically valid* points and inserts a hyphen | Justified body copy, with `lang` set |

`word-break: break-all` is the one that gets copied in from a bug report and
left behind: it makes ordinary names break mid-syllable even when there was
plenty of room to wrap normally, and the damage is spread across every product
rather than concentrated in the one that caused the report.

`hyphens: auto` needs a correct `lang` attribute to know the language's rules.
Without one it does nothing — a silent no-op that reads as "hyphenation is
broken in this browser" and sends people looking in the wrong place.

## Gotchas

- **Symptom:** one product with a long SKU or URL in its name makes its column
  wider and squashes every other card in the row. **Cause:** the automatic
  minimum size — flex and grid items refuse to shrink below min-content.
  **Fix:** `min-inline-size: 0` at every level between the track and the text,
  plus `overflow-wrap: break-word` on the text itself. Either alone leaves the
  bug in place.

- **Symptom:** `min-width: 0` was added and the blowout came back after an
  unrelated change. **Cause:** a new wrapper element entered the chain with the
  default `auto` minimum. **Fix:** the zero has to hold all the way down; the
  question is "which boxes sit between the track and the text?", not "did I set
  it on the text's parent?".

- **Symptom:** `text-overflow: ellipsis` was added and nothing is ellipsised.
  **Cause:** it needs three conditions at once — a box smaller than its content,
  `overflow: hidden`, and single-line text. Any one missing and it no-ops.
  **Fix:** all three, and only where single-line text is genuinely wanted.

- **Symptom:** `-webkit-line-clamp` does nothing. **Cause:** the element is
  missing `display: -webkit-box` or `-webkit-box-orient: vertical`. In its
  prefixed form the clamp is not a standalone property — the declarations are a
  set. **Fix:** all of them together.

- **Symptom:** clamping works but no ellipsis appears at the cut.
  **Cause:** `overflow` is not `hidden`, so there is nothing to elide against.
  **Fix:** `overflow: hidden` on the clamped element.

- **Symptom:** ordinary product names break mid-word for no reason.
  **Cause:** `word-break: break-all` was copied in to fix an overflow somewhere
  else. **Fix:** `overflow-wrap: break-word`, which breaks only on demand.

- **Symptom:** `hyphens: auto` has no effect anywhere. **Cause:** no `lang`
  attribute, so the engine has no hyphenation dictionary to apply. **Fix:** set
  `lang` on the document; the property depends on it entirely.

- **Symptom:** the name is clamped to two lines but screen readers still read
  the whole thing. **Cause:** `overflow: hidden` clips what is painted and does
  not touch the accessibility tree. **Fix:** none needed — this is correct and
  desirable. The full name should reach assistive technology; only the visual
  space is constrained, and deliberately hiding the rest would be the bug.

- **Symptom:** a card in the narrow rail clamps to two lines and loses too much,
  while the same card in a wide column has room to spare. **Cause:** the clamp
  is a fixed count. **Fix:** vary it by container query — the line count is a
  property of the available width, and this is exactly the kind of genuine
  layout change container queries are for.

- **Symptom:** every card is the height of the tallest name even after
  clamping. **Cause:** the clamp bounds the *maximum* lines, not the minimum, so
  a row's track still sizes to the tallest card. **Fix:** that is grid working
  correctly; if a fixed name height is wanted, reserve it with `min-block-size`
  in the same rule rather than fighting the track.

## Interview questions

1. **★ A single product name blows out an entire grid row. Why, and what is the
   complete fix?** Flex and grid items have an automatic minimum size — they will
   not shrink below their content's min-content width — and an unbroken string
   has a large min-content width. The complete fix is `min-inline-size: 0` on
   **every** box between the grid track and the text, plus `overflow-wrap:
   break-word` so the string has a break opportunity at all. One without the
   other does not fix it.

2. **★ Why is `min-width: 0` needed on grid items and not just flex items?**
   Because the automatic minimum applies to grid items too: a `1fr` track is
   `minmax(auto, 1fr)` and that `auto` minimum resolves to min-content. The rule
   is usually taught as a flexbox quirk, which is precisely why the grid version
   of the same bug takes longer to recognise.

3. **★ Why does `text-overflow: ellipsis` so often do nothing?** It requires
   three conditions simultaneously — the box must be smaller than its content,
   `overflow` must be `hidden`, and the text must be single-line. Any one
   missing and it silently no-ops. On a card the single-line condition is
   usually the wrong thing to want in the first place.

4. **★ `overflow-wrap: break-word`, `word-break: break-all`, `hyphens: auto` —
   when does each apply?** `overflow-wrap` breaks a word only when it would
   otherwise overflow, making it the safe default. `word-break: break-all`
   breaks any word anywhere, appropriate for CJK text and not for a Latin
   catalog. `hyphens: auto` breaks at linguistically valid points and needs a
   `lang` attribute — without one it does nothing at all.

5. **Why clamp a product name to two lines rather than truncate it to one?**
   Because the name is the primary identifying information on the card, and one
   truncated line reduces many products to the same prefix. Two lines keeps
   enough to distinguish them while still bounding the card's height — and
   bounding the height is what makes cross-card row alignment stable.

6. **What does `-webkit-line-clamp` need to work, and why write `line-clamp`
   too?** It needs `display: -webkit-box` and `-webkit-box-orient: vertical`
   alongside it, plus `overflow: hidden` for the ellipsis — the prefixed form is
   a set of declarations, not one property. Writing the unprefixed `line-clamp`
   as well means the rule becomes standards-based automatically as support
   arrives, with no future migration.

7. **Is it a problem that a clamped name is still fully read by a screen
   reader?** No — it is the desired behaviour. `overflow: hidden` constrains
   painting, not the accessibility tree, so assistive technology gets the
   complete name while the visual grid stays uniform.

8. **How would you vary the clamp between a wide column and a narrow rail?**
   With a container query, because the right line count is a function of the
   space the component was given. It is a genuine layout change rather than a
   cosmetic tweak, which is the test for whether a query is warranted at all.

9. **Why is `text-wrap: pretty` safe to ship without a fallback?** Because it
   only refines where lines break; an engine that does not support it wraps
   exactly as it did before. It changes quality, not correctness, which is the
   definition of a progressive enhancement worth using unguarded.

---

← Prev [Image delivery: lazy loading, `srcset` and long grids](06-image-delivery-and-long-grids.md) ·
Next → [The price row and row alignment](08-the-price-row-and-row-alignment.md)
