---
title: "Precedence, unlayered styles and !important"
sidebar_label: "02 · Precedence and !important"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [Cascade layers](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascade/Cascade_layers)**
> and **[Cascade](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascade/Cascade)**,
> and the **W3C CSS Cascade Level 5** specification
> ([§6.4.2](https://www.w3.org/TR/css-cascade-5/#layer-ordering)).
> The inversion was confirmed in **Firefox 153.0.3** by
> `sandbox/css/ex11-cascade-order.mjs` (**sandbox-measured**, run 2026-08-13).

**Unlayered styles beat every layer — and important unlayered styles lose to
every layer.** Both halves come from one rule, and once you have that rule the
whole system is predictable.

## The one rule

> **Unlayered declarations behave as if they were in an implicit final layer.**

That is it. Everything below is that sentence applied twice.

The spec's two ordering rules are:

> "For normal rules the declaration whose cascade layer is **last** wins, and
> for important rules the declaration whose cascade layer is **first** wins."
>
> — CSS Cascade Level 5, §6.4.2

Now combine them with the implicit-final-layer rule:

| | Which layer wins | Where unlayered sits | Result |
|---|---|---|---|
| **Normal** declarations | the **last** layer | the last layer | **unlayered wins** |
| **Important** declarations | the **first** layer | the last layer | **unlayered loses to every layer** |

Unlayered never moved. The *direction of the comparison* flipped, and being last
went from best to worst.

## Normal: unlayered beats everything

```css
@layer base {
  :root body #main p { color: blue; }   /* 1,0,3 — very heavy */
}

p { color: red; }                        /* 0,0,1 — unlayered */
```

The paragraph is **red**. Specificity `1,0,3` versus `0,0,1` is not consulted,
because layer comparison happens first and unlayered is the implicit last layer.

This is the behaviour that makes layers useful and also the one that quietly
breaks half-migrated stylesheets: any rule you have not yet moved into a layer
is now floating above your entire architecture.

## Important: the order inverts

```css
@layer a, b;

@layer a { p { color: green !important; } }
@layer b { p { color: blue  !important; } }

p { color: red !important; }             /* unlayered */
```

The paragraph is **green**. Among important declarations the **first** layer
wins, so `a` beats `b`, and unlayered — the implicit *last* layer — is weakest
of the three.

Turn every `!important` in that example off and the answer becomes **red**, then
blue, then green in strength order. The same three rules produce exactly
reversed results.

## Why the inversion exists

It is not a quirk. It preserves the meaning of `!important` under layering.

`!important` means "this declaration must not be overridden by ordinary
authoring". The lower layers in a design are the ones expressing deliberate,
foundational constraints — a reset, an accessibility floor, a design-system
invariant. If important declarations sorted the same direction as normal ones,
a utility layer at the top could `!important` its way past a foundational
constraint, and the layer order would carry no weight at all.

Inverting means: **the more foundational the layer, the more binding its
`!important`.** It is the same logic that makes an important *user* declaration
beat an important *author* one — importance escalates toward whoever is meant to
have the final say.

## The pattern this makes possible: swallowing a third-party stylesheet

This is the payoff, and the reason to reach for layers first when a vendor
stylesheet is fighting you.

```css
@layer reset, vendor, base, components, utilities;

@import "vendor/datepicker.css" layer(vendor);

@layer components {
  .datepicker__day { border-radius: 4px; }   /* 0,1,0 — and it wins */
}
```

The vendor stylesheet may use `#app .datepicker .datepicker__day` at `1,2,1`.
It does not matter. It is in an earlier layer, so a single class in
`components` beats it, and **nothing in your codebase needs `!important`**.

The caveat is honest and worth stating: if the vendor stylesheet itself uses
`!important`, the inversion works against you — its important declarations are
now in an *earlier* layer than yours and therefore stronger. Layers cannot fix
someone else's `!important`; they can only stop you needing your own.

## `revert-layer`

The keyword that makes layers composable: it rolls a property back to the value
it would have had from the **previous** layer, rather than to its initial value.

```css
@layer base {
  a { color: navy; text-decoration: underline; }
}

@layer components {
  .plain a { color: revert-layer; text-decoration: revert-layer; }
}
```

Inside `.plain`, links get whatever `base` said — not `unset`, not the browser
default, but the previous layer's answer. Compare the neighbours:

| Keyword | Rolls back to |
|---|---|
| `initial` | the property's initial value from the spec |
| `inherit` | the parent element's computed value |
| `unset` | `inherit` if the property inherits, else `initial` |
| `revert` | the previous **origin** (author → user → user agent) |
| `revert-layer` | the previous **layer** in the same origin |

Used from an unlayered rule, `revert-layer` reverts to the last actual layer.

## A layer order worth copying

```css
@layer reset, vendor, base, layout, components, utilities;
```

- **reset** — the handful of normalising rules. Weakest, so everything overrides it.
- **vendor** — third-party CSS pulled in with `@import … layer(vendor)`.
- **base** — element defaults: typography, links, form controls.
- **layout** — page-level structure.
- **components** — the bulk of the application's CSS.
- **utilities** — single-purpose overrides. Strongest, so `.mt-0` always works.

The property that makes it worth the ceremony: **a utility class is one class
selector and it always wins.** No `!important`, no `.card .header .title.title`,
and no escalation the next time.

## Trade-off

**You are trading a familiar mess for an unfamiliar discipline.** The
inversion under `!important` is genuinely counter-intuitive, and it is a new
thing every reviewer must know. A team that adopts layers halfway — a layered
design system plus a large unlayered legacy stylesheet — has *harder* debugging
than before, because the legacy rules now silently outrank the new system while
its `!important` rules silently underrank it.

The honest guidance: adopt layers at a boundary you can complete (all vendor
CSS, all of the reset), and treat "is anything still unlayered?" as the question
that decides whether the migration is finished.

## Gotchas

**A weak unlayered rule beats a heavy layered one.**
*Symptom:* `p { color: red }` defeats `:root body #main p { color: blue }`.
*Cause:* unlayered is the implicit final layer, and for normal declarations the
last layer wins — before specificity is compared.
*Fix:* intended behaviour. If the layered rule should win, the unlayered one
belongs in a later layer, not in a heavier selector.

**`!important` in a utility layer stops working.**
*Symptom:* `.mt-0 { margin: 0 !important }` in the strongest layer loses to an
important rule in `base`.
*Cause:* among important declarations the **first** layer wins, so the strongest
normal layer is the weakest important one.
*Fix:* drop the `!important` — in the last layer it was never needed. If
something genuinely must be unbeatable, it belongs in the *first* layer.

**Migrating one rule at a time makes things worse.**
*Symptom:* moving rules into layers causes more overrides to fail, not fewer.
*Cause:* every rule not yet moved is now above all the ones you moved.
*Fix:* migrate whole concerns at once, and audit for unlayered rules.

**`revert-layer` reverts further than expected.**
*Symptom:* it lands on the browser default rather than your base layer.
*Cause:* there was no previous layer defining that property, so it continues
past the layers to the previous origin.
*Fix:* confirm the property is actually set in an earlier layer.

## Interview questions

**★ Unlayered styles beat layered ones, but unlayered `!important` loses to
layered `!important`. Explain both with one rule.**
Unlayered declarations behave as an implicit final layer. Normal declarations
are won by the last layer, so unlayered wins. Important declarations are won by
the first layer, so unlayered — still last — is weakest. The position never
changed; the direction of comparison did.

**★ Why does `!important` invert layer order?**
So that the most foundational layers hold the most binding constraints. If
important sorted the same way as normal, a top utility layer could override a
reset's or design system's deliberate invariants, and layer order would mean
nothing under `!important`.

**How do you override a third-party stylesheet without `!important`?**
Import it into an early layer — `@import "vendor.css" layer(vendor)` — with your
own layers declared after it. Any rule of yours then wins regardless of the
vendor's selector weight.

**What does `revert-layer` do, and how is it different from `revert`?**
`revert-layer` rolls the property back to the value from the previous cascade
layer in the same origin. `revert` rolls back to the previous *origin* — author
to user to user agent — skipping layers entirely.

**Your utility layer is last and a rule in it still loses. What do you check?**
Whether the competing rule is unlayered (it would beat every layer for normal
declarations), and whether either declaration is `!important` (which inverts the
layer comparison and makes your last layer the weakest).

---

← [01 · Declaring and ordering](./01-declaring-and-ordering.md) · Next: [03 · Specificity](../03-specificity-counted-properly.md) →
