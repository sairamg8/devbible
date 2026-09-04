---
title: "Turborepo is a task scheduler wrapped around a content-addressed cache, so every real problem it causes is either a hash that did not include something or an output that was never declared"
sidebar_label: "4 · Turborepo: the task graph"
sidebar_position: 4
description: "How turbo matches tasks to package.json scripts, the four forms of dependsOn, why an undeclared outputs key silently disables caching, what setting inputs opts you out of, the tasks that must never be cached, root tasks and package configurations, and the Next.js 16 tooling changes a monorepo feels first."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Turborepo documentation — [Configuring tasks](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks), [Configuration reference](https://turborepo.dev/docs/reference/configuration), [`turbo run`](https://turborepo.dev/docs/reference/run), [Jest guide](https://turborepo.dev/docs/guides/tools/jest) — and [`next` CLI](https://nextjs.org/docs/app/api-reference/cli/next) (lastUpdated 2026-08-25). Documentation-verified; **no sandbox run**.
> Target: **Turborepo 2.10.12** · **Next.js 16.3.4** · Node.js 24.20.0. ⚠️ `turborepo.com` now redirects to `turborepo.dev`.

**Turborepo does two things and nothing else: it decides what order your package scripts run in, and it decides whether a script needs to run at all. Both decisions come from `turbo.json`. The scheduling half is easy to get right and easy to reason about. The caching half is where teams lose days, because a misconfigured cache does not fail — it *succeeds wrongly*, replaying a stale artefact or skipping a task whose inputs actually changed. The single highest-value fact on this page is that a task with no `outputs` key caches nothing at all, and the docs mark the empty task definition as incorrect for exactly that reason.**

## What `turbo` actually does

There is no build system here. Turborepo runs the scripts you already have:

> *"Turborepo will search your packages for scripts in their `package.json` that have the same name as the task."*

So `turbo run build` means: find every package in the workspace with a `build` script, order them according to `dependsOn`, hash each one's inputs, and for each either execute the script or replay a cached result. `turbo` knows nothing about Next.js, TypeScript or Vitest — only about scripts, files and hashes.

## The empty task definition is documented as wrong

```json
{
  "tasks": {
    "build": {}
  }
}
```

The Turborepo documentation labels that exact snippet *"Incorrect! This will quickly lead to errors."* It declares a task with no ordering and no cached outputs: `@sprintdesk/ui` may build after `apps/web` needs it, and nothing is ever restored from cache. Both halves have to be filled in.

## `dependsOn`, in four forms

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "!.next/dev/**", "dist/**"]
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

| Form | Meaning |
|---|---|
| `"^build"` | Run `build` in this package's **direct dependencies** first. The caret is "upstream" |
| `"build"` | Run `build` **in this same package** first — e.g. `test` after `build` |
| `"utils#build"` | Run `build` in the specific package `utils` first, wherever this task runs |
| `"web#lint": { "dependsOn": ["utils#build"] }` | Scope both sides — only `web`'s `lint` waits for `utils`'s `build` |

`"type-check": { "outputs": [] }` is deliberate and not the same as omitting the key. An empty array means *this task produces no files*, so a cache hit is meaningful: the task succeeded, there is nothing to restore, skip it. Omitting `outputs` means something different, and worse.

## `outputs`: the key whose absence silently disables caching

> *"**Without this key defined, Turborepo will not cache any files. Hitting cache on subsequent runs will not restore any file outputs.**"*

That is the sentence to memorise. The task still reports a cache hit — Turborepo replays the logs — and then the next task in the pipeline finds no `.next` directory and fails, or worse, finds a *stale* one from a previous local run and succeeds against the wrong artefact.

The values that matter in a Next.js monorepo:

- **A Next.js app**: `[".next/**", "!.next/cache/**", "!.next/dev/**"]`. The negations are load-bearing. `.next/cache` is Next.js's *own* incremental cache, which is machine-specific and enormous; `.next/dev` belongs to the dev server. Uploading either to a remote cache turns a fast restore into a slow one.
- **A `tsc`-built package**: `["dist/**"]`.
- **A task with no artefacts** (`lint`, `type-check`): `[]`.

Globs are package-relative, so `dist/**` inside `packages/ui` means `packages/ui/dist`. There is no repo-root form.

## `inputs`: the key that removes a default you wanted

By default a task's file inputs are all Git-tracked files in its package directory. Setting `inputs` does not narrow that — it *replaces* it:

> *"opts out of all of Turborepo's default `inputs` behavior, including following along with changes tracked by source control. This means that your `.gitignore` file will no longer be respected."*

So `"inputs": ["src/**"]` on a `test` task quietly means gitignored build artefacts inside `src` now contribute to the hash, and every file outside `src` — `package.json`, the tsconfig, the test fixtures — does not. Restore the default and then subtract, with the microsyntax:

```json
{
  "tasks": {
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", "!README.md", "!**/*.stories.tsx"],
      "outputs": ["coverage/**"]
    }
  }
}
```

`$TURBO_DEFAULT$` expands to the normal behaviour, and the negations remove from it. Use this form unless you specifically want to break the default — which, for a test task, you almost never do: a change to `package.json` genuinely can change what the tests do.

For files produced by another task within the same run, Turborepo has **deferred hashing** — a structured `inputs` entry with `mode: "jit"` or `mode: "dependencyOutputs"`, so the hash is computed after the producing task has written them rather than before.

## The tasks that must never be cached

`cache: false` exists for tasks whose "output" is a running process:

> *"Setting `cache` to false is useful for long-running development tasks."*

and `persistent` exists to stop the graph waiting on one forever:

> *"Label a task as `persistent` to prevent other tasks from depending on long-running processes."*

The consequence people meet first is watch mode. Turborepo's own Jest guide is explicit that a watching test task cannot share a definition with a CI test task, because it never exits — the recommendation is **two separate tasks**:

```json
{
  "tasks": {
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "test:watch": {
      "cache": false,
      "persistent": true,
      "interruptible": true
    }
  }
}
```

`interruptible: true` lets `turbo watch` restart the process; `interactive` defaults to `true` for persistent tasks so the runner accepts `stdin` — which is what makes Vitest's and Jest's interactive watch menus usable inside `turbo`. `with` names tasks that should run alongside this one, which is how you start `dev` for an app and its mock API together.

⚠️ The VS Code Jest extension parses test output and chokes on Turborepo's `<package>:<task>:` log prefix. The documented workaround is `turbo run test --log-prefix=none --`.

## Root tasks and per-package configuration

A script in the workspace root's `package.json` is addressed with `//#`:

```json
{
  "tasks": {
    "//#format:check": {
      "outputs": []
    }
  }
}
```

Run it as `turbo run format:check` or `turbo run //#format:check`. 🔴 A root task's default file inputs are **all packages**, so any change anywhere misses its cache — fine for a formatter, ruinous for a test task, which is the trap in Vitest Projects mode ([4b](04b-shared-packages-and-transpilation.md)).

A package can also carry its own `turbo.json` — a **Package Configuration** — to override a task definition for that package only. Prefer it over `web#build` entries in the root file once you have more than a couple: it keeps the override next to the thing it overrides.

## The Next.js 16 tooling a monorepo feels first

Four changes landed in Next.js 16 that a single-app repo absorbs quietly and a monorepo does not, because in a monorepo each one has to be decided per package:

1. **`next lint` was removed, and `next build` no longer runs the linter.** A monorepo that ran `turbo run build` and considered linting covered now lints nothing, with a green pipeline. The fix is a real `lint` task with a script in every package, and the migration codemod is `npx @next/codemod@canary next-lint-to-eslint-cli .`. The full story — what the codemod writes, the ESLint flat-config default, and the ESLint-versus-Biome choice `create-next-app` now offers — is [13 · Linting after `next lint`](13-linting-after-next-lint.md). The monorepo-specific part is only this: one `lint` script per package and one `lint` task in `turbo.json` with `"outputs": []`, because a root-only lint task rehashes the entire repo on every change.

2. **`next build` type-checks with the project-local `tsc` CLI**, so adopting TypeScript 7 is a dependency bump. ⚠️ `experimental.useTypeScriptCli` is an opt-**out**, not the switch that enables TS 7 — setting it to `false` makes the build exit on TypeScript 7. The TypeScript floor is still 5.1. See [12 · TypeScript 7 and build type checking](12-typescript-7-and-build-type-checking.md). In a monorepo the extra wrinkle is that the CLI checks the whole `tsconfig` project, so a shared package with looser settings can fail an app's build — which is what `typescript.tsconfigPath` and a `tsconfig.build.json` are for ([3](03-type-safety-as-testing-strict-ts-config-typed-routes-zod-con.md)).

3. **Turbopack is the default bundler** for both `next dev` and `next build`; `--webpack` opts out. This changes the monorepo transpilation story, and that is [4b](04b-shared-packages-and-transpilation.md).

4. **`create-next-app` scaffolds `AGENTS.md` by default**, alongside a `CLAUDE.md` that references it, so coding agents read version-matched guidance. The recommended-defaults path is TypeScript, ESLint, Tailwind, App Router, Turbopack and `AGENTS.md`, with the `@/*` import alias. In a monorepo you will want one per app plus one at the root; chapter 14 covers what belongs in them.

## Gotchas

**★ Symptom: a task reports FULL TURBO and the next task fails because its input directory is missing.** Cause: the task has no `outputs` key, so nothing was ever cached — *"Without this key defined, Turborepo will not cache any files"* — and the "hit" only replayed logs. Fix: declare `outputs` on every task that writes files, and `"outputs": []` on every task that does not, so the distinction is explicit rather than accidental.

**★ Symptom: a task passes when it misses cache and fails when it hits cache.** Cause: the same one, seen from the other side — the Turborepo troubleshooting docs name it directly: *"If your task is passing when you miss cache but failing when you hit cache, you likely haven't configured the `outputs` key for your task correctly."* Fix: run `turbo run <task> --force` to confirm, then fix the glob. The usual miss is an output directory outside the package, or a directory excluded by a negation that was too broad.

**★ Symptom: the remote cache upload for an app takes longer than the build.** Cause: `.next/cache` is included in `outputs`. It is Next.js's own incremental cache and it is large and machine-specific. Fix: the documented value, `[".next/**", "!.next/cache/**", "!.next/dev/**"]`.

**★ Symptom: adding `"inputs": ["src/**"]` makes a test task hit cache after a `package.json` change.** Cause: setting `inputs` opts out of the default entirely, including source-control tracking and `.gitignore`. Fix: `["$TURBO_DEFAULT$", "!…"]` — start from the default and subtract.

**★ Symptom: `turbo run dev` hangs and nothing else in the run ever starts.** Cause: `dev` is a long-running process without `persistent: true`, so the scheduler is waiting for it to exit before running its dependents. Fix: `"dev": { "cache": false, "persistent": true }`. The `cache: false` matters too — a dev server has no meaningful output to restore.

**★ Symptom: `turbo run test` never returns in CI.** Cause: the package's `test` script is `vitest` or `jest --watch`, which watches by default. Fix: two tasks, as the Turborepo Jest guide recommends — `test` running `vitest run`, and a separate `test:watch` marked `cache: false, persistent: true`. This is the same trap as the Next.js Vitest guide's `"test": "vitest"` script, and it bites at exactly the moment CI is introduced.

**★ Symptom: the VS Code Jest extension shows no results under Turborepo.** Cause: it parses the runner's stdout and Turborepo prefixes every line with `<package>:<task>:`. Fix: `turbo run test --log-prefix=none --`.

**★ Symptom: a root task misses cache on every commit.** Cause: a root task's default inputs are every package in the repo. Fix: keep root tasks for things that genuinely depend on everything (a repo-wide formatter, a changeset check) and give per-package work per-package tasks. If you must keep a root task, give it explicit `inputs`, accepting that you then own the `.gitignore` consequence.

**★ Symptom: `turbo run build` builds a shared package after the app that consumes it.** Cause: `dependsOn` is missing, or uses `"build"` where it needed `"^build"`. Fix: `"dependsOn": ["^build"]`. The caret means "in my dependencies"; without it you asked for a `build` in the same package, which is a no-op ordering constraint.

**★ Symptom: a task defined only in the root `turbo.json` runs in packages that should not have it.** Cause: `turbo` matches on script names, so any package with a script of that name is included. Fix: either remove the script from packages that should not run it, or scope with `--filter`, or move the definition into a Package Configuration in the packages that should.

## Interview questions

**★ What does Turborepo actually cache, and what is it keyed on?**
The files a task declared in `outputs`, plus the task's captured stdout/stderr, keyed on a hash of that task's inputs — its source files, its `package.json`, the lockfile entries affecting it, its task definition, and the environment variables it declared — combined with a global hash covering repo-wide inputs. On a hit, the files are restored and the logs replayed instead of running the script. This is why an undeclared `outputs` key is so destructive: the key is still computed and matched, so you get all the speed of a hit and none of the artefacts.

**★ Why is `"build": {}` documented as incorrect?**
Because it declares neither of the two things a task definition exists to declare. Without `dependsOn` there is no ordering, so a package can build before a dependency it needs; without `outputs` nothing is cached, so every run is a full run and any apparent cache hit restores no files. The empty object is syntactically valid and semantically the worst of both worlds, which is why the docs call it out rather than treating it as a default.

**★ Explain `^build` versus `build` in `dependsOn`.**
`^build` means "run the `build` task in this package's direct dependencies first" — it walks up the package graph. `build` with no caret means "run the `build` task in *this* package first", which is what you want for `test` depending on `build` within one package. Mixing them up produces a build order that appears to work on a warm cache and breaks on a cold CI run, because a warm local `dist` directory hides the missing dependency edge.

**★ What is wrong with `"inputs": ["src/**"]` on a test task?**
It replaces Turborepo's default input set rather than narrowing it, and the default set is "all Git-tracked files in the package". So the task stops hashing `package.json`, the tsconfig, test fixtures and configuration, any of which can change what the tests do; and it starts hashing gitignored files that happen to live under `src`, because `.gitignore` is no longer consulted. The correct form is `["$TURBO_DEFAULT$", "!…"]`.

**★ Why do watch tasks need their own task name?**
Because Turborepo's model is "run a script to completion, then cache its outputs", and a watcher never completes. Marking a task `persistent` tells the scheduler not to let anything depend on it; marking it `cache: false` says its result is not an artefact. A single `test` task cannot be both the thing CI runs to completion and the thing a developer runs in watch mode, which is why the Turborepo Jest guide recommends two definitions rather than a flag.

**★ In a monorepo on Next.js 16, what silently stopped happening after an upgrade?**
Linting. `next lint` was removed and `next build` no longer runs the linter, so a pipeline whose only quality gate was `turbo run build` now lints nothing and stays green. The monorepo-specific consequence is that the fix is per package — a `lint` script in each, and a `lint` task with `"outputs": []` — because a single root-level lint task rehashes the whole repository on every commit and stops being cacheable in any useful sense.

{/* FOOTER */}
