---
title: "Fourteen of `@angular/build`'s eighteen peer dependencies are optional — including `@angular/core` itself — so the build system's only hard requirements are a TypeScript compiler and an Angular compiler, and every missing optional peer fails at run time rather than at install time"
sidebar_label: "02d · The peer contract"
sidebar_position: 2.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against the **published manifest** of `@angular/build` **22.1.7** —
> `peerDependencies` and `peerDependenciesMeta` at
> [registry.npmjs.org/@angular/build/22.1.7](https://registry.npmjs.org/@angular/build/22.1.7) —
> and the `22.0.0 (2026-06-03)` breaking-changes section of
> [CHANGELOG.md](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md) at tag
> `v22.1.7`. Documentation-validated; **no sandbox run**; `@angular/build` is **not installed in
> this checkout**, so nothing below was probed.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**A package's peer list is a statement about what it refuses to install for you, and
`@angular/build`'s is unusually revealing.** Eighteen peers are declared; fourteen of them are
marked optional, and the optional fourteen include `@angular/core`, `@angular/platform-browser`,
`karma`, `vitest`, `less`, `postcss` and `tailwindcss`. What is left is a TypeScript compiler and
an Angular compiler. That is the design in one line — and the practical half of it is nastier: an
optional peer that is missing produces no install warning at all, so you find out when a build or a
test run fails.

## The peer list, verbatim

```json
"peerDependencies": {
  "typescript": ">=6.0 <6.1",
  "@angular/compiler-cli": "^22.0.0",
  "@angular/core": "^22.0.0",
  "@angular/compiler": "^22.0.0",
  "@angular/localize": "^22.0.0",
  "@angular/platform-browser": "^22.0.0",
  "@angular/platform-server": "^22.0.0",
  "@angular/service-worker": "^22.0.0",
  "@angular/ssr": "^22.1.7",
  "less": "^4.2.0",
  "postcss": "^8.4.0",
  "tailwindcss": "^2.0.0 || ^3.0.0 || ^4.0.0",
  "rollup": "^4.0.0",
  "karma": "^6.4.0",
  "vitest": "^4.0.8",
  "ng-packagr": "^22.0.0",
  "istanbul-lib-instrument": "^6.0.0",
  "tslib": "^2.3.0"
}
```

And the fourteen entries carried in `peerDependenciesMeta`, every one of them
`{ "optional": true }`: `less`, `karma`, `rollup`, `vitest`, `postcss`, `ng-packagr`,
`tailwindcss`, `@angular/ssr`, `@angular/core`, `@angular/localize`, `@angular/service-worker`,
`istanbul-lib-instrument`, `@angular/platform-server`, `@angular/platform-browser`.

## Subtract one list from the other

Four names are left: **`typescript`**, **`@angular/compiler-cli`**, **`@angular/compiler`** and
**`tslib`**.

⚠️ **That set is a derivation, not a quoted field.** npm publishes what is *optional*; the hard set
is whatever `peerDependenciesMeta` does not mention, so it is arithmetic on two lists rather than a
sentence anyone wrote down. If the exact membership matters to you, compute it against the manifest
in your own `node_modules` rather than trusting this page:

```bash
node -e "const p = require('./node_modules/@angular/build/package.json');
const hard = Object.keys(p.peerDependencies).filter(k => !p.peerDependenciesMeta?.[k]?.optional);
console.log(hard.join(', '))"
```

What is not in doubt is the pair that carries the argument. 🔴 **The build system's non-negotiable
peers are the TypeScript compiler and the Angular compiler.** Everything else — the framework, the
platform packages, the test runners, the CSS toolchains, the library builder — is optional at
install time. A build system whose hard requirements are two compilers is telling you what it
thinks it is.

## `@angular/core` being optional is not a curiosity

`@angular/build` carries six builders beyond `application` — see
[02c](02c-the-six-builders-it-declares.md) — and several of them have no application to build.
`ng-packagr` builds a library. `extract-i18n` extracts messages. `karma` and `unit-test` run tests.
Declaring `@angular/core` optional lets the package be installed for those jobs without npm
insisting on a framework that job does not need.

The consequence for you is one sentence, and it is the reason half this page's gotchas exist:

🔴 **An optional peer is not installed for you, and its absence produces no install-time warning.**
A hard peer that is missing shows up during `npm install`. An optional one shows up when the code
path that needs it runs — a test command, a `.less` import, a coverage run — usually in CI, usually
on a day you changed something unrelated.

## `typescript` is a peer of the tooling, not of the framework

Three packages declare `typescript` at `>=6.0 <6.1`: `@angular/compiler-cli`, `@angular/build` and
`@angular-devkit/build-angular`. **`@angular/core` does not declare it at all.** Attribute it
correctly, because it changes what a version bump means: TypeScript is a constraint imposed by the
*compiler and build toolchain*, so the question "can we move to the next TypeScript?" is answered
by the CLI release line, not the framework one. The window itself, and what it does to your
`tsconfig`, is **topic 07 · The TypeScript setup** *(not written yet)*.

## Sass ships; Less, PostCSS and Tailwind do not

| Toolchain | How it arrives | Range |
|---|---|---|
| Sass | **direct dependency** of `@angular/build` | `1.101.0`, exact |
| Less | optional peer — you install it | `^4.2.0` |
| PostCSS | optional peer — you install it | `^8.4.0` |
| Tailwind | optional peer — you install it | `^2.0.0 \|\| ^3.0.0 \|\| ^4.0.0` |

Sass is bundled with the build system; the other three are not. The version ranges are also doing
work: Tailwind's accepts three majors, which means the build system does not choose one for you and
your Tailwind configuration must match whichever major you installed.

## Two version ranges in that list are worth reading twice

**`@angular/ssr` is pinned `^22.1.7`, while every `@angular/*` framework peer is `^22.0.0`.** That
is not a typo — `@angular/ssr` is published on the **CLI** release line, alongside `@angular/build`
and `@angular/cli`, so its floor tracks the tooling version rather than the framework version. It
is the same two-lines fact from [02 · Inside the package](02-inside-the-package.md), visible inside
a single JSON object.

**`rollup` is an optional peer at `^4.0.0`, and rolldown is the default.** Since v22.1.0 the chunk
optimization pass uses rolldown — a direct, exact-pinned dependency — while `rollup` remains
declared as an optional peer. ⚠️ **Whether opting out of rolldown requires you to install `rollup`
yourself was not confirmed**; the fallback path's install requirements are not documented. Do not
plan around a rollup fallback without testing it. [04 · The Rolldown chunk optimizer](04-the-rolldown-chunk-optimizer.md) has what is known.

## The one optional peer v22 turned into a migration step

From the `22.0.0` breaking changes, verbatim:

> *"`istanbul-lib-instrument` is now an optional peer dependency. Projects using karma with code
> coverage enabled will need to ensure that istanbul-lib-instrument is installed. Note: `ng update`
> will automatically add this dependency during the update process."*
> — [CHANGELOG.md](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md), `22.0.0 (2026-06-03)`

Read the last sentence as a warning about the *other* upgrade path. `ng update` adds the
dependency; editing `package.json` by hand does not. This is one concrete instance of the argument
in [04 · `ng update`, not `npm install`](../04-ng-update-not-npm-install/README.md) — the migration
is not only about version numbers.

## Gotchas

**★ Symptom: `ng test` fails on a fresh clone saying the test runner cannot be found, though
`angular.json` clearly names a `test` target.** Cause: `karma` and `vitest` are both **optional**
peers, so neither is installed by `@angular/build` and neither produced a warning when it was
missing. Fix: install whichever your `test` target actually uses — check first, then install:

```bash
node -p "require('./angular.json').projects['my-app'].targets.test.builder"
npm i -D vitest
```

**★ Symptom: `npm install` warns about an unmet peer `typescript`.** Cause: `typescript` is one of
the few **hard** peers of `@angular/build` at `>=6.0 <6.1`, and no other package supplies it —
notably not `@angular/core`. Fix: it belongs in your own `devDependencies`, which is exactly where
`ng new` puts it:

```json
{ "devDependencies": { "typescript": "~6.0.0" } }
```

**★ Symptom: `.scss` compiles fine and a `.less` import fails.** Cause: `sass` is a direct
dependency of the build system; `less` is an optional peer you are expected to install. Fix:

```bash
npm i -D less
```

**★ Symptom: code coverage silently stops working after a v22 upgrade you did by hand.** Cause:
v22.0.0 made `istanbul-lib-instrument` an optional peer; `ng update` adds it during the update,
and a hand-edited `package.json` does not. Fix:

```bash
npm i -D istanbul-lib-instrument
```

**★ Symptom: you bump TypeScript to the next minor and every build fails immediately.** Cause: the
peer window is `>=6.0 <6.1` — a *minor*-width range, deliberately narrow, because the Angular
compiler tracks the TypeScript compiler's internals. Fix: hold TypeScript inside the window and
move it when the CLI line does:

```json
{ "devDependencies": { "typescript": ">=6.0.0 <6.1.0" } }
```

**★ Symptom: you enable SSR by hand-editing `angular.json` and the build cannot find the server
runtime.** Cause: `@angular/ssr` is an **optional** peer — npm will not install it and will not
warn. Fix: use the schematic, which adds the package and wires the target in one step:

```bash
ng add @angular/ssr
```

**Symptom: Tailwind classes are not generated, and the Angular build reports nothing wrong.**
Cause: `tailwindcss` is an optional peer accepting `^2 || ^3 || ^4`; the build system neither
installs it nor picks a major for you, so a config written for one major against an installed
other simply does nothing. Fix: install it explicitly and match the config to the installed major:

```bash
npm i -D tailwindcss
npm ls tailwindcss
```

**Symptom: a monorepo or CI cache resolves a different `typescript` than your editor uses, and the
build disagrees with the IDE.** Cause: the hard peer is satisfied by whatever the resolver found;
nothing pins it to the version your editor loaded. Fix: pin it in the workspace root and check what
actually resolved:

```bash
npm ls typescript
```

**Symptom: you read `rollup` in the peer list and conclude Angular bundles with Rollup.** Cause: it
is an optional peer; the pass that would use it defaults to **rolldown**, an exact dependency,
since v22.1.0. Fix: nothing to install — but do not design a build around a rollup path whose
install requirements are undocumented. Check which one is actually pinned:

```bash
npm ls rolldown rollup
```

## Interview questions

**★ Which peer dependencies of `@angular/build` are not optional, and what does that tell you about
the package?**
Fourteen of the eighteen declared peers are marked optional in `peerDependenciesMeta`, so what
remains are `typescript`, `@angular/compiler-cli`, `@angular/compiler` and `tslib` — derived by
subtracting one list from the other rather than quoted from a single field. The two that matter are
the compilers. A build system whose only non-negotiable peers are the TypeScript compiler and the
Angular compiler is telling you what it fundamentally is: a compiler pass with a bundler attached,
not a bundler with a compiler bolted on. The corollary is the surprising part — `@angular/core`
itself is optional, because the same package also builds libraries, extracts i18n messages and runs
tests, and those jobs do not need a framework.

**★ Why is `typescript` a peer of `@angular/build` and not of `@angular/core`?**
Because TypeScript is a *build-time* dependency: the packages that need it are the ones that
compile, and those are `@angular/compiler-cli`, `@angular/build` and `@angular-devkit/build-angular`
— all three declaring `>=6.0 <6.1`. `@angular/core` ships compiled JavaScript and type
declarations; it does not run the compiler. This is worth getting right because it tells you which
release line answers "when can we move to the next TypeScript?" — the CLI line, not the framework
line — and because the range is only a minor wide, which is a strong hint that the Angular compiler
depends on TypeScript internals rather than just its public API.

**★ What actually happens when an optional peer is missing?**
Nothing, at install time. That is the whole problem. npm does not install optional peers and does
not warn about their absence, so the failure moves to the moment some code path reaches for them —
`ng test` when `vitest` or `karma` is absent, a `.less` import, a coverage run without
`istanbul-lib-instrument`, an SSR build without `@angular/ssr`. The practical habit is to treat the
optional list as a checklist against your `angular.json`: for every target and every file type you
actually use, confirm the package that implements it is in your own `devDependencies`.

**★ `@angular/ssr` is pinned `^22.1.7` in the same peer list where `@angular/core` is `^22.0.0`.
Why the difference?**
Because `@angular/ssr` is published on the CLI release line, not the framework one. `@angular/cli`,
`@angular/build`, `@angular/ssr` and `@angular-devkit/build-angular` all released 22.1.7 together,
while the framework packages are at 22.1.5. The peer range tracks the line the package is on, which
is why one of them has a patch-level floor and the others do not. If you can read that difference
out of a peer list, you have understood the two-release-line fact well enough that no
`package.json` you write will get it wrong.

**Angular declares `less`, `postcss` and `tailwindcss` as optional peers but depends on `sass`
directly. Why the asymmetry?**
The manifest states it and does not explain it, so the honest answer distinguishes what is known
from what is inferred. What is known: `sass` is an exact-pinned direct dependency at `1.101.0`, so
Sass works in a generated workspace with nothing extra installed, while Less, PostCSS and Tailwind
must be installed by you and are version-ranged rather than pinned. What follows practically is
that Sass is the path of least resistance in an Angular workspace and the others carry an explicit
install step — and that Tailwind's `^2 || ^3 || ^4` range means the build system takes no position
on which major you run, so a mismatch between your config format and your installed major is your
problem to detect.

---

← Prev: [The six builders it declares](02c-the-six-builders-it-declares.md) · Index: [Topic index](README.md) · Next → [What `ng new` installs](02e-what-ng-new-installs.md)
