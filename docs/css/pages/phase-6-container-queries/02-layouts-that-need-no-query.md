---
title: "Layouts that need no query"
sidebar_label: "02 · Layouts that need no query"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [`minmax()`](https://developer.mozilla.org/en-US/docs/Web/CSS/minmax)**,
> [`clamp()`](https://developer.mozilla.org/en-US/docs/Web/CSS/clamp) and
> [Intrinsic sizing](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_box_sizing/Understanding_intrinsic_sizing),
> and the **W3C CSS Grid Layout Level 1** and **CSS Values and Units Level 4**
> specifications.

**The modern position: reach for a breakpoint only when the *design* changes,
not when the size does.** Most responsive behaviour can be expressed as a
constraint the browser solves continuously — and a layout that adapts at every
width is correct at widths nobody tested.

## The three tools, and what each replaces

| Tool | Replaces |
|---|---|
| `repeat(auto-fit, minmax(…, 1fr))` | column-count breakpoints |
| `flex-wrap` + `flex: 1 1 <ideal>` | "stack on mobile" rules |
| `clamp()` / `min()` / `max()` | font-size and spacing breakpoints |

Between them they cover the large majority of what media queries were used for.

## 1. Columns without breakpoints

```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(18rem, 100%), 1fr));
  gap: 1rem;
}
```

Four columns, then three, then two, then one — continuously, as the container
narrows. Full treatment in
[Phase 5 · `repeat()`, `minmax()`, `auto-fit`](../phase-5-grid/01-repeat-minmax-autofit.md).

## 2. The sidebar that becomes a stack

A genuinely elegant one: a sidebar sits beside the main region while there is
room, and wraps below it when there is not — with no query.

```css
.with-sidebar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.with-sidebar > .sidebar {
  flex: 1 1 16rem;      /* ideal 16rem */
  max-inline-size: 20rem;
}

.with-sidebar > .main {
  flex: 999 1 60%;      /* huge grow factor: takes everything it can */
  min-inline-size: 0;
}
```

The mechanism is worth understanding rather than copying. `.main` has a basis of
60%; when the two items cannot both fit, the flex line wraps. The very large grow
factor on `.main` means that while they *do* fit, `.main` absorbs essentially all
the free space and the sidebar stays near its 16rem ideal.

The wrap threshold is effectively "when main would drop below 60%" — a real
layout decision expressed as a constraint rather than a pixel value.

## 3. Fluid type and spacing

```css
:root {
  --step-0: clamp(1rem, 0.9rem + 0.5vw, 1.25rem);
  --step-1: clamp(1.25rem, 1.1rem + 0.75vw, 1.75rem);
  --flow:   clamp(1rem, 0.8rem + 1vw, 2rem);
}

h2 { font-size: var(--step-1); }
section + section { margin-block-start: var(--flow); }
```

A type and spacing scale that moves continuously with the viewport, replacing the
usual two or three sets of font-size overrides. Each preferred value includes a
`rem` term so text remains zoomable
([Phase 3 · `clamp()`](../phase-3-custom-properties/02-clamp-min-max.md)).

Swap `vw` for `cqi` and the same scale responds to the **component** instead
([01 · Container queries](./01-container-queries.md)).

## 4. Intrinsic sizing keywords

Occasionally the cleanest answer is to ask for the content's own size:

```css
.tag   { inline-size: max-content; }        /* never wraps */
.panel { inline-size: fit-content; }        /* shrink-to-fit, capped by the parent */
.prose { inline-size: min(65ch, 100%); }    /* readable measure, never overflowing */
```

`fit-content` is the underused one: it behaves as `min(max-content, max(min-content,
available))` — shrink to the content, but never exceed the space available. That
is exactly the behaviour people write two rules and a media query to approximate.

## When a breakpoint is still correct

Intrinsic techniques express *"adapt to the space"*. They cannot express *"this is
a different design"*. Reach for a query when:

- the **navigation** changes form — a horizontal bar becoming a drawer,
- an element **appears or disappears** at a size,
- the **information hierarchy** changes — a table becoming a list of cards,
- the **page shell** rearranges, which named areas do in one query
  ([Phase 5 · Named areas](../phase-5-grid/04-named-areas.md)).

The test: *if the only thing changing is how big or how many, no query is needed.
If what is shown changes, use one.*

## Trade-off

**Constraint-based layouts are correct everywhere and specified nowhere.** A
design handed over as three artboards has three known-good states; a fluid
implementation has infinitely many, of which the three were never explicitly
checked. The result is usually better in the gaps and occasionally worse at the
exact widths the designer cared about, which is a genuinely awkward conversation.

They are also harder to review. A media query is a visible statement of intent —
"at 768px this becomes one column". `repeat(auto-fit, minmax(18rem, 1fr))`
encodes the same decision as arithmetic nobody can evaluate by eye.

The pragmatic position most teams land on: **fluid for the continuous properties
— columns, type, spacing — and a small number of breakpoints for genuine design
changes.** That is far fewer queries than the breakpoint-first approach, and it
keeps the ones that remain meaningful.

## Gotchas

**The card grid overflows on small screens.**
*Symptom:* horizontal scrolling on a phone.
*Cause:* `minmax(18rem, 1fr)` has a hard 18rem floor.
*Fix:* `minmax(min(18rem, 100%), 1fr)`.

**The sidebar pattern never wraps.**
*Symptom:* both columns just get narrower.
*Cause:* `flex-wrap` is missing, or `.main`'s basis is too small to force the
wrap.
*Fix:* `flex-wrap: wrap` and a percentage basis on the main region.

**Fluid type stops responding to browser zoom.**
*Symptom:* increasing the default font size changes nothing.
*Cause:* a preferred value made only of `vw` or `cqi`.
*Fix:* include a `rem` term.

**`fit-content` behaves like `max-content` and overflows.**
*Symptom:* the element exceeds its parent.
*Cause:* the parent has no definite size to cap against.
*Fix:* give the parent a size, or use `min(max-content, 100%)`.

**A layout is correct at every tested width and wrong between them.**
*Symptom:* an awkward state at an untested size.
*Cause:* the fluid range was never checked across its whole span.
*Fix:* resize continuously rather than testing at breakpoints — the failure mode
of fluid layouts is always in the gaps.

## Interview questions

**★ When should you use a breakpoint and when should you avoid one?**
Avoid it when only the size or count changes — columns, type scale, spacing — all
of which `auto-fit`, `flex-wrap` and `clamp()` express continuously. Use one when
the *design* changes: navigation becoming a drawer, elements appearing or
disappearing, a table becoming cards.

**★ How do you build a sidebar that wraps below the main content with no media
query?**
A wrapping flex container with `flex: 1 1 16rem` on the sidebar and a large grow
factor plus a percentage basis on the main region — `flex: 999 1 60%`. The line
wraps when the main region would fall below its basis, so the threshold is
expressed as a layout constraint rather than a pixel value.

**★ What is `fit-content` and why is it useful?**
Shrink-to-fit, capped by the available space — effectively `min(max-content,
max(min-content, available))`. It gives in one keyword the behaviour usually
approximated with a width plus a `max-width` plus a media query.

**How do you make a type scale that responds to the component rather than the
window?**
Use `cqi` instead of `vw` inside the `clamp()`, on an element within a container
that declares `container-type: inline-size`.

**What is the weakness of constraint-based layout?**
It is correct at every width and specified at none, so the states a designer
approved were never explicitly verified, and reviewing a fluid rule is harder
than reading a breakpoint. Failures appear in the untested gaps.

---

← [01 · Container queries](./01-container-queries.md) · Next: [03 · User-preference queries](./03-user-preference-queries.md) →
