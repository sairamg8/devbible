---
title: "Some checks have no flag at all — six run unconditionally under `strictTemplates` and three are hard-coded off with a comment explaining why, including DOM binding checks that are *\"not quite ready yet\"* — so for these the only escape hatches are `$any()` and `!`"
sidebar_label: "14k · The checks with no switch"
sidebar_position: 14.10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts)
> (`getTypeCheckingConfig`, quoted in full with its own comments) —
> and [angular.dev · Template type checking](https://angular.dev/tools/cli/template-typecheck) for the escape hatches.
> Documentation-validated; **no sandbox run** — every code block is source read from a named file.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The strictness flags in [14h](14h-the-input-side-flags.md) through
[14j](14j-the-event-reference-and-generics-flags.md) are the part of the configuration that is
documented. This chunk is the rest of it: the fields of `TypeCheckingConfig` that no public option
maps to. Six of them run unconditionally whenever `strictTemplates` is on, so no amount of
configuration will silence them. Three are hard-coded *off*, which means checks you might reasonably
expect — DOM property bindings, view queries — are simply not performed and cannot be enabled. The
whole thing is legible because the compiler assigns the config in one object literal and comments the
non-obvious entries, so this page is mostly a matter of reading it carefully and knowing what to do
when the answer is "there is no flag".**

## The config object, verbatim

`getTypeCheckingConfig`'s `strictTemplates` branch, read from source — the comments are the
compiler's own:

```ts
typeCheckingConfig = {
  applyTemplateContextGuards: strictTemplates,
  checkQueries: false,
  checkTemplateBodies: true,
  alwaysCheckSchemaInTemplateBodies: true,
  checkTypeOfInputBindings: strictTemplates,
  honorAccessModifiersForInputBindings: false,
  checkControlFlowBodies: true,
  strictNullInputBindings: strictTemplates,
  checkTypeOfAttributes: strictTemplates,
  // Even in full template type-checking mode, DOM binding checks are not quite ready yet.
  checkTypeOfDomBindings: false,
  checkTypeOfOutputEvents: strictTemplates,
  checkTypeOfAnimationEvents: strictTemplates,
  // Checking of DOM events currently has an adverse effect on developer experience,
  // e.g. for `<input (blur)="update($event.target.value)">` enabling this check results in:
  // - error TS2531: Object is possibly 'null'.
  // - error TS2339: Property 'value' does not exist on type 'EventTarget'.
  checkTypeOfDomEvents: strictTemplates,
  checkTypeOfDomReferences: strictTemplates,
  // Non-DOM references have the correct type in View Engine so there is no strictness flag.
  checkTypeOfNonDomReferences: true,
  // Pipes are checked in View Engine so there is no strictness flag.
  checkTypeOfPipes: true,
  strictSafeNavigationTypes: strictTemplates,
  useContextGenericType: strictTemplates,
  strictLiteralTypes: true,
  enableTemplateTypeChecker: this.enableTemplateTypeChecker,
  useInlineTypeConstructors,
  controlFlowPreventingContentProjection:
    this.options.extendedDiagnostics?.defaultCategory || DiagnosticCategoryLabel.Warning,
  unusedStandaloneImports:
    this.options.extendedDiagnostics?.defaultCategory || DiagnosticCategoryLabel.Warning,
  allowSignalsInTwoWayBindings,
  allowDomEventAssertion,
};
```

🔴 **Everything about the flag system is visible in that one literal.** A field set to
`strictTemplates` is a public dial. A field set to a bare `true` or `false` is not — no option
touches it, and the ones the team thought needed justification carry a comment.

## Always on, no flag

Six fields are `true` unconditionally in this branch:

| Field | What it means for you |
|---|---|
| `checkTemplateBodies` | Template contents are checked at all. This is the field [14g](14g-what-turning-strict-templates-off-costs.md) is about — it is unconditional *within* the strict branch and gone entirely in the other one. |
| `alwaysCheckSchemaInTemplateBodies` | Element and attribute names are validated against the DOM schema regardless. This is NG8001 / NG8002, and it is why they survive settings that disable type checks. |
| `checkControlFlowBodies` | The insides of `@if`, `@for`, `@switch` blocks are checked. There is no way to opt a control-flow block out. |
| `checkTypeOfNonDomReferences` | A `#ref` on a directive or component is always typed. The comment gives the reason: *"Non-DOM references have the correct type in View Engine so there is no strictness flag."* |
| `checkTypeOfPipes` | Pipe transforms are always type-checked, with the same historical reason: *"Pipes are checked in View Engine so there is no strictness flag."* |
| `strictLiteralTypes` | Object and array literals get their inferred type — see [14i](14i-attributes-literals-and-safe-navigation.md), where the public option's name misleadingly suggests it is a dial. |

⚠️ **Two of these have "no flag because View Engine already did it" as their stated reason.** That is
worth reading as a general principle: the strictness flags exist to stage the migration from View
Engine's checking to Ivy's, so anything View Engine already got right needed no opt-in. A flag's
existence tells you something was *new*, not that it is optional in principle.

## Always off, no flag

Three fields are `false` and cannot be turned on:

- **`checkTypeOfDomBindings`**, with the comment: > *"Even in full template type-checking mode, DOM
  binding checks are not quite ready yet."* This is the single biggest hole in template type checking
  and [14e](14e-the-errors-that-never-arrive.md) is built around it — `[value]="someNumber"` on a
  plain `<input>` checks the expression and never the assignment. There is no configuration that
  changes this.
- **`checkQueries`** — `@ViewChild`, `@ContentChild` and their `viewChild()` / `contentChild()`
  successors are not type-checked against what the template actually contains. A query declared as
  returning one component while the template holds another is not a build error.
- **`honorAccessModifiersForInputBindings`** — covered in [14h](14h-the-input-side-flags.md); it does
  have a public option, but that option is hard-coded off in the strict branch, so it belongs in this
  group in practice.

🔴 **The useful mental model: template type checking is thorough about directives and thin about the
DOM.** Everything that passes through a directive's declared inputs and outputs is well checked;
everything that lands on a raw element gets its expression checked and its name validated against a
schema, and nothing more. Knowing which side of that line a binding is on predicts whether you will
get an error better than any flag does.

## The four fields that are not booleans

Also in the literal, and worth naming so they do not look like strictness dials:

- **`enableTemplateTypeChecker`** — an internal switch for the language service's use of the checker,
  not a user option.
- **`useInlineTypeConstructors`** — `programDriver.supportsInlineOperations`, per
  [14c](14c-the-type-check-file-and-how-errors-get-home.md). A capability of the host tool.
- **`controlFlowPreventingContentProjection`** and **`unusedStandaloneImports`** — these take a
  *diagnostic category*, not a boolean, defaulting to `DiagnosticCategoryLabel.Warning`. They are
  extended diagnostics that happen to be configured through this object, which is why they are
  affected by `extendedDiagnostics.defaultCategory`. That family is **15 · Extended diagnostics**
  *(not written yet)*.

## The escape hatches for checks you cannot turn off

When there is no flag, there are two per-expression tools, both from the guide.

**`$any()`**, verbatim: > *"Disable checking of a binding expression by surrounding the expression in a
call to the `$any()` cast pseudo-function. The compiler treats it as a cast to the `any` type just
like in TypeScript when a `<any>` or `as any` cast is used."*

**The non-null assertion**, verbatim: > *"In the template, include the non-null assertion operator `!`
at the end of a nullable expression"* — with the caveat that matters in practice, also verbatim:
> *"In the case of the `async` pipe, notice that the expression needs to be wrapped in parentheses, as
> in `<user-detail [user]="(user$ | async)!">`"*

```html
<!-- $any: a total cast, and the widest possible hammer -->
<app-chart [series]="$any(rawData)" />

<!-- ! : narrow, and the parentheses are mandatory with async -->
<user-detail [user]="(user$ | async)!" />
```

⚠️ **Prefer `!` to `$any()` wherever the problem is nullability**, because `$any()` discards the
entire type and takes every unrelated error in that expression with it. And prefer fixing the
declaration to either, since both are assertions you are making on the compiler's behalf with nothing
checking them.

## Gotchas

**★ Symptom: `[value]="someNumber"` on a plain `<input>` is not an error and no flag makes it one.**
Cause: `checkTypeOfDomBindings` is hard-coded `false` with the comment *"DOM binding checks are not
quite ready yet"*. Fix: there is no configuration for it. Get the guarantee in the class instead,
where ordinary TypeScript applies:

```ts
export class SearchBox {
  count = 0;
  protected get countText(): string {
    return String(this.count); // checked by tsc, in ordinary source
  }
}
```

**★ Symptom: a `@ViewChild` declares one type and the template contains another, and the build
passes.** Cause: `checkQueries: false`, with no public option. Queries are not checked against what
the template actually holds. Fix: nothing at build time — this is a genuine gap, so treat query types
as assertions and cover them with a test rather than trusting the compiler.

**★ Symptom: you set every strictness flag to `false` and NG8001 still fires.** Cause:
`alwaysCheckSchemaInTemplateBodies` is unconditional in the strict branch, and schema validation is a
different mechanism from type checking, per [14e](14e-the-errors-that-never-arrive.md). Fix: NG8001
means an unknown element — either import the component that declares the selector, or add
`CUSTOM_ELEMENTS_SCHEMA` if it is genuinely a custom element. No flag applies.

**★ Symptom: you want a pipe's transform to stop being type-checked and cannot find the flag.**
Cause: `checkTypeOfPipes: true` unconditionally — *"Pipes are checked in View Engine so there is no
strictness flag."* Fix: `$any()` around the piped expression is the only lever, and fixing the pipe's
declared signature is better:

```html
<p>{{ $any(value) | customFormat }}</p>
```

**★ Symptom: `$any()` silenced your error and also silenced three you wanted.** Cause: it is a cast to
`any` over the whole expression it wraps, so everything inside it stops being checked. Fix: shrink the
scope to the sub-expression that is actually the problem, or use `!` if the issue was nullability:

```html
<!-- before: the whole expression is any -->
<app-row [data]="$any(user.profile.settings)" />
<!-- after: only the nullable step is asserted -->
<app-row [data]="user.profile!.settings" />
```

**★ Symptom: `(user$ | async)!` works but `user$ | async!` does not.** Cause: precedence — without
parentheses the `!` binds to the pipe's argument rather than to the result of the pipe. The guide
calls this out specifically for `async`. Fix: always parenthesise a piped expression before asserting
on it.

**★ Symptom: a control-flow block's contents are checked and you wanted them skipped during a
migration.** Cause: `checkControlFlowBodies: true` unconditionally. Fix: no flag exists. If the
contents genuinely cannot be fixed yet, the only lever is per-expression `$any()` inside the block —
which is a strong hint that the block should be extracted into its own component and fixed properly.

**Symptom: an option you found in an issue thread does not work in `tsconfig`.** Cause: you are
probably reading an internal `TypeCheckingConfig` field name. Only the fields assigned from
`strictTemplates` or from `this.options.*` have public options behind them. Fix: check whether the
name appears in the compiler-options reference; if not, it is internal and there is nothing to set.

**Symptom: `unusedStandaloneImports` behaves like a warning rather than an error and no strictness
flag changes it.** Cause: it is not a boolean in this config — it takes a diagnostic *category*,
defaulting to `DiagnosticCategoryLabel.Warning`, and is configured through `extendedDiagnostics`
rather than through the strictness flags. Fix: set it under `extendedDiagnostics.checks`, not
alongside the `strict*` options.

## Interview questions

**★ Which template checks cannot be turned off, and why does that matter?**
Six fields are unconditionally `true` under `strictTemplates`: `checkTemplateBodies`,
`alwaysCheckSchemaInTemplateBodies`, `checkControlFlowBodies`, `checkTypeOfNonDomReferences`,
`checkTypeOfPipes` and `strictLiteralTypes`. It matters because when one of those produces an error
there is no configuration answer — the only tools left are `$any()`, the non-null assertion, or
fixing the code. Two of them have a documented reason for having no flag: pipes and non-DOM
references were already correctly checked in View Engine, so no opt-in was ever needed. That reveals
what the flag system is for — it stages a migration, so a flag's existence tells you the check was
*new*, not that it is optional in principle.

**★ Are DOM property bindings type-checked?**
No, and it cannot be enabled. `checkTypeOfDomBindings` is hard-coded `false` with the comment *"Even
in full template type-checking mode, DOM binding checks are not quite ready yet."* So
`[value]="someNumber"` on a plain `<input>` type-checks `someNumber` as an expression and never
checks the assignment against `HTMLInputElement.value`. This is the largest hole in template type
checking and the main reason a visibly wrong template can produce a green build. The useful model is
that checking is thorough about directives and thin about the DOM: anything passing through a
directive's declared inputs and outputs is well checked, anything landing on a raw element gets its
expression checked and its name schema-validated, and nothing more.

**★ Are `@ViewChild` and `@ContentChild` queries type-checked against the template?**
No — `checkQueries: false`, with no public option to change it. A query declared as returning one
component type while the template contains another is not a build error. It is worth knowing because
queries *look* like exactly the sort of thing template type checking would cover, and treating their
declared types as verified is a common wrong assumption. Cover them with a test instead.

**★ What are the escape hatches when a check has no flag, and when do you use each?**
`$any()`, which the guide describes as equivalent to an `as any` cast, and the non-null assertion `!`.
Prefer `!` whenever the problem is nullability, because `$any()` discards the entire type of the
expression it wraps and takes every unrelated error inside it along too. With `!` there is a
precedence trap the guide calls out explicitly: a piped expression must be parenthesised first, as in
`[user]="(user$ | async)!"`, or the assertion binds to the pipe's argument rather than its result.
Both are assertions nothing verifies, so fixing the declaration beats either.

**How can you tell, from the source, whether a given check has a public option?**
Read the one object literal `getTypeCheckingConfig` assigns. A field set to the local
`strictTemplates` variable is a public dial that inherits the composition rule; a field set to a bare
`true` or `false` has no option behind it; and a field set from `this.options.something` has its own
independent option. The entries the team considered non-obvious carry a comment giving the reason,
which is how you learn that DOM binding checks are unfinished rather than deliberately absent.

**Why do `controlFlowPreventingContentProjection` and `unusedStandaloneImports` sit in the
type-checking config at all?**
Because they are computed during template type checking even though they are extended diagnostics
rather than type checks. The tell is that they are not booleans — they take a
`DiagnosticCategoryLabel`, defaulting to `Warning`, sourced from `extendedDiagnostics.defaultCategory`.
So they are configured through the extended-diagnostics surface rather than the strictness flags, and
looking for a `strict*` option to control them is a dead end.

---

← Prev: [14j · The event, reference and generics flags](14j-the-event-reference-and-generics-flags.md) · Index: [Topic index](README.md) · Next → **15 · Extended diagnostics** *(not written yet)*
