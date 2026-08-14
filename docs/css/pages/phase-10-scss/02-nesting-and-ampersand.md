---
title: "Nesting and &"
sidebar_label: "02 · Nesting and &"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **Sass documentation** —
> [Style rules](https://sass-lang.com/documentation/style-rules/) and
> [Parent selector](https://sass-lang.com/documentation/style-rules/parent-selector/) —
> and **MDN — [CSS nesting](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting)**.

**Nesting is native CSS now — but `&__element` string concatenation is not, and
that single difference is why a BEM codebase cannot simply drop the
preprocessor.**

## How nesting compiles

```scss
.card {
  padding: 1rem;

  .card__title { font-weight: 600; }

  &:hover { background: #f5f5f5; }
}
```

```css
.card { padding: 1rem; }
.card .card__title { font-weight: 600; }   /* descendant — note the space */
.card:hover { background: #f5f5f5; }
```

**Nesting without `&` produces a descendant selector.** `&` is what attaches the
nested selector directly to the parent, with no space. Getting this backwards is
the most common nesting mistake:

```scss
.card {
  .active { }     // → .card .active   (a descendant)
  &.active { }    // → .card.active    (the same element)
}
```

## `&` is a literal string substitution

This is the mechanism that makes BEM work, and the part native CSS cannot do:

```scss
.card {
  &__title  { font-weight: 600; }
  &__body   { color: #555; }
  &--raised { box-shadow: 0 2px 8px rgb(0 0 0 / 0.1); }
}
```

```css
.card__title  { font-weight: 600; }
.card__body   { color: #555; }
.card--raised { box-shadow: 0 2px 8px rgb(0 0 0 / 0.1); }
```

Sass pastes the parent selector's **text** in place of `&`, producing entirely
new class names. **Native CSS nesting cannot do this** — its `&` is a real
selector reference, not a string, so `&__title` is invalid there.

That is the concrete answer to "can we drop Sass now that nesting is native": if
the codebase uses `&__element`, no — not without rewriting every selector.

## Compiled output has no grouping benefit

Worth being explicit about, because the source suggests otherwise:

```scss
.card {
  &__title { font-weight: 600; }
}
```

compiles to a standalone `.card__title` rule. The nesting is purely an authoring
convenience — the output is the same as if you had written the flat selector, and
the browser sees no relationship between them.

This is a point in nesting's favour for BEM specifically: **it groups related
rules in the source without adding a single point of specificity.**

## `&` can be used more than once, and suffixed

```scss
.btn {
  & + & { margin-inline-start: 0.5rem; }   /* .btn + .btn */
}

.icon {
  .dark-theme & { fill: #fff; }            /* .dark-theme .icon */
}
```

The second form is genuinely useful: putting `&` at the *end* lets a component
respond to an ancestor context while keeping the rule inside the component's
block, where it belongs.

## The depth problem

Nesting invites this:

```scss
.page {
  .content {
    .card {
      .card__title {
        a { color: blue; }       /* → .page .content .card .card__title a */
      }
    }
  }
}
```

`0,4,1` specificity, and a selector that breaks if any wrapper changes. The
source looked tidy; the output is a maintenance problem — and this is the main
argument people make *against* nesting.

Two rules that avoid it entirely:

1. **Nest for `&` concatenation, states and media queries — not for document
   structure.** `.card { &__title }` is good; `.page .content .card` is not.
2. **Three levels maximum**, and that third level should be rare.

The BEM style above naturally satisfies both: every rule is one class, however
deep the source nesting looks.

## Nesting media queries and other at-rules

One of the strongest reasons to nest:

```scss
.card {
  padding: 1rem;

  @media (width >= 48rem) {
    padding: 2rem;
  }
}
```

Sass hoists the media query around the generated rule, so the responsive
behaviour of a component lives next to its base rule instead of in a separate
breakpoint block at the bottom of the file. Native CSS nesting supports this too.

## Native nesting vs Sass nesting

| | Native CSS | Sass |
|---|---|---|
| `.parent { .child { } }` | ✅ | ✅ |
| `&:hover`, `&.active` | ✅ | ✅ |
| Nested `@media` | ✅ | ✅ |
| `&__element` concatenation | ❌ | ✅ |
| Specificity of `&` | like `:is()` — takes the most specific parent | plain text substitution |

That last row matters: native `&` behaves like `:is()`, so a parent list
containing an id raises every nested rule's specificity
([Phase 2 · Specificity](../phase-2-cascade/03-specificity-counted-properly.md)).
Sass's `&` has no such effect — it just writes text, and the resulting selector
weighs whatever it looks like.

## Trade-off

**Nesting improves the source and can silently degrade the output.** Every level
you nest for structure adds specificity and coupling that is invisible while
writing — the file looks organised, and the compiled selector is
`.page .content .card .card__title a`. The feature's ergonomics push in exactly
the wrong direction, which is why "don't nest more than three levels" exists as
folklore rather than as a rule anyone can derive.

Used for `&` concatenation only, nesting has the opposite effect: it groups a
component's rules in the source while emitting flat, single-class selectors —
better organisation *and* flatter specificity than writing them out by hand.

The discipline is one sentence: **nest to build names and to attach states, never
to describe the document tree.**

## Gotchas

**A nested rule targets a descendant instead of the same element.**
*Symptom:* `.card .active` when `.card.active` was intended.
*Cause:* the `&` was omitted.
*Fix:* `&.active`.

**`&__title` does not work in a plain `.css` file.**
*Symptom:* the selector is invalid.
*Cause:* native CSS nesting's `&` is a selector reference, not string
concatenation.
*Fix:* keep Sass, or rewrite the selectors to full class names.

**Specificity is far higher than expected.**
*Symptom:* overriding a component requires an id or `!important`.
*Cause:* nesting followed the document structure, adding a level per wrapper.
*Fix:* flatten — nest only for `&` and states.

**A nested rule breaks after markup changes.**
*Symptom:* styles stop applying when a wrapper is added or removed.
*Cause:* the selector encodes the DOM structure.
*Fix:* target the element by class rather than by position.

**Search for a class name finds nothing.**
*Symptom:* grepping for `card__title` returns no results.
*Cause:* it only exists as `&__title` in the source — a real cost of
concatenation.
*Fix:* be aware of it; some teams reject `&__` for this reason alone.

## Interview questions

**★ What can Sass nesting do that native CSS nesting cannot?**
String concatenation with `&` — `&__title` inside `.card` produces the class
`.card__title`. Native `&` is a real selector reference, not text, so it cannot
build new names. This is the concrete reason a BEM codebase cannot drop the
preprocessor.

**★ What is the difference between `.active` and `&.active` when nested?**
`.active` compiles to a descendant selector, `.card .active`. `&.active`
compiles to `.card.active` — the same element carrying both classes.

**★ Why is deep nesting discouraged?**
Each structural level adds specificity and couples the rule to the DOM shape, so
a tidy-looking source produces something like `.page .content .card a` at `0,3,1`
that breaks when any wrapper changes. Nest for `&` concatenation, states and
media queries; not for document structure.

**Does nesting produce more efficient CSS?**
No. It is purely an authoring convenience — `&__title` compiles to a standalone
flat selector, and the browser sees no relationship to the parent block.

**How does `&`'s specificity differ between native CSS and Sass?**
Native `&` behaves like `:is()` and takes the most specific selector in the
parent list, so an id in the parent raises every nested rule. Sass's `&` is plain
text substitution and contributes nothing of its own.

**What is a downside of `&__element` beyond browser support?**
The full class name never appears in the source, so searching the codebase for
`card__title` finds nothing — a real cost when navigating an unfamiliar project.

---

← [01 · Setting up and compiling](./01-setting-up-and-compiling.md) · Next: [03 · Variables — Sass vs custom properties](./03-variables-sass-vs-custom-properties.md) →
