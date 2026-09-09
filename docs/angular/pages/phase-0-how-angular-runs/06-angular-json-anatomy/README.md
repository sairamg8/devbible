---
title: "`angular.json` has six top-level keys, only one of which is required, and its schema forbids things the CLI's own reader tolerates — so the file that configures every command is stricter on paper than in practice"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json)
> at tag `v22.1.7`, which is the file every generated `angular.json` points its `$schema` at, and
> [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config).
> 🔴 **Where the schema and the published page disagree, this topic quotes both and says so.**
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Topic [05](../05-the-build-angular-build/README.md) established that `ng build` runs one string
out of this file. This topic is the file.** Every Angular command reads it, its schema is a real
JSON Schema you can hold the CLI to, and almost everything people get wrong about it comes from
tutorials describing a version that no longer exists.

🔴 **`defaultProject` is gone.** It appears nowhere in the schema at 22.1.7. Any page, blog post or
memory that mentions it is describing Angular 13 or earlier.

🔴 **`architect` and `targets` are the same field under two names, and the schema's `anyOf` is a
legal XOR — having both is invalid.** The CLI's workspace reader is more forgiving than that, which
is exactly the kind of gap this topic exists to name rather than smooth over.

## Chunks

Sixty-seven pages across fifteen concepts. Every concept that outgrew the 300-line cap split on a
concept boundary into lettered siblings — `options` and `configurations` alone became seven pages,
because the merge being **shallow** is the single most consequential thing in this file.

| # | Chunk |
|---|---|
| 01 | **[The file the CLI reads](01-the-file-the-cli-reads.md)** |
| 01b | [The global config file](01b-the-global-config-is-a-different-file.md) |
| 01c | [It is JSONC, not JSON](01c-the-file-is-jsonc-not-json.md) |
| 01d | [The six top-level keys](01d-version-and-the-six-top-level-keys.md) |
| 01e | [The version gate](01e-the-version-gate.md) |
| 02 | **[`projects` and the project object](02-projects-and-the-project-object.md)** |
| 02b | [`root`, `sourceRoot`, `prefix`](02b-root-sourceroot-and-prefix.md) |
| 02c | [The empty `root`](02c-the-empty-root-and-workspace-layout.md) |
| 02d | [`architect` or `targets`](02d-architect-or-targets.md) |
| 02e | [The extension escape hatch](02e-the-extension-escape-hatch.md) |
| 02f | [Living with extension keys](02f-living-with-extension-keys.md) |
| 03 | **[Targets and builders](03-targets-and-builders.md)** |
| 03b | [The six wired target names](03b-the-six-command-bound-targets.md) |
| 03c | [The seventeen builder strings](03c-the-seventeen-builder-strings.md) |
| 03d | [Resolving a builder string](03d-how-a-builder-string-becomes-a-function.md) |
| 03e | [The error ladder](03e-the-error-ladder-of-an-invocation.md) |
| 03f | [A typo has no schema error](03f-a-typo-has-no-schema-error.md) |
| 04 | **[`options` and `configurations`](04-options-and-configurations.md)** |
| 04b | [The merge is shallow](04b-the-merge-is-shallow.md) |
| 04c | [The two canonical cases](04c-the-two-canonical-cases.md) |
| 04d | [Every shape the rule bites](04d-every-option-shape-the-rule-bites.md) |
| 04e | [Designing configurations](04e-designing-configurations.md) |
| 04f | [Selecting a configuration](04f-selecting-a-configuration.md) |
| 04g | [Configurations are per target](04g-configurations-are-per-target.md) |
| 05 | **[The generated project](05-the-generated-project-line-by-line.md)** |
| 05b | [The project-level fields](05b-the-five-project-level-fields.md) |
| 05c | [The build target](05c-the-build-target.md) |
| 05d | [serve, test and libraries](05d-serve-test-and-libraries.md) |
| 05e | [The keys that are not there](05e-the-keys-that-are-not-there.md) |
| 06 | **[What you set, what you never touch](06-what-you-set-and-what-you-never-touch.md)** |
| 06b | [The scaffolding half](06b-scaffolding-you-do-not-edit.md) |
| 06c | [The live fields](06c-the-fields-a-real-project-changes.md) |
| 07 | **[fileReplacements](07-file-replacements.md)** |
| 07b | [Environments in practice](07b-environments-in-practice.md) |
| 07c | [Adding an environment](07c-adding-a-new-environment.md) |
| 07d | [Secrets, conflicts, alternative](07d-secrets-conflicts-and-the-alternative.md) |
| 08 | **[Budgets: the seven types](08-budgets-the-seven-types.md)** |
| 08b | [What each type sums](08b-what-each-type-sums.md) |
| 08c | [What reaches the calculator](08c-what-reaches-the-calculator.md) |
| 08d | [Threshold strings](08d-threshold-strings-and-the-baseline.md) |
| 09 | **[When a budget fails](09-when-a-budget-fails.md)** |
| 09b | [Raw bytes and the defaults](09b-raw-bytes-and-the-defaults-discrepancy.md) |
| 10 | **[`assets`, `styles`, `scripts`](10-assets-styles-and-scripts.md)** |
| 11 | **[`outputPath`, `index`, `dist`](11-outputpath-index-and-dist.md)** |
| 12 | **[`optimization` and `sourceMap`](12-optimization-and-sourcemap.md)** |
| 13 | **[The `cli` block](13-the-cli-block-and-workspace-defaults.md)** |
| 13b | [Where the block comes from](13b-where-the-cli-block-comes-from.md) |
| 13c | [`packageManager`](13c-the-package-manager-key.md) |
| 13d | [`analytics` and `warnings`](13d-analytics-and-warnings.md) |
| 13e | [`cli.cache`](13e-the-cache-key.md) |
| 13f | [Which `cli` block wins](13f-two-levels-of-cli.md) |
| 13g | [The project-level block](13g-the-project-level-cli-block.md) |
| 13h | [`schematics` defaults](13h-schematics-and-generator-defaults.md) |
| 13i | [`schematicCollections`](13i-schematic-collections.md) |
| 13j | [`newProjectRoot`](13j-newprojectroot.md) |
| 14 | **[Multi-project workspaces](14-multi-project-workspaces.md)** |
| 14b | [What commands do with it](14b-what-the-commands-do-with-it.md) |
| 14c | [Multi-target and `ng run`](14c-multi-target-commands-and-ng-run.md) |
| 14d | [The empty root and layout](14d-designing-for-unambiguous-resolution.md) |
| 14e | [Name the project](14e-name-the-project.md) |
| 15 | **[When it is wrong](15-when-angular-json-is-wrong.md)** |
| 15b | [Warnings that drop keys](15b-the-warnings-that-drop-keys.md) |
| 15c | [Complaints, not deletions](15c-complaints-that-are-not-deletions.md) |
| 15d | [Reading a validation failure](15d-option-validation-failures.md) |
| 15e | [Closed schemas and spelling](15e-four-ways-to-fail-a-closed-schema.md) |
| 15f | [Migrated and misplaced](15f-migrated-and-misplaced-options.md) |
| 15g | [The diagnostic recipe](15g-the-diagnostic-recipe.md) |

## Where this sits

[05](../05-the-build-angular-build/README.md) explained what the build system *is*. This topic
explains the file that selects it and configures it, which is also the file that
[04](../04-ng-update-not-npm-install/README.md)'s migrations rewrite on your behalf. Topics 07 and
08 then cover the TypeScript setup the build demands and what `ng new` lays down.

## Phase gate

You are done with this topic when you can read an unfamiliar `angular.json` and say what every key
does, predict what `ng build --configuration production` will actually merge before running it,
explain why a nested object in a configuration replaces rather than merges, and diagnose a workspace
error from its message alone.

---

← Prev: [05 · The build: `@angular/build`](../05-the-build-angular-build/README.md) · Index: [Phase 0](../README.md) · Start → [01 · The file the CLI reads](01-the-file-the-cli-reads.md) · Next topic → **07 · The TypeScript setup Angular requires** *(not written yet)*
