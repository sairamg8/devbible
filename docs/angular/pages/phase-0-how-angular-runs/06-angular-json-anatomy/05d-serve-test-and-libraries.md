---
title: "The `serve` target holds no build options at all — it holds a pointer, and that pointer carries a second configuration selection which is why `ng serve --configuration production` so often changes nothing"
sidebar_label: "05d · serve, test and libraries"
sidebar_position: 5.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular/build/src/builders/dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json),
> [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts),
> [`packages/schematics/angular/library/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/library/index.ts)
> and [`packages/angular_devkit/architect/node/node-modules-architect-host.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/architect/node/node-modules-architect-host.ts)
> at tag `v22.1.7`; the `buildTarget` format quoted verbatim from the dev-server schema and from
> [angular.dev/tools/cli/environments](https://angular.dev/tools/cli/environments).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`ng serve` makes two configuration decisions, not one, and the generated file is the only place
you can see both.** The `serve` target's `configurations` map selects an entry; that entry sets a
`buildTarget` string which selects a configuration on the `build` target. Change one and not the
other and you get a command that accepts your flag and ignores it. This page finishes the walk of
the generated project object begun in [05](05-the-generated-project-line-by-line.md) —
`serve`, `test`, and what changes when the project is a library.

## `serve` — a pointer, not a duplicate

```json
{
  "serve": {
    "builder": "@angular/build:dev-server",
    "defaultConfiguration": "development",
    "options": {},
    "configurations": {
      "production": { "buildTarget": "my-app:build:production" },
      "development": { "buildTarget": "my-app:build:development" }
    }
  }
}
```

The `serve` target declares no build options at all. Its two configurations each set exactly one
key, whose schema description gives the format:

> *"A build builder target to serve in the format of `project:target[:configuration]`. You can also
> pass in more than one configuration name as a comma-separated list. Example:
> `project:target:production,staging`."*

🔴 **So two independent configuration selections are in play during `ng serve`.** `--configuration`
picks an entry in the *serve* target's map; that entry then names a build target string carrying
its own configuration. There is no linkage between the two names — they are both called
`production` in the generated file because the schematic wrote both, not because anything enforces
it.

The dev-server builder itself, its option surface and its rebuild loop are
[06 · The dev-server contract](../05-the-build-angular-build/06-the-dev-server-contract.md).

### `"options": {}` is a signpost, not a stub

The architect host reads options with a nullish fallback:

```ts
let options = await this.workspaceHost.getOptions(target.project, target.target);
```

and the underlying accessor returns `(targetDefinition.options ?? {})`. An absent `options` and an
empty one behave identically. The schematic writes the empty object so there is an obvious place to
put a `port`, a `proxyConfig`
([06j](../05-the-build-angular-build/06j-proxying-to-a-backend.md)) or an `ssl` flag.

### The asymmetric defaults are the design

`defaultConfiguration` is `development` on `serve` and `production` on `build`. You serve
unoptimised and you ship optimised, and neither command needs a flag to do the thing you almost
always want. That decision is stored in your workspace file rather than compiled into the CLI,
which means you can change it — and it means someone else already might have.

## `test` — present, empty, and conditional

```json
{ "test": { "builder": "@angular/build:unit-test", "options": {} } }
```

The empty `options` object **is** the runner choice. The schematic writes `{}` when
`testRunner === TestRunner.Vitest` and `{ "runner": "karma" }` otherwise, so there is no
`"runner": "vitest"` line to look for — vitest is recorded as an absence. `testRunner` defaults to
`"vitest"` at 22.1.7.

The whole target is absent under `--skip-tests` or `--minimal`, because the schematic assigns it
from a conditional whose false branch is `undefined`. What the builder does with these options is
topic 05's [12 · The test builders](../05-the-build-angular-build/12-the-test-builders.md).

## What a library gets instead

`ng generate library` writes a project with `projectType: "library"` and a `build` target whose
builder is `@angular/build:ng-packagr`. Same file format, same target/option/configuration
structure, different builder string — and therefore a different option schema against which
`options` is validated.

🔴 **`projectType` is not a parsing switch.** It does not change how `angular.json` is read. It is a
declaration that tells schematics and tooling what kind of project this is, and the schematic uses
it to pick a builder. A library project has no `serve` target because there is nothing to serve.

## Gotchas

**★ Symptom: `ng serve --configuration production` still serves an unoptimised build.** Cause: two
configuration selections. The flag picked the serve target's `production` entry, which names a
build target string — if that string still says `:build:development`, the build did not change.
Fix: change both, and read the `buildTarget` value rather than trusting the entry's name:

```json
{
  "serve": {
    "configurations": {
      "production": { "buildTarget": "my-app:build:production" }
    }
  }
}
```

**★ Symptom: you renamed the project key under `projects` and `ng serve` fails to resolve a build
target.** Cause: `buildTarget` embeds the project name as a literal string, written once at
generation time and never re-derived. Fix: rename it in every `buildTarget` too:

```json
{
  "projects": {
    "web": {
      "targets": {
        "serve": {
          "configurations": {
            "production": { "buildTarget": "web:build:production" },
            "development": { "buildTarget": "web:build:development" }
          }
        }
      }
    }
  }
}
```

**★ Symptom: you added a `staging` configuration to `build`, and `ng serve --configuration staging`
errors that the configuration is not set in the workspace.** Cause: `build` and `serve` keep
separate `configurations` maps; adding one to `build` does not create one on `serve`. Fix: add the
serve-side entry that points at it:

```json
{
  "serve": {
    "configurations": {
      "staging": { "buildTarget": "my-app:build:staging" }
    }
  }
}
```

**★ Symptom: `ng test` runs karma in one project of a workspace and vitest in another, and nobody
remembers choosing.** Cause: `test.options` is `{}` for vitest and `{ "runner": "karma" }`
otherwise — the vitest choice is recorded as an absence, so there is nothing to compare. Fix: make
it explicit in every project if the ambiguity is costing time:

```json
{ "test": { "builder": "@angular/build:unit-test", "options": { "runner": "karma" } } }
```

**Symptom: `"options": {}` on the `serve` target looks like an unfinished stub, gets deleted, and
the next diff is noisier than it needed to be.** Cause: it is a deliberate placeholder — the
architect host reads `targetDefinition.options ?? {}`, so present-and-empty and absent are
identical. Fix: leave it and put dev-server options in it:

```json
{ "serve": { "builder": "@angular/build:dev-server", "options": { "port": 4300 } } }
```

**Symptom: `ng serve` on a library project fails because there is no `serve` target.** Cause: the
library schematic writes only a `build` target — there is nothing to serve, because the output is a
package rather than an application. Fix: serve an application that consumes the library, and build
the library in watch mode alongside it:

```bash
ng build my-lib --watch
```

**Symptom: a second serve configuration was created by copying the first, and both point at
`my-app:build:production`.** Cause: the entry's *name* and the configuration it selects on `build`
are unrelated strings; nothing warns when they disagree. Fix: read the value, not the key:

```json
{
  "serve": {
    "configurations": {
      "staging": { "buildTarget": "my-app:build:staging" },
      "production": { "buildTarget": "my-app:build:production" }
    }
  }
}
```

**Symptom: `ng serve --configuration development,fr` behaves as though only `fr` applied.** Cause:
`buildTarget` accepts a comma-separated list and so does `--configuration`; configurations are
applied left to right with later values winning per key. Fix: order them so the more specific one
is last, and put shared settings in `options`:

```json
{ "serve": { "configurations": { "fr": { "buildTarget": "my-app:build:development,fr" } } } }
```

## Interview questions

**★ `ng serve --configuration production` still serves an unoptimised build. Why?**
Because there are two independent configuration selections. The flag selects an entry in the
**serve** target's `configurations`; that entry sets `buildTarget`, a
`project:target[:configuration]` string which selects the **build** target's configuration
separately. If the serve-side `production` entry still points at `my-app:build:development`, the
build is a development build regardless of the flag. The two names match in a generated file only
because the schematic wrote both — nothing enforces the correspondence, and nothing warns when it
breaks.

**★ What does `"options": {}` on the `serve` target mean?**
Functionally nothing: the architect host reads `targetDefinition.options ?? {}`, so an empty object
and an absent key are identical. It is written as a signpost for where dev-server options go. The
genuinely informative empty object in the generated file is the one on the `test` target, where
`{}` versus `{ "runner": "karma" }` is how the runner choice is recorded — there, the absence
carries meaning.

**★ What changes in `angular.json` when `projectType` is `"library"`?**
The builder string, and consequently the option schema `options` is validated against.
`ng generate library` writes a `build` target using `@angular/build:ng-packagr` instead of
`@angular/build:application`, and writes no `serve` target because a package is not servable. The
file format, the target/option/configuration structure and the project-level keys are identical.
`projectType` is not a parsing switch — it is a declaration schematics and tooling read.

**Why does `serve` hold a pointer to a build target rather than repeating the build options?**
Because a served build and a deployed build must not drift. If `serve` carried its own copy of
`browser`, `tsConfig`, `assets` and `styles`, every change would have to be made twice and the
divergence would be invisible until something behaved differently in development than in
production. The pointer makes the dev server serve the *same* target you deploy, differing only by
which configuration is layered on top of it.

**How would you tell, from `angular.json` alone, which test runner a project uses?**
Look at `targets.test.options`. `{ "runner": "karma" }` means karma; `{}` means vitest, because the
schematic records the default by writing nothing. That is a genuinely awkward encoding to read —
an empty object that carries a decision — and it is worth setting `runner` explicitly in a
workspace where several people generate projects, purely so the file states what it means.

**A colleague adds a `staging` entry to `serve` whose `buildTarget` is `my-app:build:production`.
Is that wrong?**
Not necessarily — it is a legitimate way to serve the production build under a different dev-server
setup, for example a different port or proxy. But it is a trap for the next reader, because the
entry's name and the configuration it selects are unrelated strings and nothing flags the mismatch.
If the intent is genuinely "serve production with a staging proxy", say so in the proxy
configuration's own file rather than relying on the reader noticing that two names disagree.

{/* FOOTER */}
