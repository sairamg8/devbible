---
title: "Every constraint in this topic reduces to one sentence — the compiler must resolve your decorator metadata to a value without executing your program — and the first gate that enforces it is purely syntactic: the argument must be an object literal, and an identifier is not one"
sidebar_label: "09 · Static analysability"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [NG1001: Argument Not Literal](https://angular.dev/errors/NG1001), [Ahead-of-time (AOT) compilation](https://angular.dev/tools/cli/aot-compiler) (⚠️ ViewEngine-era on this subject and corrected below) —
> and `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/annotations/common/src/evaluation.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/common/src/evaluation.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts).
> Documentation-validated; **no sandbox run** — every code block below is either source read from a named file or an illustrative component, and no build was executed.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**This is the chunk the rest of the topic rests on. A template is a separate language ([01](01-the-template-is-a-separate-language.md)) compiled ahead of time into a definition object ([06](06-what-the-compiler-emits.md)) — and both of those are only possible because of one constraint: `ngtsc` reads your `@Component` argument at build time, in a program that is not running. It cannot call your code, it cannot see a value produced at startup, it cannot ask a network. It can only *fold* the source text of the decorator argument down to a value, and if a piece of it will not fold, compilation stops. Everything people call "Angular ceremony" — the literal object, the literal `imports` array, the exported symbol — is that one constraint showing through. This page states the constraint precisely and covers the first of the two gates that enforce it: a pure syntax check on the decorator's argument, which produces three different NG1001 messages from three different call sites and catches `@ViewChild` as readily as `@Component`.**

## The constraint, stated exactly

Not *"metadata must be constant"*. Not *"you cannot use variables"*. The precise version is three clauses, and every metadata failure you will ever debug violates exactly one of them:

1. **The decorator argument must be an object literal, syntactically** — checked before anything is evaluated, and it is a check on the shape of the source text, not on the value. That is this page.
2. **Each field the compiler needs a *value* for must fold to that value**, using a small interpreter that walks TypeScript AST nodes and never calls into your program, with one narrowly defined exception. That is [09b](09b-gate-two-what-is-evaluated-and-what-is-relayed.md) and [09c](09c-the-partial-evaluator-is-the-grammar.md).
3. **Everything else is copied through untouched** — and "everything else" is most of your `@Component`, which is why `providers` accepts an arrow function while `selector` will not accept a function call ([09b](09b-gate-two-what-is-evaluated-and-what-is-relayed.md)).

Clause 3 is the one nobody tells you, and it is why the folk rules keep half-working. The evaluator is not a validator that sweeps your metadata; it is a resolver the compiler invokes at specific, enumerable call sites. The two rules you were probably taught — *"a `selector` cannot be computed"* and *"`imports` must be identifiers"* — are both close enough to be useful and wrong enough to cost you a morning; [09e](09e-selector-must-reduce-to-a-string.md) and [09f](09f-imports-and-the-rule-about-lazy-loading.md) correct both against the source.

## Why the compiler cannot just run it

The obvious objection: TypeScript is right there, the decorator argument is an expression, why not evaluate it at build time the way a bundler evaluates a constant? The error page answers this directly, and the answer is about *where the expression ends up*, not about speed alone:

> *"To make the metadata extraction in the Angular compiler faster, the decorators `@NgModule`, `@Pipe`, `@Component`, `@Directive`, and `@Injectable` accept only object literals as arguments."*

> *"This is an intentional change in Ivy, which enforces stricter argument requirements for decorators than View Engine. Ivy requires this approach because it compiles decorators by moving the expressions into other locations in the class output."*

Read the second sentence twice. **The decorator does not survive compilation.** `ngtsc` takes the sub-expressions out of your `@Component({...})` and relocates them — `providers` into the `ɵcmp` definition object, `imports` into a `dependencies` array or a lazy resolver function, the template into a compiled instruction function ([06](06-what-the-compiler-emits.md), [06c](06c-decls-vars-consts-and-dependencies.md)). You cannot relocate the *fields* of an object you were handed as an opaque identifier. To move `providers` into the definition, the compiler has to be able to point at the syntax node that *is* `providers`, and that node only exists at the call site if you wrote the literal there.

The doc anchors its own justification to the design discussion at [angular/angular#30840](https://github.com/angular/angular/issues/30840#issuecomment-498869540).

⚠️ **The AOT compilation guide describes a different compiler.** Its phase descriptions are about the ViewEngine *metadata collector*, `.metadata.json` files, `StaticReflector` and `strictMetadataEmit`. `ngtsc` at v22.1.5 has no collector and emits no `.metadata.json`; it is a `ts.CustomTransformers` pipeline with a partial evaluator called `StaticInterpreter`. Where that guide states a rule about what metadata may contain, verify it against the source before believing it — several of its rules are no longer true, and this page and [09b](09b-gate-two-what-is-evaluated-and-what-is-relayed.md) say which.

## Gate 1 — the argument must be an object literal

This is a pure syntax check, and it runs before a single field is looked at. `annotations/common/src/evaluation.ts`, `resolveLiteral`, verbatim at `v22.1.5`:

```ts
if (decorator.args === null || decorator.args.length !== 1) {
  throw new FatalDiagnosticError(
    ErrorCode.DECORATOR_ARITY_WRONG,
    decorator.node,
    `Incorrect number of arguments to @${decorator.name} decorator`,
  );
}
const meta = unwrapExpression(decorator.args[0]);

if (!ts.isObjectLiteralExpression(meta)) {
  throw new FatalDiagnosticError(
    ErrorCode.DECORATOR_ARG_NOT_LITERAL,
    meta,
    `Decorator argument must be literal.`,
  );
}
```

**There is not one NG1001 message — there are three**, from three call sites, and which one you get tells you where you went wrong. The directive/component path in `annotations/directive/src/shared.ts` has its own wording:

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

and the query decorators — `@ViewChild`, `@ContentChild` and their `All` variants — apply the *same* check to their **second** argument, the options bag:

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

🔴 **So `@ViewChild('host', QUERY_OPTIONS)` fails with the same error code as `@Component(CONFIG)`** — `DECORATOR_ARG_NOT_LITERAL`, NG1001 — and no documentation page states that. Search the error text and you get the component story, then conclude the query is unrelated. It is the same gate, applied to a different argument slot.

`DECORATOR_ARITY_WRONG` (NG1002) shares the call site: it fires when the decorator has no argument list at all, or more than one argument, before the literal check is ever reached.

## `unwrapExpression` — what still counts as a literal

The check is `ts.isObjectLiteralExpression`, but it runs on the result of `unwrapExpression`, not on the raw argument. That matters, because the three things people reach for when TypeScript complains about a decorator argument's type are all transparent to it:

```ts
import {Component, ChangeDetectionStrategy} from '@angular/core';

interface ComponentShape {
  selector: string;
  template: string;
  changeDetection: ChangeDetectionStrategy;
}

// All three of these still pass Gate 1: the literal is reachable by unwrapping.
@Component(({
  selector: 'app-parenthesised',
  template: '<p>ok</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
}))
export class Parenthesised {}

@Component({
  selector: 'app-as-cast',
  template: '<p>ok</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
} as ComponentShape)
export class AsCast {}

@Component({
  selector: 'app-non-null',
  template: '<p>ok</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
}!)
export class NonNull {}
```

Parentheses, an `as` cast and a `!` non-null assertion are all wrappers around a node that *is* an object literal, and the compiler unwraps to it. What is not transparent is **an identifier**, because an identifier is not a wrapper — it is a reference, and the literal it refers to lives somewhere else in the file, or in another file, where the compiler cannot relocate its fields from.

**The failing case, and the fix, side by side:**

```ts
// ⛔ dashboard.ts — NG1001: @Component argument must be an object literal
import {Component} from '@angular/core';

const DASHBOARD_META = {
  selector: 'app-dashboard',
  template: '<h1>Dashboard</h1>',
};

@Component(DASHBOARD_META)
export class Dashboard {}
```

```ts
// ✅ dashboard.ts — the literal is at the call site; the identifiers are INSIDE it
import {Component, ChangeDetectionStrategy} from '@angular/core';

const DASHBOARD_SELECTOR = 'app-dashboard';

@Component({
  selector: DASHBOARD_SELECTOR,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<h1>Dashboard</h1>',
})
export class Dashboard {}
```

That second block is the shape of the whole chunk. **The gate is on the outermost node, not on the contents.** Identifiers, property accesses, arithmetic, ternaries and helper calls are all live options *inside* the braces — [09c](09c-the-partial-evaluator-is-the-grammar.md) enumerates exactly which — and none of them is available *as* the braces.

## Gotchas

**★ Symptom: extracting a shared `@Component` options object to remove duplication fails the build with `@Component argument must be an object literal`.** Cause: Gate 1 is a check on the syntax of the argument node after unwrapping parentheses, `as` casts and `!`; an identifier is none of those. Fix: keep the braces at the call site and share the *values*, not the object — every field position accepts an identifier:

```ts
// shared-component-config.ts
import {ChangeDetectionStrategy, Component, ViewEncapsulation} from '@angular/core';

export const APP_ENCAPSULATION = ViewEncapsulation.Emulated;
export const APP_CHANGE_DETECTION = ChangeDetectionStrategy.OnPush;

@Component({
  selector: 'app-invoice-list',
  encapsulation: APP_ENCAPSULATION,
  changeDetection: APP_CHANGE_DETECTION,
  template: '<h2>Invoices</h2>',
})
export class InvoiceList {}
```

**★ Symptom: `@ViewChild('chartHost', VIEW_CHILD_OPTIONS)` reports NG1001, and every search result for that code is about `@Component`.** Cause: the query decorators run the identical `DECORATOR_ARG_NOT_LITERAL` check on `args[1]`, with the message `@ViewChild options must be an object literal`. Fix: inline the options object; the values inside it may still be identifiers:

```ts
import {Component, ElementRef, ViewChild} from '@angular/core';

const READ_AS = ElementRef;

@Component({
  selector: 'app-chart-frame',
  template: '<div #chartHost></div>',
})
export class ChartFrame {
  @ViewChild('chartHost', {static: true, read: READ_AS})
  chartHost!: ElementRef<HTMLDivElement>;
}
```

**Symptom: a decorator written without parentheses — `@Directive` rather than `@Directive()` — produces NG1002 and the message says "Incorrect number of arguments", which reads as though you passed too many.** Cause: the arity check runs first and rejects `decorator.args === null` before the literal check is reached; "incorrect" covers zero as well as two. Fix: call the decorator, with an empty literal if you have no metadata to give it:

```ts
import {Directive, HostListener} from '@angular/core';

@Directive({selector: '[appBlurOnEnter]'})
export class BlurOnEnter {
  @HostListener('keydown.enter')
  onEnter(): void {
    (document.activeElement as HTMLElement | null)?.blur();
  }
}
```

**Symptom: a code-generation script emits components by building a metadata object and passing it to `Component(...)` programmatically, and every generated file fails NG1001.** Cause: static analysability is a property of the *emitted source text*, not of your generator. The compiler reads what your generator wrote, and what it wrote is an identifier. Fix: have the generator emit the literal inline — generators are exactly the case where inlining costs nothing, since nobody reads the output:

```ts
// generated/widget-42.ts — emitted by tools/generate-widgets.ts, do not edit
import {Component} from '@angular/core';

@Component({
  selector: 'app-widget-42',
  template: '<span class="widget">42</span>',
})
export class Widget42 {}
```

**Symptom: a decorator argument spread from a base object — `@Component({...BASE_META, selector: 'app-x'})` — compiles, which contradicts everything you were told about literals.** Cause: it *is* an object literal; Gate 1 passes on the node kind, and a spread assignment is a legal member of one. Whether each field then resolves is Gate 2's problem, and an object spread whose operand folds is fine. Fix: nothing to fix — but know that you have moved the risk from a hard, immediate NG1001 into a per-field resolution that will fail later and far less legibly if `BASE_META` ever stops folding. Prefer explicit fields when the base object is not a local `const`:

```ts
import {Component, ViewEncapsulation} from '@angular/core';

const BASE_META = {
  encapsulation: ViewEncapsulation.Emulated,
  preserveWhitespaces: false,
};

@Component({
  ...BASE_META,
  selector: 'app-audit-log',
  template: '<h2>Audit log</h2>',
})
export class AuditLog {}
```

## Interview questions

**★ Why does Angular reject `@Component(CONFIG)` when JavaScript would accept it perfectly happily?**
Because the decorator does not survive compilation. `ngtsc` compiles a decorator by taking its sub-expressions out and relocating them into other positions in the class output — the template becomes an instruction function, `providers` becomes a field of the `ɵcmp` definition object, `imports` becomes a dependency list. Relocating a field requires being able to point at the syntax node that *is* that field, and if you handed the compiler an identifier, those nodes are somewhere else — possibly in another file, possibly assembled at runtime. The error page states both halves: the object-literal restriction exists to make metadata extraction fast, and Ivy *requires* it because it moves the expressions elsewhere. It is not a validation rule that could be relaxed with more effort; it is a precondition of the output format.

**★ The build fails with `@Component argument must be an object literal`, and you can see an object literal on the screen. What is going on?**
Look at what sits between the parentheses and the braces. The check runs `ts.isObjectLiteralExpression` on the result of `unwrapExpression`, which sees through parentheses, `as` casts and `!` assertions — so none of those is the cause. The two real causes are an identifier (`@Component(META)`) and a call (`@Component(buildMeta())`); a call expression is not an object literal no matter what it returns, and the single-return helper rule from [09c](09c-the-partial-evaluator-is-the-grammar.md) does **not** rescue it, because Gate 1 is syntactic and never invokes the evaluator at all. That asymmetry catches people: a helper call is legal as a *field value* and illegal as the *whole argument*.

**Is "the decorator argument must be a literal" a rule about your source file or about the object at runtime?**
About the source file, at one specific position. It is a syntactic property of the node in `args[0]`, checked by `ts.isObjectLiteralExpression` after unwrapping — nothing is executed, nothing is type-checked, no value is produced. That is why a generator producing metadata programmatically still has to *emit* a literal, why an `as` cast is harmless, and why an object spread inside the braces passes the check even though it looks less "literal" to a human than a variable does.

**Which decorators does the object-literal rule apply to, and which argument of each?**
The error page names `@NgModule`, `@Pipe`, `@Component`, `@Directive` and `@Injectable`, all on their single argument. The source adds a case the docs do not: the query decorators — `@ViewChild`, `@ViewChildren`, `@ContentChild`, `@ContentChildren` — run the same `DECORATOR_ARG_NOT_LITERAL` check on their *second* argument, the options bag, while their first argument is a selector that is resolved separately. So the rule is better stated as "every decorator argument slot the compiler must read structurally", and the query options bag is the slot people forget.

**Why does the arity check come before the literal check, and does the order ever matter to you?**
It matters when you write a decorator with no parentheses at all. `decorator.args === null` is checked first, so you get NG1002 `Incorrect number of arguments to @Directive decorator` rather than a message about literals — which is confusing precisely because you passed nothing rather than something wrong. Reading the code in order tells you what to look at: NG1002 means *count*, NG1001 means *shape*.

---

← Prev: **08 · Instructions, not a virtual DOM** *(not written yet)* · Index: [Topic index](README.md) · Next → [Gate 2: what is evaluated and what is relayed](09b-gate-two-what-is-evaluated-and-what-is-relayed.md)
