---
title: "Three flags about the shape of a value rather than an assignment — why `<input matInput disabled>` is a genuine type error, why an object literal in a template can be `any`, and why `a?.b` is typed as a ternary"
sidebar_label: "14i · Attributes, literals, safe nav"
sidebar_position: 14.8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts)
> (every quoted option doc),
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts)
> (`getTypeCheckingConfig`) —
> [angular.dev · Template type checking](https://angular.dev/tools/cli/template-typecheck) for the deprecation of input setter coercion,
> and [`goldens/public-api/compiler-cli/error_code.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/compiler-cli/error_code.api.md).
> Documentation-validated; **no sandbox run** — every code block is source read from a named file.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[14h](14h-the-input-side-flags.md) covered the flags that decide whether an assignment into a
directive's field is generated. The three here are different in kind: they decide what *type* a value
has before any assignment is considered. One of them produces the single most-reported "the compiler
is wrong" error in Angular — `<input matInput disabled>` failing because a valueless HTML attribute is
the empty string and not `true` — and it is not wrong. One decides whether an object literal written
in a template is checked at all or is simply `any`. And one gives `a?.b` a precise type expressed as
a ternary, in a version where what `?.` produces on short-circuit has itself just changed.**

## `strictAttributeTypes` — why `<input matInput disabled>` errors

The public doc, verbatim:

> *"Whether to check text attributes that happen to be consumed by a directive or component. For
> example, in a template containing `<input matInput disabled>` the `disabled` attribute ends up
> being consumed as an input with type `boolean` by the `matInput` directive. At runtime, the input
> will be set to the attribute's string value, which is an empty string for attributes without a
> value, so with this flag set to `true`, an error would be reported."*

The mechanism is worth stating plainly, because it looks like a compiler bug the first time you meet
it. **A valueless HTML attribute is the empty string, not `true`.** A directive declaring
`disabled: boolean` and receiving `""` is a genuine type mismatch that has always existed at runtime
and was simply never reported. The flag did not create the bug; it made it visible.

🔴 **The distinction that matters: this is about a *text attribute*, not a property binding.**
`disabled` with no brackets is an attribute whose value is a string. `[disabled]="true"` is a
property binding whose value is a boolean expression. Only the first goes through this flag, which is
why adding brackets is sometimes offered as a "fix" — it is really a different thing that happens not
to trip the same check.

**The supported fix is `transform`, and the old one is deprecated.** Angular's guide says so,
verbatim: > *"Since TypeScript 4.3, the setter could have been declared to accept `boolean|''` as
type, making the input setter coercion field obsolete. As such, input setters coercion fields have
been deprecated."*

```ts
// modern: declare the coercion where the input is declared
import {booleanAttribute, input} from '@angular/core';

export class FancyInput {
  readonly disabled = input(false, {transform: booleanAttribute});
}
```

⚠️ `ngAcceptInputType_` is the form you will still meet in older libraries. Recognise it; do not write
it. A library declaring both a `transform` and an `ngAcceptInputType_` for the same input produces
NG2020 `CONFLICTING_INPUT_TRANSFORM`.

## `strictLiteralTypes` — and the reason it is in a different group

The public doc, verbatim: > *"Whether object or array literals defined in templates use their inferred
type, or are interpreted as `any`. Defaults to `false` unless `strictTemplates` is set."*

🔴 **The internal field is set unconditionally in the strict branch**, not merely inherited:

```ts
strictLiteralTypes: true,
```

So it is in the always-on group whenever `strictTemplates` is on, rather than being one of the dials
you can turn down independently. That is a meaningful difference from every flag in
[14h](14h-the-input-side-flags.md): setting `strictLiteralTypes: false` while `strictTemplates` is on
does not do what the option name implies.

With it off, `[config]="{ retries: 3 }"` passes `any` and nothing about the object's shape is
checked — a misspelled key sails through. With it on, the literal gets its inferred type and is
checked against the input like any other value.

**The practical consequence is a reason to prefer literals in templates less than you might.** A
literal written in a template is re-created on every change detection cycle — [08](08-instructions-not-a-virtual-dom.md)
covers why that matters for the identity check — and it is now also type-checked at a place where the
error message has further to travel. A named member on the class is cheaper on both counts:

```ts
export class RetryPanel {
  // one object, one identity, and an error here points at the class
  protected readonly config = {retries: 3} as const;
}
```

## `strictSafeNavigationTypes` — a ternary, precisely

The public doc, verbatim:

> *"Whether to use a strict type for null-safe navigation operations. If this is `false`, then the
> return type of `a?.b` or `a?()` will be `any`. If set to `true`, then the return type of `a?.b` for
> example will be the same as the type of the ternary expression `a != null ? a.b : a`."*

That ternary is the exact semantics, and it repays reading closely. The `else` branch is `a`, not
`null` — so the resulting type is `T | typeof a-when-nullish`, which is how the short-circuit value
enters the type.

⚠️ **This interacts with a v22 change, and the interaction is easy to miss.**
[05](05-expressions-statements-and-safe-navigation.md) covers it: in v22, an Angular expression using
optional chaining returns `undefined` on short-circuit rather than `null`. So the union this flag
produces differs from what the same template produced on v21, independently of the flag itself. If
you are reading an older answer about safe-navigation types in Angular, that is a second reason it
may not match what you see.

With the flag off, all of this collapses to `any`, which is worth naming as a hazard rather than a
convenience: an `any` at the head of a chain swallows every error further down it.

## The mapping, in one table

Both pages' flags together, since the mapping is what you actually come back for:

| public option | internal field(s) | what turning it off changes |
|---|---|---|
| `strictInputTypes` | `checkTypeOfInputBindings` **and** `applyTemplateContextGuards` | no assignment into the directive field — **and no template narrowing** |
| `strictInputAccessModifiers` | `honorAccessModifiersForInputBindings` | already off by default; no check that the target field is public |
| `strictNullInputTypes` | `strictNullInputBindings` | every binding expression is wrapped in `!` |
| `strictAttributeTypes` | `checkTypeOfAttributes` | text attributes consumed as inputs are not checked |
| `strictLiteralTypes` | `strictLiteralTypes` (unconditional under strict) | object and array literals in templates become `any` |
| `strictSafeNavigationTypes` | `strictSafeNavigationTypes` | `a?.b` is typed `any` instead of `a != null ? a.b : a` |

The event, reference and generics flags are **14j · The event, reference and generics flags** *(not
written yet)*; the checks with no public flag at all are **14k · The checks with no switch** *(not
written yet)*.

## Gotchas

**★ Symptom: `<input matInput disabled>` errors with a string not assignable to boolean.** Cause: a
valueless HTML attribute is the empty string, and `strictAttributeTypes` makes the compiler check
that attribute value against the input's declared type. The mismatch is real and predates the check.
Fix: declare the coercion on the input, which is the supported modern form:

```ts
import {booleanAttribute, input} from '@angular/core';

export class FancyInput {
  readonly disabled = input(false, {transform: booleanAttribute});
}
```

**★ Symptom: adding brackets — `[disabled]="true"` — makes the error go away and you are not sure
why.** Cause: you changed the construct, not the setting. A bracketed binding is a property binding
carrying a boolean expression; a bare `disabled` is a text attribute carrying `""`. Only the latter
goes through `strictAttributeTypes`. Fix: this is a legitimate change if a property binding is what
you meant, but it is not a fix for a library whose input genuinely cannot accept `""` — that needs
the `transform`.

**★ Symptom: a library declares both `transform` and `ngAcceptInputType_` and you get NG2020.**
Cause: `CONFLICTING_INPUT_TRANSFORM` — two coercion mechanisms for the same input, one of them
deprecated. Fix: nothing to fix locally; it is a library bug. The deprecation reasoning is that since
TypeScript 4.3 a setter can simply accept `boolean | ''`, which makes the coercion field obsolete.

**★ Symptom: `[config]="{ retries: 3 }"` accepts a misspelled key without complaint.** Cause:
`strictLiteralTypes` is off, so object and array literals in templates are `any`. Fix: it is on by
default at v22 and set unconditionally under `strictTemplates`, so if you are seeing this, something
set `strictTemplates: false` — check the base `tsconfig` rather than assuming the literal is
unusual.

**★ Symptom: you set `strictLiteralTypes: false` and literals are still checked.** Cause: unlike the
input-side flags, this one is assigned unconditionally in the strict branch rather than inheriting
`strictTemplates`. Setting it to `false` while strictness is on does not turn it off. Fix: if you
genuinely need literals unchecked, the only lever is `strictTemplates: false` — and
[14g](14g-what-turning-strict-templates-off-costs.md) explains why that is a bad trade. Move the
literal to the class instead.

**★ Symptom: `a?.b` is typed `any` and swallows an error further down the expression.** Cause:
`strictSafeNavigationTypes` is off, which makes the whole chain `any` from that point. Fix: turn it
on — but note the v22 change that `?.` yields `undefined` rather than `null` on short-circuit, per
[05](05-expressions-statements-and-safe-navigation.md), so the resulting union may not match what an
older codebase or an older answer expected.

**Symptom: the same safe-navigation expression types differently after upgrading to v22, with the
flag unchanged.** Cause: not this flag. The short-circuit value changed from `null` to `undefined` at
v22, so the `a != null ? a.b : a` ternary the flag describes now has a different `else` type. Fix:
widen the receiving type to include `undefined`, or handle it — this is a real semantic change, not a
type-checking artefact.

**Symptom: an object literal in a template causes a re-render every cycle as well as a type error.**
Cause: two separate consequences of the same habit. A literal is a fresh object each evaluation, so
the identity check in [07e](07e-what-actually-performs-the-diff.md) always sees a change. Fix: hoist
it to a class member, which fixes both the identity churn and the error's distance from its cause.

## Interview questions

**★ Why does `<input matInput disabled>` produce a type error, and what is the modern fix?**
Because a valueless HTML attribute is the empty string, not `true`, and `strictAttributeTypes` makes
the compiler check that attribute value against the type the directive declares for the input — a
`boolean` receiving `""`. The mismatch is real and predates the check; the flag made a long-standing
runtime discrepancy visible. The modern fix is a `transform` on the input declaration, typically
`booleanAttribute`. The old fix was an `ngAcceptInputType_` coercion field, which Angular deprecated
on the grounds that since TypeScript 4.3 the setter could simply accept `boolean | ''`. You will
still meet it in older libraries, and a library declaring both produces NG2020
`CONFLICTING_INPUT_TRANSFORM`.

**★ How is `strictLiteralTypes` different from the other strictness flags?**
It is assigned unconditionally in the strict branch rather than inheriting `strictTemplates` like the
input-side flags do. So under `strictTemplates` it is on and setting it to `false` does not turn it
off — it behaves as part of the always-on group. That makes it a poor escape hatch: if template
literals are producing errors you cannot fix, the only configuration lever is `strictTemplates:
false`, which costs template body checking and extended diagnostics. Moving the literal onto the class
is the better answer, and it fixes the change-detection identity problem at the same time.

**★ What type does `a?.b` have, exactly?**
With `strictSafeNavigationTypes` on, the same type as the ternary `a != null ? a.b : a` — note that
the `else` branch is `a` itself, not `null`, which is how the short-circuit value enters the union.
With the flag off it is `any`, which is worth avoiding because an `any` at the head of a chain
swallows every error further down it. There is a v22 wrinkle: optional chaining in an Angular
expression now yields `undefined` on short-circuit rather than `null`, so the union differs from what
the same template produced on v21 with the same flag setting.

**Someone says the Angular compiler is wrong to reject `<input matInput disabled>`. Are they right?**
No, and the interesting part is why the intuition is so strong. In HTML, a valueless boolean attribute
means "true" to a human reader and to the browser's own semantics for native attributes. But an
Angular directive input is not a native attribute — the string `""` is what actually gets assigned to
the field at runtime, so a directive declaring `disabled: boolean` really does receive a value of the
wrong type. The check is reporting a genuine discrepancy that existed before anyone turned it on. The
resolution is to declare the coercion the directive was implicitly relying on.

**Why prefer a class member over an object literal in a template, beyond type checking?**
Because a literal is constructed fresh on every evaluation, so the identity check that drives change
detection sees a new value every cycle regardless of content. Hoisting it to a class member gives one
stable identity and, incidentally, moves any type error to the declaration where it is easier to
read. The type-checking flag and the change-detection behaviour are unrelated mechanisms that happen
to push in the same direction.

---

← Prev: [14h · The input-assignment flags](14h-the-input-side-flags.md) · Index: [Topic index](README.md) · Next → [14j · The event, reference and generics flags](14j-the-event-reference-and-generics-flags.md)
