---
title: "Declarations are banned in template expressions, and Angular answered by adding `@let` to the block grammar rather than widening the expression grammar — which is why it cannot be reassigned, is not hoisted, and is scoped to a view"
sidebar_label: "03 · Declarations and `@let`"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Expression syntax](https://angular.dev/guide/templates/expression-syntax), [Variables in templates](https://angular.dev/guide/templates/variables) — the [v21.2.0 CHANGELOG](https://github.com/angular/angular/blob/main/CHANGELOG.md) in `angular/angular`, the expression parser source [`packages/compiler/src/expression_parser/parser.ts`](https://github.com/angular/angular/blob/main/packages/compiler/src/expression_parser/parser.ts), and the published `@angular/core` **22.1.5** type definitions.
> Version spine: **Angular 22.1.5**. Documentation-validated; **no sandbox run**.

**The expression grammar has no way to name a value, because naming a value is a
declaration and declarations are statements. Angular's answer is not to widen the
expression grammar — it is to add a construct to the *block* grammar, `@let`, which the
compiler lowers into three purpose-built instructions.** That is a compiler's answer to the
problem, and it is worth understanding, because it explains why `@let` behaves like nothing
in JavaScript: it cannot be reassigned, it is not hoisted, and its scope is a *view* rather
than a lexical block.

One declaration form is a special case big enough to need its own chunk: arrow functions,
which the documentation lists as unsupported and the shipped compiler accepts. That is
chunk [04](04-arrow-functions-in-templates.md).

## Declarations are not supported

angular.dev is blunt:

> *"Generally speaking, declarations are not supported in Angular expressions."*

The listed examples — and the guide adds *"This includes, but is not limited to"*, so treat
the list as illustrative rather than exhaustive:

| Declaration | Example |
|---|---|
| Variables | `let label = 'abc'`, `const item = 'apple'` |
| Functions | `function myCustomFunction() { }` |
| Arrow Functions | `() => { }` |
| Classes | `class Rectangle { }` |

The reason is structural rather than stylistic. A binding is compiled into an argument to an
update instruction — `ɵɵproperty('title', <expression>)`. There is nowhere for a declaration
to *go*: it has no value, it mutates a scope, and the scope it would mutate is a generated
function whose shape the compiler controls. Widening the grammar to allow declarations would
mean giving templates a mutable local scope, which is the beginning of a general-purpose
language.

## `@let` — the block-grammar answer

> *"Angular's `@let` syntax allows you to define a local variable and re-use it across a
> template, similar to the JavaScript `let` syntax."*
> *"Use `@let` to declare a variable whose value is based on the result of a template
> expression. Angular automatically keeps the variable's value up-to-date with the given
> expression, similar to bindings."*

Notice it is `@let`, not `let` — an at-sign block, parsed by the same tokenizer that
recognises `@if` and `@for`, not by the expression parser. That is how Angular added a
declaration without touching the expression grammar.

```html
@let user = user$ | async;

@if (user) {
  @let fullName = user.firstName + ' ' + user.surname;
  @let initials = fullName.split(' ').map(part => part[0]).join('');

  <h1>Hello, {{ fullName }}</h1>
  <app-avatar [initials]="initials" [photo]="user.photo" />

  <ul>
    @for (snack of user.favoriteSnacks; track snack.id) {
      <li>{{ snack.name }}</li>
    }
  </ul>

  <button type="button" (click)="update(user)">Update profile</button>
}
```

The documented formal syntax is precise enough to quote in full:

> *"The `@let` keyword. Followed by one or more whitespaces, not including new lines.
> Followed by a valid JavaScript name and zero or more whitespaces. Followed by the `=`
> symbol and zero or more whitespaces. Followed by an Angular expression which can be
> multi-line. Terminated by the `;` symbol."*

Two consequences fall straight out of that grammar: the trailing `;` is **mandatory**, and
the right-hand side is *an Angular expression*, so everything chunk
[02](02-what-a-template-expression-may-contain.md) said still applies inside it. `@let` does
not give you a bigger expression language; it gives you a name for one.

And one hard limit:

> *"Each `@let` block can declare exactly one variable. You cannot declare multiple
> variables in the same block with a comma."*

## Three ways `@let` is not JavaScript `let`

**It cannot be reassigned.**

> *"A key difference between `@let` and JavaScript's `let` is that `@let` cannot be
> reassigned after declaration. However, Angular automatically keeps the variable's value
> up-to-date with the given expression."*

Read the second sentence carefully — it is not a constant. It is closer to a `computed()`
that lives in the template: the *binding* is fixed, the *value* tracks its expression. An
event handler that tries `(click)="value = value + 1"` on a `@let` name is documented as
invalid.

**It is scoped to a view, not a block.**

> *"`@let` declarations are scoped to the current view and its descendants. Angular creates a
> new view at component boundaries and wherever a template might contain dynamic content,
> such as control flow blocks, `@defer` blocks, or structural directives."*

A plain `<div>` does *not* create a view, so a `@let` inside one is visible after the
closing tag. An `@if` block does, so a `@let` inside it is not visible outside. That is a
compiler fact leaking usefully into the language: "view" is the unit the template function
is chopped into, and chunk [07](07-create-pass-and-update-pass.md) is about those units.

**It is not hoisted.**

> *"Since `@let` declarations are not hoisted, they cannot be accessed by parent views or
> siblings"*

So a `@let` must appear textually before every use. There is no temporal-dead-zone
subtlety to learn — the name simply does not exist above its declaration.

## What `@let` compiles to

The published `@angular/core` 22.1.5 type definitions carry three instructions that exist
solely for this construct:

| Instruction | Pass |
|---|---|
| `ɵɵdeclareLet` | create — reserves the slot in the view |
| `ɵɵstoreLet` | update — writes the current value of the expression |
| `ɵɵreadContextLet` | update — reads it back, including from a descendant view |

That third one is the mechanism behind "scoped to the current view **and its
descendants**": a nested view reads the value out of an ancestor's slot rather than having
its own copy. It is also why the scope rule is phrased in views rather than braces — the
instruction set has no other notion of nesting.

## Gotchas

**★ Symptom: `@let total = a + b` gives a parse error and the message points at the next
line.** Cause: the terminating `;` is part of the documented grammar and is not optional.
Without it the parser keeps consuming the expression across the newline — the spec says the
right-hand side *"can be multi-line"* — so the error surfaces wherever the runaway
expression finally breaks. Fix: terminate every `@let`.

```html
@let total = subtotal() + shipping();
@let label = total > 50 ? 'Free delivery' : 'Standard delivery';
```

**★ Symptom: a `@let` declared inside `@if` is "not defined" in the markup after the
block.** Cause: `@if` creates a new view, and `@let` is scoped to the current view and its
descendants, not hoisted to the parent. Fix: hoist the declaration yourself, above the
block — or, if the value only makes sense when the condition holds, move the consumer inside
the block:

```html
@let cart = cart$ | async;

@if (cart) {
  @let itemCount = cart.lines.length;
  <p>{{ itemCount }} items</p>
}

<p>Cart is {{ cart ? 'loaded' : 'loading' }}</p>
```

**★ Symptom: `(click)="draft = draft + 1"` on a name declared with `@let` does nothing or
fails.** Cause: `@let` cannot be reassigned — documented in as many words. It is a
name for an expression, kept up to date by Angular, not a variable you own. Fix: put the
state in the class as a signal and mutate that:

```ts
export class DraftEditor {
  protected draft = signal(0);
  protected increment(): void { this.draft.update((n) => n + 1); }
}
```

```html
<button type="button" (click)="increment()">Increment</button>
```

**Symptom: `@let a = 1, b = 2;` is rejected.** Cause: *"Each `@let` block can declare
exactly one variable. You cannot declare multiple variables in the same block with a
comma."* Fix: two blocks, one per line.

**Symptom: a `@let` inside a plain `<div>` is still visible after the `</div>` and you
expected it not to be.** Cause: scope is per **view**, and a `<div>` is not a view boundary.
Only component boundaries, control-flow blocks, `@defer` blocks and structural directives
create one. Fix: none needed — but do not rely on `<div>` for encapsulation; if you want the
name gone, do not declare it at that level.

**Symptom: `@let user = user$ | async;` shows `null` on the first render and you did not
expect a render at all.** Cause: `@let` is a binding, and its slot is written during the
update pass whether or not the async pipe has emitted. There is no "wait for a value"
semantics. Fix: guard the consumer, which is the idiom the documentation itself uses:

```html
@let user = user$ | async;

@if (user) {
  <h1>Hello, {{ user.name }}</h1>
} @else {
  <app-spinner />
}
```

**Symptom: a `@let` name collides with a component property and the template silently uses
the wrong one.** Cause: template-scoped names shadow class members — angular.dev says
*"if a template declares a template variables with the same name as a member, the variable
shadows that member"*. Fix: disambiguate with `this.`, which the same guide names as the
explicit escape: `{{ this.user.name }}` reaches the class member while `{{ user.name }}`
reaches the `@let`. Better still, do not shadow.

**Symptom: `@let` inside `@for` recomputes for every row and the page gets slow.** Cause:
each `@for` iteration is a view, and the `@let` is a slot in *that* view, written on every
update pass for every row. Fix: if the value does not depend on the row, hoist the `@let`
above the `@for` so it is written once per parent view instead of once per row:

```html
@let currency = settings().currencyCode;

@for (line of order().lines; track line.id) {
  <li>{{ line.total | currency:currency }}</li>
}
```

## Interview questions

**★ Why is `@let` a block rather than an expression, and what does that buy Angular?**
Because adding declarations to the expression grammar would mean giving binding expressions
a mutable local scope, and the expression grammar's whole value is that it does not have
one — every expression is a single value, evaluated in a known context, safe to re-run on
every change-detection pass. By making `@let` a block, Angular put the declaration in the
part of the language the *template* compiler owns, where it can be lowered to explicit
create/update instructions (`ɵɵdeclareLet`, `ɵɵstoreLet`, `ɵɵreadContextLet`) with a slot in
the view. The expression grammar is untouched; the feature lands entirely in codegen.

**Why is `@let` scoped to "the current view and its descendants" rather than to a block?**
Because "view" is the only unit the generated code has. The compiler chops a template into
view functions at component boundaries, control-flow blocks, `@defer` blocks and structural
directives — everywhere the DOM might be created or destroyed dynamically. A `@let` is a
slot in the view's data array, and `ɵɵreadContextLet` is how a nested view reaches an
ancestor's slot. A plain `<div>` gets no slot array of its own, so it cannot scope anything.
Once you know the codegen, the scoping rule stops looking arbitrary.

**If `@let` cannot be reassigned, what exactly is being "kept up to date"?**
The expression, not the name. `@let total = subtotal() + shipping();` compiles to a store
instruction that runs on every update pass for that view and writes the current value of
`subtotal() + shipping()` into the slot. So the binding between name and expression is
immutable; the value in the slot changes whenever the expression's inputs do. This is
exactly the semantics of a binding, which is why the docs describe it as *"similar to
bindings"* rather than similar to `const`.

**A colleague wants to add a `@const` block to a template. What would you tell them?**
That `@let` already is one — it cannot be reassigned — and that the interesting question is
what they actually want. If they want a value fixed at creation and never recomputed, that
is a class field, because `@let` re-evaluates on every update pass by design. If they want a
memoised derivation, that is `computed()` in the class, which recomputes only when its
signal inputs change and is shared across every use in the template. `@let` is for naming
an intermediate value so the template reads better; it is not a caching mechanism, and
using it as one puts work in the update pass that does not belong there.


**Why does Angular ban `function` and `class` declarations in a template but allow method
calls on the component?**
Because a method call reads something the component already owns, whereas a declaration
would create a new binding inside a scope the compiler generates and controls. There is
nowhere sensible to put it: a binding is compiled to an argument of an update instruction,
and instructions take values, not statements. The deeper reason is division of labour —
Angular's position is that behaviour lives in the class, where TypeScript checks it, tests
can reach it and the debugger can step through it, and the template describes structure.
Every hole in the expression grammar pushes work back across that line.

**How would you explain the difference between `@let`, a template reference variable
(`#ref`) and a `computed()` to someone who keeps mixing them up?**
`@let` names the result of a *template expression*; it is re-evaluated on every update pass
of its view and cannot be reassigned. `#ref` names a *thing in the DOM or the component
tree* — an element, a component or directive instance, or a `TemplateRef` — and is assigned
by Angular based on what it is attached to, not by an expression you wrote. `computed()`
lives in the class, is memoised against its signal dependencies, is type-checked as ordinary
TypeScript and is shared by every consumer including other computeds. The rule of thumb:
reach for `computed()` first, `@let` when the value is genuinely presentational and only
that template cares, and `#ref` only when you need the object itself.

---

← Prev: [02 · What an expression may contain](02-what-a-template-expression-may-contain.md) · Index: [Topic index](README.md) · Next → [04 · Arrow functions in templates](04-arrow-functions-in-templates.md)
