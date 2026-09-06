---
title: "The static-analysability rules do not apply to your `@Component` — they apply to the enumerable subset of its fields the compiler needs a value from, and every other field is lifted out as a raw syntax node and printed back unchanged, which is why `providers` accepts an arrow function that `selector` would reject"
sidebar_label: "09b · What is evaluated"
sidebar_position: 9.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/component/src/resources.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/resources.ts);
> and angular.dev [Ahead-of-time (AOT) compilation](https://angular.dev/tools/cli/aot-compiler), ⚠️ which is ViewEngine-era on this subject and is contradicted below by the shipped source.
> Documentation-validated; **no sandbox run** — every code block is source read from a named file or an illustrative component, and no compiled output was produced.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Once the object literal from [09](09-static-analysability-is-the-load-bearing-constraint.md) has passed the syntax gate, the compiler does *not* evaluate it. It evaluates a specific, listable set of fields — the ones whose value changes the generated output — and lifts every other field out as a raw TypeScript AST node to be printed back into the definition object unchanged. That split is the reason the folk rules about metadata are half-true: they are stated as rules about `@Component`, but they are only rules about roughly a dozen of its keys. `providers` is not one of them, which is why an arrow-function factory compiles despite the AOT guide saying it cannot, and why nothing at build time will ever tell you a provider is wrong.**

## The compiler asks for a value, or it asks for the code

Two things a compiler can want from an expression in your source. It can want the **value** — because it has to make a decision now, and the decision depends on what the expression is worth. Or it can want the **code** — because the value is somebody else's business at runtime, and all the compiler has to do is carry the expression from where you wrote it to where the framework will look for it.

`ngtsc` does both, in the same decorator, key by key. `annotations/directive/src/shared.ts`, on `providers`, verbatim at `v22.1.5`:

```ts
const providers: Expression | null = directive.has('providers')
  ? new WrappedNodeExpr(
      annotateForClosureCompiler
        ? wrapFunctionExpressionsInParens(directive.get('providers')!)
        : directive.get('providers')!,
    )
  : null;
```

`WrappedNodeExpr` means exactly one thing: **take this TypeScript AST node and print it back out unchanged.** The provider array is never interpreted, never folded, never inspected for supported syntax. It is lifted out of the decorator, wrapped, and emitted into `ɵcmp` as the same source text you wrote — which is what makes it show up in the definition object as a field rather than as compiler-generated code ([06c](06c-decls-vars-consts-and-dependencies.md)).

Note the `annotateForClosureCompiler` branch. When that compiler option is on, function expressions inside `providers` get wrapped in parentheses on the way out — `wrapFunctionExpressionsInParens` — so the emitted output is not byte-identical to your source even though the *semantics* are. That is a rewrite for Closure's benefit, not an evaluation: nothing about the array is being resolved.

## The correction the AOT guide has not caught up with

The angular.dev AOT compilation guide says:

> *"The AOT compiler does not support function expressions … and arrow functions"*

and illustrates it with a `providers: [{provide: server, useFactory: () => new Server()}]` example said to fail.

🔴 **In Ivy at v22.1.5 that example compiles.** The rule it states was true of the ViewEngine metadata collector, which really did walk the whole decorator and really did reject syntax it could not serialise into `.metadata.json`. `ngtsc` has no collector. `providers` reaches `WrappedNodeExpr` and the arrow function is emitted verbatim, to be called by the injector at runtime — which is the entire point of a factory provider:

```ts
import {Component, InjectionToken} from '@angular/core';

export class ApiClient {
  constructor(readonly baseUrl: string) {}
}

export const API_CLIENT = new InjectionToken<ApiClient>('API_CLIENT');

@Component({
  selector: 'app-shell',
  providers: [{provide: API_CLIENT, useFactory: () => new ApiClient('https://api.example.com')}],
  template: '<h1>Shell</h1>',
})
export class Shell {}
```

If you have ever deleted a factory arrow function and replaced it with an exported named function "because AOT", that refactor bought you nothing at all. The named-function form is still perfectly reasonable style; it is just not a compilation requirement.

## The fields the evaluator actually reads

Every field below has an `evaluator.evaluate(...)` call site in `annotations/directive/src/shared.ts` or `annotations/component/src/{handler,resources}.ts` at `v22.1.5`:

| Group | Fields the evaluator resolves | Why the compiler needs the value |
|---|---|---|
| Identity | `selector`, `exportAs`, `standalone` | decides what matches this directive, and what scope rules apply |
| Template source | `template`, `templateUrl`, `styles`, `styleUrl` / `styleUrls` | it has to *read and parse* the template at build time, so it needs the text or the path |
| Parsing config | `interpolation`, `preserveWhitespaces` | changes how the template is tokenized ([01](01-the-template-is-a-separate-language.md)) |
| Bindings | `host`, `inputs`, `outputs` | becomes generated host-binding instructions and the input/output maps in `ɵcmp` |
| Queries | `queries`, and their `read` / `descendants` / `static` / `emitDistinctChangesOnly` options | becomes generated query instructions with fixed slot positions |
| Composition | `imports`, `deferredImports`, `hostDirectives`, `schemas` | builds the template's dependency scope and the `@defer` split ([11](11-why-defer-can-split-a-bundle.md)) |
| Rendering | `encapsulation`, `changeDetection` | selects style-scoping strategy and the `ChangeDetectionStrategy` constant baked into the definition |

⚠️ **Scope this list honestly.** It is the set found for `@Component` and `@Directive`. The `@NgModule`, `@Pipe` and `@Injectable` handlers were not read exhaustively for this page, so do not repeat it as a complete list of every evaluated field in Angular. What is safe to generalise is the *pattern* the right-hand column states: a field is evaluated when the compiler must know its value to generate correct output, and relayed when it only has to appear in the output.

Everything not in that table — `providers`, `viewProviders`, `animations`, and any field a future version adds for runtime consumption — takes the `WrappedNodeExpr` path.

## The predictive rule, and what it costs you

**Ask whether the compiler needs the value or merely the code.** A selector decides which elements in a template match a directive, so the compiler needs the *string* in order to build the matcher. A provider decides what the injector constructs when someone asks for a token, so the compiler needs only the *expression*, and the injector will run it later.

That rule is symmetric, and the second half is the half people never think about: **a relayed field gets no build-time analysis of any kind.** Nothing checks that the token in a `useExisting` is provided anywhere. Nothing checks that a `useFactory` returns something assignable to the token's type beyond what TypeScript's own `Provider` typing catches. Nothing warns that two entries in the array provide the same token. The compiler is not being lenient with `providers`; it is not looking at it. Every mistake in that array is a runtime injector failure, in the browser, in a component that renders.

That asymmetry is also the origin of a design decision two topics away. `NgModule.forRoot()` was opaque for exactly this reason — a call whose result lands in an un-analysed field is invisible to the compiler *and* to the bundler, which is the argument [`provide*` functions](../03-the-provider-array/02-why-provide-functions-replaced-forroot.md) were introduced to win.

## The trap: `imports` and `providers` do not behave the same way

They look alike. Both are arrays. Both sit in the same object literal. Both hold "things the component needs". One is evaluated and one is not, and the difference is total:

```ts
// ✅ compiles — `providers` is never evaluated, so the body of getProviders() is irrelevant
import {Component, InjectionToken, Provider} from '@angular/core';

export const FEATURE_NAME = new InjectionToken<string>('FEATURE_NAME');

export function getProviders(): Provider[] {
  const name = 'reporting';
  const suffix = '-panel';
  return [{provide: FEATURE_NAME, useValue: name + suffix}];
}

@Component({
  selector: 'app-reporting-panel',
  providers: getProviders(),
  template: '<h2>Reporting</h2>',
})
export class ReportingPanel {}
```

The same call in `imports` is a different question entirely, because `imports` *is* evaluated: the compiler has to know which classes are in scope in order to compile the template against them. A call there is only resolvable under the single-return rule in [09d](09d-the-single-return-function-rule.md) — `getProviders` above has three statements in its body and would not survive it. Two identically-shaped expressions, two different outcomes, decided entirely by which side of the table the key falls on.

## Gotchas

**★ Symptom: you removed an arrow function from `providers` because the AOT guide said arrow functions are unsupported, and the refactor changed nothing.** Cause: the guide's rule is ViewEngine-era. `providers` is wrapped in `WrappedNodeExpr` and re-emitted verbatim; it is never evaluated, so its contents are unconstrained by static analysis. Fix: put the factory back — it is the idiomatic form, and it compiles:

```ts
import {Component, InjectionToken} from '@angular/core';

export interface FeatureFlags {
  readonly betaSearch: boolean;
}

export const FEATURE_FLAGS = new InjectionToken<FeatureFlags>('FEATURE_FLAGS');

@Component({
  selector: 'app-search-panel',
  providers: [{provide: FEATURE_FLAGS, useFactory: () => ({betaSearch: true})}],
  template: '<h2>Search</h2>',
})
export class SearchPanel {}
```

**★ Symptom: a helper function works fine in `providers`, so you use the same pattern for `imports` and the build fails.** Cause: `imports` has an `evaluate` call site and `providers` does not. The helper is resolvable in `imports` only if its body is exactly one `return` statement. Fix: make the helper a single return, or — better for `@defer` ([11b](11b-the-nine-conditions-and-the-barrel-trap.md)) — write the identifiers literally:

```ts
import {Component} from '@angular/core';
import {InvoiceRow} from './invoice-row';
import {CurrencyBadge} from './currency-badge';

@Component({
  selector: 'app-invoice-table',
  imports: [InvoiceRow, CurrencyBadge],
  template: '<invoice-row /><currency-badge />',
})
export class InvoiceTable {}
```

**★ Symptom: `templateUrl` built from a path constant fails, while the same constant used in `providers` is fine.** Cause: `templateUrl` is evaluated, because the compiler has to *read that file off disk* during the build in order to parse the template. A path it cannot fold is a file it cannot open. Fix: the constant is fine as long as it folds to a string — an exported `const` string in the same compilation unit does; anything that does not reduce to a string does not:

```ts
// template-paths.ts
export const INVOICE_TEMPLATE = './invoice-summary.html';

// invoice-summary.ts
import {Component} from '@angular/core';
import {INVOICE_TEMPLATE} from './template-paths';

@Component({
  selector: 'app-invoice-summary',
  templateUrl: INVOICE_TEMPLATE,
  styleUrl: './invoice-summary.css',
})
export class InvoiceSummary {}
```

**Symptom: a typo'd or duplicated provider survives the build and blows up in the browser when the component renders.** Cause: `providers` is relayed, not analysed — the compiler never resolves the tokens, so there is no build-time check that a token is provided, unique, or type-compatible beyond what TypeScript's own `Provider` typing catches. Fix: there is no compiler fix; the only build-time guard is TypeScript's typing, so give your tokens a real type argument so that `useValue` and `useFactory` are checked against it:

```ts
import {InjectionToken, Provider} from '@angular/core';

export interface RetryPolicy {
  readonly attempts: number;
  readonly backoffMs: number;
}

// The type argument is what makes the mistake below a TypeScript error.
export const RETRY_POLICY = new InjectionToken<RetryPolicy>('RETRY_POLICY');

export const RETRY_PROVIDER: Provider = {
  provide: RETRY_POLICY,
  useValue: {attempts: 3, backoffMs: 250},
};
```

**Symptom: the emitted `providers` array is not byte-identical to your source — function expressions have gained parentheses.** Cause: `annotateForClosureCompiler` routes the node through `wrapFunctionExpressionsInParens` before wrapping it. Fix: nothing to fix, but do not diff emitted output against source and conclude the compiler is rewriting your providers semantically; check the compiler option first, in `tsconfig.json`:

```json
{
  "angularCompilerOptions": {
    "annotateForClosureCompiler": false
  }
}
```

## Interview questions

**★ Why can `providers` contain an arrow function while `selector` cannot contain a function call?**
Because only one of them is evaluated. `selector` has an `evaluator.evaluate(...)` call site — the compiler needs the actual string in order to build the directive-matching data in `ɵcmp`, so the expression has to fold to a string at build time. `providers` has no such call site: it is captured as `new WrappedNodeExpr(directive.get('providers')!)` and printed back out unchanged into the definition object, to be executed by the injector at runtime. Same decorator, same object literal, opposite rules — because the compiler needs a *value* from one and only *code* from the other. This is also why the AOT guide's blanket claim that arrow functions are unsupported in metadata is wrong for Ivy, and specifically wrong for the `providers` example it uses to illustrate it.

**★ How would you decide, without building, whether a `@Component` field you have never seen before is subject to the static-analysability rules?**
Ask what the compiler would have to do with it. If the generated output depends on the field's *value* — it changes which elements match, which classes are pulled into the dependency scope, how the template is tokenized, which change-detection constant is baked into the definition — then the compiler must resolve it, and it is evaluated. If the field is runtime wiring the framework consumes after the definition object has been built, the compiler only needs to relay the code, and it will be wrapped in `WrappedNodeExpr` and emitted unchanged. The measured list for `@Component` and `@Directive` at v22.1.5 is in the table above; the reasoning generalises to fields the table does not name.

**★ `providers: getProviders()` compiles and `imports: getImports()` sometimes does not. Explain the difference precisely.**
`providers` is never evaluated, so the call is emitted verbatim and its body can be anything at all — a hundred statements, a network of local variables, whatever you like. `imports` is evaluated, so the call has to be resolvable by the partial evaluator, and the evaluator will only enter a function body that is exactly one `return` statement ([09d](09d-the-single-return-function-rule.md)). So `imports: getImports()` compiles if and only if `getImports` is a single-return function whose returned expression itself folds. Two visually identical expressions, and the outcome is decided entirely by which key they sit under.

**What is the cost of `providers` being un-analysed? Name a concrete consequence.**
No build-time checking of any kind. A token that is never provided, a duplicate registration, a `useExisting` pointing at nothing — none of them is a compile error, because nothing resolves the array. They surface as runtime injector failures in the browser. The second consequence is architectural: a call whose result lands in an un-analysed field is opaque to the compiler *and* to the bundler, which is exactly the problem `NgModule.forRoot()` had, and exactly the argument for tree-shakable `provide*` functions ([03 · 02](../03-the-provider-array/02-why-provide-functions-replaced-forroot.md)).

**Why is `templateUrl` in the evaluated group when it is "just a string"?**
Because the compiler has to open that file during the build. The template is parsed into a template AST and lowered into an instruction function before anything ships ([01](01-the-template-is-a-separate-language.md)), so a `templateUrl` the compiler cannot fold to a concrete path is a template it cannot read, and there is nothing to compile. It is the clearest case in the table of "the value changes what the compiler does next", as opposed to "the value is somebody's runtime configuration".

---

← Prev: [09 · Static analysability](09-static-analysability-is-the-load-bearing-constraint.md) · Index: [Topic index](README.md) · Next → [The partial evaluator is the grammar](09c-the-partial-evaluator-is-the-grammar.md)
