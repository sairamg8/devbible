---
title: "Layer 1 is a single `if/else` that builds a complete internal type-checking configuration, and the five entries in its strict branch that are *not* `strictTemplates` are the whole lesson — two are hard-coded on, two hard-coded off, and one is a documented carve-out"
sidebar_label: "06b · The two branches"
sidebar_position: 6.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts)
> (`getTypeCheckingConfig`), read through the GitHub contents API at that tag; and
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`strictTemplates` does not toggle a dozen booleans; it selects one of two complete internal
configurations, written out entry by entry in a single `if/else`.** Most entries in the strict
branch are literally the variable `strictTemplates`, which is why the option reads as a master
switch. The interesting ones are the five that are not — two hard-coded `true`, two hard-coded
`false`, and one carve-out — plus two entries that are decided by the version of `@angular/core` in
your program rather than by anything in your tsconfig. 🔴 Those seven entries are the answer to
every *"I turned `strictTemplates` on/off and this check did not change"* question.

## The strict branch, verbatim

From `getTypeCheckingConfig()` in
[`compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts)
at `v22.1.5`, source comments included:

```ts
    let typeCheckingConfig: TypeCheckingConfig;
    if (strictTemplates) {
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
    } else {
```

## The non-strict branch, for contrast

```ts
      typeCheckingConfig = {
        applyTemplateContextGuards: false,
        checkQueries: false,
        checkTemplateBodies: false,
        checkControlFlowBodies: false,
        // Enable deep schema checking in "basic" template type-checking mode only if Closure
        // compilation is requested, which is a good proxy for "only in google3".
        alwaysCheckSchemaInTemplateBodies: this.closureCompilerEnabled,
        checkTypeOfInputBindings: false,
        strictNullInputBindings: false,
        honorAccessModifiersForInputBindings: false,
        checkTypeOfAttributes: false,
        checkTypeOfDomBindings: false,
        checkTypeOfOutputEvents: false,
        checkTypeOfAnimationEvents: false,
        checkTypeOfDomEvents: false,
        checkTypeOfDomReferences: false,
        checkTypeOfNonDomReferences: false,
        checkTypeOfPipes: false,
        strictSafeNavigationTypes: false,
        useContextGenericType: false,
        strictLiteralTypes: false,
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

Note `checkTemplateBodies: false` in that branch. Opting out of `strictTemplates` does not step down
one tier — it turns off template body checking altogether, and takes extended diagnostics with it.
That cost is [01 · 14g What turning it off costs](../01-compiler-with-a-framework-attached/14g-what-turning-strict-templates-off-costs.md).

## The five entries that are not `strictTemplates`

| Entry | Strict branch | Why it is not the variable |
|---|---|---|
| `honorAccessModifiersForInputBindings` | **`false`** | the `strictInputAccessModifiers` carve-out; JSDoc: *"Defaults to `false`, even if "strictTemplates" and/or "strictInputTypes" is set."*, with tracking issue 38400 |
| `checkTypeOfDomBindings` | **`false`** | source comment: *"Even in full template type-checking mode, DOM binding checks are not quite ready yet."* |
| `checkTypeOfNonDomReferences` | **`true`** | *"Non-DOM references have the correct type in View Engine so there is no strictness flag."* |
| `checkTypeOfPipes` | **`true`** | *"Pipes are checked in View Engine so there is no strictness flag."* |
| `strictLiteralTypes` | **`true`** | matches the JSDoc's *"Defaults to `false` unless `strictTemplates` is set."* |

Two of those — `checkTypeOfPipes` and `checkTypeOfNonDomReferences` — are `true` in the strict
branch and `false` in the non-strict one, so they *are* affected by the option; what they are not is
individually configurable. `checkTypeOfDomBindings` is `false` in **both** branches: there is no
configuration anywhere that turns DOM property-binding type checks on. Say that plainly rather than
looking for a flag.

**And `checkQueries: false` appears in both branches.** ⚠️ What would ever enable it was not
established by the sources read for this page; no option in `TypeCheckingOptions` maps to it. Treat
it as unsettled rather than assuming a flag exists.

`alwaysCheckSchemaInTemplateBodies` differs in an unusual way: `true` under strict, and under
non-strict it is `this.closureCompilerEnabled`, with the comment *"Enable deep schema checking in
"basic" template type-checking mode only if Closure compilation is requested, which is a good proxy
for "only in google3.""*

## Two entries your tsconfig cannot reach at all

Immediately above the branch, two config entries are computed from the version of `@angular/core`
found in the program:

```ts
    // Check whether the loaded version of `@angular/core` in the `ts.Program` supports unwrapping
    // writable signals for type-checking. Only Angular versions greater than 17.2 have the necessary
    // symbols to type check signals in two-way bindings. We also allow version 0.0.0 in case somebody is
    // using Angular at head.
    const allowSignalsInTwoWayBindings =
      this.angularCoreVersion === null ||
      coreVersionSupportsFeature(this.angularCoreVersion, '>= 17.2.0-0');
    const allowDomEventAssertion =
      this.angularCoreVersion === null ||
      coreVersionSupportsFeature(this.angularCoreVersion, '>= 20.2.0');
```

Both are then spread into **both** branches unchanged. 🔴 So two aspects of template type-checking
are decided by *which `@angular/core` you resolved*, not by any option — and they are unaffected by
`strictTemplates` in either direction. This is the mechanism behind "the same tsconfig, the same
compiler, different behaviour after a dependency bump."

## Gotchas

**★ Symptom: `private` or `readonly` inputs are assignable from a template even under
`strictTemplates`.** Cause: `honorAccessModifiersForInputBindings` is hard-coded `false` in the
strict branch. Fix — the override layer, which is the only way in:

```jsonc
{
  "angularCompilerOptions": {
    "strictInputTypes": true,
    "strictInputAccessModifiers": true
  }
}
```

**★ Symptom: DOM *property* bindings are not type-checked under `strictTemplates` and you cannot
find the flag.** Cause: `checkTypeOfDomBindings: false`, hard-coded in **both** branches, with the
comment *"Even in full template type-checking mode, DOM binding checks are not quite ready yet."*
Fix: there is none — no tsconfig option reaches that entry. Do not go looking for one, and do not
confuse it with `checkTypeOfDomEvents`, which *is* configurable:

```jsonc
{
  "angularCompilerOptions": {
    "strictDomEventTypes": true
  }
}
```

**★ Symptom: pipe return types are still checked in a project with `strictTemplates: false`.**
Cause: `checkTypeOfPipes` is `true` in the strict branch and `false` in the non-strict one, so
opting out *does* disable it — but there is no individual flag for it in either direction. The same
is true of `checkTypeOfNonDomReferences`. Fix: if you need pipe checking, you need the strict
baseline; there is no narrower control.

**Symptom: `strictTemplates: false` disabled far more than you expected.** Cause: the non-strict
branch sets `checkTemplateBodies: false` and `checkControlFlowBodies: false` — template bodies are
not checked at all, so it is not "one tier down". Fix: keep the baseline and disable a single named
check instead ([06c · The override layer](06c-the-override-layer.md)):

```jsonc
{
  "angularCompilerOptions": {
    "strictDomEventTypes": false
  }
}
```

**Symptom: template type-checking behaviour changed after bumping `@angular/core` alone, with no
tsconfig change.** Cause: `allowSignalsInTwoWayBindings` and `allowDomEventAssertion` are derived
from the resolved `@angular/core` version — `>= 17.2.0-0` and `>= 20.2.0` respectively — and no
option overrides them. Fix: there is nothing to configure; treat the core version as an input to
template checking and pin it deliberately.

**Symptom: you searched `TypeCheckingOptions` for something that maps to `checkQueries` and found
nothing.** Cause: it is `false` in both branches, and what would enable it was not established by
the sources read for this page. Fix: treat it as unsettled; do not report it as a configurable
check.

**Symptom: schema checking behaves differently in your fork of a Google-internal build.** Cause:
`alwaysCheckSchemaInTemplateBodies` falls back to `this.closureCompilerEnabled` in the non-strict
branch, with the comment naming that as *"a good proxy for "only in google3.""* Fix: expect the
non-strict branch to differ between a Closure-enabled build and an ordinary one; the strict branch
is unconditionally `true`.

**Symptom: you assumed every entry in the strict branch is `strictTemplates` and reasoned from
that.** Cause: most are, which is exactly why the exceptions are missed. Fix: use the table above as
the list, and remember it names entries, not options — the option names differ, and the mapping is
[06c · The override layer](06c-the-override-layer.md).

## Interview questions

**★ `strictTemplates` "implies all template strictness flags". Name one it does not imply, and one
it can never turn off.**
It does not imply `strictInputAccessModifiers`: the strict branch hard-codes
`honorAccessModifiersForInputBindings: false`, and the JSDoc says so outright, pointing at tracking
issue 38400. And it can never turn off `checkTypeOfDomBindings`, which is `false` in both branches
with the comment *"Even in full template type-checking mode, DOM binding checks are not quite ready
yet."* — there is no option anywhere that reaches it. The general shape: the strict branch is a
literal object, and reading it is the only reliable way to know what the option means in a given
version.

**★ Which checks are on regardless of the mode?**
`checkTypeOfPipes` and `checkTypeOfNonDomReferences` are `true` in the strict branch, and the source
comments explain why they have no flag: both were already checked in View Engine, so no strictness
option was ever introduced for them. In the non-strict branch they are `false` along with everything
else, so they are affected by `strictTemplates` — they are simply not individually configurable.
`checkQueries` is `false` in both branches and nothing in the option surface appears to enable it;
that one is genuinely unsettled.

**★ What does opting out of `strictTemplates` actually cost, at the level of this object?**
The non-strict branch sets `checkTemplateBodies: false` and `checkControlFlowBodies: false`. That is
not a reduced level of checking; it is the absence of template body checking, and extended
diagnostics go with it because they are gated on the same option. Everything else in the branch
follows from those two. So `strictTemplates: false` is a much larger step than its name suggests,
which is the argument for using individual flags instead.

**Can anything about template type-checking change without a change to your tsconfig?**
Yes, in two ways. Upgrading the compiler can move a default — that is what v22 did to
`strictTemplates`. And `allowSignalsInTwoWayBindings` and `allowDomEventAssertion` are computed from
the version of `@angular/core` resolved in the program, gated at `>= 17.2.0-0` and `>= 20.2.0`, with
no option to override them. Both entries are spread into both branches, so they are outside the
strict/non-strict distinction entirely.

**Why are the two branches written out as complete objects rather than as a set of toggles?**
Because the type demands every entry, and because the exceptions are not expressible as toggles. A
toggle-based implementation would have to special-case the five entries that are not the variable,
and the special cases would be invisible; written as two literal objects, every exception is a line
you can read, with a comment next to it explaining itself. It is also why quoting this object is a
better answer than any prose summary of what `strictTemplates` does.

---

← Prev: [What strictTemplates switches on](06-what-stricttemplates-switches-on.md) · Index: [Topic index](README.md) · Next → [The override layer](06c-the-override-layer.md)
