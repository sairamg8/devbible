---
title: "Doors two and three are two `Map` literals with 4 and 22 entries, which is why `??` fails and `||` does not, why exactly two prefix operators are missing, and why `&&` and `||` can return things every other operator rejects"
sidebar_label: "10hd · The two operator maps"
sidebar_position: 10.73
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts);
> and `microsoft/TypeScript` at tag `v6.0.3`:
> [`src/compiler/types.ts`](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/types.ts) — `BinaryOperator`, `PrefixUnaryOperator` and the unions they are built from.
> Documentation-validated; **no sandbox run**. The operator counts below are a set difference between two verbatim source reads; nothing was compiled.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not**. Match on the message text.

**The other two producers of `This syntax is not supported.` are not chains at all — they are two `Map` lookups, one against a four-entry table of prefix operators and one against a twenty-two-entry table of binary operators. Because both tables are literals in one file and TypeScript publishes its own exhaustive unions of operator tokens, the absent sets are not estimates: door two is missing exactly two operators, and door three is missing exactly twenty of TypeScript's forty-two. The famous member of that second set is `??`, which fails while `||` succeeds — an asymmetry with no documentation anywhere, which this chunk settles as far as the source can settle it and leaves open where it cannot. The tables also carry a second distinction nobody notices: two of the twenty-two entries are declared differently from the other twenty, and that is why `A || B` can return an object where `A + B` cannot.**

## Door two: four operators, and TypeScript has six

The guard, verbatim:

```ts
private visitPrefixUnaryExpression(
  node: ts.PrefixUnaryExpression,
  context: Context,
): ResolvedValue {
  const operatorKind = node.operator;
  if (!this.UNARY_OPERATORS.has(operatorKind)) {
    return DynamicValue.fromUnsupportedSyntax(node);
  }
  // …
```

the map, verbatim:

```ts
private readonly UNARY_OPERATORS = new Map<ts.SyntaxKind, (a: any) => any>([
  [ts.SyntaxKind.TildeToken, (a) => ~a],
  [ts.SyntaxKind.MinusToken, (a) => -a],
  [ts.SyntaxKind.PlusToken, (a) => +a],
  [ts.SyntaxKind.ExclamationToken, (a) => !a],
]);
```

and TypeScript's own exhaustive union of what a prefix unary operator can be, verbatim from `types.ts`:

```ts
export type PrefixUnaryOperator =
    | SyntaxKind.PlusPlusToken
    | SyntaxKind.MinusMinusToken
    | SyntaxKind.PlusToken
    | SyntaxKind.MinusToken
    | SyntaxKind.TildeToken
    | SyntaxKind.ExclamationToken;
```

🔴 **Six minus four: door two has exactly two members, `++x` and `--x`.** That is the complete list, and it is not a list you will ever hit by accident — a decorator argument is an expression evaluated once at compile time, and there is nothing there to increment. Door two exists for completeness; every real `This syntax is not supported.` you will see comes from door one ([10h](10h-syntax-the-evaluator-cannot-read.md)) or door three.

⚠️ The **postfix** forms `x++` and `x--` are `ts.PostfixUnaryExpression`, a different node kind entirely, and go out through door one instead ([10hc](10hc-the-typescript-the-evaluator-has-never-heard-of.md)). Two spellings of one operation, two doors, one message.

## Door three: twenty-two operators, and TypeScript has forty-two

The guard, verbatim:

```ts
private visitBinaryExpression(node: ts.BinaryExpression, context: Context): ResolvedValue {
  const tokenKind = node.operatorToken.kind;
  if (!this.BINARY_OPERATORS.has(tokenKind)) {
    return DynamicValue.fromUnsupportedSyntax(node);
  }
  // …
```

`BINARY_OPERATORS` is quoted in full in [09c](09c-the-partial-evaluator-is-the-grammar.md); its twenty-two keys are the arithmetic operators including `**`, the three bitwise operators, the three shift operators, the four relational comparisons, the four equality comparisons, and the two logical operators `&&` and `||`.

TypeScript's `BinaryOperator` is `AssignmentOperatorOrHigher | SyntaxKind.CommaToken`, and expanding that union through `types.ts` gives forty-two tokens. **Twenty are absent from Angular's map**, and they group into five kinds of thing:

```text
Absent from BINARY_OPERATORS at v22.1.5 — set difference, not a guess:

  nullish coalescing        ??
  the two type predicates   in            instanceof
  plain assignment          =
  compound assignment       += -= *= /= %= **= &= |= ^= <<= >>= >>>=
                            and the three logical ones: &&= ||= ??=
  the comma operator        ,
```

Sixteen of the twenty are assignment forms, which is why nobody ever notices them: a decorator argument is a value, and writing an assignment inside one is already a mistake for other reasons. The four that matter are `??`, `in`, `instanceof` and the comma operator, and one of those four you will hit this week.

## `??`, and exactly what the evidence settles

**What is settled, at source.** `ts.SyntaxKind.QuestionQuestionToken` is not a key in `BINARY_OPERATORS` at `v22.1.5`, and the string `Question` does not occur anywhere in `interpreter.ts`, `dynamic.ts`, `diagnostics.ts` or `result.ts` — there is no special case for nullish coalescing anywhere in the partial evaluator. `visitBinaryExpression`'s first three lines therefore return `DynamicValue.fromUnsupportedSyntax(node)` for it. **This is a real gap in the evaluator, not a documentation omission** — the behaviour is determined by a `Map` literal that anyone can read, and the map does not contain the key.

**What is not settled.** Whether the omission is deliberate. The source carries no comment about it, no `TODO`, and no test naming it; one search of Angular's issue tracker for it returned nothing usable. So: *the source does not state whether nullish coalescing is intentionally excluded or simply never added*, and neither does any Angular document. Treat it as a fact about this version, re-check it at yours, and do not tell an interviewer it was a design decision.

**What to write instead.** The rewrite is not `||`, because the two are not equivalent — `||` also replaces `''`, `0` and `false`, and a selector or an `exportAs` is exactly the kind of string where an empty value is a real value:

```ts
// ⛔ selector: CONFIGURED_SELECTOR ?? 'app-fallback'   -> This syntax is not supported.
// ⚠️ selector: CONFIGURED_SELECTOR || 'app-fallback'   -> folds, different semantics

// ✅ decide it once, where the constant is defined, in ordinary TypeScript that
// the evaluator resolves through visitIdentifier to the *folded* result.
const CONFIGURED_SELECTOR: string | undefined = undefined;
export const CARD_SELECTOR = CONFIGURED_SELECTOR === undefined
  ? 'app-fallback'
  : CONFIGURED_SELECTOR;
```

🔴 **`ts.isConditionalExpression` *is* in the chain, so the ternary is the general-purpose escape from every absent operator.** Anything you wanted `??`, `in` or `instanceof` for can be written as a comparison the map already contains plus a ternary the chain already handles.

⚠️ Hoisting the `??` into a separate module constant and importing it does *not* work on its own, because `visitIdentifier` resolves the identifier to its initializer expression and then evaluates *that* — a `??` in the initializer is still a `??`. The fix above works because it replaces the operator, not because it moved.

## `in`, `instanceof` and the comma operator

```ts
export const CARD_CONFIG = {
  selector: 'app-user-card',
  exportAs: 'userCard',
} as const;

// ⛔ 'exportAs' in CARD_CONFIG          -> This syntax is not supported.
// ✅ element access returns undefined for a missing key, and === is in the map.
export const HAS_EXPORT_AS = CARD_CONFIG['exportAs'] !== undefined;
```

`accessHelper` is explicit about this: on a resolved object it does `lhs.has(strIndex) ? lhs.get(strIndex)! : undefined`. A missing key folds to `undefined` rather than failing, which is what makes the `!== undefined` rewrite reliable.

`instanceof` has no rewrite, and that is the correct answer rather than a limitation: the evaluator resolves object literals to a `Map` and classes to a `Reference`, so there are no runtime instances for it to test. The comma operator likewise — sequencing has no meaning in a value.

## The distinction inside the map: `literal` versus `reference` operators

Twenty of the twenty-two entries are built by `literalBinaryOp` and two — `&&` and `||` — by `referenceBinaryOp`. Verbatim:

```ts
interface BinaryOperatorDef {
  literal: boolean;
  op: (a: any, b: any) => ResolvedValue;
}

function literalBinaryOp(op: (a: any, b: any) => any): BinaryOperatorDef {
  return {op, literal: true};
}

function referenceBinaryOp(op: (a: any, b: any) => any): BinaryOperatorDef {
  return {op, literal: false};
}
```

and the branch it drives, verbatim:

```ts
const opRecord = this.BINARY_OPERATORS.get(tokenKind)!;
let lhs: ResolvedValue, rhs: ResolvedValue;
if (opRecord.literal) {
  lhs = literal(this.visitExpression(node.left, context), (value) =>
    DynamicValue.fromInvalidExpressionType(node.left, value),
  );
  rhs = literal(this.visitExpression(node.right, context), (value) =>
    DynamicValue.fromInvalidExpressionType(node.right, value),
  );
} else {
  lhs = this.visitExpression(node.left, context);
  rhs = this.visitExpression(node.right, context);
}
```

`literal` is the gate, verbatim:

```ts
function literal(
  value: ResolvedValue,
  reject: (value: ResolvedValue) => ResolvedValue,
): ResolvedValue {
  if (value instanceof EnumValue) {
    value = value.resolved;
  }
  if (
    value instanceof DynamicValue ||
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  return reject(value);
}
```

🔴 **So twenty of the twenty-two operators require both operands to be a primitive, `null`, `undefined` or an already-failed value — and `&&` and `||` do not.** Two consequences you can use:

- `CONFIG_A || CONFIG_B` where both are object literals **folds**, returning one of the two maps. `CONFIG_A + CONFIG_B` does not — each operand is rejected by `literal` and you get `Unable to evaluate an invalid expression.`, which is door three's *other* failure mode and a different trace string entirely ([10g](10g-calls-enums-and-the-values-in-between.md)).
- An enum member is silently unwrapped to its value by `literal`, so `ViewEncapsulation.None === 2` compares numbers. Under `||` it is **not** unwrapped, so `ENCAPSULATION || ViewEncapsulation.Emulated` yields whichever `EnumValue` won, which is what `resolveEnumValue` wants — a field that requires an enum member keeps working through `||` and would not through an arithmetic operator.

## Gotchas

**★ Symptom: `selector: FEATURE_SELECTOR ?? 'app-fallback'` reports unsupported syntax, and changing one character to `||` fixes the build.** Cause: `BarBarToken` is a key in `BINARY_OPERATORS` and `QuestionQuestionToken` is not; there is no fallback path and no diagnostic suggesting the alternative. Fix: prefer the explicit comparison over `||`, because `||` silently changes the semantics for `''` and `0`:

```ts
const CONFIGURED: string | undefined = undefined;
export const FEATURE_SELECTOR = CONFIGURED === undefined ? 'app-fallback' : CONFIGURED;
```

**★ Symptom: you moved the `??` into a shared constants file and imported it, and the error followed you.** Cause: `visitIdentifier` resolves an identifier to its declaration and then evaluates the declaration's initializer, so the `??` is evaluated wherever it is written. Moving an expression never changes whether it folds. Fix: change the operator, or write the literal value.

**★ Symptom: `A + B` reports `Unable to evaluate an invalid expression.` while `A || B` on the same two constants compiles.** Cause: `+` is a `literalBinaryOp`, so both operands go through `literal()`, which rejects anything that is not a primitive, `null` or `undefined`; `||` is one of the two `referenceBinaryOp` entries and skips that gate. Fix: do not concatenate objects — but do note that this is *not* a syntax failure, so it is a different message with a different remedy, and reading it as one wastes the trace.

**★ Symptom: `'key' in CONFIG` fails inside metadata.** Cause: `InKeyword` is a binary operator token in TypeScript and is not a key in Angular's map, so door three fires. Fix: use element access and compare, which reaches `visitElementAccessExpression` and `accessHelper`, both of which return `undefined` for a missing key rather than failing:

```ts
export const CARD_CONFIG = {selector: 'app-user-card'} as const;
export const HAS_SELECTOR = CARD_CONFIG['selector'] !== undefined;
```

**Symptom: `++counter` reports unsupported syntax and you assume prefix operators are unsupported generally.** Cause: four of TypeScript's six prefix operators are supported — `~`, `-`, `+` and `!` — and only `++` and `--` are missing. Fix: nothing to change in a decorator; the point of knowing the size of the absent set is to stop you searching for a cause that does not exist.

**Symptom: a bitwise flag expression works in metadata and the same expression is rejected in a template.** Cause: two different grammars. `&`, `|`, `^`, `<<`, `>>` and `>>>` are all keys in `BINARY_OPERATORS`, and Angular's *template* parser rejects them deliberately ([02](02-what-a-template-expression-may-contain.md)). Fix: nothing — but never carry a conclusion from one of those two languages to the other, in either direction.

**Symptom: a comparison against an enum member behaves differently depending on the operator around it.** Cause: `literal()` unwraps an `EnumValue` to its resolved value before an arithmetic or comparison operator sees it, and the two reference operators `&&` and `||` do not unwrap. Fix: when a field requires an actual enum member — `encapsulation`, `changeDetection` — build the value with `||` or a ternary, never with arithmetic, or you will hand the field a number where it wanted an `EnumValue` ([10g](10g-calls-enums-and-the-values-in-between.md)).

## Interview questions

**★ Why does `||` work in decorator metadata and `??` not — and is it a bug?**
Because the evaluator's operator support is a literal `Map` keyed by `ts.SyntaxKind`, and `BarBarToken` is a key while `QuestionQuestionToken` is not. `visitBinaryExpression` checks `BINARY_OPERATORS.has(tokenKind)` and returns `DynamicValue.fromUnsupportedSyntax` when the key is missing — no fallback, no partial support, no diagnostic naming the alternative. On whether it is a bug: the source settles the *behaviour* completely and says nothing about the *intent*. There is no comment, no `TODO` and no test that names nullish coalescing anywhere in the partial evaluator, and no Angular document mentions it. The honest answer is that it is a gap in a map that was never extended, and that nothing available says whether that was deliberate.

**★ Twenty of TypeScript's forty-two binary operators are missing from the map, but only four of them matter. Which four, and why the other sixteen do not?**
The four are `??`, `in`, `instanceof` and the comma operator. The other sixteen are `=` and the fifteen compound assignments, including `||=`, `&&=` and `??=` — and they do not matter in practice because a decorator argument is a value expression, so an assignment inside one is already a mistake for reasons that have nothing to do with Angular. The distinction is worth drawing in an interview because it shows you did the set difference rather than repeating the one example everybody knows: the number is twenty, the number you will ever meet is four, and the reason is structural.

**★ How do you rewrite `??` in metadata without changing the semantics?**
Not with `||`, which also replaces `''`, `0` and `false` — and an empty string is a perfectly real selector-shaped value, so that substitution can change behaviour silently. Write the comparison explicitly with a ternary: `X === undefined ? FALLBACK : X`, or `X === undefined || X === null ? FALLBACK : X` if you need the full nullish semantics. Both `===` and the conditional expression are supported — `EqualsEqualsEqualsToken` is a map key and `ts.isConditionalExpression` is a branch of the chain — so this reaches no absent syntax at all. The general form of the answer is that the ternary plus the equality operators can express anything the absent operators expressed.

**What are `literalBinaryOp` and `referenceBinaryOp`, and what observable difference do they make?**
They are the two constructors for entries in `BINARY_OPERATORS`, differing in one boolean. Twenty entries are `literal: true`, which makes `visitBinaryExpression` push both operands through the `literal()` helper — it unwraps an `EnumValue` to its resolved value, passes through primitives, `null`, `undefined` and already-failed values, and rejects everything else with `DynamicValue.fromInvalidExpressionType`. The two `reference` entries, `&&` and `||`, skip that gate entirely. Observably: `A || B` where both are object literals folds to one of the two objects, while `A + B` on the same operands produces `Unable to evaluate an invalid expression.`; and an enum member survives `||` as an `EnumValue` while arithmetic unwraps it to a number. That matters for fields like `encapsulation` that require a genuine enum member rather than its numeric value.

**Door two contains exactly two operators. Why is a fact like that worth establishing?**
Because it closes a branch of the search. When a metadata error says `This syntax is not supported.`, the useful question is which of three doors it came from, and a door whose contents you can enumerate is a door you can eliminate in one glance. Door two is `++x` and `--x`, established by subtracting Angular's four-entry `UNARY_OPERATORS` map from TypeScript's own six-member `PrefixUnaryOperator` union — both read verbatim, no inference. In a decorator argument neither can occur meaningfully, so in practice every real instance of this error is door one or door three, and knowing that turns a three-way question into a two-way one before you have looked at any code.

{/* FOOTER */}
