---
title: "The compile-time half of the pin is the literal first statement of a compilation — it throws a plain `Error` with no error code, no file name and no line number, before a single template has been parsed, which is exactly why nobody recognises it"
sidebar_label: "01b · The check inside the compiler"
sidebar_position: 1.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against `angular/angular` at tag `v22.1.5` —
> [`packages/compiler-cli/src/typescript_support.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/typescript_support.ts)
> (read in full) and
> [`packages/compiler-cli/src/ngtsc/program.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/program.ts)
> (the `NgtscProgram` constructor) — and angular.dev
> [Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options).
> Documentation-validated; **no sandbox run** — no build was executed and no error output was captured.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[01](01-the-typescript-peer-pin.md) established that the range `>=6.0 <6.1` is enforced in two places. This page is the second place, and it is smaller and blunter than people expect: two string constants, one comparison, one `throw new Error(...)`, run unconditionally at the top of `NgtscProgram`'s constructor. There is no error code, so there is no page on angular.dev to find. There is no file name and no line number, because the throw happens before the compiler has a diagnostic channel to report into — nothing has been analysed yet. The result is a message that looks like the toolchain broke rather than like a configuration problem, and that misreading is what sends people to reinstall `node_modules` instead of reading the version in the sentence.**

## The file that carries the range

`packages/compiler-cli/src/typescript_support.ts` at `v22.1.5`, complete apart from the licence header:

```ts
import ts from 'typescript';

import {compareVersions} from './version_helpers';

/**
 * Minimum supported TypeScript version
 * ∀ supported typescript version v, v >= MIN_TS_VERSION
 *
 * Note: this check is disabled in g3, search for
 * `angularCompilerOptions.disableTypeScriptVersionCheck` config param value in g3.
 */
const MIN_TS_VERSION = '6.0.0';

/**
 * Supremum of supported TypeScript versions
 * ∀ supported typescript version v, v < MAX_TS_VERSION
 * MAX_TS_VERSION is not considered as a supported TypeScript version
 *
 * Note: this check is disabled in g3, search for
 * `angularCompilerOptions.disableTypeScriptVersionCheck` config param value in g3.
 */
const MAX_TS_VERSION = '6.1.0';

/**
 * The currently used version of TypeScript, which can be adjusted for testing purposes using
 * `setTypeScriptVersionForTesting` and `restoreTypeScriptVersionForTesting` below.
 */
let tsVersion = ts.version;

export function setTypeScriptVersionForTesting(version: string): void {
  tsVersion = version;
}

export function restoreTypeScriptVersionForTesting(): void {
  tsVersion = ts.version;
}

/**
 * Checks whether a given version ∈ [minVersion, maxVersion[.
 * An error will be thrown when the given version ∉ [minVersion, maxVersion[.
 *
 * @param version The version on which the check will be performed
 * @param minVersion The lower bound version. A valid version needs to be greater than minVersion
 * @param maxVersion The upper bound version. A valid version needs to be strictly less than
 * maxVersion
 *
 * @throws Will throw an error if the given version ∉ [minVersion, maxVersion[
 */
export function checkVersion(version: string, minVersion: string, maxVersion: string) {
  if (compareVersions(version, minVersion) < 0 || compareVersions(version, maxVersion) >= 0) {
    throw new Error(
      `The Angular Compiler requires TypeScript >=${minVersion} and <${maxVersion} but ${version} was found instead.`,
    );
  }
}

export function verifySupportedTypeScriptVersion(): void {
  checkVersion(tsVersion, MIN_TS_VERSION, MAX_TS_VERSION);
}
```

That is the entire mechanism. **The range that governs your build is two hard-coded string literals in a file with no configuration input** — not a semver range parsed out of a manifest, not a value read from `package.json`, not something a lockfile or an `overrides` block can reach.

## It is the literal first statement of the compilation

From `packages/compiler-cli/src/ngtsc/program.ts` at `v22.1.5`, the opening of the `NgtscProgram` constructor:

```ts
    const perfRecorder = ActivePerfRecorder.zeroedToNow();

    perfRecorder.phase(PerfPhase.Setup);

    // First, check whether the current TS version is supported.
    if (!options.disableTypeScriptVersionCheck) {
      verifySupportedTypeScriptVersion();
    }
```

🔴 **`// First, check whether the current TS version is supported.` — the comment is not a summary, it is the position.** The check runs before the `ts.Program` is built, before any file is read for analysis, before a single decorator is evaluated and long before a template is parsed. Nothing about your project has been examined at the moment it fails.

That timing explains everything about how the failure presents:

- **No file name and no line number.** Angular's diagnostics are `ts.Diagnostic` objects carrying a source file and a span; producing one requires a program. There is no program yet, so the only channel available is a thrown exception.
- **It aborts, it does not accumulate.** A type error lets the compilation finish and report every other type error alongside it. This one ends the compilation at statement three.
- **It reproduces identically on every build, including incremental ones.** It is in the constructor, so every new `NgtscProgram` re-runs it — a watch rebuild, a fresh CI run and a cold `ng build` all fail the same way at the same moment.
- **It is invariant to your code.** Deleting files, emptying a component, or reverting the commit you suspect changes nothing, because none of that has been read. This is the property that makes people distrust their git history for an hour.

## The error string, and two renderings of one interval

The template, verbatim from the source above:

`` `The Angular Compiler requires TypeScript >=${minVersion} and <${maxVersion} but ${version} was found instead.` ``

With the `v22.1.5` constants substituted, a project sitting on TypeScript 7.0.2 is told:

`The Angular Compiler requires TypeScript >=6.0.0 and <6.1.0 but 7.0.2 was found instead.`

🔴 **Note that this does not textually match the peer range.** `package.json` says `>=6.0 <6.1`; the error says `>=6.0.0 and <6.1.0`. Same interval, two renderings — the manifest carries a hand-written two-part semver range, and the error interpolates the two three-part constants with the word `and` between them. Both forms are correct and neither is a typo. When you are grepping a build log, searching for the string in the manifest will not find the string in the error, and that costs a search.

## There is no `NG` code, and looking for one is the natural mistake

Angular's diagnostics almost all carry an `NG` number that maps to a page under `angular.dev/errors`, and topic 01 explains why those numbers are really TypeScript diagnostic codes in [13c](../01-compiler-with-a-framework-attached/13c-the-ng-error-code-is-a-typescript-code.md). This one is different, and the difference is visible in the source: `checkVersion` calls `throw new Error(...)`. Not a `RuntimeError`, not a diagnostic factory, no error-code enum member, no `Find more at …` suffix appended to the message.

**So there is no `NG` code to search, no error page to read, and no entry in the error reference.** A reader who assumes every Angular build failure has a code will spend their first minutes looking for one that was never assigned. The searchable artefact is the message text itself.

## The interval is half-open, and the doc comments say so in set notation

Both constants are documented with an explicit quantifier, verbatim from the file:

> *"∀ supported typescript version v, v >= MIN_TS_VERSION"*

> *"∀ supported typescript version v, v < MAX_TS_VERSION"*

> *"MAX_TS_VERSION is not considered as a supported TypeScript version"*

and `checkVersion`'s own comment uses the reverse-bracket notation for a half-open interval:

> *"Checks whether a given version ∈ [minVersion, maxVersion[."*

`MAX_TS_VERSION` is a **supremum**, not a maximum. `6.0.9` is supported; `6.1.0` is not, and neither is anything above it. The one place this catches people is the assumption that a `.0` release is the boundary and therefore included — it is the boundary and therefore excluded.

## `compareVersions` is Angular's own, and one consequence is unsettled

The comparison is not semver's range satisfaction. It is `compareVersions` imported from `./version_helpers` — Angular's own implementation, applied to three plain strings.

⚠️ **What that leaves open: how a TypeScript pre-release version compares.** `version_helpers.ts` was not read while writing this page, so the behaviour of `compareVersions` on a value like `6.1.0-beta` or `7.0.0-rc` is **not settled here** — a pre-release could compare below `6.1.0` and pass a check it morally fails, or compare above and be rejected, and nothing quoted on this page decides which. Treat installing a pre-release TypeScript under Angular as unspecified territory rather than assuming either outcome. The safe move is the one the CLI already makes for you: a `~` range on a released version.

## The testing seam, and *which* TypeScript is being checked

Three lines in that file exist only for Angular's own tests, and they are worth reading anyway because they answer a question the rest of the file does not:

```ts
let tsVersion = ts.version;

export function setTypeScriptVersionForTesting(version: string): void {
  tsVersion = version;
}

export function restoreTypeScriptVersionForTesting(): void {
  tsVersion = ts.version;
}
```

**`tsVersion` is initialised from `ts.version` — a property of the `typescript` module object this file imported.** Not a version read from a manifest, not the output of `tsc --version` on your `PATH`, not whatever your editor bundles. The version that decides your build is the one belonging to the `typescript` module that this compilation resolved and loaded.

That is the mechanism behind the most confusing shape this failure takes: a monorepo where two workspaces have identical configuration and only one builds, because module resolution reached a different copy of `typescript` in each. `npm ls typescript --all` answers it; reading `package.json` does not.

## `disableTypeScriptVersionCheck` — what it switches off, precisely

The flag is real, public, and named twice in the source comments — *"Note: this check is disabled in g3, search for `angularCompilerOptions.disableTypeScriptVersionCheck` config param value in g3"* — where `g3` is Google's internal monorepo. angular.dev documents it on the compiler-options reference:

> *"When `true`, the compiler does not look at the TypeScript version and does not report an error when an unsupported version of TypeScript is used."*

Read the two halves of that sentence separately, because they are the whole story. It does not *look*, and it does not *report*. **It does not make the unsupported version work.** The `if (!options.disableTypeScriptVersionCheck)` in the constructor skips a call to `verifySupportedTypeScriptVersion()` and nothing else — every incompatibility the check was standing in front of is still there, and now arrives without a label: a crash inside a transformer, a `SyntaxKind` that does not exist, a type-check block that will not compile, or a `.d.ts` that emits missing declarations.

The fuller angular.dev entry, including the default and the recommendation against it, is quoted in [13b](../01-compiler-with-a-framework-attached/13b-ngc-is-tsc-and-the-typescript-pin.md), which also argues *why* the coupling exists — the list of TypeScript internals `ngtsc` builds on. This page is deliberately only about when and where the check fires.

## Gotchas

**★ Symptom: `The Angular Compiler requires TypeScript >=6.0.0 and <6.1.0 but 7.0.2 was found instead.`** Cause: `typescript@latest` moved to the next major while Angular 22.1.5's window stayed on the 6.0 line. Fix: put the version back inside the window, at the range the CLI itself writes, and reinstall so the lockfile records it:

```json
"devDependencies": {
  "typescript": "~6.0.2"
}
```

**★ Symptom: the build fails instantly, names no file, and reverting your last three commits changes nothing.** Cause: the check runs at the top of the constructor, before any of your code is read — your commits are not a variable in it. Fix: stop bisecting your source and read the version in the message, then compare it against what is resolved:

```bash
npm ls typescript --all
node -p "require('@angular/compiler-cli/package.json').peerDependencies.typescript"
```

**★ Symptom: you searched the `NG` error reference for this failure and found nothing.** Cause: it is a plain `Error` from `checkVersion` with no error code — there is no `NG` number and no page for it. Fix: search the message text instead, and remember the shape difference: the error prints `>=6.0.0 and <6.1.0` while the manifest prints `>=6.0 <6.1`, so a grep for one will not find the other.

**★ Symptom: you set `disableTypeScriptVersionCheck: true` and now have hundreds of unrelated type errors in files you never touched.** Cause: the check was the guardrail, not the fault. With it off, the compiler proceeds to generate type-check blocks and consume TypeScript internals whose shapes moved between majors. Fix: delete the flag — its default is what you want — and pin the version instead:

```json
"angularCompilerOptions": {
  "strictInjectionParameters": true,
  "strictInputAccessModifiers": true
}
```

with `disableTypeScriptVersionCheck` absent from the object entirely, plus the `~6.0.2` pin above.

**★ Symptom: `ng build` succeeds and `ng test` throws the version error, in the same project on the same install.** Cause: the flag reaches the compiler as an `angularCompilerOptions` key from *whichever config that compilation resolved*, and the app and spec configs are siblings rather than a chain — a key added to `tsconfig.app.json` is invisible to the spec program ([03b](03b-the-app-and-spec-configs.md)). So one program is suppressing the check and the other is not. Fix: delete the flag from the leaf and pin the version; if a suppression genuinely has to exist, the root is the only place it applies to both:

```json
"angularCompilerOptions": {
  "enableI18nLegacyMessageIdFormat": false
}
```

**Symptom: you added `disableTypeScriptVersionCheck` and it changed nothing at all.** Cause: it was placed in `compilerOptions`. It is an Angular option and Angular reads only `angularCompilerOptions`; the two are sibling objects with two different consumers. Fix — the key has to be in the Angular object to be seen, and the constructor reads exactly this name:

```json
"compilerOptions": {
  "target": "ES2022"
},
"angularCompilerOptions": {
  "disableTypeScriptVersionCheck": true
}
```

⚠️ Shown so the failure is recognisable, not as a recommendation — the option removes the message and not the incompatibility.

**★ Symptom: two workspaces in one monorepo, identical `tsconfig`s and one lockfile — one builds and one throws the version error.** Cause: `tsVersion` is initialised from `ts.version` on the loaded `typescript` module, so what governs is module resolution, not the manifest. A hoisted copy at the root and a nested copy under one package are enough. Fix: find every copy and collapse them to one:

```bash
npm ls typescript --all
```

```json
"overrides": {
  "typescript": "~6.0.2"
}
```

**Symptom: TypeScript `6.1.0` was installed on the assumption that `<6.1` allows the `6.1.0` release itself.** Cause: `MAX_TS_VERSION` is a supremum — the source comment says *"MAX_TS_VERSION is not considered as a supported TypeScript version"* and the interval is written `[minVersion, maxVersion[`. Fix: `6.0.x` is the supported line in its entirety; `6.1.0` is the first excluded version, not the last included one.

**Symptom: a pre-release TypeScript was installed to test an upcoming feature and the outcome is confusing.** Cause: the comparison is Angular's own `compareVersions` over plain strings, and how it treats a pre-release suffix is not established on this page. Fix: do not run Angular on a pre-release TypeScript to learn what happens — the result is unspecified here, and a build that *passes* the check is not evidence the combination is supported.

**Symptom: the version error appears in CI only, never locally.** Cause: your local `node_modules` predates the change that moved the version, and the lockfile or the range now resolves differently on a clean install. Fix: reproduce the clean install rather than the incremental one, then pin:

```bash
rm -rf node_modules
npm ci
npm ls typescript
```

**Symptom: the check fires even though `ng build` is not being run — it happens under the editor, or a test run, or `ngc`.** Cause: it lives in the `NgtscProgram` constructor, so anything that constructs an Angular compilation hits it, not just the CLI's build target. Fix: the fix is the same in every case, because the cause is the same; there is no per-tool configuration to change.

## Interview questions

**★ Why does the TypeScript version error have no file name, no line number and no `NG` code?**
Because it is thrown before a compilation exists to attach any of those to. The check is the first statement of `NgtscProgram`'s constructor, ahead of program construction and all analysis, so there is no `ts.SourceFile`, no span and no diagnostic collection to report into — the only mechanism available at that point is `throw new Error(...)`, which is exactly what `checkVersion` does. The absence of an `NG` code follows from the same choice: the value thrown is a plain `Error`, not one of Angular's coded diagnostics, so nothing maps it to an entry in the error reference. The practical consequence worth stating in an interview is that this failure is diagnosed by reading its own message, not by looking anything up.

**★ What does `disableTypeScriptVersionCheck` actually do, and when is setting it legitimate?**
It skips one call — `verifySupportedTypeScriptVersion()` — and changes nothing else about the compilation. angular.dev's wording is precise: the compiler *"does not look at the TypeScript version and does not report an error when an unsupported version of TypeScript is used."* It does not make an unsupported version supported; it removes the clearest error you will ever get about it and lets you discover the incompatibility as a crash somewhere further in. Its documented home is Google's internal monorepo, named twice in the source comments, where TypeScript and Angular are built from head in a single repository and the version is managed globally. In an application repository it converts a five-second diagnosis into a long one.

**★ Someone silenced the peer warning with `--legacy-peer-deps`. What happens at build time?**
Nothing changes at build time, which is the entire point of the two-mechanism design. The flag operates on npm's tree building; the compiler's check operates on `ts.version` from the module that the compilation loaded. The install now succeeds and the build fails with a message that names neither `npm` nor a package — so the flag has converted a labelled, install-time failure into an unlabelled, build-time one. Worth adding: because the check is in the constructor, this reproduces on every build, in every environment, which at least means it is not intermittent.

**Why does the error text say `>=6.0.0 and <6.1.0` when `package.json` says `>=6.0 <6.1`?**
Because they are two independent statements of one interval. The manifest holds a hand-written semver range string; the error is a template literal interpolating `MIN_TS_VERSION` and `MAX_TS_VERSION`, which are three-part version strings, with the word `and` inserted between them. Nothing derives one from the other — the range in the manifest and the constants in the compiler are separately maintained, which is also why they could in principle disagree. When searching logs or code, search for both forms.

**Angular's supported range is `[6.0.0, 6.1.0)`. Is `6.1.0` supported?**
No. `MAX_TS_VERSION` is documented as a supremum, with the comment *"MAX_TS_VERSION is not considered as a supported TypeScript version"*, and `checkVersion` fails on `compareVersions(version, maxVersion) >= 0`. The interval is half-open, written `[minVersion, maxVersion[` in the source's own notation. Every `6.0.x` patch is in; `6.1.0` is the first version out.

**What is `setTypeScriptVersionForTesting` doing in a file that ships to every Angular user?**
It is a test seam — it lets Angular's own suite drive `checkVersion` against arbitrary version strings without installing them. The more useful thing it reveals is the line above it: `tsVersion` is initialised from `ts.version` on the imported `typescript` module. That tells you the check reads a *loaded module*, not a manifest, not the global `tsc`, and not your editor's bundled TypeScript — which is the mechanism behind every "same config, different result" report in a monorepo.

**A build fails with this error in CI and passes on three developers' machines. Where do you look first?**
At what is resolved on disk in each place, not at the configuration. The check reads the version off the `typescript` module the compilation loaded, so the question is which copy each environment resolves — a stale `node_modules` locally versus a clean `npm ci` in CI is the most common answer, followed by a hoisting difference in a workspace and then an `overrides` or `resolutions` entry that only one lockfile carries. `npm ls typescript --all` in each environment settles it in one command; comparing `package.json` files does not, because the file is not what is being read.

{/* FOOTER */}
