---
title: "A call in metadata has seven possible outcomes and only two of them are success — so `Unable to evaluate function call of complex function.` and `Unable to evaluate an invalid expression.` are not two ways of saying the same thing, they are two different branches with two different fixes"
sidebar_label: "10g · Calls and invalid expressions"
sidebar_position: 10.6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/diagnostics.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/diagnostics.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/builtin.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/builtin.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/common/src/diagnostics.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/common/src/diagnostics.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/common/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/common/src/util.ts),
> [`packages/compiler-cli/src/ngtsc/reflection/src/typescript.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/reflection/src/typescript.ts),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts).
> Documentation-validated; **no sandbox run** — no build was executed. Every message string below is a string literal read from a named file at that tag.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not.** Nothing on this page is daggered — `VALUE_HAS_WRONG_TYPE = 1010` was read from the line of `error_code.ts` that assigns it.

**[10 · Metadata errors, one by one](10-metadata-errors-one-by-one.md) is the decoder; this is the entry for calls. [09d](09d-the-single-return-function-rule.md) already argued the *rule* — a helper folds when its body is exactly one `return`. This page is the other half, the one you need when the build is already red: the seven-branch ladder `visitCallExpression` walks, and which of four different messages each rung produces. Two of them, `Unable to evaluate an invalid expression.` and `Unable to evaluate statically.`, are routinely misread as "the single-return rule again" and are not — one means the thing you called is not a function at all, the other means its body is not in your program. The diagnostic tells you which. This page is how to read it. Its two continuations are [10gb](10gb-builtins-and-invalid-expression-types.md), for the three functions the evaluator *can* call and the four non-call producers of `Unable to evaluate an invalid expression.`, and [10gc](10gc-dynamic-strings-and-computed-keys.md), for `A string value could not be determined statically.`, and [10gd](10gd-enum-members-and-the-core-guard.md), for the enum-member gate.**

## Every trace in this catalogue arrives under one error code

Before the branches, one fact that makes the whole catalogue smaller. The trace strings — all ten of them, listed in [10](10-metadata-errors-one-by-one.md) — are produced by `traceDynamicValue`, and `traceDynamicValue` has exactly **one** production consumer in the compiler: `createValueHasWrongTypeError`, which ends

```ts
return new FatalDiagnosticError(ErrorCode.VALUE_HAS_WRONG_TYPE, node, chain, relatedInformation);
```

and `error_code.ts` line 23 assigns that name a number:

```ts
VALUE_HAS_WRONG_TYPE = 1010,
```

So **NG1010 is the code under every message on this page and on [10gb](10gb-builtins-and-invalid-expression-types.md) and [10gc](10gc-dynamic-strings-and-computed-keys.md)**, and 1010 is *positive*, which by the rule in [10](10-metadata-errors-one-by-one.md) means it gets no `Find more at …` suffix and has no page on angular.dev. There is nothing to look up. The message text is the documentation, which is why quoting it exactly matters.

⚠️ The one-consumer claim comes from GitHub code search across `angular/angular`, which returned four files for `traceDynamicValue`: its own definition, the `partial_evaluator/index.ts` barrel that re-exports it, `annotations/common/src/diagnostics.ts`, and a spec. Code search runs against the default branch, not the `v22.1.5` tag, so read it as *"one consumer at the time of writing"* rather than as a version-pinned guarantee.

## The seven-branch ladder

`visitCallExpression`, in source order. Each rung is a different diagnosis:

| # | The check, in `visitCallExpression` | What it produces | The trace note you see |
|---|---|---|---|
| 1 | callee is already a `DynamicValue` | `fromDynamicInput(node, lhs)` | `Unable to evaluate this expression statically.` **plus the callee's own reason underneath** |
| 2 | callee is a `KnownFn` | it is evaluated | ✅ or a further failure from the builtin |
| 3 | `!(lhs instanceof Reference)` | `fromInvalidExpressionType(node.expression, lhs)` | `Unable to evaluate an invalid expression.` |
| 4 | `getDefinitionOfFunction(lhs.node)` is `null` | `fromInvalidExpressionType(node.expression, lhs)` | `Unable to evaluate an invalid expression.` |
| 5 | `!isFunctionOrMethodReference(lhs)` | `fromInvalidExpressionType(node.expression, lhs)` | `Unable to evaluate an invalid expression.` |
| 6 | `fn.body === null` **and** a foreign-function resolver was supplied | handed to the resolver | ✅ or `unresolvable` |
| 7 | otherwise `visitFunctionBody` | see below | — |

and `visitFunctionBody` is itself three-way, verbatim:

```ts
if (fn.body === null) {
  return DynamicValue.fromUnknown(node);
} else if (fn.body.length !== 1 || !ts.isReturnStatement(fn.body[0])) {
  return DynamicValue.fromComplexFunctionCall(node, fn);
}
```

🔴 **Read the ladder top to bottom and stop at the first rung that describes you.** Rungs 3–5 are *not* about the shape of a function body; they fire before the body is ever looked at. `Unable to evaluate an invalid expression.` means **you called something that is not a function** — a class, a constant, an object. `Unable to evaluate statically.` from rung 7 means it *is* a function and the body is not in this program. Only `Unable to evaluate function call of complex function. A function must have exactly one return statement.` is about the body you wrote.

`isFunctionOrMethodReference`, which is rung 5, is the whole allowed shape:

```ts
function isFunctionOrMethodReference(
  ref: Reference<ts.Node>,
): ref is Reference<ts.FunctionDeclaration | ts.MethodDeclaration | ts.FunctionExpression> {
  return (
    ts.isFunctionDeclaration(ref.node) ||
    ts.isMethodDeclaration(ref.node) ||
    ts.isFunctionExpression(ref.node)
  );
}
```

## Five helpers, side by side

This is the payoff of the whole family: given a red build, tell which one you have. All five are called from the same evaluated field.

```ts
// src/app/report-imports.ts
import {Type} from '@angular/core';
import {ReportRow} from './report-row';
import {ReportFooter} from './report-footer';

// ✅ FOLDS — rung 7, one return statement. This is the shape 09d argues for.
export function reportImports(withFooter: boolean): Type<unknown>[] {
  return withFooter ? [ReportRow, ReportFooter] : [ReportRow];
}

// ⛔ RUNG 7, two statements →
//    `Unable to evaluate function call of complex function.
//     A function must have exactly one return statement.`
//    plus a second note `Function is declared here.` pointing at this line.
export function reportImportsVerbose(withFooter: boolean): Type<unknown>[] {
  const base = [ReportRow];
  return withFooter ? [...base, ReportFooter] : base;
}

// ⛔ RUNG 3/5, an arrow function stored in a const →
//    `Unable to evaluate this expression statically.` on the call, and
//    `This syntax is not supported.` on the arrow function itself.
export const reportImportsArrow = (): Type<unknown>[] => [ReportRow, ReportFooter];

// ⛔ RUNG 4, not a function at all →  `Unable to evaluate an invalid expression.`
export const REPORT_IMPORTS = [ReportRow, ReportFooter];
```

```ts
// src/app/report.ts
import {Component} from '@angular/core';
import {reportImports, REPORT_IMPORTS} from './report-imports';

@Component({selector: 'app-report', imports: reportImports(true), template: '<report-row />'})
export class ReportOk {}

// ⛔ `REPORT_IMPORTS(...)` — an array is not callable. Rung 4, on the callee.
// @Component({selector: 'app-bad', imports: REPORT_IMPORTS(), template: ''})
// export class ReportBad {}
```

And the fifth: the helper is fine, and lives in a package.

```ts
// ⛔ RUNG 7, `fn.body === null` → the bare `Unable to evaluate statically.`
//    The library ships a `.d.ts`; the body the evaluator needs was never in your program,
//    however tidy the published source looks. Covered in depth in 10c.
import {buildRoutes} from '@acme/routing';
```

**Four different notes, one symptom.** Match the note, not the shape of your code:

| Trace note | Which rung | The fix |
|---|---|---|
| `Unable to evaluate an invalid expression.` | 3, 4, 5 | you called a non-function — stop calling it, or point at the real function |
| `Unable to evaluate this expression statically.` + `This syntax is not supported.` | 1 | the callee is an arrow function or function expression — make it a `function` declaration |
| `Unable to evaluate function call of complex function. …` | 7 | collapse the body to one `return` |
| `Unable to evaluate statically.` | 7, `fn.body === null` | the body is not in this compilation — declare the value locally instead |

## `export const f = () => …` — settled, and it does not work

[09d](09d-the-single-return-function-rule.md) closes with an explicit *"what this page does not establish"*: whether an arrow function assigned to a `const` is reachable as a callee. It is not, and the two functions that settle it are short.

`TypeScriptReflectionHost.getVariableValue`, verbatim:

```ts
getVariableValue(declaration: ts.VariableDeclaration): ts.Expression | null {
  return declaration.initializer || null;
}
```

So resolving the identifier `reportImportsArrow` does not produce a `Reference` to a function — it produces **the initializer expression itself**, an arrow function, which is then handed to `visitExpression`. And `visitExpression`'s dispatch has no `ts.isArrowFunction` and no `ts.isFunctionExpression` branch; both fall to its final `else`:

```ts
} else {
  return DynamicValue.fromUnsupportedSyntax(node);
}
```

That `DynamicValue` comes back as the callee, rung 1 fires, and you get a two-line trace: `Unable to evaluate this expression statically.` on the call, `This syntax is not supported.` on the arrow. The everything-unsupported family is **10h · Syntax the evaluator cannot read** *(not written yet)*; the part that matters here is that it reaches you through the *call* ladder and therefore looks like a call problem.

A `function` declaration takes a different route — `visitDeclaration` has no branch for it, so it falls through to `getReference(node, context)` and comes back as a `Reference<ts.FunctionDeclaration>`, which is exactly what rung 5 wants.

**The rule, stated once:** in an evaluated metadata position, `export function f() { return X; }` is callable and `export const f = () => X;` is not. Same value, same file, same call site.

## The one place an arrow function *is* legal — and it has the same rule

`forwardRef` is not evaluated by the ladder above; it is intercepted by a **foreign function resolver**, rung 6's machinery, supplied per call site by the handler that asked for the evaluation. `createForwardRefResolver` checks the callee really is `@angular/core`'s `forwardRef` and then hands the argument to `expandForwardRef`, verbatim:

```ts
function expandForwardRef(arg: ts.Expression): ts.Expression | null {
  arg = unwrapExpression(arg);
  if (!ts.isArrowFunction(arg) && !ts.isFunctionExpression(arg)) {
    return null;
  }

  const body = arg.body;
  // Either the body is a ts.Expression directly, or a block with a single return statement.
  if (ts.isBlock(body)) {
    // Block body - look for a single return statement.
    if (body.statements.length !== 1) {
      return null;
    }
    const stmt = body.statements[0];
    if (!ts.isReturnStatement(stmt) || stmt.expression === undefined) {
      return null;
    }
    return stmt.expression;
  } else {
    // Shorthand body - return as an expression.
    return body;
  }
}
```

**The single-return rule, written a second time, in a second function, for a different node kind.** `forwardRef(() => Child)` works; `forwardRef(() => { log(); return Child; })` returns `null`, which `createForwardRefResolver` turns into `unresolvable` — and `unresolvable`, at rung 6, is the `DynamicValue` the caller built: `fromDynamicInput(node, fromExternalReference(node.expression, lhs))`. Two notes, and the inner one names an *external declaration*, because `forwardRef` genuinely is one.

## Gotchas

**★ Symptom: `Unable to evaluate an invalid expression.` and you spend an hour reshaping the helper's body.** Cause: rungs 3–5 fire before the body is read. You called something that is not a function — most often an array or object constant with the same name as a helper you deleted, or a class. Fix: read which node the squiggle is on. For rungs 3–5 the `DynamicValue` is built on `node.expression`, the **callee**, not the whole call — so the marker sits on the name, not on the parentheses:

```ts
// ⛔ REPORT_IMPORTS is an array. The squiggle is on `REPORT_IMPORTS`, not on `()`.
// imports: REPORT_IMPORTS(),

// ✅ either drop the call, or call the function that actually exists.
import {REPORT_IMPORTS} from './report-imports';
// imports: REPORT_IMPORTS,
```

**★ Symptom: you convert a working `export function` helper to `export const … = () =>` during a lint cleanup and every call site breaks.** Cause: the arrow function is not in `visitExpression`'s dispatch, so the identifier resolves to `DynamicValue.fromUnsupportedSyntax` and the call fails at rung 1 with a note about *syntax*, which reads like a template error rather than a refactor regression. Fix: exempt evaluated-metadata helpers from the arrow-function rule and say why in a comment:

```ts
// This helper is called from @Component metadata. The partial evaluator resolves a
// `function` declaration to a Reference; it resolves a const-arrow to its initializer,
// which is unsupported syntax. Do not convert to an arrow function.
export function reportImports(): Type<unknown>[] {
  return [ReportRow, ReportFooter];
}
```

**★ Symptom: `Unable to evaluate statically.` on a call, and the package's source on GitHub is visibly a single return.** Cause: rung 7's `fn.body === null` — the evaluator reads the shipped `.d.ts`, which has a signature and no body. What you read on GitHub is not what the compiler read. Fix: move the value into your own compilation unit rather than the function; the full treatment is [10c](10c-symbols-the-compiler-cannot-resolve.md).

**Symptom: `forwardRef(() => { return Child; })` compiles and `forwardRef(() => { logCycle(); return Child; })` does not.** Cause: `expandForwardRef` accepts a shorthand expression body, or a block whose statements array has exactly one entry and that entry is a `return` with an expression. Two statements return `null`, which becomes the resolver's `unresolvable`. Fix: the shorthand form has no way to go wrong — use it:

```ts
import {forwardRef} from '@angular/core';
import {Child} from './child';

export const CHILD_REF = forwardRef(() => Child);
```

**Symptom: two errors from one call, and fixing the top one does not help.** Cause: rung 1 stacks — `fromDynamicInput` wraps the callee's own reason, and `visitDynamicInput` unshifts its note in front of the recursive trace. The top note is always the generic `Unable to evaluate this expression statically.`; the one underneath is the diagnosis. Fix: read the *last* related-information entry, not the first. This is the same bottom-up rule [10](10-metadata-errors-one-by-one.md) states for the diagnostic as a whole, applied one level down.

## Interview questions

**★ You get `Unable to evaluate an invalid expression.` on a line that calls a helper. Is the helper's body the problem?**
No, and this is the single most useful distinction in the family. That note comes from `INVALID_EXPRESSION_TYPE`, which `visitCallExpression` produces at three rungs that all run *before* the body is examined: the callee did not resolve to a `Reference` at all, the reflection host could not produce a `FunctionDefinition` for it, or the reference is not to a function declaration, method declaration or function expression. In every case the compiler is telling you that the thing you invoked is not a function — typically a constant, an object, a class, or a module namespace. The message that *is* about the body is the wordier one, `Unable to evaluate function call of complex function. A function must have exactly one return statement.`, and it comes with a second note pointing at the declaration. If there is no `Function is declared here.` under your error, the body was never read.

**★ `export function build() { return [A]; }` folds and `export const build = () => [A];` does not. Explain the mechanism, not the rule.**
Two different resolution paths. For the `function` declaration, the reflection host resolves the identifier to the declaration node, and `visitDeclaration` has no branch matching a function declaration, so it falls through to `getReference` and yields a `Reference<ts.FunctionDeclaration>` — precisely what rung 5's `isFunctionOrMethodReference` guard accepts, after which `visitFunctionBody` applies the single-return rule. For the `const`, the host resolves the identifier to a *variable* declaration, `visitVariableDeclaration` calls `getVariableValue` which returns `declaration.initializer`, and that initializer — an arrow function — is passed to `visitExpression`, whose dispatch chain has no arrow-function branch and therefore falls to `DynamicValue.fromUnsupportedSyntax`. The call then fails at rung 1 on a callee that is already dynamic. So it is not a style rule at all; it is which of two `visitDeclaration` branches your declaration lands in.

**★ Where is the single-return rule enforced, and how many times does it appear in the compiler?**
Twice, in two unrelated functions, for two different node kinds. `visitFunctionBody` in the partial evaluator requires `fn.body.length === 1 && ts.isReturnStatement(fn.body[0])` for an ordinary call. `expandForwardRef` in the annotations utilities requires that a `forwardRef` argument be an arrow function or function expression whose body is either a shorthand expression or a block containing exactly one `return` with an expression. The duplication is informative: it says the constraint is not an artefact of one code path but the compiler's general position on how much function it is willing to fold — one expression's worth, with parameters bound, and no control flow. It also explains the apparent contradiction that arrow functions are unsupported syntax everywhere in metadata *except* inside `forwardRef`, where a separate function reads them without going through the evaluator's dispatch at all.

**★ Which Angular error code sits above every trace in this catalogue, and what follows from its number?**
`VALUE_HAS_WRONG_TYPE`, NG1010, read from `error_code.ts`. It follows because the trace is built by `traceDynamicValue`, whose only production consumer is `createValueHasWrongTypeError`, which always throws that code. Two things follow from the number itself. First, 1010 is positive, and Angular appends the `Find more at https://v22.angular.dev/errors/NGxxxx` suffix only for negatively-declared codes — so NG1010 has no encyclopedia page, and searching for one is wasted time. Second, filtering CI output on NG1010 catches every metadata evaluation failure in one rule, which is more useful than it sounds, precisely because the code is so broad.

{/* FOOTER */}
