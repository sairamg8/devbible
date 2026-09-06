---
title: "The flags on the other side of a binding — `$event` gets its type from two different flags depending on whether the event is a DOM event or an output, a `#ref` on a DOM node is typed by `document.createElement`, and a generic component's parameters reach its template only if one flag says so"
sidebar_label: "14j · Event, reference, generics"
sidebar_position: 14.9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts)
> (every quoted option doc),
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts)
> (`getTypeCheckingConfig`, including its own source comments) —
> and the [v22.0.0 CHANGELOG](https://github.com/angular/angular/blob/main/CHANGELOG.md).
> Documentation-validated; **no sandbox run** — every code block is source read from a named file.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Everything in [14h](14h-the-input-side-flags.md) and
[14i](14i-attributes-literals-and-safe-navigation.md) was about values flowing *into* a directive.
These are the flags for everything else: values coming back out as events, the types of `#ref`
variables, and whether a generic component's type parameters survive into its own template. Three
things here are worth the page on their own. `strictOutputEventTypes` is the second flag that drives
two internal fields, and the second one is animation events. A `#ref` on a DOM node is typed by
generating a call to `document.createElement`, which is why a wrong reference produces an error about
`HTMLDivElement` rather than about Angular. And `checkTypeOfDomEvents` has a rationale written into
the compiler's source that names the two exact TypeScript errors it produces — a rare case of a
project documenting the developer-experience cost of its own strictness.**

## `strictOutputEventTypes` — the other double-duty flag

The public doc, verbatim:

> *"Whether to infer the type of the `$event` variable in event bindings for directive outputs or
> animation events. If this is `true`, the type of `$event` will be inferred based on the generic
> type of `EventEmitter`/`Subject` of the output. If set to `false`, the `$event` variable will be of
> type `any`."*

In `getTypeCheckingConfig` it maps to two fields:

```ts
checkTypeOfOutputEvents: strictTemplates,
checkTypeOfAnimationEvents: strictTemplates,
```

🔴 **Animation events ride the same switch as component outputs**, which is not obvious from the
option's name and is the second instance of the pattern
[14h](14h-the-input-side-flags.md) established with `strictInputTypes`. Together those two are the
answer to the interview question about flags that drive more than one behaviour: `strictInputTypes`
also enables template context guards, `strictOutputEventTypes` also covers animation events.

The typing itself comes from the output's declared generic — `output<User>()` or an
`EventEmitter<User>` — so `(userSelected)="pick($event)"` gets a `User`. With the flag off, `$event`
is `any` and the `TS7006` that would report the implicit `any` is suppressed by the artefact filter
from [14e](14e-the-errors-that-never-arrive.md).

**v22 fixed a real gap here.** The CHANGELOG records a compiler-cli fix: *"animation events not type
checked properly when bound through HostListener decorator"*. So an animation event bound through
`@HostListener` rather than in a template was, before v22, checked less thoroughly than the same
binding in a template.

## `strictDomEventTypes` — and the rationale the compiler writes down

The public doc, verbatim:

> *"Whether to infer the type of the `$event` variable in event bindings to DOM events. If this is
> `true`, the type of `$event` will be inferred based on TypeScript's `HTMLElementEventMap`, with a
> fallback to the native `Event` type. If set to `false`, the `$event` variable will be of type
> `any`."*

So DOM events and output events are typed by **different flags with different sources** —
`HTMLElementEventMap` for the first, the output's generic for the second. A template mixing both can
have one `$event` precisely typed and the other `any`, entirely from configuration.

🔴 **The compiler's own source comment on this field is unusually candid, and it is verbatim:**

```ts
// Checking of DOM events currently has an adverse effect on developer experience,
// e.g. for `<input (blur)="update($event.target.value)">` enabling this check results in:
// - error TS2531: Object is possibly 'null'.
// - error TS2339: Property 'value' does not exist on type 'EventTarget'.
checkTypeOfDomEvents: strictTemplates,
```

It names the exact template people write and the exact two errors they get. That is worth having
because it settles a common argument: those errors are **known**, **expected**, and **correct** —
`Event.target` is `EventTarget | null` in the DOM typings because events bubble, so the element you
attached the handler to is not necessarily the element that fired. The compiler is not confused; the
DOM typings are honest about something most code ignores.

The fix is to narrow where you can see the type, which is the class:

```ts
// component — one cast, in a place where it is reviewable
rename(event: Event): void {
  const input = event.target as HTMLInputElement;
  this.name = input.value;
}
```

```html
<!-- template — hand the whole event over rather than reaching into it -->
<input (blur)="rename($event)" />
```

## `strictDomLocalRefTypes` — `#ref` is typed by `document.createElement`

The public doc, verbatim:

> *"Whether to infer the type of local references. If this is `true`, the type of a `#ref` variable on
> a DOM node in the template will be determined by the type of `document.createElement` for the given
> DOM node. If set to `false`, the type of `ref` for DOM nodes will be `any`."*

The mechanism is exactly as stated: the generated block contains a `document.createElement("div")`
call whose type is what `#ref` gets. `createElement` is overloaded on `HTMLElementTagNameMap`, so
`<div #box>` gives `HTMLDivElement` and `<input #box>` gives `HTMLInputElement`, straight out of
TypeScript's DOM lib.

⚠️ **This is why a misplaced reference produces a confusing error.** `box.value` where `box` is on a
`<div>` fails with *"Property 'value' does not exist on type 'HTMLDivElement'"* — a TypeScript error
about the DOM lib, reached through generated code, with no mention of Angular anywhere in it.
Recognising the shape is the whole skill: an error naming an `HTMLxxxElement` is almost always a
reference on the wrong element.

**Non-DOM references have no flag at all**, and the source says why, verbatim:

```ts
// Non-DOM references have the correct type in View Engine so there is no strictness flag.
checkTypeOfNonDomReferences: true,
```

So `#ref` on a component or directive is always typed, regardless of configuration — the absence of a
flag is a compatibility artefact, not an oversight. That asymmetry is worth remembering: turning
strictness down changes how DOM references are typed and leaves directive references alone.

## `strictContextGenerics` — whether a generic component sees its own type parameters

The public doc, verbatim:

> *"Whether to include the generic type of components when type-checking the template. If no component
> has generic type parameters, this setting has no effect. If a component has generic type parameters
> and this setting is `true`, those generic parameters will be included in the context type for the
> template. If `false`, any generic parameters will be set to `any` in the template context type."*

The internal field is `useContextGenericType`, and [14](14-template-type-checking.md) showed where it
lands: the component's type parameters are copied onto the generated function's signature only when
it is on. With it off, `this` in the block is the component with `any` for every parameter.

🔴 **This changes the *shape of the generated function*, not one statement inside it** — which is why
two components with identical templates can produce different numbers of errors, and why the
difference does not look like a missing check on any particular line. A generic list component whose
template uses `item.name` simply cannot express that error when `T` is `any`.

The option's first sentence is also a useful scoping note: if no component in the application is
generic, the setting does nothing at all.

## The mapping

| public option | internal field(s) | what turning it off changes |
|---|---|---|
| `strictOutputEventTypes` | `checkTypeOfOutputEvents` **and** `checkTypeOfAnimationEvents` | `$event` on outputs *and* on animation events becomes `any` |
| `strictDomEventTypes` | `checkTypeOfDomEvents` | `$event` on DOM events becomes `any` instead of `HTMLElementEventMap`'s type |
| `strictDomLocalRefTypes` | `checkTypeOfDomReferences` | a `#ref` on a DOM node becomes `any` instead of `document.createElement`'s return type |
| `strictContextGenerics` | `useContextGenericType` | a generic component's type parameters become `any` in its template context |
| — | `checkTypeOfNonDomReferences` | **no flag** — a `#ref` on a directive or component is always typed |

The checks with no public flag at all, and the escape hatches for the ones you cannot turn off, are
**[14k · The checks with no switch](14k-the-checks-with-no-switch.md)**.

## Gotchas

**★ Symptom: `(blur)="update($event.target.value)"` fails with `TS2531: Object is possibly 'null'`
and `TS2339: Property 'value' does not exist on type 'EventTarget'`.** Cause: `checkTypeOfDomEvents`
is on and the DOM typings say `Event.target` is `EventTarget | null`, because events bubble. The
compiler's own source comment names this exact template and these exact two codes, so it is a known
and accepted cost rather than a defect. Fix: narrow in the class, not the template:

```ts
rename(event: Event): void {
  const input = event.target as HTMLInputElement;
  this.name = input.value;
}
```

**★ Symptom: `(input)="rename(box.value)"` fails with "Property 'value' does not exist on type
'HTMLDivElement'" and you are certain `box` is an input.** Cause: it is not — the reference is on a
`<div>` somewhere up the template, and `strictDomLocalRefTypes` types a DOM reference from
`document.createElement` for that tag. Fix: move the reference onto the element that has the
property:

```html
<!-- before -->
<div #box><input /></div>
<!-- after -->
<div><input #box /></div>
```

**★ Symptom: `$event` is precisely typed in one handler and `any` in another, in the same template.**
Cause: two different flags with two different sources — DOM events come from `HTMLElementEventMap`
via `strictDomEventTypes`, output events from the output's own generic via `strictOutputEventTypes`.
One being off produces exactly this asymmetry. Fix: check both flags; and note that the `TS7006` that
would have told you `$event` was implicitly `any` is suppressed by the artefact filter, so the
silence is by design.

**★ Symptom: you turned off `strictOutputEventTypes` for one badly-typed library output and animation
event handlers stopped being checked too.** Cause: the flag drives `checkTypeOfAnimationEvents` as
well — the second double-duty flag. Fix: prefer typing the handler parameter explicitly and leaving
the flag alone:

```ts
// the handler declares the type it wants; the binding passes $event through
onSelected(user: User): void { /* … */ }
```

**★ Symptom: two components with identical templates produce different numbers of errors.** Cause:
one is generic and `strictContextGenerics` decides whether its type parameters reach the template
context. With it off they are `any`, and whole families of errors become inexpressible. Fix: turn it
on — it is on under `strictTemplates` by default — and remember the difference is in the generated
function's *signature*, which is why it does not present as a missing check on any one line.

**★ Symptom: `#ref` on a component is typed correctly even though you turned DOM reference typing
off.** Cause: they are different fields, and the non-DOM one has no flag. The source comment gives
the reason — *"Non-DOM references have the correct type in View Engine so there is no strictness
flag"* — so it is a compatibility artefact rather than an omission. Fix: nothing; but do not expect
symmetry between DOM and directive references when reasoning about a configuration.

**★ Symptom: an animation event bound through `@HostListener` is checked on v22 and was not before.**
Cause: a v22 compiler-cli fix, recorded as *"animation events not type checked properly when bound
through HostListener decorator"*. Fix: nothing to do — but it explains new errors in host listeners
after an upgrade that are not explained by the `strictTemplates` default flip alone.

**Symptom: `strictContextGenerics` seems to have no effect at all.** Cause: most likely nothing in
the application is generic. The option's own doc opens with that scoping note — *"If no component has
generic type parameters, this setting has no effect"*. Fix: nothing; verify with a component that
actually declares a type parameter before concluding the flag is broken.

**Symptom: a `$event.target` cast works in one browser target and not another.** Cause: not Angular.
`HTMLElementEventMap` and the `EventTarget` typing come from TypeScript's DOM lib, which is selected
by your `lib` setting. Fix: check `compilerOptions.lib` — the template checker inherits whatever DOM
typings your TypeScript configuration provides.

## Interview questions

**★ Name the two flags that each drive more than one internal behaviour, and say what the second
behaviour is in each case.**
`strictInputTypes` drives `checkTypeOfInputBindings` and `applyTemplateContextGuards` — the second
being template context guards, which is what makes `@if` and `*ngFor` narrow types.
`strictOutputEventTypes` drives `checkTypeOfOutputEvents` and `checkTypeOfAnimationEvents` — the
second being animation events, which ride the same switch as component outputs despite the option's
name mentioning only outputs. Neither pairing appears on the template-typecheck guide; both are read
from `getTypeCheckingConfig`.

**★ Where does the type of `$event` come from?**
From one of two places depending on the kind of event, and they are governed by different flags. For
a DOM event, `strictDomEventTypes` types it from TypeScript's `HTMLElementEventMap` with a fallback
to `Event`. For a directive output or an animation event, `strictOutputEventTypes` types it from the
generic parameter of the output's `EventEmitter`, `Subject` or `output()`. Either flag being off
makes its `$event` `any`, and the `TS7006` implicit-any diagnostic that would have flagged it is
suppressed as a generation artefact — so the degradation is silent.

**★ Why does `(blur)="update($event.target.value)"` fail under strict templates, and is that a bug?**
Not a bug, and the compiler says so in its own source. `Event.target` is typed `EventTarget | null`
in the DOM lib because events bubble — the element that fired is not necessarily the one you attached
to — so reaching for `.value` produces `TS2531` and `TS2339`. The comment above `checkTypeOfDomEvents`
names that exact template and both error codes, describing the check as having *"an adverse effect on
developer experience"*, which is an unusually candid thing for a compiler to write about its own
strictness. The right fix is to pass `$event` to a handler that narrows it, keeping the cast in
TypeScript where it is reviewable.

**★ How is a `#ref` variable typed?**
For a DOM node, by generating a `document.createElement` call for that tag and taking its type —
`createElement` is overloaded on `HTMLElementTagNameMap`, so `<div #box>` yields `HTMLDivElement`.
That is `strictDomLocalRefTypes`; with it off the reference is `any`. It explains the confusing shape
of the common error: a reference on the wrong element produces a pure TypeScript complaint about an
`HTMLxxxElement` with no mention of Angular. References to components and directives are typed by a
different field, `checkTypeOfNonDomReferences`, which is hard-coded `true` and has **no flag** — the
source comment explains that non-DOM references were already correctly typed in View Engine, so no
strictness flag was ever introduced for them.

**What does `strictContextGenerics` change, and why is its effect hard to localise?**
It decides whether a component's own type parameters are copied onto the generated type-check
function's signature, or replaced with `any`. Because it changes the function's *signature* rather
than any individual statement, its effect shows up as entire classes of error becoming
inexpressible — a generic list component whose template uses `item.name` cannot report a bad property
when `T` is `any`. That is why two components with identical templates can produce different error
counts, and why the difference does not look like a missing check on any particular line. It also has
no effect at all in an application with no generic components.

**A library's output is typed as `EventEmitter<any>`. Would you turn off `strictOutputEventTypes`?**
No — it is application-wide and would also disable animation event checking, since both ride that
flag. The output is already `any` from the library's own declaration, so the flag is not what is
costing you anything there. Type the handler's parameter explicitly instead, which puts the assertion
in one reviewable place and leaves every other output in the application properly checked.

---

← Prev: [14i · Attributes, literals and safe navigation](14i-attributes-literals-and-safe-navigation.md) · Index: [Topic index](README.md) · Next → [14k · The checks with no switch](14k-the-checks-with-no-switch.md)
