---
title: "Every individual flag is applied on top of the `strictTemplates` baseline behind an `!== undefined` guard, which is why the right answer to four hundred template errors is one named exception rather than `strictTemplates: false` — and why two of those flags each drive two internal entries"
sidebar_label: "06c · The override layer"
sidebar_position: 6.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts)
> (`getTypeCheckingConfig`), read through the GitHub contents API at that tag; and angular.dev
> [Template type checking](https://angular.dev/tools/cli/template-typecheck),
> [Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Layer 2 is twelve `if` statements, all guarded on `!== undefined`, applied to the object layer 1
just built.** That uniform guard is the mechanism behind angular.dev's advice to disable checks
individually, and it is the reason a wall of template errors should produce **one named exception**
rather than a blanket opt-out. It also carries two traps: two options each drive *two* internal
entries, and almost none of the option names match the entry names they set — so a source comment
cannot be turned into a tsconfig key without a mapping table.

## The block, verbatim

Immediately after the `if/else` of [06b](06b-the-two-branches.md), with its own comment:

```ts
    // Apply explicitly configured strictness flags on top of the default configuration
    // based on "strictTemplates".
    if (this.options.strictInputTypes !== undefined) {
      typeCheckingConfig.checkTypeOfInputBindings = this.options.strictInputTypes;
      typeCheckingConfig.applyTemplateContextGuards = this.options.strictInputTypes;
    }
    if (this.options.strictInputAccessModifiers !== undefined) {
      typeCheckingConfig.honorAccessModifiersForInputBindings =
        this.options.strictInputAccessModifiers;
    }
    if (this.options.strictNullInputTypes !== undefined) {
      typeCheckingConfig.strictNullInputBindings = this.options.strictNullInputTypes;
    }
    if (this.options.strictOutputEventTypes !== undefined) {
      typeCheckingConfig.checkTypeOfOutputEvents = this.options.strictOutputEventTypes;
      typeCheckingConfig.checkTypeOfAnimationEvents = this.options.strictOutputEventTypes;
    }
    if (this.options.strictDomEventTypes !== undefined) {
      typeCheckingConfig.checkTypeOfDomEvents = this.options.strictDomEventTypes;
    }
    if (this.options.strictSafeNavigationTypes !== undefined) {
      typeCheckingConfig.strictSafeNavigationTypes = this.options.strictSafeNavigationTypes;
    }
    if (this.options.strictDomLocalRefTypes !== undefined) {
      typeCheckingConfig.checkTypeOfDomReferences = this.options.strictDomLocalRefTypes;
    }
    if (this.options.strictAttributeTypes !== undefined) {
      typeCheckingConfig.checkTypeOfAttributes = this.options.strictAttributeTypes;
    }
    if (this.options.strictContextGenerics !== undefined) {
      typeCheckingConfig.useContextGenericType = this.options.strictContextGenerics;
    }
    if (this.options.strictLiteralTypes !== undefined) {
      typeCheckingConfig.strictLiteralTypes = this.options.strictLiteralTypes;
    }
    if (
      this.options.extendedDiagnostics?.checks?.controlFlowPreventingContentProjection !== undefined
    ) {
      typeCheckingConfig.controlFlowPreventingContentProjection =
        this.options.extendedDiagnostics.checks.controlFlowPreventingContentProjection;
    }
    if (this.options.extendedDiagnostics?.checks?.unusedStandaloneImports !== undefined) {
      typeCheckingConfig.unusedStandaloneImports =
        this.options.extendedDiagnostics.checks.unusedStandaloneImports;
    }

    return typeCheckingConfig;
```

## Presence is the semantics

The guard is `!== undefined`, uniformly. So **the presence of the key is what matters**, and `false`
is a real, honoured value rather than an absence. This is precisely what angular.dev describes on
[Template type checking](https://angular.dev/tools/cli/template-typecheck):

> *"Disable certain type-checking operations individually, while maintaining strictness in other
> aspects, by setting a strictness flag to `false`"*

🔴 That is the correct response to a large error count, and `strictTemplates: false` is not — the
latter drops `checkTemplateBodies` entirely ([06b](06b-the-two-branches.md)):

```jsonc
{
  "angularCompilerOptions": {
    "strictDomEventTypes": false
  }
}
```

Note also the last two `if`s: two **extended diagnostics** are overridable through
`extendedDiagnostics.checks` in exactly the same way, which is why that object can raise or suppress
those two checks independently of `defaultCategory`.

## Two options with double blast radius

| Option | Entries it sets |
|---|---|
| `strictInputTypes` | `checkTypeOfInputBindings` **and** `applyTemplateContextGuards` |
| `strictOutputEventTypes` | `checkTypeOfOutputEvents` **and** `checkTypeOfAnimationEvents` |

🔴 Turning off "input type checking" also turns off **template context guards** — the machinery that
makes a structural directive narrow a type in its body. That is a far larger consequence than the
option's name suggests, and what it costs in practice is
[01 · 14h The input-assignment flags](../01-compiler-with-a-framework-attached/14h-the-input-side-flags.md).

## The names do not match, and you need both

An option in your tsconfig and the internal entry it sets are usually spelled differently, so a
source comment cannot be connected to a config key without this table:

| tsconfig option | Internal `TypeCheckingConfig` entry |
|---|---|
| `strictInputTypes` | `checkTypeOfInputBindings`, `applyTemplateContextGuards` |
| `strictInputAccessModifiers` | `honorAccessModifiersForInputBindings` |
| `strictNullInputTypes` | `strictNullInputBindings` |
| `strictOutputEventTypes` | `checkTypeOfOutputEvents`, `checkTypeOfAnimationEvents` |
| `strictDomEventTypes` | `checkTypeOfDomEvents` |
| `strictSafeNavigationTypes` | `strictSafeNavigationTypes` |
| `strictDomLocalRefTypes` | `checkTypeOfDomReferences` |
| `strictAttributeTypes` | `checkTypeOfAttributes` |
| `strictContextGenerics` | `useContextGenericType` |
| `strictLiteralTypes` | `strictLiteralTypes` |

**`strictInputAccessModifiers` being in this list is where the two halves of the topic meet.** The
strict baseline hard-codes `honorAccessModifiersForInputBindings: false`; the CLI writes
`"strictInputAccessModifiers": true` into every generated workspace
([05b](05b-what-the-cli-writes-and-does-not-write.md)); and this block is the only path by which
that line reaches the hard-coded entry and overrides it.

## Gotchas

**★ Symptom: you set `strictInputTypes: false` to silence input errors, and unrelated
structural-directive narrowing errors disappear too.** Cause: that one option sets **two** entries —
`checkTypeOfInputBindings` *and* `applyTemplateContextGuards`. Fix: there is no narrower flag for
input assignability alone, so fix the types, or use `$any()` at the individual call site rather than
disabling the option:

```html
<user-detail [user]="$any(maybeUser)"></user-detail>
```

**★ Symptom: `strictInputAccessModifiers: true` has no effect.** Cause: its JSDoc — *"Note that if
`strictInputTypes` is not set, or set to `false`, this flag has no effect."* Somebody disabled
`strictInputTypes`. Fix: remove that override, or set both explicitly:

```jsonc
{
  "angularCompilerOptions": {
    "strictInputTypes": true,
    "strictInputAccessModifiers": true
  }
}
```

**Symptom: you turned off `strictOutputEventTypes` for a DOM-heavy component and animation callbacks
stopped being checked as well.** Cause: the same double-entry problem —
`checkTypeOfOutputEvents` and `checkTypeOfAnimationEvents` are set together. Fix: scope the retreat
to the check you meant by choosing the DOM-event flag instead, which sets exactly one entry:

```jsonc
{
  "angularCompilerOptions": {
    "strictDomEventTypes": false
  }
}
```

**Symptom: a source comment mentions `checkTypeOfDomReferences` and you cannot find that key in the
option list.** Cause: option names and entry names differ. Fix: use the mapping table above — the
option is `strictDomLocalRefTypes`:

```jsonc
{
  "angularCompilerOptions": {
    "strictDomLocalRefTypes": false
  }
}
```

**Symptom: setting an option to `false` behaves differently from deleting it.** Cause: correct, and
the whole point of the `!== undefined` guard — `false` is honoured as an override, absence lets the
baseline stand. Fix: use deletion to mean *take the baseline* and `false` to mean *I have decided*,
and never use one hoping for the other.

**Symptom: raising one extended diagnostic to `error` also raised the others.** Cause: they follow
`extendedDiagnostics.defaultCategory` unless individually named — and only two of them,
`controlFlowPreventingContentProjection` and `unusedStandaloneImports`, are overridden through this
block. Fix: name the check explicitly, and write `defaultCategory` in the same object because the
object is replaced wholesale on inheritance ([04c](04c-what-the-shallow-merge-costs.md)):

```jsonc
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "defaultCategory": "warning",
      "checks": {
        "unusedStandaloneImports": "error"
      }
    }
  }
}
```

**Symptom: you disabled a flag to unblock a release and it is still there a year later.** Cause: a
single line in JSON with no expiry. Fix: keep the exception list short and visible, and prefer many
narrow flags with owners over one broad one with none — the narrow ones are greppable, countable and
finite in a way `strictTemplates: false` is not.

## Interview questions

**★ You have four hundred template errors after adopting `strictTemplates`. What is the right
response?**
Not `strictTemplates: false`. Every individual flag is applied on top of the baseline with an
`!== undefined` guard, so you keep the baseline and disable the specific check producing the noise —
most often `strictDomEventTypes`, which Angular's own source flags as having *"an adverse effect on
developer experience"* for expressions like `$event.target.value`, naming `TS2531` and `TS2339` as
the codes it produces. angular.dev describes the same strategy: *"Disable certain type-checking
operations individually, while maintaining strictness in other aspects, by setting a strictness flag
to `false`"*. The result is one named exception instead of the loss of template body checking
entirely.

**★ Why does the override block guard on `!== undefined` rather than on truthiness?**
So that `false` is a meaningful value. Under a truthiness guard, writing `"strictInputTypes": false`
would be indistinguishable from omitting the key, and granular opt-out — the entire point of having
a dozen flags alongside a master switch — would be impossible. The guard makes *presence* the
semantics: absent means "the baseline decided", present means "I decided", whatever the value.

**Which options have effects wider than their names suggest?**
Two. `strictInputTypes` sets both `checkTypeOfInputBindings` and `applyTemplateContextGuards`, so
disabling it also disables template context guards — the machinery that makes structural directives
narrow types in their bodies. And `strictOutputEventTypes` sets both `checkTypeOfOutputEvents` and
`checkTypeOfAnimationEvents`. Neither of the second entries has an option of its own, so there is no
way to keep one and drop the other.

**Why can you not read an option name off a source comment and put it straight into your tsconfig?**
Because the internal configuration entries have different names from the public options —
`strictDomLocalRefTypes` sets `checkTypeOfDomReferences`, `strictContextGenerics` sets
`useContextGenericType`, `strictNullInputTypes` sets `strictNullInputBindings`. Only two of the ten,
`strictSafeNavigationTypes` and `strictLiteralTypes`, share a name with the entry they set. A
mapping table is not documentation overhead here; it is the only way to move between the compiler's
source and a configuration file.

**How does the CLI's `strictInputAccessModifiers: true` line actually take effect, given that the
strict baseline hard-codes the corresponding entry to `false`?**
Through this block. The baseline sets `honorAccessModifiersForInputBindings: false`
unconditionally; then the override block sees `strictInputAccessModifiers !== undefined`, because
the schematic wrote it, and assigns `true` over the top. Without that line the entry stays `false`
however strict the rest of the configuration is — which is why a hand-written tsconfig and a
generated one differ on this check with no `false` visible in either file.

## Where this goes next

Two Angular compiler options are resolved **outside** both the branch and this block, with two more
default-resolution idioms, and one of them survives a `strictTemplates` opt-out entirely:
[06d · The options outside the switch](06d-the-options-outside-the-switch.md).

{/* FOOTER */}
