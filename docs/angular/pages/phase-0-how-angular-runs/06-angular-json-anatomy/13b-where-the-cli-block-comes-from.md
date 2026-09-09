---
title: "Generation writes a `cli` block only behind an `if`, and only ever one key inside it — so every other `cli` setting in every repository was typed by a person, usually by copying it from somewhere else"
sidebar_label: "13b · Where the block comes from"
sidebar_position: 13.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/schematics/angular/workspace/files/angular.json.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/angular.json.template)
> and the extension constants in
> [`packages/angular_devkit/core/src/workspace/json/reader.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts),
> both at tag `v22.1.7`. Documentation-validated; **no sandbox run** — the template below is the
> CLI's own file, transcribed, not the output of running `ng new`.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The single most useful thing to know about the `cli` block is that nothing generates it.** One
key, `packageManager`, is written by the workspace schematic and only when a package manager was
chosen; the other four are never written by any schematic at all. So a `cli` block in a real
repository is always a human artefact, it is usually copied wholesale out of another repository or a
blog post, and two of its five keys behave badly under exactly that kind of copying. This page is
the provenance of the block, and the two places it is legal to put one.

## The ten-line file `ng new` writes first

`ng new` runs two schematics. The **workspace** schematic writes the skeleton below; the
**application** schematic then inserts the project object into it. That two-stage design is why the
generated file looks like a container that was filled in afterwards — because it is.

Verbatim from `angular.json.template` at `v22.1.7`, complete, with its templating markers intact:

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

Read the guard carefully. The `cli` block exists in the template **only** inside
`if (packageManager)`, and it contains **only** `packageManager`. Nothing here writes `analytics`,
`warnings`, `cache` or `schematicCollections`, and no other schematic in the CLI writes them into
this block either.

So the inventory of what generation can produce is one key, conditionally. Everything else in every
`cli` block you have ever seen was added by a person.

## "My file has no `cli` section" is not a defect

This settles the most common confusion about the block. A tutorial says to set `cli.cache` or
`cli.analytics`; the reader opens `angular.json`; there is no `cli` object at all. Nothing is
missing, nothing was stripped by a migration, and no `ng update` removed it. The guard simply did
not fire.

The fix is to add the key. It is a legal top-level name — the reader freezes it into
`ANGULAR_WORKSPACE_EXTENSIONS` — whether or not generation ever wrote it:

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "cli": {
    "cache": { "environment": "all" }
  },
  "projects": {}
}
```

This is the same reasoning that explains absent `polyfills` and absent `inlineStyleLanguage` in a v22
project object — a schematic branch that evaluated to nothing, not a value that was lost. The
general rule is worth internalising because it applies across the whole file:
[05e](05e-the-keys-that-are-not-there.md) is that rule for the project object, and this page is that
rule for the workspace level.

## The corollary: a `cli` block is a copied artefact

Because nothing generates the block, the way it reaches a repository is that somebody pastes it —
from another project, from a Stack Overflow answer, from a template repository. Two of the five keys
have failure modes that only exist because of copying:

- **`analytics` as a string is an identity.** The documentation describes the string form as a
  pseudonymous identifier; copy the file and two unrelated projects report under one identifier.
  Details on [13d](13d-analytics-and-warnings.md).
- **`cache.path` is a filesystem path relative to the workspace.** A path that made sense in the
  repository it came from — a shared volume, a sibling directory — will point somewhere else, or
  nowhere, in yours. Details on [13e](13e-the-cache-key.md).

A third, subtler one: a pasted block often carries keys from an older CLI. The block is closed at
three depths, so a key that was valid in an older schema is a violation now rather than a harmless
leftover, and the only thing that will tell you is an editor validating against `$schema`.

## Where the block is allowed to sit

Two levels inside `angular.json`, and no others. The evidence is the reader's own constants — `cli`
appears in both the workspace list and the project list:

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "cli": { "packageManager": "pnpm" },
  "newProjectRoot": "projects",
  "projects": {
    "my-app": {
      "root": "",
      "projectType": "application",
      "cli": { "schematicCollections": ["@angular/material"] }
    },
    "admin": {
      "root": "projects/admin",
      "projectType": "application"
    }
  }
}
```

The two blocks are typed by different definitions and the project-level one is far narrower; which
one wins, and the source that proves it, is [13f](13f-two-levels-of-cli.md).

A third `cli` block exists on a completely different file — the machine-wide config at
`~/.config/angular/config.json`, typed by `cliGlobalOptions` rather than `cliOptions`. That file has
`completion` and no `cache`; this one is the reverse.
[01b](01b-the-global-config-is-a-different-file.md) owns the distinction, and the reason it matters
here is that the global file is not in version control, so a behaviour that depends on it is not
reproducible on a CI runner.

## Gotchas

**★ Symptom: a tutorial says to edit `cli.cache` or `cli.analytics`, and your `angular.json` has no
`cli` section at all.** Cause: the workspace template emits `cli` only inside its
`if (packageManager)` guard, and even then it writes only `packageManager` — nothing generates the
other four keys. Fix: add the block; it is a legal top-level key whether or not generation wrote it.

```json
{
  "version": 1,
  "cli": {
    "cache": { "environment": "all" }
  },
  "projects": {}
}
```

**★ Symptom: a `cli` setting takes effect on one developer's machine and not in CI, and
`angular.json` is byte-identical in both.** Cause: the setting is coming from the machine-wide
config file, which is not in version control and therefore not on the runner. Fix: move it into the
workspace file, where it is checked in:

```json
{
  "version": 1,
  "cli": { "packageManager": "pnpm" },
  "projects": {}
}
```

**★ Symptom: you put `cli` inside a project's `targets`, or inside a target's `options`, and nothing
happens.** Cause: `cli` is a top-level key and a project-level key, and nowhere else; a target object
is closed around `builder`, `defaultConfiguration`, `options` and `configurations`, so it is not
even a legal position. Fix: place it at one of the two levels that exist:

```json
{
  "version": 1,
  "cli": { "packageManager": "pnpm" },
  "projects": {
    "admin": {
      "root": "projects/admin",
      "projectType": "application",
      "cli": { "schematicCollections": ["@schematics/angular"] }
    }
  }
}
```

**Symptom: a pasted `cli` block is flagged for a key you can find documented somewhere.** Cause: the
block is closed at three depths, so a key that was valid in an older CLI schema is now a violation
rather than an ignored leftover, and pasted blocks are how old keys travel. Fix: keep only names the
current schema declares, and let the editor be the check:

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "cli": { "packageManager": "pnpm", "analytics": false }
}
```

**Symptom: you removed the `cli` block entirely to "reset to defaults" and the workspace still
behaves differently from a fresh one.** Cause: removing the block only removes the workspace-level
values; a project-level `cli` block and the machine-wide config file are both still in play. Fix:
check all three locations, not just the top level:

```json
{
  "version": 1,
  "projects": {
    "my-app": {
      "root": "",
      "projectType": "application",
      "cli": { "schematicCollections": ["@angular/material"] }
    }
  }
}
```

**Symptom: `ng new` produced a workspace whose `angular.json` has `cli` and a colleague's does
not.** Cause: the guard — a package manager was named at generation time in one case and not in the
other. Fix: nothing to repair. If you want the choice pinned for everyone, set it explicitly rather
than relying on how the workspace happened to be created:

```json
{ "cli": { "packageManager": "pnpm" } }
```

## Interview questions

**★ A generated v22 workspace has no `cli` key. Is something missing?**
No. The workspace schematic's template wraps the `cli` block in an `if (packageManager)` guard and
writes only `packageManager` inside it, so a workspace generated without an explicit package-manager
choice has no `cli` object at all. None of `analytics`, `warnings`, `cache` or
`schematicCollections` is ever written by generation. Reading an absent `cli` block as damage is the
same mistake as reading an absent `polyfills` key as damage — both are branches that produced
nothing, not values that were lost.

**★ Where is a `cli` block legal, and how do you know?**
At the top level of `angular.json` and inside a project object — and the evidence is the reader's own
constants, since `cli` appears in both `ANGULAR_WORKSPACE_EXTENSIONS` and
`ANGULAR_PROJECT_EXTENSIONS`. There is a third `cli` block on the machine-wide config file, but that
is a different file typed by a different definition in the same schema. Anywhere else — inside
`targets`, inside `options`, inside a named configuration — it is not a recognised key and the
surrounding object is closed, so it is a schema violation rather than a setting that quietly fails.

**Why does `ng new` write the workspace file in two stages, and what does that explain?**
Because two schematics are involved: the workspace schematic writes the ten-line skeleton, and the
application schematic inserts the project object into it. The skeleton has no knowledge of the
application that will follow, which is why it writes `newProjectRoot` unconditionally even in a
workspace that will only ever hold one app, why `"projects": {}` exists as an empty object at that
moment, and why the `cli` block is conditional on a decision made by the outer command rather than
by the app. It also explains why `projects` is optional in the schema — making it required would
make the CLI's own intermediate file invalid.

**Why is "this block is always copied" a useful thing to know about `cli`?**
Because it predicts the failure modes. Copied configuration carries values that were correct
somewhere else: an `analytics` UUID that identifies a different project, a `cache.path` that pointed
at a shared volume on someone else's machine, and key names from an older schema. None of those are
mistakes you make by reasoning about your own workspace, which is why they are hard to spot in
review — the block looks like configuration that was decided rather than inherited.

**If you wanted to guarantee every developer on a team used the same package manager, would setting
`cli.packageManager` be enough?**
It is the workspace-level statement of intent and it is the right place to record the decision, but
it is not an enforcement mechanism: it lives in a file people edit, a project-level `cli` block can
override it, and the machine-wide config carries a value of its own. Treat it as configuration for
the CLI's own install steps rather than as policy, and put the actual enforcement where enforcement
lives — a lockfile that is committed, and a CI job that fails when it changes unexpectedly.

---

← Prev: [The `cli` block](13-the-cli-block-and-workspace-defaults.md) · Index: [Topic index](README.md) · Next → [`packageManager`](13c-the-package-manager-key.md)
