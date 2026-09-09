---
title: "The generated `build` target sets four options and two configurations, and `configurations.development` is three deliberate inversions of the builder's own defaults — read it and you have read the whole merge rule"
sidebar_label: "05c · The build target"
sidebar_position: 5.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts),
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> and [`packages/angular/build/src/builders/dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json)
> at tag `v22.1.7`; configuration semantics quoted verbatim from
> [angular.dev/tools/cli/environments](https://angular.dev/tools/cli/environments).
> Documentation-validated; **no sandbox run** — the JSON below is the serialisation of the source
> object in [05](05-the-generated-project-line-by-line.md) under v22's documented defaults, not a
> captured file.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The generated `build` target is the best worked example of the options-versus-configurations
merge that exists in a file you already have.** `configurations.development` sets exactly three
keys, and every one of them is the opposite of the builder's declared default — understanding
*why* that block can be three lines long is understanding what a configuration is. This page walks
`build`; [05d](05d-serve-test-and-libraries.md) walks `serve`, `test` and the library shape.

## What the source serialises to

Under v22's defaults — `zoneless: true`, `style: "css"`, `strict: true`, `testRunner: "vitest"`,
project name `my-app`, `root: ""` — the object literal from
[05](05-the-generated-project-line-by-line.md) becomes this:

```json
{
  "build": {
    "builder": "@angular/build:application",
    "defaultConfiguration": "production",
    "options": {
      "browser": "src/main.ts",
      "tsConfig": "tsconfig.app.json",
      "assets": [{ "glob": "**/*", "input": "public" }],
      "styles": ["src/styles.css"]
    },
    "configurations": {
      "production": {
        "budgets": [
          { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
          { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
        ],
        "outputHashing": "all"
      },
      "development": {
        "optimization": false,
        "extractLicenses": false,
        "sourceMap": true
      }
    }
  },
  "serve": {
    "builder": "@angular/build:dev-server",
    "defaultConfiguration": "development",
    "options": {},
    "configurations": {
      "production": { "buildTarget": "my-app:build:production" },
      "development": { "buildTarget": "my-app:build:development" }
    }
  },
  "test": {
    "builder": "@angular/build:unit-test",
    "options": {}
  }
}
```

Two of the six `options` the schematic writes are missing here because their branches produced
`undefined` — see [05e](05e-the-keys-that-are-not-there.md).

## `build` — four options out of the builder's forty-odd

The `application` builder declares more than forty top-level options
([06](06-what-you-set-and-what-you-never-touch.md) has the inventory), and the schematic sets four
of them in `options`. The one that is not negotiable is `tsConfig`: the builder's schema has
`"required": ["tsConfig"]` and nothing else. Not `browser`, not `outputPath`. The file it points at
is topic 07's subject.

`browser` is the client entry point. It was called `main` before the `application` builder existed,
which is why an old `angular.json` and a new one differ on the very first option — see
[08b · The option renames](../05-the-build-angular-build/08b-the-option-renames.md).

`assets` is written with **no `output` key**, so `public/**/*` flattens into the output root rather
than into a subdirectory. `styles` gets one entry, built from the chosen extension:
`` `${sourceRoot}/styles.${options.style}` ``.

## `configurations.development` is three deliberate inversions

This is the paragraph to remember. The builder's own schema declares these defaults:

| Option | Schema default | `configurations.development` sets |
|---|---|---|
| `optimization` | `true` | `false` |
| `extractLicenses` | `true` | `false` |
| `sourceMap` | `false` | `true` |

**All three are flipped, and nothing else is repeated.** That is possible because a configuration
is merged over `options` rather than replacing it — the development build still gets `browser`,
`tsConfig`, `assets` and `styles` without naming any of them. The mechanics of that merge, and the
one way it surprises everybody, are **04 · `options` and `configurations`**.

`configurations.production` is the mirror image: it adds the two things production needs that
development must not pay for — content hashing and size enforcement — and inherits everything else.

The docs describe the pair as a shipped convention:

> *"Angular CLI comes with two build configurations: `production` and `development`. By default, the
> `ng build` command uses the `production` configuration, which applies several build optimizations,
> including:*
> *- Bundling files*
> *- Minimizing excess whitespace*
> *- Removing comments and dead code*
> *- Minifying code to use short, mangled names"*

and `defaultConfiguration` is what makes "by default" true:

> *"The `defaultConfiguration` option specifies which configuration is used by default. When
> `defaultConfiguration` is not set, `options` are used directly without modification."*

🔴 **So deleting `"defaultConfiguration": "production"` does not fall back to production — it falls
back to the raw `options` block, which sets no budgets and no output hashing.** A bare `ng build`
would then produce an optimized but unhashed, unbudgeted bundle, and nothing would tell you.

The two budget entries in `configurations.production` are the strict pair; `ng new --no-strict`
writes different numbers, and angular.dev's own defaults table disagrees with both. That is
[09b · Raw bytes and the defaults discrepancy](09b-raw-bytes-and-the-defaults-discrepancy.md); what
the seven budget types measure is [08 · Budgets](08-budgets-the-seven-types.md).

## Gotchas

**★ Symptom: `ng build` produces a hashed, budgeted, optimised bundle and you never passed
`--configuration production`.** Cause: `"defaultConfiguration": "production"` on the generated
`build` target. Fix: nothing is wrong — but if you want the raw `options` build, name a
configuration that does nothing rather than deleting the default:

```json
{
  "configurations": {
    "plain": {},
    "production": { "outputHashing": "all" }
  },
  "defaultConfiguration": "production"
}
```

**★ Symptom: someone removed `defaultConfiguration` "to make the build explicit", and CI output is
suddenly unhashed and unbudgeted.** Cause: with no `defaultConfiguration`, *"`options` are used
directly without modification"* — there is no implicit fallback to `production`. Fix: restore it,
or pass the flag everywhere:

```json
{ "defaultConfiguration": "production" }
```

**Symptom: a `ng build --configuration development` output deployed to a CDN keeps serving stale
files.** Cause: `outputHashing` defaults to `"none"` and only `configurations.production` sets
`"all"`. Fix: if you deploy a non-production configuration, set hashing on it explicitly:

```json
{ "configurations": { "staging": { "outputHashing": "all" } } }
```

**Symptom: licence banners are missing from a development build and present in production, and
someone files it as a bug.** Cause: `extractLicenses` defaults to `true`; the generated
`development` configuration turns it off because it costs time you do not want in a watch loop.
Fix: expected behaviour — flip it back only if a development build is being shipped:

```json
{ "configurations": { "development": { "extractLicenses": true } } }
```

**Symptom: you set `optimization` as an object in `options` to tune font inlining, and
`ng build --configuration development` ignores every sub-key.** Cause: the development
configuration sets `"optimization": false`, and a configuration value replaces the base value for
that key wholesale rather than merging into it — the rule is
**04 · `options` and `configurations`**. Fix: express the development case as an object too, so
nothing is lost:

```json
{
  "configurations": {
    "development": { "optimization": { "scripts": false, "styles": false, "fonts": false } }
  }
}
```

**★ Symptom: budgets added to `options` are not enforced by a production build.** Cause:
`configurations.production` names `budgets`, so its array replaces the one in `options` entirely
rather than being added to it. Fix: put them in the configuration that runs, or restate both sets:

```json
{
  "configurations": {
    "production": {
      "outputHashing": "all",
      "budgets": [
        { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
        { "type": "bundle", "name": "admin", "maximumError": "300kb" }
      ]
    }
  }
}
```

**Symptom: `tsConfig` was moved out of `options` into each configuration, and a build with no
configuration fails validation.** Cause: `tsConfig` is the builder's only required option and it is
required of the *merged* result — a build that applies no configuration sees only `options`. Fix:
keep it in `options`, where every configuration inherits it:

```json
{ "options": { "browser": "src/main.ts", "tsConfig": "tsconfig.app.json" } }
```

**Symptom: a configuration adds one asset entry and the `public/` copy stops happening.** Cause:
`assets` is an array and a configuration replaces the whole value, so the generated entry is gone.
Fix: repeat the base entry alongside the new one:

```json
{
  "configurations": {
    "staging": {
      "assets": [
        { "glob": "**/*", "input": "public" },
        { "glob": "robots.staging.txt", "input": "config", "output": "/" }
      ]
    }
  }
}
```

## Interview questions

**★ Why is `configurations.development` only three lines long?**
Because a configuration is merged over `options`, not substituted for it. The development build
already has `browser`, `tsConfig`, `assets` and `styles` from `options`, so the configuration only
needs to state what differs — and what differs is exactly three of the builder's declared defaults:
`optimization` (`true` by default), `extractLicenses` (`true`) and `sourceMap` (`false`), each
inverted. It is the cleanest illustration of the whole options/configurations model, and it is
sitting in a file every reader already has.

**★ What happens if you delete `defaultConfiguration`?**
`ng build` stops applying any configuration and uses `options` verbatim — the documentation says
*"When `defaultConfiguration` is not set, `options` are used directly without modification."* There
is no implicit fallback to `production`. In the generated file that means losing `outputHashing`
and every budget, silently, because the raw `options` block never contained them. It is a
one-character deletion with a production-shaped consequence.

**Why does `build` default to `production` while `serve` defaults to `development`?**
Because the default for each command should be the thing you almost always want from it. `ng build`
produces artefacts you deploy, so it should be optimised, hashed and size-checked by default;
`ng serve` produces a feedback loop, so it should be fast and debuggable by default. Encoding that
in `defaultConfiguration` per target rather than in the commands means the choice is visible and
editable in your workspace file rather than compiled into the CLI.

**Why does the generated `assets` entry have no `output` key?**
Because the intent is a flat copy: everything under `public/` lands at the output root, so
`public/favicon.ico` is served at `/favicon.ico`. Adding `output` would nest it. It is worth
knowing that the *absence* of a key is the meaningful part of that entry, because it is the same
pattern as `test.options` being `{}` — in this file, defaults are frequently expressed by omission.

**★ Why does `tsConfig` live in `options` rather than in each configuration?**
Because it is the builder's only required option, and the requirement applies to the *merged*
result rather than to each configuration individually. A configuration that omits it inherits the
value from `options`; if `options` omits it too, a build that applies no configuration — or one
whose configuration also omits it — has no tsconfig and fails validation. Putting it in `options`
is the only placement that is correct for every configuration, present and future.

**Why does `configurations.production` set `outputHashing` rather than `options` setting it?**
Because hashing is a deployment concern, not an application one. A development build serves from
memory and rebuilds constantly, so hashed filenames buy nothing and make the output harder to read;
a deployed build needs them for cache-busting. Expressing it in the configuration keeps the
statement honest — `options` describes the application, configurations describe the circumstances.
The cost is the one this page keeps returning to: any other configuration you add gets `"none"`
unless it says otherwise.

{/* FOOTER */}
