---
title: "Ten keys, and the reader's real question about each is \"can I change this?\" — two are pinned specifically to override TypeScript 6's new floating defaults, one would break every decorator in the application, one is why `tslib` is a runtime dependency, and four exist only because they are the useful flags `strict` does not include"
sidebar_label: "09b · The generated compilerOptions"
sidebar_position: 9.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against `angular/angular-cli` at tag `v22.1.7`:
> [`packages/schematics/angular/workspace/files/tsconfig.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/tsconfig.json.template)
> (the ten keys, read from the template) — and the
> [TypeScript 6.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html),
> §"Simple Default Changes", for the `target` and `module` defaults this file overrides.
> ⚠️ The claim that the four `--strict` extras sit outside TypeScript's `strict` family rests on their
> option records carrying no `strictFlag`, read at **TypeScript 5.9.3**; that reading was **not
> re-checked at 6.0.2** and is scoped as such below. The rationale for pinning `target` and `module` is
> **a reading, not a documented statement** — neither source gives it.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[09](09-typescript-6-defaults-and-what-ng-new-writes.md) explained why the generated file is short.
This is what is left in it, key by key, sorted by the only question a reader actually has: can I change
this?** Three of the ten are effectively mandatory, two are deliberate overrides of a TypeScript 6
default, four are extras the `--strict` branch adds, and one is a free choice most people never
revisit.

## The ten keys, classified

| Key | Value | Can you change it? |
|---|---|---|
| `experimentalDecorators` | `true` | 🔴 **No.** Angular's decorators are the legacy TypeScript ones; turning this off breaks every `@Component` |
| `isolatedModules` | `true` | ⚠️ **Effectively no.** The build transpiles file-by-file; constructs needing whole-program knowledge are unsafe |
| `importHelpers` | `true` | ⚠️ Only if you also remove `tslib` from `dependencies` and accept larger output |
| `target` | `"ES2022"` | 🔴 Yes, but understand what you lose — it is an **override** of TypeScript 6's floating default |
| `module` | `"preserve"` | 🔴 Same — an override of the new `esnext` default |
| `skipLibCheck` | `true` | ✅ Yes. A build-time trade, safely reversed |
| `compileOnSave` | `false` | ✅ Yes. An editor hint, and it is **top-level**, not inside `compilerOptions` |
| `noImplicitOverride` | `true` | ✅ Yes — `--strict` branch only, not part of `strict` |
| `noPropertyAccessFromIndexSignature` | `true` | ✅ Yes — `--strict` branch only, not part of `strict` |
| `noImplicitReturns` | `true` | ✅ Yes — `--strict` branch only, not part of `strict` |
| `noFallthroughCasesInSwitch` | `true` | ✅ Yes — `--strict` branch only, not part of `strict` |

(That is eleven rows for ten `compilerOptions` keys: `compileOnSave` is a sibling of `compilerOptions`,
not a member of it, and is listed here because everyone reads it as one.)

## `target` and `module` are pinned *against* the new defaults

TypeScript 6.0 made `target` *"effectively a floating target"* — currently `es2025` — and `module`
default to `esnext`. The Angular template writes `"ES2022"` and `"preserve"` anyway.

🔴 **A floating target means the same source emits different output when the compiler is upgraded.**
For an application that ships build artefacts, and for a framework that has to reason about what its
own emitted code can rely on, that is not acceptable. Pinning both makes a TypeScript patch bump a
non-event for output.

⚠️ **That rationale is a reading, not a quotation.** The release notes explain the new defaults and the
template writes the overrides; **neither states why Angular overrides them.** The argument is well
supported by the two artefacts together, but no source sentence was found that makes it, and it is
recorded here as inference.

⚠️ No `moduleResolution` key appears in the generated file. `"module": "preserve"` selecting a
resolution mode is the usual explanation, and it is what this corpus's `ng update` research recorded,
but no primary-source sentence for it was read while writing this page — treat the *reason* as
unconfirmed here even though the *absence of the key* is a fact about the template.

## `experimentalDecorators` — the one that is not optional

Angular's `@Component`, `@Injectable`, `@Directive`, `@Pipe` and `@NgModule` are **legacy TypeScript
decorators**, not the TC39 stage-3 decorators TypeScript 5 shipped. The flag selects the legacy
semantics. Removing it while "modernising" a tsconfig breaks every decorated class in the application
at once, which makes the failure look like a corrupted install rather than a config change.

## `isolatedModules` — why `import type` matters

Each file is transpiled **alone**, with no knowledge of any other file's types. A plain
`import { User } from './user'` is ambiguous under that constraint: the transpiler cannot know whether
`User` is a value that must survive into the output or a type that must be erased. `import type` says
so explicitly.

```ts
// safe under isolatedModules — the import is erased, no runtime lookup is emitted
import type { User } from './user';

// also safe, and clearer when a module exports both
import { createUser, type User } from './user';
```

The same constraint is why a value that must be *inlined* from another file — an ambient `const enum`
being the classic case — cannot work: the inlining requires reading the other file, and there is no
other file in scope. A plain `enum`, or a frozen `const` object, is the fix. Why the build works this
way at all is [topic 05](../05-the-build-angular-build/README.md).

## `importHelpers` — the reason `tslib` is a runtime dependency

TypeScript emits small helper functions for down-levelled constructs. With `importHelpers: true` it
emits **imports of them from `tslib`** instead of inlining a private copy into every file. The helpers
therefore end up in the shipped bundle, which is exactly why `tslib` sits in `dependencies` and not
`devDependencies` in the generated `package.json`. It is not a build tool; it is code your users
download.

## `skipLibCheck` — the free choice

Skips type-checking of `.d.ts` files. It trades a class of errors you cannot fix — a dependency's
declarations conflicting with another dependency's — for a faster build. It is the one key here you can
flip to `false` to see what happens with no risk to correctness of your own code, and the one most
worth flipping temporarily when a mysterious type error appears to come from nowhere.

## The four extras: what `--strict` is really adding

`noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns` and
`noFallthroughCasesInSwitch` are all written by the strict branch, and **none of them is part of
TypeScript's `strict` family** — which is why they still have to be written down after TypeScript 6
made `strict` default-on. That is what makes `--strict` meaningful at all today: it is *`strict` plus
four*, and after 6.0 the "plus four" is the only part it still has to say out loud.

⚠️ **Scope of that claim.** An option belongs to the `strict` family exactly when its record in
TypeScript's compiler option table carries a `strictFlag`. These four carry none, and each records
`defaultValueDescription: false` — **read at TypeScript 5.9.3, and not re-checked at 6.0.2.** The
inference is strong and the CLI would not write redundant keys, but the version boundary is stated
rather than glossed.

`"files": []` at the bottom of the file is not a `compilerOptions` key and is the subject of
[03c](03c-the-solution-root-and-project-references.md) — it marks the root as a solution-style config
that compiles nothing itself.

## Gotchas

**★ Symptom: every `@Component` fails after someone "modernised" the tsconfig.** Cause:
`experimentalDecorators` was removed. Angular uses legacy TypeScript decorators, not TC39 stage-3
decorators. Fix: restore it —

```json
{
  "compilerOptions": {
    "experimentalDecorators": true
  }
}
```

**★ Symptom: `import { User } from './user'` produces a runtime error about a missing export, where
`User` is only a type.** Cause: `isolatedModules: true` — each file is transpiled alone, so a
value-shaped import is emitted as a real runtime import. Fix:

```ts
import type { User } from './user';
```

**★ Symptom: `tslib` is missing at runtime, or a bundler reports it unresolved.** Cause:
`importHelpers: true` emits imports from `tslib`, so it is genuinely runtime code and belongs in
`dependencies`. Fix:

```json
{
  "dependencies": {
    "tslib": "^2.3.0"
  }
}
```

Moving it to `devDependencies` "because it is a compiler thing" is the usual way this breaks.

**★ Symptom: emitted output changed after a TypeScript patch upgrade.** Cause: only possible if
`target` was removed — TypeScript 6's default is *"effectively a floating target"*. Fix: put the
explicit target back:

```json
{
  "compilerOptions": {
    "target": "ES2022"
  }
}
```

**★ Symptom: `This member must have an 'override' modifier` on a method that has always existed.**
Cause: `noImplicitOverride: true`, written by `--strict` and not part of `strict`. Fix: add the
modifier, which is the point of the flag — it is what makes a later rename in the base class an error
rather than a silent new method:

```ts
export class AdminUser extends User {
  override displayName(): string {
    return `Admin: ${super.displayName()}`;
  }
}
```

**Symptom: an ambient `const enum` from a dependency cannot be used.** Cause: `isolatedModules`
requires each file to be transpilable alone, and inlining a `const enum` member means reading the
declaring file. Fix: use a regular `enum`, or a plain object:

```ts
export const LogLevel = {
  Debug: 0,
  Info: 1,
  Error: 2,
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];
```

**Symptom: you set `skipLibCheck: false` and got hundreds of errors from `node_modules`.** Cause:
that is what the flag was suppressing — conflicting or simply wrong declarations in dependencies, which
you cannot fix. Fix: turn it back on. Flipping it off is a *diagnostic* technique for tracking down a
strange type error, not a configuration to ship.

**Symptom: a TC39 decorator from a non-Angular library does not behave as documented.** Cause:
`experimentalDecorators: true` selects the legacy semantics for the whole program, and the two decorator
designs differ in what they receive and when they run. Fix: there is no per-file switch; a library that
requires stage-3 decorators cannot be used with its decorator API in an Angular workspace at this
version. Use its non-decorator API if it has one.

**Symptom: you moved `compileOnSave` inside `compilerOptions` while tidying the file.** Cause: it is a
**top-level** key, a sibling of `compilerOptions`. Fix: move it back out. Nothing will report this,
because unknown keys inside `compilerOptions` are not fatal and the setting simply stops being read.

**Symptom: a second developer's build emits different JavaScript from yours on the same commit.**
Cause: different resolved tsconfigs, not different TypeScript versions — `angular.json` names a
`tsConfig` per target, and `target`/`module` can differ between them if someone overrode one in a leaf.
Fix: keep `target` and `module` in the root only, and check the target's `tsConfig` option before
comparing anything else.

## Interview questions

**★ Why does Angular write `"target": "ES2022"` when TypeScript 6 already picks a target for you?**
Because TypeScript 6's default is *"effectively a floating target"* — currently `es2025` — and a
floating target means the same source emits different JavaScript when the compiler is upgraded. For a
project that ships build artefacts, and for a framework reasoning about what its emitted code can
assume, an output that moves on a patch bump is unacceptable. The same reasoning applies to pinning
`"module": "preserve"` over the new `esnext` default. Worth flagging in the answer that Angular does not
document this rationale anywhere — it is an inference from the release notes and the template together.

**★ Why is `tslib` a runtime dependency rather than a dev dependency?**
Because `importHelpers: true` makes TypeScript emit *imports* of its helper functions from `tslib`
instead of inlining a private copy into each file. The helpers therefore end up in the shipped bundle,
so `tslib` is genuinely runtime code that your users download. The trade is bundle size against
duplication: one shared copy imported everywhere, rather than the same helper repeated in every file
that needed it.

**★ Why does Angular need `experimentalDecorators`?**
Because `@Component`, `@Injectable` and the rest are **legacy** TypeScript decorators, not the TC39
stage-3 decorators TypeScript 5 shipped. The two designs differ in what the decorator receives and when
it runs, and the flag selects the legacy semantics for the whole program. It is the key in this file
you can least afford to remove: deleting it fails every decorated class simultaneously, which reads
like a broken toolchain rather than a config edit.

**★ What does `isolatedModules` require of your imports, and why?**
That type-only imports be marked — `import type { User } from './user'`, or an inline `type` specifier.
The reason is that the Angular build transpiles each file **alone**, with no view of any other file's
types, so it cannot decide for itself whether `User` is a value that must survive into the output or a
type that must be erased. The same constraint rules out anything needing whole-program knowledge, such
as inlining an ambient `const enum` member. It is a constraint imposed by the build strategy, not a
style preference.

**Which keys in a generated tsconfig can you change freely?**
`skipLibCheck`, `compileOnSave`, and the four `--strict` extras — `noImplicitOverride`,
`noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch` — which are
ordinary correctness flags outside the `strict` family and a matter of team policy.
`experimentalDecorators` and `isolatedModules` you should treat as fixed. `target` and `module` you may
change knowingly, understanding that they are deliberate overrides of TypeScript 6 defaults rather than
arbitrary values. And `importHelpers` only alongside the corresponding `package.json` change.

**What is `"files": []` doing at the bottom of the file?**
Marking the root as a **solution-style** config: it contributes options through `extends` and lists the
real projects under `references`, and has no inputs of its own — running `tsc` against it compiles
nothing by design. It is not a `compilerOptions` key at all.
[03c](03c-the-solution-root-and-project-references.md) covers how the `references` array gets there and
which tools actually read it.

---

← Prev: [TypeScript 6 defaults](09-typescript-6-defaults-and-what-ng-new-writes.md) · Index: [Topic index](README.md) · Next topic → **08 · What `ng new` produces in v22** *(not written yet)*
