---
title: "Stacking contexts"
sidebar_label: "01 · Stacking contexts"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [Stacking context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_context)**
> and the **W3C CSS Positioned Layout Level 3** specification and
> **CSS 2.1 Appendix E** (elaborate description of stacking contexts).

**A child can never escape its parent's stacking context.** Every `z-index: 9999`
that changed nothing is this rule, and the properties that create a context are
mostly ones nobody associates with stacking.

## What creates one

The list is longer than people expect, and that is the whole problem:

| Creates a stacking context | Condition |
|---|---|
| `position: relative`/`absolute` | with a `z-index` other than `auto` |
| `position: fixed` / `sticky` | **always** — no `z-index` needed |
| `opacity` | any value **less than 1** |
| `transform`, `scale`, `rotate`, `translate` | any value other than `none` |
| `filter`, `backdrop-filter` | any value other than `none` |
| `will-change` | naming any property that would create one |
| `isolation: isolate` | always — that is its only job |
| `contain: layout` / `paint` / `content` | always |
| `mix-blend-mode` | any value other than `normal` |
| flex/grid **children** | with a `z-index` other than `auto` |
| `container-type` | `size` or `inline-size` |

The dangerous entries are `opacity`, `transform` and `filter`. Nobody writes
`opacity: 0.99` intending to change stacking, but it does — and the last row means
**every container-query wrapper is also a stacking context**, which is new
territory since 2023.

## Why a child cannot escape

Stacking contexts nest, and each one paints as a single unit in its parent. So an
element's `z-index` is only ever compared with its **siblings inside the same
context**.

```html
<div class="a">          <!-- opacity: 0.9  → stacking context, z-index: 1 -->
  <div class="modal">    <!-- z-index: 9999 -->
</div>
<div class="b">          <!-- z-index: 2 -->
```

`.modal` is painted above everything inside `.a`, and `.a` as a whole is painted
below `.b`. **The 9999 is compared against nothing** — there are no siblings
inside `.a`. The modal appears beneath `.b` and no value can change that.

This is the answer to "my z-index isn't working": the element is inside a
stacking context that is itself losing.

## Diagnosing it

The reliable procedure, which takes about a minute:

1. Select the element that should be on top.
2. Walk **up** the ancestor chain, checking each one's computed styles for
   anything in the table above — especially `transform`, `opacity`, `filter`.
3. The first ancestor that creates a context is the boundary. Your element's
   `z-index` only competes inside it.
4. Compare **that ancestor's** stacking position against its own siblings. That
   is the comparison that actually decides the outcome.

DevTools helps: Chrome's Layers panel shows the tree, and Firefox marks elements
that create a stacking context in the inspector's badge list. But the manual walk
is quicker once you know the table.

## `isolation: isolate`

The one property whose *only* purpose is to create a stacking context:

```css
.card { isolation: isolate; }
```

Use it deliberately to **contain** z-index churn inside a component: whatever
values the component uses internally, they can never interfere with the page,
and the page's values cannot leak in. A component that sets `isolation: isolate`
on its root can use `z-index: 1` and `2` internally forever without coordination.

It is also the fix when you need a stacking context *without* the side effects of
`transform` or `opacity`.

## The `z-index: auto` distinction

`auto` and `0` are not equivalent, and the difference is exactly stacking-context
creation:

```css
.a { position: relative; z-index: auto; }  /* NOT a stacking context */
.a { position: relative; z-index: 0; }     /* IS a stacking context */
```

Both paint at the same level. But with `0`, descendants are trapped inside;
with `auto`, they participate in the parent context. Changing `auto` to `0`
"to be explicit" has broken working layouts.

## Painting order within a context

Inside a single stacking context, elements paint in this order (bottom to top):

1. the context root's background and borders
2. negative `z-index` descendants
3. in-flow, non-positioned block-level elements
4. floats
5. inline content
6. `z-index: auto` or `0` positioned elements
7. positive `z-index` descendants, in ascending order

Two useful consequences: a **negative** `z-index` puts an element behind its
parent's content but still in front of its background — the trick for decorative
backdrops. And positioned elements with no `z-index` still paint above in-flow
content, which is why a `position: relative` element covers its neighbours
without any `z-index` at all.

## Trade-off

**Stacking contexts are what make components composable, and they are invisible.**
Without them, every `z-index` in an application would compete in one global scale,
and integrating any third-party widget would be a negotiation. With them, a
component's internals are sealed — but the seal is created accidentally by
properties chosen for entirely different reasons, and there is no declaration
anywhere saying "a boundary exists here".

The practical response is to make the implicit explicit: put `isolation: isolate`
on component roots deliberately, so that the boundary is stated rather than
emerging from an `opacity: 0.98` somewhere. That costs one declaration and
removes most z-index debugging from a codebase.

The alternative — a global z-index scale in custom properties — manages the
symptom rather than the cause, and it breaks the moment a transform appears.

## Gotchas

**`z-index: 9999` does nothing.**
*Symptom:* the element stays behind another.
*Cause:* it is inside a stacking context that is itself painted lower.
*Fix:* find the ancestor creating the context and fix the comparison at that
level — or move the element out, typically to the top layer.

**Adding a transition broke the layering.**
*Symptom:* a dropdown started appearing behind its neighbour.
*Cause:* the transition animated `opacity` or `transform`, creating a stacking
context mid-animation.
*Fix:* `isolation: isolate` on the intended boundary, or restructure so the
overlay is not inside the animated element.

**`will-change` changed the stacking.**
*Symptom:* layering shifts when a performance hint is added.
*Cause:* `will-change: transform` creates a stacking context pre-emptively.
*Fix:* expected; remove it when not needed — it has a memory cost too.

**Changing `z-index: auto` to `0` broke things.**
*Symptom:* descendants stopped appearing above other content.
*Cause:* `0` creates a stacking context; `auto` does not.
*Fix:* revert to `auto` unless containment was intended.

**A container-query wrapper changed the layering.**
*Symptom:* new stacking behaviour after adopting container queries.
*Cause:* `container-type: inline-size` creates a stacking context.
*Fix:* account for the boundary; it is unavoidable if you want the query.

## Interview questions

**★ Why does `z-index: 9999` sometimes have no effect?**
Because `z-index` is only compared against siblings within the same stacking
context. If the element sits inside a context that is itself painted below
something else, no value can lift it out — the whole context paints as one unit.

**★ Name properties that create a stacking context without `position`.**
`opacity` below 1, any `transform`/`translate`/`scale`/`rotate`, `filter`,
`backdrop-filter`, `mix-blend-mode`, `will-change` naming such a property,
`isolation: isolate`, `contain: layout|paint|content`, `container-type`, and
`position: fixed`/`sticky` regardless of `z-index`.

**★ What is `isolation: isolate` for?**
Creating a stacking context deliberately, with no other side effects. Put it on a
component root and the component's internal `z-index` values can never interfere
with the page or be interfered with — the explicit version of a boundary that
usually appears by accident.

**What is the difference between `z-index: auto` and `z-index: 0`?**
They paint at the same level, but `0` creates a stacking context and `auto` does
not. With `0`, descendants are confined to it.

**How do you debug a z-index problem?**
Walk up the ancestor chain from the element checking for anything that creates a
stacking context. The first one found is the boundary; the real comparison is
between that ancestor and its siblings, not between your element and its target.

**What does a negative `z-index` do?**
Paints the element behind its parent's content but still in front of the parent's
background — the standard technique for decorative backdrops.

---

Next: [02 · z-index in practice](./02-z-index-in-practice.md) →
