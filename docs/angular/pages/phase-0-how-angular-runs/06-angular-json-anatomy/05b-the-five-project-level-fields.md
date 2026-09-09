---
title: "Five keys sit above `targets`, only two are required, only one of those is enforced at read time — and the one that looks like a placeholder is the one that must not be touched"
sidebar_label: "05b · The project-level fields"
sidebar_position: 5.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json),
> [`packages/angular_devkit/core/src/workspace/json/reader.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts)
> and [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts)
> at tag `v22.1.7`; property descriptions and the workspace-layout note quoted verbatim from
> [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`"root": ""` is the single most-deleted line in `angular.json`, and deleting it stops every
Angular command with an error that names a property you can plainly see is there.** The five keys
above `targets` — `root`, `sourceRoot`, `projectType`, `prefix`, `schematics` — are enforced by two
different mechanisms at two different stages, and neither of them behaves the way the file looks.
This page walks all five, against the object transcribed in
[05 · The generated project](05-the-generated-project-line-by-line.md).

## The five keys

| Field | Generated value | What it actually controls |
|---|---|---|
| `root` | `""` for the app `ng new` creates | The project's directory, relative to the workspace root. **Required by the schema and by the reader** |
| `sourceRoot` | `"src"` | Where the source, assets and `index.html` live. Computed as `join(normalize(projectRoot), 'src')` |
| `projectType` | `"application"` | The other value is `"library"`. **Required by the schema, not checked by the reader** |
| `prefix` | `"app"` | `options.prefix \|\| 'app'` — the selector prefix `ng generate` prepends |
| `schematics` | **usually absent** | Per-project generator defaults; written only when a non-default was chosen |

## `root: ""` is documented, not a bug

The published reference states the design outright:

> *"HELPFUL: The `projects` section of the configuration file does not correspond exactly to the
> workspace file structure.*
> *- The initial application created by `ng new` is at the top level of the workspace file structure.*
> *- Other applications and libraries are under the `projects` directory by default."*

and the property table backs it up:

> *"| `root` | The root directory for this project's files, relative to the workspace directory.
> Empty for the initial application, which resides at the top level of the workspace. | `string` |
> None (required) |"*

So the first application carries `"root": ""` and a second one generated later carries
`"root": "projects/admin"`. That asymmetry inside one file is the documented layout, not drift.

🔴 **It also explains every path in the generated object.** `projectRoot` is `""` for the first
app, so the schematic's `` `${projectRoot}tsconfig.app.json` `` produces `tsconfig.app.json` with
no leading directory — and the identical template string produces
`projects/admin/tsconfig.app.json` for the second app. The paths are concatenated **once, at
generation time.** Nothing re-derives them from `root` afterwards, which is why moving a project
means editing every path, not just `root`.

## `root` is the one key the reader refuses to infer

From the workspace reader at `v22.1.7`:

```ts
const projectNodeValue = getNodeValue(projectNode);
if (!('root' in projectNodeValue)) {
  throw new Error(`Project "${projectName}" is missing a required property "root".`);
}
```

The test is `'root' in projectNodeValue` — **key presence, not truthiness.** `""` passes; a deleted
key throws `Project "<name>" is missing a required property "root".` before any target is looked
at. `projectType` is required by the *schema* and never checked here, so a file missing it runs and
does not validate. Two enforcement points, two different rule sets, one file.

## The reader warns where you would expect it to error

Three of the five keys get a type check that is deliberately soft:

```ts
case 'prefix':
case 'root':
case 'sourceRoot':
  if (typeof value !== 'string') {
    context.warn(`Project property "${name}" should be a string.`, value);
  }
```

A warning, then the wrong value is used anyway. This is the worst failure mode in the file: no
command fails, and the effect shows up much later as a path that does not resolve.

## `prefix` is a generator input, not a runtime setting

`prefix` is read by `ng generate component` and friends when they build a selector. Nothing at
build time consults it, and nothing rewrites existing selectors when you change it:

> *"| `prefix` | A string that Angular prepends to selectors when generating new components,
> directives, and pipes using `ng generate`. Can be customized to identify an application or
> feature area. | `string` | `'app'` |"*

The tense in that sentence — *"when generating new"* — is the entire behaviour. Enforcing a prefix
on code that already exists is a lint concern with its own configuration, not this key.

## `schematics` is written only when it would say something

The application schematic assembles a `schematics` object *before* the project literal and inserts
it as a variable. Four independent conditions can put something into it, and under v22's defaults
**none of them fires**, so the key is absent from your file:

| Condition in the schematic | What it writes |
|---|---|
| `options.inlineTemplate \|\| options.inlineStyle \|\| options.minimal \|\| options.style !== Style.Css` | component defaults — the inline template/style flags and the style extension |
| `options.skipTests \|\| options.minimal` | `skipTests: true` for class, component, directive, guard, interceptor, pipe, resolver and service |
| `!options.standalone` | `standalone: false` for component, directive and pipe |
| `options.fileNameStyleGuide === '2016'` | the legacy `type` / `addTypeToClassName` / `typeSeparator` naming options |

`standalone` defaults to `true`, `style` defaults to `"css"` and `fileNameStyleGuide` defaults to
`"2025"` at 22.1.7, so three of those four branches are dead in a default generation. A tutorial
showing a populated per-project `schematics` block was written with non-default flags, or on an
older major.

## Scoped project names are legal, and the directory is not what you typed

The workspace schema's key pattern for `projects` is `^(?:@[a-zA-Z0-9._-]+/)?[a-zA-Z0-9._-]+$` — an
optional npm scope followed by a name. The application schematic handles the scope by stripping the
`@` when it derives the folder:

```ts
// If scoped project (i.e. "@foo/bar"), convert dir to "foo/bar".
let folderName = options.name.startsWith('@') ? options.name.slice(1) : options.name;
```

So `ng generate application @acme/ui` creates the project key `@acme/ui` and the directory
`projects/acme/ui`. The key and the path deliberately differ, and the only reliable way to get the
path is to read `root`.

## Gotchas

**★ Symptom: `"root": ""` looks like an unfinished placeholder, so you delete it, and every command
fails with `Project "my-app" is missing a required property "root".`** Cause: the empty string is
the documented value for the application `ng new` places at the workspace top level, and the reader
tests for key presence rather than a non-empty value. Fix: put it back exactly as generated:

```json
{ "projects": { "my-app": { "root": "", "sourceRoot": "src", "projectType": "application" } } }
```

**★ Symptom: you moved the app into a subdirectory and `ng build` cannot find `src/main.ts`,
`tsconfig.app.json` or `public/`.** Cause: the schematic wrote literal, already-resolved paths;
nothing is recomputed from `root` at build time. Fix: move `root` **and** every path derived from
it, in one edit:

```json
{
  "root": "apps/web",
  "sourceRoot": "apps/web/src",
  "targets": {
    "build": {
      "builder": "@angular/build:application",
      "options": {
        "browser": "apps/web/src/main.ts",
        "tsConfig": "apps/web/tsconfig.app.json",
        "assets": [{ "glob": "**/*", "input": "apps/web/public" }],
        "styles": ["apps/web/src/styles.css"]
      }
    }
  }
}
```

**★ Symptom: you changed `prefix` to `"acme"` and existing components still use `app-`.** Cause:
`prefix` is consumed by `ng generate` at file-creation time; it is not applied retroactively and no
build step reads it. Fix: change the value for future generations and rename existing selectors
yourself — there is no CLI command for that rename:

```json
{ "projects": { "my-app": { "prefix": "acme" } } }
```

**★ Symptom: your file has no `schematics` block and a tutorial insists there should be one.**
Cause: the block is emitted only when one of the four conditions above holds, and a default v22
generation trips none of them. Fix: nothing to repair — add one only if you want a per-project
generator default, for example SCSS components in one project of a mixed workspace:

```json
{
  "projects": {
    "my-app": {
      "schematics": { "@schematics/angular:component": { "style": "scss" } }
    }
  }
}
```

**★ Symptom: `Project property "sourceRoot" should be a string.` appears as a warning and the build
continues against the wrong source root.** Cause: the reader warns rather than errors on the type
of `prefix`, `root` and `sourceRoot`. Fix: this is the one warning in the file worth treating as an
error — quote the value:

```json
{ "sourceRoot": "src" }
```

**Symptom: you delete `projectType` and everything keeps working, so you conclude it is optional.**
Cause: the schema requires it; the reader never checks it. Your editor and your CLI disagree about
the same file. Fix: keep it — a schema-validating tool, or a future CLI that validates at read
time, will reject the file:

```json
{ "projectType": "application" }
```

**Symptom: a second application generated later has `"root": "projects/admin"` and you "fix" the
first one to match.** Cause: the difference is `newProjectRoot` doing its job, not an
inconsistency. Fix: leave both as generated; if you genuinely want everything under `projects/`,
move the first app deliberately with the full path edit shown above.

**Symptom: `ng generate application @acme/ui` puts files in `projects/acme/ui`, and a deploy script
that globbed `projects/@acme/**` finds nothing.** Cause: the schematic strips the leading `@` when
turning the project name into a folder. Fix: read the path out of `root` instead of reconstructing
it from the name:

```json
{ "projects": { "@acme/ui": { "root": "projects/acme/ui" } } }
```

**Symptom: `sourceRoot` is deleted because "it is always `src`", and asset resolution changes.**
Cause: it is not always `src` — it is `join(root, 'src')`, so it is `projects/admin/src` for a
second project, and it is what the builder uses to locate `index.html` and the source tree. Fix:
keep it explicit:

```json
{ "root": "projects/admin", "sourceRoot": "projects/admin/src" }
```

## Interview questions

**★ Why is `root` an empty string for the application `ng new` creates, when every other project
gets `projects/<name>`?**
Because the first application is deliberately placed at the top level of the workspace rather than
under `projects/`, and `root` is defined as a path relative to the workspace directory — the
reference documentation states that the initial application resides at the top level while other
applications and libraries are under `projects` by default. The second-order consequence matters
more than the first: the schematic builds every path by concatenating `projectRoot` with a suffix,
so `` `${projectRoot}tsconfig.app.json` `` yields `tsconfig.app.json` for the first app and
`projects/admin/tsconfig.app.json` for a later one. Every path in the generated file is already
resolved, which is why moving a project is a multi-key edit.

**★ Which project-level keys are required, and by what?**
The schema requires `root` and `projectType`. The workspace reader requires only `root`, with a
literal `'root' in projectNodeValue` check that throws
`Project "<name>" is missing a required property "root".` So a file missing `projectType` runs but
does not validate. The right answer names both stages rather than one: relying on the looser of two
enforcement points is how a workspace file becomes unportable between CLI versions and how an
editor ends up disagreeing with a green build.

**★ Why does changing `prefix` not rename anything?**
Because `prefix` is an input to code generation, read the moment `ng generate component` builds a
selector. No build-time step consults it, and the documentation's own wording is in the present
participle — the string Angular prepends *"when generating new components, directives, and
pipes"*. Enforcing the prefix across code that already exists is a lint rule with separate
configuration; `angular.json` has no opinion about it.

**Your generated `angular.json` has no per-project `schematics` block. Is something missing?**
No. The block is emitted only when it would carry a non-default, and the conditions are inline
templates or styles, a non-CSS style extension, `--skip-tests` or `--minimal`, non-standalone
generation, or the 2016 file-naming style guide. A default v22 generation trips none of them
because `standalone` is `true`, `style` is `css` and `fileNameStyleGuide` is `"2025"`. A populated
block in someone else's repository tells you which flags they used, or which major they were on.

**Why is a warning about `sourceRoot` more dangerous than an error would be?**
Because the reader emits `Project property "sourceRoot" should be a string.` and then carries on
with the value it was given. Nothing fails at the point of the mistake. The symptom surfaces later
and somewhere else — an asset that does not get copied, an `index.html` that is not found — and by
then the warning has scrolled past. An error would have cost thirty seconds; the warning costs an
afternoon. Treat those three cases as hard failures in your own review.

**What happens if you name a project `@acme/ui`?**
It is legal: the workspace schema's key pattern for `projects` explicitly allows an optional npm
scope. The project key stays `@acme/ui`, but the schematic strips the leading `@` when deriving the
folder, so the files land under `projects/acme/ui`. The key and the directory are intentionally
different, which breaks any tooling that reconstructs a filesystem path from a project name instead
of reading `root`.

---

← Prev: [The generated project](05-the-generated-project-line-by-line.md) · Index: [Topic index](README.md) · Next → [The build target](05c-the-build-target.md)
