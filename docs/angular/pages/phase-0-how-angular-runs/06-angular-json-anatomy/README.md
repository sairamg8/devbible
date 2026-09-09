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

🚧 **Being written.** Chunks land one at a time and every row below links to a page that exists;
planned chunks appear as plain text until they do, because a link to a page that does not exist
fails the build for the whole site.

| # | Chunk | Covers |
|---|---|---|
| 01 | **The file the CLI reads** *(not written yet)* | Filenames, lookup order, global config, `version`, `$schema`, JSONC |
| 02 | **`projects` and the project object** *(not written yet)* | 🔴 Only `root` and `projectType` are required; the `^[a-z]{1,3}-` escape hatch |
| 03 | **Targets and builders** *(not written yet)* | How `pkg:name` resolves to a function; aliases; `ng run` |
| 04 | **`options` and `configurations`** *(not written yet)* | 🔴 The merge is **shallow**; `defaultConfiguration`; comma lists |
| 05 | **The generated project, line by line** *(not written yet)* | Every field the application schematic writes, and why |
| 06 | **What you set and what you never touch** *(not written yet)* | The scaffolding/live split |
| 07 | **`fileReplacements`** *(not written yet)* | The schema, the environments schematic, and the modern alternative |
| 08 | **Budgets: the seven types** *(not written yet)* | What each type actually sums |
| 09 | **When a budget fails** *(not written yet)* | 🔴 The verbatim messages, error vs warning, and a docs/CLI defaults discrepancy |
| 10 | **`assets`, `styles`, `scripts`** *(not written yet)* | `assetPattern`, the object forms, `bundleName`/`inject` |
| 11 | **`outputPath`, `index`, and the shape of `dist`** *(not written yet)* | The `outputPath` object; `browser`/`server`/`media`; `index`'s three forms |
| 12 | **`optimization` and `sourceMap`** *(not written yet)* | The nested objects and every default |
| 13 | **The `cli` block and workspace-wide defaults** *(not written yet)* | `cli`, `schematics`, `newProjectRoot`, cache, precedence |
| 14 | **Multi-project workspaces** *(not written yet)* | 🔴 No `defaultProject`; cwd resolution; the verbatim "Cannot determine project" error |
| 15 | **When `angular.json` is wrong** *(not written yet)* | The whole error surface: schema, reader, resolver |

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

← Prev: [05 · The build: `@angular/build`](../05-the-build-angular-build/README.md) · Index: [Phase 0](../README.md) · Next topic → **07 · The TypeScript setup Angular requires** *(not written yet)*
