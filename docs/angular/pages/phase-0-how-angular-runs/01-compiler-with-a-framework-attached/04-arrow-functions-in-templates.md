---
title: "Expression-bodied arrow functions have been legal in Angular templates since v21.2 and the published expression-syntax guide still says otherwise — here is what the compiler actually accepts, what it rejects, and why an inline arrow is still usually the wrong choice"
sidebar_label: "04 · Arrow functions in templates"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Expression syntax](https://angular.dev/guide/templates/expression-syntax), [NG8111 · Functions should be invoked in event bindings](https://angular.dev/extended-diagnostics/NG8111) — the [v21.2.0 CHANGELOG](https://github.com/angular/angular/blob/main/CHANGELOG.md) in `angular/angular`, the expression parser source [`packages/compiler/src/expression_parser/parser.ts`](https://github.com/angular/angular/blob/main/packages/compiler/src/expression_parser/parser.ts), and the published `@angular/core` **22.1.5** type definitions.
> Version spine: **Angular 22.1.5** · feature landed in **21.2.0** (2026-02-25). Documentation-validated; **no sandbox run**.

**This is the one corner of the template language where the published documentation and the
shipped compiler currently give different answers, so it is worth getting exactly right
rather than half-remembering.** The expression-syntax guide lists arrow functions under
declarations that are not supported. The compiler has accepted expression-bodied arrows
since Angular 21.2.0, rejects block-bodied ones with a specific error message, ships a
runtime instruction dedicated to them, and switches parsing modes inside the arrow body in a
way that changes what else is legal there. All four of those facts matter in a code review.

## Where the disagreement is

The documented "Declarations" table in chunk [03](03-declarations-and-the-let-block.md)
lists arrow functions as unsupported. **The shipped compiler supports expression-bodied arrow functions in template expressions**, and
has since Angular 21.2.0 (2026-02-25), whose CHANGELOG lists under `core`:

> *"feat | support arrow functions in expressions"*

alongside a companion `compiler-cli` entry, *"fix | update diagnostic to flag no-op arrow
functions in listeners"*, and a documentation commit, *"fix | Remove note to skip arrow
functions in best practices"*. `@angular/core` 22.1.5 ships the runtime instruction for
them; its own doc comment reads:

> *"Create, store and retrieve an arrow function that was defined in the template."*

What is *not* supported is the block-bodied form. The expression parser in
`packages/compiler/src/expression_parser/parser.ts` raises this exact message when it sees
`{` after the arrow:

> *"Multi-line arrow functions are not supported. If you meant to return an object literal,
> wrap it with parentheses."*

So this is accepted:

```html
<app-user-table
  [rows]="users()"
  [rowClass]="(u) => u.active ? 'row row--active' : 'row'"
  [sortBy]="(a, b) => a.surname.localeCompare(b.surname)"
/>
```

and this is a parse error with the message above:

```html
<app-user-table [rowClass]="(u) => { return u.active ? 'a' : 'b'; }" />
```

To return an object literal, parenthesise the body — `(u) => ({ active: u.active })` —
which is exactly what the error message tells you to do.

The same source file carries a second detail worth knowing: when the parser enters an arrow
function body it switches into action-parsing mode, with the comment *"Arrow function can
contain assignments even in a binding context."* So an assignment inside an arrow body in a
property binding is accepted where the identical assignment outside it is not. Chunk
[05](05-expressions-statements-and-safe-navigation.md) explains what "binding context"
versus "action context" means and why it is the most important distinction in the grammar.

🔴 **None of this is permission to put logic in templates.** An arrow written inline in a
binding is a **new function identity on every update pass**. That is precisely the hazard
that got `new` removed from the grammar, and it is why the instruction exists at all — it
stores the function in a slot so the identity can be reused. Prefer a class field or a
`computed()`; use an inline arrow when the consumer genuinely does not compare by reference.

## The slot machinery: why there is an instruction at all

`@angular/core` 22.1.5 declares the instruction with this signature:

```ts
// from the published @angular/core 22.1.5 type definitions — not compiled output
declare function ɵɵarrowFunction<T>(
  slotOffset: number,
  factory: (context: T, view: LView) => (...args: unknown[]) => unknown,
  context: T,
): any;
```

Read the parameters. `slotOffset` is *"Offset from binding root to the reserved slot"* and
`factory` is *"Function used to create new instances of the function."* The compiler
reserves a slot in the view for each arrow written in a template, and the runtime stores the
created function there so it can be handed back rather than rebuilt. That is the same
pattern as `ɵɵpureFunction0`…`ɵɵpureFunctionV`, which exist for object and array literals in
bindings for exactly the same reason: an expression that constructs must not produce a new
identity on every pass if it can be helped.

🔴 **"If it can be helped" is doing real work in that sentence.** The slot lets the runtime
reuse the function when nothing it closes over has changed. It does not make an arrow free,
and it does not stop the identity changing when a captured value changes. Do not treat the
instruction's existence as an endorsement.

## The neighbouring diagnostic: NG8111

The compiler-cli entry that shipped alongside arrow support in 21.2.0 was
*"fix | update diagnostic to flag no-op arrow functions in listeners"*. The diagnostic in
question is NG8111, `uninvokedFunctionInEventBinding`:

> *"This diagnostic detects uninvoked functions in event bindings."*
> *"Functions in event bindings should be invoked when the event is triggered. If the
> function is not invoked, it will not execute when the event is triggered."*

The documented failing example is `(click)="(onClick)"` — a reference to a method rather
than a call. The correct form is `(click)="onClick()"`. Arrow support made a new spelling of
the same mistake possible: `(click)="() => this.save()"` looks like it does something and
does nothing, because the statement's value is a function nobody calls. That is what the
21.2.0 fix taught NG8111 to catch.

```html
<button type="button" (click)="save()">Save</button>
```

is right; `(click)="() => save()"` and `(click)="(save)"` are both no-ops the diagnostic
will flag — but only if `strictTemplates` is on, because *"`strictTemplates` must be enabled
for any extended diagnostic to emit."* See chunk
[15](15-extended-diagnostics.md).

## Gotchas

**★ Symptom: an inline arrow function in a binding makes a child component re-render every
tick.** Cause: a new function identity per update pass, compared by reference by the child's
`OnPush` check. Fix: lift it to a stable class field:

```ts
export class UserTable {
  protected readonly rowClass = (u: User) => (u.active ? 'row row--active' : 'row');
  protected readonly bySurname = (a: User, b: User) => a.surname.localeCompare(b.surname);
}
```

```html
<app-user-table [rows]="users()" [rowClass]="rowClass" [sortBy]="bySurname" />
```

**★ Symptom: `(click)="() => save()"` compiles, the button does nothing, and no error is
raised.** Cause: the event statement evaluates to a function object which is then discarded;
nothing invokes it. Fix: call the method. `(click)="save()"`. Then turn on the diagnostic so
the next one is caught at build time rather than in QA:

```json
{
  "angularCompilerOptions": {
    "strictTemplates": true,
    "extendedDiagnostics": {
      "checks": { "uninvokedFunctionInEventBinding": "error" }
    }
  }
}
```

**★ Symptom: `[fn]="(u) => { return u.name; }"` fails with a message about multi-line arrow
functions when the code is on one line.** Cause: the message is about the *block body*, not
the line count — the parser errors as soon as it sees `{` after `=>`. Fix: use an
expression body, and parenthesise if you are returning an object literal:

```html
<app-grid [rowKey]="(u) => u.id" [rowMeta]="(u) => ({ active: u.active, id: u.id })" />
```

**Symptom: your editor or a linter flags an arrow function in a template as unsupported
syntax.** Cause: the tool is reading the published expression-syntax guide, which still
lists arrow functions under unsupported declarations. Fix: nothing to fix in your code —
verify against the compiler, which accepts the expression-bodied form. If the tooling blocks
your build, suppress that specific check rather than rewriting working templates, and record
the discrepancy in the ticket so it can be reversed when the docs catch up.

**Symptom: a callback passed from a template gets `undefined` for `this`.** Cause: an arrow
written in a template closes over the *template's* evaluation context, not over a component
instance the way a class-field arrow does. A class-field arrow (`readonly f = () => this.x`)
captures `this` at construction and is safe to pass anywhere; an inline template arrow is
created by a factory the compiler generates. Fix: when the consumer will call the function
in an unknown context, define it as a class field, not inline.

**Symptom: an assignment inside a template arrow compiles in a property binding, and the
same assignment outside it does not.** Cause: the parser enters action-parsing mode for the
arrow body — the source comment is *"Arrow function can contain assignments even in a
binding context."* Fix: none needed, but understand the asymmetry before relying on it; it
is a parser mode, not a documented language guarantee, and chunk
[05](05-expressions-statements-and-safe-navigation.md) explains the two modes.

## Interview questions

**★ Are arrow functions legal in an Angular template in v22, and what is the catch?**
Yes for expression-bodied arrows, since v21.2 — the CHANGELOG entry is *"support arrow
functions in expressions"* — and `@angular/core` 22.1.5 ships a dedicated runtime
instruction for them. Block-bodied arrows are rejected with *"Multi-line arrow functions are
not supported. If you meant to return an object literal, wrap it with parentheses."* The
catch is twofold. First, the published expression-syntax guide has not caught up and still
lists arrow functions under unsupported declarations, so both "it works" and "the docs say
it does not" are currently true. Second, and more important in production: an inline arrow
is a new function identity every update pass, which is the same `OnPush` hazard `new` was
removed from the grammar for.

**★ Why does the compiler allow an assignment inside an arrow function body in a property
binding, when assignments are otherwise banned in bindings?**
Because the parser explicitly switches modes when it enters the arrow body — the source
comment is *"Arrow function can contain assignments even in a binding context."* The reason
the ban exists at all is that a binding expression is evaluated on every change-detection
pass, so an assignment there would be an uncontrolled side effect on every tick. An arrow
function body is not evaluated when the binding is evaluated; it is evaluated later, when
somebody calls the function. The hazard the ban protects against does not apply, so the
restriction is lifted for that scope. This is a good example of the grammar's rules being
derived from the execution model rather than from taste.

**Why is there a dedicated `ɵɵarrowFunction` instruction instead of just emitting the arrow
inline in the generated code?**
Because the generated template function runs on every update pass, and an arrow literal
sitting in that function body would allocate a new closure each time it was reached. The
instruction takes a slot offset and a factory: the runtime creates the function once, stores
it in the view's data array at that slot, and returns the stored one on subsequent passes.
It is the same design as `ɵɵpureFunction*` for object and array literals. The general
principle — the compiler reserves a slot for anything in a template that would otherwise
allocate per pass — is worth carrying forward into chunk
[07](07-create-pass-and-update-pass.md), because it is how the whole instruction set is
organised.

**When is an inline arrow in a template actually the right call?**
When the consumer does not compare by reference and the alternative genuinely hurts
readability. A one-off `track` expression, a formatter passed to a presentational component
that re-reads it every render anyway, a comparator handed to something that sorts eagerly —
these are fine. It stops being fine the moment the value crosses into an `@Input`/`input()`
on an `OnPush` component, because then reference identity becomes a change-detection signal.
If you cannot say from the call site whether the consumer compares by reference, use a class
field; it costs one line and removes the question.

**The docs say arrow functions are unsupported and the compiler accepts them. Which do you
follow?**
The compiler, but with a note. Documentation lag is common and the CHANGELOG plus the
shipped `.d.ts` plus the parser source agree with each other, which is about as settled as
an unstated behaviour gets. What documentation lag does mean is that the behaviour is not
covered by the same compatibility promise as a documented feature, so the defensive position
is to use arrows where they read well and not to build anything structural on them. In a
code review, the useful comment is not "that is unsupported" but "that is a new function
identity per pass — is the consumer `OnPush`?"

---

← Prev: [03 · Declarations and `@let`](03-declarations-and-the-let-block.md) · Index: [Topic index](README.md) · Next → [05 · Expressions, statements and safe navigation](05-expressions-statements-and-safe-navigation.md)
