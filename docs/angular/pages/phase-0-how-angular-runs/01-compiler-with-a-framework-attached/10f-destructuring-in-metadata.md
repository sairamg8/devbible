---
title: "Destructuring in decorator metadata works, the guides that say otherwise are quoting a compiler Angular stopped shipping, and the three forms that genuinely fail all collapse into the single least informative message the compiler can emit"
sidebar_label: "10f · Destructuring in metadata"
sidebar_position: 10.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/diagnostics.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/diagnostics.ts);
> and angular.dev [Ahead-of-time (AOT) compilation](https://angular.dev/tools/cli/aot-compiler), ⚠️ which describes the View Engine metadata collector and is contradicted below.
> Documentation-validated; **no sandbox run** — every message below is a string literal read from one of those files.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not** — it comes from research prose rather than a line of `error_code.ts`. Match on the message text.

**Almost every "AOT metadata rules" list you will find says destructuring is unsupported. It is not, and it has not been for as long as `ngtsc` has existed. Those lists describe the View Engine metadata collector — a program with a `.metadata.json` output, a `StaticReflector` and a code-folding pass, none of which Angular ships any more. The current evaluator has a complete `visitBindingElement` that walks a binding pattern back to its variable declaration and re-applies the path to the resolved initializer. It fails in exactly three ways, all three return the same `DynamicValue.fromUnknown`, and all three therefore print the single least informative message in the whole catalogue — which is why a destructuring failure feels unfixable until you know there are only three candidates.**

## ⚠️ Why the documented rule is wrong rather than merely old

angular.dev's [AOT compilation](https://angular.dev/tools/cli/aot-compiler) page describes phases built around a *collector* that emitted `.metadata.json` files and a `StaticReflector` that read them back. `ngtsc` has no collector and emits no `.metadata.json`; it is a `ts.CustomTransformers` pipeline with a `StaticInterpreter` partial evaluator running inside the TypeScript program. So that page's rules are not a stale description of the current compiler — they are an accurate description of a different one.

**Treat everything on that page as evidence about intent and nothing on it as evidence about behaviour.** Destructuring is the clearest case where the two diverge; the arrow-functions-in-`providers` rule is another, covered in **10h · Syntax the evaluator cannot read** *(not written yet)*.

## What actually runs

`interpreter.ts`, `visitBindingElement`, verbatim:

```ts
private visitBindingElement(node: ts.BindingElement, context: Context): ResolvedValue {
  const path: ts.BindingElement[] = [];
  let closestDeclaration: ts.Node = node;

  while (
    ts.isBindingElement(closestDeclaration) ||
    ts.isArrayBindingPattern(closestDeclaration) ||
    ts.isObjectBindingPattern(closestDeclaration)
  ) {
    if (ts.isBindingElement(closestDeclaration)) {
      path.unshift(closestDeclaration);
    }

    closestDeclaration = closestDeclaration.parent;
  }

  if (
    !ts.isVariableDeclaration(closestDeclaration) ||
    closestDeclaration.initializer === undefined
  ) {
    return DynamicValue.fromUnknown(node);
  }

  let value = this.visit(closestDeclaration.initializer, context);
  for (const element of path) {
    let key: number | string;
    if (ts.isArrayBindingPattern(element.parent)) {
      key = element.parent.elements.indexOf(element);
    } else {
      const name = element.propertyName || element.name;
      if (ts.isIdentifier(name)) {
        key = name.text;
      } else {
        return DynamicValue.fromUnknown(element);
      }
    }
    value = this.accessHelper(element, value, key, context);
    if (value instanceof DynamicValue) {
      return value;
    }
  }

  return value;
}
```

Two loops. The first walks *up* from the binding element through every enclosing pattern, collecting the path in reverse and stopping at whatever is not a pattern. The second walks the path *down* the resolved initializer — property names for object patterns, positional indices for array patterns — using the same `accessHelper` that ordinary property access uses.

So both of these fold, and so does any nesting of them:

```ts
// src/app/card-config.ts
export const CARD_CONFIG = {
  selector: 'app-user-card',
  exportAs: 'userCard',
  hosts: {row: 'app-user-row'},
} as const;

export const SELECTORS = ['app-user-card', 'app-user-row'] as const;

// ✅ object pattern — path is ['selector'], applied to the resolved literal.
const {selector} = CARD_CONFIG;

// ✅ array pattern — path is [0].
const [first] = SELECTORS;

// ✅ nested, and renamed — path is ['hosts', 'row'].
const {hosts: {row: rowSelector}} = CARD_CONFIG;

export const CARD_SELECTOR = selector;
export const FIRST_SELECTOR = first;
export const ROW_SELECTOR = rowSelector;
```

```ts
import {Component} from '@angular/core';
import {CARD_SELECTOR, ROW_SELECTOR} from './card-config';

@Component({
  selector: CARD_SELECTOR,
  template: `<h2 class="name">{{ name }}</h2>`,
})
export class UserCard {
  protected readonly name = 'Ada';
}

@Component({
  selector: ROW_SELECTOR,
  template: `<td class="name">{{ name }}</td>`,
})
export class UserRow {
  protected readonly name = 'Ada';
}
```

🔴 **The precise rule is not "destructuring is supported".** It is: *destructuring is a way of reading a value the evaluator can already fold*, and it inherits every condition that value has to meet. If the initializer does not fold, the destructuring cannot rescue it — and the error you get will be about the initializer, not about the pattern.

## The three forms that fail

All three return `DynamicValue.fromUnknown`, which routes through `visitUnknown` in `TraceDynamicValueVisitor` and prints exactly `Unable to evaluate statically.` — the residual bucket, whose reason `UNKNOWN` is documented as *"A value could not be determined statically for any reason other the above."*

### 1 — the closest declaration has no initializer

The `closestDeclaration.initializer === undefined` half of the guard.

```ts
// ⛔ declared here, assigned later — no initializer on the declaration itself.
// let cardConfig: {selector: string};
// cardConfig = {selector: 'app-user-card'};
// const {selector} = cardConfig;

// ✅
const cardConfig = {selector: 'app-user-card'} as const;
const {selector} = cardConfig;
export const CARD_SELECTOR = selector;
```

### 2 — a destructured function parameter

The walk terminates on a `ts.ParameterDeclaration`, which fails `ts.isVariableDeclaration`. A single-return helper that destructures its own argument therefore cannot fold *its parameter*, even though the call itself would otherwise be foldable:

```ts
interface CardOptions {
  readonly selector: string;
}

// ⛔ the parameter pattern is not a variable declaration → `Unable to evaluate statically.`
// export function pickSelectorBad({selector}: CardOptions): string {
//   return selector;
// }

// ✅ take the whole object and read from it inside the single return expression.
export function pickSelector(options: CardOptions): string {
  return options.selector;
}

export const CARD_SELECTOR = pickSelector({selector: 'app-user-card'});
```

### 3 — a computed property name in the pattern

The `ts.isIdentifier(name)` check inside the second loop.

```ts
export const CARD_CONFIG = {
  selector: 'app-user-card',
  exportAs: 'userCard',
} as const;

const SELECTOR_KEY = 'selector';

// ⛔ computed property name in the pattern → `Unable to evaluate statically.`
// const {[SELECTOR_KEY]: computedSelector} = CARD_CONFIG;

// ✅ an element access goes through `visitElementAccessExpression` and folds.
export const CARD_SELECTOR = CARD_CONFIG[SELECTOR_KEY];
```

⚠️ Note what changed in that last fix: the *key* was always foldable. It is the pattern syntax that has no path for a computed name, not the key expression. Moving the same computation into an element access reaches a code path that handles it.

## The trace collapses to one entry per pattern

The de-duplication rule in `TraceDynamicValueVisitor` names destructuring patterns explicitly as containers, verbatim:

```ts
/**
 * Determines the closest parent node that is to be considered as container, which is used to reduce
 * the granularity of tracing the dynamic values to a single entry per container. Currently, full
 * statements and destructuring patterns are considered as container.
 */
```

So a pattern with six bindings and two problems produces **one** breadcrumb, pointing at the pattern. Combined with the fact that all three failures print the same message, this is the worst diagnostic surface in the catalogue: one uninformative sentence, one span covering the whole pattern, and no indication which of three causes applied. Knowing the list of three is the entire remedy.

## Gotchas

**★ Symptom: a guide says destructuring is unsupported in metadata and your destructured constant compiles fine.** Cause: the guide is describing the View Engine metadata collector, which `ngtsc` replaced — a different program with a different output format. `visitBindingElement` handles object patterns, array patterns, renames and arbitrary nesting. Fix: nothing to fix, but stop using that page to predict this compiler's behaviour on anything else either.

**★ Symptom: `Unable to evaluate statically.` with a trace pointing at a destructuring pattern and no further detail.** Cause: one of the three `DynamicValue.fromUnknown` returns — no initializer, a function parameter, or a computed property name — and the trace de-duplicates to one entry per pattern. Fix: check the three in that order, then rewrite the binding as a property or element access, which routes through code paths that report precisely:

```ts
export const CARD_CONFIG = {selector: 'app-user-card'} as const;

// Where the pattern was ambiguous, the access is not.
export const CARD_SELECTOR = CARD_CONFIG.selector;
```

**★ Symptom: `const {selector} = getConfig();` fails while `const {selector} = CONFIG;` works.** Cause: `visitBindingElement` evaluates the closest variable declaration's *initializer*, and a call expression only folds if the callee has a single-return body reachable in the program. The destructuring is not the problem; the call is. Fix: check the call first — see the single-return rule in **10g · Calls, enums and the values in between** *(not written yet)*.

**Symptom: a helper that destructures its options parameter breaks metadata, and inlining it fixes everything.** Cause: the parameter pattern's closest declaration is a `ts.ParameterDeclaration`, not a `ts.VariableDeclaration`, so the guard fires — regardless of how simple the helper is. Fix: keep the parameter whole and read properties off it inside the return expression, as shown above. The single-return rule and the destructuring rule are independent, and a helper has to satisfy both.

**Symptom: you split one destructuring statement into two and suddenly get two different errors instead of one.** Cause: the container rule is one entry per pattern, so merging bindings into one pattern merges their diagnostics. Fix: this is the *good* direction — split patterns while debugging to get one message per problem, then merge back if you prefer the style.

**Symptom: a rename in the pattern (`const {selector: sel} = CONFIG;`) makes you suspect the rename is the problem.** Cause: it is not — the loop reads `element.propertyName || element.name`, so a rename is handled explicitly and the *original* key is what gets looked up. Fix: look elsewhere; renames are a supported form and the failure is one of the three.

**Symptom: array destructuring with a hole or a rest element behaves unexpectedly.** Cause: the key for an array pattern is `element.parent.elements.indexOf(element)` — a positional index into the pattern's element list. This page did not read how omitted elements and rest elements are represented in that list, so **their behaviour here is not settled by the source excerpt above.** Fix: do not rely on holes or rest elements in metadata; take the whole array and index it explicitly, which uses a code path this page can vouch for.

## Interview questions

**★ Is destructuring supported in Angular metadata? Answer carefully.**
Yes, with three exceptions, and the guides that say otherwise are describing View Engine's metadata collector rather than `ngtsc`. `visitBindingElement` walks the binding pattern back to the closest variable declaration, requires that declaration to have an initializer, and then re-applies the path — property names for object patterns, positional indices for array patterns, with renames handled explicitly. It fails if there is no initializer, if the closest declaration is a function parameter rather than a variable, or if the pattern uses a computed property name; all three return `DynamicValue.fromUnknown`, so all three produce the same uninformative `Unable to evaluate statically.` The careful answer is that destructuring is supported *as a way of reading a value the evaluator can already fold*, which is the same condition every other expression has to meet.

**★ Why is `Unable to evaluate statically.` the worst message in the catalogue, and what should you do when you get one?**
Because `UNKNOWN` is the residual reason — its doc comment says *"A value could not be determined statically for any reason other the above"* — so unlike the other nine it names no mechanism. In practice its highest-probability producer is a destructuring pattern that failed one of its three guards, so the first thing to do is look at the statement the trace points at and check whether a binding pattern is involved. If one is, work the three causes in order and then rewrite the binding as a property or element access, which routes through code paths that report precisely. If no pattern is involved you are in genuinely unmapped territory, and the message is telling you so honestly rather than guessing.

**A helper function that destructures its own parameter cannot be used to build metadata even though it is one line long. Why?**
Because two independent rules have to hold and the parameter form breaks the second. The call itself is foldable if the function body is a single return statement, which a one-liner satisfies. But when the evaluator reaches the destructured parameter inside that body, `visitBindingElement` walks up from the binding element and lands on a `ts.ParameterDeclaration`, which is not a `ts.VariableDeclaration`, so the guard returns `DynamicValue.fromUnknown`. The fix is to accept the options object whole and read properties off it in the return expression, which keeps the single-return shape and avoids the pattern entirely.

**Why does the trace show one entry for a six-binding destructuring pattern?**
Because `TraceDynamicValueVisitor` treats a destructuring pattern as a *container* and reduces tracing to one entry per container, exactly as it does for a full statement. The intent is to avoid printing a breadcrumb per binding when they all failed for the same reason. The cost is that a pattern with two independent problems reports one, and reports the second only after you fix the first. Splitting the pattern while debugging is the practical counter-move — it makes the containers finer, so the diagnostics get finer with them.

**What is the general lesson of "the documented rule was accurate about a compiler that no longer exists"?**
That a documentation page's *age* is less important than which implementation it describes. angular.dev's AOT page is not a slightly-outdated account of `ngtsc`; it is a correct account of the View Engine collector, a program with a different architecture, a different intermediate format and different rules. Reading it as approximately true of today's compiler produces confident, specific, wrong beliefs — destructuring being the clearest one. The reliable procedure is to check any metadata rule against `visitExpression`'s dispatch and the `partial_evaluator` visitors, which is what actually runs.

---

← Prev: [10e · Values that do not fold](10e-values-that-resolve-but-do-not-fold.md) · Index: [Topic index](README.md) · Next → [Why `@defer` can split a bundle no bundler could](11-why-defer-can-split-a-bundle.md)
