---
title: "The `angular.json` you were given was written by two schematics, and the object literal in the CLI's own source tells you exactly what your file contains — without running `ng new` once"
sidebar_label: "05 · The generated project"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/schematics/angular/workspace/files/angular.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/angular.json.template),
> [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts),
> [`packages/schematics/angular/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/schema.json)
> and [`packages/schematics/angular/utility/workspace-models.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/utility/workspace-models.ts),
> all at tag `v22.1.7`.
> Documentation-validated; **no sandbox run** — every object on this page is transcribed from the
> CLI's own schematic source, not from a terminal.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Nobody writes `angular.json` by hand, so the honest way to teach it is to read the code that
writes it.** The CLI's application schematic contains one JavaScript object literal that becomes
the `projects.<name>` entry in your workspace file, and that object is public source at a tagged
release. This page reproduces it whole, alongside the ten-line template that creates the workspace
around it, and pins down the one thing a generated file can never show you — which keys were
written by a *branch*. The field-by-field walk then continues in
[05b · The five project-level fields](05b-the-five-project-level-fields.md),
[05c · The build target](05c-the-build-target.md),
[05d · `serve`, `test` and libraries](05d-serve-test-and-libraries.md) and
[05e · The keys that are not there](05e-the-keys-that-are-not-there.md).

## Two schematics, two files, one result

`ng new` runs the **workspace** schematic first. Its entire `angular.json` is a ten-line EJS
template — verbatim, EJS tags and all:

```text
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,<% if (packageManager) { %>
  "cli": {
    "packageManager": "<%= packageManager %>"
  },<% } %>
  "newProjectRoot": "<%= newProjectRoot %>",
  "projects": {
  }
}
```

That is the whole workspace: a schema pointer, a format version, an optional `cli` block, a
`newProjectRoot`, and an **empty** `projects` object. Then the **application** schematic runs and
inserts a project into it.

🔴 **This is why `newProjectRoot` exists even in a workspace with one application.** It was written
by a schematic that did not yet know how many projects there would be. It is a policy for *future*
`ng generate application` and `ng generate library` runs, not a description of the app you have.

The same split is why `ng generate application` works at all in an existing workspace: it is the
identical code path `ng new` uses for its first project, pointed at a workspace file that already
exists.

## The object the application schematic inserts

Verbatim from `addAppToWorkspaceFile()` in
[`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts)
at `v22.1.7`:

```ts
const project = {
  root: normalize(projectRoot),
  sourceRoot,
  projectType: ProjectType.Application,
  prefix: options.prefix || 'app',
  schematics,
  targets: {
    build: {
      builder: Builders.BuildApplication,
      defaultConfiguration: 'production',
      options: {
        browser: `${sourceRoot}/main.ts`,
        polyfills: options.zoneless ? undefined : ['zone.js'],
        tsConfig: `${projectRoot}tsconfig.app.json`,
        inlineStyleLanguage,
        assets: [{ 'glob': '**/*', 'input': `${projectRoot}public` }],
        styles: [`${sourceRoot}/styles.${options.style}`],
      },
      configurations: {
        production: {
          budgets,
          outputHashing: 'all',
        },
        development: {
          optimization: false,
          extractLicenses: false,
          sourceMap: true,
        },
      },
    },
    serve: {
      builder: Builders.BuildDevServer,
      defaultConfiguration: 'development',
      options: {},
      configurations: {
        production: { buildTarget: `${options.name}:build:production` },
        development: { buildTarget: `${options.name}:build:development` },
      },
    },
    test:
      options.skipTests || options.minimal
        ? undefined
        : {
            builder: Builders.BuildUnitTest,
            options:
              options.testRunner === TestRunner.Vitest
                ? {}
                : { runner: 'karma' },
          },
  },
};
```

Everything in the rest of chunk 05 is a reading of those sixty lines.

## The builder strings are an enum, not free text

`Builders.BuildApplication` and friends resolve through one enum in
`packages/schematics/angular/utility/workspace-models.ts`:

```ts
BuildApplication = '@angular/build:application',
BuildDevServer   = '@angular/build:dev-server',
BuildUnitTest    = '@angular/build:unit-test',
BuildKarma       = '@angular/build:karma',
BuildNgPackagr   = '@angular/build:ng-packagr',
BuildExtractI18n = '@angular/build:extract-i18n',
```

So a generated application's three builder strings are `@angular/build:application`,
`@angular/build:dev-server` and `@angular/build:unit-test`, and a generated library's build target
uses `@angular/build:ng-packagr` — `projectType: "library"` changes which builder is written, not
the file format. What each of those strings then does is
[topic 05](../05-the-build-angular-build/README.md); how a `package:name` string is resolved to a
function is **03 · Targets and builders**.

## Gotchas

**★ Symptom: a tutorial's `angular.json` has keys yours does not, and you conclude your generation
was broken.** Cause: several keys are conditional in the schematic and evaluate to `undefined`
under v22's defaults, so they are never serialised. Fix: nothing to repair — if you want the key
present, set it explicitly, which is a different statement from "restore what was lost":

```json
{ "options": { "polyfills": ["zone.js"], "inlineStyleLanguage": "scss" } }
```

**★ Symptom: `newProjectRoot` looks redundant in a one-application workspace, gets deleted, and a
later `ng generate library` lands somewhere unexpected.** Cause: it was written unconditionally by
the workspace schematic before any project existed, and it is the policy consulted by every later
generation. Fix: keep it, and change the value rather than removing it if you want a different
layout:

```json
{ "newProjectRoot": "packages" }
```

**★ Symptom: you hand-typed `"@angular/build:Application"` or `"@angular-build:application"` and
the build fails at target resolution rather than at option validation.** Cause: the builder string
is an exact `package:name` pair, resolved by looking up the package and then the named builder in
its manifest; the schematic writes it from an enum precisely so it is never typed. Fix: copy the
exact string:

```json
{ "targets": { "build": { "builder": "@angular/build:application" } } }
```

**Symptom: you copied a whole `projects.<name>` object into another workspace and nothing
resolves.** Cause: every path in the object was already resolved by the schematic through string
concatenation with `projectRoot` — nothing is recomputed at build time. Fix: rewrite the paths
along with the key, or generate the project in the target workspace and move the source files:

```json
{
  "root": "apps/web",
  "sourceRoot": "apps/web/src",
  "targets": {
    "build": {
      "builder": "@angular/build:application",
      "options": { "browser": "apps/web/src/main.ts", "tsConfig": "apps/web/tsconfig.app.json" }
    }
  }
}
```

**Symptom: `ng add @angular/ssr` changes `angular.json` even though `--ssr` was a `ng new` flag.**
Cause: `ssr` writes nothing into `angular.json` from the application schematic; a separate `ssr`
schematic adds the keys. Fix: expected — run the schematic rather than hand-editing, so the source
tree and the workspace file stay consistent:

```bash
ng add @angular/ssr
```

**Symptom: `ng new --minimal` produces a project object that matches no tutorial.** Cause:
`minimal` trips three conditional branches at once — the `test` target becomes `undefined`, the
per-project `schematics` block is written with `skipTests` entries, and the component defaults are
written too. Fix: expect the difference; generate without `--minimal` if you want the shape every
guide assumes:

```bash
ng new my-app
```

**Symptom: a formatter that sorts JSON keys rewrites `angular.json` and a code review cannot tell
what changed.** Cause: the schematic writes keys in the order of the object literal above, and
sorting is a whole-file diff for no behavioural gain — with one exception, because `architect` and
`targets` are handled by the same reader branch and the later key wins if both are present
(**02 · `projects` and the project object**). Fix: exclude this file from key sorting:

```json
{ "targets": { "build": { "builder": "@angular/build:application" } } }
```

## Interview questions

**★ How can you know what `ng new` will produce without running it?**
Because the object that becomes `projects.<name>` is a plain object literal in
`packages/schematics/angular/application/index.ts` at a tagged release, and the schematic's own
`schema.json` gives the default of every flag that branches inside it. Reading the source is
strictly better evidence than a transcript: a transcript shows one generation with one set of
flags, whereas the source shows every branch and names the condition that selects it. It also does
not go stale silently — the tag pins it to a version you can state.

**★ Why are there two schematics rather than one?**
Because a workspace and an application are separable concerns. The workspace schematic writes a
valid `angular.json` whose `projects` object is empty; the application schematic inserts a project
into whatever workspace it finds. That separation is what makes `ng generate application` work in
an existing workspace — it is the same code path, not a parallel one. The visible artefact of the
split is `newProjectRoot`: a key written by a schematic that had no projects to place yet, which is
why it is present in single-application workspaces where it does nothing.

**What does the `Builders` enum tell you that the generated file does not?**
That the six strings a schematic can write are a closed set defined in one place, and that the
choice between them is made by project type and generation flags rather than by anything you
configure. It also makes the `@angular/build` versus `@angular-devkit/build-angular` distinction
concrete: every string the v22 schematics write is in the `@angular/build` namespace, so a file
containing a `@angular-devkit/build-angular:` string was either generated by an older major or
edited by hand.

**★ What is `newProjectRoot` for in a workspace with a single application?**
Nothing, until you add a second project. It records where future applications and libraries will be
generated, and the workspace template writes it unconditionally — before any project exists — so
its presence says nothing about how many projects you have. Deleting it as unused changes where the
next `ng generate library` lands, which is a surprise that arrives weeks later with no obvious
cause.

**Is the `cli` block always present in a generated `angular.json`?**
No. The workspace template wraps it in `<% if (packageManager) { %>`, so it is written only when a
package manager was specified at generation time. A workspace without it is not missing anything —
the CLI falls back to its own resolution. What the block can contain, and how workspace-level and
project-level `cli` settings interact, is **13 · The `cli` block and workspace-wide defaults**.

---

← Prev: [Configurations are per target](04g-configurations-are-per-target.md) · Index: [Topic index](README.md) · Next → [The project-level fields](05b-the-five-project-level-fields.md)
