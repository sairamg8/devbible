---
title: "Every template construct has a TypeScript sentence it turns into — an interpolation becomes `\"\" + expr`, a pipe becomes `.transform(…)`, `@if` becomes a real `if`, and knowing the sentence tells you exactly which errors you will and will not get"
sidebar_label: "14b · How constructs are translated"
sidebar_position: 14.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler/src/typecheck/expression.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/typecheck/expression.ts),
> [`packages/compiler/src/typecheck/ops/expression.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/typecheck/ops/expression.ts),
> [`packages/compiler/src/typecheck/ops/if_block.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/typecheck/ops/if_block.ts),
> [`packages/compiler/src/typecheck/ops/events.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/typecheck/ops/events.ts),
> [`packages/compiler/src/typecheck/ops/scope.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/typecheck/ops/scope.ts),
> [`goldens/public-api/compiler-cli/error_code.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/compiler-cli/error_code.api.md).
> Documentation-validated; **no sandbox run** — every code block is source read from a named file.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[14](14-template-type-checking.md) established that the type-check block is generated TypeScript
text. This chunk is the phrase book. For each construct in the template language there is a
specific TypeScript sentence the compiler writes, and once you know the sentence you can predict
the diagnostic without running anything: you know why `@if` narrows, why a forgotten `()` in a
`@defer (when …)` trigger is caught but the same mistake elsewhere needs an extended diagnostic,
why a missing pipe does not blind the checker to the rest of the expression, and why Angular
throws away some of TypeScript's own messages and writes its own. The translator is
`packages/compiler/src/typecheck/expression.ts` — the generic expression walker — plus
`ops/expression.ts`, which supplies the Angular-specific resolutions.**

## The implicit receiver becomes `this`

A bare `user` in a template is a `PropertyRead` on an `ImplicitReceiver`. So is a reference to a
template variable. The resolver disambiguates them by asking the binder first, and its comment
sets out the whole resolution order, verbatim from `ops/expression.ts`:

```ts
// AST instances representing variables and references look very similar to property reads
// or method calls from the component context: both have the shape
// PropertyRead(ImplicitReceiver, 'propName') or Call(ImplicitReceiver, 'methodName').
//
// `translate` will first try to `resolve` the outer PropertyRead/Call. If this works,
// it's because the `BoundTarget` found an expression target for the whole expression, and
// therefore `translate` will never attempt to `resolve` the ImplicitReceiver of that
// PropertyRead/Call.
//
// Therefore if `resolve` is called on an `ImplicitReceiver`, it's because no outer
// PropertyRead/Call resolved to a variable or reference, and therefore this is a
// property read or method call on the component context itself.
return new TcbExpr('this');
```

**Template variables and references win; the component is the fallback.** That is a shadowing rule
with teeth, because it is resolved before any type is involved: a `@for` variable named `user`
does not merely shadow `this.user` in the generated code, it changes which statement is generated
at all.

## An interpolation becomes a string concatenation

`visitInterpolation` in `typecheck/expression.ts` emits `"" + a + b`. Two consequences worth
holding on to: every interpolated expression *is* checked, and an interpolation can never itself
produce a type mismatch, because anything concatenates with a string. `{{ user }}` where `user` is
an object is not a type error — it is a rendering bug that the type checker is structurally unable
to see. That gap is filled by extended diagnostics, not by the TCB: **15 · Extended diagnostics**
*(not written yet)*.

## A pipe becomes a real method call on a real instance

```ts
let methodAccess = new TcbExpr(`${pipe.print()}.transform`).addParseSpanInfo(ast.nameSpan);

if (!this.tcb.env.config.checkTypeOfPipes) {
  methodAccess = new TcbExpr(`(${methodAccess.print()} as any)`);
}

const result = new TcbExpr(`${methodAccess.print()}(${[expr.print(), ...args].join(', ')})`);
```

`{{ user.name | slice:0:3 }}` is checked as `pipeInstance.transform(this.user.name, 0, 3)` —
argument arity, argument types and return type included, against the pipe class's real
`transform` signature. This is one of the checks that has **no strictness flag at all**:
`checkTypeOfPipes` is `true` in the strict configuration and the comment beside it says why —
*"Pipes are checked in View Engine so there is no strictness flag."*
(**14h** *(not written yet)* collects the rest of that family.)

A pipe that is not in scope is recorded as **NG8004** `MISSING_PIPE` and then substituted,
verbatim: *"Use an 'any' value to at least allow the rest of the expression to be checked"* —
`pipe = new TcbExpr('(0 as any)')`. The identical substitution is used for a pipe imported through
`deferredImports` but used outside a `@defer` block, which is **NG8012**
(see [11d](11d-what-defer-never-defers.md)).

## `@if` becomes a real `if` / `else if` chain

From `ops/if_block.ts`:

```ts
const ifStatement = `if (${expression.print()}) {\n${getStatementsBlock(bodyScope.render())}}`;
const elseBranch = this.generateBranch(index + 1);

return new TcbExpr(ifStatement + (elseBranch ? ' else ' + elseBranch.print() : ''));
```

🔴 **Narrowing inside `@if` is not a feature Angular implemented.** It is TypeScript's own
control-flow analysis operating on generated `if` statements. `@if (user) { {{ user.name }} }`
narrows for exactly the same reason the equivalent TypeScript does, and it stops narrowing in
exactly the same places — a getter that TypeScript will not treat as stable, a union it cannot
discriminate.

The genuinely clever part is what it takes to *preserve* that narrowing inside an event handler,
which the same file documents verbatim:

```ts
// Since event listeners are inside callbacks, type narrowing doesn't apply to them anymore.
// To recreate the behavior, we generate an expression that negates all the values of the
// branches _before_ the current one, and then we add the current branch's expression on top.
// For example `@if (expr === 1) {} @else if (expr === 2) {} @else if (expr === 3)`, the guard
// for the last expression will be `!(expr === 1) && !(expr === 2) && expr === 3`.
```

and `tcbCreateEventHandler` in `ops/events.ts` re-applies those guards *inside* the generated arrow
function — its statement is `` body = `{ if (${guards.print()}) ${body} }` ``. That is why a click
handler written inside `@if (user)` still sees `user` as non-nullable, when the same closure in
hand-written TypeScript would not.

Whether the branch *bodies* are translated at all is controlled by `checkControlFlowBodies`, which
is `true` in the strict configuration and `false` otherwise — and has no public flag of its own.

## `@defer (when …)` is deliberately put in a condition position

From `ops/expression.ts`, verbatim:

```ts
/**
 * A `TcbOp` which renders an Angular expression inside a conditional context.
 * This is used for `@defer` triggers (`when`, `prefetch when`, `hydrate when`)
 * to enable TypeScript's TS2774 diagnostic for uninvoked functions/signals.
 *
 * Executing this operation returns nothing.
 */
```

with the emitted statement `if (${expr.print()}) {}`. TS2774 is TypeScript's *"This condition will
always return true since this function is always defined. Did you mean to call it instead?"* — a
diagnostic that only fires in a condition position. The compiler manufactures the position so that
a stock TypeScript check can catch an Angular-specific mistake. `scope.ts` pushes this op for
`triggers.when` and for `hydrateTriggers.when`.

## `@let` gets two special cases, both about not leaking generated names

Reading a `@let` before it is declared records **NG8016** `LET_USED_BEFORE_DEFINITION` and then
suppresses the follow-on noise, verbatim:

```ts
// Cast the expression to `any` so we don't produce additional diagnostics.
// We don't use `markIgnoreForDiagnostics` here, because it won't prevent duplicate
// diagnostics for nested accesses in cases like `@let value = value.foo.bar.baz`.
```

Writing to one records **NG8015** `ILLEGAL_LET_WRITE`, with a reason that exposes the seam of the
whole feature:

```ts
// Ignore diagnostics from TS produced for writes to `@let` and re-report them using
// our own infrastructure. We can't rely on the TS reporting, because it includes
// the name of the auto-generated TCB variable name.
```

🔴 **TypeScript's message would be correct and useless, because it would name `_t7` instead of
your `@let`.** Every place where Angular suppresses a `tsc` diagnostic and re-reports its own is a
place where a generated identifier would otherwise have leaked into your terminal. See
[03](03-declarations-and-the-let-block.md) for what `@let` is; event handlers are exempt from the
before-definition rule, because `ops/events.ts` overrides `isValidLetDeclarationAccess` to return
`true` — *"Event listeners are allowed to read `@let` declarations before they're declared since
the callback won't be executed immediately."*

## Gotchas

**★ Symptom: `@defer (when ready)` compiles, but the block never renders.** Cause: `ready` is a
signal or a method you did not call, so the condition is a function object — always truthy. The
compiler deliberately puts that expression in a condition position (`if (expr) {}`) so TypeScript
raises TS2774. If you did not see the error, check that the `when` trigger is really a `@defer`
trigger and not, say, an `@if` condition on a wrapper. Fix: invoke it.

```html
<!-- wrong: the trigger is the function itself, so the condition is always true -->
@defer (when isReady) { <heavy-chart /> }

<!-- right -->
@defer (when isReady()) { <heavy-chart /> }
```

**★ Symptom: `{{ user }}` renders `[object Object]` and the build is green.** Cause: an
interpolation is emitted as `"" + expr`, and everything concatenates with a string, so there is no
type error to raise. Fix: interpolate a string-producing expression, and let a computed signal
carry the formatting rather than the template:

```ts
import {Component, computed, signal} from '@angular/core';

@Component({
  selector: 'user-line',
  template: '<p>{{ label() }}</p>',
})
export class UserLine {
  readonly user = signal({first: 'Ada', last: 'Lovelace'});
  readonly label = computed(() => `${this.user().first} ${this.user().last}`);
}
```

**Symptom: a pipe name typo produces one error and the rest of the interpolation stops being
checked.** Cause: half of this is intended — Angular records NG8004 and substitutes `(0 as any)`
for the pipe *specifically so that the rest of the expression is still checked*. If the rest went
quiet too, the pipe is not your problem; something earlier in the expression bailed out. Fix: fix
the pipe import first, then re-read what remains:

```ts
import {Component} from '@angular/core';
import {UpperCasePipe} from '@angular/common';

@Component({
  selector: 'user-name',
  imports: [UpperCasePipe],   // NG8004 until the pipe is genuinely in scope
  template: '<p>{{ user.name | uppercase }}</p>',
})
export class UserName {
  user = {name: 'ada'};
}
```

**Symptom: narrowing works inside `@if` in a template, but the "same" code in the class does not
narrow inside a callback.** Cause: Angular regenerates the guard expression inside every event
handler it emits, precisely because *"event listeners are inside callbacks, type narrowing doesn't
apply to them anymore"*. TypeScript will not do that for you in hand-written code. Fix: in the
class, capture the narrowed value in a local before the callback:

```ts
save(): void {
  const user = this.user;          // narrow once, in the enclosing scope
  if (user === null) {
    return;
  }
  queueMicrotask(() => this.persist(user));   // `user` is `User` here, not `User | null`
}
```

**Symptom: `{{ this.user.name }}` and `{{ user.name }}` behave identically until you add a
template variable named `user`, and then they diverge.** Cause: a bare `user` is resolved by the
binder against template variables and references *first*, and only falls through to `'this'` when
nothing matched; an explicit `this.user` never falls through. Fix: name template variables so they
cannot collide with class members; if you must keep the collision, the explicit form is the one
that means "the component":

```html
@for (user of users; track user.id) {
  <!-- `user` is the loop variable here; `this.user` is the component field -->
  <p>{{ user.name }} / {{ this.user.name }}</p>
}
```

## Interview questions

**★ How does `@if` narrow a type inside a template, given that a template is not TypeScript?**
It becomes TypeScript. `ops/if_block.ts` emits a genuine `if (cond) { … } else if (cond2) { … }`
chain into the type-check block, so narrowing is TypeScript's own control-flow analysis running
over generated code — with all of its limits inherited unchanged. The interesting part is what it
takes to *preserve* that narrowing inside an event handler: because handlers are emitted as arrow
functions and narrowing does not survive into a callback, the compiler regenerates the full guard
expression — every earlier branch negated, the current branch appended — and wraps the handler
body in it.

**★ Why does Angular throw away some of TypeScript's diagnostics and re-report its own?**
Because TypeScript's message names generated identifiers. The comment on illegal `@let` writes is
explicit: it cannot rely on the TypeScript reporting *"because it includes the name of the
auto-generated TCB variable name"*. The span is fine — it maps back correctly — but the sentence
would tell a reader that `_t7` is read-only, which is meaningless. So Angular marks the generated
node as ignore-for-diagnostics and records its own error code (NG8015 here) with its own text.

**What does the compiler do when a template uses a pipe that is not in scope?**
It records NG8004 (`MISSING_PIPE`) against the pipe's own span and substitutes `(0 as any)` for the
pipe instance so that, in its own words, the rest of the expression can still be checked. The same
substitution handles a pipe imported through `deferredImports` and then used eagerly, which is
NG8012. Both are Angular diagnostics, not TypeScript ones — the TCB is the *place* they are
detected, not the mechanism.

**Why can a forgotten `()` on a signal be caught in a `@defer (when …)` trigger but needs an
extended diagnostic elsewhere?**
Because TS2774 — "this condition will always return true since this function is always defined" —
only fires in a condition position. `@defer` triggers are emitted as `if (expr) {}` for exactly
that reason, stated in the op's own doc comment. An interpolation is emitted as `"" + expr`, where
a function operand is perfectly legal, so nothing in TypeScript objects; catching it there needs
`interpolatedSignalNotInvoked` (NG8109), an Angular check layered on top of the TCB.

**A `@for` variable shadows a component field with the same name. Which one does the template
see, and when is that decided?**
The template variable, and it is decided at binding time, before any typing happens. The
translator asks the binder for an expression target first; only if there is none does it emit the
read against `this`. So the shadowing is not a type-level subtlety — it changes which statement
gets generated. `this.user` is the unambiguous form for the component field, and reads as such.

---

← Prev: [14 · Template type checking](14-template-type-checking.md) · Index: [Topic index](README.md) · Next → [14c · The type-check file](14c-the-type-check-file-and-how-errors-get-home.md)
