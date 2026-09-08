---
title: "Hashed filenames are what make caching a hashed asset forever safe, and index.html must never get that same treatment, or a new deploy becomes invisible to returning users"
sidebar_label: "01f · Caching strategy"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [Building for Production — Load Error Handling](https://vite.dev/guide/build#load-error-handling), [Library Mode](https://vite.dev/guide/build#library-mode). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Caching a hashed build correctly — and what changes for a library

**The cache strategy a Vite build wants is not "cache everything" or "cache nothing" — it's a hard split, and the split works only because of a property Vite guarantees and `index.html` cannot have.** Every JS/CSS file under `build.assetsDir` (see **[01a](01a-outdir-assetsdir-and-the-dist-shape.md)**) has its content hash baked into its filename; `index.html` itself does not and structurally cannot, because it's the one file whose name every host and every browser expects to find at a fixed, predictable path. That asymmetry is the entire caching strategy: hash-named files can be told to live in every cache forever, because a content change always produces a new filename; the one file with a fixed name must never be told the same thing, because a content change there is invisible to any cache that's already holding an old copy.

## The rule, and why the hashing is what makes it safe

```
dist/
├── index.html                  ← unhashed, fixed name, references the CURRENT build's hashes
└── assets/
    ├── index-a1b2c3d4.js       ← hashed — a content change produces a DIFFERENT filename
    └── index-e5f6a7b8.css      ← same
```

```nginx
# nginx.conf
location /assets/ {
    # Hashed filenames — a byte changing anywhere in the file changes the filename,
    # so an old cached copy under the old name is simply never requested again.
    add_header Cache-Control "public, max-age=31536000, immutable";
}

location = /index.html {
    # UNHASHED — the URL never changes, so this is the only file where a stale
    # cached copy actively serves wrong (outdated) content to a real user.
    add_header Cache-Control "no-cache";
}
```

`no-cache` on `index.html`, not the more aggressive `no-store`, is deliberate: `no-cache` still permits the browser or an intermediate cache to store the response, but forces a revalidation request before ever using the cached copy — a `304 Not Modified` round trip is cheap, and it means a returning user's browser doesn't have to fully re-download `index.html` on every single visit, only confirm it hasn't changed. `no-store` would work too, at the cost of a full re-download every time, which for a small HTML file is rarely worth the difference — but either is a legitimate choice, and `immutable` on the hashed path is the one that can never be relaxed to `no-store`'s cost/benefit trade the other way.

## The failure this exists to prevent

Vite's own documentation names the exact failure mode a wrong cache policy on `index.html` produces, in the context of a specific runtime event:

> *"Vite emits `vite:preloadError` event when it fails to load dynamic imports. `event.payload` contains the original import error. If you call `event.preventDefault()`, the error will not be thrown."*

```js
// A real handler for the failure this section describes
window.addEventListener('vite:preloadError', () => {
  window.location.reload(); // force a fresh index.html + fresh chunk map
});
```

> *"When a new deployment occurs, the hosting service may delete the assets from previous deployments. As a result, a user who visited your site before the new deployment might encounter an import error. This error happens because the assets running on that user's device are outdated and the code tries to import the corresponding old chunk, which is deleted. This event is useful for addressing this situation. In this case, make sure to set `Cache-Control: no-cache` on the HTML file, otherwise the old assets will be still referenced."*

Read that failure chain in order: a user loaded the app before a deploy, so their browser has an old `index.html` cached (or their session has been open since before the deploy, holding references from the old chunk map in memory). The new deploy has removed the previous build's hashed files entirely, because `build.emptyOutDir` clears `outDir` before every build (**[01a](01a-outdir-assetsdir-and-the-dist-shape.md)**) and most hosts don't retain old deploys' assets indefinitely either. When that user's already-loaded app tries to dynamically `import()` a chunk by its old hashed filename, the request 404s — the file genuinely doesn't exist anymore. `vite:preloadError` is the hook to recover from this at runtime (typically: reload the page, which fetches the current `index.html` and its correct, current chunk map) — but the event firing at all, repeatedly, for every returning user, is a symptom that `index.html` was cached too aggressively in the first place. Get the `Cache-Control: no-cache` on `index.html` right, and most users simply never hit a stale reference to begin with, because their browser revalidates and gets the current HTML — with the current, valid chunk references — well before their session goes stale enough to matter.

## Why the split cannot be inverted or flattened

Applying one blanket policy to all of `dist/` breaks in the direction you'd expect regardless of which way you flatten it:

- **Blanket `immutable, max-age=31536000` on everything** caches `index.html` for a year. Every new deploy is invisible to any user whose browser is still holding the old `index.html`, for as long as a year — they keep loading the old entry point, which references chunk hashes from a build that has since been deleted from the server, guaranteeing the exact `vite:preloadError` failure the quote above describes, for every single page load until the cache naturally expires.
- **Blanket `no-cache` on everything** is safe but throws away the entire benefit of content hashing — a hashed, genuinely-immutable JS chunk that hasn't changed across ten consecutive deploys gets revalidated (a real round trip, even if cheap) on every single page load, for every user, forever, for no reason: its content is provably unchanged because its filename would have changed if it weren't.

The split exists because these two files categories have opposite correctness requirements, not merely different performance preferences.

## Library mode — the same principle, a different output shape

Vite's own [Library Mode](https://vite.dev/guide/build#library-mode) documentation and the deep mechanics of `build.lib` — externalizing peer dependencies, the `formats`/`name`/`fileName` options, the UMD-vs-ESM defaults — are covered in full at [Build System — Library Mode](../05-build-system-rollup/01-build-options.md#build-lib-a-fundamentally-different-output-shape); this section is only the deployment-relevant difference.

A library build's output is not the hashed-assets-plus-fixed-entry shape this chunk has been describing at all:

- **`build.assetsDir` is not used in Library Mode** — there is no `assets/` subdirectory to scope a caching rule to, because a library's output is a small, flat set of named files (`my-lib.js`, `my-lib.umd.cjs`, `my-lib.css`), not a graph of imported assets that need organizing.
- **`build.assetsInlineLimit` is ignored — "assets will always be inlined, regardless of file size"** — a library ships as self-contained files, not a tree that references separately-hosted images.
- **Output filenames are not content-hashed the way application chunks are.** A library's filename is derived from `build.lib.fileName` or the package name (`my-lib.js`, `my-lib.umd.cjs`), which is exactly what a package consumer's `import` statement or `package.json` `main`/`module` field needs to be stable — an npm package cannot have its entry point's filename change on every publish the way an app's hashed chunk can.

The deployment consequence: a library is not "deployed" as static files behind a caching CDN the way an application build is at all — its `dist/` is published as an npm package, and cache-busting happens through the package's own **version number** (a consumer installing `my-lib@2.1.0` gets exactly those bytes, forever, under that version) rather than through a content hash in the filename. The two mechanisms — hash-in-filename for an app served fresh on every visit, version-in-package-manifest for a library resolved once at install time — solve the same underlying problem (never serve stale content under a name that used to mean something else) with structurally different tools, because the two things are consumed in structurally different ways.

## Gotchas

**★ Symptom: a deploy goes out, and users who had the app open in a browser tab from before the deploy start seeing failed dynamic import errors within a few minutes, not immediately.** Cause: their session was already running the *previous* build's JavaScript in memory, and a subsequent client-side navigation triggers a dynamic `import()` of a route chunk by its old hashed filename — a file the new deploy's `emptyOutDir` has since removed from the server entirely. This is expected and is exactly what `vite:preloadError` exists to catch; it is not preventable by any cache-header change, because the failure is about files that have been *deleted*, not files that are stale in a cache. Fix: attach a `vite:preloadError` listener that reloads the page, so the user's next action fetches the current `index.html` and current chunk map rather than continuing to run stale code that references deleted files.

**★ Symptom: `Cache-Control: public, max-age=31536000, immutable` was applied via a single, simple rule matching every file in `dist/`, and a production incident traces back to users loading a week-old `index.html`.** Cause: the blanket rule caught `index.html` along with everything under `assets/`, and unlike a hashed chunk, `index.html`'s URL never changes when its content does — a browser holding it in cache for the configured year has no signal to ever ask again. Fix: scope the immutable rule specifically to the hashed-assets path (**[01a](01a-outdir-assetsdir-and-the-dist-shape.md)**'s `build.assetsDir`), and give `index.html` an explicit, separate `no-cache` rule — never let a single wildcard rule cover both.

**★ Symptom: page-load performance regressed after "fixing" caching by setting `no-cache` everywhere in `dist/` out of caution.** Cause: overcorrecting from the opposite mistake — `no-cache` forces a revalidation round trip for every request, including for hashed chunks whose content is provably unchanged (their filename would differ if it weren't). This throws away the entire benefit `assetsDir`'s hashing exists to provide. Fix: the split, not a uniform policy in either direction — `immutable` scoped to hashed assets, `no-cache` scoped to `index.html` alone.

**★ Symptom: a library published to npm has a fixed filename (`dist/my-lib.js`) that a consumer's CDN or browser cache holds onto across a version bump, serving the old code under the new version's tag.** Cause: applying application-style hashed-filename caching reasoning to a library build, where it doesn't apply — library output filenames are deliberately stable (`build.lib.fileName`) for import-statement and `package.json` stability, not content-hashed, so a *filesystem-level* cache keyed only on path (rather than the package version) genuinely can serve stale bytes under an unchanged path. Fix: for a library, cache-busting is the package version, not the filename — any caching layer sitting between a registry and a consumer (a CDN fronting `unpkg`/`jsdelivr`, an internal package mirror) needs to key on the versioned URL (`/my-lib@2.1.0/dist/my-lib.js`), not the bare path, which registries serving by version already do correctly by construction.

## Interview questions

**★ Why is it specifically the *hashing* that makes long-term immutable caching safe, rather than just "these files don't change often"?**
Because "doesn't change often" is a statement about historical behavior, not a guarantee — any file could theoretically be updated at any time, and a cache holding an old copy under an unchanged URL has no way to know a new version exists. Content hashing converts "this file's content changed" into "this file's *URL* changed" — every reference to it (in `index.html`, in another chunk's import) is regenerated to point at the new hashed name at the same time the content changes, so an old cached copy under the old URL is simply never requested again; it isn't invalidated, it's abandoned. `immutable` is only a safe claim to make about a URL when the *content* behind that URL is genuinely guaranteed never to change for as long as that URL exists — which hashing provides as a structural property, not an operational promise that has to be trusted.

**★ Why does `index.html` need `no-cache` specifically, rather than just a short `max-age`?**
Either works in practice for most sites, but they trade off differently. A short `max-age` (say, 60 seconds) means a deploy can still be invisible to a user for up to that window — acceptable for most apps, but not zero. `no-cache` (which, despite the name, still permits storing the response) forces a conditional revalidation request on every load, so a deploy is visible on literally the *next* request after it completes, at the cost of an extra round trip (typically a cheap `304 Not Modified`) even when nothing has changed. The choice is a trade between "deploys are visible instantly" and "a few seconds of staleness is fine, save the round trip" — what's non-negotiable is that it must be one of these short-lived options, never the same long-lived `immutable` treatment given to the hashed assets.

**★ A user hits a `vite:preloadError` after a deploy. Does fixing the `Cache-Control` header on `index.html` make this error impossible, or just less frequent?**
Less frequent, not impossible — and the distinction matters for how you handle the event. A correct `Cache-Control: no-cache` on `index.html` means a *new page load* always gets the current build, so a user arriving fresh essentially never hits this. But a user who already has the app open — a long-lived single-page session — is running JavaScript that was loaded before the deploy happened, entirely independent of what `index.html`'s cache header says now, since that JavaScript is already in the browser's memory. If that session later triggers a route the current in-memory code hasn't loaded yet, it dynamically imports a chunk by its old hashed name, which the new deploy has deleted. `vite:preloadError` exists precisely for that residual case — correct caching minimizes how often it happens, but only a runtime handler (typically: reload on the event) actually recovers from the case where it still does.

**★ Why doesn't a library build get the same hashed-filename treatment an application build gets, if hashing is what makes long-term caching safe?**
Because a library isn't served fresh to a browser on every visit the way an application's `index.html` is — it's installed once, by version, through a package manager, and a consumer's `import 'my-lib'` resolves to whatever version their own `package.json` pins, not to "whatever the latest deploy happens to be." The thing that needs to be stable for a library is the reference a consumer's code and tooling depend on — the package name, the `main`/`module` entry filename — because that's what appears in another project's source and lockfile. Cache-busting for a library happens at the version level (`my-lib@2.1.0` is immutable once published; `my-lib@2.2.0` is a different, separately-cached artifact), which is a mechanism external to Vite's build output entirely — it's how npm registries and CDNs like unpkg key their own caching, not something `build.lib`'s filenames need to encode themselves.

---

← [01e · SPA fallback: self-managed infra](01e-spa-fallback-self-managed-infrastructure.md) · [Vite overview](../../README.md) · Next → [01g · build.target & legacy browsers](01g-build-target-and-legacy-browsers.md)
