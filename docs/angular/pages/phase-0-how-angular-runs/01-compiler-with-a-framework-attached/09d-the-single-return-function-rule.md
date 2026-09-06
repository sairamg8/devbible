---
title: "The folk rule that you cannot build metadata with a helper function is false — the compiler will happily call your function during the build, provided its body is exactly one `return` statement, and that one rule is what makes `RouterModule.forRoot(routes)` legal"
sidebar_label: "09d · The single-return rule"
sidebar_position: 9.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/diagnostics.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/diagnostics.ts);
> and angular.dev [Ahead-of-time (AOT) compilation](https://angular.dev/tools/cli/aot-compiler) — ⚠️ ViewEngine-era wording, but the rule it states matches the shipped `visitFunctionBody` exactly, and the disagreement is flagged below.
> Documentation-validated; **no sandbox run** — every code block is source read from a named file, quoted from the doc, or an illustrative component.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**"You cannot build a `@Component` argument with a helper function" is the most repeated piece of Angular folklore, and it is wrong in a specific and useful way. `ts.isCallExpression` is in the evaluator's dispatch ([09c](09c-the-partial-evaluator-is-the-grammar.md)), and when the callee resolves to a function whose body is a single `return` statement, `ngtsc` binds the arguments into a scope and evaluates that return expression — at build time, without running your program. Parameters, default values and rest parameters all work. Two statements do not. That single line of code is why `RouterModule.forRoot(routes)` has been legal since Angular 2, why every macro-style static method in the ecosystem takes the shape it does, and why the fix for a metadata failure is often "collapse the helper", not "delete the helper".**

## The rule, in the source

`partial_evaluator/src/interpreter.ts`, `visitFunctionBody`, verbatim at `v22.1.5`:

```ts
private visitFunctionBody(
  node: ts.CallExpression,
  fn: FunctionDefinition,
  context: Context,
): ResolvedValue {
  if (fn.body === null) {
    return DynamicValue.fromUnknown(node);
  } else if (fn.body.length !== 1 || !ts.isReturnStatement(fn.body[0])) {
    return DynamicValue.fromComplexFunctionCall(node, fn);
  }
  const ret = fn.body[0] as ts.ReturnStatement;

  const args = this.evaluateFunctionArguments(node, context);
  const newScope: Scope = new Map<ts.ParameterDeclaration, ResolvedValue>();
  const calleeContext = {...context, scope: newScope};
  fn.parameters.forEach((param, index) => {
    let arg = args[index];
    if (param.node.dotDotDotToken !== undefined) {
      arg = args.slice(index);
    }
    if (arg === undefined && param.initializer !== null) {
      arg = this.visitExpression(param.initializer, calleeContext);
    }
    newScope.set(param.node, arg);
  });

  return ret.expression !== undefined
    ? this.visitExpression(ret.expression, calleeContext)
    : undefined;
}
```

Three branches, and all three matter:

- **`fn.body === null`** — the function has no body the compiler can see. An overload signature, or a function that exists only as a `declare function` in a `.d.ts`. The result is `DynamicValue.fromUnknown`, whose trace note is the bare `Unable to evaluate statically.`
- **more than one statement, or a single statement that is not a `return`** — `DynamicValue.fromComplexFunctionCall`, with the most self-explanatory message the compiler produces.
- **exactly one `return`** — the arguments are evaluated, bound into a fresh scope keyed by `ts.ParameterDeclaration`, and the returned expression is evaluated in that scope.

Note what the parameter loop handles: `dotDotDotToken` gives **rest parameters** the remaining evaluated arguments as an array, and `param.initializer` gives **default parameter values** their fallback, evaluated in the callee's own scope. Neither is a special case you have to avoid.

The failure message, verbatim from `partial_evaluator/src/diagnostics.ts`:

> *"Unable to evaluate function call of complex function. A function must have exactly one return statement."*

with a second related note pointing at the declaration: *"Function is declared here."* When you see those two lines stacked, you are not looking at a rule about *whether* helpers are allowed. You are looking at a rule about the *shape* of one.

## The documentation's version, and where it is stale

The AOT compilation guide states the same rule in ViewEngine vocabulary:

> *"The collector accepts any function or static method that contains a single `return` statement."*

⚠️ There is no collector in `ngtsc` — that machinery, along with `.metadata.json` and `StaticReflector`, belongs to ViewEngine and is gone. But the *rule* survived the rewrite unchanged, and the guide's worked example is still exactly correct at v22.1.5:

```ts
export function wrapInArray<T>(value: T): T[] {
  return [value];
}

@NgModule({
  declarations: wrapInArray(Typical),
})
export class TypicalModule {}
```

> *"The compiler treats this usage as if you had written: `@NgModule({declarations: [Typical]})`"*

That sentence is the whole mechanism in one line. The call is not deferred, not preserved, not emitted — it is **folded away during the build**, and what lands in the generated definition is the value it returned. The guide also names the canonical instance in the framework itself:

> *"The Angular `RouterModule` exports two macro static methods, `forRoot` and `forChild`, to help declare root and child routes."*

`forRoot` is a static method with a single `return` of an object literal. That is not an accident of style; it is the only shape that could have worked.

## Where the rule does not apply — and this catches people

The single-return rule is about **a call in a field position of metadata that is evaluated**. It says nothing about the decorator argument itself, which is governed by the syntactic gate in [09](09-static-analysability-is-the-load-bearing-constraint.md) and never reaches the evaluator at all:

```ts
// ⛔ NG1001 — Gate 1 is syntactic; a CallExpression is not an ObjectLiteralExpression,
//    and the single-return rule never gets a chance to run.
import {Component} from '@angular/core';

export function buildMeta() {
  return {selector: 'app-report', template: '<h2>Report</h2>'};
}

@Component(buildMeta())
export class Report {}
```

```ts
// ✅ the identical helper shape, one level in, is resolved by the evaluator
import {Component, Type} from '@angular/core';
import {ReportRow} from './report-row';

export function wrapInArray<T>(value: T): Type<T>[] {
  return [value as unknown as Type<T>];
}

@Component({
  selector: 'app-report',
  imports: wrapInArray(ReportRow),
  template: '<report-row />',
})
export class Report {}
```

**Same function, same call, opposite outcomes** — because one of them sits where a syntax check runs and the other sits where an evaluator runs. If you remember one thing from this page, make it that.

⚠️ **What this page does not establish:** whether an arrow function assigned to a `const` — `export const wrapInArray = <T,>(v: T): T[] => [v];` — is reachable as a callee. `visitFunctionBody` takes a `FunctionDefinition` produced by the reflection host, and the source read behind this page did not cover which declaration forms that host recognises. The forms that are demonstrably supported, because the framework and the documentation both use them, are the **exported `function` declaration** and the **static method**. Write those.

## What you were told was banned and is not

Collecting the corrections from [09](09-static-analysability-is-the-load-bearing-constraint.md), [09b](09b-gate-two-what-is-evaluated-and-what-is-relayed.md) and [09c](09c-the-partial-evaluator-is-the-grammar.md) into one table, because the folklore is denser than the rules:

| Believed banned | Actually | Because |
|---|---|---|
| Identifiers as field values | fine | `ts.isIdentifier` is in the dispatch; `visitIdentifier` follows it to a declaration |
| Calling a helper to build a field | fine, with one `return` | `visitFunctionBody` |
| Arrow functions in `providers` | fine | `providers` is never evaluated ([09b](09b-gate-two-what-is-evaluated-and-what-is-relayed.md)) |
| Template-literal interpolation in a `selector` | fine | `visitTemplateExpression` |
| An `as` cast around the decorator argument | fine | `unwrapExpression` |
| Object spread inside the decorator literal | fine | it is still an object literal; the spread operand must fold |
| Nested arrays in `imports` | fine | `validateAndFlattenComponentImports` recurses ([09f](09f-imports-and-the-rule-about-lazy-loading.md)) |
| Rest and default parameters in a macro helper | fine | the `dotDotDotToken` and `initializer` branches above |
| Bitwise arithmetic in metadata | fine | `BINARY_OPERATORS` ([09c](09c-the-partial-evaluator-is-the-grammar.md)) |
| Non-exported classes | mostly fine since v22.1.4 | see **10 · Metadata errors, one by one** *(not written yet)* |

## Gotchas

**★ Symptom: `Unable to evaluate function call of complex function. A function must have exactly one return statement.` on a helper that returns a perfectly ordinary array.** Cause: the body has more than one statement — a local `const`, a guard clause, a `console.log` left behind. `fn.body.length !== 1` is checked before anything else. Fix: collapse the body to one `return`; local variables become inline expressions, and a guard becomes a conditional, which the evaluator supports:

```ts
// ⛔ two statements — DynamicValue.fromComplexFunctionCall
export function featureImportsVerbose(includeCharts: boolean) {
  const base = [SummaryCard, DetailRow];
  return includeCharts ? [...base, ChartPanel] : base;
}

// ✅ one return — folds
import {SummaryCard} from './summary-card';
import {DetailRow} from './detail-row';
import {ChartPanel} from './chart-panel';

export function featureImports(includeCharts: boolean) {
  return includeCharts ? [SummaryCard, DetailRow, ChartPanel] : [SummaryCard, DetailRow];
}
```

**★ Symptom: a macro helper worked for months, someone adds a logging line "for debugging", and every component that calls it fails to compile.** Cause: the added statement pushed `fn.body.length` past 1, and the evaluator stops entering the function entirely — the diagnostic appears on the *call sites*, not on the function that changed. Fix: read the second related-information note, *"Function is declared here."*, which points at the real culprit, and take the statement back out:

```ts
import {Routes} from '@angular/router';
import {AdminHome} from './admin-home';

// A macro function is a single expression. Instrument its callers, never its body.
export function adminRoutes(prefix: string = 'admin'): Routes {
  return [{path: prefix, component: AdminHome}];
}
```

**★ Symptom: `@Component(buildMeta())` fails with NG1001 while `imports: buildImports()` in the same codebase compiles.** Cause: two different gates. The decorator argument is checked syntactically with `ts.isObjectLiteralExpression` and a call expression fails outright; a field value goes to the evaluator, which will enter a single-return function. Fix: keep the literal at the decorator and push the helper one level in:

```ts
import {Component} from '@angular/core';
import {ReportRow} from './report-row';
import {ReportFooter} from './report-footer';

export function reportImports() {
  return [ReportRow, ReportFooter];
}

@Component({
  selector: 'app-report',
  imports: reportImports(),
  template: '<report-row /><report-footer />',
})
export class Report {}
```

⚠️ This compiles, but if the component has a `@defer` block, prefer literal identifiers anyway — deferral needs the array elements to be literal references, which is a stricter rule than compilation's ([11b](11b-the-nine-conditions-and-the-barrel-trap.md)).

**Symptom: a helper imported from a published package produces `Unable to evaluate statically.` rather than the "complex function" message, and the package's source looks like a single return.** Cause: you are not looking at the source the compiler is. The package ships `.d.ts` declarations, so `fn.body === null` and the branch taken is `DynamicValue.fromUnknown`, whose trace note is the generic one. The published `.js` is irrelevant — the evaluator reads declarations, not emitted code. Fix: for values that must fold, do not depend on a library function at all; declare the value in your own compilation unit:

```ts
// app/routes.ts — in your compilation, so the initializer is visible
import {Routes} from '@angular/router';
import {AdminHome} from './admin/admin-home';

export const ADMIN_ROUTES: Routes = [{path: 'admin', component: AdminHome}];
```

**Symptom: a default parameter value stops the helper folding even though the caller passes an argument.** Cause: it will not — an unpassed parameter falls back to `param.initializer` evaluated in the callee's scope, and a passed argument shadows it. But if the *default expression itself* does not fold and the caller omits the argument, that failure propagates outward as `fromDynamicInput`. Fix: make the default a foldable literal, not a call:

```ts
import {Routes} from '@angular/router';
import {SettingsHome} from './settings-home';

// 'settings' is a literal; the default folds whether or not the caller passes one.
export function settingsRoutes(prefix: string = 'settings'): Routes {
  return [{path: prefix, component: SettingsHome}];
}
```

## Interview questions

**★ The compiler can call `wrapInArray(Typical)` but not `buildDeclarations()`. What is the rule, and why is it drawn there?**
The rule is `visitFunctionBody`: the compiler will enter a function only if its body is exactly one `return` statement, in which case it binds the evaluated arguments into a scope and evaluates the returned expression. Anything else is `DynamicValue.fromComplexFunctionCall`. The line is drawn there because a single-return function is a *pure expression with holes in it* — it can be folded by the same recursive evaluator that handles any other expression, with a parameter scope layered on top. The moment there is a second statement, the evaluator would need control flow, local assignment, loops and short-circuiting — it would need to be a JavaScript interpreter, which is precisely what a static analyser is trying not to be. One return is the largest amount of function you can support without executing the program.

**★ If metadata must be statically analysable, how has `RouterModule.forRoot(routes)` been legal since Angular 2?**
Because it is a macro static method — a single `return` of an object literal — and the partial evaluator folds it away at build time. The AOT guide names it explicitly as one of two macro static methods `RouterModule` exports for this purpose. What lands in the compiled output is not a call to `forRoot`; it is the value `forRoot` returned, computed during the build. The same mechanism is why the `provide*` function convention that replaced `forRoot` works at all, and why the guide's `wrapInArray` example can be described as compiling "as if you had written" the literal.

**★ Why does a helper call work as a field value but not as the whole decorator argument?**
They are checked by different code at different stages. The decorator argument passes through `unwrapExpression` and then a raw `ts.isObjectLiteralExpression` test — a syntactic check that produces NG1001 and never invokes the evaluator. Only after that gate does the compiler start evaluating individual fields, and that is where `visitCallExpression` and the single-return rule live. So `@Component(buildMeta())` is rejected for its node kind, while `imports: buildImports()` is resolved for its value. Understanding that the two gates are separate is what lets you predict outcomes instead of memorising them.

**What is the difference between the "complex function" message and the plain `Unable to evaluate statically.` note, when both come from a function call?**
They are different branches of the same three-way check. `DynamicValue.fromComplexFunctionCall` means the compiler could see the body and the body was not a single `return` — you own the function and you can fix it. `DynamicValue.fromUnknown`, whose trace note is the generic `Unable to evaluate statically.`, is what you get when `fn.body === null`: an overload signature or a function that exists only as a declaration, typically because it comes from a package's `.d.ts`. The second one is not fixable by reshaping the function, because the body the compiler needs is not in the compilation at all.

**Does a rest parameter or a default parameter value make a macro function unanalysable?**
No — both are explicitly handled. The parameter loop checks `param.node.dotDotDotToken` and gives a rest parameter the slice of remaining evaluated arguments as an array, and checks `param.initializer` when an argument was not supplied, evaluating the default in the callee's own scope. The only way either can cause a failure is indirectly: if a passed argument or a default expression does not itself fold, that `DynamicValue` propagates out through the return expression. The parameter machinery is not the constraint; the expressions flowing through it are.

---

← Prev: [09c · The evaluator is the grammar](09c-the-partial-evaluator-is-the-grammar.md) · Index: [Topic index](README.md) · Next → [09e · selector must reduce to a string](09e-selector-must-reduce-to-a-string.md)
