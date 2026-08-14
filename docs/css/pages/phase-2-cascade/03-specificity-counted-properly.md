---
title: "Specificity, counted properly"
sidebar_label: "03 · Specificity"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [Specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascade/Specificity)**
> and the **W3C Selectors Level 4** specification
> ([§17 Calculating a selector's specificity](https://www.w3.org/TR/selectors-4/#specificity-rules)).

**Specificity is three counters, not one number.** Getting that wrong is what
produces the belief that "enough classes beat an id" — they never do, at any
count.

## The three columns

Every selector produces a triple, conventionally written `a,b,c` or `1-0-0`:

| Column | Counts | Weight |
|---|---|---|
| **A — id** | id selectors — `#main` | `1,0,0` |
| **B — class** | class selectors `.card`, attribute selectors `[type="radio"]`, pseudo-classes `:hover`, `:nth-child()` | `0,1,0` |
| **C — type** | type selectors `p`, `h1`, and pseudo-elements `::before`, `::placeholder` | `0,0,1` |

Contribute nothing at all: the universal selector `*`, combinators (` `, `>`,
`+`, `~`), and `:where()`.

## Compare column by column, never by total

The columns are compared **left to right**, and the first difference decides.
There is no carrying and no arithmetic across columns.

```css
#nav                          /* 1,0,0 */
.a.b.c.d.e.f.g.h.i.j.k.l.m    /* 0,13,0 */
```

`#nav` wins. Thirteen classes do not add up to an id, and 130 would not either.
Treating the triple as a base-10 number — "100 + 0 + 0 versus 0 + 130" — gives
the wrong answer and is the single most common mental model error here.

The correct reading is lexicographic, exactly like comparing version numbers:
`1.0.0` beats `0.13.0` because the first component already differs.

## Pseudo-elements count, pseudo-classes count differently

A frequent mix-up, and the two-colon convention is the tell:

```css
p::before   /* 0,0,2 — type + pseudo-ELEMENT, both column C */
p:hover     /* 0,1,1 — pseudo-CLASS is column B, type is column C */
```

## The functional pseudo-classes

`:is()`, `:not()` and `:has()` add **no weight of their own**. They take the
specificity of their **most specific argument**:

```css
:is(p, #fakeId)      { }   /* 1,0,0 — from #fakeId */
p:not(#fakeId)       { }   /* 1,0,1 — #fakeId plus the p */
h1:has(+ h2, > #x)   { }   /* 1,0,1 — #x plus the h1 */
```

The consequence people get bitten by: **one id anywhere in the argument list
raises every match.** `:is(.card, .panel, #legacy)` weighs `1,0,0` even when it
matched a `.card`. Splitting the id into its own rule keeps the common case
light.

`:where()` is the exception and the tool:

```css
:where(#defaultTheme) a { }   /* 0,0,1 — only the a counts */
```

**`:where()` is always `0,0,0`, whatever is inside it.** That is its entire
purpose: writing defaults that anything can override.

## Nesting and `&`

Native nesting behaves like `:is()` — the nesting selector takes the specificity
of the most specific selector in the parent list:

```css
.card, #featured {
  & .title { color: red; }   /* 1,0,1 — the #featured raises it */
}
```

The `.title` inside `.card` now weighs `1,0,1` even though no id was involved in
matching it. This is nesting's hidden cost, and it is why a nested block whose
parent list contains an id is worth splitting.

## Where specificity actually sits

Specificity is **criterion 5 of 6** in the cascade — below origin, importance,
inline styles and layers. It only decides when everything above it ties. See
[01 · What the cascade compares](./01-what-the-cascade-compares.md).

That placement is the practical point. If a rule is losing and you do not know
which criterion separated it, raising specificity is a guess — and the one guess
that cannot be undone cheaply.

## Keeping specificity flat on purpose

The mature position is not "win the specificity fight" but "do not have one":

- **`:where()` for anything overridable** — resets, base typography, library
  defaults. Zero weight means a single class always beats it.
- **Layers for precedence** — [`@layer`](./02-layer/README.md) is compared
  *before* specificity, so architecture decides, not selector shape.
- **One class per component rule.** `.card__title` at `0,1,0` is easier to
  override forever than `.card .title` at `0,2,0`.
- **Never style by id.** An id in a stylesheet sets a floor nothing below can
  cross. Ids are fine as fragment targets and JS hooks — just not in CSS.

Applied together, most of a codebase sits at `0,1,0`, and overriding anything is
one class in a later layer.

## Trade-off

**Flat specificity means giving up the convenience of "just make it more
specific".** Deliberately weak selectors — `:where()` wrappers, single classes —
require you to have somewhere else to express precedence, which in practice
means committing to a layer order and keeping it. On a small stylesheet that is
more machinery than the problem deserves, and a couple of descendant selectors
would have been fine.

The break-even arrives the first time two parts of the codebase need to override
each other and neither is willing to lose. Before that point flat specificity is
overhead; after it, it is the only thing that stops the ratchet.

## Gotchas

**"Enough classes will beat the id."**
*Symptom:* a rule is rewritten with more and more classes and still loses.
*Cause:* columns are compared independently — any A beats any amount of B.
*Fix:* stop escalating. Put the rule in a later layer, or reduce the id rule's
weight with `:where(#id)`.

**A rule got heavier without gaining a selector.**
*Symptom:* a nested `& .title` suddenly outranks things it used to lose to.
*Cause:* an id was added to the *parent* selector list; `&` takes the most
specific parent, like `:is()`.
*Fix:* split the id out into its own rule, or wrap it in `:where()`.

**`:not()` raised specificity unexpectedly.**
*Symptom:* `p:not(#x)` beats `.important p`.
*Cause:* `:not()` contributes its argument's weight — the `#x` counts fully.
*Fix:* `p:not(:where(#x))` keeps the negation and drops the weight to `0,0,1`.

**DevTools shows the rule as applying but the property is struck through.**
*Symptom:* the selector matched, the declaration is crossed out.
*Cause:* something won at a *higher* criterion — inline style, layer, or
`!important` — so specificity was never the deciding factor.
*Fix:* read which rule is winning rather than raising this one.

## Interview questions

**★ How is specificity calculated and compared?**
Three counters: ids in column A, classes/attributes/pseudo-classes in column B,
types/pseudo-elements in column C. Compared left to right, first difference
wins. It is lexicographic, not a sum — no number of classes ever beats one id.

**★ What specificity do `:is()`, `:not()`, `:has()` and `:where()` contribute?**
The first three contribute the specificity of their most specific argument and
nothing of their own. `:where()` always contributes zero regardless of contents,
which makes it the tool for overridable defaults.

**★ Why is `:where()` useful in a reset or a library?**
Because a zero-specificity rule can be overridden by anything, including a
single class. It lets you ship defaults that never need to be fought.

**Does the universal selector or a combinator add specificity?**
No. `*`, ` `, `>`, `+` and `~` all contribute nothing — combinators change what
matches, not how much it weighs.

**Where does specificity sit in the cascade?**
Fifth of six — after origin and importance, context, inline styles and cascade
layers, and before order of appearance. It only decides when all of those tie.

**How does native nesting affect specificity?**
`&` behaves like `:is()`, taking the most specific selector from the parent
list. A parent list containing an id raises every nested rule to `1,x,x`.

---

← [02 · `@layer`](./02-layer/README.md) · Next: [04 · The shorthand reset trap](./04-the-shorthand-reset-trap.md) →
