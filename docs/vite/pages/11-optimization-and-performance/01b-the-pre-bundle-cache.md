---
title: "The pre-bundle cache in node_modules/.vite is keyed on exactly four inputs, and the second cache — the browser's immutable one — is the reason your fix appears not to have applied"
sidebar_label: "01b · The pre-bundle cache"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Dependency Pre-Bundling → Caching](https://vite.dev/guide/dep-pre-bundling), [Dep Optimization Options](https://vite.dev/config/dep-optimization-options), [Performance](https://vite.dev/guide/performance), [Configuring Vite](https://vite.dev/config/). Documentation-validated; **no sandbox run, no timings, no benchmarks**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ The Pre-Bundle Cache and What Invalidates It

**There are two caches between your `node_modules` and the module the browser executes, they invalidate on different events, and almost every "I changed it and nothing happened" report in a Vite project is one of them.** The filesystem cache in `node_modules/.vite` holds the pre-bundled dependencies and is keyed on four documented inputs — none of which is "a file inside `node_modules` changed." The browser cache holds the served result under `max-age=31536000,immutable`, which the docs describe as never hitting the dev server again. Knowing which one you are fighting is the whole skill.

## 1. Under-The-Hood Mechanics

### Cache one — the filesystem cache

> *"Vite caches the pre-bundled dependencies in `node_modules/.vite`. It determines whether it needs to re-run the pre-bundling step based on a few sources:"* — [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling)

The four inputs, quoted as printed:

> * *"Package manager lockfile content, e.g. `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lock`, `aube-lock.yaml` or `nub.lock`."*
> * *"Patches folder modification time."*
> * *"Relevant fields in your `vite.config.js`, if present."*
> * *"`NODE_ENV` value."*

> *"The pre-bundling step will only need to be re-run when one of the above has changed."*

⚠️ I could not identify what package managers `aube-lock.yaml` and `nub.lock` belong to; the list is reproduced verbatim from the documentation rather than filtered to names I recognise.

🔴 **Read the negative space in that list.** It does not contain "the mtime of any file in `node_modules`", and it does not contain "the contents of the installed package". So:

```text
edit node_modules/some-pkg/dist/index.js by hand
        │
        ├── lockfile content            unchanged ─┐
        ├── patches folder mtime        unchanged  │  → cache considered VALID
        ├── relevant vite.config fields unchanged  │  → your edit is never seen
        └── NODE_ENV                    unchanged ─┘
```

That is not a bug. It is the direct consequence of a cache key that deliberately tracks *declared* dependency state rather than filesystem state, because stat-ing a real `node_modules` tree on every start would defeat the purpose.

Two forced-invalidation routes are documented:

> *"If for some reason you want to force Vite to re-bundle deps, you can either start the dev server with the `--force` command line option, or manually delete the `node_modules/.vite` cache directory."*

and the config-file equivalent, `optimizeDeps.force`:

> *"Set to `true` to force dependency pre-bundling, ignoring previously cached optimized dependencies."* — [Dep Optimization Options](https://vite.dev/config/dep-optimization-options)

⚠️ `optimizeDeps.force: true` is a permanent setting in a file. It forces a re-bundle on *every* start, not once. `--force` is the one-shot form and is what you want for a debugging session.

### Cache two — the browser's

> *"Resolved dependency requests are strongly cached with HTTP headers `max-age=31536000,immutable` to improve page reload performance during dev. Once cached, these requests will never hit the dev server again. They are auto invalidated by the appended version query if a different version is installed (as reflected in your package manager lockfile)."*

`immutable` with a one-year max-age is an instruction to the browser that the response will never change at this URL, so a conforming browser will not revalidate — not even on a normal reload. Invalidation is by URL, via the appended version query, and the source of truth for that version is again the lockfile.

The documented debugging procedure defeats both caches in the right order:

> 1. *"Temporarily disable cache via the Network tab of your browser devtools."*
> 2. *"Restart Vite dev server with the `--force` flag to re-bundle the deps."*
> 3. *"Reload the page."*

### The cost of leaving devtools' cache disabled

The same strong caching is why the performance guide asks you to turn that checkbox back off:

> *"The Vite dev server does hard caching of pre-bundled dependencies and implements fast 304 responses for source code. Disabling the cache while the Browser Dev Tools are open can have a big impact on startup and full-page reload times. Please check that \"Disable Cache\" isn't enabled while you work with the Vite server."* — [Performance](https://vite.dev/guide/performance)

Note the asymmetry in that sentence: dependencies are *hard* cached, source files get *304s*. Only the first is destroyed by the checkbox, but it is the expensive one.

### A third `node_modules` directory that is not this cache

The config loader writes somewhere else entirely:

> *"By default, Vite uses Rolldown to bundle the config into a temporary file and load it."* — with the bundled output written to `node_modules/.vite-temp` — [Configuring Vite](https://vite.dev/config/)

`.vite-temp` is config-loading scratch space. Deleting `node_modules/.vite` does not touch it, and deleting `.vite-temp` does not invalidate the dependency cache.

---

## 2. Real-World Engineering Scenario

**Scenario**: a developer patches a bug in a dependency and cannot get the change to appear.

They open `node_modules/@acme/date-utils/dist/index.js`, fix the off-by-one, save, and reload. Nothing. They restart the dev server. Still nothing. They restart their machine, which is the point at which the afternoon is gone.

Both caches are working exactly as documented. The filesystem cache did not invalidate, because a hand edit inside `node_modules` changes none of the four keyed inputs. And even after the server was restarted, the browser had `@acme/date-utils` under `max-age=31536000,immutable`, so the request that would have picked up a fresh bundle was never made.

The documented three-step recipe resolves it — disable cache in devtools, restart with `--force`, reload — and the durable fix is to stop hand-editing `node_modules` and use the package manager's patch mechanism instead, because *"Patches folder modification time"* **is** one of the four keyed inputs.

---

## 3. Production-Grade Code Example

```bash
# One-shot invalidation for a debugging session. Preferred over editing config.
vite --force

# The nuclear equivalent, when you want to be certain nothing survived.
rm -rf node_modules/.vite && vite

# The config-loader scratch directory. Unrelated to the dep cache; clear it when a
# stale bundled config is suspected, not when a dependency looks stale.
rm -rf node_modules/.vite-temp
```

```typescript
// vite.config.ts — the permanent form. Deliberate, and rarely what you want.
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    // 🔴 Re-bundles on EVERY start, not once. Correct for a throwaway reproduction
    // repo or a benchmark harness that must not read a warm cache; wrong for daily
    // development, where it pays the cold-start cost every single time.
    force: process.env.VITE_FORCE_OPTIMIZE === '1',
  },
});
```

```yaml
# .github/workflows/ci.yml — caching the pre-bundle across CI runs.
# ⚠️ The Vite docs do not prescribe a CI recipe. This key is DERIVED from the four
# documented invalidation inputs: lockfile content, patches mtime, vite config, NODE_ENV.
# If your invalidation inputs differ (e.g. no patches directory), drop the term.
- uses: actions/cache@v4
  with:
    path: node_modules/.vite
    key: vite-deps-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml', 'patches/**', 'vite.config.ts') }}-${{ env.NODE_ENV }}
```

```gitignore
# .gitignore — the cache is machine-local build output, never committed.
node_modules/
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: `--force` on the wrong process

```bash
# ❌ WRONG: the dep cache belongs to the dev server. Forcing a build does nothing
# for it, because pre-bundling "only applies in development mode".
vite build --force

# ✅ CORRECT: force the dev server.
vite --force
```

### ⚠️ Pitfall 2: shipping `optimizeDeps.force: true` in a committed config

It looks like a fix for a flaky cache and is really a permanent tax on every teammate's cold start, applied silently. If a cache is genuinely going stale on your project, the cause is an invalidation input the four-item list does not cover — hand-edited `node_modules`, a symlinked package whose target changed, a generated config value — and the durable fix addresses that, not the cache.

### ⚠️ Pitfall 3: assuming a hard reload defeats `immutable`

A hard reload (`Ctrl`+`Shift`+`R`) is a browser-specific behaviour, not a spec guarantee, and the documented procedure does not rely on it — it says to disable the cache in the Network tab. Rely on the documented step; treat a hard reload as an unreliable shortcut.

### ⚠️ Pitfall 4: caching `node_modules/.vite` in CI for a job that only builds

`vite build` does not read the dep cache, because pre-bundling is dev-only. Caching that directory for a build-only job is pure overhead: a restore, a save, and no hit. It pays off only for jobs that actually start a dev server — end-to-end tests against `vite dev`, or a component-test runner that boots one.

---

## Gotchas

**★ Symptom: you edit a file inside `node_modules` and the change never appears.** Cause: none of the four cache inputs changed, so the pre-bundle is considered valid; and the browser holds the previous result under `max-age=31536000,immutable`. Fix: the documented sequence, in order — disable cache in the devtools Network tab, `vite --force`, reload. Then stop hand-editing and use a patch file, since *"Patches folder modification time"* is a tracked input.

**★ Symptom: switching git branches produces a broken import until you restart with `--force`.** Cause: the branches have different lockfile content, which does invalidate — but only when Vite next starts. A running server that was started on the old branch keeps serving the old pre-bundle. Fix: restart the dev server after a branch switch that changes the lockfile. Building this into a `postcheckout` hook is possible but noisy; restarting is the honest habit.

**★ Symptom: `NODE_ENV=test` in one terminal and nothing in another produce different pre-bundles.** Cause: `NODE_ENV` is literally one of the four keyed inputs. Fix: this is correct behaviour, not a bug — but it does mean a test runner and a dev server disagreeing on `NODE_ENV` cannot share the cache and will invalidate each other. Give the test runner its own `cacheDir` if that thrash is measurable, or set `NODE_ENV` consistently.

**★ Symptom: CI restores a `node_modules/.vite` cache and it never hits.** Cause: the cache key is missing one of the four inputs — most often `vite.config.ts`, which changes far more often than the lockfile. Fix: hash every documented input into the key, as in the workflow snippet above. A key that ignores an input Vite tracks produces a restored-but-immediately-discarded cache, which is strictly worse than no cache.

**★ Symptom: after a `pnpm patch`, the patched behaviour still does not appear.** Cause: patches invalidate on *"Patches folder modification time"*, so the patch must actually be written into the patches directory — applying a patch by editing files in place changes no mtime that Vite watches. Fix: complete the `pnpm patch-commit` step so the patch file lands, then restart.

**★ Symptom: clearing `node_modules/.vite-temp` did not fix a stale dependency.** Cause: wrong directory. `.vite-temp` is where the config loader writes its bundled config; the dependency cache is `node_modules/.vite`. Fix: clear `node_modules/.vite`. Clear `.vite-temp` only when the *config* looks stale.

**★ Symptom: the dev server feels slow all day and reloads are heavy.** Cause: "Disable Cache" left ticked in devtools. Vite hard-caches pre-bundled dependencies precisely so reloads are cheap, and the docs call the impact of disabling that *"big"* on startup and full-page reload times. Fix: untick it outside of a dependency-debugging session.

**★ Symptom: two developers on the same commit get different cold-start behaviour.** Cause: one has a warm `node_modules/.vite` and one does not — the directory is machine-local and never committed. Fix: nothing to fix; but it does mean any cold-start comparison must state its cache state. This is the most common way an informal "it got faster" claim is wrong.

## Interview questions

**★ What invalidates Vite's dependency pre-bundle cache, and what does the answer tell you about the design?**
Four inputs: lockfile content, patches-folder modification time, relevant fields of the Vite config, and `NODE_ENV`. Every one of them is a *declaration* of what the dependency set should be, not an observation of what is currently on disk. That is deliberate — checking the actual contents of `node_modules` would mean walking a very large tree on every start, which is the cost pre-bundling exists to avoid. The consequence you must know in practice is that a hand edit inside `node_modules` is invisible to the cache, which is why `--force` exists and why patch files are the supported way to change a dependency.

**★ A colleague says their fix to a dependency "isn't taking" even after restarting Vite. Walk through the diagnosis.**
Two caches, in order. First the server-side one: restarting Vite does not re-bundle, because a restart is not an invalidation input — so the server hands back the same pre-bundle it had before. Second the browser's: dependency responses are served with `max-age=31536000,immutable`, and the docs say *"Once cached, these requests will never hit the dev server again"*, so even a fresh pre-bundle would not be fetched. The documented procedure defeats them in the right order — disable cache in devtools, restart with `--force`, reload — and the reason the order matters is that forcing a re-bundle while the browser is still serving from its own cache produces no visible change and makes you think `--force` did not work.

**★ Why is `optimizeDeps.force: true` in a committed config almost always wrong?**
Because it converts a one-off diagnostic into a permanent cost for everyone. `--force` on the command line means "this run, ignore the cache"; `force: true` in config means "every run, ignore the cache", so every teammate pays a full pre-bundle on every cold start forever. It also hides the real defect. A cache that keeps going stale is telling you something is changing that the four documented inputs do not track — usually direct edits in `node_modules`, or a linked package whose contents move without the lockfile moving — and that is what should be fixed.

**★ Is caching `node_modules/.vite` in CI worth it?**
Only for jobs that start a dev server. Pre-bundling is dev-only, so a job that runs `vite build` will restore the cache, never read it, and save it again — cost with no benefit. For a job that boots `vite dev` for end-to-end or component tests, it is worth it, and the key must hash every input Vite itself tracks: lockfile, patches directory, the Vite config file, and `NODE_ENV`. A key that omits the config file will restore a cache that Vite then discards, which is the worst of both.

**★ What does `immutable` in the dev server's cache header actually promise, and why is it safe here?**
It promises the response body at that URL will never change, so a conforming browser may skip revalidation entirely for the lifetime of the `max-age`. It is safe because Vite does not reuse the URL: the dependency request carries an appended version query, and the docs say those are *"auto invalidated by the appended version query if a different version is installed (as reflected in your package manager lockfile)."* A new version is a new URL, so there is no stale-content window in the normal flow. The window only opens when the *content* changes without the *version* changing — which is precisely the hand-edited-`node_modules` case.

---

← [01a · Dependency pre-bundling](01a-dependency-pre-bundling.md) · [Vite overview](../../README.md) · Next → [01c · optimizeDeps include/exclude](01c-optimizedeps-include-and-exclude.md)
