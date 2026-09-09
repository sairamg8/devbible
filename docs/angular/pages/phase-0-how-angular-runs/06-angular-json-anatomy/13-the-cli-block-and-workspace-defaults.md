---
title: "The `cli` block is the one part of `angular.json` no builder ever sees — five keys read by the CLI process itself, stored by the reader without inspection, and closed to additions at three separate depths"
sidebar_label: "13 · The `cli` block"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json)
> and the extension constants in
> [`packages/angular_devkit/core/src/workspace/json/reader.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts),
> both at tag `v22.1.7`. Documentation-validated; **no sandbox run** — the schema and source below
> are transcribed from the CLI repository, not produced by running a command.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Almost every key in `angular.json` is an argument to some builder, which is why the file behaves
like a target graph rather than a settings file. The `cli` block is the exception.** Nothing in it
reaches Architect, nothing in it reaches `@angular/build`, and no builder option schema mentions it.
It is read by the CLI process before a target is resolved at all — which is why it is the only block
that can change the behaviour of `ng add`, `ng update` and `ng generate`, commands that never run a
builder. It has exactly five keys and it is closed at three separate depths, which makes it one of
the few parts of the file you can hold to a complete inventory.

## The block the builders never see

The mechanism is worth stating precisely, because it explains every failure mode across the next
five pages.

When you run `ng build my-app --configuration production`, Architect is handed three things: a
project name, a target name, and an options object assembled from `options` plus the named
configurations. That options object is validated against the builder's own `schema.json` and passed
to the builder function. `cli` is not in it, at any stage. There is no path by which a builder can
read `cli.packageManager` or `cli.cache`.

The consumers of the block live inside the CLI's own utilities instead — the package-manager
chooser, the analytics decision, the version-mismatch warning, the disk-cache setup, and the
schematic-collection resolver. Two consequences follow, and both are load-bearing:

1. **A wrong `cli` key does not fail one target — it changes, or fails to change, every command.**
   There is no `--configuration` that overrides it and no target that isolates it. Its blast radius
   is the workspace.
2. **The workspace reader does not police it.** `cli` is an *extension* as far as the reader is
   concerned, so the whole object is stored untouched and its inner keys are never inspected.

## `cli` is an "extension", and the reader says so by name

The reader keeps two frozen lists of the key names it recognises without treating them as
third-party additions, verbatim from `reader.ts`:

```ts
const ANGULAR_WORKSPACE_EXTENSIONS = Object.freeze(['cli', 'newProjectRoot', 'schematics']);
const ANGULAR_PROJECT_EXTENSIONS = Object.freeze(['cli', 'schematics', 'projectType', 'i18n']);
```

Three facts fall straight out of those two lines:

- **`cli` appears in both lists**, which is the proof that a `cli` block is legal at the workspace
  level *and* at the project level. Which one wins is [13f](13f-two-levels-of-cli.md).
- **`cli`, `newProjectRoot` and `schematics` are the entire non-`projects` payload of the file.**
  `$schema` and `version` are skipped by the parser, `projects` is parsed structurally, and what is
  left is those three. That is the whole of "workspace-wide defaults" as a category, and it is why
  this page and [13h](13h-schematics-and-generator-defaults.md) between them cover every top-level
  key that is not `projects`. The six-key inventory itself is
  [01d](01d-version-and-the-six-top-level-keys.md).
- **Being on the list means "do not warn about this name"**, not "validate this value". The reader
  stores the object and moves on. Nothing downstream of the reader re-checks the inner keys.

What *declares* the inner shape is the schema, and what validates against the schema in practice is
your editor, through the `$schema` line at the top of the file. Keep that line.

## The complete definition, from the schema

Verbatim from `workspace-schema.json` at `v22.1.7` — the entire `cliOptions` definition, which is
what the top-level `cli` key `$ref`s:

```json
"cliOptions": {
  "type": "object",
  "properties": {
    "schematicCollections": {
      "type": "array",
      "description": "The list of schematic collections to use.",
      "items": { "type": "string", "uniqueItems": true }
    },
    "packageManager": {
      "description": "Specify which package manager tool to use.",
      "type": "string",
      "enum": ["npm", "yarn", "pnpm", "bun"]
    },
    "warnings": {
      "description": "Control CLI specific console warnings",
      "type": "object",
      "properties": {
        "versionMismatch": {
          "description": "Show a warning when the global version is newer than the local one.",
          "type": "boolean"
        }
      },
      "additionalProperties": false
    },
    "analytics": {
      "type": ["boolean", "string"],
      "description": "Share pseudonymous usage data with the Angular Team at Google."
    },
    "cache": {
      "description": "Control disk cache.",
      "type": "object",
      "properties": {
        "environment": {
          "description": "Configure in which environment disk cache is enabled.",
          "type": "string",
          "enum": ["local", "ci", "all"]
        },
        "enabled": {
          "description": "Configure whether disk caching is enabled.",
          "type": "boolean"
        },
        "path": { "description": "Cache base path.", "type": "string" }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```

Five keys — and note that `additionalProperties: false` appears **three** times, on `cliOptions`, on
`warnings` and on `cache`. Each nested object is closed independently, so an invented key is a
schema violation at whatever depth you invent it. There is no extension slot anywhere inside this
block:

| Key | Type | What reads it | Page |
|---|---|---|---|
| `packageManager` | `string`, enum of four | the installer the CLI shells out to | [13c](13c-the-package-manager-key.md) |
| `analytics` | `boolean \| string` | the usage-reporting decision | [13d](13d-analytics-and-warnings.md) |
| `warnings` | object, one property | console warnings the CLI itself prints | [13d](13d-analytics-and-warnings.md) |
| `cache` | object, three properties | the persistent disk cache the build uses | [13e](13e-the-cache-key.md) |
| `schematicCollections` | `string[]` | which package a `ng generate` name resolves against | [13h](13h-schematics-and-generator-defaults.md) |

Where the block comes from, and why most generated workspaces do not have one at all, is
[13b](13b-where-the-cli-block-comes-from.md).

## Gotchas

**★ Symptom: `"packagemanager": "pnpm"` (lower-case `m`) has no effect and produces no error.**
Cause: the reader lists `cli` in `ANGULAR_WORKSPACE_EXTENSIONS` and stores the whole object without
inspecting its inner keys, so nothing at read time rejects the misspelling; the value is then looked
up by its real name by whichever utility wants it, is not found, and the default applies. Fix:
correct the case, and keep `$schema` at the top of the file so an editor is the thing that catches
this class of mistake:

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "cli": { "packageManager": "pnpm" }
}
```

**★ Symptom: you delete the `$schema` line as noise, and from then on every typo inside `cli` is
silent.** Cause: `$schema` is skipped by the reader and has no runtime effect, so removing it breaks
nothing immediately — but it is the only thing pointing an editor at the definition that declares
these five keys, and the reader will never complain on the schema's behalf. Fix: put it back, with
the relative path generation writes:

```json
{ "$schema": "./node_modules/@angular/cli/lib/config/schema.json", "version": 1 }
```

**★ Symptom: `"cli": { "cache": { "enabled": true, "maxSize": "2GB" } }` is rejected by your
editor.** Cause: `cache` is closed too — `environment`, `enabled` and `path` are its only properties
at 22.1.7, and there is no size control among them. Fix: drop the invented key:

```json
{ "cli": { "cache": { "enabled": true, "path": ".angular/cache" } } }
```

**Symptom: a third-party tool wants to store configuration in `angular.json` and its key is
rejected.** Cause: the top level is `additionalProperties: false` and `cli` is closed, so there is
no general-purpose slot in either. Fix: use the short-prefix extension pattern that the reader and
the schema both honour — one to three lowercase letters, a hyphen, then anything — at the top level
rather than inside `cli`:

```json
{
  "version": 1,
  "nx-plugin": { "anything": "the CLI will not read this, and will not warn about the name" },
  "projects": {}
}
```

**Symptom: you expect `ng build --cache false` to override `cli.cache.enabled` and there is no such
flag.** Cause: `cli` is not builder input, so it is not part of any target's option surface and
nothing in the command-line parser maps to it. Fix: change the file, or use the environment lever
the build package reads instead of a flag that does not exist:

```json
{ "cli": { "cache": { "enabled": false } } }
```

## Interview questions

**★ What makes the `cli` block different from every other block in `angular.json`?**
It is not builder input. Every other meaningful key in the file ends up inside the options object
that Architect validates against a builder's `schema.json` and hands to a builder function; `cli` is
read by the CLI process itself, before target resolution. That is why it is the only part of the
file that can affect `ng add`, `ng update` and `ng generate`, none of which run a builder, and why
no `--configuration` can override it. It also means the block is invisible to the layer that
produces most of the error messages people associate with `angular.json` — a mistake here tends to
be silent rather than loud.

**★ If a key inside `cli` is misspelled, what actually happens?**
Nothing visible, in the general case. The reader names `cli` in `ANGULAR_WORKSPACE_EXTENSIONS` and
stores the object under `extensions` without walking into it, so no error and no warning is raised
for an inner key it does not recognise. The value is then looked up by name by whichever CLI utility
wants it, the misspelling is not found, and the default applies. The schema is what declares the key
set, which makes editor validation through `$schema` the practical line of defence and is the
strongest argument against deleting that line.

**★ How many closed objects are there inside the `cli` block, and why does it matter?**
Three: `cliOptions` itself, `warnings`, and `cache` all carry `additionalProperties: false`. It
matters because it makes the block fully enumerable — the five keys are the complete surface at
22.1.7, so anything else you find in a `cli` block came from an older CLI or from a
misunderstanding, and you can say that with confidence rather than guessing. Contrast it with
`schematics`, which is deliberately open precisely so third-party schematic packages can be
configured there.

**Why does the reader recognise `cli` at all, if it never looks inside it?**
Because the reader's job at the top level is to separate structure from payload. It parses
`projects` structurally, skips `$schema` and `version`, and treats everything else as an extension —
an opaque value carried through to consumers. The two frozen lists exist only to decide whether an
extension name deserves a warning: names on the list are known and silent, names off it must match
`^[a-z]{1,3}-.*` or the reader warns. So `cli` being on the list buys silence, not validation, and
that distinction is exactly why a typo inside the block costs nothing at read time and everything at
debug time.

**Which top-level keys of `angular.json` are "workspace-wide defaults", and how would you prove the
list is complete?**
`cli`, `schematics` and `newProjectRoot` — and the proof is `ANGULAR_WORKSPACE_EXTENSIONS`, which
freezes exactly those three names. The remaining top-level keys are `$schema` and `version`, both
skipped by the parser, and `projects`, which is parsed structurally rather than carried as an
extension. Since the top level is `additionalProperties: false` in the schema, there is no sixth
candidate. That is a stronger answer than listing what a documentation page happens to mention,
because it is derived from the code that reads the file.

**Someone proposes putting a feature flag for their app inside the `cli` block. What do you tell
them?**
That the block is closed and nothing will read it. `cliOptions` is `additionalProperties: false`, so
a schema-aware editor rejects the key, and the CLI's utilities only ever look up the five names they
know — so even if validation is not in the path, the value is inert. If the flag is genuinely
build-time it belongs in `define` on the build target, where the builder substitutes it into the
bundle; if it is genuinely tool metadata it belongs behind a short-prefix top-level extension key,
which is the one place the file deliberately allows unknown names.

{/* FOOTER */}
