---
title: "Tokens, layers and the component contract"
sidebar_label: "12 · Tokens, layers, contract"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 — MDN *`@layer`* (layer ordering, unlayered styles,
> `!important` reversal), MDN *Using CSS custom properties* (`var()` fallbacks
> and invalid-at-computed-value-time), and the CSS Cascade Level 5
> specification. Composes
> [CSS 2·02](../../../../css/pages/phase-2-cascade/02-layer/README.md),
> [CSS 2·01](../../../../css/pages/phase-2-cascade/01-what-the-cascade-compares.md)
> and [CSS 3·01](../../../../css/pages/phase-3-custom-properties/01-custom-properties-as-a-component-api.md).
> No sandbox, no console output.

[Chunk 11](11-the-complete-stylesheet.md) is a file that defines no colours, no
spacing values and no radii, and that lives inside a layer it does not declare.
Both of those are deliberate, and both are what let the file stay this short.

## What the component consumes

| Token | Supplied by | If missing |
|---|---|---|
| `--space-2` … `--space-8` | the spacing scale in the `tokens` layer | gaps and padding collapse to their initial values |
| `--surface-2`, `--surface-3` | **chapter 05 · Dark mode** *(not written yet)* | the media placeholder is transparent |
| `--text-muted` | the same theme layer | the compare-at price inherits body colour |
| `--radius-2` | the shape scale | square corners |
| `--card-ratio` | **optional** — a placement that wants a different ratio | falls back to `4 / 3`, as written |

Only the last one has a fallback, and the asymmetry is the point.

**`--card-ratio` is a parameter**: the component publishes it, expects it to be
absent most of the time, and states its own default inline. **The rest are
dependencies**: if the token layer did not load, the component is not "mostly
fine with defaults", it is unstyled — and it should look unstyled, loudly,
rather than degrade into something that passes review.

That is the component-API pattern from
[CSS 3·01](../../../../css/pages/phase-3-custom-properties/01-custom-properties-as-a-component-api.md):
the component declares what may vary, the context varies it, and neither side
reaches into the other's selectors. It is also what makes dark mode a token swap
rather than a second copy of every component file — the only colour decisions
here are *which surface*, never which value.

⚠️ **A `var()` fallback on every token quietly forks the design system.** Two
sources of truth for a spacing scale is worse than one loud failure, because the
fork is invisible until someone changes the scale and half the app moves.

## Layer order is declared once, or it is not a decision

```css
/* src/styles/index.css — before every import */
@layer reset, tokens, base, layout, components, utilities;

@import url('./reset.css')              layer(reset);
@import url('./tokens.css')             layer(tokens);
@import url('./components/product-grid.css');   /* declares its own @layer */
```

**A layer's position is fixed by its first mention.** If each component file
declares its layers as it goes, the resulting order depends on import order —
which changes with the bundler, with a lazily-loaded route, or with a refactor
nobody connected to a styling bug three weeks later. Declaring the complete
order once, before anything is imported, turns it from an emergent property into
a decision.

The order in this phase, and what each is for:

| Layer | Holds | Beats |
|---|---|---|
| `reset` | normalisation | nothing |
| `tokens` | custom property declarations | `reset` |
| `base` | bare element styles | `tokens` |
| `layout` | page shells | `base` |
| `components` | almost everything in this phase | `layout` |
| `utilities` | the deliberate escape hatch | everything above |

The payoff is that **a component rule can be a single class**. Without layers,
`.product-card__buy` has to out-specify whatever else might touch a button, so
selectors grow — `.catalog .product-card .product-card__buy` — until specificity
is doing a job source order should have done.

### Three layer behaviours that surprise people

1. **Unlayered styles beat every layer.** Anything outside `@layer` is treated
   as higher priority than all declared layers, regardless of source order. One
   stray unlayered rule beats a carefully ordered `utilities` layer, and this is
   the usual shock when layers are introduced into an existing codebase.
2. **`!important` reverses layer order.** An `!important` declaration in an
   *earlier* layer beats an `!important` in a later one. The rule is consistent —
   important declarations invert the whole cascade order — but it means
   `!important` in `reset` is nearly unbeatable, which is a reason not to put it
   there.
3. **Specificity still applies *within* a layer.** Layers sort before
   specificity, not instead of it. Two rules in `components` are still settled
   by specificity and then source order, which is why keeping component rules at
   one class is a discipline rather than something layers do for you.

## What "contract" means for this component

Four things look like details a tidy-up would remove, and all four break the
component:

| Thing | Why it is load-bearing |
|---|---|
| The `__inner` wrapper | a container cannot query itself — there is nothing else for the query to target |
| `role="list"` | WebKit drops list semantics when markers are removed |
| `width`/`height` on the `<img>` | space reservation before the stylesheet arrives |
| The tokens above | the component has no colour or spacing of its own |

A component's contract is **everything a consumer must not "clean up"**, and it
is worth writing down precisely because each item individually looks like
redundancy. The failure mode is uniform: someone removes one, nothing breaks in
the happy path they tested, and the regression surfaces in a narrow container, a
slow connection, or a screen reader.

## Gotchas

- **Symptom:** the whole component file is ignored, or applies in the wrong
  order. **Cause:** `@layer components` was reached before the order was
  declared, so `components` took the position of its first mention.
  **Fix:** declare the full order in the entry stylesheet, above every import.

- **Symptom:** a utility class no longer overrides a component rule.
  **Cause:** either layer order is wrong, or the utility is unlayered — and
  unlayered styles beat layered ones. **Fix:** keep utilities inside their
  layer and let the declared order decide.

- **Symptom:** an `!important` override in a component is beaten by one in the
  reset. **Cause:** `!important` inverts layer order, so earlier layers win.
  **Fix:** treat `!important` in early layers as effectively permanent, and
  avoid putting it there at all.

- **Symptom:** layers were adopted and selectors are still growing.
  **Cause:** specificity still decides *within* a layer; layers removed the
  cross-concern contests, not the intra-layer ones. **Fix:** keep component
  rules at a single class as a deliberate discipline.

- **Symptom:** the layout collapses to unstyled boxes in one build.
  **Cause:** the `tokens` layer did not load, and `var()` with no fallback
  resolves to the property's initial value. **Fix:** load the tokens — and treat
  the loud failure as the desired behaviour rather than something to paper over
  with fallbacks.

- **Symptom:** a spacing change landed in the token file and half the app did
  not move. **Cause:** `var()` fallbacks throughout the components, which
  silently forked the scale. **Fix:** fallbacks only for genuine parameters like
  `--card-ratio`, never for dependencies.

- **Symptom:** a token typo produces no error and no visible change.
  **Cause:** an unknown custom property makes the declaration invalid at
  computed-value time, which for an inherited property means it inherits and for
  others means the initial value. It never logs. **Fix:** this is why the token
  set is worth keeping small and named consistently; there is no compiler here.

- **Symptom:** the card was reused in another app and everything is subtly off.
  **Cause:** the tokens went with the copy and the layer order did not.
  **Fix:** the layer declaration is part of what a component depends on, even
  though the component file does not contain it.

## Interview questions

1. **★ Why must layer order be declared in the entry stylesheet rather than in
   each component file?** Because a layer's position is fixed by its **first**
   mention. If component files declare their own layers, the order depends on
   import order — which changes with the bundler, with a lazily-loaded route, or
   with a refactor. Declaring the complete order once, before any import, makes
   it a decision rather than an emergent property nobody owns.

2. **★ What happens to unlayered styles relative to layered ones?** Unlayered
   styles win. Anything outside `@layer` is treated as a higher-priority origin
   than every declared layer, so one stray unlayered rule beats a carefully
   ordered `utilities` layer. It is the most common surprise when introducing
   layers into an existing codebase, because the existing CSS is all unlayered.

3. **★ How does `!important` interact with layers?** It reverses them: an
   `!important` declaration in an earlier layer beats an `!important` in a later
   one. The rule is consistent with important declarations inverting the cascade
   generally, and the practical consequence is that `!important` in `reset` is
   nearly unbeatable — a good reason not to write it there.

4. **★ Do layers replace specificity?** No. Layers sort *before* specificity, so
   they settle contests between layers; within a layer, specificity and then
   source order still decide. Keeping component rules at a single class remains
   a discipline you have to maintain — layers make it *possible*, not automatic.

5. **★ Why does this stylesheet define no colours?** Because colour is theme
   state, not component state. Referring only to `--surface-2` and
   `--text-muted` means dark mode is a token swap in one place rather than a
   second copy of every component file, and it means the component stays correct
   when the palette changes.

6. **When should a custom property have a `var()` fallback and when should it
   not?** A fallback is right for a *parameter* — something the component
   publishes, expects to be absent, and has a sensible default for, like
   `--card-ratio`. It is wrong for a *dependency* like the spacing scale:
   fallbacks there create a second source of truth, and the fork stays invisible
   until someone changes the scale and only half the app moves.

7. **What happens when a `var()` references a token that does not exist?** The
   declaration becomes invalid at computed-value time: an inherited property
   takes the inherited value, everything else takes its initial value. There is
   no console error and no build failure, which is why a small, consistently
   named token set matters more here than in a language with a compiler.

8. **What belongs in a component's "contract"?** Everything a consumer must not
   remove: structural wrappers that exist for a mechanism rather than for
   styling, ARIA attributes repairing a side effect of the styling, HTML
   attributes doing work before CSS loads, and the tokens the component
   consumes. The common thread is that each looks like redundancy in isolation
   and each has a failure mode outside the happy path.

9. **A component was copied into another app and looks subtly wrong. What would
   you check first?** Whether the layer declaration came with it. The component
   file declares which layer it belongs to but not where that layer sits, so a
   copy that brings the tokens and not the order gets a different cascade —
   correct-looking in isolation and wrong in combination.

---

← Prev [The complete stylesheet](11-the-complete-stylesheet.md) ·
Back to [the topic index](README.md)
