---
title: "dist/ is not an arbitrary bag of files — outDir, assetsDir, emptyOutDir and the hashed filenames all exist to make a deploy either atomic and cacheable, or a landmine"
sidebar_label: "01a · The shape of dist/"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [Build Options](https://vite.dev/config/build-options), [Building for Production](https://vite.dev/guide/build), [CLI](https://vite.dev/guide/cli). Documentation-validated; **no sandbox run, no timings, no byte counts**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ The shape of `dist/`

**Every file `vite build` writes ends up under one root, and the three options that control that root — `outDir`, `assetsDir`, `emptyOutDir` — exist because a deploy pipeline has to answer three questions before it uploads anything: where do the files go, how are they organized once they get there, and what happens to whatever was there before.** Get any of the three wrong and the failure is not a build error — it's a runtime one, discovered by whoever deploys next.

## `build.outDir` — where the build goes

> *"Specify the output directory (relative to [project root](https://vite.dev/guide/#index-html-and-project-root))."*

Default is `dist`. It is relative to the **project root**, not to `vite.config.ts`'s own location if you've moved that with `root` — a config that sets both `root` and `outDir` needs `outDir` to be a path that makes sense from the new root, not from the config file's directory.

```ts
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'build', // e.g. to match a CRA-era deploy pipeline that expects build/
  },
});
```

The CLI equivalent is `vite build --outDir <dir>`, documented identically in the [CLI reference](https://vite.dev/guide/cli) as *"Output directory (default: `dist`)"* — and it exists on `vite preview` too, for the reason covered in **[01c](01c-vite-preview-is-not-a-production-server.md)**: preview has to know where to find the files it's serving if they aren't at the default location.

## `build.assetsDir` — how the output is organized under `outDir`

> *"Specify the directory to nest generated assets under (relative to `build.outDir`. This is not used in [Library Mode](https://vite.dev/guide/build#library-mode))."*

Default is `assets`. Everything Vite hashes and emits from the module graph — JS chunks, CSS, images pulled in through imports rather than `public/` — lands under `<outDir>/<assetsDir>/`, while `index.html` and anything copied verbatim from `public/` (see **[01b](01b-public-directory-and-publicdir.md)**) sit at the top of `outDir` itself. That split is exactly what makes the caching split in **[01f](01f-caching-strategy-and-library-mode-deployment.md)** possible: a single path prefix (`/assets/`) is a stable target for a cache-control rule, independent of what any individual file inside it is named.

```nginx
# nginx.conf — a cache rule that only works because assetsDir gives it a stable prefix
location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}
```

`build.assetsInlineLimit` interacts with this directly: assets under the 4 KiB default threshold never reach `assetsDir` at all — they're inlined as base64 `data:` URLs into the referencing CSS or JS instead, trading one fewer HTTP request for a larger transferred file. `assetsInlineLimit: 0` disables inlining outright, which is occasionally the right call when a CDN downstream is doing its own image processing and needs a real file to fetch, not a data URI. Git LFS placeholders are excluded from inlining automatically, since a placeholder file does not contain the asset it represents.

## `build.emptyOutDir` — and why it refuses outside the root

> *"By default, Vite will empty the `outDir` on build if it is inside project root. It will emit a warning if `outDir` is outside of root to avoid accidentally removing important files. You can explicitly set this option to suppress the warning. This is also available via command line as `--emptyOutDir`."*

The default is conditional, not a flat `true`: **inside** the project root, Vite empties `outDir` before every build with no prompting — a build directory is expected to be disposable, and a deploy pipeline that runs `vite build` repeatedly should never accumulate stale files from a previous build alongside the new ones. **Outside** the project root, Vite refuses to assume the same thing and warns instead, because `outDir` pointed somewhere like `../shared-output` or `/var/www/html` might not be a Vite-owned directory at all — it might contain files from something else entirely, and silently deleting them on every build is exactly the kind of mistake that is invisible until the day it deletes something that mattered.

```ts
// vite.config.ts — outDir intentionally outside the project root, e.g. writing
// straight into a monorepo's shared static-serving directory
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '../server/public',
    emptyOutDir: true, // explicit acknowledgment: yes, empty this directory every time
  },
});
```

Setting `emptyOutDir: true` explicitly is how you tell Vite "I know this is outside the root, and I still want it emptied" — it suppresses the warning rather than changing the behavior, since the behavior it would otherwise warn about is the one you're now asking for. The CLI form is `vite build --emptyOutDir`, useful for a one-off manual build into a shared directory without touching the config file.

## `build.copyPublicDir` and `build.manifest` — the two knobs that finish the shape

> *"By default, Vite will copy files from the `publicDir` into the `outDir` on build. Set to `false` to disable this."*

Default `true`. Full treatment of what `public/` actually is in **[01b](01b-public-directory-and-publicdir.md)** — the deployment-relevant fact here is that this copy happens as part of the same build, into the same `outDir`, so a `dist/` tree is complete and self-contained without a separate copy step in your deploy script.

> *"Whether to generate a manifest file that contains a mapping of non-hashed asset filenames to their hashed versions, which can then be used by a server framework to render the correct asset links."*

Default `false`, path is `.vite/manifest.json` relative to `outDir` when set to `true`, or a custom string path otherwise. This is squarely a backend-integration concern — a server-rendering framework reading the manifest to know which hashed filename corresponds to `main.tsx` this build — and the full mechanics of that, along with `build.target`, `build.ssrManifest`, and the SSR/Node deployment path, are **not written yet**.

## Gotchas

**★ Symptom: a build server that runs `vite build` on every push has slowly filled its `dist/` with files from builds three deploys ago, none of which are referenced by the current `index.html`.** Cause: `outDir` was pointed outside the project root (a common monorepo pattern — building straight into a shared `server/public/` directory) and `emptyOutDir` was never set, so Vite emits its warning every build but leaves the directory untouched rather than risk deleting something unrelated. Fix: if the directory really is Vite-owned, set `build.emptyOutDir: true` explicitly, restoring the "always start clean" behavior the default gives you inside the root.

**★ Symptom: `vite build --outDir dist2` produced output at the wrong location, or overwrote an unrelated sibling directory.** Cause: `outDir` is resolved relative to the **project root**, and a project using a non-default `root` (a `src/`-style layout, a monorepo package with its own `vite.config.ts` living one level up from its actual root) has an `outDir` that doesn't mean what it looks like relative to the config file. Fix: reason about `outDir` from `root`, not from where `vite.config.ts` lives — print `resolve(root, outDir)` if there's any doubt, or use an absolute path.

**★ Symptom: a downstream cache rule keyed on a directory prefix (`/assets/*`) stopped matching anything after switching to Library Mode.** Cause: *"`assetsDir` ... is not used in Library Mode"* — a library build's output shape is flat, not nested under `assetsDir`, because the "assets" in question are the library's own JS/CSS entry files, not a graph of imported images and chunks that need organizing. Fix: a cache rule written for an application build's shape does not carry over to a library build's shape; see **[01f](01f-caching-strategy-and-library-mode-deployment.md)** for what a library's actual output looks like.

**★ Symptom: a 40 KB icon that "should" have been a separate cacheable file is showing up as an inline base64 string, bloating the JS chunk that imports it.** Cause: `build.assetsInlineLimit` defaults to 4096 bytes (4 KiB) — anything at or under that threshold is inlined regardless of file type, and a 40 KB asset is well over it, so this is more likely a *different* small asset (an SVG icon, a small PNG) crossing the threshold than the one you're looking at. Fix: check the actual file size against 4096 bytes before assuming a config problem; if inlining genuinely isn't wanted for assets of a particular kind, `assetsInlineLimit` accepts a callback — `(filePath, content) => boolean` — to opt specific files out by extension or path rather than lowering the global threshold.

**★ Symptom: `build.manifest: true` produced a file, but a server-side template referencing `manifest.json` at the project root can't find it.** Cause: the manifest path is relative to `build.outDir`, and the default location is `.vite/manifest.json` **inside** `outDir` — a hidden subdirectory, easy to miss when scripting a "read the manifest" step by convention rather than by checking the actual configured value. Fix: read the path from configuration (or pass `build.manifest` a full custom path) rather than hardcoding `dist/manifest.json`.

## Interview questions

**★ Why does `emptyOutDir` default to `true` inside the project root but only warn outside it, instead of just always emptying or always asking?**
Because the risk profile is different in each case. `outDir` inside the project root is understood to be Vite's own disposable output — nothing else should reasonably be writing there, so silently clearing it before every build is the convenience a CI pipeline needs (no leftover files from a previous, differently-configured build bleeding into the current one). `outDir` outside the root is, by definition, somewhere Vite did not create and does not exclusively own — a shared directory, a sibling package's public folder, potentially anything. Defaulting to "empty it anyway" there risks silently deleting files a human put there on purpose; defaulting to "always ask" would break every CI pipeline that legitimately wants the behavior. A warning plus an explicit opt-in (`emptyOutDir: true`) is the middle ground: automation that has been configured on purpose proceeds, and a first-time misconfiguration gets a visible signal instead of silent data loss.

**★ What's the actual purpose of nesting everything under `assetsDir` instead of just writing hashed files next to `index.html`?**
Two things become possible once hashed output lives under a single, predictable path prefix rather than being scattered flat alongside `index.html`. First, a reverse proxy or CDN cache rule can target `/assets/*` with one line and be correct for every file Vite ever emits, present or future, without maintaining a list of extensions or filenames. Second, `index.html` — the one file that must **never** be cached long-term — is trivially distinguishable from everything that **should** be, purely by path, with no need to inspect file contents or maintain a parallel manifest just to tell a cache rule which files are which. `assetsDir` is what makes the entire caching strategy in **[01f](01f-caching-strategy-and-library-mode-deployment.md)** a one-line proxy config instead of a per-filename allowlist.

**★ If `outDir` is emptied before every build, what protects a `public/` file that used to exist in a previous build but was deleted from `public/` since?**
Nothing needs to protect it, and that's the point: `emptyOutDir` clearing the directory first, followed by `build.copyPublicDir` copying the *current* `public/` contents fresh, means a `dist/` tree after any given build reflects exactly the current state of the source tree — no stale file from three builds ago can survive by accident. A deploy pipeline that instead does an incremental sync (rsync-style, only touching changed files) loses this property and needs its own explicit step to remove files that no longer exist in the source, or it accumulates orphaned assets indefinitely.

**★ Why is `build.manifest` off by default, and who actually needs it turned on?**
It exists for exactly one situation: a server that renders HTML itself — a Node/Express app, a PHP or Rails backend doing SSR or template-based asset injection — and needs to know, at request time, which hashed filename corresponds to a given source entry point, because that mapping changes on every build. A purely static deploy never needs it: `vite build` already writes the correct hashed references straight into `index.html`, so there's no second lookup step required. Turning `build.manifest` on for a deployment that doesn't do backend-driven asset injection produces a file nothing ever reads.

---

← [01 · base and the deploy path](01-shipping-the-build.md) · [Vite overview](../../README.md) · Next → [01b · public/ at deploy time](01b-public-directory-and-publicdir.md)
