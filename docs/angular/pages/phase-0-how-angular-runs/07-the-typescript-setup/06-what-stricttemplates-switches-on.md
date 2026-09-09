---
title: "Every individual template strictness flag documents itself as `Defaults to false`, and with `strictTemplates` on — the v22 default — all of those behaviours are on: the JSDoc default describes the *option's value*, not the *behaviour*, and confusing the two is the whole difficulty of this option surface"
sidebar_label: "06 · What strictTemplates switches on"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts),
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts) —
> read through the GitHub contents API at that tag; and angular.dev
> [Template type checking](https://angular.dev/tools/cli/template-typecheck),
> [Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`strictTemplates`' own JSDoc says it *"implies all template strictness flags below (unless
individually disabled)"*, and every one of those flags says `Defaults to `false``.** Both sentences
are true, and reading them as contradictory is the single most common confusion about this option
surface. The resolution is that they describe different things: the per-flag default is the value
of the **option** when you do not write it, and `strictTemplates` decides the **behaviour** when no
option value is present. 🔴 So *"defaults to `false`"* does not mean *"this check is off"* — it
means *"this key contributes nothing unless you write it."* This page reads the surface; the two
pages after it show the code that resolves it.

## The public option surface, with its documented defaults

All from `interface TypeCheckingOptions` in
[`public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts)
at `v22.1.5`. Both columns are verbatim JSDoc.

| Option | Documented default | What it checks |
|---|---|---|
| `strictTemplates` | *"Defaults to `true`"* | *"If `true`, implies all template strictness flags below (unless individually disabled)."* |
| `typeCheckHostBindings` | *(none in the JSDoc — see below)* | *"Whether type checking of host bindings is enabled."* |
| `strictInputTypes` | *"Defaults to `false`."* | *"Whether to check the type of a binding to a directive/component input against the type of the field on the directive/component."* |
| `strictInputAccessModifiers` | *"Defaults to `false`, even if \"strictTemplates\" and/or \"strictInputTypes\" is set."* | *"Whether to check if the input binding attempts to assign to a restricted field (readonly, private, or protected) on the directive/component."* |
| `strictNullInputTypes` | *"Defaults to `false`."* | *"Whether to use strict null types for input bindings for directives."* |
| `strictAttributeTypes` | *"Defaults to `false`."* | *"Whether to check text attributes that happen to be consumed by a directive or component."* |
| `strictSafeNavigationTypes` | *"Defaults to `false`."* | *"Whether to use a strict type for null-safe navigation operations."* |
| `strictDomLocalRefTypes` | *"Defaults to `false`."* | *"Whether to infer the type of local references."* |
| `strictOutputEventTypes` | *"Defaults to `false`."* | *"Whether to infer the type of the `$event` variable in event bindings for directive outputs or animation events."* |
| `strictDomEventTypes` | *"Defaults to `false`."* | *"Whether to infer the type of the `$event` variable in event bindings to DOM events."* |
| `strictContextGenerics` | *"Defaults to `false`."* | *"Whether to include the generic type of components when type-checking the template."* |
| `strictLiteralTypes` | *"Defaults to `false` unless `strictTemplates` is set."* | *"Whether object or array literals defined in templates use their inferred type, or are interpreted as `any`."* |

🔴 **Read the default column as being about the key, not about the check.** Eleven of the twelve
say `false`, and in a default v22 workspace every behaviour they name is nevertheless on.

What each check actually rejects, with worked examples, is topic 01's Master-tier treatment —
[01 · 14h The input-assignment flags](../01-compiler-with-a-framework-attached/14h-the-input-side-flags.md),
[01 · 14i Attributes, literals, safe nav](../01-compiler-with-a-framework-attached/14i-attributes-literals-and-safe-navigation.md),
[01 · 14j Event, reference, generics](../01-compiler-with-a-framework-attached/14j-the-event-reference-and-generics-flags.md).
This topic is the configuration side: what goes in the file, and how the file resolves.

## Two layers, not one switch

The compiler resolves template checking in exactly two steps, and every apparent contradiction above
dissolves once you can name them:

1. **Layer 1 — the baseline.** `strictTemplates` selects one of two complete internal
   configurations. Under the v22 default it selects the strict one, in which most checks are on.
   Nothing you wrote is consulted here except `strictTemplates` itself.
2. **Layer 2 — the overrides.** Each individual option is then applied *on top*, guarded by
   `!== undefined`. An option you never wrote is `undefined`, so it changes nothing and layer 1's
   decision stands.

That is the whole model. `Defaults to false` in the JSDoc is a statement about layer 2: *if you do
not write this key, layer 2 supplies nothing.* It has no bearing on what layer 1 did.

```jsonc
// Layer 1 only: strictTemplates absent → strict baseline → input types ARE checked.
{
  "angularCompilerOptions": {}
}
```

```jsonc
// Layer 1 + layer 2: the baseline stays strict, one check is turned off explicitly.
{
  "angularCompilerOptions": {
    "strictDomEventTypes": false
  }
}
```

The code for layer 1 is [06b · The two branches](06b-the-two-branches.md); the code for layer 2, and
the fact that it is what makes granular opt-out possible, is
[06c · The override layer](06c-the-override-layer.md).

## Three entries in that table that are not what they look like

**`strictInputAccessModifiers` is the flag `strictTemplates` genuinely does not imply.** Its JSDoc
is explicit, verbatim:

> *"Defaults to `false`, even if "strictTemplates" and/or "strictInputTypes" is set. Note that if
> `strictInputTypes` is not set, or set to `false`, this flag has no effect."*
> *"Tracking issue for enabling this by default: https://github.com/angular/angular/issues/38400"*

angular.dev repeats it on [Template type checking](https://angular.dev/tools/cli/template-typecheck):

> *"This option is `false` by default, even with `strictTemplates` set to `true`."*

🔴 And yet a CLI-generated workspace **does** check access modifiers — because the schematic writes
`"strictInputAccessModifiers": true` into `tsconfig.json`
([05b](05b-what-the-cli-writes-and-does-not-write.md)). So the framework default and the CLI default
differ, and two projects that both "use the defaults" differ with them.

**`strictLiteralTypes` documents its own exception.** *"Defaults to `false` unless `strictTemplates`
is set."* — the only entry in the table whose JSDoc admits that layer 1 exists.

**`typeCheckHostBindings` has no documented default in the JSDoc at all.** The default lives in the
implementation, and it is `true` — resolved separately from `strictTemplates`, which means host
bindings are type-checked even in a project that opted out. That option, and the other one that sits
outside both layers, is
[06d · The options outside the switch](06d-the-options-outside-the-switch.md).

## What `strictNullInputTypes: false` actually does

One JSDoc body is worth quoting in full, because it describes a *rewrite* rather than a skipped
check:

> *"If this is `true`, applications that are compiled with TypeScript's `strictNullChecks` enabled
> will produce type errors for bindings which can evaluate to `undefined` or `null` where the
> inputs's type does not include `undefined` or `null` in its type. If set to `false`, all binding
> expressions are wrapped in a non-null assertion operator to effectively disable strict null
> checks."*

🔴 *"all binding expressions are wrapped in a non-null assertion operator"* — turning the flag off
does not merely skip a check; the compiler emits a different type-check block, with `!` applied. It
is the clearest statement in the surface that these options change generated code, not just
diagnostic filtering. How that generated block is produced is
[01 · 14 Template type checking](../01-compiler-with-a-framework-attached/14-template-type-checking.md).

## Gotchas

**★ Symptom: you read `Defaults to false` on `strictInputTypes` and conclude input types are not
checked in your project.** Cause: the JSDoc default is the option's value, not the behaviour; with
`strictTemplates` at its v22 default the baseline switches the check on and your absent key
contributes nothing. Fix: to make the check's state legible, write it — the value you want, not the
value you assumed:

```jsonc
{
  "angularCompilerOptions": {
    "strictInputTypes": true
  }
}
```

**★ Symptom: `private` or `readonly` inputs can be assigned from a template even though
`strictTemplates` is on.** Cause: `strictInputAccessModifiers` is the documented carve-out —
*"Defaults to `false`, even if "strictTemplates" and/or "strictInputTypes" is set."* Fix, in code:

```jsonc
{
  "angularCompilerOptions": {
    "strictInputAccessModifiers": true
  }
}
```

A CLI-generated workspace already has that line; a hand-written tsconfig will not.

**★ Symptom: you set `strictInputAccessModifiers: true` and it has no effect.** Cause: its JSDoc
again — *"Note that if `strictInputTypes` is not set, or set to `false`, this flag has no effect."*
Somebody disabled `strictInputTypes`. Fix: remove that override, or set both:

```jsonc
{
  "angularCompilerOptions": {
    "strictInputTypes": true,
    "strictInputAccessModifiers": true
  }
}
```

**Symptom: an option you found on angular.dev does not appear to exist.** Cause: the reference page
documents options that are no longer in the compiler's public surface — the drift is catalogued in
[01 · 13e The option surface](../01-compiler-with-a-framework-attached/13e-the-option-surface-and-config-time-diagnostics.md).
Fix: check the option against `TypeCheckingOptions` in `public_options.ts` at the tag you are on
before writing it; a key that does not exist is silently ignored
([04](04-angularcompileroptions-and-how-it-inherits.md)).

**Symptom: turning off `strictNullInputTypes` changes error messages elsewhere in the same
template.** Cause: it is not a filter — per its JSDoc, *"all binding expressions are wrapped in a
non-null assertion operator"*, so the generated type-check block itself is different and downstream
inference changes with it. Fix: prefer narrowing the type at the source over disabling the flag:

```ts
@Component({selector: 'user-detail', template: '<span>{{ name }}</span>'})
export class UserDetail {
  @Input() name: string | null = null;
}
```

**Symptom: two projects on the same Angular version disagree about access-modifier checking and
neither tsconfig contains `false` anywhere.** Cause: one was generated by the CLI, which writes
`strictInputAccessModifiers: true`, and the other's tsconfig was hand-written. Fix: copy the whole
generated `angularCompilerOptions` block rather than the options you remember
([05b](05b-what-the-cli-writes-and-does-not-write.md)).

**Symptom: you expected `strictTemplates: true` to be the maximal setting and find checks still
off.** Cause: it is a baseline, not a maximum. At least one flag is carved out of it deliberately,
and several internal entries are hard-coded regardless of it. Fix: read the baseline as code rather
than as a promise — [06b · The two branches](06b-the-two-branches.md) lists every entry and its
value.

**Symptom: a code review asks "is this option on?" and the tsconfig cannot answer.** Cause: absence
means *take the baseline*, and the baseline is in the compiler. Fix: for options a team actually
cares about, write them explicitly — it costs a line, and it converts a question into a fact:

```jsonc
{
  "angularCompilerOptions": {
    "strictTemplates": true,
    "strictInputTypes": true,
    "strictInputAccessModifiers": true
  }
}
```

## Interview questions

**★ `strictTemplates` says it implies all the strictness flags, and every one of those flags says it
defaults to `false`. Which is true?**
Both, because they are about different things. The per-flag default is the value of the **option**
when the key is absent, and an absent key means *contribute nothing*. `strictTemplates` then decides
the **behaviour** via a baseline configuration selected before any individual option is consulted.
So in a default v22 project, `strictInputTypes` is `undefined` as an option and its behaviour is on.
The one-sentence version: the JSDoc defaults describe layer 2, and layer 1 has already run.

**★ Name a flag `strictTemplates` does not imply, and why.**
`strictInputAccessModifiers`. Its JSDoc says *"Defaults to `false`, even if "strictTemplates" and/or
"strictInputTypes" is set"*, and points at tracking issue 38400 for enabling it by default;
angular.dev repeats the carve-out in as many words. The compiler's strict baseline hard-codes the
corresponding entry to `false`. The CLI compensates by writing `"strictInputAccessModifiers": true`
into every generated workspace — so a generated project checks access modifiers and a hand-written
one with the same `strictTemplates` value does not.

**★ What does `strictNullInputTypes: false` do — skip a check, or something else?**
Something else. Its JSDoc: *"If set to `false`, all binding expressions are wrapped in a non-null
assertion operator to effectively disable strict null checks."* The compiler emits a different
type-check block, with `!` applied to every binding expression, so the effect is not confined to the
null-related diagnostics — inference downstream of those expressions changes too. It is the clearest
evidence in the surface that these options change generated code rather than filtering output.

**How would you find out whether an option exists in the version you are on?**
Read `interface TypeCheckingOptions` in `public_options.ts` at the tag, not the reference page.
angular.dev's compiler-options page documents entries that no longer exist, and Angular's config
merge silently ignores an unknown key, so a typo or a stale option name produces no error at all —
the two failure modes compose into a setting that looks applied and is not.

**Why does the surface use `strictTemplates` plus a dozen individual flags, rather than one
enumeration?**
Because the two answer different questions. `strictTemplates` answers *"which posture is this
project in"* and moves as the framework's defaults move; the individual flags answer *"which
specific check is this project not ready for"* and are meant to be temporary and few. The layered
resolution is what makes that combination expressible — you keep the posture and name the exception,
instead of choosing between all and nothing.

**A team wants their tsconfig to document their template-checking posture completely. What do you
tell them?**
That it cannot, without writing every option out — and that writing them out has a cost, because a
migration reads the resolved value to decide whether the project already has an opinion, and skips
files that do. The practical middle is to write the options the team has actually reasoned about,
leave the rest absent, and treat the compiler's own source as the reference for the baseline. Any
policy that requires reading the tsconfig alone to know the build's behaviour is unachievable in
v22.

---

← Prev: [The three guards](05e-the-three-guards.md) · Index: [Topic index](README.md) · Next → [The two branches](06b-the-two-branches.md)
