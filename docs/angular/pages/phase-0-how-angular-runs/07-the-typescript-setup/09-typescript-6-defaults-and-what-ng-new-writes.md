---
title: "A generated v22 tsconfig contains no `\"strict\": true` and the project is strict anyway — TypeScript 6.0 flipped the default, Angular 22 flipped `strictTemplates`, and the CLI now writes only the negations, which inverts how you read the file"
sidebar_label: "09 · TypeScript 6 defaults"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against the
> [TypeScript 6.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html),
> §"Simple Default Changes" (read on 2026-09-09; every sentence below is quoted from it) —
> **independently corroborated** by `microsoft/TypeScript`'s
> [`src/compiler/utilities.ts`](https://github.com/microsoft/TypeScript/blob/v6.0.2/src/compiler/utilities.ts)
> at `v6.0.2` against `v5.9.2`, where `getStrictOptionValue` changed from `!!compilerOptions.strict`
> to `compilerOptions.strict !== false` — and `angular/angular-cli` at tag `v22.1.7`:
> [`packages/schematics/angular/workspace/files/tsconfig.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/tsconfig.json.template)
> and
> [`packages/schematics/angular/workspace/index_spec.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/index_spec.ts).
> Documentation-validated; **no sandbox run** — no compiler was executed and no output was captured.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Read a v22 `tsconfig.json` the way you would have read a v17 one and you will conclude the project is
not strict. It is. The file contains no `"strict": true` and no `"strictTemplates": true`, because both
are now defaults — one from TypeScript 6.0, one from Angular 22.0.0 — and the CLI writes only the
negations.** That inversion is the single most misleading thing about the generated file, and it is
deliberate: upstream's own test asserts the omission.

What each remaining key in `compilerOptions` is actually for, and which of them you may change, is
[09b](09b-the-generated-compileroptions-line-by-line.md).

## TypeScript 6.0's default changes, verbatim

From the release notes, §"Simple Default Changes":

> **`strict` is now `true` by default** — *"The appetite for stricter typing continues to grow, and
> we've found that most new projects want `strict` mode enabled. If you were already using
> `"strict": true`, nothing changes for you. If you were relying on the previous default of `false`,
> you'll need to explicitly set `"strict": false` in your `tsconfig.json`."*

> **`module` defaults to `esnext`** — *"Similarly, the new default `module` is `esnext`, acknowledging
> that ESM is now the dominant module format."*

> **`target` defaults to the current-year ES version** — *"The new default `target` is the most recent
> supported ECMAScript spec version (effectively a floating target). Right now, that target is
> `es2025`. This reflects the reality that most developers are shipping to evergreen runtimes and
> don't need to compile down to older ECMAScript versions."*

> **`noUncheckedSideEffectImports` is now `true` by default** — *"This helps catch issues with typos in
> side-effect-only imports."*

> **`libReplacement` is now `false` by default** — *"This flag previously incurred a large number of
> failed module resolutions for every run, which in turn increased the number of locations we needed
> to watch under `--watch` and editor scenarios. In a new project, `libReplacement` never does anything
> until other explicit configuration takes place, so it makes sense to turn this off by default for the
> sake of better performance by default."*

and the escape clause that applies to all five:

> *"If these new defaults break your project, you can specify the previous values explicitly in your
> `tsconfig.json`."*

**The same change is visible in the compiler itself**, which is worth knowing because it settles the
question without depending on prose. Every individual strict flag resolves through one function, and
that function changed:

```ts
// microsoft/TypeScript at v5.9.2 — absent means OFF
export function getStrictOptionValue(compilerOptions: CompilerOptions, flag: StrictOptionName): boolean {
    return compilerOptions[flag] === undefined ? !!compilerOptions.strict : !!compilerOptions[flag];
}
```

```ts
// microsoft/TypeScript at v6.0.2 — absent means ON
export function getStrictOptionValue(compilerOptions: CompilerOptions, flag: StrictOptionName): boolean {
    return compilerOptions[flag] === undefined ? (compilerOptions.strict !== false) : !!compilerOptions[flag];
}
```

`!!compilerOptions.strict` became `compilerOptions.strict !== false`. Note the idiom: **only the
literal `false` opts out**, exactly as with Angular's `strictTemplates`
([07c](07c-the-escape-hatches-are-ranked.md)). Two different compilers, written by different teams,
reached the same rule — *an omission is never a decision.*

## Why this lands in every Angular 22 project

Angular 22.1.5's TypeScript peer range is `>=6.0 <6.1` and the CLI writes `~6.0.2` into a new
workspace's `package.json`. There is no supported configuration of Angular 22 running a TypeScript
where `strict` still defaults to `false`. The defaults are not something a workspace might have; they
are guaranteed by the pin ([01](01-the-typescript-peer-pin.md), [02](02-why-the-pin-is-one-minor-wide.md)).

⚠️ **And the pin is why `npm i typescript@latest` breaks the build.** On 2026-09-09 `typescript`'s
`latest` tag on npm was **7.0.2** — a whole major outside Angular 22.1.5's range. The ordinary instinct
to keep tooling current installs a compiler Angular refuses to compile with. That is arithmetic between
two release trains, not a bug, and a later Angular minor may widen the range.

## The file that proves the inversion

The resolved output of `ng new` at v22, with default options:

```jsonc
/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
/* To learn more about Angular compiler options: https://angular.dev/reference/configs/angular-compiler-options. */
{
  "compileOnSave": false,
  "compilerOptions": {
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "experimentalDecorators": true,
    "importHelpers": true,
    "target": "ES2022",
    "module": "preserve"
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true
  },
  "files": []
}
```

🔴 **Read what is not there.** No `"strict": true`. No `"strictTemplates": true`. Both are on. The CLI
writes them only in the `--no-strict` branch, as `false`.

**This is deliberate and upstream asserts it.** From the workspace schematic's own spec, the
`strict: true` case, verbatim:

```ts
    expect(compilerOptions.strict).toBeUndefined();
    expect(angularCompilerOptions.strictTemplates).toBeUndefined();
    expect(angularCompilerOptions.strictInputAccessModifiers).toBeTrue();
    expect(angularCompilerOptions.strictInjectionParameters).toBeTrue();
```

`toBeUndefined()` on the two headline settings, in the *strict* case. That converts "the template
happens not to write it" into "the CLI intends not to write it".

## So what does `--strict` mean?

**Not "turn strictness on".** It means *do not turn the defaults off, and add the extras.*
`--no-strict` is the branch that actually writes settings — `"strict": false`,
`"strictTemplates": false`, and the omission of six keys.

⚠️ There is a third meaning again. The application schematic's schema documents `strict` as
*"Enable stricter bundle budget settings for the application."* — a build-size concern — while the
workspace schematic's template branches on the same flag to decide which compiler keys are written. One
option, two documented effects, in two different schemas. Together with `compilerOptions.strict` and
`angularCompilerOptions.strictTemplates` that is **three unrelated switches sharing one word**; say
which you mean, every time. [08](08-the-other-angular-compiler-options.md) has the table.

## Gotchas

**★ Symptom: you audited a v22 tsconfig, found no `"strict": true`, and reported the project as
non-strict.** Cause: TypeScript 6 defaults it on and the CLI writes only negations. Fix: audit for the
negations instead —

```bash
grep -rn '"strict"\|"strictTemplates"' --include='tsconfig*.json' .
```

A hit is an opt-out. No hit means both are on.

**★ Symptom: you set `"strict": false` and template type checking is still on.** Cause: two unrelated
switches. `compilerOptions.strict` is TypeScript's; `angularCompilerOptions.strictTemplates` is
Angular's and has its own default. Fix: set the other one too —

```json
{
  "compilerOptions": { "strict": false },
  "angularCompilerOptions": { "strictTemplates": false }
}
```

— and read [08d](08d-extended-diagnostics-and-the-upgrade.md) first, because that combination is a
build error if `extendedDiagnostics` is configured.

**★ Symptom: `Property 'foo' comes from an index signature, so it must be accessed with ['foo']`.**
Cause: `noPropertyAccessFromIndexSignature: true`, which the CLI writes and which is **not** part of
TypeScript's `strict` family. Fix: use bracket access, or drop the flag deliberately —

```ts
const region = process.env['AWS_REGION'];
```

**★ Symptom: you ran `npm i typescript@latest` to keep tooling current and `ng build` now refuses.**
Cause: `latest` was **7.0.2** on 2026-09-09; Angular 22.1.5's peer range is `>=6.0 <6.1`. Fix: pin back
to what the CLI itself writes —

```json
{
  "devDependencies": {
    "typescript": "~6.0.2"
  }
}
```

**★ Symptom: a project created with `--no-strict` behaves far more differently than the flag name
suggests.** Cause: that branch writes `"strict": false` and `"strictTemplates": false` **and** omits
four TypeScript flags plus two Angular strictness keys. Six settings differ, not one. Fix: treat it as
a distinct project template, and adopt settings back one at a time rather than deleting both `false`s
at once.

**Symptom: a side-effect-only import started erroring after moving to TypeScript 6.** Cause:
`noUncheckedSideEffectImports` is now `true` by default — per the release notes, *"This helps catch
issues with typos in side-effect-only imports."* Fix: correct the specifier. If the module genuinely
has no types and the import is intentional, declare it rather than restoring the old default:

```ts
// src/typings.d.ts
declare module 'legacy-polyfill';
```

**Symptom: a `lib` replacement package stopped taking effect.** Cause: `libReplacement` now defaults to
`false`. Fix: set it explicitly if you rely on it —

```json
{
  "compilerOptions": {
    "libReplacement": true
  }
}
```

**Symptom: you copied a tsconfig from a TypeScript 5-era project and behaviour changed in ways nobody
predicted.** Cause: an old file that relied on the previous defaults now inherits new ones for every
key it does not mention. Fix: the release notes' own remedy — *"If these new defaults break your
project, you can specify the previous values explicitly in your `tsconfig.json`."* Write the values you
were relying on rather than assuming the file is self-describing.

**Symptom: you added `"strict": true` "to be safe" and nothing changed.** Cause: it was already on. Fix:
nothing is broken, and the line is harmless — but it is now the only place in the file that documents a
default, which will read as meaningful to the next person. Prefer to leave the file matching what the
CLI generates.

## Interview questions

**★ A v22 `tsconfig.json` contains no `"strict": true`. Is the project strict?**
Yes. TypeScript 6.0 made `strict` default to `true`, and Angular 22 pins TypeScript to `>=6.0 <6.1`
with the CLI writing `~6.0.2`, so the default always applies. The CLI writes only the *negation*, in
the `--no-strict` branch — and its own workspace spec asserts `expect(compilerOptions.strict).toBeUndefined()`
for the strict case, which makes the omission intentional rather than accidental. The same is true of
`strictTemplates`, which Angular 22.0.0 defaulted on. The way to audit a v22 tsconfig is to grep for
opt-outs, not for opt-ins.

**★ Why does the generated file only ever write the negations?**
Because writing a value that equals the default is noise that goes stale. The moment TypeScript changed
its `strict` default, every scaffold that wrote `"strict": true` was documenting a decision it no longer
had to make, and every reader had to work out whether the line was load-bearing. Writing only
divergences keeps the file short and makes every line in it meaningful. The cost is exactly the
confusion this page exists to resolve: a short file now means "we accept the defaults", and readers
trained on older scaffolds read it as "nothing is turned on".

**★ What does `--strict` actually add, given TypeScript 6's defaults?**
Four TypeScript flags outside the `strict` family — `noImplicitOverride`,
`noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch` — and two
Angular ones, `strictInjectionParameters` and `strictInputAccessModifiers`. It adds nothing that
`strict` or `strictTemplates` already give you by default, which is precisely why the generated file
looks so short. And note that the application schematic documents the same flag as *"Enable stricter
bundle budget settings for the application"*, so it also affects `angular.json` — one option, several
unrelated effects.

**What breaks when you take a TypeScript 5-era tsconfig into a TypeScript 6 project?**
Anything it was silently relying on. `strict` flips on, so a codebase full of implicit `any` and
unchecked nulls starts failing; `module` and `target` change if they were unspecified, which changes
emitted output; `noUncheckedSideEffectImports` starts reporting typos in bare imports; and
`libReplacement` stops doing anything unless it is written down. The release notes give the remedy
directly — *"you can specify the previous values explicitly"* — and the discipline that follows is to
treat an inherited tsconfig as a set of *divergences from a moving baseline* rather than a complete
description of a build.

**Why can you not simply run `npm i typescript@latest` in an Angular workspace?**
Because Angular's compiler is a host of TypeScript's compiler rather than a consumer of its public API,
so it pins a single minor: `>=6.0 <6.1` at 22.1.5. On 2026-09-09 `typescript@latest` was 7.0.2, a whole
major outside that range, and the compiler re-checks the version from inside its own constructor on
every build — so silencing the install-time peer warning with `--force` only moves the failure to
`ng build`. The correct action is to let `ng update` move both together
([01b](01b-the-check-inside-the-compiler.md)).

{/* FOOTER */}
