---
title: "preserveSymlinks decides whether a linked package's file identity is its link path or its real path, and that single choice cascades into server.fs.allow 403s and pre-bundle cache misses that look unrelated"
sidebar_label: "01e · preserveSymlinks & linked packages"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the Vite documentation — [Shared Options](https://vite.dev/config/shared-options), [Server Options](https://vite.dev/config/server-options), [Troubleshooting](https://vite.dev/guide/troubleshooting). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ preserveSymlinks & linked packages

**A symlinked package — from `npm link`, a pnpm workspace, or a manually vendored path — gives Vite two different notions of "where this file is," and `resolve.preserveSymlinks` decides which one wins.** That choice is not cosmetic: it determines which directory `server.fs.allow` has to permit, whether the dev server's file-identity cache treats two import paths as the same module or two different ones, and whether a package linked from outside the project root needs explicit `optimizeDeps` attention to be pre-bundled at all. Every symptom in this section traces back to that one setting, even when the error message never mentions it.

## What `preserveSymlinks` actually toggles

> *"Enabling this setting causes vite to determine file identity by the original file path (i.e. the path without following symlinks) instead of the real file path (i.e. the path after following symlinks)."* — [Shared Options](https://vite.dev/config/shared-options)

Type: `boolean`, default `false`. With the default, a symlink at `node_modules/@acme/ui-kit` pointing at `../../packages/ui-kit` is *followed* — Vite treats every file inside it by its real, resolved location under `packages/ui-kit`, not by the `node_modules/@acme/ui-kit` path that was actually imported. Enabling `preserveSymlinks` keeps the link path as the file's identity instead — the same file is now known to Vite by the path it was imported through, not the path it physically lives at.

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    preserveSymlinks: false, // default — identity follows the REAL path
  },
});
```

This is the same axis Node.js itself exposes via `--preserve-symlinks`, and the same one esbuild and webpack expose under their own names — Vite's option is one instance of a resolution-identity question every symlink-aware tool has to answer the same way, not a Vite-specific invention.

## Why the default (following symlinks) is usually what a monorepo wants — and when it isn't

Following the real path means a package linked into `node_modules` from elsewhere in the same monorepo is treated as living at its real source location. HMR watches the real file, TypeScript's own module resolution (which typically also follows symlinks by default) agrees with Vite about where the file is, and a single physical file imported through two different link paths is recognized as the same module rather than two.

That last point is where the default can bite in a *different* way than `preserveSymlinks: true` would: if two separate symlinks in the tree point at the same real directory, following symlinks collapses them to one identity — which is correct for module deduplication, but means any packaging or dependency-graph logic that expects "one entry per link path" instead sees "one entry per real path." A package intentionally linked twice, under two different names, for two different consumers, is exactly the case where the default's collapsing behavior is not what was intended, and `preserveSymlinks: true` restores the "each link path is its own identity" model.

```typescript
// vite.config.ts — preserveSymlinks: true, for the (uncommon) case where two
// differently-named links to the same physical package must be treated as
// separate module identities rather than collapsed to one
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
});
```

## `server.fs.allow` — the dev server's own, separate boundary

Symlinks interact with a completely different guard: the dev server refuses to *serve* files outside a directory allowlist, independent of whether resolution succeeded.

> *"Restrict serving files outside of workspace root."* — [Server Options](https://vite.dev/config/server-options), `server.fs.strict` (default `true`, enabled since Vite 2.7)

> *"Restrict files that could be served via `/@fs/`. When `server.fs.strict` is set to `true`, accessing files outside this directory list that aren't imported from an allowed file will result in a 403."* — [Server Options](https://vite.dev/config/server-options), `server.fs.allow`

Vite tries to make this transparent for the common monorepo shape by auto-detecting a workspace root:

> Vite automatically detects workspace roots by checking for a `workspaces` field in `package.json`, or a `lerna.json`, `pnpm-workspace.yaml`, or similar file.

This is exactly why a symlinked package that lives *inside* the detected workspace usually just works, and one that lives *outside* it — a package linked in from a completely separate checkout via `npm link`, for instance — does not:

```typescript
// vite.config.ts — a package is linked in from OUTSIDE the detected workspace root
import { defineConfig, searchForWorkspaceRoot } from 'vite';

export default defineConfig({
  server: {
    fs: {
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        '/home/dev/oss/some-shared-lib', // the npm-linked package's real location
      ],
    },
  },
});
```

> *"When `server.fs.allow` is specified, the auto workspace root detection will be disabled."* — [Server Options](https://vite.dev/config/server-options)

That last sentence is a trap in exactly the shape shown above: writing `server.fs.allow` at all turns off the automatic detection that was previously covering the rest of the monorepo, so the explicit list has to re-include the workspace root itself — `searchForWorkspaceRoot(process.cwd())` is precisely the documented helper for restating it, not an optional flourish.

```js
// vite.config.ts — the shorthand form the docs also show, for "one level up"
export default defineConfig({
  server: {
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..'],
    },
  },
});
```

## `npm link` and the pre-bundle cache — a documented, separate gap

Linked packages hit a second, unrelated wall: the dependency pre-bundle cache's invalidation logic does not know about `npm link` at all.

> *"The hash key used to invalidate optimized dependencies depends on the package lock contents, the patches applied to dependencies, and the options in the Vite config file that affects the bundling of node modules. This means that Vite will detect when a dependency is overridden using a feature as npm overrides, and re-bundle your dependencies on the next server start. Vite won't invalidate the dependencies when you use a feature like npm link. In case you link or unlink a dependency, you'll need to force re-optimization on the next server start by using `vite --force`. We recommend using overrides instead, which are supported now by every package manager (see also pnpm overrides and yarn resolutions)."* — [Troubleshooting](https://vite.dev/guide/troubleshooting)

This is the single most concrete, most actionable fact in this whole page: `npm link`/`npm unlink` are invisible to the cache key, full stop, no matter what `preserveSymlinks` or `server.fs.allow` are set to. `vite --force` is the documented, unconditional fix, and the documentation's own preference is to avoid needing it at all by using package-manager overrides instead of `link`.

```bash
# after `npm link some-shared-lib` or `npm unlink some-shared-lib`
vite --force
```

```json
// package.json — the documented alternative to npm link, which DOES invalidate
// the pre-bundle cache correctly because it changes the lockfile
{
  "overrides": {
    "some-shared-lib": "file:../some-shared-lib"
  }
}
```

## pnpm workspaces — the usual case where none of this needs manual attention

A pnpm workspace package is itself a symlink from the consuming package's `node_modules` into the workspace's own package directory, and pnpm's `pnpm-workspace.yaml` is one of the files Vite's auto workspace-root detection explicitly looks for. In the common case — the workspace package lives inside the monorepo, `server.fs.allow` was never set explicitly, and the package is a normal dependency listed in `package.json` rather than something added via a separate `npm link` step — the default `preserveSymlinks: false`, the automatic workspace-root detection, and the lockfile-driven pre-bundle cache key all agree with each other with no manual configuration at all. The manual attention in this page's other sections is specifically for the cases that fall outside that default shape: a link from outside the detected workspace, or a link added via `npm link` rather than through the package manager's own workspace/lockfile mechanism.

## Gotchas

**★ Symptom: a workspace package works fine when it's a normal dependency, but the moment it's connected via `npm link` for local development, changes to it stop showing up without a manual restart-and-force.** Cause: documented, explicit gap — *"Vite won't invalidate the dependencies when you use a feature like npm link"* — the pre-bundle cache key tracks the lockfile and config, and `npm link` changes neither. Fix: `vite --force` after every link/unlink, or switch to a package-manager override (`overrides`/`resolutions`) which does change the lockfile and does invalidate correctly.

**★ Symptom: importing a package linked in from a directory completely outside the monorepo throws a 403 from the dev server, even though module resolution itself succeeded.** Cause: `server.fs.strict` (default `true`) restricts what the dev server will actually *serve* via `/@fs/`, independent of resolution, and the linked package's real directory is outside both the detected workspace root and any explicit `server.fs.allow` entry. Fix: add the package's real path to `server.fs.allow` — and if `server.fs.allow` is being set at all, re-include the workspace root via `searchForWorkspaceRoot(process.cwd())`, since setting it explicitly disables the automatic detection.

**★ Symptom: after adding `server.fs.allow` to permit one external linked package, files elsewhere in the monorepo that used to resolve fine now 403 too.** Cause: *"When `server.fs.allow` is specified, the auto workspace root detection will be disabled"* — the explicit list replaced the automatic one rather than extending it. Fix: include `searchForWorkspaceRoot(process.cwd())` alongside the new entry, not instead of it.

**★ Symptom: two symlinks pointing at the same physical package, imported under two different specifiers, are being treated as one module — state set through one import is visible through the other, which the code did not expect.** Cause: default `preserveSymlinks: false` follows the real path, so both link paths resolve to the identical file identity and therefore the identical module instance. Fix: if the two link paths are genuinely meant to be independent module instances, set `resolve.preserveSymlinks: true` so identity is based on the link path actually imported, not the shared real path.

**★ Symptom: enabling `preserveSymlinks: true` to solve the above caused an unrelated symlinked monorepo package to suddenly get served or watched incorrectly.** Cause: `preserveSymlinks` is a single, project-wide switch — it changes file identity for every symlink Vite encounters, not just the one pair you meant to un-collapse. Fix: there is no per-alias or per-package scoping for this option; if only one pair of links needs independent identities, consider restructuring those two links (e.g. via distinct package names/directories) rather than flipping a global setting for one case.

## Interview questions

**★ What does `resolve.preserveSymlinks: true` actually change, mechanically, and why would a monorepo ever want it?**
It changes which path Vite treats as a file's identity when the file is reached through a symlink — the link path itself, instead of the real path the link points at (the default). Most monorepos want the default, because following the real path means HMR, TypeScript, and Vite all agree on where a linked package physically lives, and two different link paths to the same real file collapse to one module instance, which is what you want for a shared dependency. The case for `preserveSymlinks: true` is the opposite of that last point: when two distinct link paths pointing at the same real package are supposed to be treated as two separate module instances rather than deduplicated to one.

**★ A package works when imported normally but 403s when `npm link`-ed in from outside the repo. Is this a `resolve` problem or a `server` problem?**
A `server` problem, specifically `server.fs.strict`/`server.fs.allow` — module resolution can succeed perfectly (Vite knows exactly which file the import points at) while the dev server still refuses to serve that file because it sits outside the directories `server.fs.allow` (or the auto-detected workspace root) permits. The fix is adding the linked package's real path to `server.fs.allow`, not adjusting anything under `resolve`.

**★ Why doesn't `vite --force` need to be part of every `npm link` workflow if the docs recommend package-manager overrides instead?**
Because overrides (`overrides` in npm, `resolutions` in Yarn, pnpm's own `overrides`) work by rewriting the dependency's resolved location as part of the normal install and lockfile, which the pre-bundle cache's key already tracks — a changed lockfile is exactly one of the documented cache-invalidation inputs. `npm link` bypasses the lockfile entirely, which is precisely why the cache has no way to notice it changed and why `--force` becomes a required manual step every single time, rather than a one-off.

**★ A monorepo sets `server.fs.allow: ['/absolute/path/to/one/linked/package']` to fix a 403, and afterward files elsewhere in the same monorepo start 403ing too. What's the mechanism, and what's the fix?**
Setting `server.fs.allow` explicitly disables Vite's automatic workspace-root detection — the documentation states this outright — so the new, narrow allowlist replaces the broader automatic one rather than adding to it. The fix is to include the workspace root explicitly in the same list, using the documented `searchForWorkspaceRoot(process.cwd())` helper, alongside the specific linked-package path that prompted the change in the first place.

---

← [01d · resolve.dedupe](01d-resolve-dedupe.md) · [Vite overview](../../README.md) · Next → [01f · Aliasing to stubs & monorepo source](01f-aliasing-stubs-and-monorepo-source.md)
