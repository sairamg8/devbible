---
title: "The stylesheet keys are the only place the compiler refuses to choose between two valid spellings, and the reason `styleUrls` names the guilty element while `imports` cannot is a three-line difference in how each one walks an array"
sidebar_label: "10ic · Stylesheets and the scalar fields"
sidebar_position: 10.82
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/annotations/component/src/resources.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/resources.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/component/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/util.ts),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts).
> Documentation-validated; **no sandbox run**. Every message quoted below is a string literal read from one of those files at that tag.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not.** Every number on this page is undaggered — all were read from a line of `error_code.ts` that assigns them.

**[10i](10i-the-field-shape-family.md) established the shape of the family: a headline naming a field, no trace, and a code that tells you whether anything was evaluated. This chunk is the second half of the resource fields — the stylesheet keys and the two small scalar fields that ride in the same function — and it exists separately because they carry the family's three sharpest edges. `styleUrl` and `styleUrls` produce the only error in the compiler that fires purely because two keys are both *present*, with no regard for what either holds. `styleUrls` walks a spread element and reports the guilty entry, while `imports` refuses to, for a reason that is three lines of source. And `interpolation` is evaluated, shape-checked with the most specific message in the whole compiler, and then — in the function that checks it — the value is discarded.**

## The two-stylesheet-keys error — NG2021

**Symptom.** ``@Component cannot define both `styleUrl` and `styleUrls`. Use `styleUrl` if the component has one stylesheet, or `styleUrls` if it has multiple``, squiggle on the `styleUrl` expression.

**Cause.** A pure presence check, run before either value is evaluated. `annotations/component/src/resources.ts`, verbatim:

```ts
  const styleUrlsExpr = component.get('styleUrls');
  const styleUrlExpr = component.get('styleUrl');

  if (styleUrlsExpr !== undefined && styleUrlExpr !== undefined) {
    throw new FatalDiagnosticError(
      ErrorCode.COMPONENT_INVALID_STYLE_URLS,
      styleUrlExpr,
      '@Component cannot define both `styleUrl` and `styleUrls`. ' +
        'Use `styleUrl` if the component has one stylesheet, or `styleUrls` if it has multiple',
    );
  }
```

and from `error_code.ts`, verbatim, doc comment included:

```ts
  /** Raised when a component has both `styleUrls` and `styleUrl`. */
  COMPONENT_INVALID_STYLE_URLS = 2021,
```

This is the purest member of the family: two `get` calls, a comparison, a throw. No evaluator, no value, no trace, and no possible second sentence. It is also the one most likely to arrive from a codemod or a merge, because both keys are individually valid and a three-way merge will happily keep both.

🔴 **It throws before either expression is evaluated,** which has a consequence people find surprising: if your `styleUrls` array would *also* have failed — a non-string entry, an unresolvable constant — you will not hear about it until you delete one of the two keys. Fix NG2021, rebuild, get NG1010. That is not the compiler moving the goalposts; it is a gate in front of a check.

**Fix.** Pick one. There is no precedence rule — the compiler refuses rather than choosing:

```ts
import {Component} from '@angular/core';

// ⛔ NG2021 — both keys present, even though `styleUrls` is empty.
// @Component({
//   selector: 'acme-panel-bad',
//   template: `<ng-content />`,
//   styleUrl: './panel.css',
//   styleUrls: [],
// })
// export class PanelBad {}

// ✅ one stylesheet.
@Component({
  selector: 'acme-panel',
  template: `<ng-content />`,
  styleUrl: './panel.css',
})
export class Panel {}

// ✅ several.
@Component({
  selector: 'acme-panel-themed',
  template: `<ng-content />`,
  styleUrls: ['./panel.css', './panel-theme.css'],
})
export class PanelThemed {}
```

⚠️ Note `styleUrls: []` in the rejected example. The check is on the *key*, so an empty array still triggers it — and so does `styleUrls: undefined`.

## `styleUrl must be a string` and `styleUrls must be an array of strings` — NG1010

**Symptom.** Either message, with one of the three chain sentences from [10](10-metadata-errors-one-by-one.md) underneath.

**Cause.** Three call sites, and the third is where the interesting behaviour lives. The scalar form, verbatim:

```ts
  if (styleUrlExpr !== undefined) {
    const styleUrl = evaluator.evaluate(styleUrlExpr);

    if (typeof styleUrl !== 'string') {
      throw createValueHasWrongTypeError(styleUrlExpr, styleUrl, 'styleUrl must be a string');
    }
```

The array form, verbatim, and note that it walks the array **syntactically** when it can — and that the message it raises per element is the *singular* `styleUrl must be a string`, not the plural:

```ts
  if (ts.isArrayLiteralExpression(styleUrlsExpr)) {
    for (const styleUrlExpr of styleUrlsExpr.elements) {
      if (ts.isSpreadElement(styleUrlExpr)) {
        styleUrls.push(...extractStyleUrlsFromExpression(evaluator, styleUrlExpr.expression));
      } else {
        const styleUrl = evaluator.evaluate(styleUrlExpr);

        if (typeof styleUrl !== 'string') {
          throw createValueHasWrongTypeError(styleUrlExpr, styleUrl, 'styleUrl must be a string');
        }
```

and only when the whole thing is *not* a literal array does it fall back to evaluating the expression as a unit:

```ts
    const evaluatedStyleUrls = evaluator.evaluate(styleUrlsExpr);
    if (!isStringArray(evaluatedStyleUrls)) {
      throw createValueHasWrongTypeError(
        styleUrlsExpr,
        evaluatedStyleUrls,
        'styleUrls must be an array of strings',
      );
    }
```

**So the plural message is itself a diagnostic about your syntax, not just about your values.** `styleUrl must be a string` means the compiler was walking elements and found one it disliked; `styleUrls must be an array of strings` means it never got to walk anything, because you did not hand it a literal array. Two messages, two entirely different search targets.

## Why `styleUrls` names the element and `imports` does not

🔴 **`styleUrls` recurses through a spread element. `imports` explicitly gives up on one.** From `annotations/component/src/util.ts`, `validateAndFlattenComponentImports`, verbatim:

```ts
    let refExpr = expr;
    if (
      ts.isArrayLiteralExpression(expr) &&
      expr.elements.length === imports.length &&
      !expr.elements.some(ts.isSpreadAssignment)
    ) {
      refExpr = expr.elements[i];
    }
```

The difference is where each one does its walking. `extractStyleUrlsFromExpression` walks the **syntax tree** — it iterates `styleUrlsExpr.elements` and calls itself on a spread's operand, so at every point it is holding one expression and can attach a diagnostic to it. `validateAndFlattenComponentImports` walks the **resolved array** and then tries to find the corresponding source element by index, which is only sound when the counts line up; a spread makes one source element become many resolved values and the correspondence collapses.

Two array-valued fields on the same decorator, two different designs, and the only externally visible difference is where the squiggle lands. There is no single "Angular rule about arrays in metadata" — there are per-field implementations, and this is the cleanest pair to compare them on. The `imports` consequences are in [09f](09f-imports-and-the-rule-about-lazy-loading.md) and [10id · The `imports` family](10id-the-imports-family.md).

**Fix.** Which message you got tells you which branch you were in:

```ts
import {Component} from '@angular/core';

export const THEME_SHEETS = ['./theme-light.css', './theme-dark.css'];

// ✅ literal array with a spread — walked element by element, spread recursed into,
// and a bad entry is reported on that entry.
@Component({
  selector: 'acme-themed-card',
  template: `<ng-content />`,
  styleUrls: [...THEME_SHEETS, './card.css'],
})
export class ThemedCard {}

// ⚠️ not a literal array — evaluated as a unit, so a single bad entry reports
// `styleUrls must be an array of strings` against the whole expression.
@Component({
  selector: 'acme-themed-card-opaque',
  template: `<ng-content />`,
  styleUrls: THEME_SHEETS,
})
export class ThemedCardOpaque {}
```

## `preserveWhitespaces must be a boolean` — NG1010

Two lines of check, and one thing worth saying about it: this is one of the very few metadata fields whose *default* is a compiler option rather than a constant. The parameter is `defaultPreserveWhitespaces`, and the field overrides it. Verbatim:

```ts
  let preserveWhitespaces: boolean = defaultPreserveWhitespaces;
  if (component.has('preserveWhitespaces')) {
    const expr = component.get('preserveWhitespaces')!;
    const value = evaluator.evaluate(expr);
    if (typeof value !== 'boolean') {
      throw createValueHasWrongTypeError(expr, value, 'preserveWhitespaces must be a boolean');
    }
    preserveWhitespaces = value;
  }
```

`typeof value !== 'boolean'` is a check on the *resolved* value, so `preserveWhitespaces: 'true'` fails with `Value is of type 'string'.` and `preserveWhitespaces: 1` fails with `Value is of type 'number'.` TypeScript will normally have complained first — but it will not have, if the value arrived through a spread from a loosely-typed config object, which is precisely the shape [10b](10b-the-decorator-argument-itself.md) recommends for sharing metadata.

## `interpolation must be an array with 2 elements of string type` — NG1010

The most specific message in the family, and the only one that names three failure conditions in one sentence. Verbatim:

```ts
  if (component.has('interpolation')) {
    const expr = component.get('interpolation')!;
    const value = evaluator.evaluate(expr);
    if (
      !Array.isArray(value) ||
      value.length !== 2 ||
      !value.every((element) => typeof element === 'string')
    ) {
      throw createValueHasWrongTypeError(
        expr,
        value,
        'interpolation must be an array with 2 elements of string type',
      );
    }
  }
```

Not an array, wrong length, or an element that is not a string — three conditions, one message. And `every` runs on **resolved** values, so an element that came back as a `DynamicValue` or a `Reference` fails the same test as a number does. That is the case where this NG1010 *does* carry a trace, and the second sentence is how you know: `Value could not be determined statically.` sends you back to the decoder.

⚠️ **A source-read observation I could not settle, stated as uncertain.** In `parseTemplateDeclaration` the resolved `interpolation` value is validated and then **not assigned to anything** — the function's returned `TemplateDeclaration` carries `isInline`, `preserveWhitespaces`, `templateUrl` and the resolved URL, and no interpolation config. The string `interpolation` does not appear in `annotations/component/src/handler.ts` at `v22.1.5` at all. Whether the value is read somewhere else in the pipeline was **not established by the files read for this page.** Do not conclude from this that custom delimiters are ignored in v22 — conclude only that the check you are failing is a validation performed in a function that discards its result, and that if you need to know whether the option still has an effect, that is a separate source read.

## Gotchas

**★ Symptom: `@Component cannot define both `styleUrl` and `styleUrls`` after a merge, you empty one of them, and it persists.** Cause: you removed the *value*, not the *key*. The check is `component.get('styleUrls') !== undefined`, which is true for `styleUrls: []` and true for `styleUrls: undefined`. Fix: delete the whole property:

```ts
import {Component} from '@angular/core';

// ⛔ still NG2021
// @Component({selector: 'acme-b-bad', template: `<span></span>`, styleUrl: './x.css', styleUrls: []})

// ✅
@Component({selector: 'acme-b', template: `<span></span>`, styleUrl: './x.css'})
export class B {}
```

**★ Symptom: you fix NG2021, rebuild, and immediately get `styleUrl must be a string` from the same component.** Cause: NG2021 is a gate that throws before either expression is evaluated, so the second problem was invisible while the first existed. Fix: expect it. This is the same "one error at a time" shape as the trace de-duplication in [10](10-metadata-errors-one-by-one.md), arrived at by a completely different mechanism — there, one entry per statement; here, an early `throw` in front of the evaluator.

**★ Symptom: `styleUrls must be an array of strings` on something that is very obviously an array of strings.** Cause: it is not an array *literal at the decorator*. The compiler tested `ts.isArrayLiteralExpression(styleUrlsExpr)` on the expression you wrote, found an identifier, and evaluated the whole thing as a unit; one element that did not fold collapses the result. Fix: write the array literally at the decorator, spreading the shared constant into it — you keep the sharing and get per-element diagnostics back:

```ts
import {Component} from '@angular/core';

export const THEME_SHEETS = ['./theme-light.css', './theme-dark.css'];

// ✅ literal array node, so the elements are walked one at a time.
@Component({
  selector: 'acme-card-themed',
  template: `<ng-content />`,
  styleUrls: [...THEME_SHEETS],
})
export class CardThemed {}
```

**★ Symptom: `preserveWhitespaces must be a boolean` and TypeScript never complained.** Cause: the value reached the decorator through a spread from an object whose declared type is loose — `Record<string, unknown>`, an inferred type from JSON, or a config helper. The Angular check is a runtime `typeof` on the resolved value and does not care what TypeScript believed. Fix: type the shared constant, which puts the error where you can act on it:

```ts
import {Component} from '@angular/core';

interface ComponentDefaults {
  readonly preserveWhitespaces: boolean;
}

// The type check happens here, on a plain constant, before Angular sees anything.
export const COMPONENT_DEFAULTS: ComponentDefaults = {
  preserveWhitespaces: false,
};

@Component({
  ...COMPONENT_DEFAULTS,
  selector: 'acme-tight',
  template: `<ng-content />`,
})
export class Tight {}
```

**Symptom: `interpolation must be an array with 2 elements of string type` on an array that visibly contains two strings.** Cause: one of the two did not fold to a string. `value.every((element) => typeof element === 'string')` runs on resolved values, so an entry that came back as a `DynamicValue` fails identically to a number. Fix: read the second sentence — `Value could not be determined statically.` means this NG1010 has a trace after all, and the decoder applies.

**Symptom: a per-element error inside `styleUrls` says `styleUrl` singular and you go looking for a `styleUrl` key you never wrote.** Cause: the per-element check inside the array branch reuses the scalar message verbatim. There is no `styleUrl` key on your component; the compiler is describing one element of `styleUrls`. Fix: read the span, not the noun — the squiggle is on the element.

## Interview questions

**★ Why can `styleUrls: [...SHEETS, './card.css']` report a precise element while `imports: [...SHARED, Card]` cannot?**
Because they are validated by different code with different tolerances for a spread. `extractStyleUrlsFromExpression` walks the **syntax**: it iterates the array literal's elements, tests each for `ts.isSpreadElement`, and recurses into the spread's operand — so at every moment it holds one expression and can attach a diagnostic to it. `validateAndFlattenComponentImports` walks the **resolved array** and then tries to recover the corresponding source element by index, which it only permits when the expression is a literal array, its element count equals the resolved import count, and it contains no spread. A spread turns one source element into many resolved values and destroys the correspondence, so the diagnostic falls back to the whole `imports:` expression. Both designs are defensible; the point is that there is no single Angular rule about arrays in metadata, only per-field implementations.

**★ NG2021 is raised by comparing two keys and throwing. What does that tell you about the order of checks in the component handler, and what does it predict about your next build?**
That presence checks run ahead of value checks, and that a `throw` of a `FatalDiagnosticError` ends the analysis of that component right there. So NG2021 hides every subsequent problem in the same component — including problems in the very arrays it is complaining about. It predicts that fixing it will not produce a clean build but the *next* error, which is a completely different message with a different code. Recognising that pattern is what stops the "I fix one thing and another appears" reading, which people interpret as the compiler being unhelpful when it is a gate doing exactly its job.

**★ You get `styleUrl must be a string` but your component has no `styleUrl` key. Explain.**
The per-element check inside the `styleUrls` array branch reuses the singular message verbatim: `createValueHasWrongTypeError(styleUrlExpr, styleUrl, 'styleUrl must be a string')` where `styleUrlExpr` is one element of the array. So the message names the conceptual thing being checked — a single stylesheet URL — not the key you wrote. The span is the authority: it is on the element. This is a small instance of a general rule for reading Angular diagnostics, which is that the headline is generated from the call site's idea of what it is validating, and the node is generated from where it actually is.

**Given `preserveWhitespaces` defaults from a compiler option and `styleUrl` does not, what does the compiler treat as "configuration" versus "metadata"?**
`parseTemplateDeclaration` takes `defaultPreserveWhitespaces` as a parameter and only overrides it when the decorator has the key, so the field is a per-component override of a project-wide setting. `styleUrl` has no project-wide analogue; it is pure per-component metadata. The distinction shows up in the failure modes: a project setting that is wrong is wrong everywhere at once and shows up as a behavioural difference rather than an error, while a metadata field that is wrong produces one diagnostic at one component. When you are debugging whitespace differences between two builds of the same source, that is the first place to look, and it is not in the decorator.

**The compiler validates `interpolation` and, in the function that validates it, discards the result. How should you present that on a reference page?**
As exactly what it is, and no further. The source read establishes two things: the validation exists and produces a very specific message, and within `parseTemplateDeclaration` the value is not carried into the returned declaration. It does **not** establish that the value is unused by the compiler as a whole — that would need a wider read than the files this page was written from. The honest form is to state the check, state the observation, and say the wider question was not settled. A page that promotes "not used in this function" to "custom delimiters do not work in v22" would be a confident invention, and it is the exact failure mode this corpus's evidence rules exist to prevent.

{/* FOOTER */}
