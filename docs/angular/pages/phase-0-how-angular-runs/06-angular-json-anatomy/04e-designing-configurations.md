---
title: "There is no additive syntax, no `$merge` and no way to reference the base array — so a configuration you can reason about is one that sets scalars, and the structured values are a design decision you make once"
sidebar_label: "04e · Designing configurations"
sidebar_position: 4.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> `getOptionsForTarget` in
> [`packages/angular_devkit/architect/node/node-modules-architect-host.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/architect/node/node-modules-architect-host.ts)
> and the `target` definition in
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json),
> both at tag `v22.1.7`. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Knowing that the merge is shallow does not tell you what to write instead — and the two obvious
responses are both wrong.** Restating everything in every configuration produces a file nobody can
diff; restating nothing produces silent data loss. What works is a small set of habits derived from
the rule itself: keep structure in `options`, keep scalars in configurations, and where a structured
value genuinely varies, decide deliberately which side of the split it lives on and make the
duplication visible rather than accidental.

## Three rules that follow from the mechanism

**1 · Configurations carry scalars.** `outputHashing`, `aot`, `sourceMap` as a boolean, `baseHref`,
`extractLicenses`, `namedChunks`, `optimization` as a boolean — replacing a scalar with a scalar is
exactly the operation the spread performs well.

**2 · `options` carries structure.** `assets`, `styles`, `scripts`, `tsConfig`, `browser`, `loader`,
`stylePreprocessorOptions`. Anything a configuration would otherwise have to restate in full is
cheaper to leave alone.

**3 · When structure genuinely varies, invert.** If three configurations each need a different
`assets` array, do not put a fourth version in `options` for them all to override — leave `assets`
out of `options` entirely and put a complete array in each configuration. Then no reader can be
misled into thinking the base value contributes something, because there is no base value.

```json
{
  "build": {
    "builder": "@angular/build:application",
    "defaultConfiguration": "production",
    "options": {
      "tsConfig": "tsconfig.app.json",
      "browser": "src/main.ts",
      "styles": ["src/styles.css"]
    },
    "configurations": {
      "production": {
        "outputHashing": "all",
        "assets": [{ "glob": "**/*", "input": "public" }]
      },
      "staging": {
        "outputHashing": "all",
        "sourceMap": true,
        "assets": [
          { "glob": "**/*", "input": "public" },
          { "glob": "robots.staging.txt", "input": "config", "output": "/" }
        ]
      },
      "development": {
        "optimization": false,
        "sourceMap": true,
        "assets": [{ "glob": "**/*", "input": "public" }]
      }
    }
  }
}
```

That file duplicates the `public` asset three times, and that is the point: every configuration
states its complete answer, and nothing depends on an inheritance that does not exist.

## Make the duplication reviewable

Where a structured value must be restated, keep the copies adjacent and identically ordered so that a
diff between two configurations is readable. A reviewer who can see both arrays in one screen will
notice a missing entry; one who has to scroll between them will not.

## What there is not

There is no `$merge`, no `extends` on a target, no array-append syntax, no reference to another
configuration's value, and no inheritance between targets
([03](03-targets-and-builders.md)). The only composition mechanism in the file is the left-to-right
spread of a comma-separated configuration list
([04f](04f-selecting-a-configuration.md)) — and that is the same shallow spread, applied repeatedly,
so it composes scalars and destroys structure exactly as one application does.

If a workspace genuinely needs computed configuration, the supported route is out of the file: a
custom builder that computes options itself, or a script that generates `angular.json` from a source
of truth. Both are large steps; the point of the three rules above is to postpone needing them.

## Gotchas

**Symptom: someone "fixes" the problem by restating every option in every configuration.** Cause:
over-correction — the rule is per key, so options a configuration does not mention are untouched.
Fix: restate only the structured values you are modifying; leave scalars and unmentioned keys alone:

```json
{
  "options": {
    "tsConfig": "tsconfig.app.json",
    "browser": "src/main.ts",
    "assets": [{ "glob": "**/*", "input": "public" }]
  },
  "configurations": {
    "production": { "outputHashing": "all" }
  }
}
```

**★ Symptom: a repository accumulates `staging`, `staging-eu`, `staging-eu-canary` configurations
that each restate a dozen options.** Cause: using configurations as an environment matrix, where the
shallow spread forces every combination to be complete. Fix: use a comma-separated list so that each
configuration is one small orthogonal difference, and let the CLI compose them left to right
([04f](04f-selecting-a-configuration.md)):

```json
{
  "configurations": {
    "staging": { "outputHashing": "all", "sourceMap": true },
    "eu": { "baseHref": "/eu/" },
    "canary": { "define": { "CHANNEL": "\"canary\"" } }
  }
}
```

**★ Symptom: nobody can tell whether a configuration's array is a deliberate replacement or an
accident.** Cause: the file records the value, not the intent, and the two look identical. Fix: put
the intent where a schematic will not remove it — a comment is legal in this file
([01c](01c-the-file-is-jsonc-not-json.md)), and an adjacent base copy makes the comparison possible:

```json
{
  "configurations": {
    // Full replacement: staging adds robots.staging.txt to the base public/ copy.
    "staging": {
      "assets": [
        { "glob": "**/*", "input": "public" },
        { "glob": "robots.staging.txt", "input": "config", "output": "/" }
      ]
    }
  }
}
```

**Symptom: a shared option is changed in `options` and one environment does not pick it up.** Cause:
that environment's configuration names the same key, so the base value never reaches it. Fix: this is
the audit — for every key present in both `options` and a configuration, decide whether the
duplication is intended, and remove the key from the configuration where it is not:

```json
{
  "options": { "tsConfig": "tsconfig.app.json", "styles": ["src/styles.css"] },
  "configurations": {
    "production": { "outputHashing": "all" },
    "development": { "optimization": false, "sourceMap": true }
  }
}
```

**Symptom: a team tries to express "production plus one change" by copying the whole production
configuration.** Cause: there is no way for one configuration to extend another. Fix: name both in a
comma-separated list at the call site instead of copying, so the second one carries only the change:

```json
{
  "scripts": {
    "build:prod-eu": "ng run storefront:build:production,eu"
  }
}
```

**Symptom: an option that only makes sense for one configuration was put in `options` "to be safe".**
Cause: a reasonable instinct with an unreasonable outcome — `options` applies to every run of that
target, including the ones where the setting is wrong. Fix: `options` is for what is always true;
anything conditional belongs in the configuration that needs it:

```json
{
  "build": {
    "builder": "@angular/build:application",
    "options": { "tsConfig": "tsconfig.app.json", "browser": "src/main.ts" },
    "configurations": {
      "development": { "sourceMap": true },
      "production": { "outputHashing": "all" }
    }
  }
}
```

**Symptom: moving a budget from a configuration into `options` changes when it is enforced.** Cause:
`options` applies to every run of the target, so a budget there is enforced in development too — and
a development build is not optimised, so its output is much larger and the budget will fail. Fix:
budgets belong in the configurations that produce comparable output:

```json
{
  "options": { "tsConfig": "tsconfig.app.json", "browser": "src/main.ts" },
  "configurations": {
    "production": {
      "outputHashing": "all",
      "budgets": [{ "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" }]
    },
    "development": { "optimization": false, "sourceMap": true }
  }
}
```

**Symptom: an injected `scripts` entry vanishes under one configuration.** Cause: `scripts` is an
array like `styles` and `assets`. Fix: include the base entries wherever the array is set:

```json
{
  "configurations": {
    "production": {
      "scripts": [
        "src/vendor/analytics.js",
        { "input": "src/vendor/monitoring.js", "bundleName": "monitoring" }
      ]
    }
  }
}
```

**Symptom: an option is set both in `options` and in every single configuration.** Cause: defensive
duplication after being bitten once. Fix: it is redundant and it hides real overrides — a key that
appears in every configuration should live only in `options`:

```json
{
  "options": { "tsConfig": "tsconfig.app.json", "browser": "src/main.ts", "aot": true },
  "configurations": {
    "production": { "outputHashing": "all" },
    "development": { "optimization": false }
  }
}
```

## Interview questions

**How would you design a workspace file to avoid being bitten by this?**
Keep structured values — arrays and objects — out of configurations wherever possible, and let
configurations carry scalars. Where a structured value genuinely differs per environment, accept that
it must be restated in full and make that obvious in review, for instance by keeping the base copy
adjacent so a diff shows both. It also helps to remember that the second half of the rule works in
your favour: anything a configuration does not name is safe, so the smaller each configuration is,
the less surface the rule has to act on.

**How would you audit an existing workspace for this class of bug?**
Read each target, list the keys that appear in both `options` and any configuration, and check the
type of each. Every array or object in that intersection is either an intentional full replacement or
a bug, and the two are indistinguishable from the file alone — so the answer has to come from asking
what the configuration was meant to do. In a large workspace this is worth scripting, because the
comparison is mechanical and the consequences of missing one (a budget that stopped being enforced, a
directory that stopped being copied) are silent by construction.

**A configuration needs to add one entry to a five-entry array. What is the least bad option?**
Restate all six entries in the configuration, and put the base copy immediately adjacent in the file
so a reviewer can see both at once. There is no additive syntax, no `$merge`, and no way to reference
the base array — the spread is the whole mechanism. The alternative worth considering is inverting
the design: move the five shared entries into every configuration and leave `options` without the
key, so that no configuration is silently dropping something a reader cannot see.

**★ There is no `extends` for a configuration. How do you express "production plus one change"?**
With a comma-separated configuration list at the call site: `ng run storefront:build:production,eu`.
The configurations are applied left to right over `options`, so `eu` needs to contain only what it
changes. That is the only composition the file offers, and it is the reason to keep each
configuration small and orthogonal — one axis per configuration — rather than building a matrix of
complete environments. The alternative people reach for, copying the production block and editing one
line, produces two configurations that drift apart on every subsequent change.

**When is it right to leave an option out of `options` entirely?**
When more than one configuration would override it anyway. A base value that every configuration
replaces contributes nothing except the false impression that it contributes something, and it is
exactly the case where a reader assumes inheritance. Leaving the key out of `options` and giving each
configuration a complete value costs some duplication and removes the ambiguity — and when a
configuration is later added, its author has to state the value rather than silently inheriting a
base that was never going to apply.

**At what point would you stop using `angular.json` for this and do something else?**
When the configuration matrix stops being expressible as a small set of orthogonal axes. The file has
no computation, no references and no deep merge, so a genuinely combinatorial deployment matrix ends
up as dozens of near-duplicate blocks that drift. The supported escapes are a custom builder that
computes its own options, or generating `angular.json` from a source of truth as a build step. Both
are significant commitments, which is why the practical answer is usually to reduce the matrix — move
environment differences out of the build and into runtime configuration — before reaching for either.

{/* FOOTER */}
