---
name: memory-build-memory-tuning
description: The TWO memory ceilings in devbible's yarn build and which knob each one takes — SSG worker threads for the SSG phase, --max-old-space-size for bundling. Carries the CI exit-143 fix (4096, NOT 8192) and the measured ~2.2 GB Node default. Also: @docusaurus/faster is ALREADY on via future.v4.
metadata:
  type: project
---

# devbible — `yarn build` memory: it is the SSG worker pool, not the heap

2026-08-31. ~4,877 md/mdx files, 8 cores, 14 GB RAM. `yarn build` peaked ~12 GB and
froze the machine.

## 🔴 2026-09-05 UPDATE — there are TWO phases and they hit DIFFERENT ceilings

The note below is correct **for the SSG phase** and its knobs are already applied in
`package.json`. But on 2026-09-05 the build died in the **bundling** phase instead, and the
symptom was different:

```
[INFO] [en] Creating an optimized production build...
FATAL ERROR: Ineffective mark-compacts near heap limit — JavaScript heap out of memory
```

It died at **~2 GB**, having emitted no SSG output at all — so this is the **main V8 heap**, not a
worker thread, and `--max-old-space-size` **is** the right knob here. ⚠️ **That does not
contradict "wrong diagnosis 2" below; it scopes it.** Raising the heap does nothing for the SSG
worker pool, which is what that entry is about. Read the log line before choosing a knob:

| Log says | Phase | Knob |
|---|---|---|
| `Creating an optimized production build...` then an OOM | **bundling**, main process | `NODE_OPTIONS=--max-old-space-size` |
| SSG progress, machine swaps/freezes | **SSG worker pool** | `DOCUSAURUS_SSG_WORKER_THREAD_*` (already set) |

🔴 **Do NOT reach straight for `--max-old-space-size=8192` on this machine.** Tried it and the
bundler grew to **9.8 GB RSS with only 2.7 GB available** — the same freeze scenario this note was
written about, arrived at from the other direction. **A heap cap is permission to grow, not a
target.** Killed it deliberately rather than risk the machine; memory returned to 12.5 GB free.
**4096 is the value to try first** — comfortably above the ~2 GB that failed, and with the SSG pool
already capped at 4 × 500 MB the whole build should peak around 6–7 GB on 14 GB of RAM.

⚠️ **Also clear the cache before concluding anything from a build failure.** The first failure that
day was **114 × `Cannot find module '@site/docs/nextjs/pages/16-deployment…'`** — paths from
*before* a chapter renumber, served out of a stale `.docusaurus/`. It looks exactly like a content
defect and is not one. `yarn clear` first; it is gitignored and safe.

## 🔴 2026-09-08 — the same ceiling, now in CI, and it is set in the workflow

Three of four pushes to `main` failed as **`exit code 143`** at 3m40s–4m45s into a build
that takes 10–13 min when it passes (runs `34248199241`, `34235610823`, `34235092966`),
emitting nothing after `Creating an optimized production build...` — the bundling-phase
signature in the table above. `.github/workflows/deploy.yml` now sets
`NODE_OPTIONS: --max-old-space-size=4096` on the **Build step only**.

- 🔴 **The default is ~2.2 GB, not 4 GB.** Measured: `v8.getHeapStatistics().heap_size_limit`
  on a 14 GB box reports **2.19 GB**, and `4096` moves it to 4.19 GB. That is also exactly
  where the 2026-09-05 bundling OOM died — it was hitting the *stock* limit, not a tuned one.
  Anyone who assumes 4 GB will wrongly conclude `4096` is a no-op and reach for 8192.
- ⛔ **8192 was committed first (`4b9447734`) and corrected to 4096 within the hour
  (`9474a7caa`)** — because this file was read *after* the push, not before. The warning above
  was already here. 16 GB of CI RAM makes 8192 less dangerous than it was locally, not correct.
- ⚠️ **The CI symptom is NOT proof of an OOM.** 143 is SIGTERM; the OOM killer sends SIGKILL
  (137) and V8's own heap exhaustion aborts with 134 **and prints the `JS heap out of memory`
  banner** — which these runs never did. Memory pressure is the leading read, not a proven one.
  **If 143 returns with 4096 set, the cause is elsewhere — do not just raise the number.**

## ⚠️ Two wrong diagnoses to not repeat

**1. "Enable `@docusaurus/faster`."** It is **already fully enabled**. The config has
`future: {v4: true}`, which sets `fasterByDefault: true`, and
`postProcessDocusaurusConfig` then defaults **every** faster key to `true` when the user
has not set it — `rspackBundler`, `swcJsLoader`, `rspackPersistentCache`,
`ssgWorkerThreads`, all of them. Adding an `experimental_faster` block is a **no-op**.
Verify at `node_modules/@docusaurus/core/lib/server/configValidation.js:442`.

**2. "Raise `--max-old-space-size`."** Wrong layer. The ceiling being hit is
**per-worker-thread**, not the main V8 heap, so more headroom for the main process
changes nothing.

## The actual cause

`getNumberOfThreads` (`@docusaurus/core/lib/ssg/ssgExecutor.js:50`) infers
`min(ceil(pageCount / 100), cpuCount)` → `min(49, 8)` = **8 threads**. Tinypool is given
`maxMemoryLimitBeforeRecycle` = **1 GB** (`ssgEnv.js:33`), so each worker may grow to 1 GB
before it is recycled. 8 × 1 GB + the main process ≈ the 12 GB observed.

## The knobs (all undocumented env vars, read in `ssgEnv.js`)

| Var | Default | Note |
|---|---|---|
| `DOCUSAURUS_SSG_WORKER_THREAD_COUNT` | inferred (8 here) | set to **1** to disable the pool entirely |
| `DOCUSAURUS_SSG_WORKER_THREAD_RECYCLER_MAX_MEMORY` | `1000000000` | bytes, per worker |
| `DOCUSAURUS_SSR_CONCURRENCY` | `32` | pages in flight; name still says SSR |
| `DOCUSAURUS_SSG_WORKER_THREAD_TASK_SIZE` | `10` | pages per worker task |

🔴 **These change only scheduling, never the output** — safe on the deployable build.

## What is wired in the repo (commit `36519226`)

- **`yarn build`** — caps at `COUNT=4` × `500 MB` ≈ 2 GB instead of 8 GB. **Still the
  build that ships**; output byte-identical.
- **`yarn build:fast`** — adds `--no-minify` **and** `FAST_BUILD=true`, which makes
  `docusaurus.config.js` set `themes: []`, dropping
  `@easyops-cn/docusaurus-search-local`. Its `postBuild` re-parses all ~4,877 built HTML
  files with Cheerio in the **main** process, after SSG has already peaked — the single
  heaviest stage. 🔴 **A `build:fast` output is NOT deployable: search finds nothing.**
  Routes + MDX only.

⚠️ `--no-minify` is the one flag that changes real output (bigger JS/CSS/HTML shipped),
so it must never reach `yarn deploy`.

Still obeys the build registry — [[session-build-devserver-registry]]. Related:
[[feedback-simple-final-replies]].
