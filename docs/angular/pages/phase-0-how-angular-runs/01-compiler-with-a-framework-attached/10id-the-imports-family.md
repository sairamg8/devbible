---
title: "Eight distinct messages can come out of one `imports` array and they are raised by four different files with three different error codes — the generic one tells you nothing, the `forRoot()` one tells you everything, and in local compilation mode none of them fire at all"
sidebar_label: "10id · The imports family"
sidebar_position: 10.83
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/annotations/component/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/util.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts),
> [`packages/compiler-cli/src/ngtsc/scope/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/scope/src/util.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts).
> Documentation-validated; **no sandbox run**. Every message quoted below is a string literal read from one of those files at that tag.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not.** Every number on this page is undaggered — all were read from a line of `error_code.ts` that assigns them.

**`imports` is the field most likely to be red during a migration, and it is the field with the worst signal-to-noise ratio in the whole decorator: eight distinct messages, raised from four different files, carrying three different error codes, several of which are indistinguishable at a glance. The generic one — `'imports' must be an array of components, directives, pipes, or NgModules.` — is raised for an entry that is a directive, an entry that is a number, and an entry that did not resolve at all, because at the point it is raised those three are the same thing. The `Module.forRoot()` one is the opposite: the single most specific diagnostic the compiler emits, naming your exact migration mistake and its exact fix. This page is the discrimination table between them, and the one thing it insists on is that you read the *code*, because the message texts overlap and the codes do not.**

## Which of the eight you have

| message | code | raised in | trace? |
|---|---|---|---|
| `'imports' must be an array of components, directives, pipes, or NgModules.` | NG1010 | `component/src/util.ts` | yes, when the second sentence is `Value could not be determined statically.` |
| `'deferredImports' must be an array of components, directives, or pipes.` | NG1010 | `component/src/util.ts` | same |
| `Component imports contains a ModuleWithProviders value, likely the result of a 'Module.forRoot()'-style call. …` | NG2012 | `component/src/util.ts` | **no** |
| `'imports' is only valid on a component that is standalone.` | NG2010 | `component/src/handler.ts` | **no** — one hand-written related note |
| `The <kind> 'X' appears in 'imports', but is not standalone and cannot be imported directly.` | NG2011 | `scope/src/util.ts` | **no** — one hand-written related note, sometimes |
| `Component imports must be standalone components, directives, pipes, or must be NgModules.` | NG2012 | `scope/src/util.ts` | **no** |
| `Component deferred imports must be standalone components, directives or pipes.` | NG2022 | `scope/src/util.ts` | **no** |
| `Cannot use the "imports" field in a selectorless component` | NG2026 | `component/src/handler.ts` | **no** |

🔴 **NG2012 has two different message texts from two different files, and they mean different things.** From `component/src/util.ts` it is the `ModuleWithProviders` special case, raised while flattening the resolved array. From `scope/src/util.ts` it is `Component imports must be standalone components, directives, pipes, or must be NgModules.`, raised much later when the *scope* is assembled and the reference turns out not to be any of those. Same code, different phase, different fix. This is the same "one code, many call sites" trap NG1010 has, one level up.

The mechanism behind flattening, `forwardRef` unwrapping and the per-element diagnostic mapping is [09f](09f-imports-and-the-rule-about-lazy-loading.md); the standalone-scope story behind NG2010, NG2011 and NG2012 is [02 · 05d](../02-standalone-by-default/05d-the-errors-that-reject-an-import-outright.md). **This page owns the first three rows** — the two array messages and the `Module.forRoot()` message, which are the ones raised while the array itself is being read. The last five are gates on whether the component may have the field at all, and they live in [10ie · The standalone gates](10ie-the-standalone-gates.md), because they behave differently: they poison the component and they do not run in local compilation mode.

## The generic message, and why it cannot be more specific

**Symptom.** `'imports' must be an array of components, directives, pipes, or NgModules.`, with one of the three chain sentences.

**Cause.** Three separate call sites in `validateAndFlattenComponentImports` share one string. `annotations/component/src/util.ts`, verbatim:

```ts
  const errorMessage = isDeferred
    ? `'deferredImports' must be an array of components, directives, or pipes.`
    : `'imports' must be an array of components, directives, pipes, or NgModules.`;
  if (!Array.isArray(imports)) {
    const error = createValueHasWrongTypeError(expr, imports, errorMessage).toDiagnostic();
    return {
      imports: [],
      diagnostics: [error],
    };
  }
```

That first site fires when the *whole field* did not resolve to an array. The second fires per element when a `Reference` does not point at a named class declaration, and the third is the final `else` for everything that is neither an array, a `Reference`, nor a likely `ModuleWithProviders`:

```ts
      diagnostics.push(
        createValueHasWrongTypeError(diagnosticNode, diagnosticValue, errorMessage).toDiagnostic(),
      );
```

**The two messages are also the specification.** `deferredImports` does not accept NgModules and `imports` does — that difference exists nowhere in prose and only here, in the ternary.

🔴 **Read the second sentence, because it partitions the causes and the message does not.** `Value could not be determined statically.` means the element never resolved and the trace applies, so you are actually in [10c](10c-symbols-the-compiler-cannot-resolve.md) or [10e](10e-values-that-resolve-but-do-not-fold.md). `Value is of type 'undefined'.` means the element resolved and is genuinely `undefined` — a barrel file that does not re-export what you thought, or a circular module initialisation. Only `Value is a reference to 'X'.` means what the headline suggests, which is that you imported the wrong kind of thing.

**Fix.** Depends entirely on the second sentence, and the array below shows the three cases together:

```ts
import {Component} from '@angular/core';
import {CurrencyBadge} from './currency-badge';
import {StatusPill} from './status-pill';
import {formatInvoice} from './format-invoice';

// ⛔ three different failures, one message.
// @Component({
//   selector: 'acme-invoice-table-bad',
//   imports: [
//     CurrencyBadge,          // ✅ fine
//     formatInvoice,          // ⛔ `Value is a reference to 'formatInvoice'.` — a function, not a class
//     MISSING_PILL,           // ⛔ `Value could not be determined statically.` — never resolved
//     StatusPill,
//   ],
//   template: `<currency-badge /><status-pill />`,
// })
// export class InvoiceTableBad {}

// ✅ every entry is a class reference the compiler can name.
@Component({
  selector: 'acme-invoice-table',
  imports: [CurrencyBadge, StatusPill],
  template: `<currency-badge /><status-pill />`,
})
export class InvoiceTable {
  protected readonly formatted = formatInvoice;
}
```

## The `Module.forRoot()` message — the best diagnostic in the compiler

**Symptom.**

```text
Component imports contains a ModuleWithProviders value, likely the result of a
'Module.forRoot()'-style call. These calls are not used to configure components and are
not valid in standalone component imports - consider importing them in the application
bootstrap instead.
```

*(Illustrative line wrapping. The message is one string; the wrapping is this page's.)*

**Cause.** A dedicated branch, ahead of the generic `else`, that recognises the *shape* of the resolved value rather than its type. `annotations/component/src/util.ts`, verbatim:

```ts
    } else if (isLikelyModuleWithProviders(ref)) {
      let origin = expr;
      if (ref instanceof SyntheticValue) {
        // The `ModuleWithProviders` type originated from a foreign function declaration, in which
        // case the original foreign call is available which is used to get a more accurate origin
        // node that points at the specific call expression.
        origin = getOriginNodeForDiagnostics(ref.value.mwpCall, expr);
      }
      diagnostics.push(
        makeDiagnostic(
          ErrorCode.COMPONENT_UNKNOWN_IMPORT,
          origin,
          `Component imports contains a ModuleWithProviders value, likely the result of a 'Module.forRoot()'-style call. ` +
            `These calls are not used to configure components and are not valid in standalone component imports - ` +
            `consider importing them in the application bootstrap instead.`,
        ),
      );
    }
```

Two things in that block are worth more than the message itself.

**First, the word `likely` is doing real work.** The check is `isLikelyModuleWithProviders(ref)` — a heuristic on the resolved value's shape, not a proof that you called `forRoot()`. Anything that resolves to a `ModuleWithProviders`-looking object gets this message, including a hand-written `{ngModule: X, providers: [...]}` literal. The compiler is guessing at your intent and saying so in the message, which is unusually honest for a diagnostic.

**Second, the `SyntheticValue` branch is what makes the squiggle land on the call.** A `ModuleWithProviders` produced by a *declared* function — the normal case, because `forRoot()` on a library module is a `.d.ts` declaration with no body — comes back from the evaluator as a synthetic value carrying the original call node. `getOriginNodeForDiagnostics(ref.value.mwpCall, expr)` uses it to point at `SomeModule.forRoot(config)` specifically instead of at the whole `imports:` array. Without it you would get the array; with it you get the call. That is the difference between a two-minute fix and a ten-minute one in a fifteen-entry array.

**Fix, in code.** The failing migration and the repair, both complete:

```ts
// ⛔ invoice-page.ts — the shape that produces the message.
// import {Component} from '@angular/core';
// import {InvoiceModule} from '@acme/invoicing';
//
// @Component({
//   selector: 'acme-invoice-page',
//   imports: [InvoiceModule.forRoot({currency: 'EUR'})],
//   template: `<acme-invoice-table />`,
// })
// export class InvoicePageBad {}
```

The repair has two halves, and both are required. The **component** imports the module for its declarables only; the **bootstrap** takes the configuration:

```ts
// ✅ invoice-page.ts — the plain module reference, which is a valid import.
import {Component} from '@angular/core';
import {InvoiceModule} from '@acme/invoicing';

@Component({
  selector: 'acme-invoice-page',
  imports: [InvoiceModule],
  template: `<acme-invoice-table />`,
})
export class InvoicePage {}
```

```ts
// ✅ main.ts — the providers the `forRoot()` call was carrying, bridged into the
// environment injector where they belong.
import {bootstrapApplication, importProvidersFrom} from '@angular/platform-browser';
import {InvoiceModule} from '@acme/invoicing';
import {InvoicePage} from './invoice-page';

bootstrapApplication(InvoicePage, {
  providers: [importProvidersFrom(InvoiceModule.forRoot({currency: 'EUR'}))],
});
```

🔴 **The two halves are not interchangeable, and the message only names one of them.** `imports: [InvoiceModule]` gives the component the module's exported declarables and *nothing else*; the providers inside the `forRoot()` result do not come with it. If the module's `forRoot()` was the only thing supplying a service the component injects, fixing the compile error alone converts a build failure into a runtime `NG0201: No Provider Found`. What `importProvidersFrom` actually drags in, and the cases where the bridge is the wrong answer, are [02 · 08b](../02-standalone-by-default/08b-what-importprovidersfrom-drags-in.md) and [02 · 08i](../02-standalone-by-default/08i-what-a-library-should-ship-instead.md).

## Gotchas

**★ Symptom: `'imports' must be an array of components, directives, pipes, or NgModules.` on an entry that is definitely a component.** Cause: the *resolved value* is not a class reference. The evaluator produced a `DynamicValue` for that element, and at that point an unresolved element and a wrong one are indistinguishable — the same string is emitted for both. Fix: read the second sentence first. If it is `Value could not be determined statically.`, the element did not fold and this is not an `imports` problem at all; convert the array to a literal so the diagnostic can name the element, then follow the trace:

```ts
import {Component} from '@angular/core';
import {CurrencyBadge} from './currency-badge';
import {StatusPill} from './status-pill';

// ⛔ a macro call: one diagnostic on the whole expression, no element named.
// imports: buildImports(),

// ✅ a literal array: element count matches, no spread, so the squiggle lands on the entry.
@Component({
  selector: 'acme-row-total',
  imports: [CurrencyBadge, StatusPill],
  template: `<currency-badge /><status-pill />`,
})
export class RowTotal {}
```

**★ Symptom: you fix the `Module.forRoot()` error, the build goes green, and the app throws `NG0201: No Provider Found` at runtime.** Cause: you did half the fix. Replacing `InvoiceModule.forRoot(config)` with `InvoiceModule` satisfies the compiler and silently discards the providers the call was carrying. Fix: move the call to the bootstrap and bridge it, exactly as shown above — `importProvidersFrom(InvoiceModule.forRoot(config))` in `bootstrapApplication`. The compiler cannot warn you about this, because from its point of view you simply stopped writing an expression it was rejecting.

**★ Symptom: NG2012 in one build and NG2012 in another, with different message texts, and you assume one is a typo.** Cause: `COMPONENT_UNKNOWN_IMPORT` has two call sites in two files and two sentences. `Component imports contains a ModuleWithProviders value…` comes from flattening, during analysis. `Component imports must be standalone components, directives, pipes, or must be NgModules.` comes from `scope/src/util.ts`, when the scope is assembled and the reference is not a declarable. Fix: route on the sentence, not the code — they need different repairs, and only the first names its own fix.

**Symptom: the squiggle for the `forRoot()` message lands on the whole `imports` array in one project and on the call itself in another.** Cause: the precise node comes from the `SyntheticValue` branch, which only has a call to point at when the `ModuleWithProviders` came from a *declared* function — a `.d.ts` from `node_modules`. A hand-written local `forRoot()` with a real body resolves differently and may not carry the origin node. Fix: nothing to fix; do not read the span's coarseness as a different error.

**Symptom: `'deferredImports' must be an array of components, directives, or pipes.` and you go looking for what is wrong with your NgModule entry.** Cause: nothing is wrong with it in `imports`; `deferredImports` genuinely does not accept NgModules. The two messages differ by exactly that clause and the ternary that chooses between them is the only place the rule is written down. Fix: move NgModule entries to `imports` and keep `deferredImports` to declarables.

## Interview questions

**★ Why does `Module.forRoot()` in a standalone component's `imports` get its own dedicated error message when the generic one would have covered it?**
Because it is a migration mistake with a known, specific and non-obvious fix, and the generic message would have actively misled. `SomeModule.forRoot(config)` returns a `ModuleWithProviders` — a plain configuration object for an injector, with no selector and nothing to contribute to a template scope. The generic sentence would have told you `imports` must be an array of components, directives, pipes or NgModules, which reads as "this is not an NgModule" when in fact it *is* an NgModule plus providers. So the compiler added `isLikelyModuleWithProviders`, a shape heuristic ahead of the generic branch, and a message that names both the cause and the remedy: these calls are not used to configure components, import them in the application bootstrap instead. The word *likely* is in the message because the check is a heuristic, not a proof.

**★ You fix that error by writing `imports: [InvoiceModule]`. What did you just break, and how would you know?**
The providers. `InvoiceModule.forRoot({currency: 'EUR'})` was returning the module *and* a provider list; importing the bare module gives the component the module's exported declarables and nothing else. Nothing at build time notices, because from the compiler's point of view you removed an expression it was rejecting. You find out at runtime, as `NG0201: No Provider Found` for whatever the `forRoot()` was supplying — often far from the component you edited, because the injection happens in a service. The complete fix is two edits: the bare module in the component's `imports`, and `importProvidersFrom(InvoiceModule.forRoot(config))` in `bootstrapApplication`'s providers.

**★ One error code, NG2012, carries two different sentences from two different files. Why does that matter more here than it does for NG1010?**
Because NG1010's sentences all mean the same class of thing — a field's value had the wrong type — while NG2012's two sentences describe failures in different *phases* with different fixes. `Component imports contains a ModuleWithProviders value…` is raised during analysis, while flattening the resolved array, and the fix is to move a call to the bootstrap. `Component imports must be standalone components, directives, pipes, or must be NgModules.` is raised later, in `scope/src/util.ts`, when the component's scope is being assembled and a reference turns out not to be a declarable at all. Grouping them by code puts an "I wrote the wrong expression" bug and a "this class is not what I thought it was" bug in one bucket. It is the general lesson of this whole catalogue: Angular's error codes identify the *check*, not the *cause*, and only the message text and the file identify the cause.

**Why is the difference between `imports` and `deferredImports` written only in a ternary?**
Because the compiler treats the two arrays with one function, `validateAndFlattenComponentImports`, parameterised by an `isDeferred` boolean, and the only place the semantic difference surfaces is the error message it chooses. `'imports' must be an array of components, directives, pipes, or NgModules.` versus `'deferredImports' must be an array of components, directives, or pipes.` — NgModules are in one list and not the other. That is the specification, and it exists in exactly one line of source. It is worth knowing both because it is the rule and because it is a good example of how much of Angular's real contract lives in message strings rather than in documentation.

{/* FOOTER */}
