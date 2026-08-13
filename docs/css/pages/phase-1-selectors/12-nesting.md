---
title: "CSS Nesting"
sidebar_label: "12 · Nesting"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex10-nesting-scope-pseudo.mjs`.
> Baseline: **Widely available since 2023-12-11** (`web-features`).

**Nesting is native CSS now — no preprocessor required.** It has been Baseline
since December 2023. It is also the fastest way to accidentally build a
stylesheet nobody can override.

## What it does

```css
.card {
  color: navy;

  & .title      { font-weight: 700; }   /* descendant                    */
  &:hover       { color: teal; }        /* the element itself, hovered   */
  .inner &      { font-style: italic; } /* .card inside .inner           */

  @media (min-width: 1px) { padding: 4px; }   /* at-rules nest too       */
}
```

```console
$ node ex10-nesting-scope-pseudo.mjs
=== What a nested rule desugars to ===
  outer selector  .card
  nested rules    4
  desugared       ["& .title","&:hover",".inner &","@media (min-width: 1px)"]

=== Nesting: computed results ===
  color (from .card)             rgb(0, 0, 128)
  padding (from nested @media)   4px
  font-style (from .inner &)     italic
  .title weight (from & .title)  700
```

All four forms work, including the two that people assume need a preprocessor:
**`.inner &`** puts the parent selector on the right, and a **nested `@media`**
applies declarations to the parent directly, with no repeated selector.

## `&` — what it means and when it is required

`&` is the **parent selector reference**. It is not string concatenation:

```css
.card {
  & .title  { }    /* .card .title   */
  &.active  { }    /* .card.active   — no space  */
  & + &     { }    /* .card + .card              */
  .inner &  { }    /* .inner .card               */
}
```

**In native CSS, `&` is optional before a type selector but required in
practice.** These behave the same:

```css
.card { p { color: red } }        /* works — implicitly .card p */
.card { & p { color: red } }      /* explicit, and clearer      */
```

Write the `&`. It removes all ambiguity about which form you meant, and it is
the only way to express `&.active` and `.inner &` anyway.

## The difference from Sass that will bite you

**Sass concatenates strings. Native CSS does not.**

```scss
/* Sass — builds the string ".card__title" */
.card { &__title { } }
```

```css
/* native CSS — INVALID, does nothing */
.card { &__title { } }
```

BEM-style suffix generation does not exist in native nesting. If a codebase uses
`&__element`, it is Sass and cannot simply have the preprocessor removed.

## The specificity it hides

This is the real hazard. Nesting compiles to descendant selectors, and every
level adds weight:

```css
.page {
  .sidebar {
    .widget {
      .title { color: red; }   /* 0,4,0 — four classes */
    }
  }
}
```

Four levels of what looks like tidy organisation produced a selector that only
another four-class selector can override. The nesting made it invisible: at no
point did anyone type `.page .sidebar .widget .title`.

Additionally, **`&` used in a compound with a list takes the specificity of the
list's most specific member**, because `&` behaves like `:is()` in that position:

```css
.a, #b {
  & .child { }   /* specificity 1,0,1 — the #b raises ALL of them */
}
```

**Rule: keep nesting to two levels.** Three is a smell; four is a bug you have
not found yet.

## Where it genuinely helps

```css
/* state and variants beside the thing they modify */
.btn {
  background: var(--btn-bg);

  &:hover  { --btn-bg: var(--accent-hover); }
  &:focus-visible { outline: 2px solid var(--accent); }
  &[data-variant="ghost"] { --btn-bg: transparent; }
  &:disabled { opacity: 0.5; }
}

/* container queries beside the component they belong to */
.card {
  display: grid;
  @container (min-width: 30rem) { grid-template-columns: 8rem 1fr; }
}
```

The win is **locality** — everything about `.btn` is in one block, so nothing is
missed when it changes. The win is not fewer characters.

## Gotchas

**Symptom:** `&__title` does nothing in a plain `.css` file.
**Cause:** native nesting does not concatenate strings; that is Sass syntax.
**Fix:** write the full class, or keep Sass if the codebase depends on it.

**Symptom:** overriding a nested rule requires an absurdly specific selector.
**Cause:** each nesting level added a class to the compiled selector — four
levels is `0,4,0`.
**Fix:** flatten to two levels, or wrap the nested selector in `:where()` to zero
its contribution.

**Symptom:** a nested rule under a comma-separated parent is unexpectedly
specific.
**Cause:** `&` behaves like `:is()` there, taking the highest specificity in the
list — one id in the parent list raises everything nested inside.
**Fix:** split the rule, or use `:where()` on the parent list.

**Symptom:** a nested rule applies to elements outside the component.
**Cause:** nesting compiles to a **descendant** relationship by default, so it
reaches any depth — including nested instances of the same component.
**Fix:** `& > .child` for direct children.

## Interview questions

**★ What does `&` mean in native CSS nesting, and how does it differ from
Sass?**
It is a reference to the parent selector, substituted as a selector — not as a
string. Sass concatenates, so `&__title` builds `.card__title`; native CSS
cannot do that and the rule is simply invalid. Everything else — `&:hover`,
`& .child`, `.outer &` — behaves the same in both.

**★ What is the main risk of CSS nesting?**
Invisible specificity growth. Each level compiles to another descendant
combinator, so four levels of nesting produce a `0,4,0` selector that nobody
typed and that only an equally specific rule can override. Keeping nesting to two
levels, or wrapping in `:where()`, avoids it.

**Is native nesting safe to use in production?**
Yes — Baseline **Widely available since 2023-12-11**, so every core browser has
had it for over the 30-month threshold.

**Can you nest at-rules?**
Yes. `@media`, `@container` and `@supports` nest inside a rule, and their
declarations apply to the parent selector without repeating it — measured, a
nested `@media` applied `padding: 4px` to `.card` directly.

**What specificity does a nested rule have when the parent is a selector list?**
`&` behaves like `:is()` there, so it contributes the specificity of the most
specific selector in the parent list. One id in that list raises every nested
rule to id-level specificity.

---

← [11 · :not(), :empty, :root](./11-not-empty-root.md) · Next: [13 · Styling hooks](./13-styling-hooks.md) →
