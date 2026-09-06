---
title: "The same template grammar behaves differently in a binding and in an event handler, and Angular 22 changed what `?.` returns — two rules that decide whether an expression compiles and what it evaluates to"
sidebar_label: "05 · Expressions, statements, `?.`"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Expression syntax](https://angular.dev/guide/templates/expression-syntax) — the [v22.0.0 CHANGELOG](https://github.com/angular/angular/blob/main/CHANGELOG.md) in `angular/angular` and the expression parser source [`packages/compiler/src/expression_parser/parser.ts`](https://github.com/angular/angular/blob/main/packages/compiler/src/expression_parser/parser.ts).
> Version spine: **Angular 22.1.5**. Documentation-validated; **no sandbox run**.

**Angular's template language has two evaluation contexts, and the same text is legal in one
and rejected in the other.** A property binding is an **expression**: it must produce a
value, it is re-evaluated on every change-detection pass for its view, and it may not
assign. An event handler is a **statement**: it runs once, when the event fires, and it may
assign but may not use a pipe. Nearly every "why does that compile there and not here?"
question about templates resolves to which of those two contexts you are standing in.

The second half of this chunk is the one v22 behaviour change in the expression language
that silently alters what your existing templates evaluate to rather than failing to build:
optional chaining now returns `undefined` instead of `null`.

## Binding context versus action context

angular.dev, in full:

> *"Event handlers are statements rather than expressions. While they support all of the
> same syntax as Angular expressions, there are two key differences:"*
> *"1. Statements do support assignment operators (but not destructuring assignments)"*
> *"2. Statements do not support pipes"*

That is the whole difference, and it explains an oddity in the documented operator table:
assignment operators (`=`, `+=`, `-=`, `*=`, `/=`, `%=`, `**=`, `&&=`, `||=`, `??=`) are
listed as *supported*, because the table covers the union of both contexts. The compiler
draws the line where the guide says it does. The expression parser has a dedicated error for
the wrong side of it:

> *"Bindings cannot contain assignments"*

```html
<input [value]="draft()" (input)="draft.set($any($event.target).value)" />

<p class="total">{{ subtotal() | currency:'GBP' }}</p>

<button type="button" (click)="expanded = !expanded">Toggle</button>
```

Line 1: the binding reads, the handler writes. Line 2: a pipe in a binding — legal.
Line 3: an assignment in a handler — legal. Move the pipe into the handler or the assignment
into the binding and each one stops compiling.

## Why the split exists at all

It is not stylistic. A binding expression runs on **every update pass of its view**, so an
assignment there is an uncontrolled side effect on every tick — it would fire during change
detection, mutate state that change detection has already read, and produce exactly the
`ExpressionChangedAfterItHasBeenChecked` class of bug (NG0100). A statement runs **once, in
response to an event**, which is precisely the moment when mutating state is the correct
thing to do. Angular did not ban assignment because assignment is bad; it banned it where
the execution model makes it unsound.

The pipe rule runs the other way. A pipe is a transformation for display, evaluated as part
of producing a value; a statement does not produce a value that anything consumes, so a pipe
in one has no meaning. Angular removed it rather than leaving it as a no-op.

One asymmetry to know about: the parser switches into action mode inside an arrow function
body — the source comment is *"Arrow function can contain assignments even in a binding
context."* So an assignment inside `[fn]="(x) => this.last = x"` is accepted where the same
assignment outside the arrow is not. Chunk
[04](04-arrow-functions-in-templates.md) covers arrows in full.

## `$event` and the lexical context

> *"Angular expressions are evaluated within the context of the component class as well as
> any relevant template variables, locals, and globals."*
> *"When referring to component class members, `this` is always implied. However, if a
> template declares a template variables with the same name as a member, the variable
> shadows that member. You can unambiguously reference such a class member by explicitly
> using `this.`."*

That is the whole scope chain: component instance → template variables and locals →
`undefined` and `$any`. `$event` is one of the `$`-prefixed locals, available only in an
action context, and it is typed by the template type checker — correctly, if
`strictTemplates` is on, and as `any` if `strictOutputEventTypes` or `strictDomEventTypes`
are switched off.

```html
@let status = 'draft';

<button type="button" (click)="publish(this.status)">Publish class status</button>
<span>Template status: {{ status }}</span>
```

`this.status` reaches the class member; bare `status` reaches the `@let`. Shadowing like
this is legal and is a bad idea; the `this.` escape exists for when you inherit it, not as
a licence to create it.

## The v22 safe-navigation change

Angular 22 aligned `?.` with JavaScript. The v22 CHANGELOG lists it under `compiler` as *"Angular expressions with optional chaining
returns `undefined`"*, and the expression-syntax guide states it plainly:

> *"Prior to Angular 22, the optional chaining operator (`?.`) returned `null` when the
> left-hand side is `null` or `undefined`, whereas standard JavaScript's `?.` returns
> `undefined`. Since Angular 22, the optional chaining operator behavior in angular
> expressions is alligned with the standard Javascript's behavior."*

The change is invisible to a `??`, an `@if` or a truthiness test — all three treat `null`
and `undefined` identically. It is visible to `=== null`, to `JSON.stringify`, to a strict
equality check inside a pipe, and to any input whose type is `T | null` but not
`T | undefined`. That last one turns a silent behaviour change into a `strictTemplates`
error, which is the good outcome.

The durable fix is to stop distinguishing `null` from `undefined` at the point of use:

```html
@if (user.address?.city; as city) {
  <p>{{ city }}</p>
} @else {
  <p>No city on file</p>
}
```

`ng update` does **not** rewrite these for you. It wraps the affected expressions in a
migration aid so the old behaviour is preserved:

```html
{{ $safeNavigationMigration(foo?.bar) }}
```

The guide is explicit about what that is: *"`$safeNavigationMigration` is a temporary
migration aid only. It instructs the compiler to compile the wrapped safe-navigation
expression using the legacy null-returning semantics rather than the standard JavaScript
`?.` semantics. It is not a real function and cannot be called from TypeScript."* It also
warns: *"Prefer migrating expressions to no longer rely on `null` vs `undefined`
distinctions so that `$safeNavigationMigration` can be removed. This function may be removed
in a future version of Angular."* Treat every one it inserts as a ticket, not a fix.

## Gotchas

**★ Symptom: `(click)="count = count + 1"` works but `[title]="count = 1"` fails with
"Bindings cannot contain assignments".** Cause: you are in the wrong context — assignment is
legal in a statement, not in an expression. Fix: do the write in the handler and read in the
binding. If you find yourself wanting to assign in a binding, what you actually want is a
`computed()`:

```ts
export class Counter {
  protected count = signal(0);
  protected label = computed(() => `Seen ${this.count()} times`);
  protected increment(): void { this.count.update((n) => n + 1); }
}
```

```html
<button type="button" [title]="label()" (click)="increment()">Seen it</button>
```

**★ Symptom: `(submit)="save(form | json)"` fails to compile.** Cause: *"Statements do not
support pipes."* Fix: pipes transform values for display; if you need the transformation at
event time, call the pipe's `transform` from the class, or better, do the work in a method:

```ts
export class OrderForm {
  private readonly json = inject(JsonPipe);
  protected save(form: OrderDraft): void {
    this.api.submit(this.json.transform(form));
  }
}
```

**★ Symptom: after `ng update` to v22 your templates are full of
`$safeNavigationMigration(...)` calls you did not write.** Cause: the migration inserted them
to preserve the pre-v22 `null`-returning behaviour of `?.` on expressions it could not prove
safe. Fix: remove each one and check what depends on `null` vs `undefined` at that site. The
guide is explicit that it *"may be removed in a future version of Angular"*, so leaving them
in place is deferred breakage, not a resolution.

**Symptom: `[value]="user?.name = 'x'"` gives "The '?.' operator cannot be used in the
assignment".** Cause: a dedicated parser error — optional chaining on the left of an
assignment is meaningless, so the parser rejects it before the assignment rule even applies.
Fix: guard explicitly and assign in the class.

**Symptom: a template variable shadows a class member and the wrong value renders.** Cause:
*"if a template declares a template variables with the same name as a member, the variable
shadows that member"*. Fix: rename one of them; if you cannot, disambiguate the class member
with `this.` as documented.

**Symptom: `$event` is typed `any` and a typo in `$event.target.value` ships to
production.** Cause: `strictTemplates` is off, or `strictOutputEventTypes` /
`strictDomEventTypes` have been individually disabled. Fix: turn `strictTemplates` on, then
use `$any($event.target)` only at the specific sites where the DOM typings genuinely cannot
give you the element type — which the documentation names as a legitimate case, because
event bubbling means `$event.target` is not the element you bound to.

## Interview questions

**★ Why can you assign in an event handler but not in a property binding?**
Because of when each runs. A binding expression is evaluated on every change-detection pass
for its view, so an assignment there would be a side effect on every tick, mutating state
that change detection may already have read — the classic
`ExpressionChangedAfterItHasBeenChecked` failure. An event handler runs once, in response to
an event, which is exactly when mutating state is correct. The compiler enforces this with a
dedicated parse error, *"Bindings cannot contain assignments"*. The rule is derived from the
execution model, not from taste, which is why it does not have exceptions you can configure.

**★ What changed about `?.` in Angular 22, and how would you find out whether your app is
affected?**
Before v22, Angular's `?.` returned `null` when the left-hand side was nullish; from v22 it
returns `undefined`, matching JavaScript. The behaviour change is invisible to `??`, `@if`
and truthiness checks, and visible to `=== null`, to serialisation, and to any input typed
`T | null` but not `T | undefined`. The practical way to find out is to turn `strictTemplates`
on and read the build errors: an input that only accepts `null` will now reject the
`undefined` the expression can produce. The other signal is the migration itself — every
`$safeNavigationMigration(...)` that `ng update` inserted marks an expression the migration
was not confident about.

**Why are pipes unavailable in an event handler?**
Because a pipe produces a value for something to consume, and a statement's value is
discarded. Allowing a pipe there would be a silent no-op with a cost — the pipe instance
would be created and `transform` called for nothing. Angular removed the possibility rather
than leaving a footgun. If you need a pipe's transformation at event time, call
`transform()` on the injected pipe from the class, where it is ordinary TypeScript and gets
type-checked properly.

**Someone says "the docs list assignment operators as supported, so I can use `+=` in an
interpolation". What is wrong with that reading?**
The operator table in the expression-syntax guide covers the union of both contexts —
expressions and statements — because they share almost all their grammar. The section that
actually assigns the operators to contexts is the "Event listener statements" one at the
bottom, which names the two differences explicitly. Reading the table alone gives you a
grammar with no context distinction, which is not the language Angular implements. The
authoritative check is the compiler: `Bindings cannot contain assignments`.

**How does the two-context rule interact with arrow functions in templates?**
Asymmetrically, and deliberately. The parser enters action-parsing mode for an arrow
function's body even when the arrow itself sits in a binding — the source comment is *"Arrow
function can contain assignments even in a binding context."* The justification is the same
one that produced the rule: the arrow body is not evaluated when the binding is evaluated,
it is evaluated later when something calls the function, so the per-tick side-effect hazard
does not apply. It is worth knowing because it is the one place the two contexts nest, and
because it is a parser behaviour rather than a documented language guarantee.

---

← Prev: [04 · Arrow functions in templates](04-arrow-functions-in-templates.md) · Index: [Topic index](README.md) · Next → **06 · What the compiler emits: `ɵcmp`** *(not written yet)*
