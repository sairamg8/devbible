---
title: "Two gates run before the partial evaluator ever starts — exactly one argument, and that argument syntactically an object literal — which is why NG1001 has three different message texts, no trace underneath, and fires on `@ViewChild` options that no documentation page mentions"
sidebar_label: "10b · The decorator argument itself"
sidebar_position: 10.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [NG1001: Argument Not Literal](https://angular.dev/errors/NG1001) — and `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/annotations/common/src/evaluation.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/common/src/evaluation.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts).
> Documentation-validated; **no sandbox run** — every message below is a string literal read from one of those two files or quoted from angular.dev.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not** — it comes from research prose rather than a line of `error_code.ts`. Match on the message text.

**The first two things that can go wrong with metadata go wrong before any metadata is read. `ngtsc` gates every Angular decorator on two syntactic conditions — the call must have exactly one argument, and that argument must be a `ts.ObjectLiteralExpression` — and it throws before the partial evaluator is ever invoked. That is why these errors have no trace underneath them, why NG1001 has three distinct message texts depending on which code path caught you, and why the single most natural refactor in a large codebase (hoist the shared config into a constant) is the one thing the compiler will not accept. It also fires on a decorator angular.dev's own NG1001 page does not list.**

## Gate one: exactly one argument — NG1002†

**Symptom.** `Incorrect number of arguments to @Component decorator`, with the squiggle on the whole decorator.

**Cause.** `resolveLiteral` in `annotations/common/src/evaluation.ts`, verbatim:

```ts
if (decorator.args === null || decorator.args.length !== 1) {
  throw new FatalDiagnosticError(
    ErrorCode.DECORATOR_ARITY_WRONG,
    decorator.node,
    `Incorrect number of arguments to @${decorator.name} decorator`,
  );
}
```

Note `decorator.args === null`. That is the **bare `@Component` with no parentheses at all** case, and it produces the same message as a two-argument call even though there are zero arguments rather than "an incorrect number" of them. The message is generated from `decorator.name`, so you get `@Directive`, `@Pipe`, `@Injectable` or `@NgModule` in the same sentence shape.

**Fix.** Give it exactly one argument, and make it a literal:

```ts
import {Component} from '@angular/core';

// ⛔ `Incorrect number of arguments to @Component decorator` — no argument list at all.
// @Component
// export class BareCard {}

// ✅
@Component({
  selector: 'app-bare-card',
  template: `<p class="card">card</p>`,
})
export class BareCard {}
```

## Gate two: the argument must be an object literal — NG1001

**Symptom.** One of two messages depending on which handler caught it — `Decorator argument must be literal.` from the common path, or `@Component argument must be an object literal` from the directive/component path. Same error code, different text.

**Cause.** Two call sites, both requiring `ts.isObjectLiteralExpression`. From `annotations/common/src/evaluation.ts`, verbatim:

```ts
const meta = unwrapExpression(decorator.args[0]);

if (!ts.isObjectLiteralExpression(meta)) {
  throw new FatalDiagnosticError(
    ErrorCode.DECORATOR_ARG_NOT_LITERAL,
    meta,
    `Decorator argument must be literal.`,
  );
}
```

and from `annotations/directive/src/shared.ts`, verbatim:

```ts
const meta = unwrapExpression(decorator.args[0]);
if (!ts.isObjectLiteralExpression(meta)) {
  throw new FatalDiagnosticError(
    ErrorCode.DECORATOR_ARG_NOT_LITERAL,
    meta,
    `@${decorator.name} argument must be an object literal`,
  );
}
```

The docs give the reason, and it is worth quoting in full because it explains why this is stricter than View Engine was. angular.dev [NG1001](https://angular.dev/errors/NG1001), verbatim:

> *"To make the metadata extraction in the Angular compiler faster, the decorators `@NgModule`, `@Pipe`, `@Component`, `@Directive`, and `@Injectable` accept only object literals as arguments."*

> *"This is an intentional change in Ivy, which enforces stricter argument requirements for decorators than View Engine. Ivy requires this approach because it compiles decorators by moving the expressions into other locations in the class output."*

That last clause is the whole justification: the compiler does not *read* your decorator and keep it, it **takes the expressions out of it and puts them somewhere else** — into `ɵcmp`, into the template function, into the `.d.ts`. It cannot move an expression it has not located, and it locates expressions by walking the keys of a literal.

**Fix.** Inline the literal. If sharing was the point, **spread it** — a spread inside an object literal leaves the outer node a literal:

```ts
import {ChangeDetectionStrategy, Component} from '@angular/core';

const SHARED_METADATA = {
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {'class': 'card'},
} as const;

// ⛔ NG1001 — the argument is an identifier, not an object literal.
// @Component(SHARED_METADATA)
// export class UserCardBad {}

// ✅ the argument is syntactically an object literal; the spread is evaluated inside it.
@Component({
  ...SHARED_METADATA,
  selector: 'app-user-card',
  template: `<h2 class="name">{{ name }}</h2>`,
})
export class UserCard {
  protected readonly name = 'Ada';
}
```

⚠️ **The spread form works because the two gates are separate.** Gate two is a check on the shape of the argument *node*. The spread's operand is then handed to the partial evaluator like any other value, folds if `visitObjectLiteralExpression` can fold it, and produces a `DYNAMIC_INPUT` failure if it cannot — the ordinary machinery from [10](10-metadata-errors-one-by-one.md). Syntactic requirement first, value requirement second. This escape hatch is not documented anywhere on angular.dev.

## `unwrapExpression` runs first, so casts and parentheses are transparent

Both gate-two call sites run `unwrapExpression` before testing, which strips parentheses and `as` assertions. A detail that saves an afternoon when you are trying to type your metadata:

```ts
import {Component, Type} from '@angular/core';

interface CardMetadata {
  readonly selector: string;
  readonly template: string;
}

// ✅ an `as` cast around an object literal is still an object literal to the compiler.
@Component({
  selector: 'app-badge',
  template: `<span class="badge">badge</span>`,
} as CardMetadata)
export class Badge {}

// ✅ so are redundant parentheses.
@Component(({
  selector: 'app-chip',
  template: `<span class="chip">chip</span>`,
}))
export class Chip {}

export const REGISTRY: ReadonlyArray<Type<unknown>> = [Badge, Chip];
```

🔴 **But `satisfies` and `as` are not equivalent here, and the difference is not in Angular's hands.** `unwrapExpression` handles `ts.isAsExpression`. Whether it also unwraps a `satisfies` expression is not something the source excerpts read for this page settle, so **do not assume it does** — if you want the type check, put the annotation on a separate exported constant and spread it into the literal, which is gate-safe by construction and does not depend on the answer.

## 🔴 The same code fires on `@ViewChild` options — and no documentation page says so

**Symptom.** NG1001 on a line with no class decorator anywhere near it: `@ViewChild options must be an object literal`.

**Cause.** The query decorators route their *second* argument through the identical check. From `annotations/directive/src/shared.ts`, verbatim:

```ts
const optionsExpr = unwrapExpression(args[1]);
if (!ts.isObjectLiteralExpression(optionsExpr)) {
  throw new FatalDiagnosticError(
    ErrorCode.DECORATOR_ARG_NOT_LITERAL,
    optionsExpr,
    `@${name} options must be an object literal`,
  );
}
```

So a shared `QUERY_OPTIONS` constant — the most natural DRY refactor available — fails with the same error code as a shared component config, on a completely different decorator. The angular.dev NG1001 page enumerates five decorators, and `@ViewChild`, `@ViewChildren`, `@ContentChild` and `@ContentChildren` are not among them.

**Fix.** Inline the options at every query site. There is nothing to share, and the object is two keys at most:

```ts
import {Component, ElementRef, ViewChild} from '@angular/core';

const QUERY_OPTIONS = {static: true} as const;

@Component({
  selector: 'app-editor',
  template: `<div #host class="editor"></div>`,
})
export class Editor {
  // ⛔ NG1001 — `@ViewChild options must be an object literal`.
  // @ViewChild('host', QUERY_OPTIONS)
  // protected readonly hostRefBad!: ElementRef<HTMLDivElement>;

  // ✅ inline.
  @ViewChild('host', {static: true})
  protected readonly hostRef!: ElementRef<HTMLDivElement>;
}
```

**The better fix in v22 is to stop using the decorator.** Signal queries are ordinary function calls in a field initialiser, not decorators, so neither gate applies to them at all:

```ts
import {Component, ElementRef, viewChild} from '@angular/core';

@Component({
  selector: 'app-editor-signal',
  template: `<div #host class="editor"></div>`,
})
export class EditorSignal {
  protected readonly hostRef = viewChild.required<ElementRef<HTMLDivElement>>('host');

  protected focus(): void {
    this.hostRef().nativeElement.focus();
  }
}
```

## Gotchas

**★ Symptom: you extract `@Component` metadata into a constant to share it across three components, and every one of them fails with `@Component argument must be an object literal`.** Cause: gate two tests the *syntax* of the argument node, and an identifier is not an object literal no matter what it holds. Fix: keep the constant and spread it, which satisfies the gate and still shares the values:

```ts
import {ChangeDetectionStrategy, Component, ViewEncapsulation} from '@angular/core';

export const PANEL_DEFAULTS = {
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.Emulated,
  host: {'class': 'panel', 'role': 'region'},
} as const;

@Component({
  ...PANEL_DEFAULTS,
  selector: 'app-settings-panel',
  template: `<ng-content />`,
})
export class SettingsPanel {}

@Component({
  ...PANEL_DEFAULTS,
  selector: 'app-alerts-panel',
  template: `<ng-content />`,
})
export class AlertsPanel {}
```

**★ Symptom: NG1001 on a `@ViewChild` line and you cannot find `@ViewChild` on the NG1001 documentation page.** Cause: the query-options check reuses `DECORATOR_ARG_NOT_LITERAL`, and the docs page was written about the five class decorators. Fix: inline the options object, or migrate the query to `viewChild()` / `contentChild()`, which are not decorators and are not gated. Both forms are shown above.

**Symptom: an error saying there are an incorrect number of arguments when there are none.** Cause: `decorator.args === null` — the bare `@Component` without parentheses — shares the arity message. Fix: `@Component({...})`; there is no zero-argument form of any Angular class decorator.

**Symptom: the gate-two message text differs between two components in the same project and you suspect a version mismatch.** Cause: there are two call sites with two different strings. `@Component` and `@Directive` go through the directive handler and get `@Component argument must be an object literal`; `@Pipe`, `@Injectable` and `@NgModule` go through `resolveLiteral` and get `Decorator argument must be literal.`. Same `ErrorCode`, same build, different sentence. Fix: nothing to fix — but do not use the message text alone to conclude which decorator failed; read the span.

**Symptom: a `satisfies` clause on your metadata object and an NG1001 you cannot explain.** Cause: `unwrapExpression` is documented in the excerpts above as handling parentheses and `as`; whether it unwraps `satisfies` is **not settled by the source read for this page**. Fix: do not gamble on it. Type the constant separately and spread it:

```ts
import {ChangeDetectionStrategy} from '@angular/core';

interface PanelDefaults {
  readonly changeDetection: ChangeDetectionStrategy;
  readonly host: Readonly<Record<string, string>>;
}

// The type check happens here, on a plain constant, where no Angular gate applies.
export const PANEL_DEFAULTS: PanelDefaults = {
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {'class': 'panel'},
};
```

**Symptom: a codemod or a decorator factory that builds `@Component` arguments at build time, and NG1001 everywhere.** Cause: the compiler reads your source text, not the output of a program you ran over it. Anything that produces the metadata by calling a function produces a call expression at the argument position, and gate two rejects it before the evaluator would have had a chance to try. Fix: emit the literal from the codemod rather than emitting a call that would produce it — the generated file must contain the object literal, not the recipe for one.

**Symptom: these errors have no related-information notes and you conclude the diagnostic is broken.** Cause: both gates throw before `evaluator.evaluate()` is called, so there is no `DynamicValue` and nothing to trace. Fix: read the headline literally. An error with no trace is a syntactic complaint, and the span is exactly where the problem is — which for once makes it the easiest class in the catalogue.

## Interview questions

**★ `@ViewChild('host', QUERY_OPTIONS)` fails with NG1001, the same code as `@Component(CONFIG)`. Why, and what does that tell you about how the compiler reads decorators?**
Because the query decorators route their options argument through the same `ts.isObjectLiteralExpression` gate that the class decorators route their metadata argument through — the check is on the *syntax of the argument node*, not on which decorator it belongs to. It tells you the object-literal rule is not a rule about `@Component` at all; it is a rule about every place the compiler must read a fixed set of keys out of an argument without executing anything. angular.dev's NG1001 page lists five decorators and does not mention `@ViewChild`, which is exactly why this one costs people an hour.

**★ `@Component({...SHARED, selector: 'app-card'})` compiles while `@Component(SHARED)` does not. Is that a loophole?**
No — it is the rule read precisely. The gate is that the argument *node* must be a `ts.ObjectLiteralExpression`. A spread assignment is a property of an object literal, so the outer node still satisfies the check, and the spread's operand is then handed to the partial evaluator like any other value: it folds if it can and produces a `DYNAMIC_INPUT` failure if it cannot. So the syntactic requirement and the value requirement are two separate gates applied in order, and only the first is about literals. Knowing that is the difference between "Angular forbids sharing metadata" and "Angular forbids one specific spelling of it".

**★ Why does Angular need the argument to be a literal when JavaScript would happily accept a variable?**
Because the compiler does not evaluate the decorator at runtime — it *rewrites* it. angular.dev puts it as *"Ivy requires this approach because it compiles decorators by moving the expressions into other locations in the class output."* The template string becomes a template function, the selector becomes an entry in `ɵcmp`, the imports become a dependency array. To move an expression the compiler has to be able to point at it in the source, and it points at it by walking the properties of a literal. An identifier gives it one node and no way to know which of the object's future keys will matter.

**These errors carry no trace. What does that tell you about where in the pipeline they were thrown?**
That they were thrown before the partial evaluator ran. The trace is produced by `traceDynamicValue` walking a `DynamicValue`, and a `DynamicValue` only exists once evaluation has been attempted and failed. Both decorator gates throw during metadata *extraction*, which happens first. Practically: an Angular error with related-information notes is about a value, and an Angular error without them is about syntax — a fast, reliable way to route yourself to the right half of this catalogue.

**Your team wants a `createPanelComponent()` factory that returns fully-configured `@Component` metadata. What do you tell them?**
That it cannot work in the shape they want, and why: the compiler reads the source file, so a call expression at the argument position is rejected by gate two before anything is evaluated, and even hypothetically past that gate the call would have to fold through the single-return-statement rule to produce a value. The workable version is a constant plus a spread — the shared object lives in one place, each component spreads it, and the per-component keys are written literally. That keeps the sharing and satisfies the gate. If the goal was code generation rather than sharing, the generator must emit the literal into the file rather than emit a call that would build one at runtime.

---

← Prev: [10 · Metadata errors, one by one](10-metadata-errors-one-by-one.md) · Index: [Topic index](README.md) · Next → [Symbols the compiler cannot resolve](10c-symbols-the-compiler-cannot-resolve.md)
