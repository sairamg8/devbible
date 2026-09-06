---
title: "\"A selector cannot be computed\" is the wrong rule — a selector may be an identifier, a property access, a template literal or a macro call, and the exact requirement is that it reduces to a string during this compilation, which is why the same code compiles in full mode and fails in local mode"
sidebar_label: "09e · selector must reduce to a string"
sidebar_position: 9.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/common/src/diagnostics.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/common/src/diagnostics.ts),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts).
> Documentation-validated; **no sandbox run** — every code block is source read from a named file or an illustrative component.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The topic index for this chunk says "why a `selector` cannot be computed", and that phrasing — which is how everybody states it — is too strong by a long way. `selector` is an ordinary evaluated field: an identifier folds, a property access folds, a template literal folds, a single-return macro call folds. What it must do is *reduce to a `string`* by the end of the build, and there is a second, quieter clause that only appears in one compilation mode: it must reduce to a string **in this compilation unit**. That second clause is why a shared constant can compile on your machine and fail in a build configured for local compilation, with a message that names the fix in the error text.**

## What the compiler actually does with `selector`

`annotations/directive/src/shared.ts`, verbatim at `v22.1.5`:

```ts
if (directive.has('selector')) {
  const expr = directive.get('selector')!;
  const resolved = evaluator.evaluate(expr);
  assertLocalCompilationUnresolvedConst(
    compilationMode,
    resolved,
    null,
    'Unresolved identifier found for @Component.selector field! Did you ' +
      'import this identifier from a file outside of the compilation unit? ' +
      'This is not allowed when Angular compiler runs in local mode. Possible ' +
      'solutions: 1) Move the declarations into a file within the compilation ' +
      'unit, 2) Inline the selector',
  );
  if (typeof resolved !== 'string') {
    throw createValueHasWrongTypeError(expr, resolved, `selector must be a string`);
  }
  // use default selector in case selector is an empty string
  selector = resolved === '' ? defaultSelector : resolved;
  if (!selector) {
    throw new FatalDiagnosticError(
      ErrorCode.DIRECTIVE_MISSING_SELECTOR,
```

Four things happen in that order, and the order is the whole behaviour:

1. **`evaluator.evaluate(expr)`** — the full partial evaluator from [09c](09c-the-partial-evaluator-is-the-grammar.md) runs on whatever you wrote. Any expression the dispatch supports is fair game.
2. **`assertLocalCompilationUnresolvedConst`** — a mode-specific check that fires *before* the type check, and only in local compilation mode.
3. **`typeof resolved !== 'string'`** — the actual constraint. Note it is a check on the *resolved value*, not on the TypeScript type and not on the syntax.
4. **empty string means "use the default"**, and if there is no default, the missing-selector error.

So the accurate statement of the rule is: **`selector` must reduce, at build time, to a value whose JavaScript type is `string`.** Everything else people say about it is a consequence or a mode.

## Which means these all compile

```ts
// selectors.ts — a real module in the compilation
export const APP_PREFIX = 'acme';
export const SELECTORS = {dashboard: 'acme-dashboard', report: 'acme-report'} as const;

export function prefixed(name: string): string {
  return `${APP_PREFIX}-${name}`;
}
```

```ts
// four legal selectors, each resolved by a different branch of the dispatch
import {Component} from '@angular/core';
import {APP_PREFIX, SELECTORS, prefixed} from './selectors';

@Component({selector: SELECTORS.dashboard, template: '<h1>A</h1>'})
export class ByPropertyAccess {}

@Component({selector: SELECTORS['report'], template: '<h1>B</h1>'})
export class ByElementAccess {}

@Component({selector: `${APP_PREFIX}-billing`, template: '<h1>C</h1>'})
export class ByTemplateLiteral {}

@Component({selector: prefixed('audit'), template: '<h1>D</h1>'})
export class ByMacroCall {}
```

`visitPropertyAccessExpression`, `visitElementAccessExpression`, `visitTemplateExpression` and `visitFunctionBody` respectively. None of these is a trick; they are the ordinary behaviour of an evaluated field.

## And these do not

| Written | Why it fails |
|---|---|
| `selector: MAYBE ?? 'app-fallback'` | `??` is not in `BINARY_OPERATORS` ([09c](09c-the-partial-evaluator-is-the-grammar.md)) |
| `selector: buildSelector()` where the body has two statements | `DynamicValue.fromComplexFunctionCall` ([09d](09d-the-single-return-function-rule.md)) |
| `selector: AMBIENT_SELECTOR` from a `declare const` in a `.d.ts` | `EXTERNAL_REFERENCE` — no initializer to read |
| `selector: SELECTOR_COUNT` where the constant is a number | folds fine, then fails `typeof resolved !== 'string'` |
| `` selector: tag`acme-card` `` | `ts.TaggedTemplateExpression` is not in the dispatch |

The first four all produce `selector must be a string`, and only the *second* sentence of the message distinguishes them — which is what [09g](09g-reading-a-metadata-failure.md) is about.

## The local-compilation clause

`assertLocalCompilationUnresolvedConst` runs before the type check and only under local compilation mode. Its message is unusually generous, and worth reading as documentation because there is none elsewhere:

> *"Unresolved identifier found for @Component.selector field! Did you import this identifier from a file outside of the compilation unit? This is not allowed when Angular compiler runs in local mode. Possible solutions: 1) Move the declarations into a file within the compilation unit, 2) Inline the selector"*

🔴 **This is a real portability trap.** Local compilation deliberately narrows what the compiler is allowed to look at, so a cross-file constant that resolves perfectly well in a full compilation is out of reach. The same source, the same Angular version, two build configurations, two outcomes — and the failing one is usually not the developer's own build. What the compiler runs as and where, including this mode, belongs to **13 · Where the compiler runs: `ngtsc`** *(not written yet)*; the consequence you need here is that **a selector imported from another file is the least portable of the legal forms**, and a string literal is the most.

## The empty-string case

`selector = resolved === '' ? defaultSelector : resolved;` — an empty string is not an error, it is a request for the caller-supplied default. If the caller supplied none, `!selector` is true and you get `ErrorCode.DIRECTIVE_MISSING_SELECTOR` (NG2004). So a component whose selector constant happens to fold to `''` reports a **missing** selector rather than an empty one, and the reported node is the decorator, not the constant that produced the empty string. If you are staring at a missing-selector error on a component that visibly has a `selector:` key, that is what happened.

## Gotchas

**★ Symptom: you inlined every selector in the codebase because "a selector cannot be computed", and the duplication is now the problem.** Cause: the folk rule. The requirement is `typeof resolved === 'string'` after evaluation, not a string literal in the source. Fix: use a constant, and keep it inside your own compilation:

```ts
// app/selectors.ts
export const INVOICE_TABLE_SELECTOR = 'acme-invoice-table';

// app/invoice-table.ts
import {Component} from '@angular/core';
import {INVOICE_TABLE_SELECTOR} from './selectors';

@Component({
  selector: INVOICE_TABLE_SELECTOR,
  template: '<h2>Invoices</h2>',
})
export class InvoiceTable {}
```

**★ Symptom: that exact pattern fails in CI with `Unresolved identifier found for @Component.selector field!` and works locally.** Cause: the CI build runs the compiler in local compilation mode, where a declaration from outside the compilation unit is not resolvable. Fix: the error text gives you two options; the one that always works is inlining the literal at the decorator:

```ts
import {Component} from '@angular/core';

@Component({
  selector: 'acme-invoice-table',
  template: '<h2>Invoices</h2>',
})
export class InvoiceTable {}
```

**★ Symptom: `selector must be a string`, and the second line says `Value could not be determined statically.`** Cause: the evaluator returned a `DynamicValue`, so the `typeof` check failed on a non-value rather than on a wrong type. Something inside the expression did not fold. Fix: reduce the expression until it does — the most common repair is collapsing a helper to a single `return`:

```ts
// ⛔ two statements: the call does not fold, and selector reports a wrong type
export function buildSelectorVerbose(name: string): string {
  const prefix = 'acme';
  return `${prefix}-${name}`;
}

// ✅ one return: folds to a string
export const ACME_PREFIX = 'acme';

export function buildSelector(name: string): string {
  return `${ACME_PREFIX}-${name}`;
}
```

**Symptom: `selector must be a string`, and the second line says `Value is of type 'number'.`** Cause: the opposite failure — the expression folded perfectly and produced the wrong type, usually because the constant you reached for is an index, an enum's numeric member, or a mis-picked key. Fix: point at the string, and let TypeScript catch the next one by typing the constant map:

```ts
export const SELECTORS: Record<'dashboard' | 'report', string> = {
  dashboard: 'acme-dashboard',
  report: 'acme-report',
};
```

**Symptom: a component with a visible `selector:` key reports a missing selector.** Cause: the expression folded to `''`, which the compiler reads as "use the default", and with no default supplied it falls through to `DIRECTIVE_MISSING_SELECTOR`. Fix: find the constant that is empty — the error node is the decorator, not the constant, so the compiler will not point at it for you:

```ts
// ⛔ folds to '' and reports a MISSING selector
export const FEATURE_SELECTOR = '';

// ✅
export const FEATURE_SELECTOR_FIXED = 'acme-feature-panel';
```

**Symptom: an `as const` was added to the selector map and nothing changed, good or bad.** Cause: `ts.isAsExpression` recurses into its operand ([09c](09c-the-partial-evaluator-is-the-grammar.md)) — the evaluator never sees the assertion. Fix: nothing to change; `as const` is still worth having for TypeScript's own narrowing, it is simply invisible to Angular's evaluator.

## Interview questions

**★ Is it true that a component selector cannot be computed? State the rule exactly.**
No, it is not true as usually stated. `selector` is an ordinary evaluated field: the compiler runs the full partial evaluator over whatever expression you wrote, and then checks `typeof resolved !== 'string'`. So identifiers, property accesses, element accesses, template literals with resolvable substitutions, and calls to single-return macro functions are all legal. The exact rule is that the expression must **reduce to a value of JavaScript type `string` during the build**, plus — under local compilation mode only — that the declarations it depends on must live inside the compilation unit. "Cannot be computed" is folklore that happens to keep people out of trouble; it is not what the compiler enforces.

**★ Why can the same selector expression compile in one build configuration and fail in another?**
Because of `assertLocalCompilationUnresolvedConst`, which runs before the type check and only in local compilation mode. Local compilation narrows what the compiler may look at, so an identifier imported from another file has no resolvable declaration and the check fires with a message that names both fixes: move the declaration into the compilation unit, or inline the selector. Nothing about your source changed; the amount of the program the compiler was permitted to read did. It is the sharpest reminder that "statically analysable" is relative to a compilation, not an absolute property of an expression.

**★ Why does `selector: ''` produce a "missing selector" error rather than an "empty selector" error?**
Because the empty string is treated as a request for a default rather than as a value: `selector = resolved === '' ? defaultSelector : resolved`. When the caller supplied no default, `selector` is falsy and the next check throws `DIRECTIVE_MISSING_SELECTOR`. The diagnostic is attached to the decorator, so the constant that folded to `''` is not named anywhere in the error. It is a genuinely misleading message, and knowing the two lines of source above is the whole difference between five seconds and half an hour.

**When the compiler says `selector must be a string`, what should you look at first?**
The sentence after it. `createValueHasWrongTypeError` builds a message chain, and the second sentence tells you which of two entirely different failures happened. `Value could not be determined statically.` means the evaluator gave up — something in the expression is not foldable, and the related-information notes trace which part. `Value is of type 'number'.` (or any other type) means the evaluation *succeeded* and produced the wrong kind of thing, which is a plain mistake in your constants rather than an analysability problem. Reading past the first sentence is the single highest-yield habit for metadata errors ([09g](09g-reading-a-metadata-failure.md)).

**Is the `selector` check on the TypeScript type or on the value?**
On the value. `typeof resolved !== 'string'` is a runtime `typeof` on the object the evaluator produced during the build — a JavaScript string, or a `DynamicValue`, or a `Reference`, or a number. TypeScript's own type for the expression is irrelevant to it, which is why an `as string` cast neither helps nor hurts: the cast changes what TypeScript believes and nothing about what folds.

---

← Prev: [09d · The single-return rule](09d-the-single-return-function-rule.md) · Index: [Topic index](README.md) · Next → [`imports` and the rule that is really about lazy loading](09f-imports-and-the-rule-about-lazy-loading.md)
