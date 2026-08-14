---
title: "Grid patterns that carry real applications"
sidebar_label: "07 · Grid patterns"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **W3C CSS Grid Layout Level 1/2**
> specifications and **MDN — [Realizing common layouts using grids](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Realizing_common_layouts_using_grids)**.

**Five layouts that cover most of what an application needs.** Each is short, and
each depends on a mechanism from topics 01–06.

## 1. The page shell

```css
.app {
  display: grid;
  grid-template-areas:
    "header  header"
    "sidebar main"
    "footer  footer";
  grid-template-columns: minmax(200px, 240px) minmax(0, 1fr);
  grid-template-rows: auto 1fr auto;
  min-block-size: 100dvh;
}
```

Three details doing real work:

- **`minmax(0, 1fr)` on the main column** — without it, a wide table or a long
  URL in the main region pushes the sidebar off-screen
  ([03](./03-the-minmax-zero-fix.md)).
- **`1fr` on the middle row** — this is what pins the footer to the bottom on
  short pages, the grid equivalent of the flexbox sticky footer.
- **`minmax(200px, 240px)` on the sidebar** — it gives way a little before the
  main region does.

Rearranging for mobile is one media query and no item rules
([04 · Named areas](./04-named-areas.md)).

## 2. The full-bleed content grid

The layout behind most article pages: a readable centre column, with individual
elements able to break out to the full width.

```css
.article {
  display: grid;
  grid-template-columns:
    [full-start] minmax(1rem, 1fr)
    [content-start] min(65ch, 100% - 2rem)
    [content-end] minmax(1rem, 1fr)
    [full-end];
}

.article > *      { grid-column: content; }
.article > figure { grid-column: full; }
```

Every child lands in the readable column by default; figures and hero images opt
out with one declaration. The `min(65ch, 100% - 2rem)` keeps the measure readable
and guarantees the gutters survive on narrow screens.

This is the pattern that replaces the old `.container` + negative-margin
break-out hack entirely.

## 3. The responsive card grid

```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(18rem, 100%), 1fr));
  gap: 1rem;
}
```

Covered in full in [01](./01-repeat-minmax-autofit.md). Add subgrid when the
cards' internals must align across the row ([06](./06-subgrid.md)).

## 4. The overlay / stack

Everything in one cell, no absolute positioning:

```css
.stack { display: grid; }
.stack > * { grid-area: 1 / 1; }
```

The container still sizes to its largest child — which absolute positioning
cannot do, since absolutely positioned elements are out of flow. This makes it
the right tool for a hero with text over an image, a card with a badge, or a
loading state layered over content:

```css
.hero { display: grid; place-items: center; }
.hero > * { grid-area: 1 / 1; }
.hero__caption { z-index: 1; }
```

`place-items: center` centres every child in the cell — the shortest complete
centring in CSS, and it works for any number of stacked children.

## 5. The holy-grail dashboard region

A widget area where items claim different spans:

```css
.dash {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 1rem;
}

.widget       { grid-column: span 4; }
.widget--wide { grid-column: span 8; }
.widget--full { grid-column: 1 / -1; }
```

A twelve-column system in four lines. `minmax(0, 1fr)` on the tracks is
load-bearing again — dashboard widgets contain charts and tables, exactly the
content that blows out a bare `1fr`.

`span` rather than explicit lines means widgets can be reordered or added without
touching any other rule ([05](./05-line-based-placement.md)).

## Choosing between them

| Need | Pattern |
|---|---|
| named regions, known design | page shell with `grid-template-areas` |
| readable prose with break-outs | full-bleed named-line grid |
| *n* items, count does not matter | `repeat(auto-fit, minmax(…))` |
| things layered on each other | single-cell stack |
| variable spans on a fixed rhythm | 12-column with `span` |

## Trade-off

**Grid patterns are compact because they push complexity into the track
definition, where it is easy to get subtly wrong and hard to see.** A page shell
is six lines, and one missing `minmax(0, …)` makes it fail only when a user
pastes a long URL. The failure is not in the rule you would look at.

The compactness also makes these patterns tempting beyond their range. A
twelve-column grid invites expressing every layout as spans, which reproduces the
worst of Bootstrap-era markup in CSS instead of HTML. Named areas invite growing
until the ASCII art no longer aligns.

Both have the same discipline: **the pattern should stay small enough to read at
a glance.** When a template no longer fits that, the layout wants splitting into
nested grids, each simple, rather than one clever one.

## Gotchas

**The sidebar gets pushed off-screen.**
*Symptom:* the main region overflows the shell.
*Cause:* the main column is a bare `1fr`, so its content minimum expands it.
*Fix:* `minmax(0, 1fr)`.

**The footer floats in the middle of the page.**
*Symptom:* a gap below the footer on short pages.
*Cause:* no row is set to `1fr`, so there is nothing to absorb the spare height.
*Fix:* `grid-template-rows: auto 1fr auto`.

**Full-bleed elements are not full width.**
*Symptom:* `grid-column: full` does nothing.
*Cause:* the lines are not named `full-start` and `full-end`, so the one-word
shorthand does not resolve.
*Fix:* name both halves exactly.

**Stacked items collapse the container.**
*Symptom:* the parent has no height.
*Cause:* absolute positioning was used instead of the single-cell grid — out-of-flow
children do not size the parent.
*Fix:* `grid-area: 1 / 1` on the children.

**Dashboard widgets overflow their spans.**
*Symptom:* a chart or table breaks the 12-column rhythm.
*Cause:* bare `1fr` tracks with wide content.
*Fix:* `repeat(12, minmax(0, 1fr))`.

## Interview questions

**★ Build an application shell with a sticky footer and a fixed sidebar.**
A grid with `grid-template-areas` for header/sidebar/main/footer,
`grid-template-columns: minmax(200px, 240px) minmax(0, 1fr)`,
`grid-template-rows: auto 1fr auto` and `min-block-size: 100dvh`. The `1fr` row
absorbs spare height so the footer sits at the bottom; the `minmax(0, 1fr)` column
stops wide content pushing the sidebar out.

**★ How do you build a full-bleed content grid?**
Name the lines `full-start`, `content-start`, `content-end`, `full-end` with
`min(65ch, 100% - 2rem)` as the centre track. Children default to
`grid-column: content`; figures opt out with `grid-column: full`. It replaces the
container-plus-negative-margin hack.

**★ Why is a single-cell grid better than absolute positioning for an overlay?**
Because the container still sizes to its largest child. Absolutely positioned
elements are out of flow, so the parent collapses and needs an explicit size.
`display: grid` with `grid-area: 1 / 1` on every child keeps everything in flow.

**Which patterns need `minmax(0, 1fr)` rather than `1fr`?**
Any track holding content of unknown width — the main region of a shell,
dashboard widgets containing charts or tables. A bare `1fr` carries a content
minimum that will expand the track.

**Why use `span` in a twelve-column system rather than explicit lines?**
Because `span` does not encode the template's structure, so widgets can be
reordered or added without touching other rules.

**When should a grid be split into nested grids?**
When the template no longer reads at a glance — a wall of area names or a long
track list. Several simple grids are easier to maintain than one clever one.

---

← [06 · Subgrid](./06-subgrid.md) · Next: [08 · Alignment in grid](./08-alignment-in-grid.md) →
