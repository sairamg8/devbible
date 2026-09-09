---
title: "Six option shapes in the application builder are arrays or objects, and every one of them is destroyed rather than extended by a configuration that mentions it — this is the list to check before writing a new configuration"
sidebar_label: "04d · Every shape the rule bites"
sidebar_position: 4.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> `getOptionsForTarget` in
> [`packages/angular_devkit/architect/node/node-modules-architect-host.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/architect/node/node-modules-architect-host.ts)
> and the option types in
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json),
> both at tag `v22.1.7`. Documentation-validated; **no sandbox run** — the effective option objects
> below are derived from the spread in the source, not captured from a build.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[04b](04b-the-merge-is-shallow.md) established the rule; this page is the inventory of what it
does damage to, and [04e](04e-designing-configurations.md) is what to do about it.** The shallow spread is harmless for a scalar — a string, a boolean, a number — and
destructive for every array and every object. The application builder has enough of both that the
practical question when writing any configuration is: *is the value I am about to set a structured
one, and if so, what am I discarding?* Below is each shape, what it costs, and what the restated
version looks like.

## The shapes to check before writing a configuration

| Option | Type | What a configuration destroys |
|---|---|---|
| `budgets` | array | every budget declared in `options` |
| `assets` | array | every asset pattern, including the `public` directory |
| `styles` | array | every global stylesheet |
| `scripts` | array | every injected script |
| `fileReplacements` | array | every replacement declared in `options` |
| `define` | object | every constant not restated |
| `optimization` | boolean or object | all sub-keys when replaced by a boolean or a partial object |
| `sourceMap` | boolean or object | the same |
| `outputPath` | string or object | the object form's `base`/`browser`/`media` sub-paths |
| `stylePreprocessorOptions` | object | `includePaths` and any sibling sub-key |
| `loader` | object | every extension mapping not restated |

🔴 **Scalars are safe; structure is not.** `outputHashing`, `aot`, `extractLicenses`, `baseHref`,
`namedChunks` and their kind can be set in a configuration with no side effects at all, because
replacing a scalar with a scalar is exactly what you meant.

## The array that silently stops copying files

```json
{
  "build": {
    "builder": "@angular/build:application",
    "options": {
      "tsConfig": "tsconfig.app.json",
      "assets": [{ "glob": "**/*", "input": "public" }]
    },
    "configurations": {
      "staging": {
        "assets": [{ "glob": "robots.staging.txt", "input": "config", "output": "/" }]
      }
    }
  }
}
```

Under `--configuration staging` the effective `assets` is the staging array **only**: the entire
`public` directory stops being copied. Nothing errors — the build succeeds and produces an
application missing its favicon, its images and anything else that lived there. Restate the base
entry:

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

## One `define` entry wipes the rest

```json
{
  "build": {
    "builder": "@angular/build:application",
    "options": {
      "tsConfig": "tsconfig.app.json",
      "define": {
        "API_BASE": "\"/api\"",
        "FEATURE_FLAGS": "\"default\"",
        "BUILD_CHANNEL": "\"stable\""
      }
    },
    "configurations": {
      "production": { "define": { "BUILD_CHANNEL": "\"release\"" } }
    }
  }
}
```

`define` is an object, so the production configuration's `define` replaces the whole map:
`API_BASE` and `FEATURE_FLAGS` cease to exist in a production build. This one is particularly nasty
because the failure is a compile-time identifier that is suddenly unreplaced, and the error will
point at application source rather than at `angular.json`.

## Gotchas

**★ Symptom: a `staging` configuration that adds one asset makes `public/` stop being copied.**
Cause: `assets` is an array and the configuration's array replaced it. The build succeeds, so this is
usually found by a missing favicon in a deployed environment. Fix: restate the base entry alongside
the new one:

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

**★ Symptom: a global stylesheet disappears in one configuration only.** Cause: `styles` is an array
and that configuration set its own. Fix: include the base stylesheet in every configuration that
touches `styles`, or — better — do not touch `styles` in configurations at all:

```json
{
  "configurations": {
    "staging": { "styles": ["src/styles.css", "src/styles.staging.css"] }
  }
}
```

**★ Symptom: a `define` value used everywhere is undefined in production only.** Cause: `define` is an
object and the production configuration replaced the entire map to change one entry. Fix: restate the
whole map:

```json
{
  "configurations": {
    "production": {
      "define": {
        "API_BASE": "\"/api\"",
        "FEATURE_FLAGS": "\"default\"",
        "BUILD_CHANNEL": "\"release\""
      }
    }
  }
}
```

**★ Symptom: `sourceMap` sub-options set in `options` are ignored when a configuration sets
`"sourceMap": true`.** Cause: `sourceMap` also accepts a boolean or an object, and the boolean
replaced the object — including `vendor`, `scripts` and `styles` sub-keys. Fix: use the object form
in the configuration too:

```json
{
  "configurations": {
    "development": {
      "sourceMap": { "scripts": true, "styles": true, "vendor": false }
    }
  }
}
```

**Symptom: an `outputPath` object configured with `browser` and `media` sub-paths reverts to
defaults when a configuration sets a plain string.** Cause: the string replaced the object. Fix:
keep both forms consistent — either the string everywhere or the object everywhere:

```json
{
  "options": { "outputPath": { "base": "dist/storefront", "browser": "" } },
  "configurations": {
    "staging": { "outputPath": { "base": "dist/storefront-staging", "browser": "" } }
  }
}
```

**Symptom: `fileReplacements` in a configuration drops a replacement declared in `options`.** Cause:
another array. Fix: restate the full list in each configuration that needs any of it:

```json
{
  "configurations": {
    "production": {
      "fileReplacements": [
        { "replace": "src/config/base.ts", "with": "src/config/base.prod.ts" },
        { "replace": "src/config/flags.ts", "with": "src/config/flags.prod.ts" }
      ]
    }
  }
}
```

**★ Symptom: `stylePreprocessorOptions.includePaths` stops resolving in one configuration.** Cause:
`stylePreprocessorOptions` is an object, and a configuration that sets any sub-key of it replaces the
whole object. Fix: restate every sub-key you still need:

```json
{
  "configurations": {
    "staging": {
      "stylePreprocessorOptions": {
        "includePaths": ["src/styles/shared", "src/styles/staging"]
      }
    }
  }
}
```

**Symptom: a `loader` mapping for one extension disappears when a configuration adds another.**
Cause: `loader` is an object keyed by file extension, so the configuration's map replaces the base
map entirely. Fix: restate the full map:

```json
{
  "options": {
    "tsConfig": "tsconfig.app.json",
    "loader": { ".svg": "text", ".md": "text" }
  },
  "configurations": {
    "production": { "loader": { ".svg": "text", ".md": "text", ".txt": "file" } }
  }
}
```

## Interview questions

**★ Why is `optimization` the option most likely to catch a team out?**
Because it accepts two shapes and is set constantly. `"optimization": false` in a development
configuration is idiomatic and correct, and it also destroys any object form configured in `options`.
The reverse is worse: a configuration setting `"optimization": { "fonts": { "inline": false } }` does
not inherit `scripts` and `styles` from the base — those sub-keys are simply absent and the builder
uses its own defaults. Both outcomes produce a working build with different characteristics, so
nothing tells you which one you got. `sourceMap` and `outputPath` share the dual-shape problem and
deserve the same suspicion.

**★ What is the fastest way to decide whether a key is safe to put in a configuration?**
Look up its type in the builder's option schema. If it is a boolean, string or number, a configuration
sets it cleanly and there is nothing to think about. If it is an array or an object — or accepts
either a scalar or an object — then writing it in a configuration is a complete replacement of the
base value, and the only correct form is one that restates everything you still want. That check
takes seconds and removes the entire class of bug; the alternative is discovering it from a missing
favicon in a deployed environment.

**Why does this class of bug so often reach production rather than being caught in review?**
Because nothing in the file records intent. A configuration containing a three-entry `assets` array is
indistinguishable from one that meant to add a fourth entry to a base array, and both are valid,
schema-clean JSON. There is no error, no warning and no diff signal — the base array is somewhere
else in the file and a reviewer comparing two arrays across forty lines will not reliably notice a
missing entry. The failure then appears as absent output rather than as a build failure, which is the
worst possible timing.

**★ Which option shapes are safe to set in a configuration and which are not?**
Scalars are safe — booleans, strings and numbers such as `outputHashing`, `aot`, `baseHref`,
`extractLicenses`, `namedChunks`. Everything structured is not: `budgets`, `assets`, `styles`,
`scripts` and `fileReplacements` are arrays; `define`, `loader` and `stylePreprocessorOptions` are
objects; and `optimization`, `sourceMap` and `outputPath` accept either a scalar or an object, which
makes them the worst of the set because switching form is the exact operation that discards
everything. The habit worth building is to look up the option's type before writing it into a
configuration rather than after.

**★ Why is `optimization` the most dangerous of these?**
Because it is the one people set most often and it accepts two different shapes. `"optimization":
false` in a development configuration is idiomatic, correct and completely destroys any object form
configured in `options` — and the same happens in reverse when a configuration sets a partial object
and expects the missing sub-keys to be inherited. They are not inherited from `options`; they are
absent, and the builder falls back to its own defaults. The failure is invisible because both
outcomes produce a working build with different characteristics.

---

← Prev: [The two canonical cases](04c-the-two-canonical-cases.md) · Index: [Topic index](README.md) · Next → [Designing configurations](04e-designing-configurations.md)
