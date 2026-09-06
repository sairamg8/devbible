---
title: "There is no specification of what decorator metadata may contain — there is a 40-line `if/else` chain in `StaticInterpreter.visitExpression`, and its final `else` is the entire rule, which is how `||` can be supported while `??` is not and how bitwise operators can be legal here and banned in a template"
sidebar_label: "09c · The evaluator is the grammar"
sidebar_position: 9.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts);
> and angular.dev [Expression syntax](https://angular.dev/guide/templates/expression-syntax) for the contrasting *template* grammar.
> Documentation-validated; **no sandbox run** — every code block is source read from a named file or an illustrative component, and nothing was compiled or executed.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**For the fields [09b](09b-gate-two-what-is-evaluated-and-what-is-relayed.md) says are evaluated, the question "is this expression allowed?" has an exact answer, and it is not in any document. It is one `if/else` chain in `StaticInterpreter.visitExpression`, which tests the TypeScript node kind against a fixed list and returns `DynamicValue.fromUnsupportedSyntax(node)` for everything else. Read that chain and you can predict any case, including the ones no documentation covers: why `||` folds and `??` does not, why `new Foo()` is out but `-x` and `x >>> 2` are in, why a tagged template literal is legal in an Angular *template* and illegal in the metadata one line above it.**

## The dispatch is the grammar

`partial_evaluator/src/interpreter.ts`, `StaticInterpreter.visitExpression` — the complete dispatch, verbatim at `v22.1.5`:

```ts
private visitExpression(node: ts.Expression, context: Context): ResolvedValue {
  let result: ResolvedValue;
  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  } else if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  } else if (node.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  } else if (ts.isStringLiteral(node)) {
    return node.text;
  } else if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  } else if (ts.isTemplateExpression(node)) {
    result = this.visitTemplateExpression(node, context);
  } else if (ts.isNumericLiteral(node)) {
    return parseFloat(node.text);
  } else if (ts.isObjectLiteralExpression(node)) {
    result = this.visitObjectLiteralExpression(node, context);
  } else if (ts.isIdentifier(node)) {
    result = this.visitIdentifier(node, context);
  } else if (ts.isPropertyAccessExpression(node)) {
    result = this.visitPropertyAccessExpression(node, context);
  } else if (ts.isCallExpression(node)) {
    result = this.visitCallExpression(node, context);
  } else if (ts.isConditionalExpression(node)) {
    result = this.visitConditionalExpression(node, context);
  } else if (ts.isPrefixUnaryExpression(node)) {
    result = this.visitPrefixUnaryExpression(node, context);
  } else if (ts.isBinaryExpression(node)) {
    result = this.visitBinaryExpression(node, context);
  } else if (ts.isArrayLiteralExpression(node)) {
    result = this.visitArrayLiteralExpression(node, context);
  } else if (ts.isParenthesizedExpression(node)) {
    result = this.visitParenthesizedExpression(node, context);
  } else if (ts.isElementAccessExpression(node)) {
    result = this.visitElementAccessExpression(node, context);
  } else if (ts.isAsExpression(node)) {
    result = this.visitExpression(node.expression, context);
  } else if (ts.isNonNullExpression(node)) {
    result = this.visitExpression(node.expression, context);
  } else if (this.host.isClass(node)) {
    result = this.visitDeclaration(node, context);
  } else {
    return DynamicValue.fromUnsupportedSyntax(node);
  }
  if (result instanceof DynamicValue && result.node !== node) {
    return DynamicValue.fromDynamicInput(node, result);
  }
  return result;
}
```

🔴 **That final `else` is the whole rule.** There is no allowlist document, no grammar file, no diagnostic that enumerates the supported forms. Anything whose `ts.SyntaxKind` is not tested above becomes `DynamicValue.fromUnsupportedSyntax`, and the field that asked for it reports that it could not be determined statically.

Two lines at the bottom are worth reading carefully as well. If a sub-expression produced a `DynamicValue` from a *different* node, the failure is re-wrapped as `fromDynamicInput` — that is what builds the chain of related-information notes you see stacked under a metadata error, one per level of the expression, so the squiggle lands on the outer expression and the notes point at the inner one that actually failed ([09g](09g-reading-a-metadata-failure.md)).

## What is not in the list

Read off the absent kinds directly. This is not a guess about intent; it is the complement of the chain above.

| You wrote | Node kind | Outcome |
|---|---|---|
| `new Server()` | `ts.NewExpression` | not tested — unsupported syntax |
| ``dedent`app-card` `` | `ts.TaggedTemplateExpression` | not tested — unsupported syntax |
| `() => 'app-card'` | `ts.ArrowFunction` | not tested — unsupported syntax **as a value to fold** |
| `function () { return 'x'; }` | `ts.FunctionExpression` | not tested — unsupported syntax as a value to fold |
| `typeof window` | `ts.TypeOfExpression` | not tested — unsupported syntax |
| `await loadConfig()` | `ts.AwaitExpression` | not tested — unsupported syntax |
| `void 0` | `ts.VoidExpression` | not tested — unsupported syntax |
| `delete meta.selector` | `ts.DeleteExpression` | not tested — unsupported syntax |
| `class {}` inline | `ts.ClassExpression` | not tested by `visitExpression`; only `this.host.isClass(node)` for a class *declaration* |
| `...items` at expression position | `ts.SpreadElement` | not tested here — spread is handled only *inside* array literals, by `visitArrayLiteralExpression` |

The arrow-function row needs its qualifier stated loudly, because it is the single most misquoted rule in Angular: **an arrow function is unsupported as a value the evaluator must fold, and completely fine in a field that is never folded.** That is why the AOT guide's `providers` example is wrong for Ivy ([09b](09b-gate-two-what-is-evaluated-and-what-is-relayed.md)) while its underlying observation about the evaluator is right.

⚠️ **One thing this page does not settle.** [09b](09b-gate-two-what-is-evaluated-and-what-is-relayed.md) lists `inputs` among the evaluated fields, and the decorator-based `inputs` array can carry a `transform` function. The source read behind these pages covered `visitExpression` and the directive handler's `evaluate` call sites, **not** how the input handler extracts a `transform`, so do not infer from the table that an inline transform arrow function is rejected. Treat that specific combination as unverified here rather than assuming either way.

## Two node kinds that are simply transparent

`as` and `!` do not fold to anything — they recurse straight into their operand:

```ts
} else if (ts.isAsExpression(node)) {
  result = this.visitExpression(node.expression, context);
} else if (ts.isNonNullExpression(node)) {
  result = this.visitExpression(node.expression, context);
}
```

So `selector: (SELECTORS.dashboard as string)!` resolves exactly as `SELECTORS.dashboard` does — a cast never rescues a value that would not fold, and never breaks one that would. The same is true of `ts.isParenthesizedExpression`. This is the evaluator's counterpart to `unwrapExpression` at the decorator argument in [09](09-static-analysability-is-the-load-bearing-constraint.md): type-level syntax is invisible to both.

## The operators, exactly

Same file, `BINARY_OPERATORS`, verbatim — a `Map<ts.SyntaxKind, BinaryOperatorDef>`:

```ts
private readonly BINARY_OPERATORS = new Map<ts.SyntaxKind, BinaryOperatorDef>([
  [ts.SyntaxKind.PlusToken, literalBinaryOp((a, b) => a + b)],
  [ts.SyntaxKind.MinusToken, literalBinaryOp((a, b) => a - b)],
  [ts.SyntaxKind.AsteriskToken, literalBinaryOp((a, b) => a * b)],
  [ts.SyntaxKind.SlashToken, literalBinaryOp((a, b) => a / b)],
  [ts.SyntaxKind.PercentToken, literalBinaryOp((a, b) => a % b)],
  [ts.SyntaxKind.AmpersandToken, literalBinaryOp((a, b) => a & b)],
  [ts.SyntaxKind.BarToken, literalBinaryOp((a, b) => a | b)],
  [ts.SyntaxKind.CaretToken, literalBinaryOp((a, b) => a ^ b)],
  [ts.SyntaxKind.LessThanToken, literalBinaryOp((a, b) => a < b)],
  [ts.SyntaxKind.LessThanEqualsToken, literalBinaryOp((a, b) => a <= b)],
  [ts.SyntaxKind.GreaterThanToken, literalBinaryOp((a, b) => a > b)],
  [ts.SyntaxKind.GreaterThanEqualsToken, literalBinaryOp((a, b) => a >= b)],
  [ts.SyntaxKind.EqualsEqualsToken, literalBinaryOp((a, b) => a == b)],
  [ts.SyntaxKind.EqualsEqualsEqualsToken, literalBinaryOp((a, b) => a === b)],
  [ts.SyntaxKind.ExclamationEqualsToken, literalBinaryOp((a, b) => a != b)],
  [ts.SyntaxKind.ExclamationEqualsEqualsToken, literalBinaryOp((a, b) => a !== b)],
  [ts.SyntaxKind.LessThanLessThanToken, literalBinaryOp((a, b) => a << b)],
  [ts.SyntaxKind.GreaterThanGreaterThanToken, literalBinaryOp((a, b) => a >> b)],
  [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken, literalBinaryOp((a, b) => a >>> b)],
  [ts.SyntaxKind.AsteriskAsteriskToken, literalBinaryOp((a, b) => Math.pow(a, b))],
  [ts.SyntaxKind.AmpersandAmpersandToken, referenceBinaryOp((a, b) => a && b)],
  [ts.SyntaxKind.BarBarToken, referenceBinaryOp((a, b) => a || b)],
]);
```

and the prefix unary set:

```ts
  [ts.SyntaxKind.TildeToken, (a) => ~a],
  [ts.SyntaxKind.MinusToken, (a) => -a],
  [ts.SyntaxKind.PlusToken, (a) => +a],
  [ts.SyntaxKind.ExclamationToken, (a) => !a],
```

Anything else falls straight through, and `visitBinaryExpression` says so in one line:

```ts
const tokenKind = node.operatorToken.kind;
if (!this.BINARY_OPERATORS.has(tokenKind)) {
  return DynamicValue.fromUnsupportedSyntax(node);
}
```

🔴 **`??` — `QuestionQuestionToken` — is not in that map.** `||` is. So one of these two lines compiles and the other does not, and they are one character apart in intent:

```ts
selector: MAYBE_SELECTOR || 'app-fallback'   // folds
selector: MAYBE_SELECTOR ?? 'app-fallback'   // DynamicValue.fromUnsupportedSyntax
```

There is no documentation of this anywhere. The map is the documentation.

## Two grammars, and they diverge in opposite directions

Decorator metadata and template expressions are both "Angular expression languages", they are compiled by the same product, and their supported syntax is *not* a subset relationship in either direction:

| | Metadata (`StaticInterpreter`) | Template ([02](02-what-a-template-expression-may-contain.md)) |
|---|---|---|
| `&` `\|` `^` `<<` `>>` `>>>` | supported | rejected |
| `??` | **not** supported | supported |
| Tagged template literals | **not** supported | supported per the expression-syntax guide |
| `new` | not supported | rejected |
| `**` | supported | see [02](02-what-a-template-expression-may-contain.md) |

The two columns were designed for different jobs by different code paths years apart, and nothing reconciles them. The practical consequence is that **moving an expression between the class-decorator world and the template world is not a refactor, it is a translation** — and the failure when you get it wrong is not a type error, it is a resolution failure with a message about static determination that says nothing about which language you are in.

## Gotchas

**★ Symptom: `selector: FEATURE_SELECTOR ?? 'app-fallback'` fails to resolve, and changing `??` to `||` fixes it.** Cause: `BINARY_OPERATORS` has `BarBarToken` and does not have `QuestionQuestionToken`, so `visitBinaryExpression` returns `DynamicValue.fromUnsupportedSyntax` for the nullish coalescing form. Fix: use `||`, or — better, since the two are not equivalent for `''` and `0` — hoist the default to where the constant is defined:

```ts
// feature-selectors.ts
const CONFIGURED_SELECTOR: string | undefined = undefined;
export const FEATURE_SELECTOR = CONFIGURED_SELECTOR ?? 'app-fallback';

// feature-panel.ts
import {Component} from '@angular/core';
import {FEATURE_SELECTOR} from './feature-selectors';

@Component({
  selector: FEATURE_SELECTOR,
  template: '<h2>Feature</h2>',
})
export class FeaturePanel {}
```

⚠️ That fix works because the `??` now sits in a plain variable initializer that TypeScript compiles normally — the evaluator resolves `FEATURE_SELECTOR` through `visitIdentifier` to whatever the initializer expression folds to, and `CONFIGURED_SELECTOR ?? 'app-fallback'` is itself a `??`. Hoisting only helps if the hoisted expression folds; if it does not, write the literal.

**★ Symptom: a tagged template literal used for editor syntax highlighting — `` template: html`<p>{{ name }}</p>` `` — reports that the value could not be determined statically, while the same tag works in a `.ts` file elsewhere.** Cause: `ts.isTaggedTemplateExpression` is not in the dispatch. `ts.isNoSubstitutionTemplateLiteral` and `ts.isTemplateExpression` are — the *untagged* forms fold — but the tagged form does not, no matter what the tag function does. Fix: drop the tag; a plain backtick template folds and most editors highlight it through the Angular language service anyway:

```ts
import {Component} from '@angular/core';

@Component({
  selector: 'app-greeting',
  template: `
    <p>Hello, {{ name }}</p>
  `,
})
export class Greeting {
  readonly name = 'Ada';
}
```

**★ Symptom: you avoided building a selector by string interpolation because "metadata has to be static", and the ceremony was unnecessary.** Cause: `ts.isTemplateExpression` *is* in the dispatch, and `visitTemplateExpression` folds a template literal whose substitutions all resolve. Interpolation is only a problem when a substitution does not fold. Fix: interpolate freely, as long as every piece is itself resolvable in this compilation:

```ts
// selector-prefix.ts
export const APP_PREFIX = 'acme';

// billing-summary.ts
import {Component} from '@angular/core';
import {APP_PREFIX} from './selector-prefix';

@Component({
  selector: `${APP_PREFIX}-billing-summary`,
  template: '<h2>Billing</h2>',
})
export class BillingSummary {}
```

**Symptom: the same constant works when it comes from a `.ts` file and fails when it comes from a package that only ships type declarations.** Cause: the node is still `ts.isIdentifier`, so the dispatch accepts it — but `visitIdentifier` has to find a *declaration with a value*, and a `declare const` in a `.d.ts` has none. The result is a `DynamicValue` with reason `EXTERNAL_REFERENCE`: *"An external reference could not be resolved to a value which can be evaluated."* Fix: put the value in your own compilation unit rather than importing it from an ambient declaration:

```ts
// app/selectors.ts — a real module in the compilation, not a .d.ts
export const DASHBOARD_SELECTOR = 'app-dashboard';

// app/dashboard.ts
import {Component} from '@angular/core';
import {DASHBOARD_SELECTOR} from './selectors';

@Component({
  selector: DASHBOARD_SELECTOR,
  template: '<h1>Dashboard</h1>',
})
export class Dashboard {}
```

The catalogue of ambient-declaration and enum cases lives in [10 · Metadata errors, one by one](10-metadata-errors-one-by-one.md); the point here is only that the *node kind* was never the problem.

**Symptom: `as const` was added to make a constants object "more static" and nothing changed.** Cause: `ts.isAsExpression` recurses straight into its operand — the cast is invisible to the evaluator. `as const` changes what TypeScript infers, not what folds. Fix: nothing to add; if it did not fold before the cast, look at the operand, not at the assertion.

## Interview questions

**★ Why does `||` work in decorator metadata and `??` not?**
Because the evaluator's operator support is a literal `Map` keyed by `ts.SyntaxKind`, and `BarBarToken` is a key while `QuestionQuestionToken` is not. `visitBinaryExpression` checks `BINARY_OPERATORS.has(tokenKind)` and returns `DynamicValue.fromUnsupportedSyntax` when the key is missing — there is no fallback, no partial support and no diagnostic saying "use `||` instead". It is not a design position about nullish semantics; it is a map that was never extended. This is the clearest single demonstration that "statically analysable" in Angular means "in the interpreter's dispatch", not "constant".

**★ Angular's documentation says tagged template literals are supported. Why does one fail inside `@Component`?**
Because that documentation is about the *template* expression language, and decorator metadata is a different language compiled by different code. The expression-syntax guide lists tagged template strings among the supported template literal forms; `StaticInterpreter.visitExpression` handles `ts.isTemplateExpression` and `ts.isNoSubstitutionTemplateLiteral` but has no case for `ts.isTaggedTemplateExpression`, so a tagged template in metadata resolves to unsupported syntax. Conflating the two grammars is the single most common way to be confidently wrong about Angular, and it goes both ways — bitwise operators are legal in metadata and rejected in templates.

**Bitwise operators are supported in metadata and rejected in templates. What does that tell you about how these rules were made?**
That neither list is a designed grammar; each is the accumulated surface of a different implementation. The template parser rejects bitwise operators as a deliberate restriction on what belongs in a view expression. The metadata evaluator supports them because it is a small interpreter over TypeScript AST nodes and adding a numeric binary operator costs one map entry. There is no shared specification to reconcile them, which is exactly why the practical advice is to read the source rather than reason from principle: a rule that "makes sense" in one of the two languages tells you nothing about the other.

**How would you determine, without building, whether a specific piece of syntax is allowed in an evaluated metadata field?**
Find its `ts.SyntaxKind` and look for it in `visitExpression`'s chain. If the kind is tested, the expression can fold — subject to its operands folding too. If it is not, the final `else` returns `DynamicValue.fromUnsupportedSyntax` and the field will report that the value could not be determined statically. For binary and prefix-unary expressions, go one level deeper into `BINARY_OPERATORS` and the unary map, because the *kind* being supported does not mean the *operator* is. That two-step check answers every "can I write this in metadata?" question there is.

**Why is `as` transparent to the evaluator, and why does that matter in practice?**
Because `ts.isAsExpression` recurses directly into `node.expression` rather than doing anything with the type. Casts, non-null assertions and parentheses are all type-level or grouping syntax with no runtime value of their own, so the interpreter looks through them. In practice it means two things: a cast will never fix a metadata resolution error — if the operand does not fold, the cast does not help — and a cast will never cause one either, so you can type-annotate a decorator argument or a field freely without worrying that you have made it less analysable.

---

← Prev: [09b · What is evaluated](09b-gate-two-what-is-evaluated-and-what-is-relayed.md) · Index: [Topic index](README.md) · Next → [The single-return function rule](09d-the-single-return-function-rule.md)
