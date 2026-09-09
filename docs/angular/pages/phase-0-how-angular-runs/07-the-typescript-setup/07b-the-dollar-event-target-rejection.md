---
title: "`$event.target.value` is the single most-hit strictTemplates failure, it produces two TypeScript error codes for one mistake, and Angular's own source comment concedes the check has an adverse effect on developer experience — which makes it the one flag you can argue for turning off with a citation"
sidebar_label: "07b · The $event.target rejection"
sidebar_position: 7.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts)
> (`getTypeCheckingConfig`, the `checkTypeOfDomEvents` comment quoted in full, including the two error
> codes it names),
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts)
> (`strictDomEventTypes`, `strictOutputEventTypes`) — and angular.dev
> [Template type checking](https://angular.dev/tools/cli/template-typecheck) for `$any()`.
> Documentation-validated; **no sandbox run** — no build was executed and no diagnostic was captured
> from a terminal. Both error codes below are quoted from the compiler's own source comment.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`<input (blur)="update($event.target.value)">` is the template every Angular tutorial writes and the
one `strictTemplates` rejects hardest. It produces two errors for one mistake, both with TypeScript
codes that do not appear anywhere on angular.dev, and the compiler's own source comment names this
exact template as the reason the check is contentious.** That comment is why this is the one strictness
flag you can propose turning off with a citation rather than an opinion — and why it is still the third
choice, behind a one-line fix in the component.

[07](07-what-stricttemplates-rejects.md) covered the other dominant class, nullable inputs. The ranked
escape hatches are [07c](07c-the-escape-hatches-are-ranked.md).

## Two codes, one mistake

From `getTypeCheckingConfig()`, verbatim, comment and all:

```ts
        // Checking of DOM events currently has an adverse effect on developer experience,
        // e.g. for `<input (blur)="update($event.target.value)">` enabling this check results in:
        // - error TS2531: Object is possibly 'null'.
        // - error TS2339: Property 'value' does not exist on type 'EventTarget'.
        checkTypeOfDomEvents: strictTemplates,
```

The cause is one fact about the DOM type declarations, in two parts:

- **`Event.target` is declared `EventTarget | null`.** An event can be dispatched at a target that has
  since been removed, so the DOM lib admits `null`. That is `TS2531`.
- **`EventTarget` carries three members** — `addEventListener`, `removeEventListener`,
  `dispatchEvent` — and `value` is not one of them. `value` belongs to `HTMLInputElement`, several
  interfaces down. That is `TS2339`.

🔴 **Both codes are TypeScript's, not Angular's.** There is no `NG` code and no angular.dev error page
for either, which is why a reader who searches angular.dev for `TS2531` finds nothing and concludes
the message is a bug. Angular's part is only the translation: it emits the template as a TypeScript
type-check block, TypeScript checks that block, and Angular maps the resulting diagnostic's position
back onto your template line. Anything shaped `TS####` came from the other compiler.

⚠️ **`$event` on a DOM event and `$event` on an output are governed by different flags.** DOM events
are `strictDomEventTypes`; a component's `output()` or `@Output()` is `strictOutputEventTypes`, whose
JSDoc says the type *"will be inferred based on the generic type of `EventEmitter`/`Subject` of the
output"*. Turning one off does nothing to the other. That distinction is why a project that "turned
off event checking" still gets errors on half its handlers.

## The fixes, honest one first

```ts
// 1. THE FIX. Take the event, narrow it once, in code a reviewer reads.
export class SearchBox {
  readonly query = signal('');

  update(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.query.set(input.value);
  }
}
```

```html
<!-- and the template hands over the whole event -->
<input (blur)="update($event)" />
```

This is one line and it is the only option that leaves the type system working: inside `update`, the
compiler knows `input` is an `HTMLInputElement` and will catch a misspelled `.valeu` immediately. The
cast is doing real work — it supplies the non-null *and* the element type in one step, which is why it
clears both codes at once.

```html
<!-- 2. THE PER-EXPRESSION HATCH. One binding, no config change, nothing app-wide. -->
<input (blur)="update($any($event.target).value)" />
```

`$any()` is a template pseudo-function, not TypeScript — it exists only inside a template expression
and angular.dev describes it as a cast *"to the `any` type just like in TypeScript when a `<any>` or
`as any` cast is used"*. Note where the parentheses sit: cast `$event.target`, then read `.value` off
the result. Casting the whole expression instead would discard checking for the `update()` call too.

```json
// 3. THE ONE-CHECK HATCH — angularCompilerOptions in the ROOT tsconfig.json.
//    Every other strict-template check stays on; DOM event typing goes off app-wide.
{
  "angularCompilerOptions": {
    "strictDomEventTypes": false
  }
}
```

## Why option 3 is defensible here and almost nowhere else

🔴 **Because the compiler team wrote the argument down in the compiler.** *"Checking of DOM events
currently has an adverse effect on developer experience"* is not a community opinion or a
Stack Overflow consensus — it is a source comment in `compiler.ts` at the line that enables the check,
naming this exact template as its example. Quote it in the pull request that adds the flag; that is
what turns a config change into a sourced decision.

What you keep by choosing the flag over `strictTemplates: false`: input type checking, null input
checking, attribute checking, safe-navigation typing, DOM reference typing, output event typing,
context generics, literal types, and the extended diagnostics — which stop being configurable at all
if `strictTemplates` is explicitly `false`. See
[14g](../01-compiler-with-a-framework-attached/14g-what-turning-strict-templates-off-costs.md).

What you lose: `$event` in every DOM event binding in every template compiled through that config
becomes the un-narrowed DOM type. Handlers that were correct stay correct; handlers that were wrong
stop saying so.

## Gotchas

**★ Symptom: `TS2531: Object is possibly 'null'` on a template line containing `$event.target`.**
Cause: `Event.target` is `EventTarget | null` and `checkTypeOfDomEvents` is on because
`strictTemplates` is on. Fix: pass the event and narrow in the component —

```ts
onInput(event: Event): void {
  this.value.set((event.target as HTMLInputElement).value);
}
```

**★ Symptom: `TS2339: Property 'value' does not exist on type 'EventTarget'` on the same line.**
Cause: the same one, seen from the other side — `EventTarget` is the base interface and has no
`value`. Fix: the same narrowing. Both codes clear together because the cast supplies the non-null and
the element type in one step; fixing only the null half leaves the second error standing.

**★ Symptom: you searched angular.dev for `TS2531` and found nothing.** Cause: it is a TypeScript code,
not an Angular one. Fix: search TypeScript's diagnostics, or search the template construct instead.
Angular's own codes are `NG` plus four digits.

**★ Symptom: `update($event.target!.value)` clears `TS2531` and leaves `TS2339`.** Cause: the
assertion removes `null` from the union. It does not change the interface, and `EventTarget` still has
no `value`. Fix: cast to the type that has one —

```html
<!-- works, but the cast is now in the template where nothing reviews it -->
<input (blur)="update($any($event.target).value)" />
```

Better, in the component:

```ts
update(event: Event): void {
  this.value.set((event.target as HTMLInputElement).value);
}
```

**★ Symptom: you set `strictDomEventTypes: false` and `$event` is still typed on some handlers.**
Cause: those are **outputs**, not DOM events — a different flag, `strictOutputEventTypes`, whose JSDoc
says the type *"will be inferred based on the generic type of `EventEmitter`/`Subject` of the output"*.
Fix: nothing. That is the flag working correctly, and it is the one you want on. If you genuinely need
it off, it is a separate key, and note that it also governs animation events —
[14j](../01-compiler-with-a-framework-attached/14j-the-event-reference-and-generics-flags.md) has the
double-duty mapping.

**Symptom: `$any($event).target.value` compiles and a typo in the method name goes unnoticed.** Cause:
the cast is applied to the whole expression, so `target`, `value` and everything downstream is `any`.
Fix: cast the narrowest hop —

```html
<!-- too wide: nothing in this expression is checked any more -->
<input (blur)="updat($any($event).target.value)" />

<!-- narrow: only the hop that needed it is uncast -->
<input (blur)="update($any($event.target).value)" />
```

**Symptom: a template reference variable fails the same way — `<input #box (input)="rename(box.value)">`
errors on `.value`.** Cause: a *different* flag. `strictDomLocalRefTypes` types a `#ref` on a DOM node
from `document.createElement` for that tag, so `box` is an `HTMLInputElement` and this particular case
usually works; the failure appears when the reference is on an element whose tag the compiler cannot
resolve to a known element type. Fix: give the handler the event instead of the reference, or read
[14j](../01-compiler-with-a-framework-attached/14j-the-event-reference-and-generics-flags.md) for how
the reference type is derived.

**Symptom: the fix works in the component but the template still errors on `$event`.** Cause: the
handler signature says `Event` and the template is still reaching into it —
`(blur)="update($event.target)"` passes an `EventTarget | null` to a parameter typed `HTMLInputElement`.
Fix: pass `$event` itself and do all the narrowing on the TypeScript side of the boundary. The rule of
thumb is that a template expression should contain no type reasoning at all.

**Symptom: `strictDomEventTypes: false` went into `tsconfig.app.json` and `ng test` still fails.**
Cause: `tsconfig.spec.json` extends the **root**, not the app config — the three files are a star, not
a chain. Fix: put it in the root `tsconfig.json`, which is the only file both leaves inherit.
[07c](07c-the-escape-hatches-are-ranked.md) covers the placement rule in full.

## Interview questions

**★ `<input (blur)="update($event.target.value)">` fails under `strictTemplates`. Why, and what are
your options?**
`Event.target` is typed `EventTarget | null` and `EventTarget` has no `value`, so you get `TS2531` and
`TS2339` — both TypeScript codes, not Angular ones. Three options, in ascending blast radius:
`$any($event.target).value` affects one expression; narrowing in the component with
`event.target as HTMLInputElement` is the real fix and costs one line; `strictDomEventTypes: false`
turns the check off for every template compiled through that config. The third is unusually defensible
here because Angular's own source comment concedes the check has *"an adverse effect on developer
experience"* and names this exact template as the example — but it is still third, because the
one-line fix is the only option that leaves a misspelled property name detectable.

**★ Why are these TypeScript error codes rather than `NG` codes?**
Because Angular does not check the template itself. It translates the template into a type-check
block — a synthetic TypeScript file of ordinary expressions carrying the types the template implies —
and hands it to TypeScript's checker. Errors therefore arrive as TypeScript diagnostics with
TypeScript codes, and Angular's remaining job is to map their positions back onto your template line.
`NG` codes exist for the things Angular decides for itself: unresolvable metadata, the extended
diagnostics, and the tsconfig configuration errors.

**★ Is `strictDomEventTypes: false` an acceptable thing to ship?**
Yes, with the source comment quoted next to it. It is the one strictness flag whose downside is
documented by the compiler team in the compiler's own source, and turning it off leaves every other
strict-template check running. The alternative most teams reach for is `$any($event.target)` scattered
through the templates, which is the same loss of checking distributed across hundreds of unreviewable
sites instead of one line in one reviewed file. What is *not* acceptable is reaching for
`strictTemplates: false` to solve a `$event.target` problem — that trades one noisy check for all of
them plus the extended diagnostics.

**★ What is the difference between `$event` on a DOM event and `$event` on an output?**
Different sources, different flags, different types. On a DOM event `$event` is the DOM `Event` object
and its type is governed by `strictDomEventTypes`. On a component's output it is whatever the output
emits, and its type is governed by `strictOutputEventTypes` — per the JSDoc, inferred *"based on the
generic type of `EventEmitter`/`Subject` of the output"*. A project that turned off "event checking"
and still sees typed `$event` has turned off one of the two. `strictOutputEventTypes` also drives
animation event typing, so it is the one with the larger blast radius of the pair.

**Why is `event.target as HTMLInputElement` acceptable when `$event.target!` is not?**
Both are assertions, but they are made in different places and answer different questions. The cast in
the component is one hop, next to the handler that knows which element it is bound to, in a file a
reviewer reads and a test can exercise; and it produces a fully-typed value, so a typo in the property
name is still caught. The `!` in the template only removes `null`, leaves `EventTarget`, and therefore
does not even fix the second error — it looks like a fix and is not one. The general rule is that a
template expression should contain no type reasoning; push it across the boundary into TypeScript
where it can be checked.

{/* FOOTER */}
