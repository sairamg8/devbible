---
title: "A metadata error is always two sentences and the second one is the diagnosis — `Value could not be determined statically` and `Value is of type 'number'` are opposite failures reported by the same code, and once you can name the ten `DynamicValue` reasons you can predict any `@Component` argument without building"
sidebar_label: "09g · Reading a metadata failure"
sidebar_position: 9.6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/common/src/diagnostics.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/common/src/diagnostics.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts).
> Documentation-validated; **no sandbox run** — every quoted string below is read from a named source file, not from a build.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**When the partial evaluator cannot produce a value it does not produce nothing — it produces a `DynamicValue` carrying a *reason*, and that reason is the difference between "your helper has two statements", "that constant only exists as a type declaration" and "you used syntax the interpreter has no case for". The error you see is assembled from it as a chain: a field-specific first sentence, a generic second sentence naming which kind of failure occurred, and a trail of related-information notes. Almost everyone reads the first sentence and stops, which is why metadata errors have a reputation for being opaque. They are not opaque; they are terse and layered. This page is the vocabulary, and then the procedure for predicting an outcome before you build.**

## The ten reasons

`partial_evaluator/src/dynamic.ts` — every reason a value can fail to resolve, with its own doc comment, verbatim at `v22.1.5`:

| Reason | What it means, in the source's own words |
|---|---|
| `DYNAMIC_INPUT` | *"A value could not be determined statically, because it contains a term that could not be determined statically. (E.g. a property assignment or call expression where the lhs is a `DynamicValue`, a template literal with a dynamic expression, an object literal with a spread assignment which could not be determined statically, etc.)"* |
| `DYNAMIC_STRING` | *"A string could not be statically evaluated. (E.g. a dynamically constructed object property name or a template literal expression that could not be statically resolved to a primitive value.)"* |
| `EXTERNAL_REFERENCE` | *"An external reference could not be resolved to a value which can be evaluated. For example a call expression for a function declared in `.d.ts`, or accessing native globals such as `window`."* |
| `UNSUPPORTED_SYNTAX` | *"Syntax that `StaticInterpreter` doesn't know how to evaluate, for example a type of `ts.Expression` that is not supported."* |
| `UNKNOWN_IDENTIFIER` | *"A declaration of a `ts.Identifier` could not be found."* |
| `INVALID_EXPRESSION_TYPE` | *"A value could be resolved, but is not an acceptable type for the operation being performed. For example, attempting to call a non-callable expression."* |
| `COMPLEX_FUNCTION_CALL` | *"A function call could not be evaluated as the function's body is not a single return statement."* |
| `DYNAMIC_TYPE` | *"A value that could not be determined because it contains type information that cannot be statically evaluated… E.g. evaluating a tuple. `declare const foo: [string];` Evaluating `foo` gives a DynamicValue wrapped in an array with a reason of DYNAMIC_TYPE. This is because the static evaluator has a `string` type for the first element of this tuple, and the value of that string cannot be determined statically."* |
| `SYNTHETIC_INPUT` | *"A value could not be determined because one of the inputs to its evaluation is a synthetically produced value."* |
| `UNKNOWN` | *"A value could not be determined statically for any reason other the above."* |

Three of those map onto rules established earlier in this chunk, and recognising them is most of the diagnostic work:

- **`UNSUPPORTED_SYNTAX`** — you used a node kind not in `visitExpression`'s dispatch ([09c](09c-the-partial-evaluator-is-the-grammar.md)). `??`, `new`, a tagged template.
- **`COMPLEX_FUNCTION_CALL`** — your macro helper has more than one statement ([09d](09d-the-single-return-function-rule.md)).
- **`EXTERNAL_REFERENCE`** — the declaration exists but has no initializer the compiler can see, typically a `declare const` in a `.d.ts` or a browser global.

`DYNAMIC_INPUT` is the one that will not point at a cause on its own, by design: it means *something nested* failed, and the actual reason is the `DynamicValue` it wraps. That nesting is created by the last three lines of `visitExpression` — `if (result instanceof DynamicValue && result.node !== node) return DynamicValue.fromDynamicInput(node, result);` — and it is what makes the related-information notes a chain rather than a single point.

## Why the error is always two sentences

`annotations/common/src/diagnostics.ts`, `createValueHasWrongTypeError`, verbatim:

```ts
if (value instanceof DynamicValue) {
  chainedMessage = 'Value could not be determined statically.';
  relatedInformation = traceDynamicValue(node, value);
} else if (value instanceof Reference) {
  const target = value.debugName !== null ? `'${value.debugName}'` : 'an anonymous declaration';
  chainedMessage = `Value is a reference to ${target}.`;

  const referenceNode = identifierOfNode(value.node) ?? value.node;
  relatedInformation = [makeRelatedInformation(referenceNode, 'Reference is declared here.')];
} else {
  chainedMessage = `Value is of type '${describeResolvedType(value)}'.`;
}
```

**The first sentence is the field's complaint** — `selector must be a string`, `'imports' must be an array of components, directives, pipes, or NgModules.` **The second sentence is the diagnosis**, and there are exactly three of them:

| Second sentence | What actually happened | Where to look |
|---|---|---|
| `Value could not be determined statically.` | evaluation failed; a `DynamicValue` came back | the related-information notes — they trace to the sub-expression that failed |
| `Value is a reference to 'X'.` | evaluation *succeeded* and produced a class reference where a value was wanted | the note `Reference is declared here.` names the class you passed by mistake |
| `Value is of type 'number'.` | evaluation succeeded and produced the wrong kind of value | your own constants — this is a plain bug, not an analysability problem |

That taxonomy is worth internalising because the first and third demand opposite responses. The first means *simplify the expression until it folds*. The third means *the expression folded perfectly; you pointed at the wrong thing.* Reacting to a type mismatch by inlining literals — the reflex the folk rules teach — wastes the afternoon.

`describeResolvedType` renders the unresolvable cases with their own literal strings: a `DynamicValue` becomes `(not statically analyzable)`, a resolved module namespace becomes `(module)`, and a known callable becomes `Function`. So a nested failure inside an otherwise-resolved structure surfaces as, for example, an array type with `(not statically analyzable)` in one position — which tells you the *shape* was fine and one element was not.

## The prediction procedure

The phase gate for this topic asks you to *"explain why a given `@Component` argument would or would not compile"*. Here is that as a procedure. Run it top to bottom; the first `no` is your answer.

1. **Is the decorator argument, after stripping parentheses, `as` and `!`, an object literal?** If not, NG1001 — and no evaluation happens at all ([09](09-static-analysability-is-the-load-bearing-constraint.md)).
2. **Is the field one the compiler evaluates?** If it is not in the table in [09b](09b-gate-two-what-is-evaluated-and-what-is-relayed.md) — `providers`, `viewProviders`, `animations` — stop. It is relayed verbatim and nothing below applies.
3. **Is every node kind in the expression in `visitExpression`'s dispatch?** `new`, tagged templates, `typeof`, `await`, inline functions as values: `UNSUPPORTED_SYNTAX` ([09c](09c-the-partial-evaluator-is-the-grammar.md)).
4. **Is every operator in `BINARY_OPERATORS` or the unary map?** `??` is the one that catches people.
5. **Does every identifier lead to a declaration with a visible initializer, inside this compilation?** A `.d.ts` declaration or a browser global gives `EXTERNAL_REFERENCE`; local compilation mode narrows "this compilation" further ([09e](09e-selector-must-reduce-to-a-string.md)).
6. **Does every call reach a function whose body is exactly one `return`?** Otherwise `COMPLEX_FUNCTION_CALL`, or `UNKNOWN` when there is no body at all ([09d](09d-the-single-return-function-rule.md)).
7. **Does the resulting value have the type the field demands?** A string for `selector`, an array of declarable references for `imports`. This is the last check, and failing it produces the `Value is of type '…'` branch rather than a static-analysis complaint.

Worked against a handful of arguments:

| Expression in an evaluated field | Verdict |
|---|---|
| `selector: SELECTORS.dashboard` (local `const` object) | ✅ steps 1–7 all pass |
| `selector: SELECTORS.dashboard ?? 'acme-x'` | ⛔ step 4 — `UNSUPPORTED_SYNTAX` |
| `imports: [SHARED, InvoiceRow]` (`SHARED` a local array) | ✅ compiles; flattened. ⚠️ disables `@defer` splitting ([09f](09f-imports-and-the-rule-about-lazy-loading.md)) |
| `templateUrl: paths.invoice()` — helper with a local `const` and a return | ⛔ step 6 — `COMPLEX_FUNCTION_CALL` |
| `changeDetection: STRATEGY` where `STRATEGY` is `declare const` in a `.d.ts` | ⛔ step 5 — `EXTERNAL_REFERENCE` |
| `providers: buildEverything(window.location.href)` | ✅ step 2 stops the walk — never evaluated |
| `selector: PORT_NUMBER` | ⛔ step 7 — `Value is of type 'number'.` |

## What the whole constraint buys

It is worth being explicit about the trade, because "the ceremony is the price" only lands if you can name what was bought:

- **Template errors at build time.** The compiler can only type-check a template against a known set of dependencies, and it can only know that set because `imports` folds to a list of classes. Without static metadata there is no dependency scope, and without a scope there is no `strictTemplates`.
- **A dependency graph precise enough to lazy-load from.** `@defer` splits a chunk that no bundler could find, because the compiler resolved which classes a template block uses and rewrote the import declarations that brought them in ([11](11-why-defer-can-split-a-bundle.md)).
- **Tree-shakable definitions.** A definition object built from folded constants has no unreachable branches for a bundler to guess at ([06](06-what-the-compiler-emits.md)).
- **Libraries that compile once and work across versions.** A `.d.ts` type declaration can carry a component's entire published metadata only because that metadata was a value at build time ([06d](06d-the-factory-and-the-d-ts-declaration.md)).

Every one of those is downstream of the same sentence: **the compiler resolved your metadata without executing your program.** The object literal, the exported constant, the single-return helper — that is the invoice.

## Gotchas

**★ Symptom: the error says `selector must be a string` and you spend an hour making the selector "more static", when the constant was a number all along.** Cause: you read the first sentence only. The second sentence distinguishes `Value could not be determined statically.` (analysability) from `Value is of type 'number'.` (a plain bug). Fix: read the chain, then fix the constant:

```ts
// ⛔ folds perfectly; wrong type
export const INVOICE_TABLE = 42;

// ✅
export const INVOICE_TABLE_SELECTOR = 'acme-invoice-table';
```

**★ Symptom: `Value is a reference to 'InvoiceRow'.`** Cause: the evaluator resolved the expression to a *class* where the field wanted a value — the classic case is pasting a component class into a field like `selector` or `exportAs`. Fix: the related note `Reference is declared here.` names the class; pass the value the field asked for instead:

```ts
import {Component} from '@angular/core';
import {InvoiceRow} from './invoice-row';

@Component({
  selector: 'acme-invoice-table', // a string, not the class
  imports: [InvoiceRow],          // the class belongs here
  template: '<invoice-row />',
})
export class InvoiceTable {}
```

**★ Symptom: a type description in the error contains `(not statically analyzable)` in the middle of an otherwise sensible shape.** Cause: `describeResolvedType` renders a nested `DynamicValue` with that literal string, so the structure resolved and one element inside it did not. Fix: treat the position as the address of the bug — the element at that slot is the one to simplify:

```ts
// ⛔ the array resolves; the second element does not
export const AMBIENT_STYLE: string = (globalThis as {STYLE?: string}).STYLE!;

// ✅ every element is a folded literal
export const PANEL_STYLES = ['.panel{padding:8px}', '.panel h2{margin:0}'];
```

**Symptom: the error mentions `(module)`.** Cause: a namespace import was used as a value — `import * as selectors from './selectors'` and then `selector: selectors`. The evaluator resolves the namespace to a `ResolvedModule`, which `describeResolvedType` renders as `(module)`. Fix: reach through it to the member you meant:

```ts
import {Component} from '@angular/core';
import * as selectors from './selectors';

@Component({
  selector: selectors.INVOICE_TABLE_SELECTOR,
  template: '<h2>Invoices</h2>',
})
export class InvoiceTable {}
```

**Symptom: the related-information note points at a whole statement rather than at the sub-expression that failed.** Cause: the trace is deliberately reduced to one entry per container — a full statement or a destructuring pattern — so long chains collapse instead of producing a note per level. Fix: split the statement so the container boundary lands where you need the precision:

```ts
// ⛔ one statement, one trace entry, several candidate causes
export const META = {selector: buildSelector(), template: readTemplate()};

// ✅ separate statements, separate trace entries
export const PANEL_SELECTOR = buildSelector();
export const PANEL_TEMPLATE = readTemplate();
```

**Symptom: `INVALID_EXPRESSION_TYPE` on something that looks like a normal call.** Cause: the evaluator resolved the callee to something that is not callable — a constant shadowing a function name, a namespace, an interface-only import. Fix: check what the identifier actually resolves to, not what you assume it is; the fix is nearly always an import that points at the wrong symbol:

```ts
// selectors.ts
export function prefixed(name: string): string {
  return `acme-${name}`;
}
```

The per-error catalogue — non-exported symbols, uninitialised `export let`, destructuring, ambient types, computed enum members, tagged templates, each as symptom → cause → fix — is **10 · Metadata errors, one by one** *(not written yet)*. This page is the vocabulary those entries are written in.

## Interview questions

**★ What does `Value could not be determined statically.` actually mean, and what do you look at next?**
It means the partial evaluator returned a `DynamicValue` rather than a value, so the field's type check never got a real thing to check. It is deliberately generic: the *specific* reason is carried on the `DynamicValue` and surfaced through the related-information notes that `traceDynamicValue` produces, one per container statement. So the next thing to look at is the notes, not the headline — they walk you inward through the nesting created by `fromDynamicInput` until they reach the node that actually failed. If you only read the first line you are reading the field's complaint, which is the same for every cause.

**★ Walk me through predicting whether an arbitrary `@Component` argument will compile.**
Seven checks, in order, first failure wins. Is the argument an object literal after unwrapping parentheses, `as` and `!` — if not, NG1001, and nothing is evaluated. Is the field one the compiler evaluates at all — if it is `providers` or another relayed field, it is emitted verbatim and unconstrained. Is every node kind in `visitExpression`'s dispatch. Is every operator in `BINARY_OPERATORS` or the unary map. Does every identifier reach a declaration with a visible initializer inside this compilation. Does every call reach a function body that is exactly one `return`. And finally, does the resulting value have the type the field demands. That last one is a different class of failure from the six above it, and reports differently.

**★ What is the difference between a `DynamicValue` and a `Reference` in an error message, and why does it matter?**
A `DynamicValue` means the evaluator could not produce a value; a `Reference` means it produced one, and the value is a pointer to a declaration — usually a class. They come out of the same `createValueHasWrongTypeError` and read almost identically at a glance, but they call for opposite responses. A `DynamicValue` means simplify: collapse the helper, inline the constant, drop the unsupported operator. A `Reference` means you passed the right kind of thing to the wrong field — the analysis worked perfectly and told you exactly what you wrote, with a `Reference is declared here.` note naming it.

**Why is `DYNAMIC_INPUT` a separate reason from the specific ones, when it never tells you what went wrong?**
Because it is the propagation marker, not a cause. When a sub-expression fails, `visitExpression` re-wraps the result as `fromDynamicInput` at each level on the way out, so the outermost `DynamicValue` is attributed to the expression the field actually points at while still carrying the original failure inside it. Without that wrapping the diagnostic would either be attached to a node deep inside a helper function in another file, or would lose the trail entirely. `DYNAMIC_INPUT` is what makes the notes a chain you can walk.

**★ Name what Angular gets in exchange for all of this.**
Four things, all of which need metadata that is a value at build time. Build-time template type checking, because the compiler can only check a template against a dependency scope it resolved. A dependency graph precise enough for `@defer` to split a chunk that no bundler could have found, because the compiler knows which classes a template block uses and can rewrite the import declarations. Definition objects with no unresolved branches, so a bundler can tree-shake them. And `.d.ts` type declarations carrying a component's full published metadata, which is what lets a library compile once and be consumed by applications on other versions. Take away static analysability and all four go with it — that is why the constraint is not negotiable and why the ceremony is the price.

**`DYNAMIC_TYPE` is the strangest reason in the list. What is it telling you?**
That the evaluator found *type* information where it needed a value, and produced a shaped placeholder rather than a flat failure. The source's own example is `declare const foo: [string];` — evaluating `foo` yields a `DynamicValue` wrapped in an array, because the interpreter can see the tuple has one element of type `string` but cannot know which string. That is a genuinely useful distinction: the *shape* is known and the *contents* are not, so a field that only cares about the shape may still get somewhere, and one that needs the value gets a failure whose reason names types rather than syntax.

---

← Prev: [09f · imports and lazy loading](09f-imports-and-the-rule-about-lazy-loading.md) · Index: [Topic index](README.md) · Next → **10 · Metadata errors, one by one** *(not written yet)*
