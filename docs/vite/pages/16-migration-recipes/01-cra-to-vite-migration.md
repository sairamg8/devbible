---
title: "Migrating a Create React App codebase to Vite is not a dependency swap because Vite's index.html is a literal module-graph entry point where CRA's was a Webpack template, and every downstream recipe in this chunk follows from that one structural inversion"
sidebar_label: "01 · CRA → Vite overview"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the React blog — [Sunsetting Create React App](https://react.dev/blog/2025/02/14/sunsetting-create-react-app), the Vite documentation — [Getting Started](https://vite.dev/guide/), [Migration from v7](https://vite.dev/guide/migration), and the Create React App documentation — [Available Scripts](https://create-react-app.dev/docs/available-scripts/). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Migrating a CRA codebase to Vite: overview and the entry-point inversion

**This is not a dependency swap.** CRA and Vite both answer "run and bundle a React app", but they disagree about which file is the entry point and what a dev server is for, and every recipe in this chunk — the HTML move, the env var rename, the JSX extension check, the alias config — is a downstream consequence of that one disagreement, not an independent list of fixes. Read this chunk first; the ones that follow (`01a` through `01f`) assume you understand why `index.html` moved before they show you what else moves with it. CRA itself is a deprecated starting point as of February 2026 — react.dev no longer recommends it for new apps — so this is now the default migration every team with an older CRA codebase eventually has to run, whether or not a specific business reason prompts it that quarter.

## CRA is deprecated; Vite is one of its own suggested replacements

The React team retired CRA as the default new-app path, on the record, not as a community rumor:

> *"Today, we're deprecating Create React App for new apps, and encouraging existing apps to migrate to a framework, or to migrate to a build tool like Vite, Parcel, or RSBuild."* — [Sunsetting Create React App](https://react.dev/blog/2025/02/14/sunsetting-create-react-app)

The framework path (Next.js, React Router, Expo) is react.dev's first recommendation. Vite is the second, explicitly for teams with constraints a framework does not fit:

> *"If your app has unusual constraints, or you prefer to solve these problems by building your own framework, or you just want to learn how react works from scratch, you can roll your own custom setup with React using Vite, Parcel or Rsbuild."*

CRA is not gone from the world — *"Create React App will continue working in maintenance mode, and we've published a new version of Create React App to work with React 19"* — but it is off the recommended path, and react.dev's current *Creating a React App* page does not mention it at all. This chunk assumes you have decided to move; it does not re-litigate whether to.

## The one sentence that explains every recipe below: `index.html` is source, not template

CRA's `public/index.html` is a Webpack `HtmlWebpackPlugin` template. Webpack builds your entire dependency graph into one or more bundles first, and then injects `<script>` tags for those bundles into a copy of that template at build output time. The file at `public/index.html` in your repo is never served to the browser as-is — it is consumed as an input to a templating step.

Vite inverts this. There is no bundling step standing between the file on disk and the browser during development:

> *"Vite treats `index.html` as source code and part of the module graph."* — [Getting Started](https://vite.dev/guide/)

> *"During development Vite is a server, and `index.html` is the entry point to your application."*

Concretely: Vite's dev server reads `index.html` off disk, finds a `<script type="module" src="...">` tag inside it, and starts resolving and serving that script's own imports on demand, one file at a time, exactly as the browser requests them. There is no intermediate bundle for the dev server to inject a reference into — the HTML file **is** the reference, already in place, before the server ever starts. That is also why the file moves:

> Vite places `index.html` *"front-and-central instead of being tucked away inside `public`"* rather than nested under a folder meant for opaque static assets.

```html
<!-- BEFORE: public/index.html — a Webpack template, never served as-is -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <link rel="apple-touch-icon" href="%PUBLIC_URL%/logo192.png" />
    <link rel="manifest" href="%PUBLIC_URL%/manifest.json" />
    <title>React App</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <!-- react-scripts injects the built <script> tags here at build time -->
  </body>
</html>
```

```html
<!-- AFTER: index.html, moved to the PROJECT ROOT — this is now the literal entry point -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <!-- %PUBLIC_URL% does not exist under Vite. public/ assets are root-relative already. -->
    <link rel="icon" href="/favicon.ico" />
    <link rel="apple-touch-icon" href="/logo192.png" />
    <link rel="manifest" href="/manifest.json" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <!-- Vite discovers this script tag and resolves its whole import graph from here.
         There is no build step that injects this — you write it once, by hand. -->
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

`%PUBLIC_URL%` disappears because it existed to solve a problem Vite's model does not have. CRA needed it because the built HTML's location relative to `public/`'s contents was not knowable until the bundler decided an output path; a plain root-relative `/favicon.ico` was not safe to hardcode in a template that might be served from a subpath. Vite serves `public/` at the site root by convention and rewrites asset URLs in `index.html` itself as part of serving it, so a literal `/favicon.ico` is already correct in both dev and the production build — no placeholder, no substitution step, one fewer moving part.

## What actually changes in the migration, categorised

Every remaining chunk in this topic is one category from this list, in depth:

| Category | CRA | Vite | Chunk |
|---|---|---|---|
| Entry point | `public/index.html`, Webpack template | `index.html` at root, literal `<script type="module">` | this chunk |
| Env vars | `REACT_APP_*`, `process.env.X` | `VITE_*`, `import.meta.env.X` | **[01a](01a-environment-variables.md)** |
| File extensions | JSX allowed in `.js` | JSX in `.js` is a hard parse error by default | **[01b](01b-file-extensions-and-the-jsx-transform.md)** |
| Absolute imports | `NODE_PATH` (removed) → `jsconfig.json`/`tsconfig.json` `baseUrl` | `resolve.alias`, `resolve.tsconfigPaths`, or `vite-tsconfig-paths` | **[01c](01c-absolute-imports-and-path-aliases.md)** |
| SVG-as-component | built-in `{ ReactComponent }` named export | `?url` / `?raw` by default, `vite-plugin-svgr` with `?react` for components | **[01d](01d-svg-imports.md)** |
| Dev proxy | `package.json` `"proxy"` field or `setupProxy.js` | `server.proxy` | **[01e](01e-dev-proxy-tests-and-pwa.md)** |
| Tests | `react-scripts test` (Jest, invisible config) | Vitest, reuses `vite.config.ts` | **[01e](01e-dev-proxy-tests-and-pwa.md)** (cross-links topic 14) |
| Service worker / PWA | `serviceWorkerRegistration.js`, `public/manifest.json` | `vite-plugin-pwa` | **[01e](01e-dev-proxy-tests-and-pwa.md)** |
| Ejected / CRACO apps | webpack config exposed or overridden | read every override by hand, no automatic converter | **[01f](01f-eject-and-craco-codebases.md)** |
| Finished config | `react-scripts` (opaque) | complete `vite.config.ts`, dependency list, scripts | **[01f](01f-eject-and-craco-codebases.md)** |

**Webpack → Vite config translation for apps that were never CRA, and the Vite 7 → 8 upgrade itself, are a different topic** and *(not written yet)* in this directory.

## The dependency swap, and why it is the smallest part of the job

The package changes are real but mechanical — they are not where the migration risk lives:

```bash
# Remove CRA's single opaque dependency
npm uninstall react-scripts

# Install Vite and the React plugin (Fast Refresh + the JSX/TSX transform)
npm install --save-dev vite @vitejs/plugin-react
```

```json
// package.json — scripts, before and after
{
  "scripts": {
    // BEFORE (CRA)
    // "start": "react-scripts start",
    // "build": "react-scripts build",
    // "test": "react-scripts test",
    // "eject": "react-scripts eject"

    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest"
  }
}
```

The minimal working `vite.config.ts` for a plain (non-ejected, non-CRACO) CRA app:

```typescript
// vite.config.ts — the starting point every later chunk in this topic builds on
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

`@vitejs/plugin-react` is what replaces `babel-preset-react-app` — it wires up Fast Refresh and the JSX transform for `.jsx`/`.tsx` files. Everything after this point in the topic is about the parts of a real CRA app that this four-line config does not yet cover: env vars, non-standard file extensions, path aliases, SVG components, the dev proxy, tests, and the PWA setup. **[01f](01f-eject-and-craco-codebases.md)** ends with the complete config for a realistic app with all of those in place.

## Gotchas

**★ Symptom: after moving `index.html`, the dev server starts but the page is blank with a 404 for the entry script in the browser's network tab.** Cause: the `<script type="module" src="...">` tag still points at a path CRA never needed to get right, because CRA's build step resolved it for you — commonly a leftover `%PUBLIC_URL%/static/js/bundle.js` or a path that assumes a `build/` output directory that does not exist in dev. Fix: point it at the real source entry file, root-relative from the project root: `<script type="module" src="/src/main.jsx"></script>`.

**★ Symptom: `public/manifest.json`'s icon links and `favicon.ico` 404 after the move.** Cause: the links still carry `%PUBLIC_URL%/`, which Vite does not substitute — it is not a Vite feature, it was CRA's own template variable. Fix: strip the prefix; `public/` is already served at the root under Vite, so `%PUBLIC_URL%/favicon.ico` becomes plain `/favicon.ico`.

**★ Symptom: `public/` assets referenced from inside JS/CSS (not `index.html`) behave identically to CRA — nobody had to touch them.** Cause: this is correctly unchanged, not a bug to hunt for. `public/`'s role — served as-is, unprocessed, uncached by the bundler, root-relative — is the same in both tools. The migration only touches `index.html` itself and the `%PUBLIC_URL%` placeholders inside it, never the rest of the `public/` directory's contents or the paths used to reach them from application code.

**★ Symptom: the team assumed removing `react-scripts` alone would let the app run under `vite`.** Cause: `react-scripts` was doing five structurally different jobs at once (dev server, prod bundler, Jest test runner, ESLint config, `index.html` templating) and Vite replaces only the first two out of the box. Fix: budget the migration as the six-category list above, not as a package swap — the remaining chunks in this topic are that budget, in order of how much they actually cost in practice.

## Interview questions

**★ Why does `index.html` have to move to the project root under Vite, and what would go wrong if you left it in `public/` and just referenced it from there?**
Vite's dev server discovers your application's entry point by reading `index.html` directly and parsing it for a `<script type="module">` tag — it does not have a separate "entry file" config option the way Webpack's `entry` field does; the HTML file *is* the entry configuration, by convention, at a fixed location (the project root, or wherever `root` is configured). If you left it inside `public/`, Vite's own convention for that directory — served as-is, unprocessed, copied verbatim into the build output — would apply to it too, meaning Vite would never treat it as source to build a module graph from in the first place. The file has to be outside `public/` specifically because being *inside* `public/` means "leave this alone," which is the opposite of what an entry point needs.

**★ A junior engineer says "CRA and Vite are basically the same, you just swap `react-scripts` for `vite`." What is the one sentence that shows this is wrong?**
*"Vite treats `index.html` as source code and part of the module graph"* — CRA's equivalent file is a Webpack template consumed at build time and never served to the browser directly, while Vite's is served, parsed and resolved from, live, on every request during development. That is not a naming difference or a config-flag difference; it is two different models of what a dev server is (bundle-then-serve vs. serve-then-transform-on-demand), and nearly every other migration step in this topic — the env var rename, the JSX extension check, the alias config — exists because of consequences of that one structural choice, not because Vite and CRA independently happened to name things differently.

**★ Why does `%PUBLIC_URL%` disappear entirely rather than get a Vite equivalent?**
Because it solved a problem specific to Webpack's templating model: the built HTML's eventual location relative to hashed, bundler-chosen output paths was not knowable when you wrote the template, so a literal `/favicon.ico` was not safe to hardcode — it might need to become `/my-app/favicon.ico` under a subpath deploy. `%PUBLIC_URL%` was HtmlWebpackPlugin's answer: a placeholder substituted with the correct public path at build time. Vite handles the equivalent problem (subpath deploys, via the `base` config option) by rewriting asset URLs in `index.html` as part of serving/building it directly — so a plain root-relative path is already correct without a placeholder, and adding one back would be solving an already-solved problem with a mechanism from the tool you're migrating away from.

**★ What is the actual cost distribution of a CRA-to-Vite migration — where does the time really go?**
Not in the dependency swap or the `vite.config.ts` scaffold, which are both a few lines. It goes into the categories that touch application code directly and fail silently or at runtime rather than at build time: env var references scattered across the codebase (`process.env.REACT_APP_*` has no Vite equivalent that throws a helpful error — it just becomes `undefined`), any file with JSX in a `.js` extension (a hard parse error, at least visible), path aliases that type-check but do not resolve at runtime, and SVG component imports that compile but hand a URL string to something expecting a React component. The category that costs the most on any app old enough to have accumulated one is an ejected or CRACO-customized build — see **[01f](01f-eject-and-craco-codebases.md)** — because there is no automatic converter for a hand-rolled webpack override, only a person reading it line by line.

---

← [01n · Docker build-args vs runtime env](../15-deployment-considerations/01n-docker-build-args-vs-runtime-env.md) · [Vite overview](../../README.md) · Next → [01a · Environment variables](01a-environment-variables.md)
