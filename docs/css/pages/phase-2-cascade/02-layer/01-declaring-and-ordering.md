---
title: "Declaring layers and fixing their order"
sidebar_label: "01 · Declaring and ordering"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [`@layer`](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)**
> and the **W3C CSS Cascading and Inheritance Level 5** specification
> ([§6.4 Cascade Layers](https://www.w3.org/TR/css-cascade-5/#layering)).
> Baseline: **Widely available since 2022-03-14** (`web-features` 3.34.3).

**`@layer` lets you declare precedence once, up front, instead of encoding it in
every selector.** It is the criterion that sits directly above specificity in
the cascade, which means a rule in a later layer wins **regardless of how weak
its selector is**.

## The problem it replaces

Without layers, the only way to make rule A beat rule B is to make A's selector
heavier than B's. That is fine until B is a third-party stylesheet you do not
control, at which point the escalation begins: add a class, add a parent, add an
id, add `!important`. Every step is permanent, and every step makes the *next*
override harder.

Layers cut the link between "how precisely did I describe the element" and "who
wins". Precedence becomes a property of the architecture, declared once.

## Declaring the order up front

The single most important form is the **statement at-rule** — a `@layer` line
with names and no block:

```css
@layer reset, base, layout, components, utilities;
```

That line writes nothing. It establishes the order: `reset` is weakest,
`utilities` is strongest. **First declared is lowest priority; last declared is
highest.**

Put it at the very top of the entry stylesheet, before anything else. From then
on, rules can be added to any layer in any order and the precedence is already
fixed:

```css
@layer reset, base, layout, components, utilities;

@layer utilities {
  .mt-0 { margin-block-start: 0; }
}

@layer base {
  h1 { margin-block-start: 2rem; font-size: 2rem; }
}
```

`.mt-0` wins over `h1` even though `0,1,0` is barely heavier than `0,0,1`, and
even though it was written first. It is in a later layer, and layers are
compared before specificity ever is.

**Order is set by first appearance.** If you skip the statement form, layers are
ordered by the position of their first block — which means adding a new
`@layer components { … }` above an existing one silently reorders your
architecture. That is exactly the kind of action-at-a-distance the statement
form exists to prevent.

## Adding rules to a layer

Two forms, both common:

```css
/* Block form — the layer name, then a block of rules */
@layer components {
  .card { border: 1px solid; padding: 1rem; }
}

/* Import form — assign a whole stylesheet to a layer */
@import "vendor/bootstrap.css" layer(vendor);
```

The import form is the one that pays for itself. It takes a stylesheet whose
selectors you cannot change and drops the whole thing into a layer of your
choosing — see [02 · Precedence and `!important`](./02-precedence-and-important.md)
for the pattern in full.

`@import` has a placement rule that bites: it must come before every other rule
except `@charset` and a `@layer` **statement**. So the layer order line is
allowed above your imports, which is precisely where you want it:

```css
@layer reset, vendor, base, components, utilities;   /* legal above @import */
@import "vendor/bootstrap.css" layer(vendor);
```

## Nested layers and dot notation

Layers nest, and a nested layer's full name is written with a dot:

```css
@layer framework {
  @layer layout { /* … */ }
  @layer theme  { /* … */ }
}

/* Append to the nested layer later, from anywhere */
@layer framework.layout {
  .grid { display: grid; }
}
```

`framework.layout` and `framework.theme` are ordered **within** `framework`, and
the whole of `framework` is ordered against its siblings. A nested layer can
never escape its parent's position: if `framework` is the weakest top-level
layer, nothing inside it can beat a rule in a later top-level layer, whatever
the inner order says.

This is what makes layers safe to hand out. A library can publish
`@layer mylib.base, mylib.components;` and consumers can slot the entire
`mylib` layer wherever they like without knowing its internal structure.

## Anonymous layers

A block with no name creates an anonymous layer:

```css
@layer {
  p { margin-block: 1rem; }
}
```

It takes its position from where it appears, and **nothing can ever be added to
it** — there is no name to reference. That is occasionally the point (a
genuinely sealed block), but it is usually an accident. Prefer names.

## Where the rules end up: a worked example

```css
@layer base, components;

@layer base {
  a { color: navy; text-decoration: underline; }
}

@layer components {
  .nav a { color: inherit; text-decoration: none; }
}

/* No layer at all */
a.external { color: teal; }
```

| Rule | Layer | Specificity | Outcome for `<a class="external">` inside `.nav` |
|---|---|---|---|
| `a` | base | 0,0,1 | loses — earliest layer |
| `.nav a` | components | 0,1,1 | loses — layered, and unlayered beats layered |
| `a.external` | *none* | 0,1,1 | **wins** |

The unlayered rule wins with the *same* specificity as the one it beat, because
the comparison stopped at criterion 4. That behaviour is the single most
surprising thing about layers, and it has one clean explanation — the next page.

## Trade-off

**Layers move complexity from the selector to the architecture, and you have to
maintain the architecture.** A five-layer order is a design decision the whole
team now has to know; a new contributor who writes a rule outside any layer will
silently outrank all of it.

There is also a real migration cost. Introducing layers into an existing
stylesheet does not simplify anything until enough of it is layered — a
half-layered codebase has *more* precedence rules in play than an unlayered one,
because unlayered rules now float above everything you moved. Convert in whole
concerns (all of the reset, all of the vendor CSS), never rule by rule.

## Gotchas

**Adding a new layer block reorders the architecture.**
*Symptom:* a stylesheet starts behaving differently after a merge that only
added rules.
*Cause:* the layer order was implicit — set by first appearance — and the new
block appeared earlier in the file than an existing layer.
*Fix:* declare the full order in a `@layer a, b, c;` statement at the top of the
entry file. After that, block position is irrelevant.

**`@import … layer()` is silently ignored.**
*Symptom:* the vendor stylesheet is still winning.
*Cause:* the `@import` was not early enough. Only `@charset` and `@layer`
statements may precede it; a single stray rule above it invalidates it.
*Fix:* move every `@import` to the top, keeping only the layer statement above.

**A nested layer does not beat what you expected.**
*Symptom:* `framework.utilities` loses to a rule in `components`.
*Cause:* nesting orders layers *within* the parent only. The parent's position
caps everything inside it.
*Fix:* if the utilities must win globally, they belong in a top-level layer, not
inside `framework`.

**An anonymous layer cannot be extended.**
*Symptom:* a later `@layer { … }` does not add to the earlier one — it creates a
second layer with different precedence.
*Fix:* name it. Anonymous layers are only appropriate for a block you are
certain nothing will ever append to.

## Interview questions

**★ What problem does `@layer` solve that specificity cannot?**
It separates precedence from selector weight. Without layers the only way to
outrank a rule is a heavier selector, which escalates permanently and fails
entirely when you do not control the other stylesheet. Layers let you state the
order once, so a one-class rule in a later layer beats an id in an earlier one.

**★ What does `@layer a, b, c;` with no block do, and why write it?**
It declares the three layers and fixes their order without adding any rules —
`a` weakest, `c` strongest. It is written at the top of the entry file so that
layer order is explicit and cannot be changed by where someone later puts a
block.

**How are layers ordered if you never write the statement form?**
By first appearance. The layer whose first block appears earliest is weakest,
which makes the order an emergent property of file order — fragile, and the
reason the statement form exists.

**Can a nested layer outrank a rule in a different top-level layer?**
No. Nesting orders layers only within their parent. The parent's own position
bounds everything inside it.

**How do you put a third-party stylesheet under your control?**
`@import "vendor.css" layer(vendor);` with `vendor` declared early in the order.
The whole stylesheet is then beaten by any later layer regardless of the
selectors it uses.

---

Next: [02 · Precedence and `!important`](./02-precedence-and-important.md) →
