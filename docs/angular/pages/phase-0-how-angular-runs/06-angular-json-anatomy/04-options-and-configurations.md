---
title: "`options` is what the target always does and `configurations` is a map of named differences — and because a configuration is validated against the same schema as `options`, everything is legal in both and nothing is required in either"
sidebar_label: "04 · `options` and `configurations`"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [angular.dev/tools/cli/environments](https://angular.dev/tools/cli/environments),
> the builder-target section of
> [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config),
> the `target` definition in
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json)
> and `addAppToWorkspaceFile()` in
> [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts),
> all at tag `v22.1.7`. Documentation-validated; **no sandbox run** — the generated target below is
> transcribed from the schematic that writes it.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Every target has two places to put an option and they mean different things: `options` is what the
target does whenever it runs, and each entry in `configurations` is a named set of differences.**
The relationship between them is the single most consequential mechanism in `angular.json`, and the
rule that governs it is not documented anywhere on angular.dev —
[04b](04b-the-merge-is-shallow.md) is that rule. This page establishes what the two sections are,
what the schema permits in each, and how the CLI decides which configuration is in play at all.

## What the documentation says they are

> *"Each target also has an `options` section that configures default options for the target, and a
> `configurations` section that names and specifies alternative configurations for the target."*
> — [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config)

> *"Angular CLI comes with two build configurations: `production` and `development`. By default, the
> `ng build` command uses the `production` configuration, which applies several build optimizations,
> including:*
> *- Bundling files*
> *- Minimizing excess whitespace*
> *- Removing comments and dead code*
> *- Minifying code to use short, mangled names"*
> — [angular.dev/tools/cli/environments](https://angular.dev/tools/cli/environments)

> *"The `defaultConfiguration` option specifies which configuration is used by default. When
> `defaultConfiguration` is not set, `options` are used directly without modification."*
> — [angular.dev/tools/cli/environments](https://angular.dev/tools/cli/environments)

That last sentence is the cleanest statement of the model available: **with no configuration
selected, `options` is the whole answer.** A configuration is always something applied *on top*.

## The generated target, as written by the schematic

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
      "production": { "buildTarget": "storefront:build:production" },
      "development": { "buildTarget": "storefront:build:development" }
    }
  }
}
```

Read the division of labour in it. **`options` carries the four things that are true whatever you
are doing** — where the entry point is, which `tsconfig` to use, what to copy, what to inject.
**Each configuration carries only differences**: production adds budgets and content hashing,
development turns optimisation off and source maps on. Neither configuration re-states `browser` or
`tsConfig`, because neither changes them.

⚠️ **The `anyComponentStyle` values above are the ones the CLI writes under its default
`strict: true`.** angular.dev's budget table states different defaults for that type (2kb warning,
4kb error); the application schematic at `v22.1.7` writes 4kB/8kB, and 6kB/10kB under `--no-strict`.
The two sources disagree and this topic reports both rather than reconciling them.

## An empty `options` is a placeholder, not a mistake

The generated `serve` target has `"options": {}`. That is deliberate and it is harmless: `options` is
optional in the schema, and the code that reads it treats an absent one as `{}` anyway. The empty
object is a slot for you to fill — the place a `port` or a `proxyConfig` will go — rather than a
statement that no options exist.

```json
{
  "serve": {
    "builder": "@angular/build:dev-server",
    "defaultConfiguration": "development",
    "options": { "port": 4300 },
    "configurations": {
      "development": { "buildTarget": "storefront:build:development" }
    }
  }
}
```

## Everything is legal in a configuration, and nothing is required

The schema's official branch for a builder points `configurations`' entries at **the same option
schema as `options`** ([03c](03c-the-seventeen-builder-strings.md)). Two consequences:

- **Any builder option may appear in a configuration.** There is no separate list of
  "configurable" options; the set is identical.
- **A builder's required options are not required per configuration.** The application builder's
  `required: ["tsConfig"]` applies to the merged result, which is why
  `"production": { "outputHashing": "all" }` is complete and valid on its own.

🔴 **The corollary is where people get hurt: because everything is legal in a configuration, nothing
warns you when you put something there that should have been in `options`.** A `tsConfig` written
only into `configurations.production` produces a build that works with `--configuration production`
and fails without it, and no validation stage objects to the file.

## Gotchas

**★ Symptom: `ng build` with no flags produces an optimised, hashed, budget-checked bundle, and
nobody passed `--configuration production`.** Cause: the generated `build` target sets
`"defaultConfiguration": "production"`. A bare `ng build` is not "no configuration" — it is the
default one. Fix: nothing is broken, but if you want a truly unconfigured build, name a configuration
that changes nothing, or remove the default and be explicit at every call site:

```json
{
  "build": {
    "builder": "@angular/build:application",
    "options": { "tsConfig": "tsconfig.app.json", "browser": "src/main.ts" },
    "configurations": {
      "production": { "outputHashing": "all" },
      "development": { "optimization": false, "sourceMap": true }
    }
  }
}
```

**★ Symptom: an option added to `configurations.production` has no effect on `ng serve`.** Cause: two
independent reasons at once — the serve target defaults to `development`, and it reaches the build
target through a `buildTarget` string that names `:build:development`. Neither path passes through
the build target's production configuration. Fix: put anything that must apply to both in `options`:

```json
{
  "build": {
    "builder": "@angular/build:application",
    "options": {
      "tsConfig": "tsconfig.app.json",
      "browser": "src/main.ts",
      "define": { "API_BASE": "\"/api\"" }
    },
    "configurations": {
      "production": { "outputHashing": "all" }
    }
  }
}
```

**★ Symptom: a build works with `--configuration production` and fails without it, complaining about
a missing required option.** Cause: a required option such as `tsConfig` was written into a
configuration instead of `options`. The schema does not catch it, because a configuration is
validated against the same schema in a context where nothing is required. Fix: required options
belong in `options`, always:

```json
{
  "build": {
    "builder": "@angular/build:application",
    "options": { "tsConfig": "tsconfig.app.json", "browser": "src/main.ts" },
    "configurations": { "production": { "outputHashing": "all" } }
  }
}
```

**★ Symptom: every configuration repeats the same six options and a change has to be made in four
places.** Cause: `options` was left empty and each configuration was written as a complete set. That
works — configurations may contain anything — but it defeats the model. Fix: hoist everything common
into `options` and leave only the differences behind:

```json
{
  "build": {
    "builder": "@angular/build:application",
    "options": {
      "tsConfig": "tsconfig.app.json",
      "browser": "src/main.ts",
      "assets": [{ "glob": "**/*", "input": "public" }],
      "styles": ["src/styles.css"]
    },
    "configurations": {
      "production": { "outputHashing": "all" },
      "staging": { "outputHashing": "all", "sourceMap": true },
      "development": { "optimization": false, "sourceMap": true }
    }
  }
}
```

**Symptom: `"options": {}` in a generated target looks like something the schematic failed to
fill in.** Cause: it is a deliberate placeholder. `options` is optional in the schema and an absent
one is read as an empty object, so `{}` is exactly equivalent to omitting the key. Fix: nothing —
put the options you want there:

```json
{
  "serve": {
    "builder": "@angular/build:dev-server",
    "options": { "port": 4300, "proxyConfig": "proxy.conf.json" }
  }
}
```

## Interview questions

**★ What is the difference between `options` and `configurations` in a target?**
`options` is the base: the documentation calls it the section that *"configures default options for
the target"*, and states that when no configuration is selected, `options` is used *"directly without
modification"*. `configurations` is a map of named alternative sets, each of which is applied on top
of `options` when selected. The important structural point is that a configuration entry is validated
against the *same* schema as `options`, so any option may appear in either and none of the builder's
required options is required inside a configuration — the requirement applies to the merged result.

**★ What does `defaultConfiguration` do, and what happens when it is not set?**
It names the configuration applied when the command line does not select one. The documentation is
explicit about both halves: it *"specifies which configuration is used by default"*, and *"when
`defaultConfiguration` is not set, `options` are used directly without modification"*. A generated
workspace sets it to `production` on `build` and `development` on `serve`, which is why a bare
`ng build` produces an optimised bundle and a bare `ng serve` does not. Anyone reasoning about what a
plain command does has to read that key first.

**★ Why is it possible to write a configuration that omits a required builder option?**
Because the requirement is not applied per configuration. The schema points a configuration entry at
the builder's own option schema, but the `required` list there governs the options object the builder
finally receives — the merged one — not each fragment that contributed to it. That is what makes
`"production": { "outputHashing": "all" }` a complete configuration. The cost of that convenience is
that putting `tsConfig` only in a configuration is not a schema error, and the build fails only when
run without that configuration.

**Why does the generated `serve` target have an empty `options` object?**
Because it is a placeholder. `options` is optional and the code that reads it substitutes an empty
object when it is missing, so `"options": {}` and omitting the key entirely are equivalent. The
schematic writes it so that there is an obvious place to put a `port`, a `proxyConfig` or a `host`
without having to work out where such a key belongs. It is not evidence that the serve target has no
configurable behaviour.

**When would you put a setting in `options` rather than in a configuration?**
When it is true for every way the target runs. Entry points, `tsConfig`, asset globs and global
stylesheets belong there; content hashing, source maps, budgets and optimisation levels differ per
environment and belong in configurations. There is a second, sharper test that comes from the merge
rule in [04b](04b-the-merge-is-shallow.md): if a value is an array or an object that several
configurations would each want to adjust, putting it in `options` and adjusting it per configuration
does not work the way people expect, and the decision about where it lives has to account for that.

**A colleague puts every option in every configuration and leaves `options` empty. Is that wrong?**
It is legal and it is worse. Configurations accept any option, so a complete set in each one works,
and it means every shared change has to be made once per configuration, with nothing to catch the one
you missed. The model the file is designed around — a base plus named differences — also makes review
possible: a reader can see what production changes by reading five lines instead of diffing two
twenty-line blocks.

---

← Prev: [A typo has no schema error](03f-a-typo-has-no-schema-error.md) · Index: [Topic index](README.md) · Next → [The merge is shallow](04b-the-merge-is-shallow.md)
