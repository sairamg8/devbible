---
title: "A function and a class are values in JavaScript and three different things to the partial evaluator, which is why `const f = () => 'x'` and `function f() { return 'x'; }` — identical at runtime — produce two different compiler errors, and only one of them can be fixed by calling it"
sidebar_label: "10hb · Code as a metadata value"
sidebar_position: 10.71
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts),
> [`packages/compiler-cli/src/ngtsc/reflection/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/reflection/src/util.ts),
> [`packages/compiler-cli/src/ngtsc/reflection/src/typescript.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/reflection/src/typescript.ts);
> and `microsoft/TypeScript` at tag `v6.0.3`:
> [`src/compiler/types.ts`](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/types.ts) for `ClassExpression` and `ArrowFunction`.
> Documentation-validated; **no sandbox run** — every message below is a string literal read from one of those files.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not**. Match on the message text.

**Every "AOT metadata rules" list says the same thing about functions: no arrow functions, no lambdas, use an exported named function. The rule is roughly right and the reason given for it is wrong, and the wrong reason costs you the ability to predict anything else. What actually happens is that `visitExpression` and `visitDeclaration` are two separate dispatches with two separate fallthroughs. A function *declaration* is never an expression, so it falls out of `visitDeclaration`'s final `else` as a `Reference` — a resolvable thing, which a call expression can then evaluate. An arrow function bound to a `const` is an expression with no branch, so it falls out of `visitExpression`'s final `else` as unsupported syntax, and calling it makes no difference because the callee is evaluated first. Same for classes: a `ts.ClassDeclaration` with a name is a class, and a `ts.ClassExpression` is not a class, is not anything else either, and is door one. This chunk works all of it, plus the object-literal members that look like the same failure and print a different message.**

## Two dispatches, two fallthroughs

[10h](10h-syntax-the-evaluator-cannot-read.md) quotes `visitExpression`'s fallthrough. Here is the other one — `visitDeclaration`, verbatim, ending in something very different:

```ts
private visitDeclaration(node: DeclarationNode, context: Context): ResolvedValue {
  if (this.dependencyTracker !== null) {
    this.dependencyTracker.addDependency(context.originatingFile, node.getSourceFile());
  }
  if (this.host.isClass(node)) {
    return this.getReference(node, context);
  } else if (ts.isVariableDeclaration(node)) {
    return this.visitVariableDeclaration(node, context);
  } else if (ts.isParameter(node) && context.scope.has(node)) {
    return context.scope.get(node)!;
  } else if (ts.isExportAssignment(node)) {
    return this.visitExpression(node.expression, context);
  } else if (ts.isEnumDeclaration(node)) {
    return this.visitEnumDeclaration(node, context);
  } else if (ts.isSourceFile(node)) {
    return this.visitSourceFile(node, context);
  } else if (ts.isBindingElement(node)) {
    return this.visitBindingElement(node, context);
  } else {
    return this.getReference(node, context);
  }
}
```

🔴 **`visitExpression`'s fallthrough is a failure; `visitDeclaration`'s fallthrough is a success.** One returns `DynamicValue.fromUnsupportedSyntax`, the other returns `this.getReference(node, context)` — a `Reference`, which is a first-class resolved value. A `ts.FunctionDeclaration` matches none of the tests above, so it lands in that final `else` and becomes a reference to itself.

Which of the two dispatches your code reaches depends on **where the node sits**, not on what it is:

- an identifier in metadata → `visitIdentifier` → `visitDeclaration` on whatever it names;
- a `const`'s initializer → `visitVariableDeclaration` → `visitExpression` on the initializer.

A function declaration can only ever be reached as a declaration. An arrow function can only ever be reached as an expression.

## The four spellings, and their four outcomes

```ts
// src/app/card-selector.ts

// (a) a function declaration with a single return statement
export function cardSelector(): string {
  return 'app-user-card';
}

// (b) the same thing as a const-bound arrow
export const cardSelectorArrow = (): string => 'app-user-card';

// (c) the same thing as a const-bound function expression
export const cardSelectorFn = function (): string {
  return 'app-user-card';
};
```

| what you wrote in `selector:` | path | what you see |
|---|---|---|
| `cardSelector` | identifier → `visitDeclaration` → final `else` → `getReference` | `Value is a reference to 'cardSelector'.` |
| `cardSelector()` | `visitCallExpression`, callee is a `Reference` to a single-return function → folds | nothing — it compiles |
| `cardSelectorArrow` | identifier → `visitVariableDeclaration` → `visitExpression(ArrowFunction)` → **door one** | `This syntax is not supported.` |
| `cardSelectorArrow()` | `visitCallExpression` evaluates the callee first, gets the above, re-wraps it | `This syntax is not supported.`, span on the arrow |

Row three and row four have the same cause and the same span. Rows (b) and (c) behave identically — `ts.ArrowFunction` and `ts.FunctionExpression` are separate interfaces in TypeScript and neither has a branch.

The single fix covers all of them:

```ts
// ✅ a named function declaration with a single return statement.
export function cardSelector(): string {
  return 'app-user-card';
}
```

```ts
import {Component} from '@angular/core';
import {cardSelector} from './card-selector';

@Component({
  selector: cardSelector(),
  template: `<h2 class="name">{{ name }}</h2>`,
})
export class UserCard {
  protected readonly name = 'Ada';
}
```

⚠️ **Row two's "it compiles" carries a condition this page does not own.** `visitCallExpression` will only fold a call whose body is a single return statement; a two-statement body produces `Unable to evaluate function call of complex function. A function must have exactly one return statement.` That rule is [10g · Calls, enums and the values in between](10g-calls-enums-and-the-values-in-between.md). The rule *this* page owns is narrower and absolute: an arrow never gets as far as being asked about its body.

## Class expressions — `ts.ClassExpression`

The chain's last positive test is `this.host.isClass(node)`. `TypeScriptReflectionHost.isClass` delegates to one predicate, verbatim from `reflection/src/util.ts`:

```ts
export function isNamedClassDeclaration(
  node: ts.Node,
): node is ClassDeclaration<ts.ClassDeclaration> {
  return ts.isClassDeclaration(node) && isIdentifier(node.name);
}
```

and the comment on the caller, verbatim from `reflection/src/typescript.ts`:

```ts
isClass(node: ts.Node): node is ClassDeclaration {
  // For our purposes, classes are "named" ts.ClassDeclarations;
  // (`node.name` can be undefined in unnamed default exports: `default export class { ... }`).
  return isNamedClassDeclaration(node);
}
```

Two independent requirements, and each one fails differently:

```ts
// ⛔ a class expression — ts.isClassDeclaration is false, so it is door one.
// export const Badge = class {
//   readonly label = 'new';
// };

// ✅ a class declaration, named.
export class Badge {
  readonly label = 'new';
}
```

🔴 **An anonymous `export default class {}` is not this error.** It *is* a `ts.ClassDeclaration`, so `visitExpression` never sees it as an expression; it reaches `visitDeclaration`, fails `isClass` on the name check, matches none of the other tests and falls out of the final `else` as a `Reference` with no debug name. The chain sentence you get is `Value is a reference to an anonymous declaration.` — built by `createValueHasWrongTypeError`'s `Reference` branch ([10](10-metadata-errors-one-by-one.md)). Same root cause, entirely different message, and the fix is the same: give the class a name.

```ts
// ⛔ export default class { }        -> Value is a reference to an anonymous declaration.
// ✅
export default class UserCard {}
```

## Methods, getters and setters inside a metadata object

This is the near miss that costs the most time, because the code looks exactly like the arrow-function case and the message is a different one.

`visitObjectLiteralExpression` handles three property forms and has its own fallthrough, verbatim (the tail of the loop):

```ts
    } else if (ts.isSpreadAssignment(property)) {
      const spread = this.visitExpression(property.expression, context);
      if (spread instanceof DynamicValue) {
        return DynamicValue.fromDynamicInput(node, spread);
      } else if (spread instanceof Map) {
        spread.forEach((value, key) => map.set(key, value));
      } else if (spread instanceof ResolvedModule) {
        spread.getExports().forEach((value, key) => map.set(key, value));
      } else {
        return DynamicValue.fromDynamicInput(
          node,
          DynamicValue.fromInvalidExpressionType(property, spread),
        );
      }
    } else {
      return DynamicValue.fromUnknown(node);
    }
```

The three handled forms are `ts.isPropertyAssignment`, `ts.isShorthandPropertyAssignment` and `ts.isSpreadAssignment`. A **method declaration**, a **getter** and a **setter** in an object literal are none of those, so they hit `DynamicValue.fromUnknown(node)` — reason `UNKNOWN`, the residual bucket, printing `Unable to evaluate statically.`

```ts
// ⛔ a method in a metadata object -> Unable to evaluate statically.
// export const CARD_CONFIG = {
//   selector() {
//     return 'app-user-card';
//   },
// };

// ⛔ a getter, same message.
// export const CARD_CONFIG = {
//   get selector() {
//     return 'app-user-card';
//   },
// };

// ✅ a property assignment, which is one of the three handled forms.
export const CARD_CONFIG = {
  selector: 'app-user-card',
} as const;
```

⚠️ **Note where the span lands.** `fromUnknown(node)` is passed the whole **object literal**, not the offending member — so the squiggle covers the entire config object and tells you nothing about which key is at fault. That, combined with `UNKNOWN` naming no mechanism, makes this the least informative failure in the whole family. The counter-move is [10f](10f-destructuring-in-metadata.md)'s: split the object into separate statements until the span is small enough to be a fact.

## Gotchas

**★ Symptom: a helper works when written as `function` and fails when written as `const … = () =>`.** Cause: a function declaration is not an expression, so it reaches `visitDeclaration` and becomes a `Reference` that a call can evaluate; a `const`-bound arrow is an expression the chain does not test, so evaluating the *callee* already fails. Fix: declare metadata helpers as function declarations, never as arrow constants:

```ts
// ⛔ export const buildSelector = (name: string) => 'app-' + name;
// ✅
export function buildSelector(name: string): string {
  return `app-${name}`;
}
```

**★ Symptom: you converted an arrow to a function declaration and now get `Unable to evaluate function call of complex function.` instead.** Cause: you cleared the syntax gate and hit the next one — the callee is now resolvable, so the evaluator went on to look at its body and found more than one return statement. Fix: this is progress, not a regression; collapse the body to a single return expression, per [10g](10g-calls-enums-and-the-values-in-between.md):

```ts
// ⛔ export function buildSelector(name: string): string {
//   const prefix = 'app-';
//   return prefix + name;
// }
// ✅
export function buildSelector(name: string): string {
  return 'app-' + name;
}
```

**★ Symptom: `selector: cardSelector` (no parentheses) reports `Value is a reference to 'cardSelector'.` and you read it as an unresolved-symbol problem.** Cause: it resolved perfectly — to the function itself, because `visitDeclaration`'s final `else` returns a `Reference`. The field then rejected it for being a reference rather than a string. Fix: call it. The missing parentheses are the entire bug, and the message says so if you read the chain sentence as "what I got" rather than "what went wrong":

```ts
// ⛔ selector: cardSelector
// ✅ selector: cardSelector()
```

**★ Symptom: a method or getter inside a metadata constant reports `Unable to evaluate statically.` with the span on the whole object.** Cause: `visitObjectLiteralExpression` handles only property assignments, shorthand assignments and spreads; every other member kind falls to `DynamicValue.fromUnknown(node)`, and `node` is the object literal. Fix: rewrite the member as a property assignment; if the value needs computing, compute it into a `const` first so the failure, if any, gets its own statement and its own span.

**Symptom: an anonymous default-exported class cannot be used in `imports` and gives a message about "an anonymous declaration".** Cause: `isClass` requires `ts.isClassDeclaration(node) && isIdentifier(node.name)`, and an anonymous default export has no name; it becomes an unnamed `Reference`. Fix: name the class. Anonymous default exports also make every downstream diagnostic worse, because `identifierOfNode` has nothing to point at.

**Symptom: a class assigned to a `const` by a mixin factory breaks metadata even though the factory is a one-line function.** Cause: two rules stack. The call may fold, but what it returns in the source is a `ts.ClassExpression`, and a class expression is not a class to `isClass` — so whichever of the two the evaluator reaches first, the result is not usable as a directive reference. Fix: do not build Angular-decorated classes through mixin factories; the compiler needs a `ts.ClassDeclaration` node it can point an import at ([08e](08e-only-compiled-classes-are-renderable.md)).

**Symptom: shorthand property syntax in a metadata object behaves differently from the long form.** Cause: `ts.isShorthandPropertyAssignment` is handled, but through a different route — `getShorthandAssignmentValueSymbol`, and if that returns no symbol or no `valueDeclaration`, the entry becomes `DynamicValue.fromUnknown(property)`, which is the residual bucket again. Fix: when a shorthand entry misbehaves, write it long-hand; the long form goes through `visitExpression` and reports precisely:

```ts
const selector = 'app-user-card';

// ⛔ export const CARD_CONFIG = {selector};
// ✅
export const CARD_CONFIG = {selector: selector} as const;
```

## Interview questions

**★ Why does `const cardSelector = () => 'app-card'` fail in metadata while `function cardSelector() { return 'app-card'; }` does not?**
Because they are different node kinds reached through different dispatches with opposite fallthroughs. The function declaration is not an expression; when the evaluator resolves the identifier it lands in `visitDeclaration`, whose final `else` returns `getReference(node, context)` — a `Reference` to the function, which a call expression can then evaluate against the single-return rule. The arrow is an expression, and `ts.ArrowFunction` has no branch in `visitExpression`, so resolving the identifier evaluates the variable's initializer and immediately falls to door one with `This syntax is not supported.` Calling it does not help, because `visitCallExpression` evaluates the callee first and re-wraps the failure. The practical consequence is a style rule with a real payoff: metadata helpers are function declarations.

**★ Angular's AOT documentation says the compiler does not support arrow functions, and shows a `providers` example. Is the documentation right?**
It is right that an arrow function is unsupported *by an evaluator*, and wrong about the example, for this compiler. `providers` is one of the fields the directive handler relays into the emitted code without evaluating it, so an arrow function there is emitted verbatim and nothing complains. The underlying observation survives — an arrow in an evaluated field really does hit door one — but the demonstration does not, because it was written for View Engine's collector, which analysed metadata this compiler does not analyse. That whole class of stale rule is worked in [10he](10he-what-looks-like-this-error-and-is-not.md).

**A class expression and an anonymous default-exported class both fail. Why do they fail with different messages?**
Because they fail at different predicates in different dispatches. A `ts.ClassExpression` fails `ts.isClassDeclaration`, so `visitExpression` has no branch for it at all and it falls out as `UNSUPPORTED_SYNTAX`. An anonymous `export default class {}` *is* a `ts.ClassDeclaration`, so it is only ever reached as a declaration; it fails the second half of `isNamedClassDeclaration` — the name check — matches none of `visitDeclaration`'s other tests, and falls out of that dispatch's final `else` as an unnamed `Reference`, which prints `Value is a reference to an anonymous declaration.` One is "I have no code for this shape"; the other is "I resolved it, and what I got is a declaration with no name". Both are fixed by writing a named class declaration, which is also what the emitted code needs to import.

**Why is a getter in a metadata object a worse diagnostic than an arrow function in one?**
Because it lands in the residual bucket rather than the syntax bucket. `visitObjectLiteralExpression` handles exactly three member forms and everything else returns `DynamicValue.fromUnknown(node)`, whose reason `UNKNOWN` is documented as *"A value could not be determined statically for any reason other the above"* and prints `Unable to evaluate statically.` — a sentence that names no mechanism. Worse, the node handed to `fromUnknown` is the whole object literal, so the span covers the entire constant instead of the offending member. An arrow function at least gets `This syntax is not supported.` with a span on the arrow. When you see the object-wide span with the residual message, the member forms are the first thing to check, before anything about values.

**Someone proposes generating Angular components with a mixin factory that returns a class expression. What do you tell them?**
That the compiler needs a `ts.ClassDeclaration` to work with, at two separate points, and a class expression satisfies neither. The partial evaluator's `isClass` is `ts.isClassDeclaration(node) && isIdentifier(node.name)`, so a class expression is not recognisable as a class in metadata. Separately, the compiler must be able to emit an *import* naming that class from another file when it appears in someone's `imports` array, and a class that only exists as the return value of a factory call has no importable declaration to name. The failure will show up as a syntax error at the class expression, or as a reference-emit failure ([10c](10c-symbols-the-compiler-cannot-resolve.md)) — but either way the pattern is not available, and the alternative is composition through inheritance from a plain base class ([12b](12b-inheritance-and-the-undecorated-base.md)).

← Prev: [Syntax the evaluator cannot read](10h-syntax-the-evaluator-cannot-read.md) · Index: [Topic index](README.md) · Next → [TypeScript it never heard of](10hc-the-typescript-the-evaluator-has-never-heard-of.md)
