---
title: "\"`imports` must be identifiers\" is false as a compilation rule and true as a lazy-loading rule — the compiler flattens nested arrays, unwraps `forwardRef` and folds macro calls quite happily, and the thing that actually needs literal identifiers is `@defer`, which reports nothing when you get it wrong"
sidebar_label: "09f · imports and lazy loading"
sidebar_position: 9.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/component/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/util.ts).
> Documentation-validated; **no sandbox run** — every code block is source read from a named file or an illustrative component.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The second folk rule of Angular metadata is that `imports` has to be a literal array of identifiers. As a statement about whether your code compiles, that is simply not what the source says: `imports` is evaluated with two resolvers layered on, nested arrays are recursively flattened, `forwardRef` is unwrapped, and a single-return macro call resolves like any other. As a statement about whether `@defer` will split a chunk out of your bundle, it is exactly right — and that rule is enforced by a completely different piece of code that emits no diagnostic at all when it declines. Two rules, one array, and only one of them tells you when you have broken it.**

## How `imports` is resolved

`annotations/component/src/handler.ts`, verbatim at `v22.1.5`:

```ts
const importResolvers = combineResolvers([
  createModuleWithProvidersResolver(this.reflector, this.isCore),
  createForwardRefResolver(this.isCore),
]);

if (rawImports) {
  const expr = rawImports;
  const imported = this.evaluator.evaluate(expr, importResolvers);
  const {imports: flattened, diagnostics} = validateAndFlattenComponentImports(
    imported,
    expr,
    false /* isDeferred */,
  );
```

Two things to take from that. First, it is `this.evaluator.evaluate` — the same partial evaluator as everything else, with the same dispatch ([09c](09c-the-partial-evaluator-is-the-grammar.md)) and the same single-return function rule ([09d](09d-the-single-return-function-rule.md)). Second, it is handed **resolvers**: extra handling layered over the evaluator so that two specific call shapes — a `ModuleWithProviders`-returning call and a `forwardRef` — mean something rather than failing.

`forwardRef(() => SomeComponent)` therefore works in `imports`, and works *despite* containing an arrow function, because the resolver recognises the call and takes the referenced class out rather than trying to fold the function.

## Flattening is recursive

`annotations/component/src/util.ts`, `validateAndFlattenComponentImports`, recurses into nested arrays:

```ts
if (Array.isArray(ref)) {
  // …validateAndFlatten…
}
```

So a grouped constant is legal, and stays legal however deeply you nest it:

```ts
// shared-imports.ts
import {CurrencyBadge} from './currency-badge';
import {StatusPill} from './status-pill';

export const SHARED_IMPORTS = [CurrencyBadge, StatusPill];
```

```ts
// invoice-table.ts — compiles; the array is flattened during evaluation
import {Component} from '@angular/core';
import {SHARED_IMPORTS} from './shared-imports';
import {InvoiceRow} from './invoice-row';

@Component({
  selector: 'acme-invoice-table',
  imports: [SHARED_IMPORTS, InvoiceRow],
  template: '<invoice-row /><currency-badge /><status-pill />',
})
export class InvoiceTable {}
```

That is the compilation rule, and it is more permissive than the folklore. [02 · 04c](../02-standalone-by-default/04c-what-the-compiler-does-with-the-array.md) covers what the flattened list is then *used* for.

## The messages, verbatim

Three failures live in `util.ts`, and each is worded to name the mistake rather than the rule. The generic one comes in two flavours depending on which array it was:

```ts
const errorMessage = isDeferred
  ? `'deferredImports' must be an array of components, directives, or pipes.`
  : `'imports' must be an array of components, directives, pipes, or NgModules.`;
```

Note that `deferredImports` does **not** accept NgModules and `imports` does — the messages are the specification.

The second is the most helpful diagnostic in the whole metadata surface, because it identifies a specific migration mistake by shape:

```ts
} else if (isLikelyModuleWithProviders(ref)) {
  // …
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

The third fires when the component is not standalone:

```ts
`'${importsField}' is only valid on a component that is standalone.`
```

with the related note `` `Did you forget to add 'standalone: true' to this @Component?` `` — and then something more consequential happens, described in the compiler's own comment:

> *"Poison the component so that we don't spam further template type-checking errors that result from misconfigured imports."*

🔴 **A poisoned component is why one mistake produces a page of errors.** With `imports` rejected, the template has no dependency scope, so every element that would have matched a component is now unknown, every input binding is now unrecognised, and the type-check block is built against nothing. The poison marker exists to *suppress* that cascade; when you still see one, the first error in the file is the only one worth reading — everything after it is downstream of an empty scope.

The full catalogue of hard `imports` rejections, with their error codes, is in [02 · 05d](../02-standalone-by-default/05d-the-errors-that-reject-an-import-outright.md).

## Why the squiggle sometimes lands on the whole array

The diagnostic is mapped back to an individual element only under three conditions, verbatim:

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

The expression must be a literal array, its element count must equal the resolved import count, and it must contain no spread. Break any of the three — by spreading a shared constant, by nesting an array that flattens to a different length, by writing a macro call instead of an array — and the error is attached to the whole `imports:` expression. Everything still compiles or fails identically; you simply lose the ability to see *which entry* is at fault, in the array where that information matters most.

## The rule that is actually about identifiers

Everything above is about compilation. `@defer` is a different mechanism with a stricter, unstated requirement: to move a dependency into a lazily-loaded chunk, the compiler rewrites the *import declaration* that brought it in, and that only works when the `imports` entry is a literal reference it can trace back to a single import. A spread, a nested constant or a macro call all compile perfectly and all quietly disable the split.

🔴 **And nothing tells you.** Failing to defer is not an error, not a warning, not a line of build output — the app works, the chunk is just still in the main bundle. The nine conditions and the barrel-file trap are in [11b](11b-the-nine-conditions-and-the-barrel-trap.md), and the diagnosis procedure — because there is no error message to search for — is [11c](11c-diagnosing-a-defer-that-did-not-split.md).

So the corrected pair of rules:

| | Compilation | `@defer` splitting |
|---|---|---|
| Literal array required | no | **yes** |
| Literal identifiers required | no | **yes** |
| Nested arrays | flattened | disable the split |
| Spread | allowed, loses per-element diagnostics | disables the split |
| Macro call returning an array | allowed if single-return | disables the split |
| `forwardRef` | unwrapped by the resolver | see [11b](11b-the-nine-conditions-and-the-barrel-trap.md) |
| Failure signal | a diagnostic | **none** |

**Write literal identifiers anyway.** Not because compilation demands it, but because the stricter of the two rules costs nothing to satisfy and the penalty for missing it is invisible.

## Gotchas

**★ Symptom: `imports: [...SHARED_IMPORTS, InvoiceRow]` compiles fine, and then a `@defer` block in that component never produces a chunk.** Cause: two different rules. The spread is legal for compilation, and fatal for deferral — the elements are no longer literal references the compiler can trace to an import declaration. Fix: write the identifiers out in any component that has a `@defer` block:

```ts
import {Component} from '@angular/core';
import {CurrencyBadge} from './currency-badge';
import {StatusPill} from './status-pill';
import {HeavyChart} from './heavy-chart';

@Component({
  selector: 'acme-dashboard',
  imports: [CurrencyBadge, StatusPill, HeavyChart],
  template: `
    <currency-badge />
    <status-pill />
    @defer (on viewport) { <heavy-chart /> }
  `,
})
export class Dashboard {}
```

**★ Symptom: `Component imports contains a ModuleWithProviders value, likely the result of a 'Module.forRoot()'-style call.`** Cause: a `forRoot()` call returns a configuration object for an injector, not a declarable — it has no selector and nothing to contribute to a template scope. Fix: the error names the fix; move it to the application bootstrap, where `importProvidersFrom` bridges it into the environment injector:

```ts
// main.ts
import {bootstrapApplication, importProvidersFrom} from '@angular/platform-browser';
import {LegacyFeatureModule} from './legacy/legacy-feature-module';
import {AppRoot} from './app/app-root';

bootstrapApplication(AppRoot, {
  providers: [importProvidersFrom(LegacyFeatureModule.forRoot({retries: 3}))],
});
```

**★ Symptom: one `imports` mistake produces dozens of unrelated template errors — unknown elements, unknown properties, unknown pipes.** Cause: the component was poisoned. When `imports` is rejected the template has no dependency scope at all, so every match fails; the compiler's own comment says the poison marker exists to stop exactly this spam. Fix: fix the first diagnostic in the file and re-run; do not chase the cascade. If the first one is `'imports' is only valid on a component that is standalone.`, delete the `standalone: false`:

```ts
import {Component} from '@angular/core';
import {InvoiceRow} from './invoice-row';

@Component({
  selector: 'acme-invoice-table',
  imports: [InvoiceRow],
  template: '<invoice-row />',
})
export class InvoiceTable {}
```

**★ Symptom: `'imports' must be an array of components, directives, pipes, or NgModules.` on an entry that is definitely a component.** Cause: the *resolved value* is not a class reference — the evaluator produced a `DynamicValue` for that element, and an unresolved element is indistinguishable from a wrong one at this point. Fix: find the element that did not fold. If the array is a spread or a macro call the diagnostic will point at the whole expression, so convert it to a literal array first — that is what buys back per-element positions:

```ts
import {Component} from '@angular/core';
import {CurrencyBadge} from './currency-badge';
import {StatusPill} from './status-pill';

@Component({
  selector: 'acme-invoice-table',
  imports: [CurrencyBadge, StatusPill], // literal array, no spread, lengths match
  template: '<currency-badge /><status-pill />',
})
export class InvoiceTable {}
```

**Symptom: the same message but the field is `deferredImports`, and the entry is an NgModule.** Cause: the two arrays have different accepted contents, and the messages say so — `deferredImports` names only components, directives and pipes. Fix: NgModule-shaped dependencies go in `imports`; only standalone declarables can be listed for deferral:

```ts
import {Component} from '@angular/core';
import {HeavyChart} from './heavy-chart';

@Component({
  selector: 'acme-report',
  deferredImports: [HeavyChart],
  template: '@defer (on viewport) { <heavy-chart /> }',
})
export class Report {}
```

**Symptom: two components import each other and one of them is `undefined` at class-evaluation time.** Cause: an ordinary ES module cycle, not a metadata problem — but `imports` is a place where the compiler gives you a way out. Fix: `forwardRef`, which the `createForwardRefResolver` in the resolver chain unwraps during evaluation:

```ts
import {Component, forwardRef} from '@angular/core';
import {TreeNode} from './tree-node';

@Component({
  selector: 'acme-tree-branch',
  imports: [forwardRef(() => TreeNode)],
  template: '<acme-tree-node />',
})
export class TreeBranch {}
```

**Symptom: a shared `imports` constant is used by twenty components and NG8113 "unused import" behaviour is confusing.** Cause: this page establishes that the per-element diagnostic mapping is lost on a spread; whether the unused-import check still fires at all through a non-literal array was **not** determined by the source read behind this page. Fix: do not reason about it — make the array literal, which restores both the per-element positions and any per-element checking:

```ts
import {Component} from '@angular/core';
import {CurrencyBadge} from './currency-badge';

@Component({
  selector: 'acme-price-tag',
  imports: [CurrencyBadge],
  template: '<currency-badge />',
})
export class PriceTag {}
```

## Interview questions

**★ Is it true that `imports` must be an array of identifiers?**
Not for compilation. `imports` is evaluated by the ordinary partial evaluator with two extra resolvers, and `validateAndFlattenComponentImports` recurses into nested arrays — so a grouped constant, a spread, a `forwardRef` call and a single-return macro function all compile. It *is* true for `@defer`, which lazily loads a dependency by rewriting the import declaration that introduced it, and can only do that when the entry is a literal reference. The reason the folk rule survives is that the strict version is good advice: the permissive rule buys you nothing and the strict one costs nothing, and only one of the two failures announces itself.

**★ Why does `Module.forRoot()` in a standalone component's `imports` get its own dedicated error message?**
Because it is a specific, predictable migration mistake with a specific fix, and the generic message would be actively misleading. A `forRoot()` call returns a `ModuleWithProviders` — an object carrying a module type and a provider list — which is injector configuration, not a template dependency. The compiler detects the shape with `isLikelyModuleWithProviders` and tells you both what you have and where it belongs: *"consider importing them in the application bootstrap instead."* It is worth studying as an example of a diagnostic that names the user's intent rather than the compiler's rule.

**★ What does it mean that the compiler "poisons" a component, and why should you care?**
When `imports` is rejected, the compiler marks the component so that downstream template type-checking errors are suppressed — its own comment says the goal is *"so that we don't spam further template type-checking errors that result from misconfigured imports."* You care because it tells you how to read a screenful of errors: with no dependency scope, every element, binding and pipe in the template becomes unrecognised, and all of those are consequences of one upstream failure. The correct move is to fix the first diagnostic and rebuild, never to work through the list.

**Why does the compiler sometimes underline the whole `imports:` expression instead of the offending entry?**
Because mapping a diagnostic to an element requires three conditions to hold at once: the expression is a literal array, its element count equals the resolved import count, and it contains no spread. A spread breaks the count correspondence, a nested array that flattens breaks it too, and a macro call is not an array literal at all. When any of those is true the compiler falls back to the whole expression, since it can no longer prove which source element produced which resolved value. Converting the array to literal elements is therefore not just style — it is what buys back the position information.

**A component's `imports` compiles and its `@defer` block does not split. Where do you start, given there is no error?**
Start by accepting that the absence of output is the symptom. The compilation rule and the deferral rule are enforced by different code, and only the first one produces diagnostics — the second silently falls back to eager loading. The first thing to check is the shape of the `imports` array itself: literal array, literal identifiers, one import declaration per entry, nothing re-exported through a barrel. [11b](11b-the-nine-conditions-and-the-barrel-trap.md) enumerates the conditions and [11c](11c-diagnosing-a-defer-that-did-not-split.md) is the procedure for turning the silence into a signal.

---

← Prev: [09e · selector must reduce to a string](09e-selector-must-reduce-to-a-string.md) · Index: [Topic index](README.md) · Next → [Reading a metadata failure](09g-reading-a-metadata-failure.md)
