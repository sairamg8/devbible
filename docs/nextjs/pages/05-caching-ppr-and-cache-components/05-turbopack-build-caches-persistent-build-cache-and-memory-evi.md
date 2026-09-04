---
title: "Turbopack's build cache is on by default and does nothing in most CI pipelines, because the one thing it depends on — a restored `.next/cache` — is exactly what a fresh container does not have"
sidebar_label: "05 · Turbopack build caches"
sidebar_position: 11
description: "The two FileSystem cache options and their real config keys, why a containerized build gets no benefit without explicit cache restoration, the per-provider configuration, and the tri-state memory eviction setting that only affects next dev."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Turbopack FileSystem Caching](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopackFileSystemCache) (docs `lastUpdated` 2026-08-03), [Turbopack Memory Eviction](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopackMemoryEviction) (`lastUpdated` 2026-07-07) and [CI build caching](https://nextjs.org/docs/app/guides/ci-build-caching) (`lastUpdated` 2025-04-22).
> Target: **Next.js 16.3.4**, Turbopack. Documentation-verified; **no sandbox run**, **no timings**.

**This is the only cache in the chapter that has nothing to do with your users. Everything else here caches data or rendered output at request time; the Turbopack FileSystem cache caches *compilation work* between runs of `next dev` and `next build`, and it is enabled by default in 16.3. The reason it deserves a page rather than a footnote is that its benefit is conditional on something outside Next.js entirely: the cache lives in `.next/cache`, and it only helps if that directory survives from one build to the next. A containerized CI build starts from a clean layer, so by default it writes a cache nobody will ever read — paying the write cost on every build and collecting none of the benefit. The framework cannot detect this and does not warn about it.**

## 🔴 Two options, not one — and the names are not what you have read

The documentation page is titled *Turbopack FileSystem Caching*, and it is common to see that title quoted as though it were a config key. **There is no `turbopackFileSystemCache` option.** There are two, both under `experimental`:

```ts
// next.config.ts — these are the defaults; you do not need to write this
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    turbopackFileSystemCacheForDev: true,
    turbopackFileSystemCacheForBuild: true,
  },
}

export default nextConfig
```

> *"Two options control the cache, one for `next dev` and one for `next build`. Both are enabled by default"*

| Option | Default | What it caches | Where |
|---|---|---|---|
| `turbopackFileSystemCacheForDev` | `true` | *"Turbopack's work for `next dev`"* — *"Restarting the dev server reuses the previous compilation."* | `.next/dev/cache/turbopack` |
| `turbopackFileSystemCacheForBuild` | `true` | *"Turbopack's work for `next build`"* — *"Subsequent builds start warm."* | `.next/cache/turbopack` |

Note that they write to **different directories**. The dev cache is under `.next/dev/cache`; only the build cache is in `.next/cache`, which is the directory every CI caching guide talks about. Caching `.next/cache` in CI therefore does nothing for dev — which is correct, since CI does not run `next dev`.

**Version history, and it is recent enough to matter:**

| Version | Change |
|---|---|
| `v16.3.0` | *"FileSystem caching is enabled by default for builds"* |
| `v16.1.0` | *"FileSystem caching is enabled by default for development"* |
| `v16.0.0` | *"Beta release with separate flags for build and dev"* |
| `v15.5.0` | *"Persistent caching released as experimental on canary releases"* |

So on 16.0–16.2 the build cache existed but was **off** by default. Anyone comparing build times across a 16.2 → 16.3 upgrade is measuring a default change, not only a version change.

## 🔴 The condition nobody satisfies by accident

> *"The build cache lives in `.next/cache`. Builds only get faster when that directory is restored before each build."*

> *"**Self-hosted builds**: reuse the same working directory between builds. Containerized builds start from a clean layer and do not carry `.next/cache` over unless you cache or mount it explicitly."*

That is the whole story of why "Turbopack's persistent cache is on by default" and "my CI builds are the same speed" are both true at once. A Docker build, a fresh GitHub Actions runner, any ephemeral container — all start empty. The cache is written at the end of the build and discarded with the container.

The documentation's own advice for that case is blunt, and it is a real optimisation people miss:

> *"If your build environment never preserves `.next/cache`, set `turbopackFileSystemCacheForBuild: false` to skip writing a cache that will not be read."*

```ts
// next.config.ts — for a pipeline that genuinely cannot persist .next/cache
const nextConfig: NextConfig = {
  experimental: {
    turbopackFileSystemCacheForBuild: process.env.CI !== 'true',
  },
}
```

⚠️ **The documentation gives no figure for what that write costs**, so treat turning it off as removing pointless work rather than as a quantified speedup, and measure your own pipeline if the number matters.

## Making the cache actually persist

The mechanism is your CI provider's cache, keyed so that it is restored before the build step. The directory is `.next/cache`.

> *"If your CI is not configured to persist `.next/cache` between builds, you may see a **No Cache Detected** error."*

That error message is the thing to search for — it is the framework telling you the cache was not restored.

**GitHub Actions**, the documented configuration:

```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.npm
      ${{ github.workspace }}/.next/cache
    # A new cache whenever packages or source files change.
    key: ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-${{ hashFiles('**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx') }}
    # If source changed but packages didn't, rebuild from a prior cache.
    restore-keys: |
      ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-
```

🔴 **The `restore-keys` line is the part that does the work**, and it is the part people delete. `key` includes a hash of every source file, so it changes on literally every commit — an exact-key-only configuration would miss on every build and the cache would never be read. `restore-keys` falls back to the most recent cache with a matching lockfile, which is a warm cache from the previous commit. Without it you have configured a cache that is written every build and restored never, which is indistinguishable from having no cache at all except for the storage bill.

Every other provider is the same idea against the same directory:

| Provider | Where `.next/cache` goes |
|---|---|
| **Vercel** | nothing to do — *"Next.js caching is automatically configured for you."* |
| **CircleCI** | add it to `save_cache`'s `paths` |
| **Travis CI** | `cache.directories` |
| **GitLab CI** | `cache.paths`, with `key: ${CI_COMMIT_REF_SLUG}` |
| **AWS CodeBuild** | `cache.paths` as `'.next/cache/**/*'` |
| **Bitbucket** | a `definitions.caches.nextcache` entry, referenced from the step |
| **Heroku** | a `cacheDirectories` array in `package.json` |
| **Azure Pipelines** | a `Cache@2` task before the build task |
| **Jenkins** | Job Cacher's `arbitraryFileCache` |
| **Netlify** | `@netlify/plugin-nextjs` |

⚠️ For **Docker**, none of the above applies — a `RUN next build` inside an image build has no provider cache. The equivalent is a build-time cache mount (BuildKit) or building outside the image, and neither is covered by the Next.js documentation. Treat it as your platform's problem rather than a framework setting.

## Memory eviction is a different feature with a narrower scope

`turbopackMemoryEviction` is frequently mentioned alongside the FileSystem cache as though the two were a pair of on/off switches. They are not: this one is **tri-state**, and it only does anything in development.

> *"`turbopackMemoryEviction` controls whether Turbopack reclaims memory while the persistent (FileSystem) cache is enabled. After Turbopack writes a snapshot of its cache to disk, it can 'evict' the in-memory copies of that data and reload them from disk on demand."*

| Value | Behaviour, verbatim |
|---|---|
| `false` | *"never evict. Cached data stays in memory for the lifetime of the process."* |
| `'auto'` **(default)** | *"evict after a snapshot only once enough memory has been allocated since the last eviction to make it worthwhile. Leverages thresholds and memory pressure feedback from the operating system."* |
| `'full'` | *"evict all possible data from memory every time we save to disk."* |

```ts
// next.config.ts — 'auto' is already the default
const nextConfig: NextConfig = {
  experimental: {
    turbopackMemoryEviction: 'auto',
  },
}
```

🔴 **It does nothing during `next build`:**

> *"This option only has an effect in `next dev` sessions when the FileSystem Cache is enabled, since eviction relies on data already being persisted to disk. It is experimental and under active development."*

Two conditions, both required: `next dev`, and the FileSystem cache on. Setting `'full'` hoping to reduce build-server memory is configuring nothing. And note it is **experimental and under active development** — the value set is a candidate to change between minor versions, so pin the behaviour you rely on to a version in your own notes.

The trade it represents is the ordinary one: `'full'` reclaims the most memory and pays for it by reloading from disk on demand; `false` keeps everything resident and is fastest until the machine runs out of RAM. `'auto'` exists because the right answer depends on how much memory the machine has, which the operating system knows and you do not.

## ⚠️ On the performance figures

You will see two numbers quoted for these features — a multiple for CI build speed and a percentage for dev memory. **Neither appears in either API reference page.** The FileSystem caching page describes the effect qualitatively (*"can greatly speed up subsequent builds and dev sessions"*) and gives no figure; the memory eviction page gives none either, describing `'auto'`'s behaviour in terms of *"thresholds and memory pressure feedback from the operating system"* without quantifying any of it.

They may well be accurate — release announcements carry numbers that reference pages do not — but they are not documented where the feature is specified, and a speedup multiple is meaningless without the project and pipeline it was measured on. This page therefore states the mechanism and declines to repeat the numbers. **If build time is the reason you are here, measure your own pipeline**: the variable that dominates is not the flag, which is already on, but whether `.next/cache` is being restored at all.

## Gotchas

**★ Symptom: the build cache is on by default, and CI build times did not change.** Cause: `.next/cache` is not being restored before the build, so every run starts cold. Containerized builds start from a clean layer and carry nothing over unless you cache or mount it explicitly. Fix: configure your provider's cache against `.next/cache`; look for the **No Cache Detected** error, which is the framework saying exactly this.

**★ Symptom: you configure `actions/cache` and it still misses on every build.** Cause: the documented `key` includes a hash of every source file, so it changes on every commit — without `restore-keys` there is never a matching key to restore. Fix: keep the `restore-keys` fallback, which matches the most recent cache with the same lockfile:

```yaml
restore-keys: |
  ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-
```

**★ Symptom: you set `turbopackFileSystemCache: true` and nothing happens.** Cause: that is not a config key — it is the documentation page's title. The options are `experimental.turbopackFileSystemCacheForDev` and `experimental.turbopackFileSystemCacheForBuild`. Fix: use the real names, and note both are already `true` by default in 16.3, so in most cases there is nothing to set.

**★ Symptom: you cache `.next/cache` in CI and dev server startup is unchanged locally.** Cause: they are different directories — dev caches to `.next/dev/cache/turbopack`, builds to `.next/cache/turbopack`. Fix: nothing to fix; this is correct. CI does not run `next dev`, so its cache has nothing to contribute to your local dev startup.

**★ Symptom: `turbopackMemoryEviction: 'full'` does not reduce build-server memory.** Cause: the option has an effect only in `next dev`, and only when the FileSystem cache is enabled — eviction depends on the data already being on disk. Fix: it is the wrong lever for build memory. Nothing in these two pages addresses `next build` memory.

**★ Symptom: build times improved dramatically after upgrading and you attribute it to code changes.** Cause: FileSystem caching for builds became a default in **16.3.0**; on 16.0–16.2 it existed but was off. An upgrade across that boundary changes the default. Fix: compare like with like before concluding — check the version boundary before crediting a refactor.

**★ Symptom: a pipeline that cannot persist any directory still pays a cache-write cost every build.** Cause: the build cache is written whether or not anything will read it. Fix: turn it off where it cannot help, which the documentation recommends explicitly:

```ts
experimental: {
  turbopackFileSystemCacheForBuild: process.env.CI !== 'true',
}
```

**★ Symptom: eviction behaviour changes between two patch releases and breaks a memory assumption.** Cause: `turbopackMemoryEviction` is documented as experimental and under active development, and it shipped in 16.3.0. Fix: do not build capacity planning on its current behaviour; if a specific behaviour matters, record the version you validated it against.

## Interview questions

**★ Turbopack's build cache is on by default in 16.3. Why do most CI pipelines get no benefit from it?**
Because the benefit depends on a condition outside Next.js: the cache lives in `.next/cache`, and builds only get faster when that directory is restored before each build. Self-hosted builds that reuse a working directory get it for free. Containerized builds — which is most CI — start from a clean layer and carry nothing over unless the pipeline caches or mounts the directory explicitly. So the default writes a cache at the end of every build that is then discarded with the container. The framework cannot detect the situation, though it does surface a *No Cache Detected* error, and the documentation recommends setting `turbopackFileSystemCacheForBuild: false` in an environment that can never preserve the directory, so you at least stop paying the write cost.

**★ Why does a GitHub Actions cache configuration for Next.js need `restore-keys`?**
Because the documented `key` includes a hash of every source file, so it is different on every commit. An exact-match-only configuration would therefore never find a matching cache and would miss on every single build — writing a new cache each time and reading none, which is worse than no cache because it also costs storage. `restore-keys` provides a prefix fallback keyed on the lockfile hash alone, so a build restores the most recent cache from a run with the same dependencies, which is a warm cache from the previous commit. The full key exists to produce a fresh, precisely-matched entry; the restore key exists to make the cache actually useful in between.

**★ What is `turbopackMemoryEviction` and what does it not do?**
It controls whether Turbopack reclaims memory once its cache has been snapshotted to disk — the in-memory copies can be evicted and reloaded on demand. It is tri-state rather than boolean: `false` never evicts, `'auto'` (the default) evicts after a snapshot once enough memory has been allocated to make it worthwhile using OS memory-pressure feedback, and `'full'` evicts everything on every disk save. What it does not do is affect `next build` — the documentation limits its effect to `next dev` sessions with the FileSystem cache enabled, because eviction depends on the data already being persisted. So it is not a lever for build-server memory, which is the most common reason people reach for it.

**★ Someone quotes "5.5× faster CI builds" for this feature. How should you respond?**
That the figure is not in the API reference for the feature, so it should not be treated as a documented specification. The FileSystem caching page describes the effect only qualitatively and gives no number; the memory eviction page gives none either. A figure like that may well be real and from a release announcement, but a build-time multiple is meaningless without the project, the pipeline and the baseline it was measured against — and for most teams the dominant variable is not the flag, which is already enabled by default, but whether `.next/cache` is restored at all. The useful response is to measure your own pipeline, and to check the cache is actually being restored before attributing anything to the feature.

**Why do the dev and build caches live in different directories, and what follows from that?**
`next dev` caches to `.next/dev/cache/turbopack` and `next build` to `.next/cache/turbopack`, because they are separate options covering separate workloads with separate lifetimes — a dev cache is useful across restarts on one machine, a build cache is useful across runs on a build agent. What follows practically is that the CI guidance to cache `.next/cache` covers builds only and contributes nothing to a developer's local dev startup, which is correct since CI never runs `next dev`. It also means a `rm -rf .next` clears both, while clearing only `.next/cache` leaves the dev cache intact — occasionally useful when trying to isolate which one is producing stale behaviour.

**How does this cache relate to the rest of the chapter's caches?**
It does not, beyond sharing the word. Every other cache in this chapter is about request-time work: `use cache` entries, prerendered HTML, the client's copy of an RSC payload — things that decide what a user waits for. The Turbopack FileSystem cache is a compilation cache, consumed by your build pipeline and your dev server, and invisible to production traffic. The distinction is worth keeping crisp because they fail in unrelated ways and are fixed by unrelated people: a stale `use cache` entry is a product bug with a lifetime and an invalidation API, while a cold Turbopack cache is a pipeline configuration issue with no user-visible symptom at all.

---

← [04 · Revalidation: every way a lifetime ends](04-revalidation-time-based-isr.md) · [Chapter index](01-explanation.md) · Next → [06 · Milestone: cache the board shell](06-project-milestone-cache-sprintdesks-team-dashboard-shell-wit.md)
