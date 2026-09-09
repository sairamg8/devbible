---
title: "`newProjectRoot` says where a generated project's files land, its documented default is `projects` but the code's fallback for a missing key is the workspace root — and it never moves a project that already exists"
sidebar_label: "13j · `newProjectRoot`"
sidebar_position: 13.9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/schematics/angular/workspace/files/angular.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/angular.json.template)
> and the `newProjectRoot` and scoped-name reads in
> [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts),
> both at tag `v22.1.7`, plus the schema's own description in
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json)
> and [angular.dev — Workspace configuration](https://angular.dev/reference/configs/workspace-config).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`newProjectRoot` is the smallest key in `angular.json` with a genuine trap in it.** Its documented
default is `projects`, but that is the value generation *writes*, not the value the code falls back
to — the application schematic reads it with `|| ''`, so an absent key resolves to the workspace
root. And because every generated project stores its own already-resolved `root`, changing this key
affects only the *next* project; nothing that already exists moves.

## The two descriptions

The schema is four words:

> *"Path where new projects will be created."*

angular.dev is longer, and it is the source of the default:

> *"Path where new projects are created through tools like `ng generate application` or `ng generate
> library`. Path can be absolute or relative to the workspace directory. Defaults to `projects`"*

Three claims in that sentence, all load-bearing: the key applies to project *generation*, the path
may be absolute or workspace-relative, and the default is `projects`.

## It is written unconditionally, unlike everything around it

The workspace template writes `newProjectRoot` every time, with no guard — in contrast to the `cli`
block one line above it, which is conditional:

```
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

That is why the key appears even in a workspace that will only ever hold one application: the
workspace schematic writes the generic skeleton, and the application schematic inserts the project
afterwards. The first has no knowledge of the second, so it cannot know that no further project will
ever be generated.

## 🔴 The fallback is not the default

The application schematic reads the key like this:

```ts
const newProjectRoot = (workspace.extensions.newProjectRoot as string | undefined) || '';
```

`|| ''` — so a missing key, or an empty string, resolves to the **workspace root**, not to
`projects`. The documented `projects` default describes what `ng new` puts in the file; it is not a
value the code substitutes when the key is gone.

The consequence is a delayed-action change. Delete `newProjectRoot` from a single-application
workspace as apparently unused metadata, and nothing happens — until months later, when
`ng generate application admin` puts its files at `admin/` instead of `projects/admin/`, and the
project object records that root permanently.

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {}
}
```

## Changing it does not move anything

Every project object stores its own `root` as an already-resolved literal path, written at
generation time. Nothing recomputes a project's paths from `newProjectRoot` afterwards — not the
reader, not Architect, not any builder.

So editing `newProjectRoot` from `projects` to `apps` affects only projects generated after the
edit. Existing ones keep their roots, and the workspace ends up with a mixture unless you move the
files and rewrite every path in the affected project objects by hand. That whole-object rewrite is
the same work described for relocating an application in
[05b](05b-the-five-project-level-fields.md) — `root`, `sourceRoot` and every path derived from them,
in one edit.

## Scoped project names become nested directories

The `projects` key pattern accepts npm-style scopes, so `@acme/ui` is a legal project name — the
pattern and its consequences for the `projects` map are
[02](02-projects-and-the-project-object.md). What the application schematic then does with the name
is worth having here, because it is what decides the directory layout:

```ts
// If scoped project (i.e. "@foo/bar"), convert dir to "foo/bar".
let folderName = options.name.startsWith('@') ? options.name.slice(1) : options.name;
```

The leading `@` is stripped and the rest is used as a path, so a project named `@acme/ui` generated
into a workspace with `"newProjectRoot": "projects"` lands under `projects/acme/ui`. The project's
*name* in `angular.json` keeps the scope; only the directory drops the `@`.

```json
{
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "@acme/ui": {
      "root": "projects/acme/ui",
      "projectType": "library"
    }
  }
}
```

## Gotchas

**★ Symptom: you deleted `newProjectRoot` and the next `ng generate application` put its files at the
repository root instead of under `projects/`.** Cause: the application schematic reads
`(workspace.extensions.newProjectRoot as string | undefined) || ''`, so an absent key falls back to
the workspace root — the documented `projects` default is what generation writes, not what the code
substitutes. Fix: put the key back:

```json
{
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {}
}
```

**★ Symptom: you changed `newProjectRoot` to `apps` and the existing projects are still under
`projects/`.** Cause: each project stores its own already-resolved `root`, and nothing recomputes it
from this key. Fix: this key governs only future generation; moving an existing project means moving
the files and rewriting every path in its object:

```json
{
  "projects": {
    "admin": {
      "root": "apps/admin",
      "sourceRoot": "apps/admin/src",
      "projectType": "application",
      "targets": {
        "build": {
          "builder": "@angular/build:application",
          "options": {
            "browser": "apps/admin/src/main.ts",
            "tsConfig": "apps/admin/tsconfig.app.json"
          }
        }
      }
    }
  }
}
```

**★ Symptom: a project named `@acme/ui` produced a directory at `projects/acme/ui`, two levels deep,
and you expected one.** Cause: the schematic strips the leading `@` and uses the remainder as a
path, so a scoped name always becomes a nested directory. Fix: nothing is broken — but if you want a
flat directory, do not scope the project name:

```json
{
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "acme-ui": { "root": "projects/acme-ui", "projectType": "library" }
  }
}
```

**★ Symptom: `"newProjectRoot": ""` behaves exactly like deleting the key.** Cause: `|| ''` treats
an empty string and `undefined` identically, since both are falsy — so an empty value is not "the
workspace root, explicitly", it is indistinguishable from an absent key. Fix: if the workspace root
is genuinely what you want, say so in a comment rather than relying on a value that reads like an
oversight — the file is JSONC and accepts comments:

```json
{
  "version": 1,
  // Deliberate: generated projects go at the workspace root, not under projects/.
  "newProjectRoot": "",
  "projects": {}
}
```

**Symptom: an absolute `newProjectRoot` works on your machine and breaks for a colleague.** Cause:
the documentation permits an absolute path, which means the value stops being portable the moment
the repository is cloned elsewhere. Fix: keep it relative to the workspace, which is what generation
writes:

```json
{ "newProjectRoot": "projects" }
```

**Symptom: the initial application is not under `newProjectRoot` and you assume the file is
inconsistent.** Cause: it is the documented design — the application created by `ng new` sits at the
top level of the workspace, which is why its `root` is `""`, and only later projects go under
`newProjectRoot`. Fix: nothing to repair; the layout reasoning is
[02c](02c-the-empty-root-and-workspace-layout.md):

```json
{
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "my-app": { "root": "", "projectType": "application" },
    "admin":  { "root": "projects/admin", "projectType": "application" }
  }
}
```

**Symptom: `newProjectRoot` nested inside `cli` has no effect.** Cause: it is a top-level key in its
own right — the reader names it in `ANGULAR_WORKSPACE_EXTENSIONS` alongside `cli` and `schematics`,
not inside `cli`. Fix:

```json
{
  "version": 1,
  "cli": { "packageManager": "pnpm" },
  "newProjectRoot": "projects",
  "projects": {}
}
```

## Interview questions

**★ What happens if you delete `newProjectRoot` from a single-application workspace?**
Nothing, until the next time a project is generated — and then the new project's files land at the
workspace root rather than under `projects/`. The application schematic reads
`(workspace.extensions.newProjectRoot as string | undefined) || ''`, so the fallback for an absent
key is the empty string, which resolves to the workspace root. The documented default of `projects`
is what generation *writes* into the file, not what the code falls back to when the key is gone.
That gap between "the documented default" and "the code's fallback" is exactly the kind of
difference that only surfaces months after the deletion, which is what makes it worth knowing.

**★ You change `newProjectRoot` from `projects` to `apps`. What moves?**
Nothing that already exists. Every project object stores its own `root` as an already-resolved
literal path written at generation time, and nothing — not the reader, not Architect, not any
builder — recomputes those paths from `newProjectRoot`. Only projects generated after the change go
under `apps`. If you want existing projects moved, that is a manual operation: move the directories,
then rewrite `root`, `sourceRoot` and every path derived from them inside each project object, in
one edit, because the builder options contain resolved paths rather than references.

**★ Why does a workspace that will only ever hold one application still carry `newProjectRoot`?**
Because two schematics produce the file. The workspace schematic writes a skeleton — `$schema`,
`version`, an optional `cli` block, `newProjectRoot` and an empty `projects` object — and the
application schematic then inserts the project into it. The first has no knowledge of the second, so
it writes the generic top level unconditionally, and it cannot know that no further project will be
generated. The same two-stage design explains why `projects` is optional in the schema: making it
required would make the CLI's own intermediate file invalid.

**What does a scoped project name do to the directory layout?**
It nests it. The `projects` key pattern accepts npm-style scopes, so `@acme/ui` is a legal project
name, and the application schematic converts the name to a directory by stripping the leading `@`
and using the remainder as a path — its own comment says *"If scoped project (i.e. "@foo/bar"),
convert dir to "foo/bar"."* So `@acme/ui` under a `newProjectRoot` of `projects` lands at
`projects/acme/ui`. The name in `angular.json` keeps the scope; only the directory loses the `@`.
That is worth knowing before you scope names in a monorepo, because it silently doubles the depth of
every project path.

**Is `""` a meaningful value for this key?**
Functionally it is identical to omitting the key, because the read is `|| ''` and both an empty
string and `undefined` are falsy. Communicatively it is not identical: an explicit empty string
reads to the next person as either a deliberate choice or an accident, with no way to tell them
apart. Since `angular.json` is JSONC and accepts comments, the honest way to express "generated
projects go at the workspace root" is the empty value plus a comment saying it is deliberate — which
is a small example of a general habit worth having with this file, where several values look like
placeholders and are not.

---

← Prev: [`schematicCollections`](13i-schematic-collections.md) · Index: [Topic index](README.md) · Next → [Multi-project workspaces](14-multi-project-workspaces.md)
