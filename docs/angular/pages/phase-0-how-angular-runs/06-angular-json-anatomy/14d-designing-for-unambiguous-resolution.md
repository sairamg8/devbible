---
title: "The initial application's `root` is the empty string and an empty root contains every path in the workspace — so the first app is a catch-all, and the layout choice is between a silent wrong build and a loud refusal"
sidebar_label: "14d · The empty root and layout"
sidebar_position: 14.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `findProjectByPath` in
> [`packages/angular/cli/src/utilities/config.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/utilities/config.ts)
> and the scoped-name conversion in
> [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts),
> both at tag `v22.1.7`, plus the workspace-layout note in
> [angular.dev — Project configuration options](https://angular.dev/reference/configs/workspace-config#project-configuration-options).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Project resolution is deterministic, and its input is invisible.** The algorithm on
[14](14-multi-project-workspaces.md) never guesses — but its input is the working directory, which
is not on the command line, is not echoed in the output, and differs between your terminal, your
editor's task runner and your CI job. This page is the structural half of the design response: what
the empty root actually does to a workspace, the two layouts you can choose between, and what
relocating the initial application really costs. The behavioural half — naming the project so the
input stops mattering at all — is [14e](14e-name-the-project.md).

## 🔴 The empty root contains everything

The initial application created by `ng new` sits at the top level of the workspace, so its `root` is
the empty string. angular.dev states the layout rule that produces it:

> *"HELPFUL: The `projects` section of the configuration file does not correspond exactly to the
> workspace file structure.*
> *- The initial application created by `ng new` is at the top level of the workspace file structure.*
> *- Other applications and libraries are under the `projects` directory by default."*

The reasoning behind the empty value is [02c](02c-the-empty-root-and-workspace-layout.md). The
consequence for resolution is exact, and it comes from combining that value with the containment
test:

- Standing **anywhere outside** `projects/admin`, in a workspace holding the initial app plus
  `admin`, the only candidate is the initial app — so it resolves. That includes the repository
  root, which is where CI almost always runs.
- Standing **inside** `projects/admin`, both are candidates, because the empty root contains that
  path too. The deeper root wins, so `admin` resolves.

```json
{
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "my-app": { "root": "",               "projectType": "application" },
    "admin":  { "root": "projects/admin", "projectType": "application" }
  }
}
```

That is the whole of the behaviour people describe as unpredictable. It is not unpredictable; it is
*"the initial application is the catch-all, and a real root beats it when you are standing inside
it."*

## The two layouts, and what each costs

| | Default layout | Everything under a root |
|---|---|---|
| Shape | first app at `""`, others under `projects/` | every project has a real root, e.g. `apps/web`, `apps/admin` |
| Written by | `ng new` plus `ng generate application` | a deliberate move after generation |
| Resolution at repo root | the first app, always | **nothing** — no root contains the cwd, so commands must name a project |
| Failure mode | the wrong project builds, silently | a clear `Cannot determine project for command.` with a list |
| Cost | none up front, ambiguity forever | a one-time rewrite of every path in the moved project |

The second column's "failure" is the better outcome: a command that stops and names your options is
strictly more useful than one that builds something you did not ask for. That is the real argument
for moving the initial application out of the workspace root, and it is worth weighing against the
one-time cost.

## Moving the initial application is a whole-object rewrite

The schematic wrote already-resolved literal paths into the project object; nothing is recomputed
from `root` at build time. So relocating the first app means moving the directory **and** rewriting
every path that referred to it, in one edit — the same operation described for any project move in
[05b](05b-the-five-project-level-fields.md):

```json
{
  "projects": {
    "web": {
      "root": "apps/web",
      "sourceRoot": "apps/web/src",
      "projectType": "application",
      "prefix": "app",
      "targets": {
        "build": {
          "builder": "@angular/build:application",
          "defaultConfiguration": "production",
          "options": {
            "browser": "apps/web/src/main.ts",
            "tsConfig": "apps/web/tsconfig.app.json",
            "assets": [{ "glob": "**/*", "input": "apps/web/public" }],
            "styles": ["apps/web/src/styles.css"]
          }
        }
      }
    }
  }
}
```

Miss one and the build fails on a path, which is at least loud. The genuinely quiet failure is
missing the `tsConfig` path, since that is the builder's one required option and a stale value will
resolve to a file that still exists.

Whether you restructure or not, the change that actually removes the invisible input is naming the
project in every command — [14e](14e-name-the-project.md).

## Gotchas

**★ Symptom: `ng build` in a monorepo builds the wrong application, from the repository root.**
Cause: the initial app's `root` is `""`, an empty root contains every path, and nothing else was a
candidate. Fix: name the project explicitly in every script, and never depend on the working
directory in automation:

```json
{
  "scripts": {
    "build:web":   "ng build web --configuration production",
    "build:admin": "ng build admin --configuration production"
  }
}
```

**★ Symptom: you moved the initial application into `apps/web` and the build fails on a missing
file.** Cause: the project object holds already-resolved literal paths, and only `root` was updated.
Fix: rewrite every path in one edit — `sourceRoot`, `browser`, `tsConfig`, `assets` inputs and
`styles`:

```json
{
  "projects": {
    "web": {
      "root": "apps/web",
      "sourceRoot": "apps/web/src",
      "projectType": "application",
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
  }
}
```

**★ Symptom: after moving every project under `apps/`, bare commands at the repository root started
failing.** Cause: with no empty root left, no project contains the repository root, so there is no
candidate and the command says so. Fix: this is the intended trade — accept it and name projects, or
run from inside a project directory:

```json
{
  "scripts": {
    "start": "ng serve web",
    "build": "ng build web --configuration production"
  }
}
```

**Symptom: adding a nested library inside an application's directory changed which project resolves
from inside that application.** Cause: both roots contain the cwd, and the deeper one wins — the
nested library is more specific. Fix: nothing is broken, but if the nesting was accidental, put the
library under `newProjectRoot` where generation would have placed it:

```json
{
  "projects": {
    "web": { "root": "apps/web",     "projectType": "application" },
    "ui":  { "root": "projects/ui",  "projectType": "library" }
  }
}
```

**★ Symptom: you gave the initial application a real `root` and commands still resolve oddly, while
the build itself works.** Cause: `root` is matched against the working directory for resolution,
while the builder reads the literal paths in `options` — so updating one and not the other produces a
project that builds correctly and resolves incorrectly, or the reverse. Fix: treat a move as one
edit that touches both:

```json
{
  "projects": {
    "web": {
      "root": "apps/web",
      "sourceRoot": "apps/web/src",
      "projectType": "application",
      "targets": {
        "build": {
          "builder": "@angular/build:application",
          "options": { "browser": "apps/web/src/main.ts", "tsConfig": "apps/web/tsconfig.app.json" }
        }
      }
    }
  }
}
```

**Symptom: after restructuring, `ng generate component` puts files somewhere unexpected.** Cause:
generation anchors on `sourceRoot`, which is a separate key from `root` and does not follow it. Fix:
move both:

```json
{
  "projects": {
    "web": { "root": "apps/web", "sourceRoot": "apps/web/src", "projectType": "application" }
  }
}
```

**Symptom: `ng generate application` put a new project under `projects/` when your layout uses
`apps/`.** Cause: generation places new projects under `newProjectRoot`, which is an independent
top-level key and does not learn from where existing projects live. Fix: set it to match the layout
you chose — [13j](13j-newprojectroot.md):

```json
{
  "version": 1,
  "newProjectRoot": "apps",
  "projects": {}
}
```

## Interview questions

**★ What trade are you making by leaving the default layout in place?**
You are trading a clear failure for a silent one. With the initial application at `root: ""`, any
command run outside another project's root resolves to it — so a mistake produces the wrong build
rather than an error. With every project under a real root, the same mistake produces `Cannot
determine project for command.` and a list of candidates. Neither is more "correct"; the second is
strictly more debuggable, and the price is a one-time path rewrite. In a repository where CI runs
from the root, the second is usually worth buying.

**Why does moving a project require touching `tsConfig` specifically, and why is that the dangerous
one?**
Because it is the `application` builder's single required option, and because a stale value can
still resolve. Move the directory, update `root` and `sourceRoot`, and miss `browser` — the build
fails loudly on a missing entry point. Miss `tsConfig` while an old `tsconfig.app.json` is still
present at the old path and the build may keep working against the wrong TypeScript configuration.
The loud failures announce themselves; this is the one that does not.

**How would you verify that a layout change was complete?**
By checking the three groups the schematic wrote as literal paths, not by running one build.
Resolution paths — `root` and `sourceRoot`. Builder option paths — `browser`, `tsConfig`, every
`assets` input, every `styles` entry. And cross-target references — the `buildTarget` values on the
`serve` target, which name a project and are unaffected by a directory move but *are* affected by a
project rename. A build exercises only the second group, which is why "it built, so the move is
done" is an unreliable conclusion.

**★ Why does `ng build` in a monorepo so often build the first application rather than the one you
meant?**
Because the initial application's `root` is the empty string and an empty root contains every path
in the workspace. Standing anywhere that is not inside another project's root leaves the initial app
as the only candidate, so it resolves — including at the repository root, which is where CI almost
always runs. It is not a heuristic and it is not a fallback; it is containment matching against a
root that happens to match everything. The fix is to name the project in every script, not to change
the resolution.

**★ Would you move the initial application out of the workspace root, and what does it buy?**
It buys a better failure mode. With every project under a real root, nothing contains the repository
root, so a bare command there fails with `Cannot determine project for command.` and a list of
candidates instead of silently building the first application. Stopping and naming your options is
strictly more useful than building the wrong thing. The cost is a one-time rewrite: the project
object holds already-resolved literal paths, so moving it means updating `root`, `sourceRoot` and
every path derived from them in one edit. Whether that is worth it depends on how much automation
runs from the repository root — in a monorepo with CI, it usually is.

**A colleague says the CLI "picks the main app" when it cannot decide. What is wrong with that
description?**
There is no concept of a main app — that was `defaultProject`, and it no longer exists. What looks
like a main app is the initial application's empty root matching every path in the containment test.
The distinction matters because the two models predict different things: a "main app" model says the
CLI falls back when it is confused, whereas the real model says the initial app was the *only*
candidate, and it will keep being the only candidate for any directory outside another project's
root. Under the real model the fix is obvious, and under the wrong one it is not.

---

← Prev: [Multi-target and `ng run`](14c-multi-target-commands-and-ng-run.md) · Index: [Topic index](README.md) · Next → [Name the project](14e-name-the-project.md)
