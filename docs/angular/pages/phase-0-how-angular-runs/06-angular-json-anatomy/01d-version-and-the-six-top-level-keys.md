---
title: "The top level of `angular.json` is exactly six keys, closed to additions, with only `version` required — which makes every other key a deliberate choice rather than something you inherited"
sidebar_label: "01d · The six top-level keys"
sidebar_position: 1.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json),
> the key-skipping branch of [`packages/angular_devkit/core/src/workspace/json/reader.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts)
> and [`packages/schematics/angular/workspace/files/angular.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/angular.json.template),
> all at tag `v22.1.7`. Documentation-validated; **no sandbox run** — the workspace file below is the
> CLI's own template, transcribed, not produced by running `ng new`.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The outermost object of `angular.json` is smaller and stricter than almost anyone assumes: six
permitted keys, no others accepted, and only `version` mandatory.** Everything a build reads lives
under one of them, `projects`, and the other five are metadata, defaults or an editor hint. The
schema declares `additionalProperties: false` at this level, so a top-level key that is not on the
list of six is a validation error rather than an ignored extra — which is why so many attempts to
"add a setting to `angular.json`" fail at the outermost brace. What the reader does with the
`version` value once it gets there is [01e](01e-the-version-gate.md); this page is the shape.

## The complete top level, from the schema

```json
"properties": {
  "$schema": { "type": "string" },
  "version": { "$ref": "#/definitions/fileVersion" },
  "cli": { "$ref": "#/definitions/cliOptions" },
  "schematics": { "$ref": "#/definitions/schematicOptions" },
  "newProjectRoot": {
    "type": "string",
    "description": "Path where new projects will be created."
  },
  "projects": {
    "type": "object",
    "patternProperties": {
      "^(?:@[a-zA-Z0-9._-]+/)?[a-zA-Z0-9._-]+$": { "$ref": "#/definitions/project" }
    },
    "additionalProperties": false
  }
},
"additionalProperties": false,
"required": ["version"]
```

Six keys, and three facts that follow from those last two lines:

1. **`additionalProperties: false`** — a key not on that list is a schema violation. There is no
   "extra metadata" slot at the top level, with one narrow exception covered in
   [02e](02e-the-extension-escape-hatch.md).
2. **`required: ["version"]`** — everything else, `projects` included, is optional. A workspace file
   containing only `{"version": 1}` is schema-valid.
3. 🔴 **`defaultProject` is not in the list and appears nowhere in the schema at 22.1.7.** Any
   tutorial, blog post or memory that mentions it is describing Angular 13 or earlier. What
   replaced it is [14 · Multi-project workspaces](14-multi-project-workspaces.md).

## `$schema` and `version` are read and then deliberately ignored

Once past the version gate, the reader walks the top-level keys and explicitly skips two of them:

```ts
if (name === '$schema' || name === 'version') {
  // skip
}
```

`$schema` is therefore **not functional configuration** — it exists for your editor. The workspace
schematic writes it as a relative path:

```json
"$schema": "./node_modules/@angular/cli/lib/config/schema.json"
```

Two consequences worth holding on to. First, **that path is relative to the workspace file**, so it
only resolves when `angular.json` sits directly above the `node_modules` that contains the CLI —
which is the normal layout, and which is why editor validation quietly stops working in unusual
ones. Second, **removing `$schema` breaks nothing at build time**; it removes your only automatic
protection against the misspellings that `additionalProperties: false` would otherwise catch far
too late.

## What `ng new` actually writes at the top level

The workspace schematic's template is ten lines long, and this is all of it — an EJS template, so
the `<%` markers are template control flow rather than file content:

```text
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,<% if (packageManager) { %>
  "cli": {
    "packageManager": "<%= packageManager %>"
  },<% } %>
  "newProjectRoot": "<%= newProjectRoot %>",
  "projects": {
  }
}
```
— [`packages/schematics/angular/workspace/files/angular.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/angular.json.template) at `v22.1.7`

🔴 **`ng new` creates an empty workspace and then a *second* schematic fills it in.** The workspace
schematic writes the file above, with `"projects": {}`; the application schematic then inserts the
project object into it. Two schematics, one resulting file. That is why `newProjectRoot` is written
even into a workspace that will only ever hold one application — the top level is generated without
knowing what will be added to it. The project object that lands inside `projects` is
[05 · The generated project, line by line](05-the-generated-project-line-by-line.md).

The `cli` block is conditional: it appears only when a package manager was chosen. A generated
`angular.json` with no `cli` key is normal, not truncated.

## Gotchas

**★ Symptom: a top-level key you added — `defaultProject`, `outputPath`, `env` — is flagged by the
editor or rejected.** Cause: `additionalProperties: false` at the top level, with exactly six
permitted keys. `defaultProject` in particular no longer exists anywhere in the 22.1.7 schema. Fix:
move the setting to where it belongs; almost everything people try to put at the top level is
actually a builder option inside a target:

```json
{
  "version": 1,
  "projects": {
    "storefront": {
      "root": "",
      "projectType": "application",
      "targets": {
        "build": {
          "builder": "@angular/build:application",
          "options": { "tsConfig": "tsconfig.app.json", "outputPath": "dist/storefront" }
        }
      }
    }
  }
}
```

**Symptom: an empty `"projects": {}` looks like a broken workspace.** Cause: it is exactly what the
workspace schematic writes, before the application schematic adds anything. A workspace with no
projects is schema-valid — `projects` is not even required. Fix: nothing; add a project when you
have one:

```json
{
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {}
}
```

**Symptom: `newProjectRoot` in a single-application workspace looks like leftover scaffolding.**
Cause: it is written unconditionally by the workspace schematic, which runs before any application
exists and therefore cannot know the workspace will hold only one. It becomes load-bearing the
moment you run `ng generate application`. Fix: leave it. Its semantics are
[13 · The `cli` block and workspace-wide defaults](13-the-cli-block-and-workspace-defaults.md).

**Symptom: editor autocompletion and validation inside `angular.json` stopped working, and builds
are fine.** Cause: `$schema` is a relative path resolved from the workspace file, and it points into
`node_modules`. Before an install, or in a layout where the CLI is hoisted somewhere else, it
resolves to nothing — and the reader skips `$schema` entirely, so the build never complains. Fix:
install, or point the key at the schema wherever it actually is:

```json
{
  "$schema": "../../node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "projects": {}
}
```

**★ Symptom: an attempt to set a build option once, at the top level, so that every project
inherits it, is rejected.** Cause: the six top-level keys contain no slot for builder options.
Options belong to a target, targets belong to a project, and there is no workspace-wide options
object at any level of the schema. Fix: state it per project — repetition is the supported model,
and generating the file is the escape hatch if the repetition becomes real:

```json
{
  "version": 1,
  "projects": {
    "storefront": {
      "root": "",
      "projectType": "application",
      "targets": {
        "build": {
          "builder": "@angular/build:application",
          "options": { "tsConfig": "tsconfig.app.json", "outputHashing": "all" }
        }
      }
    },
    "admin": {
      "root": "projects/admin",
      "projectType": "application",
      "targets": {
        "build": {
          "builder": "@angular/build:application",
          "options": { "tsConfig": "projects/admin/tsconfig.app.json", "outputHashing": "all" }
        }
      }
    }
  }
}
```

**Symptom: a project key with a space or a capital letter in it is rejected by the schema.** Cause:
`projects` uses `patternProperties` with `^(?:@[a-zA-Z0-9._-]+/)?[a-zA-Z0-9._-]+$` and
`additionalProperties: false`, so a key that does not match the pattern matches nothing and is
therefore an additional property. Fix: use a name the pattern accepts — the full naming rules,
including npm scopes, are [02](02-projects-and-the-project-object.md):

```json
{
  "version": 1,
  "projects": {
    "admin-portal": { "root": "projects/admin-portal", "projectType": "application" }
  }
}
```

**Symptom: a generated `angular.json` has no `cli` key and a tutorial says it should.** Cause: the
template only emits the `cli` block when a package manager was selected. Its absence is normal.
Fix: add it if you want to pin one:

```json
{
  "version": 1,
  "cli": { "packageManager": "pnpm" },
  "projects": {}
}
```

## Interview questions

**★ How many keys can the top level of `angular.json` legally have, and what happens if you add
another?**
Six: `$schema`, `version`, `cli`, `schematics`, `newProjectRoot`, `projects`. The schema sets
`additionalProperties: false`, so anything else is a violation rather than an ignored extra — with
the single exception of the short-prefix extension pattern in [02e](02e-the-extension-escape-hatch.md).
Only `version` is required, so `{"version": 1}` is a valid workspace file with no projects in it.

**Why is `projects` optional when it is the only key that does any work?**
Because `required: ["version"]` is about the *file format*, not about usefulness. A workspace with
no projects is a legal state, and it is a state the CLI itself passes through: `ng new` runs the
workspace schematic first, which writes `"projects": {}`, and only then runs the application
schematic that fills it. Making `projects` required would make the CLI's own intermediate file
invalid. The same reasoning explains why `cli`, `schematics` and `newProjectRoot` are optional —
they are defaults and metadata, and their absence has a well-defined meaning.

**What is `$schema` for, given that the CLI ignores it?**
Editor tooling only. The reader explicitly skips both `$schema` and `version` when walking the
top-level keys, so removing `$schema` changes nothing about a build. What it changes is whether
your editor validates the file as you type, which is the only thing that catches a misspelled
builder option or a key in the wrong place before a command runs. Because the generated value is a
relative path into `node_modules`, it silently stops resolving in unusual repository layouts, and
the symptom is "autocompletion stopped working" rather than any error.

**Why does a freshly generated workspace contain `newProjectRoot` even when it will only ever hold
one application?**
Because two schematics produce the file. The workspace schematic writes a ten-line skeleton with
`"projects": {}` and `newProjectRoot` already in it; the application schematic then inserts the
project object. The first has no knowledge of the second, so it writes the generic top level
unconditionally. The same split explains why the `cli` block is conditional on a package manager
having been chosen, and why the file looks like a container that was filled in afterwards — because
it is.

**If someone hands you an `angular.json` with `defaultProject` in it, what do you conclude?**
That it predates Angular 14, or was copied from documentation that does. The key appears nowhere in
the 22.1.7 schema, and with `additionalProperties: false` at the top level it is now a validation
error rather than a legacy key that is politely ignored. It is also a strong signal that whatever
else the file contains was written for a much older CLI — the builder strings and target names are
worth auditing at the same time.

---

← Prev: [It is JSONC, not JSON](01c-the-file-is-jsonc-not-json.md) · Index: [Topic index](README.md) · Next → [The version gate](01e-the-version-gate.md)
