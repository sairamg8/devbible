---
title: "Affected-package filtering is the whole reason a monorepo CI stays fast, and it is defeated by the one setting almost every CI checkout ships with by default — a shallow clone"
sidebar_label: "4d · Turborepo in CI"
sidebar_position: 108
description: "TURBO_TOKEN and TURBO_TEAM, why the turbo major must be pinned in CI, --affected and the shallow-clone trap, turbo query affected and its exit codes, the --filter microsyntax, wiring Jest, Vitest and Playwright suites into the task graph, and an honest account of where the cache saves time versus where it lies."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against the Turborepo documentation — [Constructing CI](https://turborepo.dev/docs/crafting-your-repository/constructing-ci), [`turbo run`](https://turborepo.dev/docs/reference/run), [Jest guide](https://turborepo.dev/docs/guides/tools/jest), [Vitest guide](https://turborepo.dev/docs/guides/tools/vitest), [Playwright guide](https://turborepo.dev/docs/guides/tools/playwright). Continues [4c · Hashing, caching and poisoning](04c-hashing-caching-and-cache-poisoning.md). Documentation-verified; **no sandbox run**.
> Target: **Turborepo 2.10.12** · **Next.js 16.3.4** · `@playwright/test` 1.62.1 · Vitest 5.0.0 · Node.js 24.20.0.

**A monorepo CI pipeline is fast for exactly two reasons: it skips packages nothing changed in, and it restores artefacts for the ones it cannot skip. Both depend on information CI providers throw away by default. Change detection needs git history, and the standard checkout action clones one commit; the remote cache needs credentials, and a fork's pull request does not have them. Neither failure is loud. `--affected` on a shallow clone does not error — the documentation says plainly that all packages will be considered changed — so the pipeline runs everything, takes eleven minutes, and the team concludes that Turborepo did not help much.**

## The two credentials

Remote caching in CI needs a bearer token and a team slug:

```yaml
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

`TURBO_TEAM` is the account or team slug, not a display name. Both must be present on every job that runs `turbo`, including matrix shards.

## Pin the CLI, and use `turbo run`

> *"pin your global installation of `turbo` in CI to the major version in `package.json`"*

A globally-installed `turbo@latest` in CI against a `turbo@^2` repo is a version skew waiting for a major release. And invoke tasks explicitly:

> Use `turbo run <task>` rather than `turbo <task>` — the bare form risks colliding with a future subcommand name. `turbo run test` is unambiguous forever; `turbo test` is unambiguous only until a `test` subcommand exists.

## `--affected`, and the shallow-clone trap

> *"Filter to only packages that are affected by changes on the current branch."*

In GitHub Actions it reads `GITHUB_BASE_REF`, falling back to `GITHUB_EVENT_PATH` on push events. But:

> 🔴 *"Filtering using source control changes is only possible when history is available on the machine. If you are using shallow clones, history will not be available."*

> *"A clone with sufficient history is necessary for comparisons — if the checkout is too shallow, all packages will be considered changed."*

`actions/checkout` defaults to `fetch-depth: 1`. So the default configuration silently degrades `--affected` to "everything". The documented remedy is a clone with history but without blobs:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
    filter: blob:none
```

`--filter=blob:none --depth=0` is the underlying git form — full commit history, blobs fetched lazily, which keeps the checkout small while preserving the comparisons `--affected` needs.

## `turbo query affected` — when you need the answer as data

```bash
turbo query affected --packages web
turbo query affected --tasks test --packages docs
```

Returns JSON, so `jq '.data.affectedPackages.length'` is a valid gate in a shell step. `--tasks` respects each task's `inputs`, so a package whose only change was a `README.md` excluded by an `inputs` negation is correctly reported as unaffected.

`--exit-code` makes it a conditional: **1** when results were found, **0** when nothing is affected, **2** on an error. Note the inversion relative to normal shell convention — "found something" is the non-zero case.

The reported reasons name the cause, which is the fastest way to debug a run that rebuilt more than you expected:

| Reason | Meaning |
|---|---|
| `FileChanged` | A file in the package itself changed |
| `DependencyChanged` | A package it depends on changed |
| `RootInternalDepChanged` | An internal package the **workspace root** depends on changed — see [4c](04c-hashing-caching-and-cache-poisoning.md) |

## The `--filter` microsyntax

> *"Specify targets to execute from your repository's graph. Multiple filters can be combined to select distinct sets of targets."*

| Form | Selects |
|---|---|
| `--filter=ui` | The package named `ui` in its `package.json` |
| `--filter=./apps/*` | Every package in a directory glob |
| `--filter=[HEAD^1]` | Packages with source-control changes since that commit |
| `--filter=...web` | `web` **and everything that depends on it** |
| `--filter=web...` | `web` **and everything it depends on** |
| `--filter=^...web` | The dependents, omitting `web` itself |
| `--filter=!./apps/admin` | Negation — removes from the selection |

Documented combinations worth stealing:

```bash
turbo run build --filter=...[origin/my-feature]   # everything downstream of the branch's changes
turbo run build --filter=@acme/ui...[HEAD^1]      # ui and its deps, only if changed
turbo run build --filter=./apps/* --filter=!./apps/admin
turbo run test  --filter=@acme/*{./packages/*}[HEAD^1]
```

Multiple filters union; negations subtract from the result.

## Wiring the three test runners into the graph

### Jest and Vitest, per package

Install the runner in each package that has tests, give each a `test` script, and define `"test": {}` — with `outputs` — once at the root. The two-task split for watch mode is on [4](04-monorepos-with-turborepo-shared-packages-remote-caching-ci-p.md), and it is not optional: a `test` script that watches never exits, so CI hangs rather than fails.

### Vitest Projects: the trade you are making

Vitest's Projects feature runs one Vitest process across many packages. Turborepo is explicit about the cost:

> 🔴 *"there aren't package boundaries … This means you can't rely on Turborepo's caching, since Turborepo leans on those package boundaries."*

You then need a Root Task, and:

> *"the file inputs for a Root Task include all packages by default, so any change in any package will result in a cache miss."*

```json
{
  "tasks": {
    "//#test": {
      "outputs": ["coverage/**"]
    }
  }
}
```

That is a correct configuration for merged coverage across the whole repo, and it caches essentially never. The documented hybrid is the honest answer: a `@repo/vitest-config` package shared by both, Projects locally for one command and merged coverage, per-package tasks in CI for caching and affected-filtering. `vitest run --project=web` filters within Projects mode.

Note also that project-level configs in the `projects` array *"cannot extend the root config's `test` object directly"* — sharing happens through an imported config package, not through `extends`.

The per-package alternative needs a `transit` task so that a change in a dependency invalidates a dependent's tests without forcing a build:

```json
{
  "tasks": {
    "test": { "dependsOn": ["transit"], "outputs": ["coverage/**"] },
    "transit": { "dependsOn": ["^transit"] }
  }
}
```

### Playwright: a package per suite

> *"We recommend creating a Playwright package for each test suite that you'd like to run."*

Two caching requirements, one free and one not:

1. A change to the test suite must miss cache. Free — the tests are in the package.
2. 🔴 A change to **the code under test** must miss cache. Not free. Express it by making the e2e package depend on the app and the task depend on upstream builds:

```json
{
  "name": "@repo/playwright-web",
  "dependencies": { "web": "workspace:*" }
}
```

```json
{
  "tasks": {
    "e2e": {
      "dependsOn": ["^build"],
      "outputs": ["playwright-report/**", "test-results/**"]
    }
  }
}
```

Then, when the app is already built, skip rebuilding it:

```bash
turbo run e2e --filter=@repo/playwright-web --only
```

> `--only` *"Restricts execution to include specified tasks only."*

And put Playwright's own variables in pass-through, not `env`:

> *"we don't want to miss cache in situations where these Playwright-internal variables change"* — `PLAYWRIGHT_BROWSERS_PATH` is the named example.

A shared helpers package for Playwright should declare `peerDependencies` on playwright rather than depending on it directly, so there is one browser installation and one version.

The Playwright config itself — `next start` not `next dev`, the `webServer` block, the setup project for authentication, sharding and retries — is [2 · End-to-end flows with Playwright](02-end-to-end-flows-with-playwright-testing-streaming-and-ppr-b.md) and [2b · PPR, Activity and CI](02b-testing-ppr-activity-and-playwright-in-ci.md). This page only covers getting it into the task graph.

## A pipeline shape

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          filter: blob:none
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run lint type-check test --affected
      - run: pnpm turbo run build --affected

  e2e:
    needs: verify
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          filter: blob:none
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps
      - run: pnpm turbo run e2e --filter=@repo/playwright-web
```

`lint type-check test` in one `turbo run` invocation lets Turborepo schedule all three across the graph concurrently, which is faster than three sequential steps and gives one summary.

## Where the cache saves time, and where it lies

**It saves, genuinely:**

- A PR touching one app in a repo of eight: the other seven skip entirely under `--affected`.
- A rerun of a flaky job: everything that already passed replays from cache.
- A `main` build after a PR merge, where CI already built the identical tree on the PR — provided both jobs share a remote cache and neither hashes a per-run value.

**It lies, or fails to help, when:**

- `outputs` is undeclared, so a hit restores nothing and the next task builds against whatever happens to be on disk.
- A build-affecting variable is missing from `env`, so two environments share one hash.
- A `.env` file is not in `globalDependencies` or `inputs`.
- The task embeds a timestamp or commit SHA, making every artefact unique and every hit wrong.
- The pipeline is dominated by things Turborepo does not cache anyway — `pnpm install`, `playwright install`, container startup, database migrations. A repo whose CI is 70% installation time will see a modest improvement no matter how perfect `turbo.json` is.

The measurable check is not "did it say FULL TURBO" but "does a no-op commit produce a run with zero executed tasks". If it does not, `--summarize` and diff, per [4c](04c-hashing-caching-and-cache-poisoning.md).

## Gotchas

**★ Symptom: `--affected` rebuilds every package on every pull request.** Cause: the checkout is shallow, and *"if the checkout is too shallow, all packages will be considered changed."* Fix: `fetch-depth: 0` with `filter: blob:none` on `actions/checkout`. There is no warning for this; the pipeline is simply slow.

**★ Symptom: `--affected` works on pull requests and rebuilds everything on pushes to `main`.** Cause: on a pull request it reads `GITHUB_BASE_REF`; on a push there is no base ref and it falls back to `GITHUB_EVENT_PATH`. A push job with a shallow clone or a missing event payload has nothing to compare against. Fix: full history on both job types, and accept that the first build on a new branch has no useful base.

**★ Symptom: cache hits locally, misses in every CI job.** Cause: `TURBO_TOKEN` or `TURBO_TEAM` is missing from that job — commonly present on the build job and absent on the matrix shards — or the PR comes from a fork, where secrets are not exposed. Fix: set both in the workflow-level `env`; for fork PRs, accept local-only caching rather than exposing a write token.

**★ Symptom: `turbo query affected --exit-code` skips the job when there *are* changes.** Cause: the exit codes are inverted relative to intuition — 1 means results were found, 0 means nothing is affected, 2 is an error. Fix: branch on `1`, not on `0`, and handle `2` explicitly so a query failure does not read as "nothing changed".

**★ Symptom: the E2E suite passes against a stale build of the app.** Cause: the Playwright package does not depend on the app, so a change to the app does not invalidate the e2e task's hash. Fix: `"web": "workspace:*"` in the Playwright package's dependencies plus `"dependsOn": ["^build"]` on the task — the two together are what Turborepo's Playwright guide calls the non-free half of the requirement.

**★ Symptom: `turbo run e2e` rebuilds the whole app even though it was just built.** Cause: the task's dependencies run by default. Fix: `--only`, which restricts execution to the named tasks. Use it only when you know the build is current — in a job that just ran `turbo run build`.

**★ Symptom: the Vitest Projects root task misses cache on every commit.** Cause: *"the file inputs for a Root Task include all packages by default."* Fix: use per-package test tasks in CI and keep Projects for local runs and merged coverage, sharing configuration through a `@repo/vitest-config` package.

**★ Symptom: `PLAYWRIGHT_BROWSERS_PATH` changing invalidates every cached e2e run.** Cause: it was listed in `env` rather than `passThroughEnv`. Fix: move it — the variable must reach the runtime and must not participate in the hash.

**★ Symptom: `turbo test` stops working after a Turborepo upgrade.** Cause: the bare form is a subcommand-shaped invocation and the docs warn against it. Fix: `turbo run test` everywhere, including in `package.json` scripts.

**★ Symptom: CI passes with a `turbo` version nobody in the repo uses.** Cause: a globally installed `turbo@latest` in the CI image, against a repo pinned to a different major. Fix: pin the global installation to the major in `package.json`, or drop the global install entirely and invoke the workspace binary (`pnpm turbo …`).

**★ Symptom: a task that only touched documentation still ran the full test suite.** Cause: the default `inputs` are every source-controlled file in the package, documentation included. Fix: `"inputs": ["$TURBO_DEFAULT$", "!**/*.md"]` on the test task — and note the `$TURBO_DEFAULT$` prefix, without which you have replaced the default rather than trimmed it ([4](04-monorepos-with-turborepo-shared-packages-remote-caching-ci-p.md)).

## Interview questions

**★ Why does `--affected` fail silently rather than erroring on a shallow clone?**
Because "no history available" is indistinguishable, from Turborepo's position, from "everything changed since the beginning of time" — and the safe interpretation of an unknown base is to run everything. Failing open is the right default for a correctness tool; the cost is that the degradation is invisible. The only way to notice is to observe that a one-line change rebuilt eight packages, which looks like a configuration problem in `turbo.json` and is actually a problem in the checkout step.

**★ What is the difference between `--filter=...web` and `--filter=web...`?**
The position of the ellipsis names the direction in the package graph. `...web` selects `web` and everything that **depends on** it — what you run when you changed `web` and want to know what it might have broken. `web...` selects `web` and everything **it depends on** — what you run to build `web` from a cold start. Prefixing with `^` omits the target itself, which is how you test only the dependents.

**★ Why would you use `turbo query affected` instead of `--affected`?**
Because `--affected` is a filter and `query` is a question. When you need to decide *whether to run a job at all* — skip the expensive E2E stage entirely when only documentation changed — you need the answer as data before the run starts, and `query` gives it as JSON with `--exit-code` for shell branching. It also reports the *reason* a package is affected, which is the diagnostic you want when a trivial change invalidates the world.

**★ Why must the Playwright package depend on the application?**
Because Turborepo hashes a task from its own package's files plus its dependencies. If the e2e package only contains specs, a change to the application does not change any input the e2e task knows about, and the suite hits cache and reports the previous run's result against new code. Declaring `"web": "workspace:*"` puts the app in the dependency graph, and `dependsOn: ["^build"]` ensures the app is built before the suite runs. The Turborepo guide separates these two requirements explicitly because only one of them is obvious.

**★ Vitest Projects gives one command and merged coverage. Why would you not use it in CI?**
Because Projects erases package boundaries, and package boundaries are what Turborepo caches and filters on. The suite becomes a Root Task whose inputs are the entire repository, so every commit misses cache and `--affected` has nothing to narrow. The documented compromise is to use both — Projects locally where a single command and merged coverage are worth more than caching, per-package tasks in CI where caching and affected-filtering are worth more than a merged report — with a shared config package so the two do not drift.

**★ Your CI got 20% faster after adopting Turborepo and the team is disappointed. What do you look at?**
The proportion of the pipeline that Turborepo can influence at all. Dependency installation, browser installation, container pulls, database provisioning and artefact upload are not tasks in the graph, and a pipeline that spends most of its wall time there will not improve much. Then look for the wrong-hit and never-hit patterns: a no-op commit should produce a run with zero executed tasks, and if it does not, `--summarize` two runs and find the differing input. The answer is usually a root-level internal dependency, an unhashed `.env`, or a task embedding a commit SHA.

**★ Is remote caching safe on a repository with untrusted contributors?**
Not without care. Cache artefacts include captured logs, so anything a build prints is shared; and a write-capable token in a workflow that runs fork-authored code is a supply-chain hazard, because a malicious PR could poison the cache for everyone. The defensible arrangement is that fork pull requests run without the token — local cache only, slower, correct — while trusted branches populate the shared cache, with `signature` verification enabled and build scripts audited for what they print.

{/* FOOTER */}
