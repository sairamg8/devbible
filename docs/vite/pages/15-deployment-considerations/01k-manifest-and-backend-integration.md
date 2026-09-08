---
title: "A non-JS backend cannot know a content hash at request time, so build.manifest exists to give Rails, Laravel or Django a lookup table from a stable name to the exact hashed file Vite actually emitted"
sidebar_label: "01k · Manifest & backend integration"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [Backend Integration](https://vite.dev/guide/backend-integration), [Build Options](https://vite.dev/config/build-options) (`build.manifest`). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

**When the frontend is a full SPA, `index.html` is part of the build output, and Vite writes the correct hashed `<script>`/`<link>` tags into it directly — nobody has to know the hash by name.** When the "frontend" is a template rendered by Rails, Laravel, Django, PHP or any server that owns its own HTML, that trick is unavailable: the template was written by hand, months before this build ran, and it has no way to know that `main.js` compiled to `assets/main-a1b2c3.js` this time. `build.manifest` exists to close exactly that gap — it is a file whose only job is to answer "what did `main.js` become in this build?" for a process that isn't Vite.

## What the manifest is, quoted

> *"For production, after running `vite build`, a `.vite/manifest.json` file will be generated alongside other asset files."* — [Backend Integration](https://vite.dev/guide/backend-integration)

> *"Contains a mapping of non-hashed asset filenames to their hashed versions, which can then be used by a server framework to render the correct asset links."* — [Build Options](https://vite.dev/config/build-options)

It is off by default and named after the setting that turns it on:

- `build.manifest` — default `false`; *"When set to `true`, the path would be `.vite/manifest.json`."*

```typescript
// vite.config.ts — enabling the manifest for a backend-rendered app
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    manifest: true,
    rolldownOptions: {
      input: '/src/main.js',   // the entry the backend template will look up by name
    },
  },
});
```

## The exact shape, quoted from the guide

```json
{
  "_shared-B7PI925R.js": {
    "file": "assets/shared-B7PI925R.js",
    "name": "shared",
    "css": ["assets/shared-ChJ_j-JJ.css"]
  },
  "views/foo.js": {
    "file": "assets/foo-BRBmoGS9.js",
    "name": "foo",
    "src": "views/foo.js",
    "isEntry": true,
    "imports": ["_shared-B7PI925R.js"],
    "css": ["assets/foo-5UjPuW-k.css"]
  }
}
```

Each key is a `ManifestChunk`, and the fields that matter for tag generation:

- **`file`** — *"The output file name of this chunk / asset."* This is the literal, hashed path your `<script src>` or `<link href>` must point at.
- **`isEntry`** — *"Whether this chunk or asset is an entry point."* Only entries are candidates for a `<script>` tag on the page; everything else is a chunk pulled in as a dependency.
- **`imports`** — *"The list of statically imported chunks by this chunk."* Entries reference their dependencies by manifest key here, not by file path — the lookup is recursive.
- **`css`** — the stylesheets that chunk pulled in. Because Vite extracts CSS at build time (`<link rel="stylesheet">` on a real production page), a backend that only emits a `<script>` tag for the entry and ignores this array ships JavaScript with no styling at all.

## Turning the manifest into tags — the order the guide specifies

Given the entry `views/foo.js` above, a backend integration reads the manifest and emits tags in this order — CSS for the entry, then CSS for every imported chunk, then the entry's own script, then optional preloads for its imports:

```php
<?php
// A minimal Laravel/PHP-style helper — the pattern generalizes to any backend language.
function viteTags(string $entry): string {
    $manifest = json_decode(file_get_contents(__DIR__ . '/../dist/.vite/manifest.json'), true);
    $chunk = $manifest[$entry];
    $tags = [];

    // 1. Stylesheets for the entry chunk itself.
    foreach ($chunk['css'] ?? [] as $cssFile) {
        $tags[] = "<link rel=\"stylesheet\" href=\"/{$cssFile}\">";
    }

    // 2. Stylesheets for every statically imported chunk, recursively.
    foreach ($chunk['imports'] ?? [] as $importKey) {
        foreach ($manifest[$importKey]['css'] ?? [] as $cssFile) {
            $tags[] = "<link rel=\"stylesheet\" href=\"/{$cssFile}\">";
        }
    }

    // 3. The entry's own script.
    $tags[] = "<script type=\"module\" src=\"/{$chunk['file']}\"></script>";

    // 4. Optional: modulepreload for the entry's direct imports (see 01l).
    foreach ($chunk['imports'] ?? [] as $importKey) {
        $tags[] = "<link rel=\"modulepreload\" href=\"/{$manifest[$importKey]['file']}\">";
    }

    return implode("\n", $tags);
}
```

A Rails or Django integration is structurally identical — parse the same JSON, look up the same keys, emit the same four groups of tags in the same order. The manifest format is deliberately backend-agnostic; the guide's examples exist to show the *shape*, not to prescribe one framework's helper library.

## Dev mode is a completely different code path — and the manifest does not exist yet

The manifest is a **production-only** artifact — it is generated by `vite build`, and during `vite dev` there is no `dist/` and no hashed filenames to look up, because nothing has been bundled. The backend template needs a branch:

> *"inject the following in your server's HTML template: `<script type="module" src="http://localhost:5173/@vite/client"></script>"* — [Backend Integration](https://vite.dev/guide/backend-integration)

```php
<?php
if (getenv('APP_ENV') === 'local') {
    echo '<script type="module" src="http://localhost:5173/@vite/client"></script>';
    echo '<script type="module" src="http://localhost:5173/src/main.js"></script>';
} else {
    echo viteTags('src/main.js');
}
```

Forgetting this branch — or forgetting to remove it before a production deploy — is the single most common backend-integration bug: a production page trying to load `http://localhost:5173/...` from the visitor's own browser, which resolves to nothing on their machine.

## Gotchas

**★ Symptom: `.vite/manifest.json` does not exist after a build the team has been running for weeks.** Cause: `build.manifest` defaults to `false` — it has to be explicitly enabled, and the default assumption is a fully client-managed `index.html` that never needed one. Fix: `build: { manifest: true }`, and confirm `build.rolldownOptions.input` (or the top-level `input`) names the actual entry the backend will look up, since the manifest's top-level keys are the entry paths as given to the bundler, not arbitrary names.

**★ Symptom: JavaScript loads correctly in the backend-rendered page and every element is completely unstyled.** Cause: the backend helper emitted only the entry's `<script>` tag from the manifest and ignored the `css` array — Vite extracts and hashes CSS as a build output separate from the JS chunk, so it never travels with the script tag automatically. Fix: emit `<link rel="stylesheet">` for the entry's own `css` array **and** for every chunk listed in its `imports`, in that order, before the script tag.

**★ Symptom: a shared/vendor chunk's stylesheet is missing even though the entry's own CSS renders fine.** Cause: the backend helper read only the top-level entry's `css` field and never walked `imports` to pick up CSS owned by chunks the entry depends on but does not directly declare. Fix: recurse — for every key in `imports`, also emit that chunk's own `css` list, exactly as the worked example above does in its second loop.

**★ Symptom: a production deploy shows a blank page with the browser's network tab full of failed requests to `localhost:5173`.** Cause: the dev-mode branch that injects `@vite/client` and points at the dev server was never switched off for production — the backend is still emitting the dev-mode script tags in an environment where no Vite dev server is running. Fix: gate the two code paths on the actual deployment environment, and make the production branch read the manifest, never the hardcoded dev server URL.

**★ Symptom: the manifest's top-level keys don't match what the backend expects to look up (`main.js` vs `src/main.js` vs `/src/main.js`).** Cause: the manifest keys the entry by whatever path was given to `input` — a relative path, an absolute path, or a glob resolve differently, and the backend's lookup string has to match exactly, including any leading slash. Fix: print the manifest once after enabling it and copy the actual key string into the backend helper rather than guessing it from the `vite.config.ts` source.

## Interview questions

**★ Why does `build.manifest` exist at all, given that Vite already writes correct asset references into `index.html` for a normal SPA build?**
Because that trick only works when Vite itself owns `index.html` as a build input — it can rewrite the file because the file is part of what `vite build` produces. A backend-rendered app's HTML template is not a Vite build artifact; it's a `.erb`, `.blade.php` or Django template written independently of any given build, and it has no mechanism for learning a content hash that only exists after that specific build ran. The manifest is a lookup table that lets a process outside Vite's own output pipeline — the backend's template renderer — answer "what filename did this logical entry become this time?" without Vite having to touch that backend's templating system at all.

**★ A backend integration emits `<script>` for the entry from the manifest and nothing else. What predictably breaks, and why does the manifest already contain the fix?**
Styling breaks, because Vite extracts CSS as its own hashed output file per chunk rather than inlining it into the JavaScript, so a script tag alone never delivers stylesheets. The manifest already carries the fix in its `css` array on every chunk that pulled in a stylesheet, plus the `imports` array that names every chunk the entry statically depends on. A correct integration walks both — the entry's own `css`, and the `css` of every chunk reachable through `imports` — and emits a `<link rel="stylesheet">` for each before the script tag, which is the exact ordering the guide's own example follows.

**★ Why does the manifest only exist after `vite build`, and what has to change in a backend template to handle that?**
Because the manifest's entire purpose is mapping logical names to the hashed filenames a specific production build produced — during `vite dev` nothing is bundled or hashed, source files are served as-is from Vite's dev server, so there is nothing for a manifest to describe. A backend template therefore needs an explicit branch: in development, emit a hardcoded script tag pointing at the Vite dev server's URL (including its `@vite/client` HMR client script), and in production, read the manifest and emit hashed tags instead. The most common failure in this setup is not getting the manifest logic wrong — it's leaving the development branch active in production, which produces a page whose script tags point at `localhost` and fail for every visitor whose machine is not the one that built it.

---

← [01j · Deploying an SSR/Node app](01j-deploying-an-ssr-node-app.md) · [Vite overview](../../README.md) · Next → [01l · Module preload & the polyfill](01l-module-preload-and-the-polyfill.md)
