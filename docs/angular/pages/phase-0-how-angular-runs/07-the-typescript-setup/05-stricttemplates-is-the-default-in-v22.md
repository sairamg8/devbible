---
title: "`strictTemplates` defaults to `true` in Angular 22 and a new app's `tsconfig.json` never says so — the CLI's own test suite asserts the omission on purpose, so the only way to know what your project does is to know what the compiler does when the key is absent"
sidebar_label: "05 · strictTemplates is the default"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts),
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts),
> `CHANGELOG.md` at that tag; and `angular/angular-cli` at tag `v22.1.7`:
> [`packages/schematics/angular/workspace/index_spec.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/index_spec.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Open a freshly generated Angular 22 workspace, read `tsconfig.json` end to end, and you will not
find `strictTemplates` anywhere.** Templates are still fully type-checked, because the option
defaults to `true` in the compiler and the CLI writes only the *negations*. 🔴 The consequence is
that **your tsconfig is not a description of your build.** Reading it tells you what somebody chose
to turn off, not what is on. Three independent proofs of the default are below, and the third turns
"the template happens not to write it" into "the CLI intends not to write it."

## Proof 1 — the type's own doc comment

From `interface TypeCheckingOptions` in
[`public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts)
at `v22.1.5` — an interface carrying `@publicApi` — verbatim:

```ts
  /**
   * If `true`, implies all template strictness flags below (unless individually disabled).
   *
   * Defaults to `true`
   */
  strictTemplates?: boolean;
```

Four lines, two separate claims: the default, and the semantics. The second one — *"implies all
template strictness flags below (unless individually disabled)"* — is cashed out flag by flag in
[06 · What `strictTemplates` switches on](06-what-stricttemplates-switches-on.md), and it is less
tidy than it sounds.

## Proof 2 — the implementation, which is stricter than "defaults to `true`"

From [`compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts)
at `v22.1.5`, with its own doc comment:

```ts
  /**
   * strictTemplate is `true` by default.
   * Explicit opt-out is required to disable strictness
   */
  private get strictTemplates(): boolean {
    return this.options.strictTemplates !== false;
  }
```

🔴 **`!== false`, not `?? true`.** That distinction is real and it closes a whole class of mistake.
`undefined`, `null`, `0`, `""` and every other value resolve to **strict**. The only thing that
disables the option is the literal boolean `false`. The doc comment says exactly that: *"Explicit
opt-out is required to disable strictness"*.

So all of these are strict:

```jsonc
{ "angularCompilerOptions": {} }
{ "angularCompilerOptions": { "strictTemplates": null } }
{ "angularCompilerOptions": { "strictTemplates": true } }
```

and only this is not:

```jsonc
{ "angularCompilerOptions": { "strictTemplates": false } }
```

The same getter is consulted at both extended-diagnostics gates in that file, so the `!== false`
semantics govern the extended checks as well as the core template type-checking — which is why the
compatibility error between `extendedDiagnostics` and `strictTemplates` also tests `=== false` and
not falsiness ([04c](04c-what-the-shallow-merge-costs.md)).

## Proof 3 — the CLI asserts the omission

This is the strongest evidence in the topic, because it converts an absence into an intention. From
[`workspace/index_spec.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/index_spec.ts)
at `v22.1.7`, both specs verbatim:

```ts
  it('should not add strict compiler options when false', async () => {
    const tree = await schematicRunner.runSchematic('workspace', {
      ...defaultOptions,
      strict: false,
    });
    const { compilerOptions, angularCompilerOptions } = parseJson(
      tree.readContent('tsconfig.json').toString(),
    );
    expect(compilerOptions.strict).toBeFalse();
    expect(angularCompilerOptions.strictTemplates).toBeFalse();
    expect(angularCompilerOptions.strictInputAccessModifiers).toBeUndefined();
    expect(angularCompilerOptions.strictInjectionParameters).toBeUndefined();
  });

  it('should add strict compiler options when true', async () => {
    const tree = await schematicRunner.runSchematic('workspace', {
      ...defaultOptions,
      strict: true,
    });
    const { compilerOptions, angularCompilerOptions } = parseJson(
      tree.readContent('tsconfig.json').toString(),
    );
    expect(compilerOptions.strict).toBeUndefined();
    expect(angularCompilerOptions.strictTemplates).toBeUndefined();
    expect(angularCompilerOptions.strictInputAccessModifiers).toBeTrue();
    expect(angularCompilerOptions.strictInjectionParameters).toBeTrue();
  });
```

🔴 Read the second spec again. In the **`strict: true`** case — the default —
`expect(compilerOptions.strict).toBeUndefined()` and
`expect(angularCompilerOptions.strictTemplates).toBeUndefined()`. Upstream is asserting that the
strict workspace does **not** contain the strict settings. Which lines the schematic *does* write,
and why `--strict` is the branch with fewer settings, is
[05b · What the CLI writes, and what it refuses to](05b-what-the-cli-writes-and-does-not-write.md).

## Gotchas

**★ Symptom: you grep a new project's `tsconfig.json` for `strictTemplates`, find nothing, and
conclude template type-checking is off.** Cause: the CLI writes only negations; the default lives in
the compiler. Fix: to make the setting visible to your team, write it explicitly — it changes
nothing about the build, and it documents the decision:

```jsonc
{
  "angularCompilerOptions": {
    "strictTemplates": true
  }
}
```

**★ Symptom: you wrote `"strictTemplates": null`, or `0`, or the string `"false"`, and templates are
still checked.** Cause: `this.options.strictTemplates !== false` — only the literal boolean `false`
opts out, and JSON's `"false"` is a string. Fix: write the boolean, or delete the key to take the
default:

```jsonc
{
  "angularCompilerOptions": {
    "strictTemplates": false
  }
}
```

**★ Symptom: a blog post, a Stack Overflow answer or angular.dev tells you to *enable*
`strictTemplates`, and you cannot find where it is disabled.** Cause: the advice predates v22 — the
option became an opt-out in 22.0.0 and much of the ecosystem still describes it as an opt-in.
[01 · 14f](../01-compiler-with-a-framework-attached/14f-what-stricttemplates-actually-switches.md)
catalogues exactly which documentation is stale. Fix: there is nothing to enable; check instead
whether something disabled it, and grep all three tsconfigs for the literal `false`.

**Symptom: your editor reports template errors the build does not, or the reverse.** Cause: the
language service reads the same config, but Angular 22.1.0's changelog carries, under
`### language-service`, `fix | account for strictTemplates being enabled by default` — an editor
running an older `@angular/language-service` can disagree with the compiler about the absent-key
case. Fix: pin the language service to the compiler's version:

```jsonc
{
  "devDependencies": {
    "@angular/compiler-cli": "22.1.5",
    "@angular/language-service": "22.1.5"
  }
}
```

**Symptom: you set `"strictTemplates": false` and the build now fails with a configuration error
about `extendedDiagnostics`.** Cause: `verifyCompatibleTypeCheckOptions` rejects the combination,
testing `options.strictTemplates === false` against the *resolved* options. Fix: apply one of the two
remedies the message itself names — remove the opt-out, or remove the `extendedDiagnostics` block.
The full text and the inheritance angle are in [04c](04c-what-the-shallow-merge-costs.md):

```jsonc
{
  "angularCompilerOptions": {
    "strictTemplates": false
  }
}
```

**Symptom: template type-checking behaviour changed after an Angular upgrade, with no change to any
file in your repository.** Cause: the option's default lives in the compiler, so upgrading the
compiler can change the build. Fix: this is exactly why a migration writes the old behaviour back
in — see [05c · What the upgrade wrote into your file](05c-what-the-upgrade-wrote-into-your-file.md).

## Interview questions

**★ Is `strictTemplates` on or off in a fresh Angular 22 app, and how would you prove it from the
generated files?**
On — and you cannot prove it from the generated files, which is the point. The root `tsconfig.json`
does not contain the key at all, because the CLI writes only the negations. The proof is elsewhere:
`public_options.ts` documents *"Defaults to `true`"*, `compiler.ts` implements
`return this.options.strictTemplates !== false;` with the comment *"Explicit opt-out is required to
disable strictness"*, and the CLI's own workspace spec asserts
`expect(angularCompilerOptions.strictTemplates).toBeUndefined()` for the strict case. Three sources,
none of them your project's files.

**★ Why `!== false` rather than `?? true`?**
So that only an explicit boolean `false` opts out. The two agree on `undefined` and on `null`, and
they differ in what they *say*: `??` invites the reading "supply a default for a missing value",
whereas `!== false` states a policy — strictness is the state of the world unless somebody wrote the
word `false`. The source comment puts it in one line: *"Explicit opt-out is required to disable
strictness"*. It closes the "I set it to something falsy and expected it off" class of mistake,
which matters because tsconfig is JSON and people write `0`, `""` and `null` into it.

**★ Your tsconfig does not describe your build. So what does?**
The compiler's defaults, plus whatever the resolved config overrides. In practice: read the option's
JSDoc in `public_options.ts` for the documented default, read the getter in `compiler.ts` for how
that default is resolved — `!== false` and `?? true` are both in use in the same file — and treat
the tsconfig as a diff against that baseline. The corollary is that upgrading Angular can change
your build without changing a file in your repository, which is exactly what 22.0.0 did.

**Someone asks you to "turn on strict mode" in an Angular 22 project. What do you check first?**
Whether anything turned it off. In v22 the interesting states are all opt-outs: a literal
`"strictTemplates": false`, a `"strict": false`, or a leaf tsconfig overriding an inherited value.
Grep for `false` across all three configs rather than for the option names — and remember that
`angularCompilerOptions` inherits through `extends` by Angular's own rules
([04](04-angularcompileroptions-and-how-it-inherits.md)), so the value that governs the build may
not be in the file the build names.

**Does `strictTemplates` being absent mean the same thing in the editor as it does in the build?**
It should, because the language service reads the same configuration through the same compiler
package — but it did not always. Angular 22.1.0 shipped a language-service fix described in the
changelog as *account for strictTemplates being enabled by default*, which is direct evidence that
the two disagreed about the absent-key case for one minor. If an editor and a build disagree about
template errors on v22, version skew between `@angular/language-service` and `@angular/compiler-cli`
is the first thing to rule out.

**What is the practical difference between writing `"strictTemplates": true` and omitting it?**
For the compiler, none — `!== false` treats both identically. For your team, a great deal: the
explicit line survives a code review, a grep, and a new joiner reading the config, and it does not
change meaning when the framework's default moves again. The cost is that it is one more line the
next migration has to reason about, and migrations do inspect it: the v22 one skips any file whose
resolved `strictTemplates` is already defined.

{/* FOOTER */}
