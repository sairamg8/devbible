---
title: "The project-level `cli` block is consulted before the workspace-level one, and the fallback between them is per setting rather than per block — which is the exact opposite of how a configuration overrides a target's options"
sidebar_label: "13f · Which `cli` block wins"
sidebar_position: 13.5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular/cli/src/utilities/config.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/utilities/config.ts)
> for the precedence code, at tag `v22.1.7`. Documentation-validated; **no sandbox run** — the source
> excerpt is transcribed from the CLI repository.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Two `cli` blocks can exist inside one `angular.json` — one at the top level, one inside a
project — and the project-level block is consulted first.** That much is a plain precedence rule and
most people get it right. What is routinely mis-remembered is the *granularity*: the fallback
applies to each setting independently, not to the block as a whole, so a project block that declares
one key leaves every other workspace-level key in force. That is the opposite of how `options` and
`configurations` combine on a target, and holding both rules at once is the point of this page.

## The code that decides, verbatim

From `getConfiguredPackageManager()` in `config.ts` at `v22.1.7`:

```ts
const workspace = await getWorkspace('local');
if (workspace) {
  const project = getProjectByCwd(workspace);
  if (project) {
    result = getPackageManager(workspace.projects.get(project)?.extensions['cli']);
  }

  result ??= getPackageManager(workspace.extensions['cli']);
}
```

Six lines, and four rules fall out of them.

1. **The project-level block is tried first.** `workspace.projects.get(project)?.extensions['cli']`
   comes before anything at the workspace level.
2. **Which project is decided by `getProjectByCwd`**, not by the command line and not by a
   `defaultProject` key — that key does not exist at 22.1.7. What that means for configuration is
   [13g](13g-the-project-level-cli-block.md); the resolution algorithm itself is
   [14](14-multi-project-workspaces.md).
3. **The workspace-level block is a fallback, not a merge partner** — but note carefully *what*
   falls back.
4. **Both blocks are reached through `extensions`**, the same storage the reader uses for every key
   it does not parse structurally. That is the mechanism from
   [13](13-the-cli-block-and-workspace-defaults.md) showing up in a consumer, and it is why neither
   block is validated on the way in.

## The fallback is per setting, not per block

`result ??= …` is applied to the extracted **value**, not to the block. Read the two calls again:
`getPackageManager(...)` runs against the project's `cli` object; if that yields `undefined`, it runs
again against the workspace's `cli` object.

So a project-level block that exists but does not set `packageManager` does **not** shadow the
workspace-level `packageManager`:

```json
{
  "version": 1,
  "cli": { "packageManager": "pnpm", "analytics": false },
  "projects": {
    "admin": {
      "root": "projects/admin",
      "projectType": "application",
      "cli": { "schematicCollections": ["@angular/material"] }
    }
  }
}
```

Resolved to `admin`, the effective `packageManager` is still `pnpm` — the project block does not
mention it, so the workspace value stands. Only a project-level block that actually declares a
setting displaces the workspace one.

## 🔴 The contrast that matters: this is not how configurations work

`angular.json` contains two override mechanisms with **different granularities**, and the intuition
from one produces the wrong prediction about the other.

| | `cli`: project over workspace | `configurations` over `options` |
|---|---|---|
| Unit of override | one **setting** at a time | one **key** at a time, value replaced whole |
| A declared key | replaces that setting only | replaces that key's entire value |
| An undeclared key | falls back to the outer block | keeps the `options` value |
| A nested object or array | not applicable — settings are scalar here | **replaced wholesale**, not merged |
| Implementation | `result ??= …` on the extracted value | a shallow spread of the two objects |

The practical consequence of the right-hand column is that a `production` configuration naming
`budgets` replaces the entire `budgets` array rather than appending to it — you cannot add one
budget in a configuration and keep the base ones. The `cli` blocks do not behave that way, because
nothing is being spread; each setting is looked up twice, in order.

## What this means when you are debugging

The debugging procedure that falls out of the code is short and worth having by heart:

1. **Find which project the CLI resolved.** That is a cwd question, not a command-line one.
2. **Look at that project's `cli` block for the specific setting** — not for the block's existence.
3. **If the setting is absent there, the workspace-level value applies.** No merge, no warning, no
   trace.
4. **If neither declares it, the CLI's own default applies** — and for values documented only on
   angular.dev rather than in the schema, that default is documentation, not something the file
   records.

There is a fifth place to check when all of that fails to explain the behaviour: the machine-wide
config file, which is a different file with a different definition and is not in version control.
[01b](01b-the-global-config-is-a-different-file.md) owns it.

## Gotchas

**★ Symptom: you set `cli.packageManager` at the workspace level and the CLI keeps using something
else.** Cause: a project-level `cli` block sets it too, and the project block is consulted first.
Fix: settle the value at one level — remove it from the project block if the workspace-wide answer is
the one you want:

```json
{
  "version": 1,
  "cli": { "packageManager": "pnpm" },
  "projects": {
    "admin": {
      "root": "projects/admin",
      "projectType": "application",
      "cli": { "schematicCollections": ["@angular/material"] }
    }
  }
}
```

**★ Symptom: you added a project-level `cli` block for `schematicCollections` and expected the
workspace-level `packageManager` to stop applying.** Cause: it does not. The fallback is per setting,
because `result ??= …` tests the extracted value rather than the block, so a project block that does
not name `packageManager` leaves the workspace value in force. Fix: nothing to repair — but verify
the assumption before changing configuration, because this rule is usually mis-remembered as
whole-block replacement:

```json
{
  "cli": { "packageManager": "pnpm" },
  "projects": {
    "admin": {
      "root": "projects/admin",
      "projectType": "application",
      "cli": { "schematicCollections": ["@angular/material"] }
    }
  }
}
```

**★ Symptom: you carried the "configuration replaces the whole value" rule over to `cli` blocks and
predicted the wrong outcome.** Cause: two override mechanisms with different granularities live in
one file — a shallow object spread for `options`/`configurations`, and a per-value `??=` for the two
`cli` blocks. Fix: keep them apart. For a target, expect wholesale replacement and repeat what you
need:

```json
{
  "configurations": {
    "production": {
      "budgets": [
        { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
        { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
      ],
      "outputHashing": "all"
    }
  }
}
```

**Symptom: you deleted the workspace `cli` block to "reset to defaults" and behaviour did not
change.** Cause: two other blocks are still in play — one inside a project, and one in the
machine-wide config file that is not in the repository at all. Fix: check all three locations before
concluding anything:

```json
{
  "version": 1,
  "projects": {
    "my-app": {
      "root": "",
      "projectType": "application",
      "cli": { "packageManager": "yarn" }
    }
  }
}
```

**Symptom: two projects each carry a `cli` block and you expect the CLI to combine them.** Cause: it
resolves exactly one project and reads that project's block; there is no cross-project merge, and
the only other input is the workspace-level fallback. Fix: put anything shared at the workspace
level and keep project blocks to genuine differences:

```json
{
  "version": 1,
  "cli": { "packageManager": "pnpm" },
  "projects": {
    "web":   { "root": "projects/web",   "projectType": "application", "cli": { "schematicCollections": ["@angular/material"] } },
    "admin": { "root": "projects/admin", "projectType": "application" }
  }
}
```

**Symptom: a setting appears in neither `cli` block and you cannot find where its value comes
from.** Cause: when neither block declares it, the CLI's own default applies — and several of those
defaults are documented on angular.dev rather than declared in the schema, so the file records
nothing. Fix: write the value down explicitly when it matters to the project, so the next reader does
not have to reconstruct it:

```json
{
  "cli": {
    "packageManager": "pnpm",
    "analytics": false,
    "warnings": { "versionMismatch": true },
    "cache": { "environment": "all" }
  }
}
```

## Interview questions

**★ Two `cli` blocks are set in one `angular.json`. Which one wins, and what decides that?**
The project-level block is consulted first and the workspace-level one is the fallback — the code
that proves it is `getConfiguredPackageManager`, which reads
`workspace.projects.get(project)?.extensions['cli']` before falling back to
`workspace.extensions['cli']`. The subtlety is the middle step: `project` comes from
`getProjectByCwd`, so "the project-level block" means whichever project your current working
directory resolves to. There is no `defaultProject` key involved, because that key no longer exists
at 22.1.7.

**★ Does a project-level `cli` block replace the workspace-level one wholesale?**
No, and this is the detail most often mis-remembered. The fallback is `result ??= …` applied to the
*extracted value*, not to the block, so each setting falls back independently: a project block
declaring `schematicCollections` and nothing else leaves the workspace's `packageManager` in force.
That is deliberately unlike the `options` versus `configurations` relationship on a target, where a
configuration replaces a whole key's value — arrays and nested objects included. Two override
mechanisms with different granularities in one file, and confusing them produces opposite
predictions.

**★ Why can you not add one budget in a `production` configuration and keep the base ones, but you
*can* set one `cli` key in a project block and keep the rest?**
Because the two are implemented differently. A configuration is applied as a shallow object spread
over `options`, so any key the configuration names has its entire value replaced — an array replaces
an array, an object replaces an object, no element-wise merging anywhere. The `cli` blocks are not
spread at all; each setting is looked up in the project block and then, if absent, in the workspace
block. One is a merge of objects, the other is an ordered lookup of values, and only the second one
behaves the way "override" intuitively sounds.

**How would you debug a `cli` setting that appears not to be taking effect?**
Four steps, in order. Establish which project the CLI resolved, remembering that this is decided by
the working directory rather than by anything on the command line. Look in that project's `cli`
block for the specific setting, not for the block's existence. If it is absent there, the
workspace-level value applies — silently, with no trace in any output. If neither declares it, the
CLI default applies, and for several keys that default is documented on angular.dev rather than
declared in the schema. If all four steps come up empty, the remaining candidate is the machine-wide
config file, which is a separate file and is not in version control.

**Why does neither `cli` block get validated as it is read?**
Because both are reached through `extensions`, the reader's storage for keys it does not parse
structurally. The reader recognises the name `cli` at both levels — that is what keeps it from
warning about an unknown extension — but it never walks into the object, so nothing at read time
checks the inner keys against the schema. The consequence is that precedence bugs and typos fail the
same way: silently, with the default applying, which is why the diagnosis has to be a deliberate
walk through the lookup order rather than a search for an error message.

{/* FOOTER */}
