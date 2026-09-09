---
title: "The initial application's `root` is the empty string because that application *is* the workspace — an asymmetry the documentation designs in, no command normalises, and everybody tries to tidy away exactly once"
sidebar_label: "02c · The empty `root`"
sidebar_position: 2.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> the project-configuration section of
> [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config),
> [`packages/angular_devkit/core/src/workspace/json/reader.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts)
> and [`packages/schematics/angular/workspace/files/angular.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/angular.json.template)
> at tag `v22.1.7`. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**One project in a generated Angular workspace has a `root` of `""` and every other project has a
real path, and that difference is deliberate, documented and permanent.** It is not a migration
artefact, not an oversight, and not something a later command will clean up. Understanding why turns
two recurring incidents into non-events: the empty string being deleted as a placeholder, and a
second application being "moved up" to match the first.

## The documented design

> *"HELPFUL: The `projects` section of the configuration file does not correspond exactly to the
> workspace file structure.*
> *- The initial application created by `ng new` is at the top level of the workspace file structure.*
> *- Other applications and libraries are under the `projects` directory by default."*
> — [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config)

Two sentences, and they explain everything about the shape of a real workspace. `ng new` produces a
repository whose top level *is* the first application — `src/` sits beside `angular.json` — so that
application's files begin at the workspace directory, and the path from the workspace to them is the
empty string. Every project created afterwards has somewhere else to go, and goes under
`newProjectRoot`.

So a single-application workspace looks like this:

```json
{
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "storefront": {
      "root": "",
      "sourceRoot": "src",
      "projectType": "application",
      "prefix": "app"
    }
  }
}
```

and adding a second application produces a project whose `root` is **not** empty:

```json
{
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "storefront": { "root": "", "sourceRoot": "src", "projectType": "application", "prefix": "app" },
    "admin": {
      "root": "projects/admin",
      "sourceRoot": "projects/admin/src",
      "projectType": "application",
      "prefix": "app"
    }
  }
}
```

`""` means *the workspace root itself*. It is not a placeholder, not an omission and not a value the
CLI will infer if you delete it — deleting it produces
`Project "<name>" is missing a required property "root".` from the workspace reader
([02](02-projects-and-the-project-object.md)).

🔴 **The asymmetry is permanent, not transitional.** Adding a second application does not relocate
the first, and no command exists to normalise the layout. A workspace where one project has
`"root": ""` and the rest have `projects/<name>` is what a mature Angular repository looks like.

## `newProjectRoot` is written before any project exists

The workspace schematic writes `newProjectRoot` into the file *before* the application schematic
adds anything ([01d](01d-version-and-the-six-top-level-keys.md)), which is why it appears even in a
workspace that will only ever contain one application. It governs where *future* projects are
generated; it has no retroactive effect and no influence on the project already there. Its full
semantics belong to [13 · The `cli` block and workspace-wide defaults](13-the-cli-block-and-workspace-defaults.md).

## If you want a uniform layout, move the first project down

The supported way to get every project under one directory is to relocate the **initial**
application rather than to hoist the others:

```json
{
  "version": 1,
  "newProjectRoot": "apps",
  "projects": {
    "storefront": {
      "root": "apps/storefront",
      "sourceRoot": "apps/storefront/src",
      "projectType": "application",
      "targets": {
        "build": {
          "builder": "@angular/build:application",
          "options": {
            "tsConfig": "apps/storefront/tsconfig.app.json",
            "browser": "apps/storefront/src/main.ts",
            "styles": ["apps/storefront/src/styles.css"]
          }
        }
      }
    },
    "admin": {
      "root": "apps/admin",
      "sourceRoot": "apps/admin/src",
      "projectType": "application"
    }
  }
}
```

⚠️ That is a real migration, not a rename: the files move on disk, every path inside the project's
targets moves with them, and the project's own `tsconfig.app.json` — including its `extends` back to
the workspace `tsconfig.json` — has to be re-pointed. The TypeScript side of that is
**07 · The TypeScript setup Angular requires** *(not written yet)*.

Which project a bare `ng build` selects in a workspace like this is a separate mechanism and is
[14 · Multi-project workspaces](14-multi-project-workspaces.md).

## Gotchas

**★ Symptom: `Project "storefront" is missing a required property "root".` after tidying the file.**
Cause: `""` was deleted because it looked like an unfilled placeholder. It is a value meaning "the
workspace root". Fix:

```json
{
  "projects": {
    "storefront": { "root": "", "sourceRoot": "src", "projectType": "application" }
  }
}
```

**★ Symptom: a second application was generated into `projects/` and someone "tidied" it to sit
beside the first at the top level.** Cause: the top-level position is reserved for the initial
application by design — the documentation says so explicitly — and `newProjectRoot` is what puts
later ones under `projects/`. Fix: if you want a flat layout, move the *first* application into a
directory too and give every project a non-empty `root`, rather than pulling the others up:

```json
{
  "version": 1,
  "newProjectRoot": "apps",
  "projects": {
    "storefront": { "root": "apps/storefront", "sourceRoot": "apps/storefront/src", "projectType": "application" },
    "admin": { "root": "apps/admin", "sourceRoot": "apps/admin/src", "projectType": "application" }
  }
}
```

**★ Symptom: changing `newProjectRoot` did not move any existing project.** Cause: it is consulted
when a project is generated, not when the workspace is read. Existing `root` values are literal
paths and nothing rewrites them. Fix: change both — the setting for future projects, and each `root`
by hand (with the files) for existing ones:

```json
{
  "version": 1,
  "newProjectRoot": "apps",
  "projects": {
    "admin": { "root": "apps/admin", "sourceRoot": "apps/admin/src", "projectType": "application" }
  }
}
```

**Symptom: someone replaced `"root": ""` with `"root": "."` to make it look intentional.** Cause: a
reasonable instinct, but the generated value is the empty string and **whether `"."` is treated
identically was not confirmed** against the source for this page. Fix: match what the schematic
writes, which is the only form the CLI is known to produce:

```json
{
  "projects": {
    "storefront": { "root": "", "sourceRoot": "src", "projectType": "application" }
  }
}
```

**Symptom: a repository has `src/` at the top level *and* a `projects/` directory, and a reviewer
calls it inconsistent.** Cause: it is the documented layout — the initial application at the top
level, everything after it under `newProjectRoot`. Fix: nothing to change; the inconsistency is in
the expectation. If uniformity is genuinely wanted, it is the migration above and it costs a real
change to every path in the first project.

**Symptom: a new library is generated into `projects/` in a repository whose applications live in
`apps/`.** Cause: `newProjectRoot` was never updated after the applications were relocated by hand.
Fix: set it to whatever the convention actually is, so the next generated project lands in the right
place:

```json
{
  "version": 1,
  "newProjectRoot": "libs",
  "projects": {}
}
```

**Symptom: after moving the first application into a directory, the build fails on `tsConfig`.**
Cause: `root` moved but the target's paths did not — `tsConfig`, `browser`, `styles` and `assets`
are literal workspace-relative strings, not paths derived from `root`. Fix: move every one of them
in the same edit:

```json
{
  "projects": {
    "storefront": {
      "root": "apps/storefront",
      "sourceRoot": "apps/storefront/src",
      "projectType": "application",
      "targets": {
        "build": {
          "builder": "@angular/build:application",
          "options": {
            "tsConfig": "apps/storefront/tsconfig.app.json",
            "browser": "apps/storefront/src/main.ts",
            "styles": ["apps/storefront/src/styles.css"],
            "assets": [{ "glob": "**/*", "input": "apps/storefront/public" }]
          }
        }
      }
    }
  }
}
```

## Interview questions

**★ Why is the first application's `root` an empty string, and what happens if you delete it?**
Because that application lives at the top level of the workspace, not under `projects/`. The
documentation states it directly: the initial application created by `ng new` is at the top level of
the workspace file structure, while other applications and libraries are under the `projects`
directory. The empty string therefore *means* "the workspace root", and it is a value, not a
placeholder. Deleting it produces the missing-`root` error, because the reader does not infer a
default.

**★ A workspace has one project with `"root": ""` and four with `"root": "projects/…"`. Is that a
mess someone should clean up?**
No — that is the documented shape. `ng new` places the initial application at the top level of the
workspace and every later project under `newProjectRoot`, so the asymmetry is designed in and no
command normalises it. If a team genuinely wants a uniform layout, the move is to relocate the
*first* application into a directory and give it a real `root`, not to hoist the others up to the
top level, which is a position reserved for exactly one project.

**What does `newProjectRoot` actually affect?**
Where the *next* generated project is placed. It is written into `angular.json` by the workspace
schematic before any application exists, which is why it is present even in a single-application
repository, and it is read when a project is generated rather than when the workspace is loaded.
Changing it moves nothing that already exists — every `root` in the file is a literal path — so
after a manual reorganisation it needs updating separately or the next `ng generate application` will
land somewhere surprising.

**What is the cost of moving the initial application into a subdirectory?**
Everything written as a workspace-relative path in that project has to move with it. `root` and
`sourceRoot` are the obvious two, but the target options are literal strings — `tsConfig`,
`browser`, `styles`, `assets` inputs — and none of them is derived from `root`, so none of them
follows automatically. The project's own `tsconfig.app.json` also has to be relocated and its
`extends` re-pointed at the workspace `tsconfig.json`. It is a mechanical change, but it is a change
in three places at once, and half-finished it fails on whichever path is read first.

**Why does the CLI not just normalise the layout when a second project is added?**
The documentation gives the shape rather than the reasoning, so the answer is by construction rather
than by stated rationale: moving the first application would rewrite every path in its targets, its
`tsconfig`, and any import or tooling path outside `angular.json` that the CLI cannot see. The
design instead keeps existing projects untouched and gives new ones a home under `newProjectRoot`.
**No source was found stating the rationale explicitly**, so treat that as an explanation of the
consequences rather than as the maintainers' argument.

---

← Prev: [`root`, `sourceRoot`, `prefix`](02b-root-sourceroot-and-prefix.md) · Index: [Topic index](README.md) · Next → [`architect` or `targets`](02d-architect-or-targets.md)
