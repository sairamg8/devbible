---
title: "The input-assignment flags decide whether the assignment into a directive's field is generated at all — and `strictInputTypes` secretly drives a second behaviour, template context guards, which is the machinery that makes `@if` narrow a type"
sidebar_label: "14h · The input-assignment flags"
sidebar_position: 14.7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts)
> (every quoted option doc),
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts)
> (`getTypeCheckingConfig`, for the public → internal mapping) —
> [`adev/src/content/reference/configs/angular-compiler-options.md`](https://angular.dev/reference/configs/angular-compiler-options)
> and [angular.dev · Template type checking](https://angular.dev/tools/cli/template-typecheck) for the false-positive classes and the `async` caveat.
> Documentation-validated; **no sandbox run** — every code block is source read from a named file.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Each strictness flag maps to one or more internal fields of `TypeCheckingConfig`, and the internal
field is what actually changes the generated text. Learning the mapping is what makes the flags
predictable rather than a list to try one at a time — and on the input side it exposes two facts
nobody expects. `strictInputTypes` does not only check input assignments; it also switches on
**template context guards**, the machinery that makes `@if (user)` narrow `user` inside the block, so
disabling it as an escape hatch removes narrowing across every template in the application. And
`strictInputAccessModifiers` is `false` even under `strictTemplates`, so binding to a `private` input
is not caught by default — with the option's own documentation linking the tracking issue for
changing that.**

## The composition rule, and why you rarely set these to `true`

The reference page states it, verbatim: > *"Unless otherwise commented, each following option is set
to the value for `strictTemplates` (`true` when `strictTemplates` is `true` and conversely, the other
way around)."*

Since [14f](14f-what-stricttemplates-actually-switches.md) established that `strictTemplates` is
itself `true` by default at v22, the practical consequence is that **you almost never set one of
these to `true`** — they already are. You set one to `false`, deliberately and narrowly, to unblock a
category of error. That is the reverse of how every pre-v22 guide frames them, and it is the frame to
carry into the rest of this page.

⚠️ **The option docs quoted below each say "Defaults to `false`"**. That describes the option in
isolation, not the behaviour you get. Under the composition rule it inherits `strictTemplates`, so at
v22 it is on. Both statements are true and the second is the one that matters.

## `strictInputTypes` — and the second thing it does

The public doc, verbatim:

> *"Whether to check the type of a binding to a directive/component input against the type of the
> field on the directive/component. For example, if this is `false` then the expression
> `[input]="expr"` will have `expr` type-checked, but not the assignment of the resulting type to the
> `input` property of whichever directive or component is receiving the binding. If set to `true`,
> both sides of the assignment are checked. Defaults to `false`."*

The behaviour matches [14e](14e-the-errors-that-never-arrive.md)'s theme exactly: with it off, the
*expression* is still checked — `expr` must exist and be well-typed — but no assignment statement is
generated, so a `string` bound to a `number` input is not an error.

🔴 **But it drives a second internal field, and this is the surprising one.** In
`getTypeCheckingConfig`:

```ts
applyTemplateContextGuards: strictTemplates,
checkTypeOfInputBindings: strictTemplates,
```

`applyTemplateContextGuards` is the machinery behind **type narrowing in templates**. A structural
directive can declare a static type guard describing what is true of the context inside it; that is
how `@if (user)` makes `user` non-null within the block, and how `*ngFor` gives the loop variable the
element type rather than `any`. Turn off input checking and you turn off narrowing with it.

This is not documented on the template-typecheck guide, and it changes the calculus of using
`strictInputTypes: false` as an escape hatch entirely: you are not merely accepting looser input
assignments, you are removing the narrowing your templates depend on, which tends to produce a
*different and larger* set of errors rather than fewer.

## `strictInputAccessModifiers` — off even under strict, on purpose, with an open issue

The public doc, verbatim:

> *"Whether to check if the input binding attempts to assign to a restricted field (readonly,
> private, or protected) on the directive/component. Defaults to `false`, even if "strictTemplates"
> and/or "strictInputTypes" is set. Note that if `strictInputTypes` is not set, or set to `false`,
> this flag has no effect. Tracking issue for enabling this by default:
> https://github.com/angular/angular/issues/38400"*

Three separate facts in one paragraph, all worth having:

1. **It is off even under `strictTemplates`.** The internal field is
   `honorAccessModifiersForInputBindings: false`, hard-coded in the strict branch. So binding to a
   `private` or `readonly` input compiles by default.
2. **It depends on `strictInputTypes`.** With input type checking off there is no assignment
   statement whose target could be checked, so the flag does nothing.
3. **The team intends to change it.** The doc links its own tracking issue, which is unusual, and
   tells you the current default is a compatibility decision rather than a design position.

⚠️ **The practical consequence is a real encapsulation hole.** A component author marking an input
`private` gets no enforcement from the template checker; consumers can bind to it and the build
passes.

## `strictNullInputTypes` — the flag that wraps everything in `!`

The public doc, verbatim:

> *"Whether to use strict null types for input bindings for directives. If this is `true`,
> applications that are compiled with TypeScript's `strictNullChecks` enabled will produce type
> errors for bindings which can evaluate to `undefined` or `null` where the inputs's type does not
> include `undefined` or `null` in its type. If set to `false`, all binding expressions are wrapped
> in a non-null assertion operator to effectively disable strict null checks. Defaults to `false`."*

🔴 **Read the mechanism in that quote: turning it off does not suppress errors, it wraps every binding
expression in `!`.** That is [14e](14e-the-errors-that-never-arrive.md)'s principle stated by the
documentation itself — a flag changes generated text, it does not filter diagnostics. It also gives
you the blast radius precisely: every binding expression, everywhere. Any null-safety property you
believed your templates had is gone, not merely the ones that were erroring.

The guide names the three false-positive classes this flag exists to relieve, verbatim:

> *"When a library's typings are wrong or incomplete (for example, missing `null | undefined` if the
> library was not written with `strictNullChecks` in mind)"*

> *"When a library's input types are too narrow and the library hasn't added appropriate metadata for
> Angular to figure this out. This usually occurs with disabled or other common Boolean inputs used
> as attributes, for example, `<input disabled>`."*

> *"When using `$event.target` for DOM events (because of the possibility of event bubbling,
> `$event.target` in the DOM typings doesn't have the type you might expect)"*

All three are about **someone else's typings**, which is the argument for reaching for the narrower
per-binding escape hatch first. That is the `!` operator in the template, with a caveat the guide
states, verbatim: > *"In the case of the `async` pipe, notice that the expression needs to be wrapped
in parentheses, as in `<user-detail [user]="(user$ | async)!">`"*.

```html
<!-- narrow: one binding, one assertion, and the parentheses are required with async -->
<user-detail [user]="(user$ | async)!" />
```

The remaining flags — the ones about the *shape* of a value rather than the assignment — are
[14i · Attributes, literals and safe navigation](14i-attributes-literals-and-safe-navigation.md).

## Gotchas

**★ Symptom: you set `strictInputTypes: false` to silence input errors and now `@if (user)` no longer
narrows `user`, producing a wave of "possibly null" errors instead.** Cause: the flag drives
`applyTemplateContextGuards` as well as `checkTypeOfInputBindings`, and template context guards are
what make structural directives narrow types. Fix: this is almost never the flag you want. If the
errors are null-related, use the narrower one:

```jsonc
{
  "angularCompilerOptions": {
    // narrows nothing away — only stops the null half of input checking
    "strictNullInputTypes": false
  }
}
```

**★ Symptom: binding to a `private` input compiles, and you expected an error.** Cause:
`strictInputAccessModifiers` maps to `honorAccessModifiersForInputBindings`, hard-coded `false` in
the strict branch — off *even under* `strictTemplates`, as the option's own doc says. Fix: turn it on
explicitly, and note it does nothing unless `strictInputTypes` is also on:

```jsonc
{
  "angularCompilerOptions": {
    "strictInputAccessModifiers": true
  }
}
```

**★ Symptom: you set `strictNullInputTypes: false` for one stubborn library binding and lost null
checking across every template in the app.** Cause: the mechanism is not a filter — the option's own
doc says *"all binding expressions are wrapped in a non-null assertion operator"*. It is global and
total. Fix: revert, and use the per-binding assertion instead, remembering the parenthesis rule for
`async`:

```html
<user-detail [user]="(user$ | async)!" />
```

**★ Symptom: a library upgrade suddenly produces dozens of null errors in templates you did not
touch.** Cause: the library added `strictNullChecks`-aware typings, so inputs that were implicitly
permissive now declare narrower types. This is the first of the three false-positive classes the
guide names, arriving in reverse — the typings got *better*. Fix: fix the call sites. Reaching for
`strictNullInputTypes: false` here trades a correct signal for silence across the whole application.

**★ Symptom: you set `strictInputAccessModifiers: true` and nothing changed.** Cause: the dependency
its doc calls out — with `strictInputTypes` off there is no assignment statement generated, so there
is no target whose access modifier could be checked. Fix: check whether something set
`strictInputTypes: false`, most likely as an escape hatch during an upgrade. The two must both be on.

**Symptom: an error or an issue thread mentions a flag name you cannot find in your `tsconfig`.**
Cause: the internal field name and the public option name differ, and Angular's own tests and issues
use the internal one — `checkTypeOfInputBindings` and `applyTemplateContextGuards` are not settable.
Fix: map back to the public `strict*` name; on this page that is `strictInputTypes` for both.

**Symptom: an input error appears only in one build configuration.** Cause: these are compiler
options read from `angularCompilerOptions`, and a `tsconfig.app.json` / `tsconfig.spec.json` split
means two different sets. Fix: set them once in the base config every target extends.

## Interview questions

**★ `strictTemplates` implies a set of other flags. Name one that drives more than one internal
behaviour, and say what the second behaviour is.**
`strictInputTypes` maps to both `checkTypeOfInputBindings` and `applyTemplateContextGuards`. The
first is the documented behaviour — checking the assignment of a binding's type to the directive
field. The second is template context guards, the machinery that lets a structural directive narrow
types inside its block: it is what makes `@if (user)` produce a non-null `user`, and what gives
`*ngFor`'s loop variable the element type instead of `any`. So turning off input type checking as an
escape hatch also removes narrowing, which usually produces a different and larger set of errors
rather than fewer. This is not on the template-typecheck guide; it is read from
`getTypeCheckingConfig`.

**★ Is binding to a `private` input an error under `strictTemplates`?**
No, and this is deliberate. The flag is `strictInputAccessModifiers`, mapping to
`honorAccessModifiersForInputBindings`, and its own doc says it defaults to `false` *"even if
`strictTemplates` and/or `strictInputTypes` is set"* — with a link to the tracking issue for enabling
it by default, which tells you it is a compatibility decision rather than a design position. It also
has no effect unless `strictInputTypes` is on, because access-modifier checking is a property of the
assignment statement, and with no assignment generated there is nothing to check. So a component
author marking an input `private` gets no enforcement from the template checker today.

**★ What does `strictNullInputTypes: false` actually do to the generated code?**
It wraps *every* binding expression in a non-null assertion — the option's own doc says so: *"all
binding expressions are wrapped in a non-null assertion operator to effectively disable strict null
checks"*. That is the general principle in miniature: flags change generated text rather than
filtering diagnostics. It also means the blast radius is the whole application, not just the bindings
that were erroring, which is why the per-binding `!` is the better tool for the three false-positive
classes the guide names — all of which are about someone else's typings being wrong or narrow rather
than about your code.

**★ A colleague sets `strictInputTypes: false` because a third-party component's inputs are typed
badly. What do you suggest instead?**
Scope it to the actual problem. If the errors are null-related — which they usually are with older
libraries — `strictNullInputTypes: false` is narrower, though still global; the narrowest form is a
per-binding `!` at the call sites, parenthesised when an `async` pipe is involved. Turning off
`strictInputTypes` is the worst option available, because it silently disables template context
guards and every `@if` and `*ngFor` in the application stops narrowing.

**Under `strictTemplates`, which input-side flag is still off, and why does that matter?**
`strictInputAccessModifiers`. Everything else on the input side inherits `strictTemplates` under the
composition rule, while `honorAccessModifiersForInputBindings` is hard-coded `false` in the strict
branch. It matters because it is a genuine encapsulation hole: an input marked `private` or
`readonly` is not protected from template bindings by default, so a component's "internal" inputs are
bindable by any consumer with a passing build.

**Why do the option docs say "Defaults to `false`" for flags that are clearly on?**
Because the doc describes the option in isolation and the composition rule describes the behaviour
you get. Each of these inherits `strictTemplates` unless set explicitly, and `strictTemplates` is
itself `true` by default since v22. Both statements are accurate; reading only the first is how
people conclude that strictness is off when it is not.

---

← Prev: [14g · What turning it off costs](14g-what-turning-strict-templates-off-costs.md) · Index: [Topic index](README.md) · Next → [14i · Attributes, literals and safe navigation](14i-attributes-literals-and-safe-navigation.md)
