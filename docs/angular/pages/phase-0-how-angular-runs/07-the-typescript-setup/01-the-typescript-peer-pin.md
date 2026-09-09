---
title: "Angular's TypeScript range is enforced twice — once by your package manager at install time, once by the compiler on every build — and the flags people reach for silence only the first, which is the half that was telling them the truth"
sidebar_label: "01 · The TypeScript peer pin"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against the published manifests on `registry.npmjs.org` —
> [`@angular/compiler-cli@22.1.5`](https://registry.npmjs.org/@angular/compiler-cli/22.1.5),
> [`@angular/build@22.1.7`](https://registry.npmjs.org/@angular/build/22.1.7),
> [`typescript` dist-tags](https://registry.npmjs.org/-/package/typescript/dist-tags) —
> and `angular/angular-cli` at tag `v22.1.7`:
> [`packages/schematics/angular/utility/latest-versions/package.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/utility/latest-versions/package.json),
> [`latest-versions.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/utility/latest-versions.ts).
> Package-manager behaviour quoted from the
> [npm v11 config reference](https://docs.npmjs.com/cli/v11/using-npm/config).
> Documentation-validated; **no sandbox run** — nothing was installed and no build was executed.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Angular declares its TypeScript dependency as `>=6.0 <6.1` — a window exactly one minor wide — and almost everyone meets it first as a peer-dependency warning during `npm install`. That framing is wrong in a way that costs an afternoon. The range is written down in `package.json`, but it is also re-implemented, independently, as a hand-written comparison inside the Angular compiler, which runs it on every single compilation. The two checks have different timing, different failure text, and different escape hatches — and the escape hatches for the install-time one (`--force`, `--legacy-peer-deps`, an `overrides` entry) do nothing whatsoever to the compile-time one. Silencing the install warning does not fix the version; it relocates the failure from `npm install`, where the message names the package and the range, to `ng build`, where it looks like the toolchain crashed.**

## The pin, exactly as published

From the published `@angular/compiler-cli@22.1.5` manifest, the three relevant objects verbatim:

```json
"peerDependencies": {
  "typescript": ">=6.0 <6.1",
  "@angular/compiler": "22.1.5"
},
"peerDependenciesMeta": {
  "typescript": {
    "optional": true
  }
},
"engines": {
  "node": "^22.22.3 || ^24.15.0 || >=26.0.0"
}
```

Read `peerDependenciesMeta` before you read `peerDependencies`. **`typescript` is an *optional* peer of `@angular/compiler-cli`.** An optional peer is a range that applies *if the package is present* and is not an instruction to install it — so `@angular/compiler-cli` alone will not cause your package manager to object very loudly, and in some resolutions will not object at all.

The same range appears again in `@angular/build@22.1.7`, and there it is not optional. Abridged to the four entries this page needs — the package declares eighteen peers in total, and the complete list with its fourteen optional entries is enumerated in [05 · The peer contract](../05-the-build-angular-build/02d-the-peer-contract.md):

```json
"peerDependencies": {
  "typescript": ">=6.0 <6.1",
  "tslib": "^2.3.0",
  "@angular/compiler": "^22.0.0",
  "@angular/compiler-cli": "^22.0.0"
}
```

`@angular/build`'s `peerDependenciesMeta` marks fourteen of its peers optional — `less`, `karma`, `rollup`, `vitest`, `postcss`, `ng-packagr`, `tailwindcss`, `@angular/ssr`, `@angular/core`, `@angular/localize`, `@angular/service-worker`, `istanbul-lib-instrument`, `@angular/platform-server`, `@angular/platform-browser` — and **`typescript` is not among them.** The build system's short list of things it flatly requires is a TypeScript compiler and an Angular compiler.

| Package | Declares `typescript` | Optional? | Who has it |
|---|---|---|---|
| `@angular/compiler-cli` **22.1.5** | `>=6.0 <6.1` | ✅ **yes** | every Angular project |
| `@angular/build` **22.1.7** | `>=6.0 <6.1` | ⛔ **no** | every CLI-built application |
| `@angular/core` **22.1.5** | — | — | — |

⚠️ **`typescript` is not a peer of `@angular/core` at all.** Say "TypeScript peer `>=6.0 <6.1`" and attribute it to `@angular/compiler-cli` and `@angular/build`, never to `core`. This is exactly why the pin surprises people: the manifest they open first is the one that says nothing about it.

The practical consequence of the optional/required split is that **the same version mismatch is loud in an application and quiet in a library.** A CLI-built application depends on both packages, so the required declaration governs and your package manager has something to complain about. A library built with `ng-packagr`, or a Bazel or Nx setup that drives `compiler-cli` without `@angular/build`, sits on the optional declaration only — and gets a much quieter install for the same broken combination.

## The two enforcement points

This table is the spine of the whole topic. Everything else on this page and the next is one of its cells expanded.

| | `peerDependencies` | The in-compiler check |
|---|---|---|
| Lives in | `@angular/compiler-cli/package.json`, `@angular/build/package.json` | `packages/compiler-cli/src/typescript_support.ts` |
| Fires at | **install time**, once | **every compilation**, in `NgtscProgram`'s constructor |
| Enforced by | npm / yarn / pnpm — and `typescript` is *optional* for `compiler-cli` | Angular itself, unconditionally |
| Failure | an `ERESOLVE` conflict, a warning, or nothing at all, depending on package manager and flags | a thrown `Error` that fails the build before any analysis |
| Names the range as | `>=6.0 <6.1` | `>=6.0.0 and <6.1.0` |
| Escape hatch | `--legacy-peer-deps`, `--force`, an `overrides` / `resolutions` entry | `angularCompilerOptions.disableTypeScriptVersionCheck` |

🔴 **The asymmetry is the point.** The left column is silenced by the three things a developer reaches for reflexively when a peer conflict blocks an install. The right column is not affected by any of them. The full compile-time half — the source, the exact error string, and what the disable flag does and does not do — is [01b · The check inside the compiler](01b-the-check-inside-the-compiler.md).

## What `ng new` actually installs

`ng new` does not install `typescript@latest`, and it does not install the widest version the peer range allows either. It writes a version the CLI hard-codes. From `packages/schematics/angular/utility/latest-versions/package.json` at `v22.1.7`, the dependency entries verbatim:

```json
"typescript": "~6.0.2",
"rxjs": "~7.8.0",
"tslib": "^2.3.0",
"zone.js": "~0.16.0",
"prettier": "^3.8.1",
"vitest": "^4.0.8",
"jasmine-core": "~6.3.0",
"karma": "~6.4.0",
"tailwindcss": "^4.1.12"
```

That file's own header comment says why it exists at all:

> *"Package versions used by schematics in @schematics/angular."*

> *"This file is needed so that dependencies are synced by Renovate."*

The map is threaded into the generated `package.json` by `latest-versions.ts`, which spreads it and then overrides the Angular-versioned entries with build-time placeholders:

```ts
const dependencies = require('./latest-versions/package.json')['dependencies'];

export const latestVersions: Record<string, string> & {
  Angular: string;
  DevkitBuildAngular: string;
  AngularBuild: string;
  AngularSSR: string;
  NgPackagr: string;
} = {
  ...dependencies,

  // As Angular CLI works with same minor versions of Angular Framework, a tilde match for the current
  Angular: '0.0.0-ANGULAR-FW-VERSION',
  NgPackagr: '0.0.0-NG-PACKAGR-VERSION',
  DevkitBuildAngular: '^0.0.0-PLACEHOLDER',
  AngularBuild: '^0.0.0-PLACEHOLDER',
  AngularSSR: '^0.0.0-PLACEHOLDER',
};
```

Two facts fall out of that, and both matter when you are reading CLI source to answer a version question:

**The `0.0.0-PLACEHOLDER` strings are substituted during the release build.** You cannot read the Angular version a given CLI installs out of the CLI's own source — the source contains a marker, and the published tarball contains a number. `~6.0.2` for TypeScript, by contrast, is literal: that is the real range a `v22.1.7` `ng new` writes into your `devDependencies`. What the rest of a generated `package.json` contains is [05 · What `ng new` installs](../05-the-build-angular-build/02e-what-ng-new-installs.md).

**`~6.0.2` is narrower than the peer range.** `~6.0.2` admits `>=6.0.2 <6.1.0`; the peer admits `>=6.0.0 <6.1.0`. So a fresh workspace starts *inside* the supported window with room for patch upgrades and none at all for a minor — the CLI declines to use the bottom of its own supported range, and declines to leave you a caret that would walk out of the top of it.

## `typescript@latest` is a whole major outside the pin

Measured on `registry.npmjs.org` on **2026-09-09**: the `latest` dist-tag of `typescript` was **7.0.2**. Angular 22.1.5's pin is `>=6.0 <6.1`. Those two do not overlap, and they are not adjacent — they are a whole major apart.

So the ordinary, responsible-looking instinct — *keep the tooling current* — installs a TypeScript that Angular 22 refuses to compile with. This is not a trap laid by anybody; it is the arithmetic of two release trains running on different cadences, and [02 · Why the pin is one minor wide](02-why-the-pin-is-one-minor-wide.md) is about why the gap is structural rather than accidental.

⚠️ **Do not carry "TypeScript 7 is unsupported by Angular" forward as a permanent fact.** It is true of **22.1.5**, measured on a date. A later Angular release may widen the pin, and the correct form of the sentence is always *"Angular 22.1.5 pins `>=6.0 <6.1`, and `typescript@latest` was 7.0.2 when this was checked."*

## What `--force` and `--legacy-peer-deps` actually do

These are the two flags that turn a five-minute problem into a two-hour one, so it is worth being exact about their contract. From the npm v11 config reference, verbatim:

> **`legacy-peer-deps`** — *"Causes npm to completely ignore `peerDependencies` when building a package tree, as in npm versions 3 through 6."*

> **`force`** — *"Allow conflicting peerDependencies to be installed in the root project."*

> **`strict-peer-deps`** — *"If set to `true`, and `--legacy-peer-deps` is not set, then _any_ conflicting `peerDependencies` will be treated as an install failure."*

Read `force`'s sentence as the statement about the default that it is: **without the flag, a conflicting peer at the root is not installed.** That refusal is the entire value npm was adding. `--legacy-peer-deps` goes further and stops evaluating the field at all, which means it also stops evaluating every *other* peer range in your tree — you did not disable one check, you disabled the mechanism.

An `overrides` entry (npm) or a `resolutions` entry (Yarn) is a third variant of the same move: it rewrites what gets installed rather than what gets checked, so it can put a version on disk that no manifest in the tree asked for.

⚠️ **What those three quotes do not settle: what npm does by default about an *optional* peer whose installed version is out of range.** The sentences above describe conflicting peers in general; none of them says whether an optional declaration with a violated range produces an error, a warning, or silence, and the behaviour of Yarn and pnpm in that case was not checked at all. [13b](../01-compiler-with-a-framework-attached/13b-ngc-is-tsc-and-the-typescript-pin.md) reaches the same limit and states it the same way. The safe planning assumption is the pessimistic one: **assume the install is silent and the failure arrives at build time, in CI, on a branch whose install step was green.**

```json
{
  "devDependencies": {
    "typescript": "~6.0.2"
  }
}
```

🔴 **That is the fix, and it is the whole fix.** Pin `typescript` to the range the CLI itself writes, delete the flag from your install command and from CI, and let the peer check do its job. When a genuine reason to move TypeScript arrives, it arrives as an Angular upgrade — [04 · `ng update`, not `npm install`](../04-ng-update-not-npm-install/README.md) owns that mechanism, including the [peer-dependency gate](../04-ng-update-not-npm-install/05-the-peer-dependency-gate.md) that runs before anything is written.

## Gotchas

**★ Symptom: `npm install` printed a peer warning about `typescript`, you ignored it, and everything worked — until the first build.** Cause: the two mechanisms in the table above are independent. The install-time half is advisory by construction; the compile-time half is not, and it does not consult your lockfile, your flags or your `overrides` — it reads the version off the `typescript` module that was actually loaded. Fix: treat the install warning as the early, well-labelled version of the build failure, and pin:

```json
"devDependencies": {
  "typescript": "~6.0.2"
}
```

**★ Symptom: the same broken combination installs cleanly in your library repo and fails loudly in your application repo.** Cause: the optional/required split. A library driven by `ng-packagr` or a custom `compiler-cli` invocation sees only `@angular/compiler-cli`'s *optional* declaration; an application also pulls `@angular/build`, where the same range is required. Fix: do not rely on the package manager to tell you in a library — declare the range yourself, so the library's own install is as loud as an application's:

```json
"devDependencies": {
  "typescript": "~6.0.2"
},
"peerDependencies": {
  "typescript": ">=6.0 <6.1"
}
```

**★ Symptom: the build error names a TypeScript version that appears nowhere in your `package.json`.** Cause: something rewrote the resolution — an `overrides` block, a Yarn `resolutions` field, a patched or vendored dependency, or a stale lockfile entry that a `npm install` never revisited. Fix: read the lockfile before you touch `package.json`, because the manifest is the thing that is already lying to you:

```bash
npm ls typescript            # every path that resolves a typescript, and to what
npm why typescript           # who asked for it
```

**★ Symptom: `--legacy-peer-deps` lives in your CI install command and nobody remembers why.** Cause: it was added once to get past one conflict, and it has been suppressing every peer range in the tree ever since — npm's own words are *"completely ignore `peerDependencies` when building a package tree"*. Fix: remove it, run the install, and fix the one conflict that reappears. If a single dependency genuinely needs an override, scope the override to that dependency instead of disabling the field globally:

```json
"overrides": {
  "some-legacy-lib": {
    "typescript": "~6.0.2"
  }
}
```

**★ Symptom: one workspace in a monorepo builds and another does not, on the same lockfile.** Cause: a hoisted `typescript` at the root and a nested copy under one package. The compiler does not read a manifest — it reads `ts.version` from whichever `typescript` module the compilation actually loaded, so two workspaces can disagree with no visible difference in configuration. Fix: pin `typescript` once at the root and remove the nested copy, then confirm there is exactly one:

```bash
npm ls typescript --all      # expect exactly one resolved path
```

**Symptom: you removed `typescript` from `devDependencies` "because it is a peer dependency".** Cause: a peer declaration is a compatibility statement, not an installation instruction, and `compiler-cli`'s is optional on top of that — nothing in the tree will install TypeScript for you. Fix: `typescript` belongs in your `devDependencies` in every Angular project, at the CLI's own range.

**Symptom: a dependency bot opens a PR bumping `typescript` a major and CI goes green on the install step.** Cause: the install step is not the check that matters, and with `--force` or `--legacy-peer-deps` in the pipeline it is not a check at all. Fix: make sure the pipeline actually compiles — a job that installs but never builds cannot see the second mechanism. Pin the range so the bot's PR is a range change you have to approve, not a silent patch bump.

**Symptom: `npm outdated` reports `typescript` as behind, forever.** Cause: it is behind, deliberately — `latest` is on the next major and the pin is on this one. Fix: none. This is the steady state of an Angular project, and the only correct way out of it is an Angular upgrade that moves the pin.

**★ Symptom: two pieces of advice disagree — pin `~6.0.2`, or pin exactly `6.0.3` and add an `overrides` entry.** Cause: they answer different questions, and both are in this corpus. `~6.0.2` is what the CLI writes and what a healthy single-copy project should keep, because it accepts TypeScript patch fixes without ever leaving the window. The exact pin plus an override, which [13b](../01-compiler-with-a-framework-attached/13b-ngc-is-tsc-and-the-typescript-pin.md) recommends, is the heavier instrument for a tree where something else is resolving a second copy. Fix: start at the CLI's range, and escalate only when the diagnosis says to:

```bash
npm ls typescript --all     # more than one path? then escalate
```

```json
"devDependencies": {
  "typescript": "6.0.3"
},
"overrides": {
  "typescript": "6.0.3"
}
```

Yarn's key is `resolutions` and pnpm's is `pnpm.overrides`; use whichever your lockfile belongs to.

**Symptom: an onboarding document, a Dockerfile or a CI step runs `npm install typescript` with no version.** Cause: an unversioned install resolves the `latest` dist-tag, which is on the next major. The step usually exists because someone hit a "tsc not found" and fixed the symptom. Fix: delete the step. TypeScript is already a `devDependency` of the workspace and `npx tsc` resolves the local copy — an ad-hoc install can only make the tree worse:

```bash
npm ci          # installs the pinned devDependency, nothing else needed
npx tsc --version
```

**Symptom: an older workspace still on the deprecated webpack builder installs an out-of-range TypeScript with no peer complaint at all.** Cause: the package carrying the *required* declaration is `@angular/build`, and that workspace does not have it — only `@angular/compiler-cli`'s optional declaration applies. ⚠️ **Whether `@angular-devkit/build-angular` declares its own `typescript` peer was not checked**, so do not assume it compensates. Fix: declare the constraint in your own manifest rather than relying on a package you may not have, and see [07 · The webpack builders are deprecated](../05-the-build-angular-build/07-the-webpack-builders-are-deprecated.md) for the migration that gets you back onto the package that enforces it.

**Symptom: you widened the range to `^6.0.0` so the peer check would stop complaining.** Cause: a caret admits `6.1.0` and beyond, which is outside both the declared peer range and the compiler's own interval. The install may now succeed and the build will fail the first time the resolver picks up a `6.1`. Fix: the tilde is not a stylistic choice here — it is the difference between a range that cannot leave the supported window and one that can:

```json
"devDependencies": {
  "typescript": "~6.0.2"
}
```

## Interview questions

**★ `npm install` printed a peer-dependency warning about `typescript` and the developer ignored it. What actually happens next?**
Nothing at all, until the first compilation — and that delay is what makes this expensive. The peer range in `@angular/compiler-cli` and `@angular/build` is checked once, by the package manager, at install time. Angular then re-checks the version itself at the start of every compilation, from inside `NgtscProgram`'s constructor, and throws a plain `Error` if it fails. The two checks share a range and nothing else: different enforcer, different timing, different message, different escape hatch. The interesting half of the answer is that the ignored warning was the *good* diagnostic — it named the package, the range and the version, at the moment the version was chosen.

**★ Is `typescript` a peer dependency of `@angular/core`?**
No, and this is worth knowing precisely because it is the manifest people check first. TypeScript is declared by `@angular/compiler-cli`, where it is marked **optional**, and by `@angular/build`, where it is not. `@angular/core` ships no TypeScript peer at all — which is coherent, since `core` is a runtime library and the TypeScript constraint belongs to the things that compile your code.

**★ Why is the same range optional in one Angular package and required in another?**
Because the two packages are used in different ways. `@angular/compiler-cli` is a library that other tools drive — Bazel, Nx, `ng-packagr`, Angular's own schematics — and some of those consumers supply TypeScript through a mechanism npm cannot see, so a hard requirement would produce false failures. `@angular/build` is the thing an application's build target actually invokes; it cannot function without a TypeScript compiler and says so. The practical effect is that library repositories get a quieter install than application repositories for identical breakage, which is exactly backwards from what you would want.

**★ What does `--force` buy you when the conflict is Angular's TypeScript peer, and what does it cost?**
It buys you an install. npm documents it as *"Allow conflicting peerDependencies to be installed in the root project"* — so it does not resolve the conflict, it permits it. The cost is that you have deleted the only cheap, well-labelled signal about the problem and kept the problem, which will now surface as a thrown error at the top of the next build with no package name and no range attached to your own project. If you need to move past a peer conflict at all, an `overrides` entry scoped to the one offending package is a narrower instrument than a flag that applies to the entire tree.

**Why does `ng new` write `~6.0.2` when the peer range would allow `6.0.0`?**
Because the two ranges answer different questions. The peer range is *what the compiler will tolerate*; the schematic's version is *what this CLI release was built and tested against*. `~6.0.2` sits inside the peer window with room for patches and none for a minor, so a fresh workspace can take TypeScript patch fixes without any chance of drifting out of the supported interval. It is also a single hard-coded map in the CLI source, kept up to date by a bot — which is why it moves in step with CLI releases rather than with TypeScript's.

**You are reading CLI source to find out which Angular version `ng new` installs, and the value is `0.0.0-PLACEHOLDER`. What is going on?**
The Angular-versioned entries in `latestVersions` are substituted during the release build, so the repository contains markers and the published package contains numbers. The consequence for anyone answering version questions from source: values like `typescript: "~6.0.2"` are literal and can be quoted directly, but anything Angular-versioned has to come from the published tarball or the registry instead. Reading the placeholder as a real version is a mistake with a very confident-looking output.

**A colleague fixed a peer conflict with `--legacy-peer-deps` and says the build is fine. What do you check?**
Whether the pipeline compiles at all. `--legacy-peer-deps` makes npm ignore `peerDependencies` while building the tree — not just this one, every one — so a green install proves nothing about any compatibility constraint in the project. The check that would catch a wrong TypeScript is the build, and the check that would catch the *other* peer ranges the flag suppressed does not exist any more. The correct sequence is: remove the flag, install, and deal with whatever single conflict actually reappears.

{/* FOOTER */}
