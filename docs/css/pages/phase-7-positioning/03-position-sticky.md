---
title: "position: sticky"
sidebar_label: "03 · position: sticky"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [`position`](https://developer.mozilla.org/en-US/docs/Web/CSS/position)**
> and [Sticky positioning](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Sticky_positioning),
> and the **W3C CSS Positioned Layout Level 3** specification.

**Sticky fails silently, and there are exactly three reasons.** No error, no
warning — the element simply scrolls away as if the declaration were not there.
Knowing the three turns a frustrating debug into a ten-second check.

## What sticky actually is

A hybrid: the element is **relatively positioned** until its scroll container
reaches a threshold, then **fixed** relative to that container until its
containing block scrolls out of view.

```css
.toc { position: sticky; top: 1rem; }
```

Crucially, a sticky element **keeps its space in the flow**. Unlike `fixed`, it
does not remove itself, so nothing jumps when it becomes stuck — one of the main
reasons to prefer it over a JavaScript scroll handler.

## The three conditions

### 1. It needs a threshold

```css
.header { position: sticky; }           /* ⚠️ does nothing */
.header { position: sticky; top: 0; }   /* ✅ */
```

Without at least one of `top`, `right`, `bottom` or `left`, there is no threshold
to stick at, and the element behaves as `relative`. This is the most common
cause, and `top: 0` is not implied.

### 2. No ancestor may clip or scroll unexpectedly

If any ancestor between the sticky element and its scroll container has
`overflow` set to `hidden`, `scroll` or `auto`, **that ancestor becomes the
scroll container**. The element then sticks within it — which, if that ancestor
is only as tall as its content, means no scrolling happens and nothing sticks.

```css
.wrapper { overflow: hidden; }   /* ⚠️ silently breaks sticky inside it */
```

This is the hardest one to spot, because `overflow: hidden` is usually added for
an unrelated reason — clearing floats, clipping a decoration, hiding a
scrollbar — often in a base stylesheet far from the sticky element.

To check: walk up the ancestors and look at computed `overflow` on each. Any
non-`visible` value is a candidate.

### 3. The parent must be taller than the element

Sticky is bounded by its **containing block**. The element can only travel within
its parent, so if the parent is exactly as tall as the element, there is nowhere
to stick to and it scrolls away immediately:

```html
<div class="sidebar">        <!-- height: auto, same as the nav -->
  <nav class="toc">…</nav>   <!-- appears not to stick -->
</div>
```

Common in flex and grid layouts, where the parent is often stretched to the
content's height. The fix is usually to make the parent as tall as the layout
region:

```css
.sidebar { align-self: start; }   /* stops the flex/grid stretch */
```

**`align-self: start` is the single most useful sticky fix in modern layouts**,
because the default `stretch` makes the parent exactly the row's height, leaving
no travel. It is counter-intuitive: you make the container *shorter* and the
sticky element gains room to move.

## The table-header case

```css
thead th { position: sticky; top: 0; z-index: 1; }
```

Sticky works on `<th>` and `<td>`, and on `<thead>`/`<tr>` in modern browsers.
The `z-index` matters here — without it the body cells paint over the header as
it sticks.

## Stacking

`position: sticky` **always creates a stacking context**, regardless of
`z-index`. Two consequences from
[01 · Stacking contexts](./01-stacking-contexts.md): descendants cannot escape
it, and a sticky header may need an explicit `z-index` to sit above later
content, since document order alone would put subsequent elements on top.

## Multiple stuck elements

Several sticky elements with the same threshold stack up rather than overlapping,
each stopping at the previous one only if you offset them:

```css
.section__title { position: sticky; top: 3rem; }   /* below a 3rem header */
.page__header   { position: sticky; top: 0; }
```

There is no automatic stacking — the offsets are yours to compute. That is the
main friction with sticky section headers, and the reason a CSS-only "sticky
stack" needs hand-maintained values.

## Trade-off

**Sticky is the correct tool and its failure mode is the worst kind: silent.**
The three conditions are all *absences* — a missing threshold, an ancestor's
overflow, a parent with no spare height — none of which appear as an error, and
two of which are properties of elements other than the one you are looking at.
Time-to-diagnosis is high the first several times.

The alternative, a scroll listener toggling `position: fixed`, fails visibly and
predictably but reintroduces everything sticky was designed to avoid: layout
jump when the element leaves the flow, scroll-linked work on the main thread, and
manual threshold arithmetic.

Sticky is still the right default. The mitigation is a habit: when it does not
work, check the three conditions in order rather than experimenting with the
declaration itself, which is almost never at fault.

## Gotchas

**Sticky does nothing at all.**
*Symptom:* the element scrolls away normally.
*Cause:* no `top`/`right`/`bottom`/`left` threshold.
*Fix:* add one — `top: 0` is not implied.

**Sticky works in isolation but not in the page.**
*Symptom:* it works in a test file and fails in the app.
*Cause:* an ancestor has `overflow: hidden`, `auto` or `scroll`, becoming the
scroll container.
*Fix:* find and remove it, or move the sticky element outside it.

**Sticky in a flex or grid layout never sticks.**
*Symptom:* the sidebar nav scrolls away immediately.
*Cause:* the parent is stretched to exactly the element's height, so there is no
travel.
*Fix:* `align-self: start` on the parent.

**Content scrolls over the sticky header.**
*Symptom:* the header is under the body content.
*Cause:* later elements paint above it in document order.
*Fix:* an explicit `z-index` on the sticky element.

**A dropdown inside a sticky header is trapped.**
*Symptom:* the menu is clipped or layered wrongly.
*Cause:* sticky always creates a stacking context.
*Fix:* use the top layer — `popover` or `<dialog>`.

## Interview questions

**★ What are the three reasons `position: sticky` silently does nothing?**
No threshold (`top`/`right`/`bottom`/`left` is required); an ancestor with a
non-`visible` `overflow` becoming the scroll container; or a containing block no
taller than the element, leaving no room to travel.

**★ Why does sticky often fail in a flex or grid layout?**
Because the default `align-items: stretch` makes the parent exactly the height of
the row, so the sticky element has no space to move within its containing block.
`align-self: start` on the parent restores the travel.

**★ How does sticky differ from fixed?**
Sticky keeps its space in the normal flow and is positioned relative to its scroll
container, only becoming fixed after crossing a threshold and only within its
containing block. Fixed is removed from the flow entirely and positioned relative
to the viewport, so surrounding content reflows when it is applied.

**Does sticky create a stacking context?**
Yes, always, regardless of `z-index` — so descendants are confined to it and a
sticky header often needs an explicit `z-index` to stay above later content.

**How do you stack two sticky elements below each other?**
Offset their thresholds by hand — `top: 0` for the header, `top: 3rem` for the
section title. There is no automatic accumulation.

**Why prefer sticky over a scroll listener?**
No layout jump when the element becomes stuck, no scroll-linked work on the main
thread, and no manual threshold arithmetic. Its cost is that it fails silently
rather than visibly.

---

← [02 · z-index in practice](./02-z-index-in-practice.md) · Next: [04 · The clipped-dropdown problem](./04-the-clipped-dropdown-problem.md) →
