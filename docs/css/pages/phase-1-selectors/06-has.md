---
title: ":has() — the parent selector"
sidebar_label: "06 · :has()"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex09-selector-families.mjs`
> and `ex10-nesting-scope-pseudo.mjs`. Baseline: **Widely available since
> 2023-12-19** (`web-features`).

**CSS can finally style an element because of what is inside it.** `:has()` is
the biggest capability added to selectors in a decade, and it has been Widely
available since December 2023 — it is not a future feature to be cautious about.

## The shape

`:has()` takes a **relative selector** — a selector evaluated from the element
you are matching:

```css
.card:has(img)          { }  /* a card containing an image, at any depth */
.card:has(> img)        { }  /* a card whose direct child is an image     */
.row:has(input:checked) { }  /* a row whose input is checked              */
p:has(+ p)              { }  /* a p FOLLOWED BY another p                 */
label:has(~ .error)     { }  /* a label with a later .error sibling       */
```

```console
$ node ex09-selector-families.mjs
  .wrap:has(.tag)                1  :has() — parent selector
                                    div.wrap
  p:has(+ p)                     1  :has() — followed by a sibling
                                    p.lead[first]
```

The last two forms are the surprise: **`:has()` is also a previous-sibling
selector.** `p:has(+ p)` matched only the first of two adjacent paragraphs —
something CSS could not express at all before.

## The patterns that actually earn their place

**1 — Form validation with no JavaScript:**

```css
.field:has(input:user-invalid) { --field-border: var(--danger); }
.field:has(input:user-invalid) .error-text { display: block; }
.field:has(input:required) .label::after { content: " *"; color: var(--danger); }
```

**2 — Layout that depends on content:**

```css
/* a card with an image gets a two-column layout; one without stays single */
.card { display: grid; }
.card:has(> img) { grid-template-columns: 8rem 1fr; }

/* a figure only gets the caption spacing when there IS a caption */
figure:has(figcaption) { padding-block-end: 0.5rem; }
```

**3 — State that lives in the DOM, not in a class:**

```css
/* dim the page behind an open dialog, with no body class to toggle */
body:has(dialog[open]) { overflow: hidden; }
body:has(dialog[open]) .page { filter: blur(2px); }

/* a nav that knows one of its links is current */
.nav:has([aria-current="page"]) { border-block-end: 2px solid var(--accent); }
```

**That third pattern deletes real JavaScript.** The classic
`document.body.classList.add('modal-open')` — with its matching `remove` that
someone always forgets on the error path — becomes a stylesheet rule that cannot
go out of sync.

**4 — The `+ p` trick, for typographic rhythm:**

```css
/* only the paragraphs that are followed by another one get bottom margin */
p:has(+ p) { margin-block-end: 1em; }
```

## Specificity: the maximum of its arguments

Like `:is()`, `:has()` contributes the specificity of its **most specific**
argument, and `:has()` itself adds nothing:

```css
.card:has(.title)  /* 0,2,0 — .card plus .title */
.card:has(#hero)   /* 1,1,0 — the id counts */
```

Wrap the argument in `:where()` to keep the weight down:

```css
.card:has(:where(#hero))  /* 0,1,0 — back to just .card */
```

## What it costs, measured

`:has()` requires the engine to invalidate upward: when a descendant changes, the
ancestor's styling may change. That is genuinely more work than a class.

At 5000 rows, each containing a checkbox, matching the 500 checked ones:

```console
$ node ex10-nesting-scope-pseudo.mjs
=== Selector cost — :has() vs a class, 5000 elements ===
  querySelectorAll(".is-checked")         0.15
  querySelectorAll(".row:has(:checked)")  1.25
  both return                             500
  note                                    ms per call, mean of 20
```

**8× slower — and still 1.25 ms for five thousand elements.** Both returned the
same 500 rows. Read that as "not free, and not your problem": the class version
requires JavaScript to keep the class in sync, and that JavaScript costs more
than 1.1 ms of anyone's time to write, test and debug.

Where it *would* matter: `:has()` on a very large subtree that changes on every
frame — a `body:has(...)` rule whose argument mutates during a scroll or
animation. Keep the argument narrow and the subject specific.

:::note One engine
This is a Firefox 153 measurement of `querySelectorAll`, not of style
invalidation during rendering, and not a cross-engine claim. It is an order-of-
magnitude indicator, not a benchmark.
:::

## Restrictions worth knowing

- **No nesting `:has()` inside `:has()`.** `:has(:has(x))` is invalid.
- **Pseudo-elements are not allowed** in the argument.
- **It is unforgiving** — an invalid selector inside `:has()` invalidates the
  whole thing, unlike `:is()`. Wrap risky arguments in `:is()` inside it.

## Gotchas

**Symptom:** `.card:has(img)` matches cards where the image is deeply nested
inside something else.
**Cause:** the relative selector defaults to a descendant relationship, at any
depth.
**Fix:** `:has(> img)` for a direct child.

**Symptom:** adding `:has(#something)` made a rule start beating other rules.
**Cause:** `:has()` contributes the specificity of its most specific argument.
**Fix:** `:has(:where(#something))` to zero out the argument's weight.

**Symptom:** a `:has()` rule with several arguments stopped working entirely.
**Cause:** `:has()` is unforgiving — one invalid argument invalidates it.
**Fix:** wrap the uncertain arguments in `:is()`, which forgives.

**Symptom:** scrolling became janky after adding a `body:has(...)` rule.
**Cause:** the argument matches something that changes frequently, forcing
repeated invalidation of a very large subtree.
**Fix:** narrow the subject (not `body`) or the argument, so less of the tree is
affected.

## Interview questions

**★ What does `:has()` make possible that CSS could not do before?**
Styling an element based on its descendants or its later siblings — a parent
selector and a previous-sibling selector, neither of which existed. Measured,
`.wrap:has(.tag)` selected the parent, and `p:has(+ p)` selected the paragraph
*before* another paragraph. It replaces a large class of JavaScript that existed
only to add a class to an ancestor.

**★ Is `:has()` safe to use in production?**
Yes — `web-features` reports it Baseline **Widely available since 2023-12-19**,
meaning every core browser has had it for well over the 30-month threshold. It
is no longer a progressive enhancement.

**What is `:has()`'s specificity?**
The specificity of its most specific argument, with `:has()` itself contributing
nothing — the same rule as `:is()`. `.card:has(#hero)` is `1,1,0`. Wrapping the
argument in `:where()` neutralises it.

**Is `:has()` slow?**
More expensive than a class, because it forces upward invalidation. Measured on
5000 elements, `querySelectorAll('.row:has(:checked)')` took 1.25 ms against
0.15 ms for a plain class — 8× the cost, and still around a millisecond. It
matters when the subject is huge and the argument changes every frame; otherwise
the JavaScript it replaces costs far more.

**How would you dim the page behind an open dialog without JavaScript?**
`body:has(dialog[open]) { overflow: hidden }` plus a blur on the content. The
state lives in the DOM rather than in a class that has to be added and removed,
so it cannot get out of sync on an error path.

---

← [05 · :is() and :where()](./05-is-and-where.md) · Next: [07 · Structural pseudo-classes](./07-structural-pseudo-classes.md) →
