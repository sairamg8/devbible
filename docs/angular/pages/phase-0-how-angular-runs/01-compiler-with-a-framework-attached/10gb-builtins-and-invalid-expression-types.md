---
title: "The evaluator can call exactly three functions you did not write, and `Unable to evaluate an invalid expression.` is raised from nine places in the interpreter of which only three are about calls — so the message names the wrong *kind* of value reaching an operation, not a broken function"
sidebar_label: "10gb · Builtins and invalid expression types"
sidebar_position: 10.61
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/builtin.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/builtin.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/result.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/result.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/diagnostics.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/diagnostics.ts).
> Documentation-validated; **no sandbox run** — no build was executed. Every message string below is a string literal read from a named file at that tag.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not.** Nothing on this page is daggered; every trace here arrives under `VALUE_HAS_WRONG_TYPE = 1010`, read from the assigning line of `error_code.ts` in [10g](10g-calls-enums-and-the-values-in-between.md).

**[10g](10g-calls-enums-and-the-values-in-between.md) walked the call ladder and stopped at rung 2 — the callee is a `KnownFn`, so the compiler evaluates it. This page opens that rung, and then follows `INVALID_EXPRESSION_TYPE` out of the call machinery entirely. Both halves make the same point from opposite directions: `Unable to evaluate an invalid expression.` is not a message about functions. It is what the evaluator says when a value resolved perfectly well and then arrived somewhere that wanted a different *kind* of value — a callable, a string key, an integer index, an array, a primitive. Eight situations, eight different fixes, one string. The doc comment says as much, and reading it as "your function is wrong" is the reason this family costs people an afternoon.**

## `KnownFn` — three functions, and they are not a standard library

`KnownFn` is the abstract base for a value the evaluator is willing to invoke, and its doc comment in `result.ts` is deliberately broad:

> *"An implementation of a known function that can be statically evaluated. It could be a built-in function or method (such as `Array.prototype.slice`) or a TypeScript helper (such as `__spread`)."*

At `v22.1.5`, `builtin.ts` contains exactly three subclasses. They are reached from `accessHelper` — the same function that does property and element access — so you never import them and there is no list anywhere in the documentation:

| Expression | Class | Behaviour, from source |
|---|---|---|
| `ARR.slice()` | `ArraySliceBuiltinFn` | `args.length === 0` returns the array; **any argument at all** returns `DynamicValue.fromUnknown(node)` |
| `ARR.concat(x, …)` | `ArrayConcatBuiltinFn` | spreads array arguments, pushes scalars, and wraps a `DynamicValue` argument as `fromDynamicInput` |
| `STR.concat(x, …)` | `StringConcatBuiltinFn` | unwraps an `EnumValue` to its `resolved`, accepts string / number / boolean / `null` / `undefined`, and returns `fromUnknown` for anything else |

`ArraySliceBuiltinFn`, verbatim and entire — it is four lines of logic and worth seeing, because nothing about the shape of `slice` survives in it:

```ts
override evaluate(node: ts.CallExpression, args: ResolvedValueArray): ResolvedValue {
  if (args.length === 0) {
    return this.lhs;
  } else {
    return DynamicValue.fromUnknown(node);
  }
}
```

```ts
// src/app/selectors.ts
export const ALL = ['app-a', 'app-b', 'app-c'];

export const COPY = ALL.slice();              // ✅ folds — zero arguments
export const TAIL = ALL.slice(1);             // ⛔ `Unable to evaluate statically.`
export const MORE = ALL.concat(['app-d']);    // ✅ folds
export const NAME = 'app-'.concat('report');  // ✅ folds
```

🔴 **`slice(1)` failing is the sharpest trap in this family**, because `slice()` on the line above it works and nothing in the message hints that the *argument* was the problem — you get `UNKNOWN`, the residual bucket, whose note is the bare `Unable to evaluate statically.` The right reading of the table is not "some array methods are supported" but "three specific shapes are special-cased, and `slice` only in its zero-argument form".

`describeResolvedType` renders a `KnownFn` as the literal string `Function`, so if a field's own type check rejects one you see `Value is of type 'Function'.` — which means you passed `ARR.concat` (the method) where you meant `ARR.concat(x)` (the call).

⚠️ **`ArrayConcatBuiltinFn` does not fail on a dynamic argument; it *embeds* one.** Look at the branch:

```ts
if (arg instanceof DynamicValue) {
  result.push(DynamicValue.fromDynamicInput(node, arg));
}
```

The concatenation succeeds and produces an array with a `DynamicValue` sitting inside it at that position. Whether that is an error depends entirely on what the receiving field does with the element — `imports` will reject it, an array whose elements are only counted will not. This is the mechanism behind "one bad element in a list poisons only that element", and it is why array-valued metadata errors so often point at an index rather than at the array.

## `Unable to evaluate an invalid expression.` — nine call sites, eight situations

The message belongs to `INVALID_EXPRESSION_TYPE`, whose doc comment in `dynamic.ts` is broader than "calls", and the second sentence is the one to keep:

> *"A value could be resolved, but is not an acceptable type for the operation being performed."*
>
> *"For example, attempting to call a non-callable expression."*

Calls are the *example*, not the definition. `DynamicValue.fromInvalidExpressionType` is called from nine places in `interpreter.ts` at `v22.1.5`. Three of them are the call rungs already walked in [10g](10g-calls-enums-and-the-values-in-between.md). The remaining six sites cover five situations — the binary-operator case has two sites, one per operand — and none of them involves a function.

**1 — Indexing with something that is not a string or a number.** `visitElementAccessExpression`:

```ts
if (typeof rhs !== 'string' && typeof rhs !== 'number') {
  return DynamicValue.fromInvalidExpressionType(node, rhs);
}
```

**2 — Indexing an *array* with a non-integer.** `accessHelper`, a second and stricter guard that runs after the first has already passed. A string index into an array fails even when the string is a digit:

```ts
if (typeof rhs !== 'number' || !Number.isInteger(rhs)) {
  return DynamicValue.fromInvalidExpressionType(node, rhs);
}
```

```ts
export const SELECTORS = ['app-a', 'app-b'];
export const OK = SELECTORS[0];      // ✅
export const BAD_A = SELECTORS['0']; // ⛔ `Unable to evaluate an invalid expression.`
export const BAD_B = SELECTORS[0.5]; // ⛔ same
export const MAP = {a: 'app-a'};
export const OK_2 = MAP['a'];        // ✅ — a Map lookup, not an array index, so a string is fine
```

The asymmetry is not arbitrary. `accessHelper` branches on what the *left* side resolved to, and a resolved object literal is stored as a `Map` keyed by string while a resolved array literal is a real JavaScript array. The `length`, `slice` and `concat` names are intercepted before the integer guard, which is why `ALL.length` folds and `ALL['length']` folds too — both reach the same `rhs === 'length'` comparison as a string.

**3 — Spreading something that is not an array.** `visitSpreadElement`, which serves both an array literal and a call's argument list, so the same message can appear on `[...X]` and on `f(...X)`:

```ts
} else if (!Array.isArray(spread)) {
  return [DynamicValue.fromInvalidExpressionType(node, spread)];
}
```

**4 — Spreading a non-object into an object literal.** `visitObjectLiteralExpression` has its own spread branch, and its failure is *wrapped*, so you get two notes rather than one:

```ts
return DynamicValue.fromDynamicInput(
  node,
  DynamicValue.fromInvalidExpressionType(property, spread),
);
```

A `Map` spread merges, a `ResolvedModule` spread merges its exports — which is the one legitimate use of `import * as ns` in metadata — and anything else is invalid.

**5 — A non-literal operand to a literal binary operator** (two call sites, one per operand)**.** `BINARY_OPERATORS` tags each entry with a `literal` flag, and the two constructors that build the table say which is which:

```ts
function literalBinaryOp(op: (a: any, b: any) => any): BinaryOperatorDef {
  return {op, literal: true};
}

function referenceBinaryOp(op: (a: any, b: any) => any): BinaryOperatorDef {
  return {op, literal: false};
}
```

Every arithmetic, bitwise, shift, relational and equality operator is built with `literalBinaryOp`. **Exactly two are `referenceBinaryOp`: `&&` and `||`.** For the literal ones both operands pass through the `literal()` helper first:

```ts
lhs = literal(this.visitExpression(node.left, context), (value) =>
  DynamicValue.fromInvalidExpressionType(node.left, value),
);
```

and `literal()` accepts a `DynamicValue`, `null`, `undefined`, a string, a number or a boolean — plus an `EnumValue`, which it unwraps to `.resolved` on the way in. A `Reference` to a class, a `Map`, an array and a `ResolvedModule` are all rejected. So `SOME_CLASS + '-suffix'` is an invalid expression type while `SOME_CLASS || FALLBACK` is fine, because `||` never demands a literal — it just returns whichever operand JavaScript's truthiness rules select, `Reference` and all.

Which operators exist at all is [09c](09c-the-partial-evaluator-is-the-grammar.md); which of them demand *literals* is this list, and the two questions have different answers.

## Gotchas

**★ Symptom: `ALL.slice()` compiles and `ALL.slice(1)` does not.** Cause: `ArraySliceBuiltinFn.evaluate` returns the array only when `args.length === 0`, and returns `DynamicValue.fromUnknown(node)` for every other call — there is no bounds arithmetic in it at all. Fix: write the sub-array as a literal, or index the element you actually want:

```ts
export const ALL = ['app-a', 'app-b', 'app-c'];
export const TAIL = ['app-b', 'app-c'];   // ✅ instead of ALL.slice(1)
export const SECOND = ALL[1];             // ✅ integer index folds
```

**★ Symptom: `SELECTORS['0']` fails while `CONFIG['selector']` works, in the same file.** Cause: `accessHelper` branches on what the *left* side resolved to. A resolved object literal is a `Map` and takes a string key; a resolved array literal requires `typeof rhs === 'number' && Number.isInteger(rhs)`. Fix: use a numeric literal for arrays, and if the index is computed check that it folds to a number and not to a numeric string — a template literal always folds to a *string*:

```ts
export const SELECTORS = ['app-a', 'app-b'];
export const INDEX = 1;

export const OK = SELECTORS[INDEX];        // ✅ folds to a number
// export const BAD = SELECTORS[`${INDEX}`];  ⛔ a template literal folds to '1', a string
```

**★ Symptom: an `imports` array compiles but one component in it is not recognised at runtime, with no compile error at all.** Cause: `ArrayConcatBuiltinFn` pushes a `DynamicValue.fromDynamicInput` into the result rather than failing the whole concatenation, so an array built with `.concat()` can carry an unresolvable element past evaluation. Whether that becomes a diagnostic depends on the receiving field. Fix: build metadata arrays as literals, not by concatenation, so an unresolvable element fails loudly at its own position:

```ts
import {ReportRow} from './report-row';
import {ReportFooter} from './report-footer';

// ✅ every element is a literal identifier.
export const REPORT_IMPORTS = [ReportRow, ReportFooter];
```

That is also the shape `@defer` needs — deferral requires literal element references, which is stricter than compilation's rule ([11b](11b-the-nine-conditions-and-the-barrel-trap.md)).

**★ Symptom: `Value is of type 'Function'.` and nothing in your code says `Function`.** Cause: `describeResolvedType` renders a `KnownFn` — one of the three builtins — as the literal string `Function`. You referenced a builtin method without calling it. Fix: add the call, or stop passing the method around; there is no metadata field that accepts one.

**★ Symptom: `PREFIX + SUFFIX` folds but `SomeClass + '-x'` does not, and the message says *invalid expression*, not *unsupported syntax*.** Cause: `+` is built with `literalBinaryOp`, so each operand goes through `literal()`, which rejects anything that is not a `DynamicValue`, `null`, `undefined`, string, number, boolean or `EnumValue`. A `Reference` to a class is none of those. Fix: build the string from string constants and reference the class separately — a class is not a value you can concatenate at build time any more than at runtime:

```ts
export const PREFIX = 'acme';
export const CARD_SELECTOR = PREFIX + '-card';   // ✅ two strings
// export const BAD = CardComponent + '-card';   ⛔ Reference on the left
```

**Symptom: `A || B` folds where `A ?? B` does not, and `A && B` folds where `A + B` does not.** Cause: three different rules stacked. `??` is not in `BINARY_OPERATORS` at all, so it is unsupported *syntax*. `&&` and `||` are in the table with `literal: false`, so their operands are not type-checked and a `Reference` passes straight through. Everything else in the table is `literal: true`. Fix: use `||` where you need a fallback in metadata, and read [09c](09c-the-partial-evaluator-is-the-grammar.md) for why `??` is absent:

```ts
declare const BUILD_SELECTOR: 'app-card';
export const SELECTOR = BUILD_SELECTOR || 'app-card-fallback';  // ✅ `||` is in the table
```

**Symptom: `{...someObject}` in metadata produces two stacked notes instead of one.** Cause: the object-literal spread branch wraps its failure — `fromDynamicInput(node, fromInvalidExpressionType(property, spread))` — so the outer note is the generic `Unable to evaluate this expression statically.` on the whole literal and the inner one is `Unable to evaluate an invalid expression.` on the spread property. Fix: read the inner note; the outer one is structural. `{...NAMESPACE_IMPORT}` is the one spread of a non-object-literal that works, because a `ResolvedModule` merges its exports.

**Symptom: `f(...ARGS)` fails with an invalid-expression note and you assumed spread was unsupported in a call.** Cause: it is supported — `evaluateFunctionArguments` routes a `ts.SpreadElement` through `visitSpreadElement`, the same function an array literal uses. The failure is that `ARGS` did not resolve to an *array*. Fix: check what `ARGS` folds to before blaming the spread; a `Map` (object literal) and a `ResolvedModule` are both common mistakes there.

## Interview questions

**★ What does `Value is of type 'Function'.` mean, given the compiler cannot call arbitrary functions?**
It means the evaluator resolved your expression to a `KnownFn` — one of the three builtins in `builtin.ts`, `Array.prototype.slice`, `Array.prototype.concat` or `String.prototype.concat` — and `describeResolvedType` renders that case as the literal string `Function`. In practice you wrote `NAMES.concat` where you meant `NAMES.concat(x)`. It is not a report that the compiler declined to call something; it is a report that a callable object reached a field expecting a value. Note that a *user* function never produces this message, because a reference to one is a `Reference` and renders as its `debugName`.

**★ Why does `SELECTORS['0']` fail when JavaScript would happily accept it?**
Because `accessHelper` type-checks the index before doing anything with it, and for an array left-hand side the guard is `typeof rhs !== 'number' || !Number.isInteger(rhs)`. JavaScript's implicit string-to-index coercion on arrays is a runtime behaviour of property access on exotic array objects; the partial evaluator is not running JavaScript, it is folding a small expression language, and that language does not include the coercion. The same guard rejects `SELECTORS[0.5]`. The asymmetry with objects is the interesting half: a resolved object literal is stored as a `Map` keyed by string, so a string index there is not merely accepted, it is the only thing that works.

**★ Your build fails on `ALL.slice(1)`. What is the general lesson about the builtins?**
That they were added to support specific patterns the framework needed, not to emulate the standard library. `ArraySliceBuiltinFn` returns the whole array when called with no arguments and `DynamicValue.fromUnknown` otherwise — there is no bounds arithmetic in it at all. `StringConcatBuiltinFn` accepts only primitives and `EnumValue`s and gives up on anything else. So the right mental model is "three specific shapes are special-cased", and anything beyond those lands in the residual `UNKNOWN` bucket with the least informative message the compiler produces. When a builtin call fails, rewrite the value as a literal rather than hunting for a supported variant.

**★ `Unable to evaluate an invalid expression.` — describe the class of failure it names, without mentioning functions.**
It names the case where evaluation *succeeded* and produced a value of the wrong kind for the operation about to be performed on it. The doc comment says exactly that: *"A value could be resolved, but is not an acceptable type for the operation being performed."* Calling a non-callable is the example the comment gives, but the same reason is produced by indexing with a non-string, non-number; indexing an array with anything that is not an integer; spreading a non-array into an array or an argument list; spreading a non-object into an object literal; and supplying a `Reference`, `Map`, array or module to a binary operator that demands a literal. What unifies them is that nothing was missing and nothing was unsupported — a value arrived and it was the wrong shape. That is why the fix is never "make the code more static": the code was already static enough.

**Why are `&&` and `||` the only two operators whose operands are not type-checked?**
Because they are the only two whose semantics do not require reading the operands as data. Every other entry in `BINARY_OPERATORS` applies an arithmetic, bitwise or comparison operation, and applying `+` or `<` to a `Reference` or a `Map` would produce a JavaScript coercion result that is meaningless as metadata — so those are built with `literalBinaryOp` and their operands go through `literal()` first. `&&` and `||` only need truthiness, and then return one operand unchanged. That makes them the one place a `Reference` can pass through an operator intact, which is precisely why `A || FALLBACK` is a usable idiom for a class-valued metadata field while `A + B` never is.

**A metadata array built with `.concat()` compiles, and one of its elements is broken. Why did you not get an error at the array?**
Because `ArrayConcatBuiltinFn` handles a dynamic argument by pushing `DynamicValue.fromDynamicInput(node, arg)` into the result rather than abandoning the whole concatenation. The array is produced; one of its slots holds a `DynamicValue`. Whether that is reported depends on what the field does next — a field that walks the elements and demands a class reference will report it at that index, and a field that merely counts or relays the array will not report it at all. It is the clearest example in the evaluator of a failure that is *contained* rather than propagated, and it is a good argument for writing metadata arrays as literals: a literal fails at the element, immediately, with a span you can click.

← Prev: [Calls and invalid expressions](10g-calls-enums-and-the-values-in-between.md) · Index: [Topic index](README.md) · Next → [Dynamic strings and computed keys](10gc-dynamic-strings-and-computed-keys.md)
