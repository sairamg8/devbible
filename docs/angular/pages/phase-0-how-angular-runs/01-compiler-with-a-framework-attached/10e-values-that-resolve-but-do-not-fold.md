---
title: "A variable declaration has four possible outcomes in the partial evaluator and only one of them is an error — which is why `export let SELECTOR;` fails with a wrong-type message, `declare const SEL: 'app-x'` succeeds, and `declare const SEL: string` fails differently again"
sidebar_label: "10e · Values that do not fold"
sidebar_position: 10.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/common/src/diagnostics.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/common/src/diagnostics.ts).
> Documentation-validated; **no sandbox run** — every message below is a string literal read from one of those files.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not** — it comes from research prose rather than a line of `error_code.ts`. Match on the message text.

**This is the page for errors where nothing is missing and nothing is unsupported — the compiler found your declaration, understood it, and still could not produce a value. All of them come out of one 25-line function, `visitVariableDeclaration`, which has four branches and a candid TODO admitting that one of them is historical accident rather than design. Reading that function once tells you why an uninitialised `export let` produces a *wrong-type* error rather than a static-analysis error, and why the literalness of an ambient declaration's **type** — not its value, which does not exist — decides whether your build passes.**

## The function the whole page comes out of

`partial_evaluator/src/interpreter.ts`, verbatim including the TODO, which is unusually honest source:

```ts
private visitVariableDeclaration(node: ts.VariableDeclaration, context: Context): ResolvedValue {
  const value = this.host.getVariableValue(node);
  if (value !== null) {
    return this.visitExpression(value, context);
  } else if (isVariableDeclarationDeclared(node)) {
    // If the declaration has a literal type that can be statically reduced to a value, resolve to
    // that value. If not, the historical behavior for variable declarations is to return a
    // `Reference` to the variable, as the consumer could use it in a context where knowing its
    // static value is not necessary.
    //
    // Arguably, since the value cannot be statically determined, we should return a
    // `DynamicValue`. This returns a `Reference` because it's the same behavior as before
    // `visitType` was introduced.
    //
    // TODO(zarend): investigate switching to a `DynamicValue` and verify this won't break any
    // use cases, especially in ngcc
    if (node.type !== undefined) {
      const evaluatedType = this.visitType(node.type, context);
      if (!(evaluatedType instanceof DynamicValue)) {
        return evaluatedType;
      }
    }
    return this.getReference(node, context);
  } else {
    return undefined;
  }
}
```

Four outcomes, in the order the function tries them:

| your declaration | outcome | what you see if the field wanted a string |
|---|---|---|
| initialised (`const X = 'app-card'`) | folds to the initialiser | ✅ compiles |
| ambient with a **literal** type (`declare const X: 'app-card'`) | folds via `visitType` | ✅ compiles |
| ambient with a **wide** type (`declare const X: string`) | a `Reference` | `Value is a reference to 'X'.` |
| declared, not ambient, not initialised (`export let X;`) | the value `undefined` | `Value is of type 'undefined'.` |

`isVariableDeclarationDeclared` is nothing more than a modifier check — so "ambient" here has a purely syntactic definition, and it is not the one your intuition uses:

```ts
modifiers !== undefined && modifiers.some((mod) => mod.kind === ts.SyntaxKind.DeclareKeyword)
```

## `export let SELECTOR;` — an error that is not a static-analysis error

**Symptom.** `selector must be a string` → `Value is of type 'undefined'.` No trace at all, because there is no `DynamicValue` to trace.

**Cause.** The final `else` above. A `let` with no initialiser and no `declare` keyword is not ambient, so the function returns the JavaScript value `undefined` — a complete, successful evaluation whose answer happens to be `undefined`. The failure then happens one layer up, in the field's own type check, which wanted a string.

🔴 **This is where the "not statically analysable" mental model misleads.** The analysis worked perfectly. Your constant is genuinely undefined at the moment the compiler reads it, and it stays undefined until some code assigns to it at runtime — which is exactly the thing a build-time compiler cannot wait for.

**Fix.** Initialise it, and make it `const` so nothing can un-initialise it later:

```ts
// src/app/card-config.ts

// ⛔ `Value is of type 'undefined'.`
// export let CARD_SELECTOR: string;
// export function configure(): void {
//   CARD_SELECTOR = 'app-user-card';
// }

// ✅ a value the compiler can read at the moment it reads the decorator.
export const CARD_SELECTOR = 'app-user-card';
```

```ts
import {Component} from '@angular/core';
import {CARD_SELECTOR} from './card-config';

@Component({
  selector: CARD_SELECTOR,
  template: `<h2 class="name">{{ name }}</h2>`,
})
export class UserCard {
  protected readonly name = 'Ada';
}
```

If the value genuinely is not known until runtime, it cannot be a selector. Move the variability into a binding, a host binding or a provider — all three are evaluated at runtime by design.

## `declare const` — the type decides, not the value

**Symptom, case A.** `declare const SEL: string;` used as a selector → `selector must be a string` → `Value is a reference to 'SEL'.` with a related note `Reference is declared here.`

**Symptom, case B.** `declare const SEL: 'app-x';` used as a selector → compiles.

**Cause.** The ambient branch. There is no initialiser to read, so the evaluator falls back to the declared *type*, and `visitType` can reduce a **literal type** to a value because a literal type has exactly one inhabitant. A type of `string` has infinitely many, so `visitType` yields a `DynamicValue`, the branch is skipped, and the function returns a `Reference` to the declaration instead — which the field's checker reports as a reference rather than as a string.

**Fix.** Narrow the ambient type to a literal.

```ts
// src/typings/build-constants.d.ts

// ⛔ `Value is a reference to 'BUILD_SELECTOR'.`
// declare const BUILD_SELECTOR: string;

// ✅ one inhabitant, so `visitType` can reduce it.
declare const BUILD_SELECTOR: 'app-user-card';
```

⚠️ **This rule decides whether a `DefinePlugin`-style build constant is usable in metadata at all.** A build tool that injects `declare const APP_VERSION: string;` gives you something the evaluator will not fold. The same tool declaring `declare const APP_VERSION: '4.2.0';` gives you something it will — at the cost of regenerating the declaration whenever the value changes, which is usually the honest trade.

## Tuples, and the trace note `Dynamic type.`

**Symptom.** The trace note `Dynamic type.` and nothing else useful.

**Cause.** `DYNAMIC_TYPE`, whose doc comment carries its own worked example, verbatim:

> *"A value that could not be determined because it contains type information that cannot be statically evaluated… E.g. evaluating a tuple. `declare const foo: [string];` Evaluating `foo` gives a DynamicValue wrapped in an array with a reason of DYNAMIC_TYPE. This is because the static evaluator has a `string` type for the first element of this tuple, and the value of that string cannot be determined statically. The type `string` permits it to be 'foo', 'bar' or any arbitrary string, so we evaluate it to a DynamicValue."*

Read that precisely: the evaluator **did** produce an array, and it got the tuple's arity right. Only the elements are `DynamicValue`s, because their types are wide. The literalness rule from the previous section applies element by element.

The type side of the evaluator handles more than people expect — `visitTupleType`, `visitTypeQuery` (`typeof X`), `visitImportType`, `visitTypeReference`, and a `ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.ReadonlyKeyword` branch so that `readonly` tuples are unwrapped rather than rejected. `DynamicValue.fromDynamicType(node)` is only the fallthrough.

**Fix.** Give every element a literal type:

```ts
// src/typings/build-constants.d.ts

// ⛔ elements are `string` → `Dynamic type.`
// declare const SUPPORTED_SELECTORS: [string, string];

// ✅ every element has exactly one inhabitant, and `readonly` is unwrapped by design.
declare const SUPPORTED_SELECTORS: readonly ['app-user-card', 'app-user-row'];
```

## Gotchas

**★ Symptom: `Value is of type 'undefined'.` on a constant that is definitely assigned somewhere.** Cause: it is assigned *at runtime*, and `export let X;` evaluates to `undefined` at build time — successfully. Fix: `export const X = '…';`. If the value cannot be known at build time it cannot be metadata at all; move it to a binding or a provider.

**★ Symptom: a build-tool-injected global works in your component body and fails in the decorator.** Cause: the injected `.d.ts` declares it as `string`, so the ambient branch falls through `visitType` to a `Reference` — `Value is a reference to 'APP_VERSION'.` In a class body TypeScript only needs the type, so nothing complains there. Fix: narrow the ambient declaration to a literal type, regenerating it when the value changes:

```ts
// src/typings/build-constants.d.ts — generated by the build, one literal per constant.
declare const APP_VERSION: '4.2.0';
declare const CARD_SELECTOR: 'app-user-card';
```

**Symptom: `Dynamic type.` on an array whose contents you can see in the source.** Cause: you are looking at an *ambient tuple* whose element types are wide. The evaluator got the array and the arity right; the elements are `DynamicValue`s. Fix: declare the tuple with literal element types and mark it `readonly` — the evaluator explicitly unwraps `ts.SyntaxKind.ReadonlyKeyword`, so `as const` costs nothing.

**Symptom: you add a type annotation to a working `const` and it keeps working; you add one to a working `declare const` and it breaks.** Cause: for an initialised declaration the initialiser is read first and the type is never consulted; for an ambient declaration the type is the *only* source of a value. Widening the annotation on an ambient constant from `'app-card'` to `string` removes the compiler's only route to the value. Fix: keep ambient declarations literal; annotate ordinary constants freely.

**Symptom: you cannot tell whether the compiler is treating your declaration as ambient.** Cause: "ambient" here is not a semantic judgement — `isVariableDeclarationDeclared` looks for a literal `declare` modifier and nothing else. A declaration inside a `.d.ts` *without* the keyword, or one you think of as ambient because of where it lives, is not ambient to this function. Fix: read the modifier list, not the filename.

**Symptom: two constants in the same file, same shape, and only one folds.** Cause: almost always one is `const` with an initialiser and the other is `declare const` re-exported from a typings file — different branches of the same function, different rules. Fix: check for the `declare` keyword before assuming a mystery; the four-row table above covers every case this function can produce.

**Symptom: a wide ambient declaration produces `Value is a reference to 'X'.` and you expected `Value could not be determined statically.`** Cause: the source comment calls the `Reference` return *"the historical behavior"* and carries a TODO to switch it to a `DynamicValue`. It has not been switched. Fix: none needed — but do not treat the *shape* of this message as a stable contract; treat the underlying rule (a wide ambient type does not fold) as the stable part.

## Interview questions

**★ `export let SELECTOR;` with no initialiser. What error do you get, and why is it not "unknown identifier"?**
You get `selector must be a string` followed by `Value is of type 'undefined'.` — a wrong-type error, with no trace under it. It is not an unknown-identifier error because the identifier was found: `visitVariableDeclaration` resolved the declaration, saw no initialiser and no `declare` modifier, and returned the JavaScript value `undefined`, which is the correct answer to "what does this variable hold at compile time". The evaluation succeeded; the field's own type check rejected the result. The distinction matters because it tells you where to look — not at imports or at tsconfig, but at the declaration itself.

**★ Why does `declare const SEL: 'app-x'` work in a `selector` but `declare const SEL: string` not?**
Because an ambient declaration has no initialiser, so the evaluator's only remaining source of a value is the declared type, and it reduces a type to a value only when the type has exactly one inhabitant. `'app-x'` is a literal type with one inhabitant, so `visitType` returns the string. `string` has infinitely many, so `visitType` returns a `DynamicValue`, the branch is skipped, and the function falls through to returning a `Reference` — which surfaces as `Value is a reference to 'SEL'.` Same declaration, same file, same usage; only the width of the type differs, and width is exactly what decides foldability.

**The source comment on the ambient branch calls the `Reference` return "historical behavior" and has a TODO to change it. What would change for you if they did?**
The failure mode, not the outcome. Today a wide ambient declaration produces a `Reference`, so you see `Value is a reference to 'SEL'.` with a *"Reference is declared here"* note. If it became a `DynamicValue` you would see `Value could not be determined statically.` with a trace instead. Both are errors and both reject the same code; the second is arguably more accurate, since the value genuinely cannot be determined. The comment is worth knowing because it tells you the current message is an artefact of the order features were added — `visitType` came later — rather than a considered piece of diagnostics design.

**Why is a wide ambient declaration a `Reference` rather than simply "unsupported"?**
Because a `Reference` is genuinely useful in the many places metadata needs a *symbol* rather than a value — a class in `imports`, a provider token, a directive type. The evaluator has one return type for every field, so it returns the most informative thing it can and lets each field's own checker decide whether that thing is acceptable. `imports` is happy with a `Reference`; `selector` is not. That single design choice is why the same declaration can be perfectly legal in one key of the same object literal and an error in the next.

**Your build injects `APP_VERSION` as a global. Where can you use it and where can you not?**
Anywhere at runtime — a template binding, a class field, a service — because at runtime it is a real global and TypeScript only needed the type. Nowhere in decorator metadata, unless its ambient declaration gives it a literal type, because metadata is read at build time and the evaluator has nothing but the type to go on. If you need it in metadata, the build tool has to emit `declare const APP_VERSION: '4.2.0';` rather than `: string`, which means regenerating the declaration file per build. That is the whole trade, and it is worth knowing before you design the injection.

---

← Prev: [10d · Import cycles and local mode](10d-import-cycles-and-local-compilation.md) · Index: [Topic index](README.md) · Next → [Destructuring in metadata](10f-destructuring-in-metadata.md)
