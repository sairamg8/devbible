---
title: "What the cascade compares, in order"
sidebar_label: "01 · What the cascade compares"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **W3C CSS Cascading and Inheritance Level 5**
> specification ([§6.1 Cascade Sorting Order](https://www.w3.org/TR/css-cascade-5/#cascade-sort))
> and **MDN — [Cascade](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascade/Cascade)**.
> The ordering was also confirmed case by case in **Firefox 153.0.3** by
> `sandbox/css/ex11-cascade-order.mjs` (**sandbox-measured**, run 2026-08-13).

**Specificity is the fifth thing the cascade looks at, not the first.** Almost
every "why is this rule not applying" question is answered by something above
specificity in the list — and reaching for a more specific selector when the
real difference is origin, layer or importance is how stylesheets rot.

## The order, top to bottom

When two declarations both apply to the same element and set the same property,
the cascade compares them by these criteria **in order**. The first criterion
that distinguishes them decides it; the rest are never consulted.

| # | Criterion | What it compares |
|---|---|---|
| 1 | **Origin and importance** | Who wrote it — user agent, user, author — and whether it is `!important` |
| 2 | **Context** | Which encapsulation context (shadow tree vs outer document) |
| 3 | **Element-attached styles** | A `style` attribute beats anything matched by a selector |
| 4 | **Cascade layers** | Which `@layer` it lives in |
| 5 | **Specificity** | The (id, class, type) weight of the selector |
| 6 | **Order of appearance** | The last declaration in document order wins |

Read that top-down once and a lot of CSS folklore dissolves. "Inline styles have
a specificity of 1000" is a teaching lie: inline styles are **criterion 3**, and
the comparison never reaches specificity at all.

## Criterion 1: origin and importance

There are three origins — the **user agent** (the browser's own stylesheet), the
**user** (browser preferences and user stylesheets), and the **author** (your
CSS). Importance splits each into normal and important, and the specification
interleaves them into eight precedence levels:

| Precedence | Declaration |
|---|---|
| 1 (highest) | Transition declarations |
| 2 | **Important** user agent |
| 3 | **Important** user |
| 4 | **Important author** |
| 5 | Animation declarations |
| 6 | **Normal author** |
| 7 | Normal user |
| 8 (lowest) | Normal user agent |

Two things in that table are worth pausing on.

**Important reverses the origin order.** Normally author beats user beats user
agent. Add `!important` and the ladder inverts — an important *user* declaration
beats an important *author* one. That inversion exists for accessibility: a user
who forces a minimum font size must be able to beat the site.

**Transitions sit above everything, animations do not.** A running transition
outranks even important user-agent styles. An animation sits below important
author declarations, which is why `!important` is the documented way to defeat
a `@keyframes` value you do not control.

## Criterion 3: element-attached styles

> "Declarations that are attached directly to an element (such as the contents
> of a `style` attribute) rather than indirectly mapped by means of a style rule
> selector take precedence over declarations the same importance that are mapped
> via style rule."
>
> — CSS Cascade Level 5, §6.1

The phrase **"the same importance"** is the whole content of the rule. A normal
inline style beats every normal author rule, no matter how specific. It does
**not** beat an important author rule, because those are not "the same
importance" — importance was criterion 1 and already separated them.

```html
<p style="color: green">…</p>
```

```css
#article .lead p { color: red; }            /* loses — 1,1,1 is irrelevant */
#article .lead p { color: red !important; } /* wins — decided at criterion 1 */
```

## Criterion 6: order of appearance, and what it really means

When everything above ties, **the last declaration wins**. This is the criterion
that makes stylesheet order matter, and the one people accidentally rely on.

```css
.button { background: blue; }
.button { background: green; }   /* wins — identical weight, later */
```

"Later" means later in the final cascade order of the document: within a
stylesheet, source order; across stylesheets, the order the browser encountered
them. Moving an import can therefore change rendering without any rule changing.

## The whole author ladder in one table

Origin, importance, inline and layers interact, and the result is the ladder
you actually work inside every day. From weakest to strongest, for author CSS:

| | Declaration |
|---|---|
| weakest | Normal, first-declared layer |
| ↓ | Normal, later layers |
| ↓ | **Normal, unlayered** |
| ↓ | Normal inline `style` |
| ↓ | Animations |
| ↓ | **Important, unlayered** |
| ↓ | Important, later layers |
| ↓ | Important, first-declared layer |
| strongest | Important inline `style` |

Two asymmetries fall out of it, and both catch people:

- **Unlayered normal styles beat every layer**, but **important unlayered styles
  are the weakest of the important ones.** One rule explains both — see
  [02 · `@layer`](./02-layer/README.md).
- `!important` on an inline style is the strongest thing author CSS can produce.
  There is nothing above it except a transition, a user's important declaration,
  or the user agent's.

## Why the order is what it is

The sequence is not arbitrary — it runs from **most contextual** to **most
mechanical**:

1. *Who wrote this, and did they insist?* — a question about people.
2. *Which document tree is it in?* — a question about component boundaries.
3. *Was it attached to this one element by hand?* — a question about intent.
4. *Which architectural layer owns it?* — a question about your design.
5. *How precisely did the selector describe the element?* — a question about the
   selector.
6. *Which came last?* — a coin toss with a rule.

Specificity is fifth because it is a *proxy* for intent, and a bad one. Every
criterion above it expresses intent directly. That is the argument for `@layer`
in one sentence: it lets you state precedence as a decision instead of encoding
it in selector weight.

## Trade-off

**Reading the cascade properly costs you the mental shortcut.** "More specific
wins" is wrong but fast, and it is right often enough — inside a single
unlayered stylesheet with no inline styles, criteria 1–4 all tie, and
specificity really does decide.

The cost of the shortcut is paid later, and always in the same currency:
selector inflation. Each time the shortcut fails, the fix that *looks* right is
a heavier selector, then an id, then `!important`. Every one of those is an
irreversible ratchet — you cannot go back down without touching every rule that
was raised to compete. Learning the real order costs an afternoon; the shortcut
costs a rewrite.

## Gotchas

**A rule with higher specificity loses and nothing looks wrong.**
*Symptom:* `#sidebar .widget h2 { color: red }` is beaten by `h2 { color: blue }`.
*Cause:* the winner is unlayered and the loser is inside an `@layer` — decided
at criterion 4, so specificity was never compared.
*Fix:* check which layer each rule is in before touching the selector. In
DevTools, layered rules are grouped under their layer name.

**`!important` fixes it, then breaks the next thing.**
*Symptom:* adding `!important` works, and a week later a colleague's
`!important` does not.
*Cause:* both are now at precedence level 4, so the comparison falls through to
layer, then specificity, then source order — you have not won the argument, you
have moved it one rung up.
*Fix:* treat `!important` as a signal that the wrong criterion is being used.
The intended tools are layers and `:where()`.

**Overriding an animated value does nothing.**
*Symptom:* a `@keyframes` sets `opacity` and your normal rule is ignored for the
whole animation.
*Cause:* animation declarations sit **above** normal author declarations at
criterion 1.
*Fix:* `!important` on the author declaration — important author beats
animations. Note this is the opposite for transitions, which outrank everything.

**A user-stylesheet or extension override wins and looks like a browser bug.**
*Symptom:* your `!important` is ignored in one person's browser only.
*Cause:* important user declarations outrank important author ones by design.
*Fix:* nothing in CSS, and nothing should be — that inversion is an
accessibility guarantee.

## Interview questions

**★ In what order does the cascade compare two declarations?**
Origin and importance, then context, then element-attached (inline) styles, then
cascade layers, then specificity, then order of appearance. The first criterion
that separates them wins and the rest are not consulted.

**★ Is it true that inline styles have a specificity of 1-0-0-0?**
No. Inline styles are a separate, earlier criterion than specificity. The
comparison never reaches specificity, which is why an important author rule
still beats a normal inline style — importance separated them one step earlier.

**★ Why does `!important` invert the origin order?**
Accessibility. A user who needs larger text or higher contrast must be able to
override the author, so important user declarations outrank important author
ones. The same inversion applies to the user agent's own important rules.

**Where do animations and transitions sit?**
Animations sit just above normal author declarations, so an author `!important`
beats a running animation. Transitions sit at the very top, above everything —
you cannot override a property mid-transition from CSS.

**Two rules have identical specificity and both apply. What decides?**
Order of appearance — the last one in the document's cascade order. That is
final source order across all stylesheets, so moving an `@import` can flip it.

**Why is specificity so far down the list?**
Because it is a proxy for intent rather than a statement of it. Origin,
importance, inline and layer all say directly who should win; specificity only
measures how narrowly the selector was written, which correlates with intent
poorly and gets worse as a codebase grows.

---

Next: [02 · `@layer`](./02-layer/README.md) →
