---
title: "Angular implements no type system of its own — it rewrites your template into a synthetic TypeScript function, hands that function to `tsc`, and maps the resulting errors back onto the HTML you wrote"
sidebar_label: "14 · Template type checking"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Template type checking](https://angular.dev/tools/cli/template-typecheck) (⚠️ stale on defaults, corrected in [14f · `strictTemplates` is on by default](14f-what-stricttemplates-actually-switches.md)) — and `angular/angular` at tag `v22.1.5`:
> [`packages/compiler/src/typecheck/type_check_block.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/typecheck/type_check_block.ts),
> [`packages/compiler/src/typecheck/expression.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/typecheck/expression.ts),
> [`packages/compiler/src/typecheck/ops/expression.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/typecheck/ops/expression.ts),
> [`packages/compiler/src/typecheck/ops/events.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/typecheck/ops/events.ts),
> [`packages/compiler/src/typecheck/ops/if_block.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/typecheck/ops/if_block.ts),
> [`goldens/public-api/compiler-cli/error_code.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/compiler-cli/error_code.api.md).
> Documentation-validated; **no sandbox run** — no compiler was invoked and no generated file was dumped; every code block below is either source read from a named file or explicitly labelled `ILLUSTRATIVE`.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Chunk [01](01-the-template-is-a-separate-language.md) left a hole: TypeScript cannot see your
template. `templateUrl: './user-card.html'` is a string, the HTML file is not in the TypeScript
program, and an inline `template:` is a template literal whose contents `tsc` has no reason to
inspect. Angular fills that hole in the least clever way available, and the lack of cleverness is
the whole point: it takes the template and generates a **TypeScript function** whose body performs
exactly the assignments, calls and subscriptions the template implies, appends that function to a
synthetic file it has already inserted into your program, and lets the ordinary TypeScript checker
produce ordinary TypeScript diagnostics about it. There is no Angular type system. There is a code
generator, `tsc`, and a mapping step — and every strictness flag from
**[14f](14f-what-stricttemplates-actually-switches.md)** onwards is nothing more than a switch
that changes what text gets generated.**

## The fourth artefact

[06](06-what-the-compiler-emits.md) said the compiler turns a `@Component` class into three
artefacts: the `ɵcmp` static, the `ɵfac` static, and a type declaration in the emitted `.d.ts`.
There is a fourth, and it is the only one that exists purely for the duration of the build: the
**Type Check Block**, or TCB. It is never emitted, never bundled, never shipped. It exists so that
`tsc` has something to complain about.

The trade this design makes is worth stating plainly, because it explains every oddity in this
chunk and the next seven. Angular could have written a type checker for its template language. It
would then own generics, narrowing, union types, `strictNullChecks` semantics, declaration merging
and every future TypeScript feature — for a second language, forever. Instead it **compiles the
template to the language that already has all of that** and pays a different bill: the generated
text must be plausible TypeScript, some TypeScript errors are artefacts of the generation rather
than bugs in your template, and every diagnostic needs a position translation to be useful. Those
three costs are the subject of this page and [where the block lives](14c-the-type-check-file-and-how-errors-get-home.md).

## The TCB is a string of TypeScript, built by concatenation

Not an AST. Not a `ts.FunctionDeclaration` synthesised through the TypeScript factory API. A
string. Here is the entry point, verbatim from
`packages/compiler/src/typecheck/type_check_block.ts` at `v22.1.5`, signature and doc comment
intact:

```ts
/**
 * Given a component and metadata, compose a "type check block" function.
 *
 * @param env an `TcbEnvironment` into which type-checking code will be generated.
 * @param component metadata about the component class.
 * @param name Name of the generated function.
 * @param meta metadata about the component's template and the function being generated.
 * @param domSchemaChecker used to check and record errors regarding improper usage of DOM elements
 * and bindings.
 * @param oobRecorder used to record errors regarding template elements which could not be correctly
 * translated into types during TCB generation.
 */
export function generateTypeCheckBlock(
  env: TcbEnvironment,
  component: TcbComponentMetadata,
  name: string,
  meta: TcbTypeCheckBlockMetadata,
  domSchemaChecker: DomSchemaChecker<unknown>,
  oobRecorder: OutOfBandDiagnosticRecorder<unknown>,
): string {
```

The return type is `string`. The last four lines of the same function, verbatim, are the assembly:

```ts
const thisParamStr = `this: ${ctxRawType.print()}${typeArgsStr}`;
const bodyStr = `{\n${statements.join('\n')}\n}`;
const funcDeclStr = `function ${name}${typeParamsStr}(${thisParamStr}) ${bodyStr}`;

return `/*${meta.id}*/\n${funcDeclStr}`;
```

Three details in four lines, each of which matters later:

- **`this: UserCard`** — the component instance is the generated function's `this` parameter. That
  is the mechanical reason a template expression's implicit receiver is the component and nothing
  else: `ops/expression.ts` resolves a bare `ImplicitReceiver` to the literal string `'this'`. The
  closed lexical scope argued in [02](02-what-a-template-expression-may-contain.md) is not a style
  rule — it is the only scope the generated function *has*. A template that could reach `window`
  would need the generated function to be checked against the whole ambient environment.
- **`typeParamsStr`** — the component's own generic parameters are copied onto the generated
  function, but only when `useContextGenericType` is set. That is the public flag
  `strictContextGenerics` (**14j** *(not written yet)*).
- **`/*id*/`** — a comment, first thing in the emitted text. That comment is the return address,
  and [where the block lives](14c-the-type-check-file-and-how-errors-get-home.md) is about what it buys.

Each scope in the block is wrapped, and the compiler documents why:

```ts
// Wrap the body in an if statement. This serves two purposes:
// 1. It allows us to distinguish between the sections of the block (e.g. host or template).
// 2. It allows the `ts.Printer` to produce better-looking output.
return `if (${wrapperExpression}) {\n${statements}\n}`;
```

The template scope is wrapped in `if (true) { … }`; the host-bindings scope gets its own guard
from `createHostBindingsBlockGuard()`. So a component with both produces **one** function
containing **two** `if` blocks — which is how a diagnostic can be attributed to a host binding
rather than to the template even though both live in the same generated function.

## What the body contains: one statement per thing the template does

Every construct becomes a *statement* whose type errors are the errors you want. Here is a small
component:

```ts
import {Component} from '@angular/core';
import {UserAvatar} from './user-avatar';
import {User} from './user';

@Component({
  selector: 'user-card',
  imports: [UserAvatar],
  template: `
    <user-avatar [user]="user" (selected)="pick($event)" />
    <input #box (input)="rename(box.value)" />
    <p>{{ user.name | uppercase }}</p>
  `,
})
export class UserCard {
  user!: User;
  pick(chosen: User): void {}
  rename(name: string): void {}
}
```

and the shape of the TCB it produces. **This block is `ILLUSTRATIVE`. It is assembled from the
string-building code in `type_check_block.ts`, `ops/inputs.ts`, `ops/events.ts`,
`ops/references.ts` and `ops/expression.ts` — each line is quoted from one of those files
somewhere in this chunk or the next five — and it is not a dump of real generated output, which
cannot be produced without running the compiler:**

```ts
// ILLUSTRATIVE — the SHAPE of a TCB, read from the compiler's own string concatenation.
/*1*/
function _tcb1(this: i0.UserCard) {
  if (true) {
    var _t1 = /* an instance of UserAvatar, declared via the directive's type constructor */ null!;
    _t1.user = this.user;
    _t1["selected"].subscribe(($event): any => { this.pick($event); });
    var _t2 = document.createElement("input");
    _t2.addEventListener("input", ($event): any => { this.rename(_t2.value); });
    var _t3 = _t2;
    "" + _pipe1.transform(this.user.name);
  }
}
```

Read the type errors off that and you have read the type errors off the template:

| Template mistake | The generated statement | What `tsc` sees |
|---|---|---|
| `[user]="user"` where `user: string` | `_t1.user = this.user` | assigning `string` to `User` |
| `(selected)="pick($event)"` with a mismatched payload | `_t1["selected"].subscribe(($event) => …)` | `$event` inferred from the output's generic |
| `{{ user.nmae }}` | `this.user.nmae` | property does not exist on `User` |
| `(input)="rename(box.value)"` on a `<div>` | `document.createElement("div")` | `value` does not exist on `HTMLDivElement` |

That table is the whole feature. Nothing about it is Angular-specific except the code generator.

The DOM-element lines are not guesses. `ops/events.ts` documents the exact form in a source comment
describing the handler it emits, verbatim:

```ts
// const _t1 = document.createElement('input');
//
// _t1.addEventListener('input', ($event) => {
//   ɵassertType<typeof _t1>($event.target);
//   handler($event.target);
// });
```

`document.createElement` **is** the type source for a DOM element in the TCB — which is exactly
what `strictDomLocalRefTypes` toggles (**14j** *(not written yet)*).


One statement is conspicuously missing from that list, and `ops/inputs.ts` says so in the doc
comment of the operation that handles bindings no directive claimed, verbatim:

```ts
/**
 * A `TcbOp` which generates code to check "unclaimed inputs" - bindings on an element which were
 * not attributed to any directive or component, and are instead processed against the HTML element
 * itself.
 *
 * Currently, only the expressions of these bindings are checked. The targets of the bindings are
 * checked against the DOM schema via a `TcbDomSchemaCheckerOp`.
 *
 * Executing this operation returns nothing.
 */
```

🔴 **"Only the expressions … are checked."** `[value]="count"` on a plain `<input>` type-checks
`count` and then stops: no assignment statement is generated against `HTMLInputElement.value`, so
binding a `number` to it is not an error. The element and attribute *names* are still validated,
but by a schema checker rather than by the type system — that is NG8001 and NG8002, and it is why
those two are the errors people meet first. The flag that would change this,
`checkTypeOfDomBindings`, is hard-coded `false`
(**14k** *(not written yet)*).

## Gotchas

**★ Symptom: a huge template compiles slowly and the profile blames TypeScript, not Angular.**
Cause: the TCB for that template is a single generated function containing one statement per
binding, reference, variable and directive instance, and `tsc` checks it like any other function.
A 2,000-line template is a 2,000-statement function with a long chain of narrowed child scopes.
Fix: split the component. There is no type-checking-specific tuning knob, and turning strictness
off to buy speed costs you the entire feature — see what `strictTemplates: false` actually does in
**[14f](14f-what-stricttemplates-actually-switches.md)**.

**★ Symptom: `(input)="rename(box.value)"` fails with "Property 'value' does not exist on type
'HTMLDivElement'" and you are certain `box` is an input.** Cause: it is not — the reference is on
a `<div>` somewhere up the template, and the TCB types a DOM reference by generating
`document.createElement("div")`. The error is TypeScript's, about the DOM lib, reached through
generated code. Fix: move the reference onto the element that really has the property:

```html
<!-- wrong: #box is on the wrapper, so its type is HTMLDivElement -->
<div #box class="field">
  <input (input)="rename(box.value)" />
</div>

<!-- right: the reference names the input -->
<div class="field">
  <input #box (input)="rename(box.value)" />
</div>
```

**Symptom: the same expression appears twice in a template and the identical error is reported
twice.** Cause: the TCB emits one statement per occurrence — there is no deduplication, because
each occurrence needs its own parse span in order to be reportable at all. Fix: nothing to change
in the compiler; treat it as the signal to hoist the expression into a `@let` or a computed
signal, which collapses the two statements into one and fixes the duplicate report as a side
effect.

## Interview questions

**★ Angular type-checks templates without implementing a type system. How?**
It generates one TypeScript function per template — the Type Check Block — whose body performs the
assignments, method calls, subscriptions and property reads the template implies, and whose `this`
parameter is typed as the component. That function is appended to a synthetic `.ngtypecheck.ts`
file that ngtsc already added to the `ts.Program`, so the ordinary TypeScript checker checks it as
ordinary code. Angular then translates each resulting `ts.Diagnostic` back to a template span using
comments embedded in the generated text. Every strictness flag is a switch over what text gets
generated — disabling input checking, for example, emits `((expr) as any)` instead of a direct
assignment. Angular owns the code generator and the mapping; TypeScript owns the typing.

**★ Why does an expression in a template have access to the component and nothing else — not
`window`, not `Math`?**
Because the generated function's only scope is `function _tcb1(this: UserCard) { … }`. A bare
identifier is resolved by the binder against template variables and references, and if none match,
it is emitted as a member access on `this`. There is no other lexical binding available to the
generated code. Allowing ambient globals would mean the type-check block had to be checked against
the entire ambient environment — and, separately, would break server rendering. This is the
type-checking half of the argument in [02](02-what-a-template-expression-may-contain.md).

**★ Which parts of a template are NOT covered by the type-check block?**
Three, and they are worth knowing by name. Queries — `@ViewChild`, `viewChild()` and their content
equivalents — are never checked, because `checkQueries` is hard-coded `false`. DOM *property*
bindings are not checked against the element's type, because `checkTypeOfDomBindings` is hard-coded
`false`; only the expression on the right-hand side is checked, plus a schema check on the name.
And anything reached through `$any()` or a non-null assertion is checked as `any` by construction.
Everything else — inputs, outputs, references, pipes, control flow, `@let`, host bindings — is in
the block.

**Your component has a generic parameter. What happens to it in the TCB?**
It is copied onto the generated function, but only if `useContextGenericType` is set — the
`typeParamsStr` in `generateTypeCheckBlock` is empty otherwise. That flag is the public
`strictContextGenerics`. With it off, the component's type parameters are erased to `any` in the
template context, so a `DataTable<Row>` template checks its bindings against `any` rather than
against `Row` — the difference between catching a column-key typo and not.

**Why does the compiler wrap each section of the block in an `if`?**
Its own comment gives two reasons: it distinguishes the sections of the block — template versus
host bindings — and it lets `ts.Printer` produce better-looking output. The first is the
load-bearing one: the template body is wrapped in `if (true) { … }` and host bindings in a
separate guard, so a single generated function can carry both and each diagnostic can still be
attributed to the right one.

---

← Prev: [13e · The option surface and config-time diagnostics](13e-the-option-surface-and-config-time-diagnostics.md) · Index: [Topic index](README.md) · Next → [14b · How each template construct becomes TypeScript](14b-how-each-construct-is-translated.md)
