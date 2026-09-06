---
title: "`ngc` accepts `tsc`'s command-line flags because `ngc` *is* `tsc` with Angular's transformers installed, and the same fact makes `@angular/compiler-cli`'s `typescript` peer range a one-minor-wide hard pin that your dependency bot will break for you"
sidebar_label: "13b · ngc is tsc, and the pin"
sidebar_position: 13.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/typescript_support.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/typescript_support.ts),
> [`packages/compiler-cli/package.json`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/package.json),
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts),
> [`CHANGELOG.md`](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md) (22.0.0 breaking changes);
> angular.dev [Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options);
> and the published `@angular/compiler-cli@22.1.5` manifest on `registry.npmjs.org`, read 2026-09-06.
> Documentation-validated; **no sandbox run** — no install was performed and no build was executed.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`@angular/compiler-cli` ships two binaries, and the interesting one is `ngc`. angular.dev describes it in a single sentence that gives away the whole architecture: it is a wrapper around `tsc`, and it takes `tsc`'s command-line options. A wrapper around a compiler is coupled to that compiler's public CLI; a *transformer inside* a compiler is coupled to its internal AST, its checker, its `SyntaxKind` enum and its diagnostic types. That is why `@angular/compiler-cli@22.1.5` declares `typescript: ">=6.0 <6.1"` — a window exactly one minor version wide, enforced by a hand-written check that throws before compilation starts.**

## `ngc`, and what it is for

From the published `@angular/compiler-cli@22.1.5` manifest:

```json
"bin": {
  "ngc": "./bundles/src/bin/ngc.js",
  "ng-xi18n": "./bundles/src/bin/ng_xi18n.js"
}
```

angular.dev's compiler-options reference, verbatim, on when you would ever reach for it:

> *"Most of the time, you interact with the Angular Compiler indirectly using Angular CLI. When debugging certain issues, you might find it useful to invoke the Angular Compiler directly. You can use the `ngc` command provided by the `@angular/compiler-cli` npm package to call the compiler from the command line."*

> *"The `ngc` command is a wrapper around TypeScript's `tsc` compiler command. The Angular Compiler is primarily configured through `tsconfig.json` while Angular CLI is primarily configured through `angular.json`."*

> *"Besides the configuration file, you can also use `tsc` command line options to configure `ngc`."*

🔴 **That last sentence is the cleanest one-line proof in the whole topic.** A tool takes another tool's command-line flags when it *is* that tool with something added. `ngc` parses your `tsconfig.json`, builds a `ts.Program`, constructs an `NgCompiler`, asks it for transformers, and calls `emit`. It is [13](13-where-the-compiler-runs-ngtsc.md) with a `main()` around it.

**What `ngc` gives you that `ng build` does not** is a compilation with nothing else in the way: no bundler, no dev server, no optimiser, no `angular.json`. When you need to know whether a diagnostic comes from Angular's compiler or from the build pipeline wrapped around it, that isolation is the point:

```bash
# One compilation, driven only by tsconfig.json. Adds tsc's own flags freely.
npx ngc -p tsconfig.app.json --noEmit
npx ngc -p tsconfig.app.json --listFiles
```

⚠️ `--noEmit` and `--listFiles` are `tsc`'s flags, and the documentation's *"you can also use `tsc` command line options to configure `ngc`"* is what licenses passing them. That Angular's own diagnostics are still produced under `--noEmit` follows from where they come from — `NgCompiler.getDiagnostics`, not the emit path — but I did not run either command, so treat the second line as the safer of the two if you only need the file list.

**What it does not give you** follows from the same fact. `tsc` emits one JavaScript file per TypeScript file; it does not bundle. So `ngc` produces `.js` and `.d.ts` and stops — no chunk splitting for your `@defer` blocks ([11](11-why-defer-can-split-a-bundle.md) is explicit that the compiler emits the dynamic `import()` and the *bundler* turns it into a chunk), no `index.html`, no assets, no hashed filenames, no styles pipeline beyond what the compiler itself inlines. `ngc` is a diagnostic instrument, not an alternative build.

The second binary, `ng-xi18n`, is the i18n message extractor. It is out of scope here beyond noting that it exists in the same package and for the same reason: extraction needs the compiler's parsed templates.

## The version check, in full

`packages/compiler-cli/src/typescript_support.ts` at `v22.1.5`, verbatim:

```ts
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
```

```ts
export function checkVersion(version: string, minVersion: string, maxVersion: string) {
  if (compareVersions(version, minVersion) < 0 || compareVersions(version, maxVersion) >= 0) {
    throw new Error(
      `The Angular Compiler requires TypeScript >=${minVersion} and <${maxVersion} but ${version} was found instead.`,
    );
  }
}
```

So the string to search for when a build dies with a message that names none of your files is:
`The Angular Compiler requires TypeScript >=6.0.0 and <6.1.0 but 6.1.2 was found instead.` — with your own TypeScript version in the final slot. Note the comparison: the maximum is a **supremum**, excluded. `6.1.0` itself is not supported.

The published peer range says the same thing in semver: `"typescript": ">=6.0 <6.1"`. The repo's own `package.json` marks that peer `peerDependenciesMeta.typescript.optional: true`, and `packages/compiler-cli/package.json` pins `devDependencies.typescript` to exactly `"6.0.3"` — the one version the team compiles against.

## Why the window is one minor wide, argued rather than asserted

The honest answer is not "the Angular team is cautious". It is that **`ngtsc` consumes TypeScript's internals, and TypeScript's semver covers the language, not the compiler API.** Every item below is visible in source quoted across this topic:

| what `ngtsc` uses | where it shows up |
|---|---|
| `ts.TransformerFactory<ts.SourceFile>`, `ts.CustomTransformers` with `before` and `afterDeclarations` | [13](13-where-the-compiler-runs-ngtsc.md), `prepareEmit` |
| the `ts.TypeChecker` — `getSymbolAtLocation`, `getAliasedSymbol` | reference resolution, scope building |
| `ts.SyntaxKind` — the partial evaluator switches on roughly 25 node kinds and on individual operator tokens, plus `ts.identifierToKeywordKind` and `importClause.phaseModifier` | [09c](09c-the-partial-evaluator-is-the-grammar.md) |
| `ts.DiagnosticCategory`, `ts.DiagnosticWithLocation`, `ts.DiagnosticMessageChain`, `ts.DiagnosticRelatedInformation` | [13c](13c-the-ng-error-code-is-a-typescript-code.md) — Angular's entire error surface *is* TypeScript diagnostics |
| `ts.createSourceFile`, `ts.ScriptTarget.Latest`, `ts.ScriptKind.TS` | the type-check shims |
| `ts.getOriginalNode`, `node.getStart()`, `node.getWidth()` | every source position in every Angular error |
| program reuse between builds | watch mode and incremental rebuilds |

**None of that is public-stable API in TypeScript's semver sense.** `ts.SyntaxKind` is a numeric enum whose members are added between minors. Node shapes gain fields. Transformer behaviour around synthesised nodes changes. `importClause.phaseModifier` did not exist before deferred imports did. A one-minor window is the arithmetic consequence of building on that surface, and `untagAllTsFiles` in `prepareEmit` — a workaround whose comment names *"TS 5.4"* and two GitHub issue numbers — is the proof that the coupling bites in practice, not only in principle.

**The v22 receipts.** The CHANGELOG's 22.0.0 breaking-changes section states it flatly:

> *"TypeScript versions older than 6.0 are no longer supported."*

with the corresponding feature line *"drop support for TypeScript 5.9"* (commit `8fe025f514`).

## The escape hatch, and why it is not one

`MiscOptions` in `public_options.ts`, verbatim: > *"`disableTypeScriptVersionCheck` — Disable TypeScript Version Check."* angular.dev is more explicit about the consequences:

> *"When `true`, the compiler does not look at the TypeScript version and does not report an error when an unsupported version of TypeScript is used. Not recommended, as unsupported versions of TypeScript might have undefined behavior. Default is `false`."*

🔴 **`checkVersion` is a guard, not the coupling.** Turning it off does not make an unsupported TypeScript compatible; it removes the one clear error message you would otherwise get, and replaces it with whatever the incompatibility actually does — a crash inside a transformer, a missing `SyntaxKind`, a `.d.ts` that emits without Angular's declarations, or nothing at all until a specific file is compiled. Google's internal monorepo sets it (the source comments say so twice), and Google also builds TypeScript and Angular from head in the same repository, which is a situation you are not in.

If you have reached for it, the actual fix is the pin:

```json
{
  "devDependencies": {
    "@angular/compiler-cli": "22.1.5",
    "typescript": "6.0.3"
  },
  "overrides": {
    "typescript": "6.0.3"
  }
}
```

`overrides` is npm's key; Yarn's is `resolutions` and pnpm's is `pnpm.overrides`. Use whichever your lockfile belongs to, and use an **exact** version rather than a caret — `^6.0.3` is inside Angular's range today and will not be the day TypeScript ships `6.1.0`.

## Where enforcement actually lives

The build-time `checkVersion` throw is the enforcement you can rely on. Whether your *package manager* also refuses the install is a separate question with a version-dependent answer, and this page does not claim one: the peer is marked optional in the repo manifest, and the behaviour of npm, Yarn and pnpm around optional peers with a conflicting installed version was not verified here. Assume the failure surfaces at build time, in CI, on a branch that installed cleanly.

The check you *can* run yourself, before the build tells you:

```bash
npm ls typescript
npx tsc --version
node -p "require('@angular/compiler-cli/package.json').peerDependencies.typescript"
```

The third line prints the range the installed compiler actually demands, which beats reading a release note.

## Gotchas

**★ Symptom: the build fails with a message that names neither your code nor any of your dependencies — `The Angular Compiler requires TypeScript >=6.0.0 and <6.1.0 but 6.1.2 was found instead.`** Cause: something raised TypeScript past Angular's supremum — a dependency bot, a `npm install typescript@latest`, or a transitive bump after a lockfile refresh. Fix: pin TypeScript exactly and override transitive copies, then reinstall so the lockfile records it:

```json
{
  "devDependencies": {
    "typescript": "6.0.3"
  },
  "overrides": {
    "typescript": "6.0.3"
  }
}
```

**★ Symptom: someone "fixed" the same failure with `disableTypeScriptVersionCheck: true` and the build now fails somewhere stranger — inside a transformer, or with declarations missing from a `.d.ts`.** Cause: the option removes the version check, not the incompatibility. Fix: delete the option and pin the version:

```json
{
  "compilerOptions": {
    "strict": true
  },
  "angularCompilerOptions": {
    "strictTemplates": true
  }
}
```

with `disableTypeScriptVersionCheck` absent entirely — it defaults to `false`, which is what you want.

**★ Symptom: TypeScript is pinned in `package.json` and the wrong version still loads.** Cause: a transitive dependency brought its own copy and your build resolved that one, or a workspace root and a package each have one. Fix: find every copy, then force a single one:

```bash
npm ls typescript
```

```json
{
  "overrides": {
    "typescript": "6.0.3"
  }
}
```

**Symptom: Dependabot or Renovate opens a green TypeScript-minor PR every month and one of them turns CI red for the whole team.** Cause: TypeScript looks like an ordinary devDependency and is not one — it is a peer of the compiler you are running. Fix: take it out of automated minor bumps and move it with Angular:

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["typescript"],
      "enabled": false
    }
  ]
}
```

then upgrade both together with `ng update @angular/core @angular/cli`, which moves the TypeScript pin as part of the migration.

**Symptom: you upgrade Angular and the build fails on the *minimum*, not the maximum.** Cause: the range is two-sided. Angular 22 requires TypeScript 6.0 or later, and a project that pinned `5.9.x` for stability now fails the lower bound — the CHANGELOG states *"TypeScript versions older than 6.0 are no longer supported."* Fix: run the update tool rather than editing `package.json` by hand, so the TypeScript bump and the code migrations land together:

```bash
npx ng update @angular/core @angular/cli
```

**Symptom: `ngc` succeeds but there is no application in `dist/`.** Cause: `ngc` is `tsc`; it emits `.js` and `.d.ts` per file and does not bundle, hash, inline an `index.html` or produce chunks for `@defer` blocks. Fix: use `ngc` to isolate compiler diagnostics and `ng build` to produce a deployable:

```bash
npx ngc -p tsconfig.app.json --noEmit    # diagnostics only
npx ng build                             # the actual application
```

**Symptom: `ngc` reports errors `ng build` does not, or vice versa.** Cause: they can be reading different tsconfigs. `ngc` is configured by the `-p` file you hand it; `ng build` resolves its tsconfig through `angular.json`'s build target, which usually points at `tsconfig.app.json` with a different `files`/`include` set from `tsconfig.json`. Fix: point `ngc` at the exact file the builder uses — read it out of `angular.json` rather than assuming:

```bash
node -p "require('./angular.json').projects['my-app'].architect.build.options.tsConfig"
```

**Symptom: a library builds against your Angular version in CI and fails for a consumer on a different one.** Cause: the consumer's build runs the consumer's compiler, and their TypeScript is pinned by *their* Angular. Fix: publish with `compilationMode: 'partial'` so the consumer's compiler finishes the job at their version — that mechanism is **12 · Ivy and locality** *(not written yet)*; the point here is that "which TypeScript" is never a property of your repository alone.

## Interview questions

**★ Your own code compiles under both TypeScript 5.9 and 6.0. Why can Angular 22 not run on 5.9?**
Because your code depends on the TypeScript *language*, and `ngtsc` depends on the TypeScript *compiler API*. It receives `ts.TransformerFactory` objects, walks `ts.SyntaxKind` in a partial evaluator, calls the `ts.TypeChecker`, constructs `ts.DiagnosticWithLocation` values, creates source files with `ts.createSourceFile`, and reuses programs between builds. None of that is covered by TypeScript's semver promise about the language. `@angular/compiler-cli` therefore declares `typescript: ">=6.0 <6.1"` and enforces it with `checkVersion`, which throws before compilation starts. The CHANGELOG for 22.0.0 states the lower half of that as a breaking change in one sentence: *"TypeScript versions older than 6.0 are no longer supported."*

**★ `ngc` accepts `tsc`'s command-line flags. What does that tell you about the architecture?**
That it is not a separate compiler. angular.dev says *"The `ngc` command is a wrapper around TypeScript's `tsc` compiler command"* and *"Besides the configuration file, you can also use `tsc` command line options to configure `ngc`."* A tool inherits another tool's flags when it is that tool with something installed into it — here, a `ts.CustomTransformers` object. The practical consequence is that everything `tsc` knows how to do about program construction, module resolution, incremental builds and diagnostics is what Angular does about those things too, and the Angular-specific configuration lives in a separate `angularCompilerOptions` block rather than in `compilerOptions`.

**What does `disableTypeScriptVersionCheck` actually disable, and why is reaching for it a mistake?**
It disables `checkVersion` — the two-sided comparison against `MIN_TS_VERSION = '6.0.0'` and `MAX_TS_VERSION = '6.1.0'` — and nothing else. The coupling to TypeScript's internals is unchanged; only the message telling you about it is gone. angular.dev's own wording is *"Not recommended, as unsupported versions of TypeScript might have undefined behavior."* The one environment that legitimately sets it is Google's internal monorepo, where TypeScript and Angular are built from source together, and the source comments say so at both constants.

**Why a one-minor window rather than a caret range?**
Because `MAX_TS_VERSION` is a supremum and the surface underneath it is not stable across minors. `ts.SyntaxKind` gains members, node interfaces gain fields, transformer behaviour around synthesised nodes shifts, and features like deferred imports add properties such as `importClause.phaseModifier` that the compiler then reads. Angular's own emit path carries `untagAllTsFiles` with the comment *"otherwise TS 5.4 may end up emitting references to typecheck files"* — a workaround for one specific TypeScript minor, sitting in the middle of `prepareEmit`. A caret range would be a promise the team cannot keep.

**TypeScript is declared as an optional peer dependency. Where does the enforcement really live?**
In the compiler, at build time. `checkVersion` throws a plain `Error` with the range and your version in the message before any compilation happens. The peer range in `package.json` documents the same constraint for tooling, but an optional peer is not something a package manager will install for you, and this page does not claim any particular install-time behaviour across npm, Yarn and pnpm because that was not verified. Practically: assume a clean install and a red build, and check with `npm ls typescript` rather than trusting the top-level pin.

**What is `ngc` for, and what will it never produce?**
It is for compiling a project through the Angular compiler with nothing else in the pipeline — useful when you need to know whether a diagnostic comes from `ngtsc` or from the CLI's builder, optimiser or bundler wrapped around it. It will never produce a deployable application: it is `tsc`, so it emits one `.js` and one `.d.ts` per input file and stops. No bundle, no `index.html`, no hashed assets, and no chunk for a `@defer` block — the compiler emits the dynamic import, and a bundler it does not contain is what turns that into a separate file.

---

← Prev: [13 · Where the compiler runs: `ngtsc`](13-where-the-compiler-runs-ngtsc.md) · Index: [Topic index](README.md) · Next → [The NG error code is a TypeScript diagnostic code](13c-the-ng-error-code-is-a-typescript-code.md)
