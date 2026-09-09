---
title: "`standalone` is the only field whose errors are gates rather than complaints — three of them poison the component before its template is ever checked, and in local compilation mode the whole block is skipped, so a library can ship a mistake its own build could not see"
sidebar_label: "10ie · The standalone gates"
sidebar_position: 10.84
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/component/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/util.ts),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts).
> Documentation-validated; **no sandbox run**. Every message quoted below is a string literal read from one of those files at that tag.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not.** Every number on this page is undaggered — all were read from a line of `error_code.ts` that assigns them.

**[10id](10id-the-imports-family.md) decoded the messages about what is *inside* the `imports` array. This chunk is about the checks that surround it — whether the component is allowed to have the field at all. They read like more of the same and they behave completely differently: three of them set `isPoisoned = true`, which strips the component of its dependency scope and turns one mistake into a page of unrelated template errors, and the whole block sits behind a `compilationMode !== CompilationMode.LOCAL` guard, so in local compilation mode not one of them can fire. That combination — a check that cascades when it runs, and does not run at all under one common build mode — is why `standalone` errors are the ones that arrive late, arrive in bulk, and arrive in somebody else's build.**

## `'imports' is only valid on a component that is standalone.` — NG2010, and what it does next

**Symptom.** The message above, with a related note reading `Did you forget to add 'standalone: true' to this @Component?` pointing at the class name.

**Cause.** `annotations/component/src/handler.ts`, verbatim, and note that the field name in the message is computed:

```ts
      const importsField = rawImports
        ? 'imports'
        : rawDeferredImports
          ? 'deferredImports'
          : 'foreignImports';
      diagnostics.push(
        makeDiagnostic(
          ErrorCode.COMPONENT_NOT_STANDALONE,
          component.get(importsField)!,
          `'${importsField}' is only valid on a component that is standalone.`,
          [
            makeRelatedInformation(
              node.name,
              `Did you forget to add 'standalone: true' to this @Component?`,
            ),
          ],
        ),
      );
      // Poison the component so that we don't spam further template type-checking errors that
      // result from misconfigured imports.
      isPoisoned = true;
```

`'schemas'` gets its own copy of the same code and sentence, without the related note:

```ts
        makeDiagnostic(
          ErrorCode.COMPONENT_NOT_STANDALONE,
          component.get('schemas')!,
          `'schemas' is only valid on a component that is standalone.`,
        ),
```

🔴 **`isPoisoned = true` is the consequential half and the message says nothing about it.** A poisoned component has no dependency scope, so every element in its template that would have matched a component is now unknown, every input binding is unrecognised, and the type-check block is built against nothing. The marker exists to *suppress* that cascade, and when you still see one, only the first diagnostic in the file is worth reading. The related note is the fix; everything after it in the log is downstream of an empty scope.

**Fix.** In v22, `standalone` defaults to `true` — so this error means someone wrote `standalone: false` explicitly, or the file predates the default flipping. Delete the flag rather than adding one:

```ts
import {Component} from '@angular/core';
import {CurrencyBadge} from './currency-badge';

// ⛔ NG2010 — `standalone: false` with an `imports` array.
// @Component({
//   selector: 'acme-total-bad',
//   standalone: false,
//   imports: [CurrencyBadge],
//   template: `<currency-badge />`,
// })
// export class TotalBad {}

// ✅ the flag is gone; v22 defaults to standalone.
@Component({
  selector: 'acme-total',
  imports: [CurrencyBadge],
  template: `<currency-badge />`,
})
export class Total {}
```

## `standalone flag must be a boolean` — NG1010

**Symptom.** `standalone flag must be a boolean`, with a chain sentence. Note the wording: `standalone flag`, not `standalone`, and it is the only field in the decorator whose message names it as a *flag*.

**Cause.** `annotations/directive/src/shared.ts`, verbatim, with the `strictStandalone` check that immediately follows it:

```ts
  if (directive.has('standalone')) {
    const expr = directive.get('standalone')!;
    const resolved = evaluator.evaluate(expr);
    if (typeof resolved !== 'boolean') {
      throw createValueHasWrongTypeError(expr, resolved, `standalone flag must be a boolean`);
    }
    isStandalone = resolved;

    if (!isStandalone && strictStandalone) {
      diagnostics = [
        makeDiagnostic(
          ErrorCode.NON_STANDALONE_NOT_ALLOWED,
          expr,
          `Only standalone components/directives are allowed when 'strictStandalone' is enabled.`,
        ),
      ];
    }
  }
```

Two facts fall out of the order. The `standalone` value is **evaluated**, so `standalone: IS_LEGACY` folds and works, and `standalone: process.env.LEGACY === '1'` does not ([09c](09c-the-partial-evaluator-is-the-grammar.md)). And `NG2023` is checked only inside the `has('standalone')` branch — a component that simply omits the flag takes `implicitStandaloneValue` and never reaches the `strictStandalone` check at all, which is exactly right, because omitting the flag in v22 *is* standalone.

`error_code.ts`, verbatim:

```ts
  /**
   * Raised when a `standalone: false` component is declared but `strictStandalone` is set.
   */
  NON_STANDALONE_NOT_ALLOWED = 2023,
```

## The selectorless pair — NG2010 and NG2026

Two more messages guard the v22 selectorless mode, and both are about `imports`. Verbatim from `annotations/component/src/handler.ts`:

```ts
    if (selectorlessEnabled) {
      if (!metadata.isStandalone) {
        isPoisoned = true;
        diagnostics ??= [];
        diagnostics.push(
          makeDiagnostic(
            ErrorCode.COMPONENT_NOT_STANDALONE,
            component.get('standalone') || node.name,
            `Cannot use selectorless with a component that is not standalone`,
          ),
        );
      } else if (rawImports || rawDeferredImports) {
        isPoisoned = true;
        diagnostics ??= [];
        diagnostics.push(
          makeDiagnostic(
            ErrorCode.UNSUPPORTED_SELECTORLESS_COMPONENT_FIELD,
            (rawImports || rawDeferredImports)!,
            `Cannot use the "${rawImports === null ? 'deferredImports' : 'imports'}" field in a selectorless component`,
          ),
        );
      }
    }
```

Note the direction of the second one: in a selectorless component `imports` is not merely unnecessary, it is **rejected**. Selectorless templates reference their dependencies by name in the template itself, so a dependency list would be a second, contradictory source of truth. `error_code.ts` describes the code as *"Raised for `@Component` fields that aren't supported in a selectorless context"* — a category, not a single field, so expect this code on other fields as the mode grows.

## `foreignImports` — four messages nobody has hit yet

`v22.1.5` carries a `foreignImports` field with its own validator and four messages, all NG1010. Verbatim from `annotations/component/src/util.ts`:

```ts
        `'foreignImports' must be an array of foreign imports, e.g. 'foreignImports: [myImport(MyComponent)]'.`
        `Each foreign import must be a call expression, e.g. 'myImport(MyComponent)'.`
        `The foreign import function must be a simple identifier, e.g. 'myImport(MyComponent)'.`
        `Foreign import calls must receive exactly one argument, e.g. 'myImport(MyComponent)'.`
        `The component reference passed to the foreign import must be a simple identifier, e.g. 'myImport(MyComponent)'.`
```

⚠️ **What this field is for is not established by the source read for this page.** `extractForeignImportsFromAst` is unusual in that it works **entirely on the AST** — it never calls the evaluator, testing `ts.isArrayLiteralExpression`, `ts.isCallExpression` and `ts.isIdentifier` directly — which is why every one of its messages carries an `e.g.` showing the exact accepted spelling. That much is read from source. The feature's purpose, stability and documentation status were not, so treat the messages as a decoder entry and nothing more. It shares the NG2010 not-standalone gate with `imports` and `deferredImports`, per the `importsField` ternary above.

## Local compilation mode raises none of it

🔴 **The single most surprising fact on this page.** The entire `imports` validation is inside a mode check. Verbatim:

```ts
      if (this.compilationMode !== CompilationMode.LOCAL && (rawImports || rawDeferredImports)) {
```

In `compilationMode: 'experimental-local'` the evaluator is never asked to resolve `imports`, `validateAndFlattenComponentImports` is never called, and **not one of the eight messages above can fire.** The same is true of `schemas`, which has its own `this.compilationMode !== CompilationMode.LOCAL` guard on the same page of source.

That is by design — local compilation deliberately refuses to look outside the current file — but the consequence for a team is sharp: a library built in local/partial mode and an application built in full mode apply different amounts of this page. An `imports` mistake that a library's own build cannot see becomes the consuming application's error. Where the compiler runs and in which mode is [13d](13d-compilation-mode-and-the-local-portability-trap.md).


## Gotchas

**★ Symptom: one `imports` mistake produces a page of unrelated template errors — unknown elements, unknown properties, unknown pipes.** Cause: the component was poisoned. The compiler's own comment says the marker exists so that it does *not* spam further template type-checking errors, so a cascade you can still see is the tail that escaped it. Fix: fix the first diagnostic in the file and rebuild; do not chase the rest. If the first one is `'imports' is only valid on a component that is standalone.`, the fix is deleting `standalone: false`.

**★ Symptom: a library compiles clean and the application consuming it reports `imports` errors in the library's components.** Cause: the library was built in local compilation mode, where the whole `imports` validation block is skipped by an explicit `compilationMode !== CompilationMode.LOCAL` guard. Nothing was wrong with the library's build; it simply never ran these checks. Fix: do not treat a green library build as evidence about `imports`. If you need the checks, they only exist in a full compilation ([13d](13d-compilation-mode-and-the-local-portability-trap.md)).

**★ Symptom: `standalone flag must be a boolean` with the second sentence `Value could not be determined statically.`** Cause: you made `standalone` an environment-dependent expression. It is an evaluated field like any other, so a constant folds and `process.env` does not. Fix: a constant inside the compilation unit, or nothing at all — omitting the flag is standalone in v22:

```ts
import {Component} from '@angular/core';

export const LEGACY_MODE = false;

// ✅ folds. But there is no reason to write it in v22.
@Component({
  selector: 'acme-legacy-aware',
  standalone: !LEGACY_MODE,
  template: `<ng-content />`,
})
export class LegacyAware {}
```


**★ Symptom: `Cannot use the "imports" field in a selectorless component` and you cannot find the switch you flipped.** Cause: selectorless is detected from the *template*, not from a flag — `analyzeTemplateForSelectorless(template.nodes)` decides it. Adding a selectorless reference anywhere in the markup turns the mode on for the whole component and makes its existing `imports` array an error. Fix: choose one addressing mode per component. There is no gradual migration inside a single template.


**★ Symptom: a `foreignImports` message quoting an `e.g.` and you cannot work out what shape it wants.** Cause: `extractForeignImportsFromAst` validates the **AST**, never the resolved value — `ts.isArrayLiteralExpression`, then `ts.isCallExpression` per element, then `ts.isIdentifier` on the callee, then exactly one argument, then `ts.isIdentifier` on that argument. Five syntactic gates, and each message carries the accepted spelling because there is no evaluated value to describe instead. Fix: match the `e.g.` literally. A constant holding the array, a spread, a call with two arguments or a member-expression callee all fail on syntax alone, and no amount of making them "more static" will help — the evaluator is never asked.

**Symptom: `'schemas' is only valid on a component that is standalone.` with no related note, while the `imports` version of the same sentence has one.** Cause: two `makeDiagnostic` calls, one built with a related-information array and one without. Same code, same sentence shape, different amount of help. Fix: apply the `imports` version's hint — delete `standalone: false` — because it is the same cause.


## Interview questions

**★ In local compilation mode, none of the `imports` diagnostics fire. Is that a bug?**
No — it is the defining property of the mode, made visible. Local compilation deliberately restricts the compiler to one file at a time so that each file can be compiled independently and cached; resolving `imports` requires reading the classes those identifiers point at, which is exactly the cross-file work the mode refuses to do. So the guard `compilationMode !== CompilationMode.LOCAL` around the whole validation block is the mode being honest rather than the compiler being lazy. The practical consequence is real, though: a library published from a local/partial build has never had these checks run on it, and the first build that runs them is the consuming application's. Treating a green library build as evidence about `imports` correctness is the mistake.

**★ A single `imports` mistake produces forty errors. What is the compiler doing, and which one do you read?**
It is poisoning the component — `isPoisoned = true`, with the source comment saying the marker exists so it does not spam further template type-checking errors that result from misconfigured imports. A poisoned component has no dependency scope at all, so every element that would have matched a component becomes unknown, every input binding becomes unrecognised, and the type-check block is built against an empty scope. The forty errors you see are the ones that escaped suppression, and every one of them is downstream of the first. Read the first diagnostic in the file, fix it, rebuild. Chasing the cascade is the single most common way to lose an hour on an Angular migration.


**★ NG2010 and NG2023 both fire on a non-standalone component. What is the difference?**
NG2010, `COMPONENT_NOT_STANDALONE`, fires when a non-standalone component uses a field that only makes sense on a standalone one — `imports`, `deferredImports`, `foreignImports` or `schemas` — and it poisons the component. It is about a *contradiction inside one decorator*. NG2023, `NON_STANDALONE_NOT_ALLOWED`, fires when a component declares `standalone: false` and the project has `strictStandalone` enabled; the decorator is internally consistent and the project policy forbids it. It does not poison, because nothing about the component's scope is undefined. So NG2010 is "you cannot mean both of these things" and NG2023 is "you are not allowed to mean this here", and only the second is switchable by a compiler option.

**★ `standalone` is an evaluated field, so `standalone: IS_LEGACY` compiles. Should you ever write that?**
No, and the reason is not that it fails — it is that it succeeds while making the answer invisible. The value is resolved by the partial evaluator like any other field, so a constant inside the compilation unit folds and a `process.env` read does not ([09c](09c-the-partial-evaluator-is-the-grammar.md)). But the standalone flag decides whether the component gets a dependency scope from `imports` or from an ambient NgModule, and every reader of the file — and every schematic, and every migration — now has to resolve a constant to know which. In v22 the flag defaults to `true`, so the correct number of components in a codebase that mention `standalone` at all is close to zero; a computed one is strictly worse than a literal, which is strictly worse than absent.

**Why does selectorless reject `imports` outright rather than ignoring it?**
Because it would be a second, contradictory source of truth. A selectorless template names its dependencies inline, so the component's dependency set is derivable from the template alone; an `imports` array would either agree with it — in which case it is noise that will drift — or disagree, in which case the compiler would have to pick a winner and neither choice is defensible. So `UNSUPPORTED_SELECTORLESS_COMPONENT_FIELD` rejects the field and poisons the component. Note also that selectorless is detected from the template by `analyzeTemplateForSelectorless`, not from a decorator flag, which means the error can appear on a component you edited only in its markup.


← Prev: [The imports family](10id-the-imports-family.md) · Index: [Topic index](README.md) · Next → [Selector shape](10if-selector-shape-and-the-missing-token.md)
