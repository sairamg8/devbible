---
title: "Fourteen keys in `angular.json` are written once by a schematic and mean you are moving files or changing tools if you touch them — and for most of them a command exists that does the whole change instead"
sidebar_label: "06b · The scaffolding half"
sidebar_position: 6.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json),
> [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts)
> and [`packages/schematics/angular/workspace/files/angular.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/angular.json.template)
> at tag `v22.1.7`; migration command named from
> [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**A key you are about to hand-edit falls into one of two classes, and telling them apart is the
whole skill.** Some keys describe *where things are* and *which tool runs* — those were written by
a schematic that also created files on disk, and editing one of them alone puts the file and the
filesystem out of sync. The rest are genuine settings, and they are
[06c](06c-the-fields-a-real-project-changes.md). This page is the first class: what wrote each key,
what changing it really means, and which command does the whole change for you.

## The fourteen

| Key | Written by | What editing it actually means | The command instead |
|---|---|---|---|
| `$schema` | workspace schematic | Repointing editor validation at a different schema file | — |
| `version` | workspace schematic | Claiming a different **file format** version | — |
| `newProjectRoot` | workspace schematic | Changing where *future* projects are generated | — (an honest hand edit) |
| `projects.<name>.root` | application/library schematic | Moving the project on disk | — (move the files too) |
| `sourceRoot` | application/library schematic | Moving the source tree | — (move the files too) |
| `projectType` | application/library schematic | Turning an app into a library | `ng generate library` |
| `prefix` | application schematic | Changing the selector prefix for *future* generations | — (an honest hand edit) |
| `targets.build.builder` | application/library schematic | Changing build systems | `ng update @angular/cli --name use-application-builder` |
| `targets.serve.builder` | application schematic | Changing dev servers | same migration |
| `targets.test.builder` | application schematic | Changing test runners | `ng generate config karma` or the `runner` option |
| `options.browser` | application schematic | Moving the entry point | — (move `main.ts` too) |
| `options.tsConfig` | application schematic | Pointing at a different TypeScript program | — (topic 07) |
| `options.styles` | application schematic | Renaming or moving the global stylesheet | — (move the file too) |
| `serve.configurations.*.buildTarget` | application schematic | Renaming the project or its build configurations | — (rename both sides) |

The pattern in the right-hand column is the point. **Where a command exists, use it**, because the
command changes the file *and* the filesystem together. Where none exists, the hand edit is fine —
but it is a multi-key edit, and doing half of it is the failure mode.

## The builder strings are not interchangeable

The workspace schema enumerates **seventeen** official builder strings, and every target's `options`
is validated against the schema of whichever one you name. Swapping
`@angular-devkit/build-angular:browser` for `@angular/build:application` by hand does not migrate
anything: it changes which schema your existing options are checked against, and eight of them
change name or disappear
([08b](../05-the-build-angular-build/08b-the-option-renames.md)). Because the schema is
`additionalProperties: false` the build then fails on the first leftover option rather than
silently misbehaving — which is why the manual path is *survivable*, just slower than the
migration.

What the migration does to your workspace and your source is
[08 · Migrating off webpack](../05-the-build-angular-build/08-migrating-off-webpack.md); how
`ng update` runs a named migration at all is
[topic 04](../04-ng-update-not-npm-install/README.md).

## The schematics that write into this file

Four, and knowing which is which tells you what to run rather than what to type:

| Schematic | Command | What it writes into `angular.json` |
|---|---|---|
| workspace | `ng new` (first stage) | `$schema`, `version`, optional `cli`, `newProjectRoot`, empty `projects` |
| application | `ng new` (second stage), `ng generate application` | a whole `projects.<name>` object with three targets |
| library | `ng generate library` | a `projects.<name>` object with `projectType: "library"` and an `ng-packagr` build target |
| environments | `ng generate environments` | `fileReplacements` entries into build configurations ([07](07-file-replacements.md)) |

`ng add @angular/ssr` also modifies the workspace file — the server-rendering keys are added by
that package's own schematic rather than by the application schematic, which is why `--ssr` at
`ng new` time and `ng add` afterwards converge on the same result.

## `defaultProject` does not exist

🔴 **`defaultProject` appears nowhere in the workspace schema at 22.1.7.** The top level has exactly
six properties — `$schema`, `version`, `cli`, `schematics`, `newProjectRoot`, `projects` — with
`additionalProperties: false`, and only `version` is required. Any tutorial, blog post or
Stack Overflow answer that tells you to set `defaultProject` is describing Angular 13 or earlier.
How the CLI decides which project a command applies to now is **14 · Multi-project workspaces**
*(not written yet)*.

## Gotchas

**★ Symptom: someone changed the builder string to `@angular/build:application` by hand and the
build now fails on an option name.** Cause: the builder string selects the option schema; it does
not translate your options. Fix: run the migration, which rewrites the options as well as the
string:

```bash
ng update @angular/cli --name use-application-builder
```

**★ Symptom: `defaultProject` was added back from a tutorial and the CLI warns about an unknown
workspace key.** Cause: it is not in the schema, and the workspace reader treats an unrecognised
top-level key as an extension whose name must match a narrow prefix pattern — see
**02 · `projects` and the project object**. Fix: delete it:

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {}
}
```

**★ Symptom: `"version"` was bumped to match the Angular major and the file stopped validating.**
Cause: `version` is the **file format** version, declared as an integer with `minimum: 1`, and the
workspace template has written `1` for years. It has nothing to do with the framework version. Fix:
set it back:

```json
{ "version": 1 }
```

**★ Symptom: you renamed `src/styles.css` to `src/styles.scss` and the build fails to find a
stylesheet.** Cause: `options.styles` holds a literal path written at generation time; renaming the
file on disk does not update it, and the reverse is equally true. Fix: change both, and add the
inline style language if you want component-level SCSS too:

```json
{ "options": { "styles": ["src/styles.scss"], "inlineStyleLanguage": "scss" } }
```

**★ Symptom: you moved the project into `apps/` by editing `root` and everything else broke.**
Cause: no path in the target object is derived from `root` at build time — they were all
concatenated once, at generation. Fix: it is a multi-key edit or nothing:

```json
{
  "root": "apps/web",
  "sourceRoot": "apps/web/src",
  "targets": {
    "build": {
      "options": {
        "browser": "apps/web/src/main.ts",
        "tsConfig": "apps/web/tsconfig.app.json",
        "styles": ["apps/web/src/styles.css"],
        "assets": [{ "glob": "**/*", "input": "apps/web/public" }]
      }
    }
  }
}
```

**Symptom: editor validation of `angular.json` stops working after the workspace file is moved or
`node_modules` is hoisted elsewhere.** Cause: `$schema` is a **relative** path,
`./node_modules/@angular/cli/lib/config/schema.json`, resolved from the file's own location.
Whether the CLI itself reads that value or resolves the schema independently was not confirmed
here; the editor certainly does. Fix: repoint it at the real location:

```json
{ "$schema": "../../node_modules/@angular/cli/lib/config/schema.json" }
```

**Symptom: server-side rendering keys were hand-added to `angular.json` and the build fails because
there is no server entry file.** Cause: the SSR keys are written by a schematic that also creates
the server source files; adding the configuration alone leaves the file pointing at nothing. Fix:
run the schematic:

```bash
ng add @angular/ssr
```

**Symptom: a second project's `buildTarget` still names the first project after a copy-paste.**
Cause: `buildTarget` embeds the project name literally, and nothing validates that the name it
contains is the project the target lives in. Fix: check both entries whenever a project object is
duplicated:

```json
{
  "serve": {
    "configurations": {
      "development": { "buildTarget": "admin:build:development" },
      "production": { "buildTarget": "admin:build:production" }
    }
  }
}
```

**Symptom: `ng generate library` is used to "convert" an existing application by editing
`projectType` to `"library"`.** Cause: `projectType` is a declaration, not a converter — changing
it leaves an `application` builder in the `build` target and no ng-packagr configuration on disk.
Fix: generate a real library and move the source into it:

```bash
ng generate library ui
```

## Interview questions

**★ Which keys in `angular.json` should never be hand-edited, and why?**
The ones a schematic wrote alongside files on disk: `root`, `sourceRoot`, `browser`, `tsConfig`,
`styles`, the three builder strings, and the `buildTarget` pointers. Not because editing is
forbidden, but because each of them is half of a change — the other half is on the filesystem, and
a config-only edit produces a file that describes a project that does not exist. Where a command
exists (`ng generate library`, `ng add @angular/ssr`, the builder migration) it performs both
halves; where none exists, the hand edit has to touch every key that was derived from the one you
are changing.

**★ Why does `defaultProject` not exist any more?**
Because it was removed several majors ago and the workspace schema at 22.1.7 has exactly six
top-level properties with `additionalProperties: false` — there is nowhere for it to live. Its
presence in an answer is a reliable dating signal: anything that recommends it is describing
Angular 13 or earlier. How a command decides which project it applies to in a multi-project
workspace today is a separate mechanism and a separate chunk.

**★ What is the difference between editing the builder string and running the migration?**
The string selects which schema your `options` are validated against; it does not translate them.
Editing it by hand leaves you with `main`, `polyfills` as a string, `buildOptimizer`,
`vendorChunk` and the rest, all of which the `application` schema either renames or rejects. The
migration rewrites the options, adjusts the output structure and — for an SSR application — moves
you onto `@angular/ssr`. The manual path is survivable because `additionalProperties: false` names
every leftover option, but it is strictly more work for the same destination.

**Which schematics write into `angular.json`, and why does it matter?**
The workspace schematic (the ten-line template), the application schematic (the whole project
object), the library schematic (an ng-packagr project), the environments schematic
(`fileReplacements`), and `@angular/ssr`'s own schematic. It matters because for every one of them
there is a command that keeps the workspace file and the source tree consistent. Hand-writing what
a schematic would have written is the specific way people end up with configuration that points at
files nobody created.

**`prefix` and `newProjectRoot` are in the scaffolding list, yet the page calls editing them
honest. Why?**
Because they configure *future* generations rather than describing current state. Changing
`newProjectRoot` says "generate the next project somewhere else"; changing `prefix` says "give the
next component a different selector prefix". Neither claims anything about files that already
exist, so neither can fall out of sync with the filesystem. Every other key in the list does make a
claim about what is on disk.

**Why is `version` not the Angular version?**
Because it is the workspace **file format** version — an integer with `minimum: 1` in the schema,
written as `1` by the workspace template. It tracks the structure of `angular.json` itself, not the
framework. Bumping it to match a framework major produces a file the schema will not validate and
communicates nothing.

{/* FOOTER */}
