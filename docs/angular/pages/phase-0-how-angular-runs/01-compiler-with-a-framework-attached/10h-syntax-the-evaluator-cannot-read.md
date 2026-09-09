---
title: "`This syntax is not supported.` has exactly three doors in the whole compiler, and the widest of them is a `ts.SyntaxKind` that `visitExpression` never tests — which is how `new`, a tagged template, `typeof`, `await`, `delete` and `void` all end up printing the same eight words"
sidebar_label: "10h · Syntax the evaluator cannot read"
sidebar_position: 10.7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/diagnostics.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/diagnostics.ts);
> and `microsoft/TypeScript` at tag `v6.0.3`:
> [`src/compiler/types.ts`](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/types.ts) for the node interfaces named below.
> Documentation-validated; **no sandbox run** — no build was executed and no terminal output was captured. Every message on this page is a string literal read from a named source file.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not** — it comes from research prose rather than a line of `error_code.ts`. Match on the message text. No number on this page carries a dagger, because this page cites no numbers.

**Of the ten trace strings in [10 · Metadata errors, one by one](10-metadata-errors-one-by-one.md), `This syntax is not supported.` is the only one that tells you the *shape* of your code is the problem rather than the *values* in it. It is also the only one with a completely closed and countable set of causes, because there are exactly three lines in the entire compiler that produce it. Two of them are one-line lookups against operator tables and are worked in [10hd · The two operator maps](10hd-the-two-operator-maps.md). The third is the final `else` of a forty-line `if/else` chain, and it is where the overwhelming majority of these errors come from: you wrote a kind of expression that `StaticInterpreter.visitExpression` has no branch for, so it did not fail to evaluate your code — it never looked at it. This chunk establishes the mechanism and works the absent *operations*; [10hb](10hb-code-as-a-metadata-value.md) works functions and classes, and [10hc](10hc-the-typescript-the-evaluator-has-never-heard-of.md) works the node kinds nobody warns you about at all.**

## Where the eight words come from

Three files, in order. `dynamic.ts` declares the reason and documents it, verbatim:

```ts
/**
 * Syntax that `StaticInterpreter` doesn't know how to evaluate, for example a type of
 * `ts.Expression` that is not supported.
 */
UNSUPPORTED_SYNTAX,
```

and the constructor that produces it, verbatim:

```ts
static fromUnsupportedSyntax(node: ts.Node): DynamicValue {
  return new DynamicValue(node, undefined, DynamicValueReason.UNSUPPORTED_SYNTAX);
}
```

`dynamic.ts`'s `accept` dispatches that reason to one visitor, and `diagnostics.ts` gives it the string, verbatim:

```ts
visitUnsupportedSyntax(value: DynamicValue): ts.DiagnosticRelatedInformation[] {
  return [makeRelatedInformation(value.node, 'This syntax is not supported.')];
}
```

🔴 **`fromUnsupportedSyntax` is called from exactly three places in `interpreter.ts`, and nowhere else in the partial evaluator.** That is the whole cause list:

| door | site | fires when |
|---|---|---|
| **1** | the final `else` of `visitExpression` | the node's `ts.SyntaxKind` is not tested by any branch of the chain |
| **2** | `visitPrefixUnaryExpression` | `UNARY_OPERATORS.has(operatorKind)` is false — [10hd](10hd-the-two-operator-maps.md) |
| **3** | `visitBinaryExpression` | `BINARY_OPERATORS.has(tokenKind)` is false — [10hd](10hd-the-two-operator-maps.md) |

## Door one, and what it does to the trace

The end of the chain, verbatim — [09c](09c-the-partial-evaluator-is-the-grammar.md) quotes it in full and argues *why* the chain is the grammar; here only the last lines matter:

```ts
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

Read those last three lines together with the `else`, because they decide what you actually see. The `else` returns a `DynamicValue` whose `node` **is** the offending expression. Every enclosing `visitExpression` call then re-wraps it with `fromDynamicInput`, because `result.node !== node` for the outer node. So a failure one level down inside a constant produces **two** related-information notes, not one:

```text
Illustrative — assembled from string literals read from
annotations/common/src/diagnostics.ts and partial_evaluator/src/diagnostics.ts.
Not captured from a build.

  error: selector must be a string
    Value could not be determined statically.
      note: Unable to evaluate this expression statically.   <- the outer expression
      note: This syntax is not supported.                    <- the node with no branch
```

🔴 **The second note is the one that names the node you got wrong, and it is the one editors hide.** The de-duplication rule in `TraceDynamicValueVisitor` — one entry per statement, quoted in full in [10](10-metadata-errors-one-by-one.md) — keeps that pair from becoming five notes on a five-deep chain, but it never suppresses the innermost one. If you can only see one note, your editor is collapsing related information, not the compiler being terse.

## `new` — `ts.NewExpression`

There is no `ts.isNewExpression` branch. Not "there is one and it rejects you": there is none, so a constructor call in an evaluated field is invisible syntax. The realistic form is not `new Date()` in a `selector`; it is a configuration object that someone made a class.

```ts
// ⛔ src/app/selectors.ts — SELECTORS.card resolves through an object that never folds.
// class SelectorSet {
//   readonly card = 'app-user-card';
//   readonly row = 'app-user-row';
// }
// export const SELECTORS = new SelectorSet();

// ✅ the same thing the evaluator can read: an object literal.
export const SELECTORS = {
  card: 'app-user-card',
  row: 'app-user-row',
} as const;
```

```ts
import {Component} from '@angular/core';
import {SELECTORS} from './selectors';

@Component({
  selector: SELECTORS.card,
  template: `<h2 class="name">{{ name }}</h2>`,
})
export class UserCard {
  protected readonly name = 'Ada';
}
```

The version of that config class that *does* work — static members, no instance — is in [10hf](10hf-where-the-chain-surprises-you.md).

⚠️ **`new` in a field that is never evaluated is fine and always has been.** `providers` is relayed to the emitted code unchanged ([09b](09b-gate-two-what-is-evaluated-and-what-is-relayed.md)), so `new InjectionToken('CARD_CONFIG')` in a provider array reaches no evaluator at all. The `new` rule bites only in the fields [09b](09b-gate-two-what-is-evaluated-and-what-is-relayed.md) lists as evaluated.

## Tagged template literals — `ts.TaggedTemplateExpression`

The chain tests two of TypeScript's three template forms and not the third: `ts.isNoSubstitutionTemplateLiteral` returns `node.text` immediately, `ts.isTemplateExpression` goes to `visitTemplateExpression`, and `ts.isTaggedTemplateExpression` is absent. The tag function is never consulted — including `String.raw`, which is a built-in everywhere else.

```ts
import {Component} from '@angular/core';

// A `html` tag from an editor-highlighting package, or String.raw, or a dedent helper:
// every one of them is a ts.TaggedTemplateExpression and none of them has a branch.

// ⛔ template: html`<p>Hello, {{ name }}</p>`
// ⛔ template: String.raw`<p>Hello, {{ name }}</p>`

@Component({
  selector: 'app-greeting',
  template: `<p>Hello, {{ name }}</p>`,
})
export class Greeting {
  protected readonly name = 'Ada';
}
```

🔴 **A tagged template with no substitutions fails exactly as hard as one with substitutions.** It is not the interpolation that is unsupported — untagged interpolation folds fine — it is the tag. The clean escape when you genuinely want the tooling is `templateUrl`, which moves the markup into a `.html` file the editor already highlights and, as a bonus, restores direct source mapping for template errors ([17](17-the-filename-in-the-error.md)). [09c](09c-the-partial-evaluator-is-the-grammar.md) argues the deeper point: angular.dev lists tagged template strings as supported *template expression* syntax, which is a different language.

## `typeof`, `await`, `delete`, `void` — four absent unary keywords

TypeScript gives each of these its own node interface — `TypeOfExpression`, `AwaitExpression`, `DeleteExpression`, `VoidExpression` — and none of the four is tested by the chain. They fail for the same reason and are worth reading as one group, because the *fixes* are four different fixes.

```ts
// ⛔ typeof — the classic "is this a browser" guard, in metadata.
// selector: typeof window === 'undefined' ? 'app-ssr-card' : 'app-card',

// ✅ two components, or a constant your build sets. There is no third option:
// the evaluator runs at build time and has no notion of which platform will run.
export const CARD_SELECTOR = 'app-user-card';
```

```ts
// ⛔ await — metadata is emitted synchronously; there is no phase in which this could run.
// template: await loadTemplate(),

// ✅ templateUrl, which the compiler resolves and inlines at build time.
// @Component({selector: 'app-user-card', templateUrl: './user-card.html'})
```

```ts
// ⛔ delete — a mutation, in a position with no statements to mutate in.
// host: delete BASE_HOST['class'],

// ✅ build the object you want; do not un-build one you have.
export const BASE_HOST = {'role': 'listitem', 'class': 'card'} as const;
export const PLAIN_HOST = {'role': 'listitem'} as const;
```

```ts
// ⛔ void — usually written as `void 0` where someone wanted `undefined`.
// exportAs: void 0,

// ✅ omit the field. `undefined` is also resolvable as an identifier, but an absent
// field and a field set to undefined are not always the same thing to a handler.
```

🔴 **`typeof` is the one that will confuse you, because the evaluator handles `typeof` in a *type* position perfectly well.** `visitType` has an explicit `ts.isTypeQueryNode` branch and a completely separate fallthrough — `DynamicValue.fromDynamicType`, which prints `Dynamic type.` Two dispatches, two fallthroughs, one keyword; the boundary is worked in [10he](10he-what-looks-like-this-error-and-is-not.md).

## Gotchas

**★ Symptom: `This syntax is not supported.` with no indication which piece of syntax it means.** Cause: the note is attached to a node, not to a name — `makeRelatedInformation(value.node, …)` — so the information is entirely in the *span*, and a terminal that prints the message without the source excerpt discards it. Fix: read the diagnostic in an editor, or in a terminal that renders related-information spans; the span will be sitting on the exact `new`, tag or keyword.

**★ Symptom: `new InjectionToken(...)` in `providers` compiles, and the identical expression in `selector` does not.** Cause: `providers` is never passed to the evaluator — the directive handler wraps it in a `WrappedNodeExpr` and emits it unchanged — while `selector` is evaluated. Fix: nothing to change in `providers`; the rule is about which *field*, not which syntax. The evaluated-field list is [09b](09b-gate-two-what-is-evaluated-and-what-is-relayed.md).

**★ Symptom: you moved a template from `` html`…` `` to a plain backtick literal and the error moved rather than disappeared.** Cause: the tag was one problem; a substitution that does not fold is a different one, and `visitTemplateExpression` reports it as `A string value could not be determined statically.` — a different trace string with a different cause. Fix: check *which* of the ten strings you now have before assuming the change failed. The message text, not the line number, is what tells you whether you made progress:

```ts
// ⛔ template: html`<p>${GREETING}</p>`      -> This syntax is not supported.
// ⛔ template: `<p>${loadGreeting()}</p>`    -> A string value could not be determined statically.
// ✅
export const GREETING = 'Hello, Ada';
// template: `<p>${GREETING}</p>`
```

**Symptom: the error span is on a line in a file you did not edit.** Cause: door one attaches the note to the offending node wherever it lives, and the re-wrap only adds a second note at the referencing site. A constant defined three files away is reported where it is defined. Fix: follow the innermost note, not the squiggle; the squiggle is on the decorator field because that is where the *headline* was raised, and the headline is never the diagnosis ([09g](09g-reading-a-metadata-failure.md)).

**Symptom: `delete` or an assignment inside metadata produces a syntax complaint rather than a "statements are not allowed" complaint.** Cause: there is no statement grammar to violate. A decorator argument is an expression, and the evaluator's only vocabulary is expression node kinds; a mutation is simply a node kind with no branch (`delete`) or an operator with no map entry (`=`, [10hd](10hd-the-two-operator-maps.md)). Fix: metadata is a value, not a program — construct the final object rather than editing one.

## Interview questions

**★ How many distinct places in the Angular compiler can produce `This syntax is not supported.`, and why does the number matter?**
Three, all in `partial_evaluator/src/interpreter.ts`: the final `else` of `visitExpression`, the guard at the top of `visitPrefixUnaryExpression`, and the guard at the top of `visitBinaryExpression`. The number matters because it turns an open question — "what could Angular possibly object to here?" — into a two-step check you can do by eye. Either the whole expression is a node kind the chain does not test, or it is a unary or binary expression whose *operator* is not a key in a small map. Nothing else in the evaluator emits that string, so if you can rule out those three, you have misread the trace.

**★ A colleague says "Angular rejects `new` in decorators for security reasons." What is actually happening?**
Nothing is being rejected. `visitExpression` is a chain of `ts.isX(node)` tests, and there is no `ts.isNewExpression` test in it, so a constructor call reaches the final `else` and becomes a `DynamicValue` with reason `UNSUPPORTED_SYNTAX` — documented as *"Syntax that `StaticInterpreter` doesn't know how to evaluate"*. The evaluator did not decide anything about `new`; it has no code for that node kind. The distinction is practical rather than pedantic: a rule based on intent invites you to look for an escape hatch or a flag, and there is none, whereas a missing branch tells you the only move is to change the node kind.

**Why does one unsupported node usually produce two related-information notes, and which one should you read?**
Because of the three lines at the bottom of `visitExpression`: if a sub-expression returned a `DynamicValue` whose `node` is not the node currently being visited, the result is re-wrapped with `fromDynamicInput`. That produces a `DYNAMIC_INPUT` failure at the outer node — printing `Unable to evaluate this expression statically.` — carrying the `UNSUPPORTED_SYNTAX` failure at the inner node, printing `This syntax is not supported.` Read the inner one. The outer note only tells you that something underneath it failed, which the chain sentence already told you.

**Why is there no way to write a platform check in an evaluated metadata field?**
Because every spelling of one is either an absent node kind or an absent operator. `typeof window` is a `ts.TypeOfExpression` with no branch; `window` on its own resolves to an ambient declaration and fails as an external reference ([10c](10c-symbols-the-compiler-cannot-resolve.md)); `globalThis?.document ?? null` adds a `??` that is not in the operator map ([10hd](10hd-the-two-operator-maps.md)). That is not a series of coincidences — the evaluator runs once, at build time, producing one component definition, so a field whose value depends on the runtime platform has no meaning in it. The fix is always structural: two components, or a build-time constant, never a conditional inside the decorator.

← Prev: [Enum members and the core guard](10gd-enum-members-and-the-core-guard.md) · Index: [Topic index](README.md) · Next → [Code as a metadata value](10hb-code-as-a-metadata-value.md)
