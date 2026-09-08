---
title: "public/ is copied to dist/ verbatim, with no hashing and no import graph — which is exactly what makes it wrong for anything you actually reference from source"
sidebar_label: "01b · public/ at deploy time"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Vite documentation — [The `public` Directory](https://vite.dev/guide/assets#the-public-directory), [`publicDir`](https://vite.dev/config/shared-options#publicdir), [`build.copyPublicDir`](https://vite.dev/config/build-options#build-copypublicdir). Documentation-validated; **no sandbox run**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ `public/`: what it is for, and what it costs at deploy time

**`public/` is Vite's escape hatch from the module graph — a directory whose contents Vite does not look inside, does not hash, and does not know are referenced by anything.** The full mechanics of what belongs there, the referencing rule, and why it exists at all are covered in depth at [Asset Handling — the `public/` directory](../06-asset-handling/01-static-asset-imports.md); this chunk is the narrower deployment question: what happens to `public/` on the way into `dist/`, and the one config knob (`publicDir: false`) that turns the whole mechanism off.

## What crosses into `dist/`, unchanged

> *"Files in this directory are served at `/` during dev and copied to the root of `outDir` during build, and are always served or copied as-is without transform."*

That's the entire lifecycle at build time: a straight file copy from `publicDir` (default `"public"`, relative to project root) to the root of `outDir`, with no processing — no hashing, no minification, no bundling, no rewriting of anything inside the files themselves. A `public/robots.txt` becomes `dist/robots.txt`, byte-for-byte identical, at deploy time. This is controlled independently of everything the module graph produces:

> *"By default, Vite will copy files from the `publicDir` into the `outDir` on build. Set to `false` to disable this."* — `build.copyPublicDir`

Disabling `copyPublicDir` while still having a `publicDir` configured is the shape you want when a separate step in your deploy pipeline — a CDN sync, a different upload target for static assets — already handles those files and a duplicate copy into `outDir` would just be wasted work or a stale second copy sitting alongside the one the pipeline actually serves.

## `publicDir: false` — turning off the mechanism entirely

> *"Defining `publicDir` as `false` disables this feature."*

This is different from having an empty `public/` directory or from setting `copyPublicDir: false`. `publicDir: false` tells Vite there is no such directory to watch, serve, or copy at all — useful in a monorepo where multiple Vite apps share one physical `public/`-style asset directory served by something outside any single app's build (a shared static file server, a reverse proxy that serves a common asset path across several deployed apps), and each app's own build should not be independently copying and re-copying the same files.

```ts
// vite.config.ts — a monorepo app whose static assets are served by a
// shared infrastructure layer, not copied per-app into each app's own dist/
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
});
```

## Why the deploy-time property that matters is "no hash"

The reason `public/`'s deployment behavior gets its own short chunk rather than folding entirely into asset handling: the caching strategy in **[01f](01f-caching-strategy-and-library-mode-deployment.md)** hinges on hashed filenames being safe to cache forever, and `public/` output is the one category of file in `dist/` that is **never** hashed. A cache rule that blanket-applies `Cache-Control: public, max-age=31536000, immutable` to everything in `dist/` rather than scoping it to `build.assetsDir` (see **[01a](01a-outdir-assetsdir-and-the-dist-shape.md)**) will happily apply that same immutable, year-long cache header to `robots.txt`, `favicon.ico`, or any other file that came from `public/` — and because those filenames never change, a browser or edge cache that has cached the old bytes has no signal to ever ask again.

```nginx
# nginx.conf — the scoped rule from 01a, restated with the reason spelled out:
# assetsDir contains ONLY hashed files. Nothing from public/ lives under this prefix.
location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# Everything else in dist/ — index.html AND every public/ file — gets no
# long-term caching by default. A short max-age or none at all is the safe
# starting point for anything not under /assets/.
location / {
    add_header Cache-Control "no-cache";
}
```

## Gotchas

**★ Symptom: a `public/manifest.json` that a third-party service polls for changes keeps serving a stale version for days after every update.** Cause: the file was updated in `public/`, rebuilt, and redeployed correctly — but an intermediate cache (browser, CDN, reverse proxy) was configured with a long `max-age` scoped too broadly, covering the whole `dist/` output rather than just `build.assetsDir`. Because the filename never changes (`public/` files are never hashed), there is no cache-busting URL change to force a refetch. Fix: scope long-lived cache headers strictly to the hashed-assets prefix, never to `dist/` as a whole — see **[01f](01f-caching-strategy-and-library-mode-deployment.md)**.

**★ Symptom: two Vite apps in a monorepo, sharing a `public/`-style static directory served by common infrastructure, keep clobbering each other's copies of that directory during CI.** Cause: each app's own `vite.config.ts` has `publicDir` pointed (directly or by default) at the shared directory, so every app's build independently copies the same files into its own `outDir`, and whichever build ran last "wins" if the outputs are later merged. Fix: `publicDir: false` on every app that doesn't need its *own* copy of those files — let the shared infrastructure serve them once, outside any individual app's build.

**★ Symptom: `build.copyPublicDir: false` was set to skip a redundant copy step, and the production site is now missing `favicon.ico` and `robots.txt`.** Cause: disabling `copyPublicDir` does exactly what it says — the files stop being copied into `outDir` — and unless a separate deploy step now places those files at the deployed root itself, they are simply absent from the deployed output. Fix: `copyPublicDir: false` is only correct when something else in the pipeline is provably placing those files where the host expects them; verify that step exists before flipping the flag, not after the 404s show up.

## Interview questions

**★ Why does `public/` get copied "as-is" instead of being run through the same asset pipeline as an imported image?**
Because the entire reason `public/` exists is for files that specifically must **not** go through that pipeline — a fixed-name file a third party fetches by exact URL (`robots.txt`, a `manifest.json` a PWA installer expects at a known path, a `favicon.ico` browsers request implicitly) cannot tolerate having a content hash appended to its filename, and doesn't benefit from being folded into the module graph since nothing in the source imports it. Running it through the same transform-and-hash pipeline as everything else would break the one property that makes it useful: a stable, predictable, unhashed path.

**★ What actually goes wrong if you scope a long-lived, immutable `Cache-Control` header to the whole `dist/` directory instead of just the hashed-assets subdirectory?**
Every file that came from `public/` — none of which are hashed — gets told to be cached for a year by every intermediate cache that respects the header. The next time that file's content changes (a new `robots.txt`, an updated `manifest.json`), the URL is identical to before, so no cache in the path — the browser, a corporate proxy, a CDN edge — has any reason to refetch it. The fix isn't a shorter max-age on that one directory; it's scoping the immutable header to exactly the prefix that only ever contains hashed files, which is precisely what `build.assetsDir` gives you.

**★ When is `publicDir: false` the right call, versus just leaving `public/` empty?**
An empty `public/` directory and `publicDir: false` behave almost identically for a single, standalone app — neither one has any files to copy. They diverge in a monorepo or multi-app setup where several `vite.config.ts` files might otherwise point at the *same* physical directory: each one independently watching, serving, and copying files it doesn't itself own is wasted work at best and a build-order race at worst. `publicDir: false` is the explicit statement "this app has no `public/`-style assets of its own; whatever static files exist are somebody else's responsibility" — it removes the app from the mechanism entirely rather than leaving it pointed at a directory with nothing in it.

---

← [01a · The shape of dist/](01a-outdir-assetsdir-and-the-dist-shape.md) · [Vite overview](../../README.md) · Next → [01c · vite preview](01c-vite-preview-is-not-a-production-server.md)
