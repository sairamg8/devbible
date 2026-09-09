---
title: "A v22 workspace installs four dev dependencies and `@angular-devkit/build-angular` is not one of them — so if webpack is in your tree, something you can name put it there, and removing it is subtraction"
sidebar_label: "02e · What `ng new` installs"
sidebar_position: 2.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against `angular/angular-cli` at tag `v22.1.7` —
> [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts),
> [`packages/schematics/angular/workspace/files/package.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/package.json.template)
> and
> [`packages/angular_devkit/build_angular/builders.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/build_angular/builders.json),
> plus the published manifest of `@angular-devkit/build-angular` **22.1.7**
> ([registry.npmjs.org](https://registry.npmjs.org/@angular-devkit/build-angular/22.1.7)).
> Documentation-validated; **no sandbox run** — the file contents below are read from the
> schematic that writes them, not captured from a generated project.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The strongest evidence that the webpack era is over is not a blog post or a changelog line — it
is that a brand-new Angular 22 workspace never installs the webpack package at all.** The
application schematic adds three dev dependencies; the workspace template writes four. None of them
is `@angular-devkit/build-angular`. That makes any webpack in your dependency tree an *addition*
somebody made, traceable to a builder string or a third-party schematic, and it makes the migration
off webpack a subtraction rather than a swap.

## What the application schematic adds

From `application/index.ts` at `v22.1.7`:

```ts
const APPLICATION_DEV_DEPENDENCIES = [
  { name: '@angular/compiler-cli', version: latestVersions.Angular },
  { name: '@angular/build', version: latestVersions.AngularBuild },
  { name: 'typescript', version: latestVersions['typescript'] },
];
```

Three names, and two of them are the hard peers from
[02d · The peer contract](02d-the-peer-contract.md): the Angular compiler and the TypeScript
compiler. The third is the build system itself. Notice also that `latestVersions.Angular` and
`latestVersions.AngularBuild` are **two different entries** — the schematic knows the framework and
the build system are on separate release lines, and so should your `package.json`.

## What the workspace template writes

`workspace/files/package.json.template` at `v22.1.7`, `devDependencies` block:

```json
"devDependencies": {
  "@angular/cli": "^<version>",
  "@angular/compiler-cli": "<latestVersions.Angular>",
  "prettier": "<latestVersions['prettier']>",
  "typescript": "<latestVersions['typescript']>"
}
```

⚠️ **Those are the template's placeholders, not literal file content.** The schematic resolves them
from the CLI's own `latestVersions` table when it generates the project; this page did not read that
table, so it does not print resolved version strings. The *set of packages* is the point, and the
set is: the CLI, the Angular compiler, Prettier and TypeScript — with `@angular/build` arriving from
the application schematic above.

The template's `scripts` block, verbatim, because it is where `--configuration development` first
appears to most readers:

```json
"scripts": {
  "ng": "ng",
  "start": "ng serve",
  "build": "ng build",
  "watch": "ng build --watch --configuration development",
  "test": "ng test"
}
```

Two notes on that block. `"test"` is present unless the workspace was generated `--minimal`. And
`"watch"` names the **development** configuration explicitly, because — as
[01 · What `ng build` actually runs](01-what-ng-build-actually-runs.md) showed — the `build` target
carries `defaultConfiguration: "production"`, so a watch build without that flag would optimize on
every change. A `packageManager` field is added only when the schematic knows which manager you
used.

🔴 **Read the two lists together and the headline is what is missing.** No `webpack`. No
`@angular-devkit/build-angular`. No `karma`, no `vitest` — those are optional peers you or a
schematic add. The rest of the generated tree — `main.ts`, `app.config.ts`, `app.routes.ts`, the
`tsconfig` trio — belongs to **topic 08 · What `ng new` produces** *(not written yet)*.

## So where does webpack come from?

Only one place: something asked for `@angular-devkit/build-angular`. That package's manifest at
`22.1.7` depends on `webpack: 5.109.2`, `webpack-dev-server: 5.2.6`, `webpack-dev-middleware`,
`webpack-merge`, `terser`, six loaders, four webpack plugins, `@ngtools/webpack: 22.1.7`,
`@angular-devkit/build-webpack: 0.2201.7` — **and `@angular/build: 22.1.7` itself.**

That last dependency is the whole shape of the thing. The legacy package is a **superset**: it
re-exposes the modern builders *and* carries the webpack stack. Its own `builders.json` opens with
a one-line alias rather than an implementation:

```json
{
  "$schema": "../architect/src/builders-schema.json",
  "builders": {
    "application": "@angular/build:application"
  }
}
```

*(That is the first entry of the file, quoted exactly; the remaining entries — `app-shell`,
`browser`, `browser-esbuild`, `dev-server`, `extract-i18n`, `karma`, `server`, `ng-packagr`,
`ssr-dev-server`, `prerender` — are objects with `implementation` and `schema` keys, not aliases.
How Architect follows a string-valued alias to another package is **topic 06 · `angular.json`
anatomy** *(not written yet)*.)*

Three consequences follow, and they are the practical content of this page:

1. **`@angular-devkit/build-angular:application` and `@angular/build:application` run the same
   code.** A project on the legacy package that has already moved its `build` target to
   `application` is not running webpack for that target — it is just carrying the webpack stack.
2. **Keeping the legacy package for one target costs you the whole stack.** There is no partial
   install; roughly twenty webpack packages arrive with it.
3. **The migration order is: change the builder strings, then remove the dependency.** Removing it
   first breaks the targets that still name it. The mechanics are
   **08 · Migrating off webpack** *(not written yet)*.

## Gotchas

**★ Symptom: you migrated every builder string to `@angular/build:…` and `npm ls webpack` still
finds webpack.** Cause: changing `angular.json` does not uninstall anything —
`@angular-devkit/build-angular` is still in `devDependencies` and still pulls the stack. Fix: the
second half of the migration is a package removal:

```bash
grep -n '@angular-devkit/build-angular' angular.json || npm uninstall @angular-devkit/build-angular
```

The `grep` guard matters: run it first, and only remove the package when no target still names it.

**★ Symptom: a fresh `ng new` project has no `karma.conf.js` and `npm test` fails on a machine
where an older project worked.** Cause: neither `karma` nor `vitest` is installed by `ng new` —
both are optional peers of `@angular/build`. Fix: check which builder the generated `test` target
names, then install its runner:

```bash
node -p "require('./angular.json').projects['my-app'].targets.test.builder"
```

**★ Symptom: `npm run watch` produces optimized output and takes far longer than expected.** Cause:
someone edited the script and dropped `--configuration development`; the `build` target's
`defaultConfiguration` is `production`. Fix: restore the flag the template writes:

```json
{ "scripts": { "watch": "ng build --watch --configuration development" } }
```

**★ Symptom: a third-party schematic ran `ng add` and your install grew by twenty packages.**
Cause: some ecosystem schematics still add `@angular-devkit/build-angular`, because their builder
extends the webpack ones. Fix: find who depends on it before deciding whether the schematic is
still worth it:

```bash
npm ls @angular-devkit/build-angular
```

**Symptom: a workspace generated `--minimal` has no `test` script and CI reports a missing
script.** Cause: the template omits `"test"` for `--minimal`. Fix: add the script and the target
deliberately, rather than assuming the generator failed:

```json
{ "scripts": { "test": "ng test" } }
```

**Symptom: Prettier is in `devDependencies` of a project nobody configured for Prettier.** Cause:
the v22 workspace template installs it. Fix: nothing is broken — but decide, because an unused
formatter in `devDependencies` becomes a formatting argument in a code review six months later:

```bash
npm ls prettier
```

**Symptom: `package.json` has no `packageManager` field and CI picks a different manager than the
developer used.** Cause: the schematic writes that field only when it knows the value. Fix: set it
explicitly rather than relying on the generator:

```json
{ "packageManager": "npm@10.9.0" }
```

## Interview questions

**★ What does `ng new` actually install on Angular 22, and what does that prove?**
Four dev dependencies from the workspace template — `@angular/cli`, `@angular/compiler-cli`,
`prettier`, `typescript` — plus three from the application schematic, of which the new one is
`@angular/build`. `@angular-devkit/build-angular` appears in neither list, and neither does
webpack. That proves the strongest form of the claim this topic makes: webpack is not part of a new
Angular application at all, so any webpack in a v22 tree was added by a builder string or a
schematic and can be traced to one.

**★ If `@angular-devkit/build-angular` depends on `@angular/build`, what is it actually for?**
It is a superset kept for compatibility: it re-exposes the modern builders — its `builders.json`
maps `"application"` straight to the string `"@angular/build:application"` — and additionally
carries the webpack builders (`browser`, `server`, `app-shell`, `prerender`, `ssr-dev-server`, the
webpack `dev-server`) with the whole webpack stack behind them. So it is not an alternative
implementation you might prefer; it is the new build system plus about twenty webpack packages. A
project that keeps it installed for one legacy target pays for all of them.

**★ In what order do you take webpack out of a project, and why does the order matter?**
Builder strings first, package second. Every `"builder": "@angular-devkit/build-angular:…"` in
`angular.json` has to move to its `@angular/build` equivalent while the legacy package is still
installed, because the moment you uninstall it, any target still naming it fails to resolve. Once
`grep` finds no remaining reference, `npm uninstall @angular-devkit/build-angular` removes the
webpack stack in one step. Doing it the other way round gives you a broken workspace and a
misleading error about a missing builder rather than a missing package.

**Why does the generated `watch` script name a configuration when `build` and `start` do not?**
Because the two targets have opposite defaults. The `build` target is generated with
`defaultConfiguration: "production"` and the `serve` target with `"development"`, so `npm start`
already gets an unoptimized build while a bare `ng build --watch` would optimize on every file
change — which is both slow and not what you want to look at while developing. The template
therefore writes `--configuration development` explicitly on `watch` only. It is a small line that
encodes a real fact about the target graph, and editing it out is a common self-inflicted
slow-build.

{/* FOOTER */}
