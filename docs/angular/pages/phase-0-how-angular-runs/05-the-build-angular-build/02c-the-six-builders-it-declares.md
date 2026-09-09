---
title: "`@angular/build` declares exactly six builders, `browser` is not one of them, and each entry names the JSON schema that is the real authority on the options you may write in `angular.json`"
sidebar_label: "02c · The six builders it declares"
sidebar_position: 2.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against
> [`packages/angular/build/builders.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/builders.json)
> and
> [`packages/angular_devkit/build_angular/README.md`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/build_angular/README.md),
> both at tag `v22.1.7`, and the published manifest of `@angular/build` **22.1.7**
> ([registry.npmjs.org](https://registry.npmjs.org/@angular/build/22.1.7)). Documentation-validated;
> **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**A builder package's public surface is a single JSON file, and `@angular/build`'s has six
entries.** The manifest field `"builders": "builders.json"` points at it; every legal
`"builder": "@angular/build:<name>"` string in your `angular.json` must name one of those six.
Half the confusion people have with build configuration comes from trying to use a seventh — a
`browser` or a `server` or a `prerender` that only ever existed in the deprecated package — and the
other half from reading a documentation table when the builder's own `schema.json` is the thing
that decides.

## The file, in full

```json
{
  "builders": {
    "application": {
      "implementation": "./src/builders/application/index",
      "schema": "./src/builders/application/schema.json",
      "description": "Build an application."
    },
    "dev-server": {
      "implementation": "./src/builders/dev-server/index",
      "schema": "./src/builders/dev-server/schema.json",
      "description": "Execute a development server for an application."
    },
    "extract-i18n": {
      "implementation": "./src/builders/extract-i18n/index",
      "schema": "./src/builders/extract-i18n/schema.json",
      "description": "Extract i18n messages from an application."
    },
    "karma": {
      "implementation": "./src/builders/karma",
      "schema": "./src/builders/karma/schema.json",
      "description": "Run Karma unit tests."
    },
    "ng-packagr": {
      "implementation": "./src/builders/ng-packagr/index",
      "schema": "./src/builders/ng-packagr/schema.json",
      "description": "Build a library with ng-packagr."
    },
    "unit-test": {
      "implementation": "./src/builders/unit-test",
      "schema": "./src/builders/unit-test/schema.json",
      "description": "[EXPERIMENTAL] Run application unit tests."
    }
  }
}
```

Six names, and the legal builder strings are exactly:

```
@angular/build:application
@angular/build:dev-server
@angular/build:extract-i18n
@angular/build:karma
@angular/build:ng-packagr
@angular/build:unit-test
```

## Three things that list tells you immediately

**1 · `dev-server` ships in the build package.** `ng build` and `ng serve` are served by the same
dependency, which is why Vite appears in the dependency list of a package whose name is *build* —
see [02b](02b-twenty-six-dependencies.md). It also means you cannot install "just the builder" and
leave the dev server out.

**2 · There is no `browser`, `server`, `prerender`, `app-shell`, `browser-esbuild` or
`ssr-dev-server` here.** Those names exist only in `@angular-devkit/build-angular`. If a tutorial
tells you to set `"builder": "@angular/build:browser"`, that builder does not exist and never did;
what you want is `@angular/build:application`, which covers what `browser`, `server`, `prerender`
and `app-shell` used to do between them. The full inventory of what lives where, and which package
was deprecated when, is [07 · The webpack builders are deprecated](07-the-webpack-builders-are-deprecated.md).

**3 · `unit-test` labels itself `[EXPERIMENTAL]` in its own description** — and is also what
`ng new` writes as the `test` target on a v22 workspace. ⚠️ **Both are true at once, and the
documentation does not state a stability level for it.** angular.dev has no `unit-test` page at
`v22.1.5`, and the changelog entries for it are ordinary `fix`/`feat` rows rather than a stability
announcement. Do not treat "the default" as "declared stable", and do not treat `[EXPERIMENTAL]` as
"avoid" when the scaffolding picks it for you. [12 · The test builders](12-the-test-builders.md) picks
this apart.

## The `schema` key is the part people skip, and it is the authority

Every entry names two paths: an `implementation` and a `schema`. **The schema file is the complete,
machine-checked list of the options that builder accepts**, including their types and their
defaults. That has three practical consequences:

- When angular.dev and a builder's `schema.json` disagree about a default, **the schema is what
  runs.** And the documentation *does* drift in Angular 22: the budget defaults angular.dev prints
  for `anyComponentStyle` are not the values the CLI's own application schematic writes into a new
  `angular.json`. [Topic 06 · `angular.json` anatomy](../06-angular-json-anatomy/README.md) has to state that as a
  discrepancy rather than reconcile it.
- The `application` schema declares `"additionalProperties": false`, so a mistyped option is a hard
  failure rather than a silently ignored key. That is a feature, and it is why copying options from
  a webpack-era config fails loudly instead of quietly doing nothing.
- A builder's option list is versioned with the builder. Options do not "exist in Angular 22"; they
  exist in `@angular/build@22.1.7`'s schema for that specific builder.

`ng` can print a builder's options for you, which beats reading either the docs or the file:

```bash
ng build --help
```

## The supported surface stops at the builders

The sibling package's README draws the boundary explicitly, and it applies to everything you read
in this topic:

> *"While the builders when executed via the Angular CLI and their associated options are
> considered stable, the programmatic APIs are not considered officially supported and are not
> subject to the breaking change guarantees of SemVer."*
> — [`packages/angular_devkit/build_angular/README.md`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/build_angular/README.md)

Read that as a contract with two sides. **The builder names and their documented options are stable
and you may depend on them.** The implementation modules behind `./src/builders/…` — the ones this
topic reads from to explain mechanisms — can change in a patch. Explaining a build with them is
fine; scripting against them is not.

## Gotchas

**★ Symptom: you set `"builder": "@angular/build:browser"` from a blog post and the CLI cannot
find the builder.** Cause: `builders.json` declares six names and `browser` is not one of them; it
only ever existed in `@angular-devkit/build-angular`. Fix:

```json
{ "builder": "@angular/build:application" }
```

**★ Symptom: an option you copied from a tutorial makes the build fail with an unknown-property
error, and you expected it to be ignored.** Cause: the `application` builder's schema declares
`"additionalProperties": false`. Fix: delete the key, then check what the builder really accepts
before adding another:

```bash
ng build --help
```

**★ Symptom: a script or CI job that imported something from inside `@angular/build` breaks after a
patch bump.** Cause: only the builders and their options carry SemVer guarantees — the programmatic
API explicitly does not, per the quote above. Fix: drive builds through Architect, which is the
supported entry point:

```bash
ng run my-app:build:production
```

**★ Symptom: `ng build` and `ng serve` behave inconsistently and you start looking for a second
build package to blame.** Cause: there is no second package — `application` and `dev-server` are
both declared in this one `builders.json`. Fix: stop looking at installs and compare the two
*targets*, which is where the difference lives:

```bash
node -p "JSON.stringify(require('./angular.json').projects['my-app'].targets.serve, null, 2)"
```

[01 · What `ng build` actually runs](01-what-ng-build-actually-runs.md) explains why `serve`
references `build` through `buildTarget` rather than inheriting from it.

**★ Symptom: `ng test` on a fresh v22 workspace runs a builder whose own description says
`[EXPERIMENTAL]`, and you cannot tell whether that is a warning.** Cause: `unit-test` is both the
generated default and self-labelled experimental; no angular.dev page states a stability level for
it. Fix: know which one you are on before deciding anything, and treat the label as a reason to
pin, not to panic:

```bash
node -p "require('./angular.json').projects['my-app'].targets.test.builder"
```

**Symptom: the documentation gives a default for an option and your build behaves as though it is
different.** Cause: the docs page and the builder's `schema.json` are two sources, and only one of
them runs. Fix: read the schema the builder itself names — the path is in `builders.json`, and it
ships inside the installed package:

```bash
node -p "JSON.stringify(require('./node_modules/@angular/build/src/builders/application/schema.json').properties.outputHashing)"
```

**Symptom: you want a build step webpack would have given you a plugin for, and there is no plugin
API here.** Cause: `builders.json` is the extension point at the *builder* level — you swap a
builder, you do not extend one. Fix: start from the options the `application` schema actually
declares — `define`, `loader`, `conditions` and `externalDependencies` are the sanctioned escape
hatches — and check the real list rather than guessing at one:

```bash
ng build --help
```

```json
{ "externalDependencies": ["some-package"] }
```

What each of those four does is [10 · Features only this builder has](10-features-only-this-builder-has.md).
Writing your own builder is the other option, and it is a much larger commitment than a webpack
plugin was.

## Interview questions

**★ What is the complete public surface of `@angular/build`, and how would you check?**
Six builders, declared in the `builders.json` that the manifest's `"builders"` field points at:
`application`, `dev-server`, `extract-i18n`, `karma`, `ng-packagr` and `unit-test`. Any
`"builder"` string in `angular.json` beginning `@angular/build:` must name one of those six. You
check it by reading that file inside the installed package rather than trusting a tutorial, because
the names most people get wrong — `browser`, `server`, `prerender` — belong to a different,
deprecated package.

**★ Is `@angular/build:unit-test` safe to use in a real project?**
The honest answer names both facts and refuses to resolve them: its own description string in
`builders.json` reads `"[EXPERIMENTAL] Run application unit tests."`, and it is simultaneously what
`ng new` writes as the `test` target on a v22 workspace. **The documentation does not state a
stability level for it** — there is no `unit-test` page on angular.dev at `v22.1.5`, and the
changelog rows for it are ordinary fixes and features rather than a stability announcement. So:
know which builder your `test` target names, pin your CLI line, and expect option-level churn.
Calling it "stable" or telling people to avoid it would both be inventions.

**★ When angular.dev and a builder's `schema.json` disagree, which one is right?**
The schema, because the schema is what the builder validates against and reads defaults from at
run time. It matters more in Angular than it sounds, because the documentation and the CLI do
disagree in places — angular.dev's budget table and the values the application schematic actually
writes for `anyComponentStyle` are the known example. The
working habit is: use the docs for *why* an option exists and the schema for *what it does and what
its default is*, and when a build behaves unexpectedly, go to the schema first.

**Why is there no plugin API, and what are you supposed to do instead?**
Because the extension point is the builder, not the pipeline: `builders.json` maps a name to an
implementation, and `angular.json` chooses the name. There is no equivalent of a webpack plugin
array to push into. What you get instead are declared options on the `application` builder —
`define`, `loader`, `conditions`, `externalDependencies` — which cover the common reasons people
reached for plugins, and, at the far end, writing your own builder. The trade is deliberate: fewer
places to hook means a build system that can change its internals (esbuild, then rolldown on top)
without breaking everyone's configuration.

---

← Prev: [Twenty-six dependencies](02b-twenty-six-dependencies.md) · Index: [Topic index](README.md) · Next → [The peer contract](02d-the-peer-contract.md)
