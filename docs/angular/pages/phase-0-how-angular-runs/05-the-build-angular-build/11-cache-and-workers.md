---
title: "The build cache is off in CI by default and the worker count is capped at four however many cores you bought — two deliberate defaults that explain most of the gap between a fast laptop build and a slow pipeline"
sidebar_label: "11 · Cache and workers"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the `cliOptions.cache` block of
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json),
> [`packages/angular/build/src/utils/environment-options.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/utils/environment-options.ts)
> and the `22.1.0` section of [CHANGELOG.md](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md),
> all at tag `v22.1.7`, plus
> [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config#cache-options).
> Documentation-validated; **no sandbox run**; every doc comment below is quoted from the source.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Two settings decide most of what a build costs in wall-clock time, and both have defaults that
surprise people in the same direction.** Disk caching is enabled — but only outside CI. Parallelism
scales with your machine — up to four workers, and no further. Neither is an oversight; both have
reasons, and one of them is written as a comment in the source naming the exact error it prevents.

## The cache

| Property | Description (verbatim) | Type | Default |
|---|---|---|---|
| `enabled` | *"Configure whether disk caching is enabled for builds."* | `boolean` | `true` |
| `environment` | *"Configure in which environment disk cache is enabled."* | `local` \| `ci` \| `all` | `local` |
| `path` | *"The directory used to stored cache results."* | `string` | `.angular/cache` |

`environment` is the one that matters. `ci` enables caching only in CI, `local` only *outside* CI,
and `all` everywhere.

🔴 **The default is `local`, which means the build cache is OFF in CI.** That single fact explains
more "why is CI slower than my laptop, on better hardware" questions than anything else in this
topic. It is deliberate: a cache is only a win if it survives between runs, and a fresh container
with an empty `.angular/cache` pays the cost of writing one and gets nothing back.

Turning it on is half the job:

```json
{
  "cli": {
    "cache": {
      "environment": "all"
    }
  }
}
```

⚠️ **That alone changes nothing unless your pipeline persists `.angular/cache` between runs.**
Enabling the cache in an environment that throws the directory away every time makes builds
marginally *slower*, because now they write a cache nobody reads. Restore and save the directory, or
leave the default alone — this is the same reasoning that took `rspackPersistentCache` out of this
repo's own deploy.

### The cache store, and two caches that behave differently

```ts
/**
 * The persistent cache store configuration to use.
 * Managed by the `NG_BUILD_CACHE_STORE` environment variable.
 * - 'lmdb': Forces the use of LMDB.
 * - 'sqlite': Forces the use of SQLite.
 * - undefined / 'auto' / other: Automatically uses LMDB and falls back to SQLite.
 */
```

The SQLite fallback arrived in 22.1.0 — *"feat | add built-in SQLite cache store fallback"* — which
matters mostly when LMDB cannot be used, on an unusual platform or a restricted filesystem.

🔴 **Two caches exist and they were deliberately given opposite worktree behaviour.** 22.1.0 added
*"feat | share persistent build cache across git worktrees"*, and 22.1.7 followed with
*"fix | keep dev-server Vite cache worktree-local"*. So the **build** cache is shared across
worktrees — several checkouts of the same repo reuse each other's work — while the **dev-server
Vite** cache is not. If `ng serve` re-prebundles every time you switch worktree, that is the fix
working as intended, not a bug.

## Workers

```ts
/**
 * Some environments, like CircleCI which use Docker report a number of CPUs by the host and not the count of available.
 * This cause `Error: Call retries were exceeded` errors when trying to use them.
 */
const maxWorkersVariable = process.env['NG_BUILD_MAX_WORKERS'];

export const maxWorkers = isPresent(maxWorkersVariable)
  ? +maxWorkersVariable
  : Math.min(4, Math.max(availableParallelism() - 1, 1));
```

Read the formula: **`min(4, max(cores - 1, 1))`**. One core is left free, the result never drops
below one, and it is **capped at four regardless of core count**. A 64-core CI machine uses four
workers.

The comment explains why the cap exists rather than the count being unbounded: containerised CI
reports the *host's* CPU count, not the container's allowance, and spawning that many workers
produces `` Error: Call retries were exceeded ``. The cap is a defence against a number the runtime
cannot trust.

Raising it is possible and is a debugging lever rather than a supported knob:

```bash
NG_BUILD_MAX_WORKERS=8 ng build
```

⚠️ On a container with a CPU quota, raising it is how you *reproduce* the error the cap prevents.
Raise it only where you know the real allowance, and read
[11b · The `NG_BUILD_*` surface](11b-the-ng-build-environment-surface.md) first — none of these
variables are public API.

## Gotchas

**★ Symptom: CI builds are consistently slower than local builds on better hardware.** Cause:
`cache.environment` defaults to `local`, so disk caching is disabled in CI. Fix: enable it *and*
persist the directory — enabling it alone makes things marginally worse:

```json
{ "cli": { "cache": { "environment": "all" } } }
```

**★ Symptom: you set `cache.environment` to `all` and CI got no faster.** Cause: the pipeline does
not restore `.angular/cache` between runs, so every build writes a cache that is then discarded.
Fix: cache the directory in the pipeline, keyed on something that changes when dependencies do:

```yaml
- uses: actions/cache@v4
  with:
    path: .angular/cache
    key: angular-cache-${{ hashFiles('yarn.lock') }}
```

**★ Symptom: a 32-core build machine shows four busy cores during a build.** Cause:
`Math.min(4, …)` caps the worker count. Fix: this is deliberate, and raising it is only safe when
you know the container's real CPU allowance:

```bash
NG_BUILD_MAX_WORKERS=8 ng build
```

**★ Symptom: `Error: Call retries were exceeded` in a containerised CI build.** Cause: the exact
failure the cap exists to prevent — the runtime reported the host's CPU count rather than the
container's allowance, and too many workers were spawned. Fix: set the count explicitly to the
container's real limit rather than letting it be inferred:

```bash
NG_BUILD_MAX_WORKERS=2 ng build
```

**★ Symptom: `ng serve` re-prebundles every time you switch git worktree, but builds do not
re-do work.** Cause: deliberate and asymmetric — the build cache is shared across worktrees since
22.1.0, the dev-server Vite cache was made worktree-local in 22.1.7. Fix: none; this is the
intended behaviour.

**★ Symptom: the cache directory grows without bound in a long-lived build agent.** Cause: nothing
in the CLI prunes `.angular/cache`. Fix: point it somewhere your infrastructure manages, or clear it
on a schedule:

```json
{ "cli": { "cache": { "path": "/var/cache/angular" } } }
```

**★ Symptom: a build on an unusual filesystem fails inside the cache layer.** Cause: LMDB is tried
first and memory-maps its store, which some filesystems do not support. Fix: force the SQLite store,
available since 22.1.0:

```bash
NG_BUILD_CACHE_STORE=sqlite ng build
```

**★ Symptom: disabling the cache entirely did not stop `.angular/` appearing.** Cause: `enabled`
controls disk caching for builds; other tooling also writes under that directory. Fix: if the goal
is a clean tree, ignore the directory rather than trying to prevent it:

```gitignore
.angular/
```

## Interview questions

**★ Why is a CI build often slower than the same build on a developer laptop with worse hardware?**
Two defaults, and the first is usually the answer: `cache.environment` defaults to `local`, which
enables disk caching only *outside* CI, so the pipeline builds cold every time. The second is the
worker cap — `min(4, max(cores - 1, 1))` — so a large CI machine gets no more parallelism than a
four-core one. The nuance worth adding is that the cache default is defensible: a cache only pays if
it survives between runs, and most pipelines start from a fresh container, so writing one would be
pure cost. Changing `environment` to `all` without also persisting `.angular/cache` makes builds
slightly slower, not faster.

**★ Why is the worker count capped at four?**
Because the number of CPUs reported inside a container is frequently the host's, not the container's
allowance — the source comment names CircleCI and Docker specifically — and spawning that many
workers produces `Error: Call retries were exceeded`. The cap is a defence against an untrustworthy
input rather than a claim that four is optimal. `NG_BUILD_MAX_WORKERS` overrides it, which is
reasonable where you know the real limit and is how you reproduce the original failure where you do
not.

**★ There are two caches with opposite worktree behaviour. What are they and why?**
The persistent build cache is shared across git worktrees, added in 22.1.0, so several checkouts of
the same repository reuse each other's compilation work. The dev-server's Vite cache is deliberately
kept worktree-local, fixed in 22.1.7. The asymmetry makes sense once you notice what each caches:
build output is a function of source content and is safe to share, while the dev server's prebundled
dependencies are tied to a specific serving session and sharing them across worktrees caused
problems worth a `fix` commit. The visible consequence is that `ng serve` re-prebundles after a
worktree switch and builds do not.

**What does `cache.path` default to, and what manages it?**
`.angular/cache`, and nothing manages it — the CLI writes to it and never prunes it. On a
long-lived build agent that matters, and the option exists so you can relocate it somewhere your
infrastructure does control. It is also worth knowing that `enabled: false` turns off build disk
caching specifically, not everything that writes under `.angular/`.

---

← Prev: [Import attributes and conditions](10c-import-attributes-and-conditions.md) · Index: [Topic index](README.md) · Next → [The `NG_BUILD_*` surface](11b-the-ng-build-environment-surface.md)
