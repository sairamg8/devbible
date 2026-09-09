---
title: "Four parts of the dispatch behave nothing like their node kind suggests — a ternary never looks at the branch it did not take, a cast is invisible rather than checked, a class reference reaches its static members without being constructed, and property access implements exactly four methods of the JavaScript standard library"
sidebar_label: "10hf · Where the chain surprises you"
sidebar_position: 10.75
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts).
> Documentation-validated; **no sandbox run** — every code block below is source read from the named file, and every message is a string literal from it.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not**. Match on the message text.

**[10h](10h-syntax-the-evaluator-cannot-read.md) through [10he](10he-what-looks-like-this-error-and-is-not.md) are about what the dispatch refuses. This chunk is the opposite and it is where the expensive surprises live: four parts of the dispatch that *accept* your code and then behave in a way the node kind does not predict. A conditional expression never visits the branch it did not take, so half of every ternary in your metadata is unchecked code that can break years later with no edit to it. A class reference reaches static members without any instance existing, which is the config-object pattern people reach for `new` to build. A cast is not checked but erased, so no amount of `as const` will ever change an outcome. And property access on a resolved array or string is not JavaScript — `accessHelper` implements four members of the standard library by name and nothing else, so `name.trim()` in a metadata helper fails while `name.concat('x')` folds. All four are read off one function each.**

## The one place unsupported syntax is never seen: the untaken ternary branch

`visitConditionalExpression` folds the condition and then visits **only the branch it took**, verbatim:

```ts
private visitConditionalExpression(
  node: ts.ConditionalExpression,
  context: Context,
): ResolvedValue {
  const condition = this.visitExpression(node.condition, context);
  if (condition instanceof DynamicValue) {
    return DynamicValue.fromDynamicInput(node, condition);
  }

  if (condition) {
    return this.visitExpression(node.whenTrue, context);
  } else {
    return this.visitExpression(node.whenFalse, context);
  }
}
```

🔴 **So an unsupported node in the branch that is not taken is never visited, and never reported.** That is the only construct in the evaluator with this property, and it has a sharp consequence: a metadata expression can compile today and fail tomorrow when the constant driving the ternary flips, with no source change to the failing branch at all.

```ts
export const USE_COMPACT = true;

// Compiles today, because `whenFalse` is never visited.
// selector: USE_COMPACT ? 'app-card-compact' : buildSelector(),
//                                              ^ an arrow-bound const: door one, unseen

// ✅ make both branches foldable so the constant is free to change.
export const CARD_SELECTOR_COMPACT = 'app-card-compact';
export const CARD_SELECTOR_FULL = 'app-card-full';
```

## The `new` fix you actually wanted: static members on a class

`new SelectorSet()` is unsupported, but the *shape* people want from it — a namespaced set of constants with a type — is available, because `accessHelper` reads static members off a class reference. Verbatim:

```ts
} else if (lhs instanceof Reference) {
  const ref = lhs.node;
  if (this.host.isClass(ref)) {
    const module = owningModule(context, lhs.bestGuessOwningModule);
    let value: ResolvedValue = undefined;
    const member = this.host
      .getMembersOfClass(ref)
      .find((member) => member.isStatic && member.name === strIndex);
    if (member !== undefined) {
      if (member.value !== null) {
        value = this.visitExpression(member.value, context);
      } else if (member.implementation !== null) {
        value = new Reference(member.implementation, module);
      } else if (member.node) {
        value = new Reference(member.node, module);
      }
    }
    return value;
  }
```

```ts
// ✅ no `new`, no instance, and the member initializer is evaluated normally.
export class Selectors {
  static readonly CARD = 'app-user-card';
  static readonly ROW = 'app-user-row';
}
```

⚠️ Two conditions are visible in that excerpt and both bite. The predicate is `member.isStatic && member.name === strIndex`, so an **instance** field is never found — which is exactly why the `new SelectorSet()` version fails even before `new` is considered. And when no member matches, the function returns the initialised `value`, which is `undefined`: a typo in a static member name folds silently to `undefined` rather than erroring, and surfaces as `Value is of type 'undefined'.` at the field ([10e](10e-values-that-resolve-but-do-not-fold.md)).

## `as`, `!` and parentheses are transparent — and that is a branch, not an omission

Three of the chain's branches do not compute anything; they recurse into their operand:

```ts
} else if (ts.isParenthesizedExpression(node)) {
  result = this.visitParenthesizedExpression(node, context);
} else if (ts.isAsExpression(node)) {
  result = this.visitExpression(node.expression, context);
} else if (ts.isNonNullExpression(node)) {
  result = this.visitExpression(node.expression, context);
}
```

```ts
private visitParenthesizedExpression(
  node: ts.ParenthesizedExpression,
  context: Context,
): ResolvedValue {
  return this.visitExpression(node.expression, context);
}
```

So `(SELECTORS.card as string)!` resolves exactly as `SELECTORS.card` does. This is the evaluator's counterpart to `unwrapExpression` at the decorator argument ([09](09-static-analysability-is-the-load-bearing-constraint.md)): type-level syntax is invisible to both. 🔴 **The reason it is worth stating as a positive fact rather than a footnote is that it eliminates a whole family of failed remedies** — every "make it more static" instinct routes through one of these three, and none of them changes what the evaluator sees. It also cuts the other way, which is the useful half: annotating and asserting in metadata can never break a page that works.

⚠️ `satisfies` and the angle-bracket cast `<string>x` are **not** in this group — they are separate node kinds with no branch at all ([10hc](10hc-the-typescript-the-evaluator-has-never-heard-of.md)). Transparency is a property of three specific branches, not of type-level syntax in general.

## Property access on a resolved value is not JavaScript

`accessHelper` is the shared implementation behind property access, element access and destructuring. Its array and string branches, verbatim:

```ts
} else if (Array.isArray(lhs)) {
  if (rhs === 'length') {
    return lhs.length;
  } else if (rhs === 'slice') {
    return new ArraySliceBuiltinFn(lhs);
  } else if (rhs === 'concat') {
    return new ArrayConcatBuiltinFn(lhs);
  }
  if (typeof rhs !== 'number' || !Number.isInteger(rhs)) {
    return DynamicValue.fromInvalidExpressionType(node, rhs);
  }
  return lhs[rhs];
} else if (typeof lhs === 'string' && rhs === 'concat') {
  return new StringConcatBuiltinFn(lhs);
}
```

🔴 **That is the complete standard library: `length`, `slice` and `concat` on an array, `concat` on a string.** Everything else — `map`, `filter`, `join`, `includes`, `toUpperCase`, `trim`, `replace`, `padStart` — falls past every branch to `accessHelper`'s final `return DynamicValue.fromUnknown(node)` and reports `Unable to evaluate statically.`, the residual bucket that names no mechanism ([10f](10f-destructuring-in-metadata.md)).

```ts
// ⛔ every one of these is Unable to evaluate statically.
// export const CARD_SELECTOR = `app-${RAW_NAME.trim()}`;
// export const CARD_SELECTOR = ['app', RAW_NAME].join('-');
// export const CARD_SELECTOR = RAW_NAME.toLowerCase();

// ✅ string concatenation is an operator, not a method — `+` is in BINARY_OPERATORS,
// and template interpolation folds through visitTemplateExpression.
export const RAW_NAME = 'user-card';
export const CARD_SELECTOR = `app-${RAW_NAME}`;
export const CARD_SELECTOR_ALT = 'app-'.concat(RAW_NAME);
```

⚠️ Note the non-integer index rule in the same excerpt: `ARRAY['1']` or `ARRAY[0.5]` returns `DynamicValue.fromInvalidExpressionType` — `Unable to evaluate an invalid expression.` — rather than the residual message. Three different trace strings come out of this one function depending on what you asked for.

## Gotchas

**★ Symptom: a metadata expression that has compiled for months breaks after someone flipped an unrelated boolean constant.** Cause: `visitConditionalExpression` evaluates only the branch the condition selects, so an unsupported node can sit in the untaken branch of a ternary indefinitely. Flipping the constant makes the compiler visit it for the first time. Fix: make both branches foldable, or do not put a ternary in metadata at all — the branch you are not testing is not being checked:

```ts
// ⛔ selector: USE_COMPACT ? 'app-card-compact' : buildSelector(),
// ✅
export const CARD_SELECTOR_COMPACT = 'app-card-compact';
export const CARD_SELECTOR_FULL = 'app-card-full';
```

**Symptom: a typo in a static member name gives `Value is of type 'undefined'.` rather than an error naming the member.** Cause: `accessHelper`'s class branch initialises `value` to `undefined` and only overwrites it if `getMembersOfClass` finds a matching **static** member; a miss returns that `undefined` unchanged. Fix: TypeScript itself will catch the typo if the member is read through a typed reference, so the real remedy is to make sure the constant is not being reached through `any` — the evaluator will not tell you.

**Symptom: adding `as const` or a type annotation to the failing expression changes nothing.** Cause: `ts.isAsExpression` and `ts.isNonNullExpression` recurse straight into their operand, so a cast is invisible to the chain — it can neither rescue an unsupported node nor create one. Fix: change the node kind, not its type. (The angle-bracket cast is a *different* node kind and does break — [10hc](10hc-the-typescript-the-evaluator-has-never-heard-of.md).)

**★ Symptom: a metadata helper that trims or lower-cases a string reports `Unable to evaluate statically.` and the same helper without the method call works.** Cause: `accessHelper` implements exactly four standard-library members by name — `length`, `slice` and `concat` on arrays, `concat` on strings — and every other property of a primitive falls through to `DynamicValue.fromUnknown`. Fix: express the transformation with operators, or precompute the finished string:

```ts
// ⛔ export function buildSelector(name: string): string {
//   return `app-${name.trim()}`;
// }
// ✅
export function buildSelector(name: string): string {
  return 'app-' + name;
}
```

## Interview questions

**Angular metadata has no `if`. Why is the ternary still a hazard rather than a safe alternative?**
Because `visitConditionalExpression` folds the condition and then visits only the selected branch, so the branch that is not taken is never checked for anything — not for unsupported syntax, not for unresolvable symbols, not for the wrong type. That makes a ternary in metadata a piece of code with an unverified half. The failure mode is delayed and looks unrelated: someone flips a build-time boolean months later, the other branch is visited for the first time, and the build breaks in a file nobody touched. It is the one place in the evaluator where "it compiles" does not mean "the compiler read it", and the remedy is to keep both branches trivially foldable or to lift the choice out of the decorator entirely.

**If `as` is invisible to the evaluator, why is that useful to know?**
Because it removes an entire family of failed remedies. When a metadata value will not fold, the reflex is to make it "more static" — add `as const`, add a type annotation, add a non-null assertion. `ts.isAsExpression` and `ts.isNonNullExpression` both recurse directly into `node.expression`, and parenthesised expressions do the same, so none of those changes anything the evaluator sees. It cuts both ways, and that is the useful half: you can annotate and assert freely in decorator metadata without ever making a working page stop working.

**★ How much of the JavaScript standard library can you use in decorator metadata?**
Four members, by name: `length`, `slice` and `concat` on a resolved array, and `concat` on a resolved string. They are hard-coded in `accessHelper` as `ArraySliceBuiltinFn`, `ArrayConcatBuiltinFn` and `StringConcatBuiltinFn`, and there is no general mechanism behind them — anything else, including `map`, `join`, `includes`, `trim` and `toUpperCase`, falls to that function's final `return DynamicValue.fromUnknown(node)` and produces `Unable to evaluate statically.` The practical rule that follows is to build metadata strings with operators rather than methods: `+` and template interpolation are both supported, so anything you wanted `join` or `trim` for can usually be written without a method call, and anything that genuinely needs one has to be precomputed into a literal.

← Prev: [What looks like this and is not](10he-what-looks-like-this-error-and-is-not.md) · Index: [Topic index](README.md) · Next → [The field-shape family](10i-the-field-shape-family.md)
