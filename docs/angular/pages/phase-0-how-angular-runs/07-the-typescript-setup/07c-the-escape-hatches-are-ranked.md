---
title: "angular.dev lists three escape hatches in a specific order and that order is the advice, not a menu — `$any()` costs one expression, a strictness flag costs one check, and `strictTemplates: false` costs every check plus the extended diagnostics, and the middle rung works only because every flag is applied on top of the strictTemplates baseline"
sidebar_label: "07c · The escape hatches are ranked"
sidebar_position: 7.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — angular.dev
> [Template type checking](https://angular.dev/tools/cli/template-typecheck) (the three hatches and
> the `$any()` description, quoted verbatim and in their published order) — and `angular/angular` at
> tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts)
> (the `strictTemplates` getter and the override block that applies individual flags, both quoted with
> their own comments).
> Documentation-validated; **no sandbox run** — no build was executed and no diagnostic was captured
> from a terminal.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The three ways out of a template type error are documented together, in one list, in one order — and
the order is blast radius, ascending. Treating that list as a menu instead of a ladder is how a project
ends up with `strictTemplates: false` because of one `$event.target`.** This page is the ladder, the
mechanism that makes the middle rung possible at all, and the placement rule that decides which
tsconfig the opt-out goes in — because putting it in the wrong one silences the build and leaves the
tests failing.

[07](07-what-stricttemplates-rejects.md) and [07b](07b-the-dollar-event-target-rejection.md) are the
two dominant rejection classes; [07d](07d-the-other-rejection-classes.md) is the rest.

## The three, verbatim, in the published order

From [Template type checking](https://angular.dev/tools/cli/template-typecheck):

> 1. *"Use the `$any()` type-cast function in certain contexts to opt out of type-checking for a part
>    of the expression"*
> 2. *"Disable certain type-checking operations individually, while maintaining strictness in other
>    aspects, by setting a strictness flag to `false`"*
> 3. *"Disable strict checks entirely by setting `strictTemplates: false` in the application's
>    TypeScript configuration file, `tsconfig.json`"*

| Rung | What it disables | Where it is written | Who can see it in review |
|---|---|---|---|
| `$any(expr)` | every check, for **one expression** | the template, at the call site | anyone reading the diff |
| `expr!` | nullability only, for **one expression** | the template, at the call site | anyone reading the diff, if they notice one character |
| a strictness flag → `false` | **one check**, in every template compiled through that config | `angularCompilerOptions` | anyone reading the tsconfig — one line, one decision |
| `strictTemplates: false` | **every** check in the set, and the extended diagnostics with it | `angularCompilerOptions` | one line, and it is catastrophic |

🔴 **The bottom row is not a bigger version of the row above it.** It is a different kind of change:
`checkTemplateBodies` goes off, so the contents of `@if` and `@for` bodies stop being checked at all,
and `extendedDiagnostics` becomes a **configuration error** rather than a setting — a project that had
extended diagnostics configured stops building until that block is deleted too.
[14g](../01-compiler-with-a-framework-attached/14g-what-turning-strict-templates-off-costs.md) has the
full accounting.

## Rung 1 — `$any()`, and where the parentheses go

angular.dev's own description, verbatim:

> *"Disable checking of a binding expression by surrounding the expression in a call to the `$any()`
> cast pseudo-function. The compiler treats it as a cast to the `any` type just like in TypeScript
> when a `<any>` or `as any` cast is used."*

with the documented example `{{$any(person).address.street}}`.

⚠️ **Note where the parentheses sit in that example.** The cast is applied to `person`, not to the
whole chain — so `address` and `street` are read off an `any`, but the *expression* has not been
wrapped and any surrounding call is still checked. That placement is the whole technique:

```html
<!-- too wide: the argument, the method name and the result are all unchecked -->
<p>{{ $any(person.address.street.name) }}</p>

<!-- narrow: only the hop that needed it is uncast -->
<p>{{ $any(person).address.street.name }}</p>
```

`$any` is a **pseudo-function**: it belongs to the template expression language, not to TypeScript.
There is nothing to import and no `$any` to call from a component class — write `as any` there
instead, where at least the cast is in a file that gets reviewed.

## Rung 1b — `!`, which is narrower still and worse

The non-null assertion disables exactly one thing — the nullability of one expression — so on the
blast-radius axis it sits below `$any()`. On the *reviewability* axis it sits below everything: it is
one character in a string, and unlike `$any()` it does not even look like a cast. Prefer `!` to
`$any()` when the problem is genuinely nullability, and prefer fixing the declaration to either.
[07](07-what-stricttemplates-rejects.md) covers what it costs at runtime.

## Rung 2 — why an individual flag can beat `strictTemplates`

This rung exists because of one block in `compiler.ts`, applied immediately after the strict/non-strict
branch that `strictTemplates` selects. Its own comment states the design:

```ts
    // Apply explicitly configured strictness flags on top of the default configuration
    // based on "strictTemplates".
    if (this.options.strictInputTypes !== undefined) {
      typeCheckingConfig.checkTypeOfInputBindings = this.options.strictInputTypes;
      typeCheckingConfig.applyTemplateContextGuards = this.options.strictInputTypes;
    }
    if (this.options.strictNullInputTypes !== undefined) {
      typeCheckingConfig.strictNullInputBindings = this.options.strictNullInputTypes;
    }
    if (this.options.strictDomEventTypes !== undefined) {
      typeCheckingConfig.checkTypeOfDomEvents = this.options.strictDomEventTypes;
    }
```

(Ten such blocks exist, one per public flag; three are shown. The block in full, the two flags that
each drive two internal entries, and the public → internal name mismatches are
[06c](06c-the-override-layer.md); what the baseline itself contains is
[06](06-what-stricttemplates-switches-on.md) and [06b](06b-the-two-branches.md); the complete
per-flag treatment is
[14h](../01-compiler-with-a-framework-attached/14h-the-input-side-flags.md) through
[14j](../01-compiler-with-a-framework-attached/14j-the-event-reference-and-generics-flags.md).)

🔴 **The guard is `!== undefined`, uniformly.** So it is the *presence of the key* that matters, and
`false` is a real, honoured value that overrides the baseline `strictTemplates` established. That is
the mechanism behind angular.dev's *"while maintaining strictness in other aspects"* — the flags are
not alternatives to `strictTemplates`, they are corrections applied after it.

⚠️ **The guard for `strictTemplates` itself is different, and the difference is load-bearing:**

```ts
  /**
   * strictTemplate is `true` by default.
   * Explicit opt-out is required to disable strictness
   */
  private get strictTemplates(): boolean {
    return this.options.strictTemplates !== false;
  }
```

`!== false`, not `?? true`. `undefined`, `null`, `0` and `""` all resolve to **strict**. Only the
literal boolean `false` opts out. So `"strictTemplates": null` in a tsconfig does nothing at all, and
the doc comment says why in one sentence: *"Explicit opt-out is required to disable strictness"*.

## Gotchas

**★ Symptom: `$any()` did not silence the error.** Cause: `$any()` casts an **expression**. It cannot
help when the complaint is about the *assignment target* — a `private` or `readonly` input, a required
input that is missing, an input that does not exist on the directive at all. Fix: find the flag the
error actually belongs to. If it is access modifiers the setting is `strictInputAccessModifiers`, and
[14h](../01-compiler-with-a-framework-attached/14h-the-input-side-flags.md) maps each public flag to
the internal behaviour it drives.

**★ Symptom: `"strictTemplates": null` did not disable anything.** Cause: the getter is
`this.options.strictTemplates !== false`. Only the literal boolean `false` opts out; every other value,
`null` included, resolves to strict. Fix: write `false`, or delete the key to get the default.

**★ Symptom: `strictTemplates: false` went in and now the build fails with a message about
`extendedDiagnostics`.** Cause: a compatibility check — configuring `extendedDiagnostics` while
`strictTemplates` is explicitly `false` is a configuration error, not a silent no-op. Fix: the error
message names both remedies; pick one. The full text, the code, and the reason the check tests
`=== false` specifically are in
[15d](../01-compiler-with-a-framework-attached/15d-configuring-extended-diagnostics.md) and
[08b](08b-the-options-you-add-yourself.md).

**★ Symptom: you set `strictInputTypes: false` to silence input errors and `@if (user) { … }` stopped
narrowing.** Cause: that one option sets **two** internal fields — `checkTypeOfInputBindings` *and*
`applyTemplateContextGuards`, which is the machinery structural directives use to narrow a type inside
their body. Fix: there is no narrower flag; do not use this one to silence assignability errors. Use
`$any()` at the offending call sites, or fix the types.
[14h](../01-compiler-with-a-framework-attached/14h-the-input-side-flags.md) has the full mapping.

**Symptom: `$any` is not defined in a component class.** Cause: it is a template pseudo-function, part
of the template expression language, not a TypeScript symbol. There is nothing to import. Fix: in
TypeScript, write `as any` — where the cast is at least in a file the team reviews and lints.

**Symptom: setting a strictness flag to `true` explicitly changed nothing.** Cause: it was already on,
because `strictTemplates` supplied it. The override block honours the key either way, so writing
`true` is a no-op unless something upstream set it to `false`. Fix: nothing is broken — but note that
`strictInputAccessModifiers: true` is the exception, because `strictTemplates` does **not** imply it and
writing `true` is the only way to get it.

**Symptom: `$any()` around a piped expression did not help.** Cause: precedence. `$any(user$ | async)`
casts the *result*, which is usually what you want; `$any(user$) | async` casts the observable and
leaves the pipe to complain about it. Fix: cast the result, and prefer `@if (user$ | async; as user)`
to either — it narrows instead of asserting.

## Interview questions

**★ Why does the documentation list `$any()` before `strictTemplates: false`, and does the order
matter?**
The order is blast radius and it *is* the advice. `$any()` disables checking for one expression in one
template. A strictness flag disables one check for every file compiled through that config.
`strictTemplates: false` disables every check in the set — and it also makes `extendedDiagnostics` a
configuration error rather than a setting, so a project that had extended diagnostics configured stops
building until that block is deleted too. Escalating one rung at a time is the difference between an
opt-out you can point at in review and one nobody can reason about six months later.

**★ `strictTemplates` is documented as implying all the other strictness flags. How can setting one of
them to `false` possibly win?**
Because the flags are not alternatives to `strictTemplates`, they are corrections applied after it. The
compiler first selects a whole `TypeCheckingConfig` object from the strict or non-strict branch, then
runs a block of ten guards whose own comment reads *"Apply explicitly configured strictness flags on
top of the default configuration based on `strictTemplates`."* Each guard tests `!== undefined`, so the
mere presence of the key overrides the baseline and `false` is honoured. That is exactly the mechanism
angular.dev is describing when it says you can disable operations individually *"while maintaining
strictness in other aspects"*.

**★ Why is the check on `strictTemplates` written `!== false` rather than `?? true`?**
So that only an explicit boolean `false` opts out. Under `!== false`, `undefined`, `null` and any other
value keep strictness on; the source comment states the intent directly — *"Explicit opt-out is
required to disable strictness"*. It closes the class of mistake where someone writes a falsy-looking
value, or removes the value but leaves the key, and expects the feature off. Note the individual
strictness flags use a *different* idiom, `!== undefined`, because for those the presence of the key is
the signal and `false` is a meaningful value.

**When is a config-level opt-out actually better than a per-expression one?**
When the class is large, uniform, and you have decided not to fix it. Thirty `$any($event.target)` casts
scattered through templates are thirty unreviewable local decisions that will be copied by everyone who
greps the codebase for an example; one `strictDomEventTypes: false` in the root tsconfig is a single
decision, in one commit, with a reason in the message, that a future team can reverse by deleting a
line. The per-expression hatch is right for the exception; the flag is right for the policy. What is
never right is using the flag for a problem that occurs twice.

---

← Prev: [The $event.target rejection](07b-the-dollar-event-target-rejection.md) · Index: [Topic index](README.md) · Next → [The other rejection classes](07d-the-other-rejection-classes.md)
