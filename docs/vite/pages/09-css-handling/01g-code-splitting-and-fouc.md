---
title: "CSS code splitting is on by default and Vite already guarantees the async chunk will not evaluate until its stylesheet has loaded — so the reason to set `cssCodeSplit: false` is never FOUC, and the chunks that vanish from your bundle are supposed to"
sidebar_label: "Code Splitting & FOUC"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Features › Build Optimizations › CSS Code Splitting](https://vite.dev/guide/features.md), [Build Options › `build.cssCodeSplit`](https://vite.dev/config/build-options.md), [Backend Integration › the manifest](https://vite.dev/guide/backend-integration.md), [Features › Chunk Import Map Optimization](https://vite.dev/guide/features.md) — plus `packages/vite/src/node/plugins/css.ts` at tag `v8.2.2` (`defaultCssBundleName`, `pureCssChunks`, `getEmptyChunkReplacer`). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ CSS Code Splitting and FOUC

**The most repeated claim about Vite's CSS code splitting — that it causes a flash of unstyled content on route transitions — is contradicted by the documentation in the sentence that describes the feature.** Vite links the async chunk's stylesheet and *blocks evaluation of the chunk until that stylesheet has loaded*. The real trade-offs of `cssCodeSplit` are about request count, cache granularity, cross-chunk cascade order and what your backend's manifest looks like. Getting this right starts with reading the guarantee.

## 1. Under-The-Hood Mechanics

> *"Vite automatically extracts the CSS used by modules in an async chunk and generates a separate file for it. The CSS file is automatically loaded via a `<link>` tag when the associated async chunk is loaded, and **the async chunk is guaranteed to only be evaluated after the CSS is loaded to avoid [FOUC](https://en.wikipedia.org/wiki/Flash_of_unstyled_content)**."*
> — [Features › Build Optimizations › CSS Code Splitting](https://vite.dev/guide/features.md)

> *"If you'd rather have all the CSS extracted into a single file, you can disable CSS code splitting by setting [`build.cssCodeSplit`](https://vite.dev/config/build-options#build-csscodesplit) to `false`."* — same page

The option itself:

> *"Enable/disable CSS code splitting. When enabled, CSS imported in async JS chunks will be preserved as chunks and fetched together when the chunk is fetched. If disabled, all CSS in the entire project will be extracted into a single CSS file."*
> — [`build.cssCodeSplit`](https://vite.dev/config/build-options.md), **Default: `true`**

> *"If you specify `build.lib`, `build.cssCodeSplit` will be `false` as default."* — same page

So the ordering guarantee is per async chunk: fetch the chunk, fetch its `<link>`ed CSS, apply the CSS, *then* run the chunk. A route's components cannot render before their styles exist.

### What `false` actually buys and costs

| | `cssCodeSplit: true` (default) | `cssCodeSplit: false` |
|---|---|---|
| Output | one stylesheet per entry + one per async chunk that has CSS | **one** stylesheet for the whole project |
| Initial payload | only the entry's CSS | all CSS, including routes never visited |
| Request count | one extra request per lazily-loaded route with styles | one, ever |
| Cache invalidation | editing one route's CSS invalidates that route's sheet | editing any CSS invalidates the whole sheet for everyone |
| Cross-chunk cascade | determined by chunk load order | determined once, at build time |
| Manifest key for the CSS | generated like JS chunk keys | the literal key **`style.css`** |

That last row is documented and load-bearing for anyone rendering tags from the manifest:

> *"**CSS files**: When `build.cssCodeSplit` is `false`, a single CSS file is generated with the key `style.css`. When `build.cssCodeSplit` is not `false`, the key is generated similar to JS chunks (i.e. entry chunks will not have `_` prefix and non-entry chunks will have `_` prefix)."*
> — [Backend Integration](https://vite.dev/guide/backend-integration.md)

`defaultCssBundleName` in `css.ts` is exactly `'style.css'`, and in library mode it is replaced by the resolved `build.lib.cssFileName`.

### Pure CSS chunks are removed from the bundle

A chunk whose JavaScript content was **only** CSS side effects has nothing left once the CSS is extracted. Vite detects that case (`isPureCssChunk`), collects those chunks, and after rendering:

1. removes them from every other chunk's `imports`;
2. re-registers their emitted CSS and assets onto the **importing** chunk's `viteMetadata.importedCss` / `importedAssets`, so the `<link>` tags still get generated;
3. rewrites the importer's code to delete the now-dangling static import statement (`getEmptyChunkReplacer` matches `import "…chunk.js";` for ESM and the `require(...)` form for CJS).

Two consequences worth internalising. First, a chunk you can see in `manualChunks`-style configuration can legitimately not exist in `dist/`. Second, a chunk containing a **CSS module** is never pure — the source comment says *"a css module contains JS, so it makes this not a pure css chunk"* — because the exported class map is real JavaScript somebody imports.

### One optimisation that deliberately skips CSS

> *"Note that this optimization currently does not apply to CSS and assets. If you update an asset, the chunks that reference it will be invalidated. That said, the invalidation would not cascade and the chunk importing the invalidated chunk would not be invalidated."*
> — [Features › Chunk Import Map Optimization](https://vite.dev/guide/features.md)

`build.chunkImportMap` fixes cascading cache invalidation for JS chunks only. CSS hashes still propagate one level.

⚠️ **What the documentation does not settle:** the cascade order *between* separately-emitted stylesheets when two async chunks that both style the same selector load in an order the user controls. The guarantee is about a chunk not evaluating before its own CSS; it says nothing about the relative order of two route stylesheets. If your styling depends on that order, treat it as unspecified and remove the dependency — do not encode it in a config option.

## 2. Real-World Engineering Scenario

**A Rails app renders script and link tags from `.vite/manifest.json`. Someone sets `cssCodeSplit: false` to "avoid FOUC", and the app's stylesheet 404s in production.** The template was looking up the entry chunk's `css` array, which no longer describes the whole output: with code splitting disabled there is a single asset under the documented key `style.css`, and entry chunks no longer carry the per-chunk list the template was written against. The FOUC the change was meant to fix did not exist — Vite already blocks the async chunk on its stylesheet — and the change traded per-route caching for a single stylesheet invalidated by every CSS edit. The fix is to revert, and to read tags from the manifest exactly as [Backend Integration](https://vite.dev/guide/backend-integration.md) describes.

## 3. Production-Grade Code Example

```typescript
// vite.config.ts — the defaults, stated explicitly, with the reason each is what it is
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // per-route stylesheets; the async chunk waits for its own CSS before evaluating
    cssCodeSplit: true,
    // required if a backend renders the tags
    manifest: true,
  },
});
```

```typescript
// A route that lazily loads a styled component. Nothing extra is needed for correctness:
// the <link> is injected and awaited by Vite's own chunk loader.
const Settings = () => import('./routes/Settings.tsx'); // Settings.tsx imports Settings.module.css
```

```javascript
// Rendering tags from the manifest — cssCodeSplit: true (the documented shape)
// manifest["src/main.js"] = { file, css: ["assets/main-<hash>.css"], imports: [...] }
const entry = manifest['src/main.js'];
for (const cssFile of entry.css ?? []) {
  document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" href="/${cssFile}">`);
}
```

```javascript
// The SAME code path with cssCodeSplit: false — the single sheet lives under its own key
const single = manifest['style.css'];
document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" href="/${single.file}">`);
```

## 4. Senior Engineer Edge Cases & Pitfalls

**A CSS-only dynamic import is not a chunk you can hold on to.** `import('./theme.css')` produces a chunk with no exports, which is exactly the pure-CSS-chunk case; the chunk is removed and its stylesheet is attributed to the importer. The promise still resolves — the import statement is what gets rewritten — but do not expect a JS file to exist in `dist/`, and do not build tooling that counts chunks and expects it.

**Legacy output is excluded from the per-chunk CSS emit.** The build path skips chunks whose filename includes `-legacy`, so `@vitejs/plugin-legacy` output does not duplicate every stylesheet. If you inspect the legacy bundle expecting parallel CSS assets, that is why they are absent.

**Entry CSS naming differs from async CSS naming.** For an entry chunk whose facade is not itself a CSS file, Vite uses only the basename for the CSS asset name; async chunk CSS follows the chunk name. This shows up as "why is one file `main-<hash>.css` and another `routes/settings-<hash>.css`".

**`build.chunkImportMap` does not protect CSS hashes.** Documented above. Editing a stylesheet still invalidates the chunk that references it, though not that chunk's importers.

**`cssCodeSplit: false` does not mean "one request".** Assets referenced by `url()` are still separate requests, and any `?url` stylesheet is still its own asset by design.

## Gotchas

**★ Symptom: you set `cssCodeSplit: false` to prevent a flash of unstyled content on route change.** Cause: a misdiagnosis. Vite documents that the async chunk *"is guaranteed to only be evaluated after the CSS is loaded to avoid FOUC"*. Whatever the flash is, it is not the stylesheet arriving late for that chunk. Fix: revert, and look at what actually renders before the chunk — a skeleton, a layout shift from a font, or a globally-styled shell.

```typescript
export default defineConfig({ build: { cssCodeSplit: true } }); // the default; leave it
```

**★ Symptom: after disabling CSS code splitting, a server-rendered template can no longer find the stylesheet.** Cause: the manifest key changes to the literal `style.css`, documented in Backend Integration. Fix: handle both shapes, or do not disable it.

```javascript
const sheet = manifest['style.css']?.file ?? manifest['src/main.js'].css?.[0];
```

**★ Symptom: a chunk you configured is missing from `dist/`, and a build script that reads it crashes.** Cause: it was a pure CSS chunk — no exports left after CSS extraction — so Vite removed it and re-pointed its CSS at the importer. Fix: read the CSS from the importer's `css` list in the manifest, which is where Vite deliberately put it.

**★ Symptom: `import('./styles.css')` resolves but nothing appears in the network panel as a JS chunk.** Cause: same mechanism; the static import of the emptied chunk is rewritten out of the importer. Fix: none needed — the stylesheet is linked from the importing chunk. If you wanted an on-demand stylesheet you control, use `?url` and create the `<link>` yourself ([suffixes](01f-inline-raw-and-url-suffixes.md)).

**★ Symptom: a lazily-loaded route's CSS is duplicated in the entry stylesheet.** Cause: the module is reachable from both the entry and the async chunk, so its CSS belongs to both; Vite emits the CSS with the chunks that use it. Fix: this is a chunking question, not a CSS one — adjust the split so the shared module lands in one place, via `build.rolldownOptions.output`.

**★ Symptom: two routes' stylesheets fight, and which one wins depends on navigation order.** Cause: cross-stylesheet cascade order is not something the documentation defines; the guarantee is per-chunk, not global. Fix: stop relying on it — scope the rules (CSS Modules), or raise specificity deliberately in the file that must win.

**★ Symptom: your library build emits one stylesheet even though the app build splits.** Cause: documented — *"If you specify `build.lib`, `build.cssCodeSplit` will be `false` as default."* Fix: expected; see **library mode** *(not written yet)*.

**★ Symptom: enabling `build.chunkImportMap` did not stop CSS edits from invalidating chunks.** Cause: the optimisation explicitly does not apply to CSS and assets. Fix: none available; the documentation notes the invalidation at least does not cascade further.

## Interview questions

**★ Does Vite's CSS code splitting cause FOUC on lazily-loaded routes?**
No, and the documentation is unusually explicit: the extracted CSS is loaded via a `<link>` tag when the async chunk is loaded, and *"the async chunk is guaranteed to only be evaluated after the CSS is loaded to avoid FOUC"*. Vite's chunk loader waits on the stylesheet before running the module. A flash you observe on a route transition is coming from something else — a suspense fallback rendering with different styles, a web font, or a layout shift — and disabling code splitting will not fix it while making every stylesheet load up front.

**★ When is `cssCodeSplit: false` genuinely the right choice?**
When you ship a **library** (where it is already the default, because a consumer wants one importable stylesheet rather than a graph of them), when a backend integration cannot render multiple `<link>` tags per page, or when the app is small enough that the whole stylesheet is smaller than the per-route request overhead. It is the wrong choice as a FOUC remedy, and it is expensive on cache granularity: one CSS edit anywhere invalidates the single sheet for every visitor.

**★ What is a "pure CSS chunk", and why does Vite delete it?**
A chunk whose only content was CSS imports — after Vite extracts the CSS into a stylesheet asset, the JavaScript that remains is empty and exports nothing. Shipping it would mean an extra network request for a file that does nothing. Vite therefore removes it from the bundle, moves its `importedCss` and `importedAssets` onto the importing chunk so the `<link>` tags are still emitted, and rewrites the importer's static import statement away. A chunk containing a CSS *module* is never pure, because the exported class map is real JavaScript.

**★ A colleague's build script reads `manifest.json` and breaks when `cssCodeSplit` is toggled. What changed?**
The key layout. With splitting on, CSS is listed per chunk in each chunk's `css` array — *"The list of CSS files imported by this chunk"* — with entry chunks unprefixed and non-entry chunks prefixed with `_`. With splitting off, there is one CSS asset under the literal key `style.css`. A script that hard-codes one of those shapes breaks on the other, which is why the documented approach is to walk the entry chunk plus its imported chunks and emit a tag per file in each `css` list.

**★ Why does `build.chunkImportMap` not help CSS caching?**
Because it works by replacing hashed URLs in import statements with stable chunk ids resolved through an import map, and import maps only govern **module specifiers**. A stylesheet is referenced by a `<link>` href, not by an import specifier, so there is no indirection to insert. The documentation states the limitation and its consequence: updating an asset invalidates chunks that reference it, but the invalidation does not cascade upward.

---

← [?inline, ?raw and ?url](01f-inline-raw-and-url-suffixes.md) · [Vite overview](../../README.md) · Next → [Minification & CSS Targets](01h-minification-and-css-targets.md)
