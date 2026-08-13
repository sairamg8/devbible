---
title: "Combinators"
sidebar_label: "02 · Combinators"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex09-selector-families.mjs`.

**Four characters that describe relationships between elements.** They are how
you say "this, but only inside that" — and how you accidentally style half the
page.

## The four

```css
main p       { }  /* descendant       — any depth below main      */
main > p     { }  /* child            — exactly one level below   */
.title + p   { }  /* next sibling     — the very next sibling     */
.title ~ p   { }  /* subsequent sibling — any later sibling       */
```

Against this document:

```html
<main id="app">
  <h2 class="title">Heading</h2>
  <p class="lead">first</p>
  <p>second</p>
  <div class="wrap">
    <p class="lead">nested lead</p>
    <span class="tag">a</span><span class="tag">b</span><span class="tag">c</span>
  </div>
</main>
```

```console
$ node ex09-selector-families.mjs
  main p                         3  descendant
                                    p.lead[first]  p[second]  p.lead[nested lead]
  main > p                       2  child
                                    p.lead[first]  p[second]
  .title + p                     1  next sibling
                                    p.lead[first]
  .title ~ p                     2  subsequent siblings
                                    p.lead[first]  p[second]
  .wrap > .tag + .tag            2  child + adjacent
                                    span.tag[b]  span.tag[c]
```

Read the difference between the first two: **`main p` found the paragraph inside
`.wrap`; `main > p` did not.** That one space is the difference between styling
your component and styling everything anyone ever nests inside it.

And `.title ~ p` matched two paragraphs while `.title + p` matched one — `+` is
strictly the *immediately* next sibling.

## They read right-to-left

The engine evaluates `main > p` by finding every `p`, then checking whether its
parent is `main` — not by walking down from `main`. This is why the
*rightmost* part of a selector (the "key selector") is what determines how much
work matching costs, and why `main *` is a heavier rule than `main > .thing`.

It is also why a descendant combinator has no depth limit: there is nothing to
bound the walk upward except the root.

## The patterns worth memorising

```css
/* the owl — space between siblings, with no first-child exception */
.flow > * + * { margin-block-start: 1em; }

/* separators between items, never a trailing one */
.crumbs > li + li::before { content: "/"; margin-inline: 0.5ch; }

/* only style children, so nested instances are unaffected */
.menu > li { }

/* label a checked input's following label, with no JS */
input:checked + label { font-weight: 700; }
```

**`* + *` is the single most useful combinator idiom in CSS.** It applies
spacing to every child except the first, which is exactly what vertical rhythm
wants and what `margin-block: 1em` on every child gets wrong.

## Descendant vs child: pick deliberately

| | Descendant (` `) | Child (`>`) |
|---|---|---|
| Depth | any | exactly one |
| Survives extra wrapper divs | ✅ | ❌ breaks |
| Leaks into nested components | ❌ yes | ✅ no |
| Cost | walks up to the root | one parent check |

The trade-off is real in both directions. `>` is safer for components — a
`.card > .title` rule cannot hit a `.title` inside a nested card — but it breaks
the moment someone wraps the title in a `<div>` for layout. Use `>` when the
structure is yours and stable; use the descendant combinator for content
containers where the depth is not yours to know.

## There is no parent or previous-sibling combinator

You cannot select an element because of what comes *before* it, and until
recently you could not select it because of what is *inside* it. `:has()` solved
the second problem and can simulate the first:

```css
/* "a p that is followed by another p" — measured, matches only the first */
p:has(+ p) { margin-block-end: 0; }
```

```console
  p:has(+ p)                     1  :has() — followed by a sibling
                                    p.lead[first]
```

That is covered properly in [`:has()`](./06-has.md).

## Gotchas

**Symptom:** a component's styles apply to a nested copy of that component.
**Cause:** a descendant combinator — `.card .title` matches at any depth,
including inside another `.card`.
**Fix:** use `>` where the structure is under your control, or `@scope` with a
lower bound ([page 14](./14-scope.md)).

**Symptom:** `.title + p` stops working after adding a wrapper or a comment
element between them.
**Cause:** `+` requires the *immediately* next sibling element.
**Fix:** `~` if any later sibling is acceptable, or restructure so the
relationship is direct.

**Symptom:** `.menu > li` breaks when a template adds a wrapper div.
**Cause:** `>` is exactly one level; the wrapper made it two.
**Fix:** either fix the markup or switch to a descendant combinator — accepting
that it now reaches nested menus too.

**Symptom:** spacing appears above the first item in a list.
**Cause:** `margin-block-start` on every child rather than on `* + *`.
**Fix:** `.flow > * + * { margin-block-start: 1em }`, which cannot apply to the
first child.

## Interview questions

**★ What is the difference between `div p` and `div > p`?**
The descendant combinator matches a `p` at any depth below a `div`; the child
combinator matches only a `p` whose direct parent is that `div`. Measured on a
test page, `main p` matched three paragraphs including one nested inside another
element, while `main > p` matched two. The practical consequence is leakage —
descendant selectors reach into nested components, child selectors do not.

**★ Why is `.flow > * + *` such a common pattern?**
It applies a style to every child except the first, because `+` requires a
preceding sibling. That is exactly what vertical spacing wants: gaps *between*
items, with no leading gap to cancel and no `:first-child` exception to
maintain.

**Is there a parent selector or a previous-sibling combinator?**
There is no previous-sibling combinator, and there is no parent *combinator* —
but `:has()` provides both capabilities as a pseudo-class. `p:has(+ p)` selects a
paragraph followed by another paragraph, and `.card:has(img)` selects a parent by
its contents.

**How are selectors evaluated, and why does it matter?**
Right to left, from the key selector. The engine finds candidates matching the
rightmost part and then verifies the relationships leftward. It matters because
the rightmost part determines the size of the candidate set — `main *` is far
heavier than `main > .thing`.

**When would you deliberately choose a descendant combinator over a child one?**
For content whose structure you do not control — CMS output, rendered Markdown —
where an extra wrapper element would break a `>` selector and there is no way to
add classes.

---

← [01 · Selector families](./01-the-selector-families.md) · Next: [03 · Attribute selectors](./03-attribute-selectors.md) →
