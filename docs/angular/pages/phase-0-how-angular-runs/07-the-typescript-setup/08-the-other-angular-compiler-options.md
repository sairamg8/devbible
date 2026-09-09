---
title: "A generated workspace's `angularCompilerOptions` has exactly three keys and two of them are stricter than Angular itself — so \"we use the defaults\" means two different things depending on whether the CLI wrote your tsconfig or a human did"
sidebar_label: "08 · The other angularCompilerOptions"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** —
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts)
> at tag `v22.1.5` (the JSDoc of `strictInjectionParameters` and `strictInputAccessModifiers`, quoted
> in full), angular.dev
> [Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options) and
> [Template type checking](https://angular.dev/tools/cli/template-typecheck) — and `angular/angular-cli`
> at tag `v22.1.7`:
> [`packages/schematics/angular/workspace/files/tsconfig.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/tsconfig.json.template)
> and
> [`packages/schematics/angular/workspace/index_spec.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/index_spec.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Open a v22 workspace's root `tsconfig.json` and `angularCompilerOptions` has three keys. Two of them
turn on behaviour that Angular itself leaves off — so a project whose tsconfig was written by the CLI
is measurably stricter than a project whose tsconfig was hand-written or inherited from a non-CLI
setup, even though both teams will tell you they "use the defaults".** That gap is this page. It is
also the reason a component that compiles in one Angular 22 repository fails in another with identical
dependencies.

The keys you *add* yourself — `strictStandalone`, `typeCheckHostBindings`, `extendedDiagnostics`,
`disableTypeScriptVersionCheck` — are [08b](08b-the-options-you-add-yourself.md).

## What is actually in the file

The resolved output of `ng new` at v22, `angularCompilerOptions` only:

```json
{
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true
  }
}
```

Three keys. **`strictTemplates` is not one of them**, and neither is `compilerOptions.strict` — the
CLI writes only the *negations*, in the `--no-strict` branch. Upstream asserts that omission on
purpose; its own workspace spec, verbatim, for the `strict: true` case:

```ts
    expect(compilerOptions.strict).toBeUndefined();
    expect(angularCompilerOptions.strictTemplates).toBeUndefined();
    expect(angularCompilerOptions.strictInputAccessModifiers).toBeTrue();
    expect(angularCompilerOptions.strictInjectionParameters).toBeTrue();
```

Why the first two are absent and still on is
**TypeScript 6 defaults and what `ng new` writes** — [09](09-typescript-6-defaults-and-what-ng-new-writes.md).
This page is the two that are present and `true`.

## `enableI18nLegacyMessageIdFormat: false` — named, and left alone

The one key that appears in **both** branches of the template: it is written whether or not you pass
`--strict`, which marks it as scaffolding rather than a strictness decision.

⚠️ **No documentation sentence for this option was found while writing this page, and its
implementation was not read.** It is an internationalisation concern — it selects a message-id format
for extracted i18n messages — and it belongs to an i18n topic, not to this one. **Do not delete a key
whose effect you cannot state**: an i18n message id is the join key between your source and your
translation files, and changing its format invalidates existing translations. If you have no
translations, it costs you nothing to leave it where the CLI put it.

## `strictInjectionParameters` — the framework says `false`, the CLI writes `true`

Its JSDoc, verbatim (the grammar is upstream and is quoted as published):

> *"Always report errors a parameter is supplied whose injection type cannot be determined. When this
> value option is not provided or is `false`, constructor parameters of classes marked with
> `@Injectable` whose type cannot be resolved will produce a warning. With this option `true`, they
> produce an error. When this option is not provided is treated as if it were `false`."*

angular.dev agrees and adds a recommendation:

> *"When `true`, reports an error for a supplied parameter whose injection type cannot be
> determined."*

with the default given as `false` and the note that *"the recommended value is `true`."*

🔴 **So the framework default is a warning and the CLI writes the error.** The behaviour it governs —
what "injection type cannot be determined" means, and why a constructor parameter's type can fail to
resolve — belongs to **Phase 6 · Dependency injection** *(not written yet)*. What belongs here is the
consequence for your tsconfig: a project without this key still *detects* the problem and still
*builds*, so the diagnostic scrolls past in CI and nobody sees it.

```json
// Put it in the ROOT tsconfig.json. tsconfig.spec.json extends the root,
// not tsconfig.app.json, so a leaf placement leaves your tests on warnings.
{
  "angularCompilerOptions": {
    "strictInjectionParameters": true
  }
}
```

## `strictInputAccessModifiers` — the flag `strictTemplates` does *not* imply

This one is stranger, and it is the sharpest instance of the pattern. What it checks:

> *"Whether to check if the input binding attempts to assign to a restricted field (readonly, private,
> or protected) on the directive/component."*

and its documented default, which is unusually emphatic:

> *"Defaults to `false`, even if "strictTemplates" and/or "strictInputTypes" is set. Note that if
> `strictInputTypes` is not set, or set to `false`, this flag has no effect."*
> *"Tracking issue for enabling this by default: https://github.com/angular/angular/issues/38400"*

angular.dev repeats it: *"This option is `false` by default, even with `strictTemplates` set to
`true`."*

🔴 **`strictTemplates` is documented as implying all the template strictness flags. This is the one it
does not.** The internal field stays off in the strict branch, and there is an open tracking issue for
changing that. So the *only* reason a fresh v22 application rejects a binding to a `private` input is
that the CLI wrote this key into your file. The compiler-side detail — including the dependency on
`strictInputTypes` that makes the flag a no-op if someone disabled it — is
[14h](../01-compiler-with-a-framework-attached/14h-the-input-side-flags.md).

## 🔴 The pattern: "generated by `ng new`" is not "Angular's default"

Two options in one small block where the CLI is stricter than the framework is not a coincidence, it
is a policy, and it has a direct consequence:

| Where the tsconfig came from | `strictInjectionParameters` | `strictInputAccessModifiers` |
|---|---|---|
| `ng new` at v22, default options | **`true`** — error | **`true`** — private inputs rejected |
| hand-written, or from a non-CLI setup (Nx preset, Bazel, a template repo) | absent → framework default `false` — warning | absent → framework default `false` — private inputs assignable |

Both teams say "we use the defaults". They mean different files.

⚠️ **This is a real cause of "works on my machine" in template code.** A component that binds to a
`protected` input compiles in the second project and fails in the first, on identical package
versions, because one file has two extra lines. When two Angular repositories disagree about whether
code compiles, diff the `angularCompilerOptions` blocks before diffing anything else.

## What `--strict` on the CLI actually decides

There is a third thing called strict, and it is a **schematic option**, not a compiler option.

- The application schematic's schema documents `strict` as *"Enable stricter bundle budget settings
  for the application."* — a build-size concern with nothing to do with types.
- The workspace schematic's `tsconfig.json` template branches on the same option to decide which keys
  get written: the strict branch writes the two above plus four TypeScript flags; the `--no-strict`
  branch writes `"strict": false` and `"strictTemplates": false` and omits all six.

Both are `strict`, both default to `true`, and they are documented in different places with different
descriptions. Together with `compilerOptions.strict` and
`angularCompilerOptions.strictTemplates` that makes **three unrelated switches sharing one word** in a
single workspace. Say which one you mean, every time.

## Gotchas

**★ Symptom: an unresolvable `@Injectable` constructor parameter produces a warning, and CI goes
green.** Cause: `strictInjectionParameters` is absent or `false`; per its JSDoc such parameters
*"will produce a warning"* by default and an error only *"With this option `true`"*. Fix:

```json
{
  "angularCompilerOptions": {
    "strictInjectionParameters": true
  }
}
```

A generated workspace already has this. A hand-written one does not, which is exactly why the warning
has been scrolling past unnoticed.

**★ Symptom: binding to a `private` or `protected` input compiles, and you expected an error under
`strictTemplates`.** Cause: `strictTemplates` does not imply `strictInputAccessModifiers` — the JSDoc
says *"Defaults to `false`, even if "strictTemplates" and/or "strictInputTypes" is set."* Fix: add the
key, which is what `ng new` does for you:

```json
{
  "angularCompilerOptions": {
    "strictInputAccessModifiers": true
  }
}
```

**★ Symptom: `strictInputAccessModifiers: true` is in the file and has no effect.** Cause: the second
half of the same JSDoc — *"Note that if `strictInputTypes` is not set, or set to `false`, this flag
has no effect."* Someone disabled `strictInputTypes`, probably to silence a wave of input
assignability errors. Fix: remove that override; it also silently disabled template context guards, so
it was costing more than anyone realised.

**★ Symptom: the same component compiles in one Angular 22 repository and fails in another, with
identical `package.json` files.** Cause: one tsconfig was generated and the other was not. Fix: diff
the two `angularCompilerOptions` blocks first. Three keys is the generated shape; anything shorter is
a hand-written file running on framework defaults.

**★ Symptom: a project created with `--no-strict` behaves very differently from the flag's name.**
Cause: that branch writes `"strict": false` and `"strictTemplates": false` **and** omits four
TypeScript flags plus both Angular strictness keys. Six settings differ, not one. Fix: treat
`--no-strict` as a distinct project template rather than a switch — and if you inherited such a
project, adopt the settings back one at a time rather than deleting both `false`s at once.

**★ Symptom: you misspelled a key in `angularCompilerOptions` and got no error at all.** Cause: the
block is merged as an untyped object; there is no schema validation of the key set at this layer, and
only a few specific options get compatibility diagnostics. Fix: check the spelling against
[Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options) — nothing
else will. A typo here is indistinguishable from a setting you never wrote.

**Symptom: after `ng update` to v22, a `strictTemplates: false` you never wrote is in your tsconfig.**
Cause: a migration wrote it, deliberately, so the upgrade would not turn into a template-fixing
project. Fix: nothing is broken — but it is a decision you now own.
[04 · 07](../04-ng-update-not-npm-install/07-the-v22-migration-inventory.md) documents what runs, and
[07](07-what-stricttemplates-rejects.md) covers adopting the default afterwards.

**Symptom: you deleted `enableI18nLegacyMessageIdFormat` because it looked like legacy cruft.** Cause:
the name invites it. Fix: put it back unless you can state what the alternative format is and what it
does to your existing translation files — the message id is the join key between extracted source and
translations. This page does not document that option, deliberately; nothing was found that settles
its behaviour.

**Symptom: two keys in the generated block, not three.** Cause: an older CLI, or a tsconfig that has
been edited. Fix: compare against the template for your CLI version rather than against memory — the
generated set is a snapshot of a schematic at one release, not a stable contract.

## Interview questions

**★ A generated workspace sets `strictInjectionParameters: true` but Angular's own default is `false`.
Why does that matter?**
Because "the default" is ambiguous in this ecosystem, and the ambiguity has teeth. There are framework
defaults and CLI defaults, and this one small block contains two options where they differ —
`strictInjectionParameters` and `strictInputAccessModifiers`. A hand-written tsconfig, or one inherited
from a non-CLI setup, is therefore measurably less strict than a generated one even though both teams
describe themselves as using defaults. In practice it shows up as a component that compiles in one
repository and not in another with identical dependencies, and the first thing to diff is the
`angularCompilerOptions` block.

**★ Which strictness in a generated v22 tsconfig would you get anyway, and which do you have only
because the CLI wrote it?**
You would get `compilerOptions.strict` anyway, because TypeScript 6 defaults it on. You would get
`strictTemplates` anyway, because Angular 22 defaults it on. Neither is written into the file. What
you have *only* because the CLI wrote it is `strictInjectionParameters: true`, `strictInputAccessModifiers: true`,
and four TypeScript flags outside the `strict` family. That inverts the usual reading of the file: the
short block is not evidence of a relaxed project, it is evidence that the defaults moved and the
scaffold stopped repeating them.

**★ `strictTemplates` is documented as implying all the template strictness flags. Name one it does
not imply.**
`strictInputAccessModifiers`. Its JSDoc is explicit — *"Defaults to `false`, even if "strictTemplates"
and/or "strictInputTypes" is set"* — and it names the tracking issue for enabling it by default.
angular.dev repeats the same sentence. So binding to a `private` input is legal under `strictTemplates`
alone, and the only reason a fresh v22 application rejects it is that the CLI writes the key into the
generated tsconfig. There is a second half worth knowing: the flag is a no-op if `strictInputTypes` has
been disabled, so a team that silenced input errors also silently silenced this.

**★ What does `ng new --strict` actually control?**
Three different things wearing one name. The application schematic's schema documents it as
*"Enable stricter bundle budget settings for the application."* — a build-size concern. The workspace
schematic's tsconfig template branches on it to decide which compiler keys are written. And neither of
those is `compilerOptions.strict` or `angularCompilerOptions.strictTemplates`, both of which are on by
default and are written into the file only by the `--no-strict` branch, as negations. The correct
answer names all three and points out that the strict branch writes *no* `"strict": true` at all.

**What happens if you misspell a key in `angularCompilerOptions`?**
Nothing. The block is merged as an untyped object and there is no schema validation of the key set,
so a typo is silently ignored and reads as a setting you configured. Only a handful of options get
compatibility diagnostics at config time — the `extendedDiagnostics` family and a couple of
TypeScript options Angular refuses outright, covered in
[08b](08b-the-options-you-add-yourself.md) and
[13e](../01-compiler-with-a-framework-attached/13e-the-option-surface-and-config-time-diagnostics.md).
The practical defence is to copy key names from the reference page rather than typing them, and to
verify a new setting changed something before believing it took.

---

← Prev: [Where the opt-out goes](07e-where-the-opt-out-goes.md) · Index: [Topic index](README.md) · Next → [The options you add yourself](08b-the-options-you-add-yourself.md)
