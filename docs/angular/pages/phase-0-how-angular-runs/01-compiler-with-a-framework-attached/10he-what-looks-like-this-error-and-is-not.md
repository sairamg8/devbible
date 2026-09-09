---
title: "Two things will send you to the wrong page for this error — six other failures that look identical in a terminal and print a different one of the ten strings, and an angular.dev table that lists `new` as supported syntax and spread as unsupported, which is precisely backwards for the compiler you are running"
sidebar_label: "10he · What looks like this and is not"
sidebar_position: 10.74
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts),
> [`goldens/public-api/compiler-cli/compiler_options.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/compiler-cli/compiler_options.api.md) for the v22 public option surface;
> and angular.dev [Ahead-of-time (AOT) compilation](https://angular.dev/tools/cli/aot-compiler), ⚠️ **which describes the View Engine metadata collector and is contradicted throughout the second half of this page.**
> Documentation-validated; **no sandbox run** — every message is a string literal read from a named source file, and every doc sentence is quoted verbatim.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not** — it comes from research prose rather than a line of `error_code.ts`. Match on the message text.

**A metadata error is three layers deep and only the innermost one carries a fact ([10](10-metadata-errors-one-by-one.md)). That makes the family in [10h](10h-syntax-the-evaluator-cannot-read.md) unusually easy to misattribute in both directions: six common failures look like unsupported syntax in a terminal and are not — they print one of the other nine trace strings and have completely different fixes — and one very widely-read documentation page tells you that syntax is unsupported when it is not, and supported when it is not, because it is describing a compiler Angular stopped shipping. This chunk closes both. The first half is a message-to-page map you can use as a decision procedure; the second half is the specific angular.dev sentences to stop believing, quoted verbatim, with what the current source says instead.**

## Six failures that are not this one

### 1 — a spread

🔴 **A spread never produces `This syntax is not supported.`** This is worth stating flatly because the opposite is widely repeated. Spread is handled in three separate places and none of them is `visitExpression`'s fallthrough: `visitArrayLiteralExpression` tests `ts.isSpreadElement`, `evaluateFunctionArguments` tests it again for call arguments, and `visitObjectLiteralExpression` tests `ts.isSpreadAssignment`. The array and argument paths share one helper, verbatim:

```ts
private visitSpreadElement(node: ts.SpreadElement, context: Context): ResolvedValueArray {
  const spread = this.visitExpression(node.expression, context);
  if (spread instanceof DynamicValue) {
    return [DynamicValue.fromDynamicInput(node, spread)];
  } else if (!Array.isArray(spread)) {
    return [DynamicValue.fromInvalidExpressionType(node, spread)];
  } else {
    return spread;
  }
}
```

So a spread of something unfoldable gives `Unable to evaluate this expression statically.`, and a spread of something that folded to a non-array gives `Unable to evaluate an invalid expression.` Both are trace strings this page's family does not use.

⚠️ **What I could not establish:** whether a `ts.SpreadElement` can reach `visitExpression` at all. Every syntactic position a spread element can occupy — array literal, call argument — is intercepted before the dispatch, and object spread is a different node (`ts.SpreadAssignment`). I could not construct a path to the fallthrough and I am not asserting that none exists.

### 2 — optional chaining, `?.`

`a?.b` is a `ts.PropertyAccessExpression` in TypeScript's AST, so `ts.isPropertyAccessExpression` matches and the chain admits it. `visitPropertyAccessExpression` does **not** inspect `questionDotToken` — there is no short-circuit. When the left-hand side folds to `undefined`, `accessHelper` runs and falls past every branch to its own fallthrough, verbatim:

```ts
  } else if (lhs instanceof DynamicValue) {
    return DynamicValue.fromDynamicInput(node, lhs);
  } else if (lhs instanceof SyntheticValue) {
    return DynamicValue.fromSyntheticInput(node, lhs);
  }

  return DynamicValue.fromUnknown(node);
}
```

`fromUnknown` is the residual bucket — `Unable to evaluate statically.` So an optional chain that would have been `undefined` at runtime is a metadata failure with the least informative message in the catalogue ([10f](10f-destructuring-in-metadata.md)), not a syntax complaint.

```ts
export const CARD_CONFIG = {selector: 'app-user-card'} as const;

// ⛔ MAYBE_CONFIG?.selector where MAYBE_CONFIG folds to undefined
//    -> Unable to evaluate statically.

// ✅ resolve the branch where the constant is defined; the ternary is in the chain.
export const CARD_SELECTOR = CARD_CONFIG.selector;
```

### 3 — `typeof` in a *type* position

`typeof window` in an expression is door one ([10h](10h-syntax-the-evaluator-cannot-read.md)). `typeof X` in a type is `ts.TypeQueryNode` and goes to a completely separate dispatch with a different fallthrough, verbatim:

```ts
public visitType(node: ts.TypeNode, context: Context): ResolvedValue {
  if (ts.isLiteralTypeNode(node)) {
    return this.visitExpression(node.literal, context);
  } else if (ts.isTupleTypeNode(node)) {
    return this.visitTupleType(node, context);
  } else if (ts.isNamedTupleMember(node)) {
    return this.visitType(node.type, context);
  } else if (ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.ReadonlyKeyword) {
    return this.visitType(node.type, context);
  } else if (ts.isTypeQueryNode(node)) {
    return this.visitTypeQuery(node, context);
  } else if (ts.isTypeReferenceNode(node)) {
    return this.visitTypeReference(node, context);
  } else if (ts.isImportTypeNode(node)) {
    return this.visitImportType(node, context);
  }

  return DynamicValue.fromDynamicType(node);
}
```

**Two dispatches, two fallthroughs, one keyword.** The type side prints `Dynamic type.`, never `This syntax is not supported.` It is reached from `visitVariableDeclaration` for ambient declarations, which is why `declare const SEL: 'app-x'` folds and `declare const SEL: string` does not ([10e](10e-values-that-resolve-but-do-not-fold.md)).

### 4, 5, 6 — the rest, in one table

| what you see | what it actually is | where it is worked |
|---|---|---|
| `Value is a reference to 'buildSelector'.` | a named function used without parentheses; `visitDeclaration`'s fallthrough returns a `Reference` | [10hb](10hb-code-as-a-metadata-value.md) |
| `Unable to evaluate statically.` with the span on a whole object literal | a method, getter or setter as an object member — not one of the three handled property forms | [10hb](10hb-code-as-a-metadata-value.md) |
| `Unable to evaluate an invalid expression.` | a supported operator whose operand `literal()` rejected — an object or array where a primitive was required | [10hd](10hd-the-two-operator-maps.md) |

⚠️ **One more, and it is a genuine name collision.** `error_code.ts` declares `LOCAL_COMPILATION_UNSUPPORTED_EXPRESSION`, documented verbatim as *"In local compilation mode a certain expression or syntax is not supported. This is usually because the expression/syntax is not very common and so we did not add support for it yet."* That is a **different diagnostic**, raised only under `compilationMode: 'experimental-local'`, with a different message and a different remedy — [10d](10d-import-cycles-and-local-compilation.md). If your build sets that mode, check which of the two you have before applying anything from [10h](10h-syntax-the-evaluator-cannot-read.md).

## The angular.dev page that describes a different compiler

angular.dev's [AOT compilation](https://angular.dev/tools/cli/aot-compiler) guide is the most-read source on this subject and it documents **View Engine's metadata collector** — a program that emitted `.metadata.json` files alongside every `.d.ts`, read back by a `StaticReflector`. `ngtsc` has no collector, emits no `.metadata.json`, and evaluates metadata in-process with `StaticInterpreter`. So the page is not stale about this compiler; it is accurate about a different one, which is a much worse failure mode because the two overlap enough to seem compatible. [10f](10f-destructuring-in-metadata.md) makes the same argument for destructuring; here are the sentences that bear on *syntax*.

### The supported-syntax table is inverted on two rows

The guide opens with, verbatim:

> *"The AOT collector only understands a subset of JavaScript."*

and then lists the subset. Two of its rows are exactly backwards for `ngtsc`:

| the guide's row | `ngtsc` at v22.1.5 |
|---|---|
| **`New`** — `new Oven()`, listed as **supported syntax** | there is **no** `ts.isNewExpression` branch — door one ([10h](10h-syntax-the-evaluator-cannot-read.md)) |
| **`Spread in literal array`** — `['apples', 'flour', …]`, listed as **supported syntax**, and then listed as `no` in the *foldability* table lower down | `visitArrayLiteralExpression` tests `ts.isSpreadElement` and folds it through `visitSpreadElement`; spread in a literal array **works** |

🔴 **`new` is documented as allowed and is not; spread is documented as not foldable and is.** If you carry that table into a v22 codebase you will avoid the one thing that works and reach for the one thing that does not.

The consequence sentence attached to the table is equally unusable, verbatim:

> *"If an expression uses unsupported syntax, the collector writes an error node to the `.metadata.json` file."*

There is no `.metadata.json` file. What happens instead is `DynamicValue.fromUnsupportedSyntax`, in memory, surfacing as a related-information note under a diagnostic in the same build.

And the escape hatch the page offers does not exist either, verbatim:

> *"If you want `ngc` to report syntax errors immediately rather than produce a `.metadata.json` file with errors, set the `strictMetadataEmit` option in the TypeScript configuration file."*

`strictMetadataEmit` is **absent from the v22 public compiler-option surface** — `goldens/public-api/compiler-cli/compiler_options.api.md` at `v22.1.5` is 89 lines and does not contain it. Setting it does nothing.

### The arrow-function rule, and why its example is wrong

Verbatim:

> *"The AOT compiler does not support function expressions and arrow functions, also called _lambda_ functions."*

and:

> *"The AOT collector does not support the arrow function, `() => new Server()`, in a metadata expression. It generates an error node in place of the function."*

**The rule survives; the example does not.** An arrow function in an *evaluated* field really is door one. But the field in the example is `providers`, which `ngtsc` never evaluates — the directive handler wraps the expression in a `WrappedNodeExpr` and emits it unchanged ([09b](09b-gate-two-what-is-evaluated-and-what-is-relayed.md)) — so the exact code the page says fails is code that compiles. Worked in full in [10hb](10hb-code-as-a-metadata-value.md).

The page then adds, verbatim:

> *"In version 5 and later, the compiler automatically performs this rewriting while emitting the `.js` file."*

That describes View Engine's expression-lowering transform. ⚠️ **I did not read `ngtsc` for a lowering pass, so I am not asserting that nothing equivalent runs** — but the option that governed it, `disableExpressionLowering`, is documented on angular.dev's compiler-options page and is likewise absent from the v22 golden. Do not rely on the sentence; write the exported named function.

### The `new` rule, whose constraint survived and whose mechanism did not

Verbatim, from the same page's "Supported classes and functions" section:

> *"The collector can represent a function call or object creation with `new` as long as the syntax is valid."*

> *"New instances — The compiler only allows metadata that create instances of the class `InjectionToken` from `@angular/core`."*

In `ngtsc` there is no allowlist and no `InjectionToken` carve-out. `new` is simply not a branch of the dispatch, and `new InjectionToken('X')` continues to work everywhere it did — not because it is permitted, but because it appears in `providers`, which is relayed rather than evaluated. Same outcome, different reason, and the difference predicts different things: on this compiler, `new InjectionToken('X')` in an *evaluated* field fails exactly like any other `new`.

🔴 **The rule for the whole page: treat it as evidence about intent and nothing on it as evidence about behaviour.** Its foldability table in particular should not be used at all; build one from `visitExpression` and `BINARY_OPERATORS`, which is what actually runs ([09c](09c-the-partial-evaluator-is-the-grammar.md)).

## Gotchas

**★ Symptom: you read that spread is unsupported in metadata, avoided it, and wrote something more complicated.** Cause: the angular.dev foldability table says `Spread in literal array | no`, describing the View Engine collector. `visitArrayLiteralExpression` explicitly tests `ts.isSpreadElement` and folds through `visitSpreadElement`. Fix: spread freely in a metadata array, subject to the spread operand itself folding to an array:

```ts
export const BASE_IMPORTS = [] as const;
// imports: [...BASE_IMPORTS, UserCard, UserRow]   // folds
```

**★ Symptom: an optional chain in metadata reports `Unable to evaluate statically.` and you go looking for unsupported syntax.** Cause: `?.` is admitted by the chain — it is an ordinary `ts.PropertyAccessExpression` — and there is no short-circuit, so an `undefined` left-hand side falls out of `accessHelper`'s fallthrough as `fromUnknown`. Fix: resolve the optionality where the constant is defined, with a ternary, so the metadata field sees a value rather than a chain.

**★ Symptom: `new InjectionToken('X')` works and you conclude `new` is allowed with an allowlist, as the docs say.** Cause: there is no allowlist; `providers` is not evaluated. Fix: test the belief by putting the same expression somewhere evaluated — it will fail. The operative question is always *which field*, and the evaluated list is [09b](09b-gate-two-what-is-evaluated-and-what-is-relayed.md).

**★ Symptom: you set `strictMetadataEmit` to get earlier syntax errors and nothing changed.** Cause: the option belongs to a compiler that no longer exists; the v22 public option surface does not contain it, and unknown keys in `angularCompilerOptions` are not errors. Fix: there is no equivalent switch — metadata syntax failures are already reported in the build that hits them, because there is no separate emit phase to defer them to. The option-surface question generally is [13e](13e-the-option-surface-and-config-time-diagnostics.md).

**Symptom: `typeof` works in one place in your codebase and fails in another.** Cause: two dispatches. `typeof X` in a type position reaches `visitType`'s `ts.isTypeQueryNode` branch; `typeof X` in an expression position reaches `visitExpression`'s fallthrough. Fix: nothing to fix in the type position; in the expression position there is no rewrite, because a build-time evaluator has no runtime to ask about.

**Symptom: a local-compilation build reports something about unsupported syntax and none of the door-one advice applies.** Cause: `LOCAL_COMPILATION_UNSUPPORTED_EXPRESSION` is a different diagnostic with a similar name, raised only under `compilationMode: 'experimental-local'`. Fix: check the compilation mode first, then go to [10d](10d-import-cycles-and-local-compilation.md); the fixes are about where a constant lives, not about which node kind you used.

**Symptom: two teammates disagree about a metadata rule and both cite documentation.** Cause: angular.dev carries rules for two compilers, and nothing on the AOT page marks which. Fix: settle it against `visitExpression`'s dispatch and the two operator maps, which are about a hundred lines total and are the only description of the current behaviour that exists. Where the page and the source disagree, the source wins and the disagreement is worth writing down where your team will see it.

## Interview questions

**★ A metadata error says the value could not be determined statically. How do you decide which of the ten trace strings you actually have, and why does that come before anything else?**
By reading the related-information note rather than the headline or the chain sentence — the headline restates the field you are looking at and the chain sentence is one of only three, so neither narrows anything. The note is one of ten fixed strings, and each names a different mechanism with a different remedy: `This syntax is not supported.` means a node kind or operator with no branch, `Unable to evaluate statically.` means the residual bucket, `Unable to evaluate an invalid expression.` means a resolved value of the wrong shape for the operation, `Value is a reference to 'X'.` means you handed it a declaration. Six common failures print one of those and look identical in a terminal, so guessing the family is how an hour disappears. Read the string first, pick the page, then read the span.

**★ Angular's own AOT documentation lists `new Oven()` as supported metadata syntax. Is it?**
No — and the same table lists spread in an array literal as unsupported, which it also is not. Both rows are correct for View Engine's metadata collector, the program that emitted `.metadata.json` files, and both are inverted for `ngtsc`: there is no `ts.isNewExpression` branch in `StaticInterpreter.visitExpression`, so `new` falls through to unsupported syntax, while `visitArrayLiteralExpression` explicitly handles `ts.isSpreadElement`. The general lesson matters more than the two rows: that page is a correct description of a different implementation, not an out-of-date description of this one, so reading it as approximately true produces confident and specific wrong beliefs rather than vague ones.

**Why is `?.` in metadata a worse diagnostic than an unsupported operator?**
Because it is accepted rather than rejected. Optional chaining parses to an ordinary `ts.PropertyAccessExpression`, which the chain tests, so the evaluator proceeds — but `visitPropertyAccessExpression` never looks at the `questionDotToken` and implements no short-circuit, so an `undefined` left-hand side reaches `accessHelper` and falls out of its final `return DynamicValue.fromUnknown(node)`. `UNKNOWN` is the residual reason, documented as covering *"any reason other the above"*, and it prints `Unable to evaluate statically.` — a message that names no mechanism at all. An unsupported operator at least tells you the category. The remedy is to resolve the optionality at the definition site with a ternary, which is supported, rather than at the use site with a chain, which is admitted and then unhelpful.

**How would you tell a colleague to decide whether an Angular documentation page is describing the current compiler?**
Look for the artefacts, not the date. If the page mentions `.metadata.json`, a *collector*, a `StaticReflector`, `strictMetadataEmit`, `ngcc` or code folding, it is describing View Engine and its rules should be treated as evidence about intent only. `ngtsc` has none of those things: it is a `ts.CustomTransformers` pipeline with a partial evaluator running inside the TypeScript program, and its failure surface is `DynamicValue` reasons and related-information notes. A cheap confirmation is available for options specifically — `goldens/public-api/compiler-cli/compiler_options.api.md` at your version is the complete public option surface, and any option a doc names that is not in that file no longer exists.

**Both `Unable to evaluate an invalid expression.` and `This syntax is not supported.` can come from `visitBinaryExpression`. What distinguishes them?**
Which check failed. The first line of the method looks the operator token up in `BINARY_OPERATORS`; a miss returns `fromUnsupportedSyntax` — you used an operator the evaluator has no entry for, such as `??`. If the lookup hits and the entry is one of the twenty `literal` operators, both operands are pushed through the `literal()` helper, which accepts primitives, `null`, `undefined` and already-failed values and rejects everything else with `fromInvalidExpressionType` — you used a supported operator on an object, array or reference. So the same method produces two of the ten strings, and the distinction is operator-versus-operand: change the operator for the first, change the operands for the second.

← Prev: [The two operator maps](10hd-the-two-operator-maps.md) · Index: [Topic index](README.md) · Next → [Where the chain surprises you](10hf-where-the-chain-surprises-you.md)
