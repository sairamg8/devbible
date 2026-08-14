---
title: "Container queries"
sidebar_label: "01 · Container queries"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [CSS container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries)**
> and [`container-type`](https://developer.mozilla.org/en-US/docs/Web/CSS/container-type),
> and the **W3C CSS Containment Level 3** specification.
> Baseline: **Widely available since 2023-02-14** (`web-features` 3.34.3).

**A component should respond to the space it is given, not to the size of the
window.** That sentence is the whole argument. The viewport is a proxy for
available space that is wrong every time a component appears in a sidebar, a
modal, a split pane, or a grid cell.

## The mechanism

Two steps: declare a container, then query it.

```css
.card-wrapper {
  container-type: inline-size;
  container-name: card;
}

@container card (width > 30rem) {
  .card { display: grid; grid-template-columns: 8rem 1fr; gap: 1rem; }
}
```

The same `.card` is now a stacked block in a narrow sidebar and a
horizontal media object in a wide main region — **with no props, no wrapper
classes and no knowledge of where it was placed.**

The shorthand sets both at once:

```css
.card-wrapper { container: card / inline-size; }   /* name / type */
```

`container-name` is optional; an unnamed container is matched by any `@container`
query without a name, resolving to the **nearest** ancestor container. Naming is
worth the keystrokes as soon as containers nest.

## `inline-size` is almost always the right type

| Value | Queryable | Containment applied |
|---|---|---|
| `inline-size` | inline (width) | inline-size containment |
| `size` | both axes | size containment on **both** axes |
| `normal` *(initial)* | style queries only | none |

**`container-type: size` requires the element's block size to be independent of
its contents**, which for a normal block-level element means it collapses to zero
height unless you give it one. That is the trap: switching to `size` to query
height usually breaks the layout it was meant to help.

Use `inline-size` unless you genuinely need height queries and can give the
container a definite height.

## The query itself

Container queries use the same modern range syntax as media queries:

```css
@container card (width > 30rem) { … }
@container card (30rem <= width < 60rem) { … }
@container (width > 30rem) and (height > 20rem) { … }
```

The crucial difference from a media query is **what is being measured**: the
container's content box, not the viewport. Everything else about the syntax
transfers.

## The rule that catches everyone: a container cannot query itself

```css
.card {
  container-type: inline-size;
}

@container (width > 30rem) {
  .card { flex-direction: row; }    /* ⚠️ does NOT work */
}
```

Styles inside a `@container` rule apply to the container's **descendants**, never
to the container itself. If a container's own styles could change its size, the
query result could change, which would change the styles — an infinite loop the
specification avoids by forbidding it.

**This is why the wrapper element exists.** The pattern is always:

```html
<div class="card-wrapper">   <!-- the container -->
  <article class="card">…</article>   <!-- what the query styles -->
</div>
```

An extra element per component is the honest cost of container queries, and it is
the single most common reason a first attempt does nothing.

## Container query units

Inside a container query — and in fact anywhere inside a container — you can size
against the container rather than the viewport:

| Unit | 1% of the container's… |
|---|---|
| `cqw` | width |
| `cqh` | height |
| `cqi` | inline size |
| `cqb` | block size |
| `cqmin` / `cqmax` | smaller / larger of `cqi` and `cqb` |

```css
.card__title { font-size: clamp(1rem, 4cqi + 0.5rem, 1.75rem); }
```

Type that scales with the **component**, not the window. Combined with `clamp()`
from [Phase 3](../phase-3-custom-properties/02-clamp-min-max.md), this is the
piece that makes a genuinely self-contained component: it brings its own
responsive type scale with it.

The `rem` term still matters here for the same accessibility reason — `cqi` no
more responds to a user's font-size preference than `vw` does.

## Trade-off

**Container queries make components portable and make the DOM heavier and the
styles harder to trace.** Every queryable component needs a wrapper element it
would not otherwise have, and `container-type` applies containment, which changes
layout behaviour in ways unrelated to the query — `inline-size` containment makes
the element establish an independent formatting context.

Debugging is also less direct. A media query's condition is visible in the
browser's width; a container query's condition depends on an ancestor's computed
inline size, which depends on the layout above it. "Why is this component in its
narrow state" can require walking several levels up.

They remain the right default for **component** styling, and media queries remain
right for genuinely page-level decisions — page margins, the top-level shell,
print. The two are complementary, and a codebase that uses only one of them is
usually forcing something.

## Gotchas

**The query does nothing.**
*Symptom:* styles inside `@container` never apply.
*Cause:* the element being styled *is* the container. A container cannot query
itself.
*Fix:* add a wrapper, put `container-type` on it, style the child.

**The container collapses to zero height.**
*Symptom:* the layout breaks after adding `container-type`.
*Cause:* `container-type: size` applies containment on both axes, so the element
no longer sizes to its content.
*Fix:* `inline-size`, or give the container a definite height.

**The wrong container is matched.**
*Symptom:* a nested component responds to the outer container.
*Cause:* unnamed queries match the nearest ancestor container, which may not be
the intended one.
*Fix:* name the containers and query by name.

**`cqi` type does not respond to browser zoom.**
*Symptom:* text will not scale with user font settings.
*Cause:* container units are proportional to the container, like `vw` is to the
viewport.
*Fix:* include a `rem` term — `clamp(1rem, 4cqi + 0.5rem, 1.75rem)`.

**Nothing is queryable at all.**
*Symptom:* every `@container` rule is inert.
*Cause:* no ancestor declares `container-type`; the initial value is `normal`,
which is not queryable for size.
*Fix:* declare `container-type: inline-size` on the wrapper.

## Interview questions

**★ Why are container queries better than media queries for components?**
Because a component's available space is not the viewport. The same card may sit
in a 300px sidebar and a 900px main region on the identical screen; a media query
cannot distinguish them, so the component needs props or wrapper classes to know
where it is. A container query measures the space actually given to it.

**★ Why does a container query on the container itself not work?**
Because styles inside `@container` apply to descendants only. If a container's
own styles could change its size, the query result could flip, changing the
styles again — a circularity the spec forbids. Hence the wrapper element.

**★ What is the difference between `container-type: inline-size` and `size`?**
`inline-size` makes the width queryable and applies inline-size containment.
`size` makes both axes queryable but applies size containment on both, so the
element no longer sizes to its content and typically collapses to zero height
unless given an explicit one.

**What are container query units for?**
Sizing against the container rather than the viewport — `cqi` is 1% of the
container's inline size. They let a component carry its own type and spacing
scale, so it adapts wherever it is placed.

**Do container units solve the zoom problem that `vw` has?**
No. Like `vw`, they are proportional to a box, not to the user's font-size
preference. A `rem` term is still needed in the preferred value of a `clamp()`.

**When is a media query still the right tool?**
For genuinely page-level decisions — the top-level shell, page margins, print
styles, and user-preference queries such as `prefers-reduced-motion`.

---

Next: [02 · Layouts that need no query](./02-layouts-that-need-no-query.md) →
