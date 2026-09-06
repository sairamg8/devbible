---
title: "Every metadata error the compiler raises is the same two-part object — a headline naming the field it could not use, and a chained sentence naming what it got instead — and the trace underneath has exactly ten possible breadcrumbs, one per cause"
sidebar_label: "10 · Metadata errors, one by one"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/annotations/common/src/diagnostics.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/common/src/diagnostics.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/diagnostics.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/diagnostics.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error.ts),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/util.ts);
> and angular.dev [Angular error encyclopedia](https://angular.dev/errors).
> Documentation-validated; **no sandbox run** — no build was executed and no terminal output was captured. Every message on this page is a string literal read from a named source file or quoted from angular.dev.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Chunk 09 argued why your `@Component` argument has to be statically analysable. This chunk and its siblings are the other half: the catalogue you open at 2am when the build is red and the message is one you have never seen. It exists because Angular's metadata errors are unusually *readable* once you know their shape — and completely opaque until you do. Every one of them is assembled by the same handful of functions, in the same order: a headline naming the field, a chained sentence naming what the evaluator got instead of a value, and a related-information trace whose entries come from a closed set of exactly ten strings. Learn those ten and the rest of the catalogue stops being something you read and becomes an index you look things up in. This page is the decoder; [10b](10b-the-decorator-argument-itself.md) through [10f](10f-destructuring-in-metadata.md) are the entries.**

🔴 **This catalogue is incomplete, deliberately and visibly. Read this before you conclude an error is not in it.** Six pages exist — the decoder, and five families of cause. **Two planned families have not been written yet**, and their errors are therefore *absent, not excluded*:

- **10g · Calls, enums and the values in between** *(not written yet)* — the single-return-statement rule for helper functions and `Unable to evaluate function call of complex function. A function must have exactly one return statement.`; `Unable to evaluate an invalid expression.`; `A string value could not be determined statically.`; enum members and `encapsulation must be a member of ViewEncapsulation enum from @angular/core`; enum members whose computed names are silently dropped rather than reported.
- **10h · Syntax the evaluator cannot read** *(not written yet)* — everything that prints `This syntax is not supported.`: `new`, tagged template literals, `??` (absent from the operator table while `||` is present), function and arrow expressions in an evaluated position, spread at expression position, `typeof`, `await`, `delete`, `void`, class expressions — plus the View Engine rules on angular.dev that no longer describe this compiler.
- **The NG2xxx field-shape family is also unwritten** — `@Component is missing a template. Add either a template or templateUrl`, `templateUrl must be a string`, `template must be a string`, the resource-not-found and duplicate-`styleUrl`/`styleUrls` errors, `selector must be a string` and the missing-selector error, the `'imports' must be an array of components, directives, pipes, or NgModules.` family including the `Module.forRoot()` message, the standalone-shape errors, `NG2003: Missing Token`, and the completeness table of NG1xxx / NG2xxx / NG5xxx codes.

If your message is in one of those three lists, the mechanism behind it is still on this page — it is the same decoder — but the worked entry is not written. If it is in neither, work the decoder below.

## The shape: a headline, a chain sentence, and a trace

`packages/compiler-cli/src/ngtsc/annotations/common/src/diagnostics.ts` builds the second sentence of nearly every metadata error. `createValueHasWrongTypeError`, verbatim:

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

The headline comes from the call site — `selector must be a string`, `templateUrl must be a string`, `encapsulation must be a member of ViewEncapsulation enum from @angular/core`. The chain sentence comes from the block above. So the shape you actually see in a terminal is three layers stacked:

1. **the headline** — *which field* the compiler could not use, and what it wanted
2. **the chain sentence** — *what it got instead*, one of exactly three possibilities
3. **the trace** — *where it gave up*, one of exactly ten strings, pointing at a specific node

🔴 **Read them bottom-up, not top-down.** The headline restates the line the squiggle is already on. The trace carries the cause, and it is the only part that is new information.

## The three chain sentences, and what each one means

There are three, and they partition the failure space cleanly. Nothing else can appear in that slot.

| Chain sentence | What the evaluator produced | What it means you did |
|---|---|---|
| `Value could not be determined statically.` | a `DynamicValue` | you wrote an expression the evaluator can parse but cannot fold — the trace names why |
| `Value is a reference to 'SEL'.` | a `Reference` | the symbol resolved to a *declaration*, not a value — usually an ambient `declare`, a class, or an un-inlinable import |
| `Value is of type 'undefined'.` | a real, folded JavaScript value of the wrong type | the evaluator succeeded and got something — it is just not a string / array / enum member |

That third row is the one people misread. `Value is of type 'undefined'.` is **not** a failure of static analysis. The evaluator ran, resolved your identifier, and got the value `undefined` — because that is genuinely what `export let SELECTOR;` holds. Full walk-through in [10e](10e-values-that-resolve-but-do-not-fold.md).

`describeResolvedType` renders three cases that look strange out of context: a `DynamicValue` prints as the literal string `(not statically analyzable)`, a resolved module prints as `(module)`, and a known built-in function prints as `Function`. So `Value is of type '(module)'.` means you passed a namespace import where a value was wanted.

## The trace: ten breadcrumbs, not nine

`packages/compiler-cli/src/ngtsc/partial_evaluator/src/diagnostics.ts` defines `TraceDynamicValueVisitor`, and its methods emit the related-information notes that appear under the error. These strings map a message to a cause. Verbatim:

| visitor method | message |
|---|---|
| `visitDynamicInput` | `Unable to evaluate this expression statically.` |
| `visitSyntheticInput` | `Unable to evaluate this expression further.` |
| `visitDynamicString` | `A string value could not be determined statically.` |
| `visitExternalReference` | `A value for 'NAME' cannot be determined statically, as it is an external declaration.` (or `an anonymous declaration`) |
| `visitComplexFunctionCall` | `Unable to evaluate function call of complex function. A function must have exactly one return statement.` plus `Function is declared here.` |
| `visitInvalidExpressionType` | `Unable to evaluate an invalid expression.` |
| `visitUnknown` | `Unable to evaluate statically.` |
| `visitUnknownIdentifier` | `Unknown reference.` |
| `visitDynamicType` | `Dynamic type.` |
| `visitUnsupportedSyntax` | `This syntax is not supported.` |

⚠️ **A counting correction, stated openly.** The banked research this topic was written from introduces that table with the words *"These nine strings"*. The table it then quotes has **ten** rows. Ten is right, and there is an independent check available without re-reading the source: `partial_evaluator/src/dynamic.ts` declares exactly ten `DynamicValue` reasons — `DYNAMIC_INPUT`, `SYNTHETIC_INPUT`, `DYNAMIC_STRING`, `EXTERNAL_REFERENCE`, `COMPLEX_FUNCTION_CALL`, `INVALID_EXPRESSION_TYPE`, `UNKNOWN`, `UNKNOWN_IDENTIFIER`, `DYNAMIC_TYPE`, `UNSUPPORTED_SYNTAX` — and each visitor above corresponds to exactly one of them, one-to-one, with none left over on either side. Ten reasons, ten visitors, ten strings. The prose count was a slip; the quoted table was not. **Where a count and a quoted list disagree, the quoted list wins and the disagreement gets named on the page.**

(If you count *messages* rather than *visitors* the answer is eleven, because `visitComplexFunctionCall` emits a second note — `Function is declared here.` — pointing at the offending function. That is a different number for a different question, which is exactly why the count is worth stating precisely rather than approximately.)

### The reason → cause map

`dynamic.ts` documents each reason, and these doc comments are the most compressed statement of the whole failure model that exists anywhere:

| reason | doc comment, verbatim |
|---|---|
| `DYNAMIC_INPUT` | *"A value could not be determined statically, because it contains a term that could not be determined statically. (E.g. a property assignment or call expression where the lhs is a `DynamicValue`, a template literal with a dynamic expression, an object literal with a spread assignment which could not be determined statically, etc.)"* |
| `DYNAMIC_STRING` | *"A string could not be statically evaluated. (E.g. a dynamically constructed object property name or a template literal expression that could not be statically resolved to a primitive value.)"* |
| `EXTERNAL_REFERENCE` | *"An external reference could not be resolved to a value which can be evaluated. For example a call expression for a function declared in `.d.ts`, or accessing native globals such as `window`."* |
| `UNSUPPORTED_SYNTAX` | *"Syntax that `StaticInterpreter` doesn't know how to evaluate, for example a type of `ts.Expression` that is not supported."* |
| `UNKNOWN_IDENTIFIER` | *"A declaration of a `ts.Identifier` could not be found."* |
| `INVALID_EXPRESSION_TYPE` | *"A value could be resolved, but is not an acceptable type for the operation being performed. For example, attempting to call a non-callable expression."* |
| `COMPLEX_FUNCTION_CALL` | *"A function call could not be evaluated as the function's body is not a single return statement."* |
| `DYNAMIC_TYPE` | *"A value that could not be determined because it contains type information that cannot be statically evaluated… E.g. evaluating a tuple. `declare const foo: [string];` Evaluating `foo` gives a DynamicValue wrapped in an array with a reason of DYNAMIC_TYPE."* |
| `SYNTHETIC_INPUT` | *"A value could not be determined because one of the inputs to its evaluation is a synthetically produced value."* |
| `UNKNOWN` | *"A value could not be determined statically for any reason other the above."* |

🔴 **`UNKNOWN` — `Unable to evaluate statically.` — is the residual bucket, and it is the least informative message the compiler can give you.** If you get it, the trace has told you almost nothing. Its largest single producer in practice is a destructuring pattern with no resolvable initializer ([10e](10e-values-that-resolve-but-do-not-fold.md)).

## Why a long chain collapses to one trace entry

A failure five identifiers deep does not produce five breadcrumbs. That is deliberate. Same file, verbatim:

```ts
/**
 * Determines the closest parent node that is to be considered as container, which is used to reduce
 * the granularity of tracing the dynamic values to a single entry per container. Currently, full
 * statements and destructuring patterns are considered as container.
 */
```

**One entry per statement, one entry per destructuring pattern.** So the trace points at the *statement* that failed, not the sub-expression. The practical consequence: if one statement contains two things that could not fold, you will be shown one, fix it, rebuild, and be shown the other. That is not the compiler being coy — it is the de-duplication above working as designed. Split a compound metadata constant into several statements and the trace gets sharper immediately.

## Which numbers in this catalogue are confirmed, and which are not

Error *names* across these six pages are verbatim from `ErrorCode` in `packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`, or verbatim from a `throw new FatalDiagnosticError(ErrorCode.X, …)` call site. Error *numbers* have two different provenances, and a catalogue that blurs them is worse than one that admits the difference.

- **Plain `NG2010`** — the number was read from the `error_code.ts` enum together with its doc comment, or is stated inside the doc comment itself (`LOCAL_COMPILATION_UNRESOLVED_CONST = 11001`).
- **`NG2010†`** — 🔴 **the enum name is verbatim from source, the number is not.** It comes from surrounding research prose rather than from a line of `error_code.ts` that assigns it. It is very probably right. **Match on the message text, not the number**, and if you need the number for a lint suppression or a CI filter, read `error_code.ts` at your own version first.

The dagger appears on every page in this catalogue and its definition is repeated on each, so a page opened cold still carries it.

There is a second and better way to check a number yourself. **If the error in your terminal ends with a `Find more at https://v22.angular.dev/errors/NGxxxx` line, the number is real and the page exists.** `addDiagnosticDetails` in `diagnostics/src/util.ts` appends that suffix only for codes Angular declares with a *negative* enum value, and only ten compiler codes are declared that way — the same ten the encyclopedia lists. No link means no documentation page, not that you misread the number. The encoding behind it is **13 · Where the compiler runs: `ngtsc`** *(not written yet)*.

## What the rest of the catalogue covers

The five sibling pages are grouped by **cause**, because the cause is what determines the fix. The message you are holding tells you which page to open.

| page | the failures it catalogues | the tell |
|---|---|---|
| [10b · The decorator argument itself](10b-the-decorator-argument-itself.md) | `Decorator argument must be literal.`, `@Component argument must be an object literal`, `@ViewChild options must be an object literal`, `Incorrect number of arguments to @Component decorator` | **no trace at all** under the message |
| [10c · Symbols it cannot resolve](10c-symbols-the-compiler-cannot-resolve.md) | `Unknown reference.`, `… as it is an external declaration.`, `Unable to import class Foo.`, `Unsupported private class Foo.`, the input-transform export rule | the trace names a *symbol* |
| [10d · Import cycles and local mode](10d-import-cycles-and-local-compilation.md) | NG3003 and remote scoping; local-compilation NG11001 / NG11003 | the error is about a **file**, not a value |
| [10e · Values that do not fold](10e-values-that-resolve-but-do-not-fold.md) | `export let`, ambient `declare const`, literal vs wide types, tuples and `Dynamic type.` | the trace names a *value* |
| [10f · Destructuring in metadata](10f-destructuring-in-metadata.md) | the three destructuring forms that fail, all printing `Unable to evaluate statically.` | a binding pattern in the span |
| **10g · Calls, enums and the values in between** *(not written yet)* | complex function calls, invalid expression types, dynamic strings, enum members | — |
| **10h · Syntax the evaluator cannot read** *(not written yet)* | everything printing `This syntax is not supported.` | — |
| **The NG2xxx field-shape family** *(not written yet)* | templates, styles, selectors, `imports`, standalone, `NG2003: Missing Token` | **no trace**, and the headline names a field |

## Gotchas

**★ Symptom: you fix the thing the trace pointed at, rebuild, and get the same error pointing somewhere else in the same statement.** Cause: the trace de-duplicates to *one entry per statement* — `TraceDynamicValueVisitor`'s container rule, quoted above — so a statement with two unfoldable sub-expressions surfaces them one at a time. Fix: stop treating it as a loop and split the statement, which makes the container boundaries finer and the trace complete:

```ts
import {ViewEncapsulation} from '@angular/core';

// ⛔ one statement, one trace entry, two problems hiding inside it.
// export const CARD_CONFIG = {
//   selector: readSelectorFromEnv(),
//   encapsulation: pickEncapsulation(),
// };

// ✅ three statements, three independent trace entries — both problems reported at once.
export const CARD_SELECTOR = 'app-user-card';
export const CARD_ENCAPSULATION = ViewEncapsulation.Emulated;
export const CARD_CONFIG = {
  selector: CARD_SELECTOR,
  encapsulation: CARD_ENCAPSULATION,
};
```

**★ Symptom: `Value is of type 'undefined'.` and you go hunting for a static-analysis failure.** Cause: that sentence is the *success* branch — the evaluator resolved your identifier and the answer was genuinely `undefined`. Only `Value could not be determined statically.` means the analysis gave up. Fix: initialise the constant rather than trying to make it "more static"; see [10e](10e-values-that-resolve-but-do-not-fold.md).

**★ Symptom: the error has no trace under it at all.** Cause: it was thrown before the partial evaluator ran — an arity gate, an object-literal gate, or a plain field-shape check. There is nothing to trace because nothing was evaluated. Fix: read the headline literally; it is a syntactic complaint about the decorator call or the field, not about a value inside it. The decorator-call half lives in [10b](10b-the-decorator-argument-itself.md); the field-shape half is the **NG2xxx family** *(not written yet)*.

**Symptom: you copy an NG number out of a blog post into a CI suppression list and it never matches.** Cause: Angular's error numbers are only as stable as the enum, and the *documented* set is exactly ten codes — everything else is an internal number no page describes. Fix: filter on the message text or on the enum name, and if you must use a number, read it out of `error_code.ts` at the version you actually build with. The daggered numbers in this catalogue have not been confirmed against that file.

**Symptom: `Value is of type '(module)'.`** Cause: you passed a namespace import where a value was wanted — `import * as config from './card-config'` and then `selector: config`. `describeResolvedType` renders a resolved module as the literal string `(module)`. Fix: reach into it or import the binding directly:

```ts
// ⛔ selector: config          →  Value is of type '(module)'.
// import * as config from './card-config';

// ✅ either of these folds to a string.
import {CARD_SELECTOR} from './card-config';
import * as cardConfig from './card-config';

export const SELECTOR_A = CARD_SELECTOR;
export const SELECTOR_B = cardConfig.CARD_SELECTOR;
```

**Symptom: an error message you cannot find on angular.dev, and you assume you misread it.** Cause: most compiler error codes have no documentation page. Only negatively-declared codes get a `Find more at …` suffix, and there are ten of them. Fix: treat the absence of that line as information — it tells you the message text *is* the documentation, and the message texts in this catalogue are the compiler's own string literals.

**Symptom: a tool wrapping `ng build` prints an empty error, or your own `catch` block logs nothing useful.** Cause: `FatalDiagnosticError` deliberately hides its `.message`. Verbatim from `diagnostics/src/error.ts`: *"Trying to hide `.message` from `Error` to encourage users to look at `diagnosticMessage` instead."* Anything that catches the error and prints `err.message` prints nothing. Fix: read the compiler's own formatted output, not a wrapper's re-print of the exception.

**Symptom: the `Find more at` link in your terminal opens a docs page describing behaviour you do not have.** Cause: nothing is wrong — the link is *version-pinned* to the major you built with (`https://v22.angular.dev/errors/…`), while a link you reach by searching lands on the current major. Fix: this is the correct behaviour and the pinned link is the more trustworthy of the two; prefer it when the two disagree.

## Interview questions

**★ An Angular metadata error has three parts. Name them, and say which one you should read first.**
A headline naming the field the compiler could not use and what it wanted there (`selector must be a string`), a chained sentence naming what the evaluator produced instead — one of exactly three: `Value could not be determined statically.`, `Value is a reference to 'X'.`, or `Value is of type 'T'.` — and a related-information trace pointing at the node where evaluation gave up. Read the trace first. The headline restates the line you are already looking at; the chain sentence tells you which of three worlds you are in; only the trace carries a new fact. The ordering matters because the three chain sentences correspond to three completely different remedies: an unfoldable expression, a declaration used where a value was needed, and a perfectly good value of the wrong type.

**★ What is the difference between `Value could not be determined statically.` and `Value is of type 'undefined'.`?**
The first means the partial evaluator returned a `DynamicValue` — it could not compute an answer, and a trace will follow. The second means it *did* compute an answer and the answer was the JavaScript value `undefined`, which is not a string, so the field's own type check rejected it. The distinction is the difference between "the compiler cannot see your code" and "the compiler saw your code and your code is wrong". The classic producer of the second is an uninitialised `export let`, which the evaluator resolves successfully to `undefined` rather than failing on.

**Why does a deeply nested metadata failure only produce one trace entry?**
Because `TraceDynamicValueVisitor` deliberately reduces granularity to one entry per *container*, where a container is a full statement or a destructuring pattern. The intent is that a chain of ten property accesses inside one constant should not print ten breadcrumbs. The cost is that two independent failures inside one statement get reported serially, one build at a time, which reads like the compiler moving the goalposts. Splitting the constant into separate statements is the fix — and it is a fix to the *diagnostics*, not to the code's correctness.

**How can you tell from a terminal whether an Angular error code has a documentation page, without searching for it?**
If the message ends with `Find more at https://v22.angular.dev/errors/NGxxxx`, it has one. That suffix is appended by `addDiagnosticDetails`, which only runs for codes Angular declares with a negative enum value, and only ten compiler codes are declared that way — the same ten the encyclopedia lists. It is also why the link is pinned to the major you built with rather than pointing at the current docs.

**Why is it worth knowing that there are exactly ten `DynamicValue` reasons?**
Because it turns an open-ended debugging problem into a closed one. Any metadata failure that produces a trace produces one of ten strings, each of which names a distinct mechanism — an unresolvable identifier, an external declaration, an unsupported syntax node, a multi-statement function, a type-only value, and so on. Once you know the set is closed, the diagnostic question stops being "what could possibly be wrong" and becomes "which of these ten am I looking at", which each of the sibling pages then answers with a fix. It is also a check on your own reading: if you think you have found an eleventh, you have almost certainly misread a related-information note for a trace entry.

**A colleague says "Angular metadata errors are useless, they just say it could not be determined statically". What are they missing?**
That the sentence they are quoting is layer two of three, and layer three is where the information is. `Value could not be determined statically.` is the same for every `DynamicValue`, by construction — it is the chain sentence, not the diagnosis. Underneath it is a related-information note naming which of the ten reasons applied and pointing at a node. Editors often collapse related information into a hover or a separate panel, so a reader who only ever sees the top two lines genuinely does get a useless message. The fix is a tooling habit, not a compiler complaint: read the full diagnostic, including its related information.

---

← Prev: **09 · Static analysability** *(not written yet)* · Index: [Topic index](README.md) · Next → [The decorator argument itself](10b-the-decorator-argument-itself.md)
