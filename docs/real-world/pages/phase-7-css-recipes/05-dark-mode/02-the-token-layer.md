---
title: "The token layer this storefront actually needs"
sidebar_label: "02 · The token layer"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **WCAG 2.2** success criteria 1.4.3 (Contrast
> Minimum), 1.4.6 (Contrast Enhanced) and 1.4.11 (Non-text Contrast), and MDN's
> [`color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)
> reference.
> Concept homes: the **three-tier token argument** and semantic naming are
> [CSS 8·03](../../../../css/pages/phase-8-color-theming/03-dark-mode-properly.md);
> **perceptual lightness** is
> [CSS 8·01](../../../../css/pages/phase-8-color-theming/01-oklch-and-perceptual-colour.md);
> **custom properties as a component API** is
> [CSS 3·01](../../../../css/pages/phase-3-custom-properties/01-custom-properties-as-a-component-api.md).
> No sandbox, no measured timings.

**A generic surface/text/border palette themes a blog. It does not theme a
storefront, because a storefront's colours carry meaning the palette has no
name for** — this product is out of stock, this order was refunded, this price
is a discount, this admin action deletes rows. Those are not decoration; they
are state the user reads colour to learn, and every one of them needs a
semantic token, a dark value chosen independently rather than derived, and a
contrast obligation that does not relax in either theme.

## The three tiers, and where this app's work actually is

| Tier | Example | Themed? | Who writes it |
|---|---|---|---|
| **Primitives** | `--blue-600: #2563eb` | never | the palette, once |
| **Semantic roles** | `--accent`, `--danger`, `--stock-out` | **yes — this is the theme** | this chapter |
| **Component tokens** | `--card-bg: var(--surface-raised)` | no — they reference roles | each component |

Chapter [01](01-three-states-not-two.md) established that the three theme blocks
redefine *roles only*. That leaves a single question this chapter answers:
**which roles does this storefront have?**

The tier boundary is enforceable, and worth enforcing: **a component rule that
names a primitive is a bug.** `background: var(--blue-600)` compiles, renders,
and is invisible until the day someone themes it. Grep for primitive names
outside the token file in review.

## The roles a generic palette gives you

```css
:root {
  --surface: …;        /* the page canvas */
  --surface-raised: …; /* cards, the sticky header, menu sheets */
  --surface-sunken: …; /* the skeleton base, input wells, table zebra */
  --text: …;
  --text-muted: …;     /* secondary copy, timestamps, the "12 reviews" line */
  --border: …;
  --border-strong: …;  /* focused inputs, the table header rule */
  --accent: …;         /* links, the primary button, the focus ring */
  --accent-contrast: …;/* text ON accent — not the same as --surface */
}
```

`--accent-contrast` is the first one people skip. White text on the light
accent may be fine while white text on the *dark* accent — which is lighter,
because dark themes lift accent lightness to stay visible — fails 4.5:1. It is
a role, it is themed, and it flips from near-white to near-black between themes
in most palettes.

`--surface-sunken` is the second. In light mode it is *darker* than `--surface`;
in dark mode a sunken well that is darker than an already near-black canvas
disappears, so **in dark mode it is usually lighter than `--surface`**. The
role name describes the intent — recessed — not the direction, and the two
themes implement that intent in opposite directions. Naming it `--grey-50`
would have hidden that entirely.

## The roles this storefront adds

These come straight out of the spec in
[chapter 0·01](../../phase-0-the-app/01-the-storefront-spec.md) and the eleven
tables in [0·02](../../phase-0-the-app/02-architecture-and-data-model.md).

```css
:root {
  /* Stock — read at a glance on the product grid and the PDP */
  --stock-in:        …;  /* "In stock"                      */
  --stock-low:       …;  /* "Only 3 left" — the urgency cue */
  --stock-out:       …;  /* "Out of stock"                  */

  /* Order status — one per state in the machine, and they must be
     distinguishable from each other, not merely from the background */
  --status-pending:   …;
  --status-paid:      …;
  --status-shipped:   …;
  --status-delivered: …;
  --status-cancelled: …;
  --status-refunded:  …;

  /* Money */
  --price:           …;  /* the current price                       */
  --price-was:       …;  /* the struck-through original             */
  --price-discount:  …;  /* the "-20%" flag                         */

  /* Reviews */
  --rating-filled:   …;
  --rating-empty:    …;  /* NOT --border: it must read as "unfilled
                            star", and at 3:1 against the filled one */

  /* Admin — destructive actions on the dashboard */
  --danger:          …;
  --danger-contrast: …;
  --danger-quiet:    …;  /* the row-highlight behind a pending delete */

  /* The admin charts: a categorical series that has to survive both themes */
  --series-1: …;  --series-2: …;  --series-3: …;
  --series-4: …;  --series-5: …;  --series-6: …;
}
```

**Three of these are the ones that bite.**

**Order status is a set that must be internally distinguishable.** Six badges
each passing contrast against `--surface` can still be three pairs nobody can
tell apart. Dark themes make this worse: the usual fix for a dark background is
to raise lightness, and six hues all raised to the same lightness converge.
Vary lightness *and* chroma across the set, not hue alone. The set is also the
one place a colour-blind check is not optional — pending/shipped and
cancelled/refunded are the pairs that collapse under deuteranopia, and the
badge carries a text label for exactly that reason.

**The chart series must not be re-derived per theme by inverting.** Inverting a
categorical palette reorders it perceptually — series 1 and 4 swap apparent
prominence — and a dashboard whose legend order stops matching its visual weight
between themes is worse than one that just looks slightly wrong. Author the dark
series as its own ordered set, matched for *relative* prominence rather than
for hue.

**`--price-was` is not `--text-muted`.** It is struck-through text that must
still be legible enough to compare against the current price — that is the whole
point of showing it — while reading as subordinate. Muted text tuned for
timestamps is usually too faint, and in dark mode the strike-through line
itself, drawn in `currentColor`, drops below 3:1 first.

## Contrast is a per-theme obligation, and the dark theme is not the easy one

WCAG 2.2 sets **4.5:1** for normal text (SC 1.4.3), **3:1** for large text
(from 18.66px bold or 24px), and **3:1** for non-text UI components and their
states (SC 1.4.11). That last one is what this app trips over: `--border` on an
input, the unfilled star, the disabled button and the chart gridlines all fall
under 1.4.11, and all get quietly lightened in dark themes to "look softer".

Every token pair is checked in **both** themes. A palette that passes in light
and fails in dark is not a palette that passes.

The specific dark-mode trap: **large areas of saturated colour vibrate against
dark backgrounds**, so the instinct is to desaturate — and desaturating
`--stock-low` until it is comfortable is exactly how the urgency cue stops being
one. **Reduce chroma on surfaces, never on state indicators.** If a state colour
is genuinely uncomfortable at full chroma, shrink the area it fills (a dot and a
label rather than a filled pill), which lowers the discomfort without lowering
the signal.

Pure `#000` is not the dark surface, for the same family of reasons: maximum
contrast against white text produces halation, and it leaves no room below
`--surface` for a sunken role. The near-black canvas in chapter 01 is chosen so
that both directions remain available.

## Gotchas

### The accent looks fine in light and washes out in dark
**Symptom.** Links and the primary button recede into the dark canvas.
**Cause.** One `--accent` value reused across themes. A hue with enough contrast
against white rarely has enough against near-black.
**Fix.** `--accent` is a themed role like any other — the dark theme lifts its
lightness. Then re-check `--accent-contrast`, because lifting the accent is what
breaks white-on-accent.

### Six status badges, three of which look identical in dark mode
**Symptom.** Shipped and delivered are indistinguishable on the orders table.
**Cause.** All six lightened to the same level to clear the dark background.
**Fix.** Vary lightness and chroma across the set, and check the badges against
*each other*, not only against the surface. Keep the text label; colour is the
secondary channel, never the only one.

### The unfilled star uses `--border`
**Symptom.** Ratings are unreadable in dark mode; a 2-star and a 4-star item
look the same at a glance.
**Cause.** `--border` is tuned for 3:1 against `--surface`, not for
distinguishability against `--rating-filled`.
**Fix.** `--rating-empty` is its own role, held at 3:1 against the filled star.

### `--surface-sunken` vanishes in dark mode
**Symptom.** Input wells and the skeleton base are invisible against the canvas.
**Cause.** The role was implemented as "darker than surface" rather than as
"recessed", so in dark mode it went darker than a near-black page.
**Fix.** The dark theme makes it *lighter*. Role names describe intent; the two
themes are free to reach that intent in opposite directions.

### A new token themed in dark only
**Symptom.** A colour renders as the property's guaranteed-invalid value —
usually inherited text colour — in light mode.
**Cause.** Added to the dark blocks, missed on bare `:root`.
**Fix.** Bare `:root` is the schema (chapter 01). The three blocks carry
identical property lists, and because they are generated
([chunk 02b](02b-deriving-and-deduplicating.md)) the generator enforces it.

### A component rule names a primitive
**Symptom.** One card stays blue in dark mode while every other card themes.
**Cause.** `var(--blue-600)` in a component rule — tier one leaking into tier
three.
**Fix.** Components reference roles only. It is greppable: primitive names must
not appear outside the token file.

### Product images stop matching the surface
**Symptom.** Catalogue photos sit on visible white rectangles in dark mode.
**Cause.** Not a token problem — it is a media problem, and it is
[chunk 04](04-images-media-and-controls.md).

## Interview questions

**Why is `--accent-contrast` a separate token instead of just using `--surface`?**
Because it is text on the accent, not text on the canvas. Dark themes lift
accent lightness, which can flip the required foreground from near-white to
near-black — a change `--surface` does not track.

**Why can a role be lighter than `--surface` in one theme and darker in the
other?**
Because the role names an intent, not a direction. `--surface-sunken` means
recessed; against white that is darker, against near-black it is lighter. This
is the argument for semantic naming stated as a concrete consequence.

**Six status badges all pass contrast against the background. What is still
wrong?**
Nothing has checked them against *each other*. A status set has to be internally
distinguishable, and the usual dark-mode fix — raising every hue to the same
lightness — is what makes them converge.

**Which WCAG criterion covers the input border and the disabled button?**
1.4.11 Non-text Contrast, at 3:1 — and it applies in both themes, which is where
"soften the borders for dark mode" goes wrong.

**Why not invert the chart palette for dark mode?**
Inverting reorders the series perceptually, so the legend order stops matching
visual prominence. Author the dark set independently, matched for relative
prominence rather than hue.

**Why is the dark canvas not `#000`?**
Maximum contrast against white text causes halation, and pure black leaves
nothing below it for a recessed surface role.

**How do you stop a state colour vibrating on a dark background without
destroying the signal?**
Shrink the area rather than the chroma — a dot plus a label instead of a filled
pill. Chroma reduction belongs on surfaces, not on indicators.

---

← Prev: [Three states](01-three-states-not-two.md) · Index: [Dark mode](README.md) · Next → [Deriving and deduplicating](02b-deriving-and-deduplicating.md)
