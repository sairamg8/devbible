---
title: "`cli.cache` is the only key in the block that changes what a build does, and its default value turns the persistent disk cache off in exactly the place people most want it on"
sidebar_label: "13e · `cli.cache`"
sidebar_position: 13.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json)
> at tag `v22.1.7`, and
> [angular.dev — Cache options](https://angular.dev/reference/configs/workspace-config#cache-options),
> which supplies the three defaults the schema omits. The prebundling dependency is quoted from the
> `prebundle` option's own description in
> [`packages/angular/build/src/builders/dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json).
> Documentation-validated; **no sandbox run** — no timings appear on this page.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Four of the five `cli` keys are about the CLI's own behaviour. `cache` is the one that reaches the
build.** It controls the persistent disk cache that `@angular/build` uses between runs, it has three
properties and no more, and its `environment` default is `local` — which means the cache is enabled
on a developer's laptop and **not** on a CI runner. That single default explains most of the
"why is CI slower than my machine" question, and it is a deliberate design decision rather than an
oversight. A second, quieter consequence is that turning the cache off turns the dev server's
prebundling off with it.

## The definition, from the schema

```json
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
```

Three properties, and the object is closed — there is no size cap, no eviction policy and no
time-to-live in this schema at 22.1.7.

angular.dev's table supplies the defaults, which the schema does not declare, and describes what the
key controls:

> *"| `cache` | Control [persistent disk cache](https://angular.dev/cli/cache) used by [Angular CLI
> Builders](https://angular.dev/tools/cli/cli-builder). | Cache options | `{}` |"*

| Property | Documented description | Type | Default |
|---|---|---|---|
| `enabled` | *"Configure whether disk caching is enabled for builds."* | `boolean` | `true` |
| `environment` | *"Configure in which environment disk cache is enabled."* | `local` \| `ci` \| `all` | `local` |
| `path` | *"The directory used to stored cache results."* | `string` | `.angular/cache` |

The `path` description is quoted exactly as published, typo included — the corpus rule is that a
paraphrase of a rule is where errors enter, and that applies to a sentence with a slip in it as much
as to a clean one.

## 🔴 `environment: "local"` means the cache is off in CI

The three enum values partition where the cache applies: `local` enables it outside CI, `ci` enables
it only in CI, and `all` enables it everywhere. The default is `local`, so **a CI build gets no
persistent cache unless somebody changed this key.**

That is worth sitting with, because the instinct is to read it as a bug. It is not. A CI runner
usually starts from a clean filesystem, so a cache directory that is not deliberately restored
between jobs holds nothing — and a cache that holds nothing costs time to consult and to write.
Defaulting to `local` means the CLI does not pay that cost on a machine that, by default, cannot
benefit from it.

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

⚠️ **Setting `all` is only half the change.** The other half is outside `angular.json` entirely: the
cache directory has to survive between CI jobs, or `all` simply means "write a cache nobody will
read". Persisting `.angular/cache` is a CI-configuration change, not a workspace-configuration one.

**How the CLI decides that it is running in CI is not stated by either the schema or the published
option table**, and no source read for this page settles it. Treat "is this CI" as the CLI's own
determination rather than something you can configure through this key — the key selects a policy,
not a detection rule.

## `enabled: false` also turns prebundling off

This is the coupling that surprises people, and it is documented on the *other* option, not on this
one. The dev-server builder's `prebundle` option describes itself:

> *"Enable and control the Vite-based development server's prebundling capabilities. To enable
> prebundling, the Angular CLI cache must also be enabled."*

So `"cache": { "enabled": false }` in `angular.json` silently disables Vite prebundling in
`ng serve`, and nothing in the message stream connects the two. The symptom is a dev server that got
slower after an unrelated-looking config change.
[Topic 05 · 05b](../05-the-build-angular-build/05b-prebundling.md) is what prebundling actually
does and why losing it matters.

```json
{
  "cli": {
    "cache": { "enabled": true }
  }
}
```

## The cache directory itself belongs to topic 05

`path` names *where*; what lives there, which store backs it, and how it behaves across git
worktrees is
[Topic 05 · 11](../05-the-build-angular-build/11-cache-and-workers.md). The one thing worth knowing
here is that the default path, `.angular/cache`, is **inside the workspace** — so it is a directory
your version control system can see, and a value that means something different in every repository
it is copied into.

## Gotchas

**★ Symptom: CI builds are consistently slower than local builds on comparable hardware, with an
identical `angular.json`.** Cause: `cache.environment` defaults to `local`, so the persistent disk
cache is not used in CI at all. Fix: opt in explicitly:

```json
{
  "version": 1,
  "cli": {
    "cache": { "environment": "all" }
  },
  "projects": {}
}
```

**★ Symptom: you set `"environment": "all"` and CI is exactly as slow as before.** Cause: the cache
directory is not being restored between jobs, so every run writes a cache that the next run never
sees. Fix: persist `.angular/cache` in the CI configuration — the workspace change alone cannot do
this:

```yaml
# pseudo-code — use whichever cache step your CI provider gives you.
# The load-bearing part is the path, not the syntax.
- name: Restore the Angular build cache
  path: .angular/cache
  key: angular-cache-${{ hashFiles('package-lock.json') }}
```

**★ Symptom: `ng serve` got noticeably slower and the only recent change was `"cache": { "enabled":
false }`.** Cause: the dev server's prebundling requires the CLI cache — its own option description
says so — so disabling the cache disabled prebundling too, with no message linking the two. Fix:
re-enable the cache; there is no way to keep prebundling without it:

```json
{ "cli": { "cache": { "enabled": true } } }
```

**★ Symptom: `.angular/` shows up in `git status` after the first build.** Cause: the default cache
path is `.angular/cache`, which is inside the workspace directory. Fix: exclude it — the cache is
machine-local build state and must never be committed:

```gitignore
/.angular/cache
/dist
/node_modules
```

**Symptom: a copied `cli` block sets `cache.path` to a directory that does not exist here.** Cause:
`path` is a workspace-relative filesystem path, and it was correct in the repository the block came
from. Fix: drop the key and take the default, unless you have a specific reason:

```json
{ "cli": { "cache": { "environment": "all" } } }
```

**Symptom: `"cache": true` is rejected.** Cause: the key is an object with three properties, not a
boolean; the boolean lives one level down as `enabled`. Fix:

```json
{ "cli": { "cache": { "enabled": true } } }
```

**Symptom: you set `"environment": "ci"` and local builds stopped caching.** Cause: the value is a
selector, not an addition — `ci` means "in CI and nowhere else". Fix: if you want both, the value is
`all`:

```json
{ "cli": { "cache": { "environment": "all" } } }
```

**Symptom: `cache` inside a project's `cli` block appears to do nothing.** Cause: caching is a
workspace concern. The project-level `cli` block is documented for `schematicCollections`, and the
machine-wide config's `cli` definition omits `cache` entirely — both are signals that this key is
scoped to the workspace. Fix: put it at the top level:

```json
{
  "version": 1,
  "cli": { "cache": { "environment": "all" } },
  "projects": {
    "my-app": {
      "root": "",
      "projectType": "application",
      "cli": { "schematicCollections": ["@angular/material"] }
    }
  }
}
```

**Symptom: someone adds `"cache": { "enabled": true, "maxSize": "2GB" }` after the directory grows.**
Cause: the object is `additionalProperties: false` with exactly three properties — there is no size
control at 22.1.7, so the key is a violation rather than an unimplemented feature request. Fix: drop
it, and manage the directory outside the CLI if you must:

```json
{ "cli": { "cache": { "enabled": true, "path": ".angular/cache" } } }
```

## Interview questions

**★ Why is the persistent build cache disabled in CI by default, and is that a bug?**
It is a deliberate default, not a bug. `cache.environment` defaults to `local`, which enables the
disk cache outside CI and not inside it. The reasoning is that a CI runner typically starts from a
clean filesystem, so unless the cache directory is explicitly restored between jobs there is nothing
in it to hit — and consulting and writing an always-empty cache is pure cost. The default therefore
matches the common case. If your pipeline *does* persist `.angular/cache`, `all` is the right value,
and the change is worth making deliberately rather than assuming the CLI would have done it for you.

**★ Somebody disables the cache to force a clean build. What else did they just turn off?**
Vite prebundling in `ng serve`. The dependency is documented on the dev server's `prebundle` option
rather than on `cache` — *"To enable prebundling, the Angular CLI cache must also be enabled"* — so
nothing in the cache key hints at it, and nothing in the dev server's output connects a slower
startup back to a cache setting made days earlier. This is the clearest example in `angular.json` of
a coupling that is documented on the far side of the relationship, which is exactly why reading the
option schemas rather than the guides pays off.

**★ What do you have to change besides `angular.json` to make the cache help in CI?**
The CI configuration, because the cache is a directory on disk. Setting `environment` to `all` only
tells the CLI it is allowed to use the cache; if the runner starts clean and discards the workspace
afterwards, every job writes a cache that the next job never sees. The pipeline has to restore and
save `.angular/cache` around the build. This is a good example of a config change that looks
complete inside the file and is not.

**What are the three values of `environment`, and when would `ci` be the right one?**
`local` enables the cache outside CI, `ci` enables it only in CI, and `all` enables it everywhere;
the default is `local`. `ci` is the narrow case: a pipeline that persists the cache directory
between jobs, paired with developers who deliberately want cold builds locally — for example where
local machines are shared or where a stale cache has previously masked a problem. It is a
selector, not an increment, so choosing `ci` switches local caching off.

**Why does `cache` exist on the workspace `cli` definition but not on the global one?**
Because it is a property of the project rather than of the person. The cache path is
workspace-relative, and what is cached is this workspace's build output, so the setting belongs in
the file that is committed alongside the code and is identical for everyone who checks it out. The
machine-wide config's definition carries `completion` instead — whether the CLI has offered to
install shell completion for this user — which is the mirror image: personal, per-machine, and
meaningless in a repository.

**What is the risk of the default cache path being `.angular/cache`?**
That it is inside the workspace, so it is visible to version control and to anything that walks the
project directory. It has to be excluded in `.gitignore`, and it should not be included in artefact
uploads or container image layers, where it would be dead weight at best. The upside of the default
is that it is workspace-relative and therefore correct in every checkout without configuration — the
risk only appears when someone changes it to an absolute path and then copies the file to another
machine.

{/* FOOTER */}
