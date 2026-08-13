---
title: "What CSS is"
sidebar_label: "01 · What CSS is"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex01-pipeline-and-cssom.mjs`.

**CSS is a declarative constraint language that the browser *resolves*.** You
describe the result you want; the engine decides the pixels. It never executes
top to bottom the way a program does, and that single fact explains most of what
feels arbitrary about it later.

## Declarations are resolved, not executed

A stylesheet is not a list of instructions. It is a set of claims about
elements, and the engine's job is to find, for every element and every property,
the one value that wins.

```html
<!doctype html>
<html>
<head>
<style>
  p { color: red; }
  p { color: green; }
</style>
</head>
<body><p>which one?</p></body>
</html>
```

Nothing "runs" here. Both rules match. The engine resolves the conflict — by
the cascade, covered properly in **Phase 2** — and the
paragraph is green. Reordering the file changes the answer; that is source
order, not execution order.

The practical consequence: **you cannot debug CSS by tracing.** There is no
call stack and no sequence of steps. You debug it by asking which rules matched
and which one won.

## Your stylesheet becomes an object model

The text you write is parsed into the **CSSOM** — a live object model, the
stylesheet equivalent of the DOM. Everything is queryable from script:

```js
// sandbox/css/ex01-pipeline-and-cssom.mjs
const sheet = document.styleSheets[0];
sheet.cssRules.length;              // how many rules survived parsing
sheet.cssRules[1].selectorText;     // '.card'
sheet.cssRules[2].conditionText;    // '(min-width: 400px)'
```

```console
$ node ex01-pipeline-and-cssom.mjs
engine: Firefox/153.0

=== document.styleSheets — the CSSOM ===
  sheetCount      1
  ruleCount       4
  ruleTypes       ["CSSStyleRule","CSSStyleRule","CSSMediaRule","CSSStyleRule"]
  firstSelector   .card
  mediaCondition  (min-width: 400px)
```

Note `ruleCount` is **4** for four authored rules — parsing kept all of them.
When a rule is malformed the count silently drops, which is the subject of
[page 05](./05-css-fails-silently.md).

## What you write is not what is stored

Parsing normalises. The engine does not keep your text; it keeps values.

```css
.card { color: #ff0000; padding: 1em 2em; border: 1px solid; }
```

```console
=== Declarations are normalised on parse, not stored verbatim ===
  authored #ff0000 reads back as     rgb(255, 0, 0)
  shorthand padding expands to       22
  longhands                          color,padding-top,padding-right,padding-bottom,
                                     padding-left,border-top-width,border-top-style,…
  border 1px solid reads back as     1px solid
  border-color with no author value  "currentcolor"
```

Three things worth noticing, all of which bite later:

1. **`#ff0000` came back as `rgb(255, 0, 0)`.** Colour notation is an authoring
   convenience; the engine stores a colour.
2. **`padding: 1em 2em` became four longhands**, and the whole rule holds **22**
   of them once `border` is expanded too. Shorthands are not stored as
   shorthands — this is why a later shorthand wipes properties you set
   individually (**Phase 2**).
3. **`border: 1px solid` filled in a colour you never wrote** — `currentcolor`.
   Every longhand always has a value, whether you supplied one or not.

## Declarative has a cost, and a payoff

**The payoff:** you never write the layout algorithm. `display: grid` with three
tracks handles any number of children, any content length, any viewport, in any
writing direction. The equivalent imperative code is enormous and would be wrong
at the edges.

**The cost:** when the result is wrong, the mechanism that produced it is not
visible in your file. The rule that broke your layout may be in a stylesheet you
did not write, and there is no stack trace pointing at it. That is the trade —
you give up traceability to get all that behaviour for free.

## Gotchas

**Symptom:** you change a declaration and nothing happens; you change it again
and it still does nothing.
**Cause:** you are editing a rule that never wins. Something else has higher
priority, so your value is resolved away every time.
**Fix:** stop editing and inspect. DevTools shows losing declarations struck
through ([page 12](./12-devtools-for-css.md)). Fix the conflict, not the value.

**Symptom:** you set `border-color` and it works, then you add `border: 1px solid`
above it and the colour disappears.
**Cause:** the shorthand writes *every* longhand it owns, including
`border-color`, which resets to `currentcolor` when you do not name it.
**Fix:** put the shorthand first and the longhand after it, or stop mixing the
two on the same element.

**Symptom:** JavaScript reads back a different colour than you wrote.
**Cause:** nothing is wrong. Values are normalised at parse time, so `#ff0000`
is stored and reported as `rgb(255, 0, 0)`.
**Fix:** compare computed values against computed values. Never string-compare
against your authored text.

## Interview questions

**★ Is CSS a programming language?**
It is a declarative language, not an imperative one. You state constraints and
the engine resolves them; there is no control flow, no execution order, and no
call stack. It is Turing-complete in contrived constructions, but that is a
curiosity — the useful answer is that you describe the outcome and the engine
computes it, which is why you debug it by asking "which rule won", not by
tracing steps.

**★ Two rules set `color` on the same element. Which wins, and why is that not
"the last one"?**
"Last one wins" is only the final tiebreak. The engine compares origin and
importance, then cascade layer, then specificity, and only then source order.
Two rules with identical selectors are decided by source order because
everything before it tied.

**What is the CSSOM?**
The object model a stylesheet is parsed into — `document.styleSheets`, each with
a `cssRules` list of typed rule objects. It is what the engine actually consults,
and it is live: mutate it from script and the page restyles.

**Why does `getComputedStyle` return `rgb(255, 0, 0)` when I wrote `#ff0000`?**
Because parsing normalises values into the engine's internal representation.
The authored text is not retained. The same is true of shorthands, which are
stored as their longhands.

**If CSS never executes, what does "the browser applies my stylesheet" mean?**
It means the engine matches selectors against elements, resolves the cascade
per property, computes values, and then lays out and paints. That resolution
happens for every element on every relevant change — see
[the rendering pipeline](./02-the-rendering-pipeline.md).

---

← [Phase index](./) · Next: [02 · The rendering pipeline](./02-the-rendering-pipeline.md) →
