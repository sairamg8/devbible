---
title: "The field-shape errors are the half of the catalogue with no trace to read — the headline names a field instead, and the number in the corner tells you whether anything was evaluated at all"
sidebar_label: "10i · The field-shape family"
sidebar_position: 10.8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/common/src/diagnostics.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/common/src/diagnostics.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/component/src/resources.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/resources.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts).
> Documentation-validated; **no sandbox run** — no build was executed. Every message quoted below is a string literal read from one of those files at that tag.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not.** Every number on this page is undaggered — all of them were read from a line of `error_code.ts` that assigns them.

**The decoder in [10](10-metadata-errors-one-by-one.md) taught you to read the trace, and this family has no trace. That is not a defect in the diagnostic and it is not something you can work around by looking harder: these errors are raised by *shape* checks on a named field, and a shape check has nothing to trace because either nothing was evaluated or the evaluation succeeded and produced the wrong kind of thing. What replaces the trace is the field name in the headline and the error number in the corner — and the number matters more here than anywhere else in the catalogue, because two completely different codes wear the same sentence shape. `templateUrl must be a string` is **NG1010**, is produced after the partial evaluator ran, and may carry a trace after all. `@Component is missing a template. Add either a template or templateUrl` is **NG2001**, is produced by a `has()` check, and never carries anything. Telling those two apart in the first two seconds is the whole skill this page teaches.**

## The family is defined by what is missing from it

Every other page in this catalogue routes you by the trace. [10c](10c-symbols-the-compiler-cannot-resolve.md) is "the trace names a symbol", [10e](10e-values-that-resolve-but-do-not-fold.md) is "the trace names a value", [10f](10f-destructuring-in-metadata.md) is "there is a binding pattern in the span". [10b](10b-the-decorator-argument-itself.md) is the other traceless family, and it is traceless for the reason stated there: both decorator gates throw before `evaluator.evaluate()` is ever called.

This family is traceless for **two** reasons, not one, and they lead to opposite fixes:

1. **Nothing was evaluated.** The compiler asked `component.has('template')`, or compared two keys, or ran a regular expression over an already-resolved string. There was never a `DynamicValue`, so `traceDynamicValue` was never called. These carry a real `NG2xxx` code.
2. **Evaluation succeeded and returned the wrong type.** `createValueHasWrongTypeError` was handed a plain JavaScript value — a number, `undefined`, an object — and took its third branch, which sets a chain sentence and leaves `relatedInformation` undefined. These carry **NG1010**.

Only when that same function is handed a `DynamicValue` does a trace appear. So the correct statement of the rule, which the one-line decoder row necessarily compresses, is: **an `NG2xxx` field-shape error never has a trace; an `NG1010` field-shape error has one exactly when the second sentence reads `Value could not be determined statically.`**

## Two codes, one sentence shape

The reason the family looks homogeneous is that one function writes most of its headlines. `annotations/common/src/diagnostics.ts`, the last line of `createValueHasWrongTypeError`, verbatim:

```ts
return new FatalDiagnosticError(ErrorCode.VALUE_HAS_WRONG_TYPE, node, chain, relatedInformation);
```

and from `error_code.ts`, verbatim:

```ts
VALUE_HAS_WRONG_TYPE = 1010,
VALUE_NOT_LITERAL = 1011,
```

So **every** `<field> must be a <type>` message in the compiler — there are more than twenty of them — is NG1010, regardless of which field it is about. The field name is written by the call site; the code is written by the helper. That is why you cannot route on the number alone and cannot route on the sentence alone; you need both.

| you see | code | evaluated first? | trace possible? |
|---|---|---|---|
| `template must be a string` | NG1010 | yes | yes, if `Value could not be determined statically.` |
| `templateUrl must be a string` | NG1010 | yes | same |
| `styleUrl must be a string` | NG1010 | yes | same |
| `styleUrls must be an array of strings` | NG1010 | yes | same |
| `preserveWhitespaces must be a boolean` | NG1010 | yes | same |
| `interpolation must be an array with 2 elements of string type` | NG1010 | yes | same |
| `@Component is missing a template. Add either a `template` or `templateUrl`` | NG2001 | **no** | **never** |
| `Could not find template file 'X'.` | NG2008 | the URL was, the file was not found | **never** |
| `Could not find stylesheet file 'X'.` | NG2008 | same | **never** |
| ``@Component cannot define both `styleUrl` and `styleUrls`.`` | NG2021 | **no** | **never** |

🔴 **The practical consequence, and it is the reason this page exists.** If you have an NG2xxx from this family, *there is nothing else to read* — the whole diagnostic is the sentence, the fix is in the sentence, and continuing to hunt for a cause is wasted time. If you have an NG1010, the second sentence is mandatory reading and the decoder in [10](10-metadata-errors-one-by-one.md) applies in full.

## What to read instead of the trace

Three questions, in order, and they resolve every member of the family:

1. **Which field is named in the headline?** Not which line the squiggle is on — the squiggle for `@Component is missing a template` lands on `decorator.node`, the whole `@Component(...)` call, and tells you nothing. The field name is the index into this page.
2. **Is there a second sentence beginning `Value `?** If yes, you are in NG1010 and the field's *value* is the problem. If no, you are in NG2xxx and the field's *presence, absence or combination* is the problem.
3. **If there is a second sentence, which of the three is it?** `Value could not be determined statically.` sends you to the trace and to [10c](10c-symbols-the-compiler-cannot-resolve.md)–[10f](10f-destructuring-in-metadata.md). `Value is a reference to 'X'.` and `Value is of type 'T'.` keep you here, because the evaluator did its job and the value is simply wrong.

## Where each member of the family lives

The family is too big for one page, and the split is by *which field*, because that is what the headline gives you.

| chunk | the fields it decodes |
|---|---|
| **this page** | `template`, `templateUrl`, and the two codes the whole family shares |
| [10ib · Resources that are not there](10ib-resources-that-are-not-there.md) | NG2008 — a template or stylesheet path that resolved to a file that does not exist |
| [10ic · Stylesheets and the scalar fields](10ic-stylesheets-and-the-scalar-fields.md) | `styleUrl`, `styleUrls`, `preserveWhitespaces`, `interpolation` |
| [10id · The `imports` family](10id-the-imports-family.md) | `imports`, `deferredImports`, and the `Module.forRoot()` message |
| [10ie · The standalone gates](10ie-the-standalone-gates.md) | `standalone`, `schemas`, `foreignImports`, and the selectorless pair |
| [10if · Selector shape](10if-selector-shape-and-the-missing-token.md) | `selector`, `exportAs`, and the ShadowDom check |
| [10ig · NG2003 and the sign of the enum](10ig-ng2003-and-the-sign-of-the-enum.md) | constructor parameters, and why only two `NG2xxx` codes are documented |

## `@Component is missing a template` — NG2001

**Symptom.** ``@Component is missing a template. Add either a `template` or `templateUrl``, squiggle on the entire decorator.

**Cause.** The final `else` of `parseTemplateDeclaration` in `annotations/component/src/resources.ts`, verbatim:

```ts
  } else {
    throw new FatalDiagnosticError(
      ErrorCode.COMPONENT_MISSING_TEMPLATE,
      decorator.node,
      '@Component is missing a template. Add either a `template` or `templateUrl`',
    );
  }
```

Read the branch order above it and one thing falls out that the message does not say: the check is `component.has('templateUrl')` first, `component.has('template')` second. **`has` is a key test, not a value test.** `template: undefined` therefore satisfies it and takes you into the inline branch, where the evaluator resolves `undefined`, the `typeof` check fails, and you get `template must be a string` → `Value is of type 'undefined'.` instead. Two different errors for what a reader thinks of as the same mistake, decided purely by whether the key is written.

**Fix.** Add the key, and know which one you want — they compile identically ([01](01-the-template-is-a-separate-language.md)) but differ in how errors inside the template are reported later ([17](17-the-filename-in-the-error.md)):

```ts
import {Component} from '@angular/core';

// ⛔ NG2001 — no `template` key and no `templateUrl` key.
// @Component({selector: 'acme-empty'})
// export class EmptyCard {}

// ✅ inline, and the template's own errors will point at these bytes.
@Component({
  selector: 'acme-inline-card',
  template: `<h2 class="title">{{ title }}</h2>`,
})
export class InlineCard {
  protected readonly title = 'Invoice';
}
```

## `template must be a string` — NG1010, and the cost of getting past it

**Symptom.** `template must be a string`, second sentence one of the three.

**Cause.** `extractTemplate` has two paths. A string literal is read straight out of the source file by byte range. Anything else is handed to the evaluator, and `annotations/component/src/resources.ts` then does, verbatim:

```ts
      if (typeof resolvedTemplate !== 'string') {
        throw createValueHasWrongTypeError(
          template.expression,
          resolvedTemplate,
          'template must be a string',
        );
      }
```

🔴 **The interesting case is not the failure, it is the success.** A non-literal `template` that *does* fold is accepted — and quietly downgraded. Same file, verbatim comment:

```ts
      // Indirect templates cannot be mapped to a particular byte range of any input file, since
      // they're computed by expressions that may span many files. Don't attempt to map them back
      // to a given file.
```

The source mapping becomes `'indirect'` and `sourceMapUrl` becomes `null`. Every template type-check error in that component then reports against a synthetic name rather than against your file ([17](17-the-filename-in-the-error.md)). So `template: SHARED_TEMPLATE` is a working construct that costs you every future diagnostic in the template.

**Fix.** Inline the literal, or move it to `templateUrl` — the two forms that keep a direct mapping:

```ts
import {Component} from '@angular/core';

export const ROW_TEMPLATE = `<td class="cell">{{ label }}</td>`;

// ⚠️ compiles, and every template error in it now reports against a synthetic file name.
@Component({
  selector: 'acme-row-indirect',
  template: ROW_TEMPLATE,
})
export class RowIndirect {
  protected readonly label = 'Total';
}

// ✅ direct mapping: errors point at these bytes.
@Component({
  selector: 'acme-row',
  template: `<td class="cell">{{ label }}</td>`,
})
export class Row {
  protected readonly label = 'Total';
}
```

## `templateUrl must be a string` — NG1010, raised from two places

**Symptom.** `templateUrl must be a string`.

**Cause.** Verbatim, and identically worded at both sites — `parseTemplateDeclaration` and `preloadAndParseTemplate`:

```ts
    const templateUrlExpr = component.get('templateUrl')!;
    const templateUrl = evaluator.evaluate(templateUrlExpr);
    if (typeof templateUrl !== 'string') {
      throw createValueHasWrongTypeError(
        templateUrlExpr,
        templateUrl,
        'templateUrl must be a string',
      );
    }
```

The duplication matters for one reason only: `preloadAndParseTemplate` runs during the **async pre-analysis** phase, before the synchronous analysis. A tool that only drives the synchronous path and a tool that drives both will surface the same message from different points in the build, so do not read the position of this error in a build log as information about the phase.

**Fix.** `templateUrl` accepts any expression that folds to a string, exactly like `selector` ([09e](09e-selector-must-reduce-to-a-string.md)) — but see the gotcha below before you reach for a constant:

```ts
import {Component} from '@angular/core';

// ⛔ folds to `undefined`: `templateUrl must be a string` → `Value is of type 'undefined'.`
// export let ROW_URL: string;

// ✅ folds to a string.
export const ROW_URL = './invoice-row.html';

@Component({
  selector: 'acme-invoice-row',
  templateUrl: ROW_URL,
})
export class InvoiceRow {}
```

## Gotchas

**★ Symptom: `template must be a string` and the second line says `Value is of type 'undefined'.` on a component whose `template` key you can see.** Cause: `component.has('template')` is a key test. Writing `template: undefined` — from an optional field on a shared config object, or from a spread whose source lacks the key — passes the presence check and then fails the type check. Fix: do not let the key exist with no value. Build the metadata so the key is either present with a string or absent entirely:

```ts
import {Component} from '@angular/core';

interface CardDefaults {
  readonly changeDetection?: undefined;
}

// ⛔ `template: SHARED.template` where SHARED has no `template` key spreads
// an `undefined` into a key that then exists. NG1010, not NG2001.

// ✅ the key is written literally at each component, so it is always a string.
@Component({
  selector: 'acme-card',
  template: `<ng-content />`,
})
export class Card {}
```

**★ Symptom: you moved a template into a shared constant to deduplicate it, everything compiles, and template errors in that component now report a file name you do not recognise.** Cause: a non-literal `template` produces an `'indirect'` source mapping with `sourceMapUrl = null`, by design and with a comment saying so. Fix: put the shared markup in a `.html` file and use `templateUrl`, which keeps a resolvable file:

```ts
import {Component} from '@angular/core';

// ✅ shared markup, direct file mapping, real file name in every error.
@Component({
  selector: 'acme-shared-row',
  templateUrl: './shared-row.html',
})
export class SharedRow {}
```

**★ Symptom: an NG2xxx from this family and you keep looking for a related-information note.** Cause: there is none and there never will be — these are raised by presence, absence and combination checks that run without evaluating anything. Fix: read the sentence as the complete diagnostic. NG2001 and NG2021 both contain their own fix in the message text, which is not true of most of the compiler.

**Symptom: `templateUrl must be a string` appearing at a different point in two different tools' output.** Cause: the identical check exists in both `parseTemplateDeclaration` (synchronous analysis) and `preloadAndParseTemplate` (async pre-analysis), so which phase reports it depends on how the host drives the compiler. Fix: nothing — but do not infer anything about your build from where in the log it lands.

## Interview questions

**★ An Angular metadata error has no related-information notes. Name the two entirely different situations that produces, and how you tell them apart.**
Either the error was raised before the partial evaluator ran, or it was raised after the evaluator ran successfully and returned a value of the wrong type. The first is a decorator gate ([10b](10b-the-decorator-argument-itself.md)) or a field-shape check with a real `NG2xxx` code; the second is `createValueHasWrongTypeError` taking its `else` branch, which sets a chain sentence and leaves `relatedInformation` undefined, and always carries NG1010. You tell them apart by the second sentence: `Value is of type 'undefined'.` or `Value is a reference to 'X'.` means evaluation happened and succeeded, and no amount of making the expression "more static" will help. No second sentence at all means nothing was evaluated and the fix is structural.

**★ `@Component({selector: 'x'})` with no template at all, and `@Component({selector: 'x', template: undefined})`. Same mistake to a reader — do they produce the same error?**
No, and the difference is instructive. The compiler branches on `component.has('templateUrl')` then `component.has('template')`, and `has` is a key test. With no key at all you fall to the final `else` and get NG2001, ``@Component is missing a template. Add either a `template` or `templateUrl``, thrown against the whole decorator node. With the key present and holding `undefined`, you enter the inline branch, the evaluator resolves `undefined` perfectly successfully, the `typeof` check fails, and you get NG1010 `template must be a string` with the second sentence `Value is of type 'undefined'.` — a completely different code, a different span, and a message that sounds like a static-analysis problem when nothing failed to analyse. The practical form of this is a spread from a config object that does not carry the key.


**★ What does a non-literal `template` cost you, given that it compiles?**
The source mapping. A string-literal template is read out of the `.ts` file by byte range and gets a `'direct'` mapping; anything else is evaluated and gets an `'indirect'` one with `sourceMapUrl` set to `null`, under a comment saying indirect templates cannot be mapped to a byte range of any input file because they may be computed across many files. The compilation is correct either way. What you lose is every future template diagnostic's ability to point at your source, so type errors in that template report against a synthetic name instead ([17](17-the-filename-in-the-error.md)). It is a diagnostics regression bought with a deduplication, and the trade is almost never worth it — `templateUrl` gives you the sharing without the cost.


**A tool reports `NG1010` for six different fields in one component. Is that one bug or six?**
Six, potentially. NG1010 is `VALUE_HAS_WRONG_TYPE` and it is written by one helper, `createValueHasWrongTypeError`, which every field-shape call site funnels through; the field name lives in the message text, not in the code. So the number carries no information about which field failed and grouping by code groups unrelated problems. Any lint suppression, CI filter or error-budget dashboard keyed on NG1010 is keyed on "some metadata field somewhere had the wrong type", which is almost the same as no filter at all. Filter on the message text.

← Prev: [Where the chain surprises you](10hf-where-the-chain-surprises-you.md) · Index: [Topic index](README.md) · Next → [Resources that are not there](10ib-resources-that-are-not-there.md)
