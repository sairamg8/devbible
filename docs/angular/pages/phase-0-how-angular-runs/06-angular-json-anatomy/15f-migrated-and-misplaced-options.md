---
title: "The two option failures that are not spelling mistakes — a key that belonged to the builder you migrated away from, and a valid key on the wrong target — both come from the same fact: the builder string selects the schema and translates nothing"
sidebar_label: "15f · Migrated and misplaced"
sidebar_position: 15.5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the `application` and `dev-server` option
> schemas under
> [`packages/angular/build/src/builders/`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> at tag `v22.1.7`, whose `required` and `additionalProperties` declarations are quoted below.
> Documentation-validated; **no sandbox run** — no example failure message is reproduced; how to read
> one is [15d](15d-option-validation-failures.md).
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[15e](15e-four-ways-to-fail-a-closed-schema.md) covers the two option failures that are spelling
mistakes. These two are not, and "check for typos" is useless advice for them.** In both cases the
key is a real option name, spelled correctly, that simply belongs to a different schema — the one the
old builder used, or the one the sibling target uses. The underlying fact is the same in both: **the
`builder` string selects which schema validates the options, and it translates nothing.**

## 1 · An option that belonged to the builder you migrated away from

After moving from the webpack `browser` builder to `@angular/build:application`, several options
simply do not exist on the new schema — `main`, `vendorChunk`, `commonChunk`, `buildOptimizer`,
`resourcesOutputPath` and `ngswConfigPath` among them. They are not deprecated-but-tolerated; they
are additional properties on a closed schema.

Some have successors and need renaming; others have no equivalent because the mechanism they
configured no longer exists — `vendorChunk` and `commonChunk` describe a chunking model that the
esbuild-based builder does not have. The full inventory of renames and removals is
[topic 05 · 08b](../05-the-build-angular-build/08b-the-option-renames.md).

```json
{
  "targets": {
    "build": {
      "builder": "@angular/build:application",
      "options": {
        "browser": "src/main.ts",
        "tsConfig": "tsconfig.app.json"
      }
    }
  }
}
```

`browser` is the successor to `main` — the rename is the fix, not deletion.

🔴 **This is precisely why changing a builder string by hand produces a cascade of validation
failures.** The string swaps the schema and nothing swaps the options, so every option that existed
only on the old schema becomes a violation at once. The migration exists to do both halves:

```bash
ng update @angular/cli --name use-application-builder
```

## 2 · A valid option on the wrong target

Validity is a property of the **builder**, not of the workspace. The dev-server schema is closed over
its own, much smaller property set, so a build option placed on the `serve` target fails even though
the same key is first-class one target away.

The mechanism that connects the two is `buildTarget`: `serve` points at a build target rather than
restating its options, which is why the dev-server schema does not need to duplicate them.

```json
{
  "targets": {
    "build": {
      "builder": "@angular/build:application",
      "options": { "browser": "src/main.ts", "tsConfig": "tsconfig.app.json", "sourceMap": true }
    },
    "serve": {
      "builder": "@angular/build:dev-server",
      "defaultConfiguration": "development",
      "configurations": {
        "development": { "buildTarget": "web:build:development" },
        "production":  { "buildTarget": "web:build:production" }
      }
    }
  }
}
```

The same reasoning extends across the workspace: two projects whose `build` targets name different
builders — an application and a library, say — are validated against different closed schemas, so an
option that is fine in one project is a violation in the other. That is not an inconsistency in the
workspace; it is two builders with two schemas.

## Why `tsConfig` can be absent from a configuration without error

`configurations` entries reference the **same** schema as `options`, so every builder option is legal
inside a configuration. But `required: ["tsConfig"]` is applied to the **merged** result rather than
to each configuration independently — which is why a `development` configuration containing only
three overrides is complete and valid:

```json
{
  "options": {
    "browser": "src/main.ts",
    "tsConfig": "tsconfig.app.json"
  },
  "configurations": {
    "development": {
      "optimization": false,
      "extractLicenses": false,
      "sourceMap": true
    }
  }
}
```

The corollary is the failure mode: if `tsConfig` is missing from `options`, the error appears no
matter which configuration you select, because the merged object is what is validated.

## Telling all four apart quickly

| The offending key is | Which case | Fix |
|---|---|---|
| almost a real option name | a typo — [15e](15e-four-ways-to-fail-a-closed-schema.md) | correct the spelling |
| a real option name with hyphens | command-line form — [15e](15e-four-ways-to-fail-a-closed-schema.md) | convert to `camelCase` |
| a real option name from an older builder | half-done migration — this page | rename or remove; run the migration |
| a real option name on this builder's sibling | wrong target — this page | move it, and connect with `buildTarget` |

The parenthesised property name in the failure message is what feeds the left-hand column —
[15d](15d-option-validation-failures.md) is how to find it.

## Gotchas

**★ Symptom: after switching to `@angular/build:application`, options that worked for years are
rejected.** Cause: they belonged to the webpack `browser` builder's schema and do not exist on the
new one — `main`, `vendorChunk`, `commonChunk`, `buildOptimizer`, `resourcesOutputPath` and
`ngswConfigPath` among them. Fix: rename what has a successor and delete what does not; `main` becomes
`browser`:

```json
{
  "builder": "@angular/build:application",
  "options": { "browser": "src/main.ts", "tsConfig": "tsconfig.app.json" }
}
```

**★ Symptom: you changed the builder string by hand and now half the options are rejected at once.**
Cause: the string selects the schema and nothing else; it does not translate the options underneath
it, so every option unique to the old schema becomes a violation simultaneously. Fix: let the
migration do both halves, and hand-edit only what it leaves behind:

```bash
ng update @angular/cli --name use-application-builder
```

**★ Symptom: a perfectly valid build option is rejected on the `serve` target.** Cause: the dev-server
schema is closed over its own, much smaller property set — validity is per builder, not per
workspace. Fix: put the option on the build target and let `serve` point at it:

```json
{
  "targets": {
    "build": { "builder": "@angular/build:application", "options": { "tsConfig": "tsconfig.app.json", "sourceMap": true } },
    "serve": { "builder": "@angular/build:dev-server", "configurations": { "development": { "buildTarget": "web:build:development" } } }
  }
}
```

**★ Symptom: an option is accepted on one project and rejected on another in the same workspace.**
Cause: the two projects' targets name different builders, so they are validated against different
closed schemas. Fix: check the `builder` value on each target before concluding the workspace is
inconsistent:

```json
{
  "projects": {
    "web": { "root": "projects/web", "projectType": "application", "targets": { "build": { "builder": "@angular/build:application", "options": { "tsConfig": "projects/web/tsconfig.app.json" } } } },
    "ui":  { "root": "projects/ui",  "projectType": "library",     "targets": { "build": { "builder": "@angular/build:ng-packagr" } } }
  }
}
```

**Symptom: `tsConfig` is reported missing even though a configuration sets everything else.** Cause:
`required` applies to the merged result, and configurations are overrides rather than complete option
sets. Fix: `tsConfig` belongs in `options`, where it applies to every configuration:

```json
{
  "options": { "browser": "src/main.ts", "tsConfig": "tsconfig.app.json" },
  "configurations": { "production": { "outputHashing": "all" } }
}
```

**Symptom: you deleted an old option rather than renaming it, and a behaviour you relied on
disappeared.** Cause: some old options have successors and some do not, and deleting is only correct
for the second group — `main` has a successor, `vendorChunk` does not because the chunking model it
described no longer exists. Fix: check the rename table before deleting:

```json
{
  "builder": "@angular/build:application",
  "options": { "browser": "src/main.ts", "tsConfig": "tsconfig.app.json", "polyfills": ["zone.js"] }
}
```

**Symptom: you moved a build option onto `serve` because `ng serve` was not picking it up.** Cause:
`serve` does not merge the build target's options into its own — it *invokes* the build target named
by `buildTarget`, and that target's options apply there. Fix: change the build target, or add a
configuration to it and point `serve` at that configuration:

```json
{
  "targets": {
    "build": {
      "builder": "@angular/build:application",
      "options": { "browser": "src/main.ts", "tsConfig": "tsconfig.app.json" },
      "configurations": { "development": { "optimization": false, "sourceMap": true } }
    },
    "serve": {
      "builder": "@angular/build:dev-server",
      "configurations": { "development": { "buildTarget": "web:build:development" } }
    }
  }
}
```

## Interview questions

**★ You migrated to `@angular/build:application` and options that worked for years are now rejected.
What happened?**
The builder string selects the option schema, and the new schema is a different closed set. Options
belonging to the webpack `browser` builder — `main`, `vendorChunk`, `commonChunk`, `buildOptimizer`,
`resourcesOutputPath`, `ngswConfigPath` and others — are not properties of the `application` schema,
so they are additional properties on a schema that forbids them. Some have successors and need
renaming, most obviously `main` to `browser`; others have no equivalent because the mechanism they
configured no longer exists. Changing the builder string by hand without migrating the options
produces exactly this, which is why the migration exists and why it does both halves.

**★ Why can the same option be valid on one target and invalid on another?**
Because validity is a property of the builder, not of the workspace. Each target names a builder,
each builder ships its own `schema.json`, and the assembled options for that target are validated
against that schema alone. The dev-server schema is a much smaller closed set than the application
builder's, so a build option on a `serve` target is an additional property there even though it is a
first-class option one target away. The same applies across projects: an application's `build` target
and a library's `build` target name different builders and are validated against different schemas.

**★ Four different mistakes produce the same failure. How do you tell them apart?**
By what the offending key *is*, which the message names in parentheses. A key that is almost a real
option is a typo. A real option name written with hyphens is the command-line spelling, and the file
wants `camelCase`. A real option name that belonged to an older builder is a half-finished migration
— the builder string was changed and the options were not. And a real option name that exists on a
sibling builder is a placement mistake, fixed by moving it to the target whose builder owns it and
wiring the two together with `buildTarget`. Only the first two are spelling problems, which is why
"check for typos" is unhelpful advice for the other half.

**Why is `tsConfig` required, yet a `development` configuration that omits it is valid?**
Because `configurations` entries reference the same schema as `options`, and `required` is enforced
against the merged object rather than against each configuration in isolation. A configuration is a
set of overrides, not a complete option set, so it is expected to be partial. The corollary is the
failure worth remembering: if `tsConfig` is missing from `options` itself, the error appears
whichever configuration you select, because every merged result is missing it.

**Why does `serve` have so few options of its own?**
Because it does not rebuild the option surface — it points at a build target with `buildTarget` and
invokes it. The dev-server schema therefore only needs the options that are genuinely about serving:
the port, the host, proxying, and the pointer itself. That design is what makes "put the build option
on the build target" the correct instruction rather than a workaround, and it is also why a serve
configuration usually contains nothing but a `buildTarget` value.

**Someone deletes every option the new schema rejects. What is wrong with that approach?**
It conflates two groups. Options like `main` have successors and deleting them removes real
configuration — the entry point is still needed, it is just called `browser` now. Options like
`vendorChunk` describe a mechanism the new builder does not have, and deleting them is correct.
Blanket deletion gets the second group right and silently changes behaviour for the first, and the
symptom arrives later as a build that no longer does something it used to. Checking each key against
the rename inventory is the difference between a migration and a truncation.

---

← Prev: [Closed schemas and spelling](15e-four-ways-to-fail-a-closed-schema.md) · Index: [Topic index](README.md) · Next → [The diagnostic recipe](15g-the-diagnostic-recipe.md)
