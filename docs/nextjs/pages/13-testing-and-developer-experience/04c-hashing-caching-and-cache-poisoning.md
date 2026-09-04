---
title: "Turborepo assumes your tasks are deterministic, so anything that changes a task's behaviour without changing its hash is not a cache miss you lost — it is a wrong answer you shipped"
sidebar_label: "4c · Hashing, caching and poisoning"
sidebar_position: 12
description: "The global hash versus the task hash and what feeds each, why a change to a root dependency misses every cache in the repo, Strict Environment Variable Mode and framework inference, why .env files are invisible to the hash, logs as cache artefacts, remote caching, and the cases where caching is slower than executing."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Turborepo documentation — [Caching](https://turborepo.dev/docs/crafting-your-repository/caching), [Using environment variables](https://turborepo.dev/docs/crafting-your-repository/using-environment-variables), [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching), [Configuration reference](https://turborepo.dev/docs/reference/configuration). Continues [4b · Shared packages and transpilation](04b-shared-packages-and-transpilation.md). Documentation-verified; **no sandbox run**.
> Target: **Turborepo 2.10.12** · **Next.js 16.3.4** · Node.js 24.20.0.

**Every cache is a bet that the same inputs produce the same output. Turborepo states the bet openly — *"Turborepo assumes that your tasks are deterministic"* — and the entire failure surface of the tool is the gap between what actually influences a task and what Turborepo was told about. A missing `env` entry, an unhashed `.env` file, a root-level dependency, a task that reads the current time: each one produces a cache **hit** on a run that should have missed. That is the dangerous direction. A missed hit costs you two minutes; a wrong hit ships a staging build to production, and the CI logs say `FULL TURBO` while it happens.**

## Two hashes, and what feeds each

Turborepo computes a **global hash** and a **task hash**. A change to either misses cache.

The global hash covers:

- Resolved task definitions from the root `turbo.json` **and** every package `turbo.json`
- Lockfile changes affecting the workspace root
- 🔴 Source files of internal packages that the **workspace root** depends on
- The contents of files matched by `globalDependencies`
- The values of `globalEnv` variables
- Behaviour-changing flags: `--cache-dir`, `--framework-inference`, `--env-mode`
- Arbitrary passthrough arguments — `turbo build -- --arg=value` misses cache for **all** tasks

The task hash covers:

- The package's own `turbo.json`
- Lockfile changes affecting that package
- The package's `package.json`
- File changes — by default, all source-controlled files in the package directory
- The values of the task's `env` variables

Two entries in the global list deserve their own heading.

### `globalDependencies` and `globalEnv` are repo-wide sledgehammers

> *"A list of globs that you want to include in all task hashes. If any file matching these globs changes, all tasks will miss cache."*

> *"A list of environment variables that you want to impact the hash of all tasks. Any change to these environment variables will cause all tasks to miss cache."*

Correct for `tsconfig.base.json`. Wrong for anything that changes often.

### The root dependency closure — the one nobody predicts

> *"if the root package depends on `@repo/tooling`, changing a source file in `@repo/tooling` causes every cacheable task to miss cache."*

A dependency added to the **workspace root's** `package.json` — an ESLint config, a script helper, a commit-lint setup — puts its entire source into the global hash. `turbo query affected --packages` reports this as `RootInternalDepChanged`. The practical rule: the root `package.json` should have as close to zero internal dependencies as you can manage.

## Environment variables: where wrong hits come from

Turborepo runs in **Strict Environment Variable Mode by default** — only variables listed in `env` or `globalEnv` reach the task's runtime. That is a good default, and its two caveats are the whole problem.

The first is the direct one:

> *"If you haven't defined the `env` or `globalEnv` keys for your task, Turborepo will not be able to use them when creating hashes. This means your task can hit cache despite being in a different environment."*

The second is subtler and is the reason strict mode does not save you on its own:

> *"it doesn't guarantee task failure. If your application is able to gracefully handle a missing environment variable, you could still successfully complete tasks and get unintended cache hits."*

An app that falls back to a default database URL will build cleanly with the variable filtered out — and cache that build. This is the exact argument for the fail-fast env schema in [3e](03e-env-schemas-and-contract-tests.md): a schema that throws on a missing variable converts a silent wrong cache entry into a loud build failure.

### Framework inference does part of the job for you

Turborepo detects the framework per package and adds prefix wildcards automatically. For Next.js that is `NEXT_PUBLIC_*` (Vite gets `VITE_*`, Astro and SvelteKit `PUBLIC_*`, and so on). *"Framework inference is per-package."* Opt out with `--framework-inference=false` or by negating in the task's `env`:

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "!.next/dev/**"],
      "env": ["DATABASE_URL", "AUTH_SECRET", "SENTRY_DSN"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "env": ["DATABASE_URL"]
    }
  },
  "globalEnv": ["NODE_ENV"],
  "globalPassThroughEnv": ["CI", "GITHUB_ACTIONS"],
  "globalDependencies": ["tsconfig.base.json", ".env"]
}
```

Note the shape: variables that **change the output** go in `env`; variables that the task needs at runtime but that must **not** change the hash go in `passThroughEnv` / `globalPassThroughEnv`. `PLAYWRIGHT_BROWSERS_PATH` is the canonical example — Turborepo's own Playwright guide puts it in pass-through because *"we don't want to miss cache in situations where these Playwright-internal variables change."*

⚠️ Strict mode also filters your CI provider's variables until you account for them, which is why a task that works locally can fail in CI with a mysteriously empty `process.env`.

`eslint-config-turbo` exists to close the gap mechanically: it finds environment variables used in code and missing from `turbo.json`. In a repo of any size this is not optional discipline, it is a lint rule.

### 🔴 `.env` files are invisible to the hash

> *"Turborepo does not load `.env` files into your task's runtime"*

That is the framework's job — Next.js loads `.env*` itself ([3e](03e-env-schemas-and-contract-tests.md) has the load order). Turborepo therefore does not know the file exists, does not hash it, and will happily replay a build produced under a different `.env`. Add it yourself:

```json
{
  "globalDependencies": [".env"],
  "tasks": {
    "build": {
      "inputs": ["$TURBO_DEFAULT$", ".env*"]
    }
  }
}
```

The per-task `inputs` form is better when `.env` files live in application packages, which the Turborepo docs recommend over keeping them at the repo root.

One more timing detail: *"Turborepo hashes the environment variables for your task at the beginning of the task"*. A script that mutates its own environment mid-run changes nothing about the hash.

## Logs are cache artefacts

> *"Turborepo treats logs as artifacts, so be aware of what you are printing to the console."*

This is a security sentence disguised as a performance note. A build script that echoes a connection string writes that string into a cache artefact, and with remote caching enabled that artefact is uploaded to a shared store and replayed to every teammate and every CI job that hits the same hash. Audit what your build prints before you enable remote caching, not after.

## Remote caching

Without it, the cache is per machine:

> *"the same task (`turbo run build`) must be re-executed on each machine"*

Turning it on is two commands — `turbo login`, then `turbo link`. The Vercel Remote Cache is the zero-configuration default and is *"free on all plans"*, explicitly *"even if you do not host your applications on Vercel"*; self-hosting is documented against the Remote Cache API.

The configuration surface is small and each option has a reason:

| Option | Default | Why you would change it |
|---|---|---|
| `enabled` | `true` | Turn the remote cache off for a specific repo without unlinking |
| `signature` | `false` | Enables signature verification for requests to the remote cache — turn it on if the cache is shared beyond your trust boundary |
| `preflight` | `false` | Sends an OPTIONS request before each operation; needed behind some proxies |
| `timeout` | `30` s | Slow or distant cache endpoints |
| `uploadTimeout` | `60` s | Large artefacts, which usually means your `outputs` globs are too broad |
| `apiUrl` / `loginUrl` / `teamId` / `teamSlug` | — | Self-hosted or non-default endpoints |

The local cache lives in `.turbo/cache` by default (`cacheDir`).

### The worktree hazard

Git worktree cache sharing is automatic — and is **disabled** if you set an explicit `cacheDir`. The warning that goes with it is worth reading twice: *"Cache artifacts are restored without rewriting their contents."* An output file containing an absolute path from the worktree that produced it — a source map, a generated config, a manifest — is restored verbatim into a different checkout, where that path does not exist. The symptom is a build that works and a runtime that cannot find a file nobody can see in the diff.

## When caching is slower than executing

The docs are honest that the cache is not free, and name three cases:

- **Very fast tasks.** Hashing, checking and restoring can exceed the cost of just running it. A `lint` task on a five-file package is a candidate for `"cache": false`.
- **Enormous artefacts.** Upload and download dominate. Usually a signal that `outputs` is over-broad — `.next/cache` being the classic offender ([4](04-monorepos-with-turborepo-shared-packages-remote-caching-ci-p.md)).
- **Tools with their own cache.** `tsc --incremental` and Next.js's own build cache already do this work; layering Turborepo on top can mean restoring a cache in order to invalidate a cache.

## Debugging a hit you did not expect

```bash
turbo run build --dry                       # what would run, and why
turbo run build --summarize                 # write a run summary
turbo run build --force                     # ignore existing artefacts and re-execute
```

The technique that actually finds the answer: `--summarize` two runs — one that hit and one that should not have — and diff the summaries. The differing input is in there. `--force` *"Ignore existing cached artifacts and re-execute all tasks"*, but note it disables cache **reading**, not writing, so a forced run still populates the cache with whatever it produces.

## Gotchas

**★ Symptom: a production build is served with staging configuration, and CI reported a cache hit.** Cause: the variable that differs between the environments is not listed in `env` or `globalEnv`, so it is not in the hash — *"your task can hit cache despite being in a different environment."* Fix: list every build-affecting variable in the task's `env`, and run `eslint-config-turbo` so a newly-introduced variable cannot be forgotten.

**★ Symptom: the build succeeded with `DATABASE_URL` filtered out by Strict Mode.** Cause: the application handled the missing variable gracefully, and the docs warn that strict mode *"doesn't guarantee task failure."* Fix: make the app fail loudly on a missing variable — a Zod env schema parsed at module scope does exactly this — so a filtered variable becomes a build error instead of a cached artefact.

**★ Symptom: changing a `.env` value produces a cache hit and no rebuild.** Cause: *"Turborepo does not load `.env` files into your task's runtime"*, and it does not hash them either. Fix: `globalDependencies: [".env"]`, or better, per-package `inputs: ["$TURBO_DEFAULT$", ".env*"]` with the files kept in the application packages.

**★ Symptom: every task in the repo misses cache after a one-line change to a shared ESLint config.** Cause: that package is a dependency of the **workspace root**, so its source is in the global hash — `RootInternalDepChanged`. Fix: remove internal dependencies from the root `package.json` wherever possible; have the packages that use the config depend on it directly instead.

**★ Symptom: a teammate's `turbo build` hits a cache entry containing a secret from your terminal.** Cause: logs are cache artefacts, and remote caching shares them. Fix: stop printing secrets from build scripts, and rotate anything already printed — the artefact is already in the shared store. Treat this as a pre-condition for enabling remote caching, not a follow-up.

**★ Symptom: cache restores are slower than the build.** Cause: `outputs` includes `.next/cache`, or a `dist/**` glob that swept in `node_modules`. Fix: narrow the globs and exclude the framework's own caches, per [4](04-monorepos-with-turborepo-shared-packages-remote-caching-ci-p.md). If the artefact is genuinely small and the task genuinely fast, `"cache": false` is a legitimate answer.

**★ Symptom: after switching git worktrees a restored build references a path that does not exist.** Cause: worktree cache sharing is automatic, and *"Cache artifacts are restored without rewriting their contents"* — an absolute path baked into an output survives the move. Fix: stop absolute paths getting into outputs (source-map `sourceRoot`, generated configs), or set an explicit `cacheDir`, which disables worktree sharing.

**★ Symptom: `turbo build -- --profile` makes everything miss cache.** Cause: arbitrary passthrough arguments are part of the **global** hash, so any `--` argument invalidates every task in the run. Fix: expected behaviour — but do not put passthrough arguments in a shared script, or nobody in the repo will ever get a cache hit again.

**★ Symptom: a task hits cache locally and misses in CI on every run.** Cause: something in the global hash differs — commonly a `globalEnv` variable that CI sets and you do not (or vice versa), a different `--env-mode`, or a lockfile the CI job regenerated. Fix: `--summarize` in both environments and diff; the global hash section names the differing input.

**★ Symptom: a task reads the current time or a git SHA and its cached output is wrong.** Cause: the task is not deterministic, and Turborepo's whole model assumes it is. Fix: pass the value in as a declared `env` variable so it participates in the hash, or mark the task `"cache": false`. Embedding a build timestamp in an artefact is the most common way a team accidentally makes every task uncacheable *and* every cached artefact wrong.

**★ Symptom: CI variables are unexpectedly empty inside a task.** Cause: Strict Mode filters the CI provider's own variables until you list them. Fix: `globalPassThroughEnv: ["CI", "GITHUB_ACTIONS", "GITHUB_SHA"]` — pass-through, not `env`, because a changing SHA must not miss every cache.

## Interview questions

**★ Which is worse, a cache miss or a cache hit, and why?**
A wrong cache hit, by a wide margin. A miss costs the runtime of a task you were going to run anyway. A wrong hit produces an artefact built from different inputs than the ones present, reports success, and gives you no signal at all — the logs even replay from the cached run, so the output looks exactly like a real build of the current code. Every configuration decision in Turborepo should be read through this asymmetry: err towards over-declaring inputs.

**★ What is in the global hash that surprises people?**
The source files of internal packages that the workspace *root* depends on. Adding a shared tooling package to the root `package.json` means any edit to it invalidates every cacheable task in the repository, which shows up as "the cache stopped working" with no obvious cause. The other one is passthrough arguments: `turbo build -- --anything` is part of the global hash by design, so a `--` flag baked into a shared npm script disables caching repo-wide.

**★ Explain the difference between `env` and `passThroughEnv`.**
`env` makes a variable part of the task hash: change it and the task re-runs. `passThroughEnv` makes a variable available to the task at runtime *without* hashing it. You want `env` for anything that changes the output — API URLs, feature flags, `NODE_ENV`. You want `passThroughEnv` for things a tool needs but that must not invalidate the cache — CI metadata, `PLAYWRIGHT_BROWSERS_PATH`, a token. Getting this backwards produces either wrong cache hits (`passThroughEnv` for something that changes output) or a cache that never hits (`env` for a per-run value like a commit SHA).

**★ Strict Environment Variable Mode is on by default. Why is that not enough to prevent environment-related cache bugs?**
Because filtering a variable out of the runtime only fails if the application notices. The docs say so directly: strict mode *"doesn't guarantee task failure"*, and an app with a sensible default for a missing variable will build successfully and cache that build. Strict mode narrows what can leak into a task; it does not make the task complain about what is absent. That second half is the application's job, which is why an env schema that throws is a caching control as much as a correctness one.

**★ Why does Turborepo not read `.env` files?**
Because loading `.env` is a framework concern with framework-specific rules — Next.js has its own precedence order, its own `NODE_ENV` handling and its own `NEXT_PUBLIC_` semantics, and Vite has different ones. Turborepo stays out of it. The consequence is that `.env` files are invisible to the hash unless you add them to `globalDependencies` or a task's `inputs`, and almost every repo discovers this the first time a config change produces a cache hit.

**★ You enabled remote caching and your security team asks what is uploaded. What do you tell them?**
The files each task declared in `outputs`, and the task's captured stdout and stderr — the docs are explicit that logs are treated as artefacts. So anything a build script prints is in the shared store and will be replayed verbatim to anyone whose run matches the hash. The controls available are `signature` verification on cache requests, restricting the team scope of the token, and — most importantly — auditing what your build scripts print, because no cache setting redacts a secret you echoed.

**★ When is caching a task the wrong call?**
When the round trip costs more than the work. The docs name three cases: tasks fast enough that hashing and restoring dominate, artefacts large enough that transfer dominates, and tools that already maintain their own incremental cache, where you end up restoring one cache in order to invalidate another. A `lint` task over a tiny package and a Next.js build whose `outputs` accidentally include `.next/cache` are the two you will actually meet.

---

← [Shared packages and transpilation](04b-shared-packages-and-transpilation.md) · [Chapter 13 overview](01-explanation.md) · Next → [Turborepo in CI](04d-turborepo-in-ci-and-affected-filtering.md)
