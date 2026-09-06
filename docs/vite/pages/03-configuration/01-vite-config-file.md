---
title: "Configuration: `vite.config.ts`, `defineConfig()` & Conditional Config"
sidebar_label: "Configuration"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the Vite documentation — [Getting Started](https://vite.dev/guide/), [Migration from v7](https://vite.dev/guide/migration). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> ⚠️ Scope of this pass: the shared-options reference was **not** re-fetched, so the `root` / `base` / `publicDir` / `envDir` defaults and the config-function parameter list below still carry their original 2026-08-14 provenance and are marked as such in the Gotchas.
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

# ⚡ Configuration: `vite.config.ts`, `defineConfig()` & Conditional Config

## 1. Under-The-Hood Mechanics

`vite.config.ts` is itself executed by Vite's own Node-based config loader, which transpiles the TypeScript on the fly, **before** either the dev server or the build process starts — meaning the config file's own execution is a distinct, earlier step from anything it configures.

⚠️ **Through Vite 7 that transpilation was esbuild.** Vite 8 changed the toolchain wholesale — *"Vite 8 uses Rolldown and Oxc based tools instead of esbuild and Rollup."* ([Migration from v7](https://vite.dev/guide/migration)) — so **do not assume the config loader still runs esbuild**, and treat any escape hatch you have that names esbuild in the config-loading path as needing re-checking against the Vite 8 config reference. I did not read the config-loader page in this pass and so state no replacement by name.

```text
vite.config.ts loaded & executed (Node process, TypeScript transpiled by Vite's config loader)
        │
        ▼
defineConfig({ ... }) OR defineConfig(({ command, mode }) => ({ ... }))
        │
        ├── command: 'serve' | 'build'   ──► which Vite invocation is currently running
        └── mode: 'development' | 'production' | custom   ──► drives .env.[mode] file loading (see env vars doc)
```

### `defineConfig()`: Type Safety, Not Runtime Behavior
`defineConfig()` is purely a TypeScript identity-function helper — it exists **solely** to give IDEs full IntelliSense/type-checking on the config object, based on which overload (plain object vs function) is used. It has zero runtime effect beyond that; `export default { ...config }` without `defineConfig` works identically, just without the type-checking benefit.

### Conditional Config: The Function Form
Passing a **function** (receiving `{ command, mode }`) instead of a plain object lets the same config file branch behavior between `vite` (dev) and `vite build` (production) — necessary because certain options (base path, certain plugin behaviors) genuinely need to differ between serving unbundled ESM and producing a final bundle.

### `root`/`base`/`publicDir`/`envDir`: Project Structure Customization
- **`root`** — the project root Vite resolves `index.html` and source files relative to (default: current working directory).
- **`base`** — the public base path the built app will be served from (critical for sub-path deployments — see the [deployment doc](../15-deployment-considerations/01-shipping-the-build.md)).
- **`publicDir`** — a directory whose contents are copied **verbatim** to the build output root, untouched by any transform (for files that must keep an exact, predictable path — `robots.txt`, `favicon.ico`).
- **`envDir`** — where `.env` files are looked for, if not colocated with `vite.config.ts` itself.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Single Config File Needing Different `base` Paths for Local Dev vs a GitHub Pages Deployment.
An app is served at the domain root (`/`) during local development, but deployed to GitHub Pages under a repository sub-path (`/my-app/`) in production. Using the function form of `defineConfig`, `base` is set conditionally based on `command` — `/` when `command === 'serve'` (matching local dev's root-relative serving) and `/my-app/` when `command === 'build'` (matching the actual GitHub Pages deployment path) — one config file correctly serving both environments without manual editing before each deploy.

---

## 3. Production-Grade Code Example

```typescript
// vite.config.ts — conditional config using the function form
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  base: command === 'build' ? '/my-app/' : '/', // differs between dev and the actual GitHub Pages deploy path
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  resolve: {
    alias: { '@': '/src' },
  },
  server: {
    port: 3000,
    proxy: mode === 'development' ? { '/api': 'http://localhost:4000' } : undefined,
  },
}));
```

```typescript
// vite.config.ts — plain object form, when no dev/build branching is actually needed
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src', // index.html and source resolve relative to src/, not the project root
  publicDir: '../public', // still copies static assets verbatim, just from a non-default location
  build: { outDir: '../dist' },
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting `base` Must Match the Actual Deployment Sub-Path
```typescript
// ❌ WRONG: deploying to a sub-path (e.g. https://user.github.io/my-app/) without setting
// base correctly means every asset reference resolves against the DOMAIN ROOT instead —
// the deployed app loads a blank page, with every JS/CSS/asset request 404ing
export default defineConfig({ /* base defaults to '/' */ });

// ✅ CORRECT: base must match the actual sub-path the built app will be served under
export default defineConfig({ base: '/my-app/' });
```

### ⚠️ Pitfall 2: Assuming `root` Changes Where `vite.config.ts` Itself Lives
```text
❌ MISUNDERSTANDING: `root` controls where Vite looks for index.html/source files —
it does NOT relocate where vite.config.ts is expected to live. Setting `root` INSIDE the
config file cannot possibly move where that config file is found: Vite has to locate and
execute the file before it can read anything the file says.

✅ AWARENESS: root and the config file's own location are two SEPARATE concerns
```

🔴 **And the location is the project root, not the shell's working directory.** The
getting-started guide states it plainly:

> *"Vite will also resolve [its config file (i.e. `vite.config.js`)](https://vite.dev/config/#configuring-vite) inside the project root."* — [Getting Started](https://vite.dev/guide/)

Those coincide when you run `vite` from the project directory, which is why the distinction
almost never surfaces — until you pass `--root` on the command line, or run Vite from a
monorepo root against a package subdirectory, at which point "cwd" and "project root" are
different directories and only one of them is searched. `--config <file>` overrides the
search entirely and is the unambiguous option when a script's working directory is not
under your control.

### ⚠️ Pitfall 3: Putting Secrets Directly Into `define`
```typescript
// ❌ DANGEROUS: define performs a literal, compile-time text substitution — anything
// passed here ends up as PLAINTEXT in the shipped client bundle, fully visible to any user
export default defineConfig({
  define: { __API_SECRET__: JSON.stringify(process.env.API_SECRET) }, // a REAL secret, now public
});

// ✅ CORRECT: define is for genuinely public build-time constants only (a version string,
// a public feature flag) — actual secrets belong server-side, never in client-bundled config
```

---

## Gotchas

**★ Symptom: `vite --root packages/web` from a monorepo root ignores the config you expected it to use.** Cause: the config file is resolved **inside the project root**, and `--root` just moved the project root. Fix: either put `vite.config.ts` where the root now is, or pin it explicitly with `--config packages/web/vite.config.ts`. The two flags are independent and `--config` wins.

**★ Symptom: you set `root: 'src'` and now Vite cannot find your config.** Cause: it can — it found it, and then read `root` out of it. The confusion is the ordering. Fix: internalise the chicken-and-egg: the config file is located, transpiled and executed *first*; every option in it, `root` included, describes the world *after* that has happened. Nothing inside a config file can change how that file is found.

**★ Symptom: you drop `defineConfig()` and nothing breaks, so you conclude it was never doing anything.** Cause: it genuinely has no runtime effect — it is an identity function whose only job is to attach the config type so an editor can check the object and complete it. Fix: that is exactly why dropping it is a bad trade. Without it a typo like `bulid: {}` or a misspelled `outdir` is a silent no-op that Vite happily accepts; with it, the editor flags it before you run anything. It buys you nothing at runtime and the entire class of typo-shaped config bugs at author time.

**★ Symptom: the deployed app is a blank white page and every asset request 404s, but it works locally.** Cause: `base` still defaults to `/` while the app is actually served from a sub-path. Every emitted `<script>` and `<link>` href is absolute against the domain root, so `https://user.github.io/my-app/` requests `https://user.github.io/assets/index-abc.js`. Fix: `base` must match the deployment sub-path, and it must be set **at build time** — it is baked into the emitted HTML and asset URLs, so it cannot be corrected by a hosting setting afterwards. See [15 · Deployment considerations](../15-deployment-considerations/01-shipping-the-build.md).

**★ Symptom: a secret appears in the shipped JS after being passed through `define`.** Cause: `define` is a literal text substitution performed during the build; whatever you substitute in is the bundle's contents, in plaintext, viewable in DevTools by anyone. Fix: `define` is for genuinely public build-time constants — a version string, a public feature flag. There is no client-side hiding place for a secret, and a build-time substitution is the *least* hidden of all the bad options, because it survives into a file the browser downloads and caches.

**★ Symptom: you branch on `command === 'build'` to mean "production" and a staging build gets production behaviour.** Cause: `command` answers *which Vite invocation is running* (`serve` or `build`), and `mode` answers *which environment configuration applies*. `vite build --mode staging` has `command === 'build'` and `mode === 'staging'`. They are orthogonal on purpose. Fix: branch on `command` for things that are genuinely about serving-versus-bundling (a dev-only proxy), and on `mode` for things that are about environment (API base URLs, feature flags). Mixing them is why "it went to the production API from staging" happens. Mode also drives which `.env` files load — see [07 · Env variables and modes](../07-env-variables-and-modes/01-environment-system.md).

**★ Symptom: a config escape hatch that names esbuild stops behaving after a Vite 8 upgrade.** Cause: the toolchain moved — *"Vite 8 uses Rolldown and Oxc based tools instead of esbuild and Rollup."* Fix: audit every config key whose **name contains a tool** rather than a concept. ⚠️ I did not enumerate which esbuild-named config keys survive into Vite 8, so this gotcha tells you where to look, not what you will find.

**★ Symptom: a file you put in `publicDir` never gets cache-busted and users see a stale copy for weeks.** Cause: `publicDir` contents are copied verbatim to the output root — no hashing, no import-graph analysis, no transformation. That is the whole point of the directory, and it is also its cost. Fix: only put things there that *must* have a fixed path (`robots.txt`, `favicon.ico`, a `manifest.json` some third party fetches at an exact URL). Anything referenced from source belongs in the import pipeline, where it gets a content hash. Full treatment in [06 · Asset handling](../06-asset-handling/01-static-asset-imports.md).

**⚠️ Not re-checked in the 2026-09-06 pass.** The defaults given above for `root` (current working directory), `base` (`/`), `publicDir` and `envDir`, and the `{ command, mode }` parameter list of the function form, were not re-fetched against the shared-options reference in this validation pass — the config-reference page was outside the fetch budget. They are unchanged from the page's original authoring and no source contradicted them; confirm against [vite.dev/config/shared-options](https://vite.dev/config/shared-options) before relying on an exact default.

## Interview questions

**★ What does `defineConfig()` actually do at runtime?**
Nothing. It is an identity function — it returns the object (or the function) you hand it, unchanged. Its entire value is at author time: it carries the config type, and it carries the overloads, so an editor knows whether you passed a plain object or a `({ command, mode }) => config` function and completes accordingly. `export default { ... }` is functionally identical. The reason every example uses `defineConfig` anyway is that Vite's config surface is large and mostly optional, so the failure mode of a typo is not an error — it is an option that silently does not exist and therefore silently does nothing.

**★ Where does Vite look for `vite.config.ts`, and can a setting inside it change that?**
It looks inside the project root — *"Vite will also resolve its config file (i.e. `vite.config.js`) inside the project root."* And no, nothing inside the file can change that, which is worth being able to explain rather than just assert: the file must be located, transpiled and executed before any of its contents exist as values, so `root` in the config describes where *source* lives, not where the *config* lives. The two knobs that genuinely move config resolution are both on the command line: `--root`, which moves the project root that gets searched, and `--config`, which names the file directly and skips the search.

**★ When do `command` and `mode` disagree, and why does the distinction exist?**
`command` is `'serve'` or `'build'` — it says which invocation you are in. `mode` defaults to `development` for serve and `production` for build, but it is independently settable, so `vite build --mode staging` gives you `command: 'build'` with `mode: 'staging'`, and `vite --mode production` gives you `command: 'serve'` with `mode: 'production'`. The distinction exists because two genuinely different questions were being conflated: "am I bundling or serving?" (which decides whether a dev proxy makes sense) and "which environment's configuration applies?" (which decides which API you talk to). Collapsing them is how a staging build ends up pointed at production.

**★ Why is `define` the wrong place for a secret, when injecting environment variables at build time is otherwise normal practice?**
Because `define` does a literal source-text substitution and the result is the bundle. There is no indirection, no runtime lookup, no server round trip — the string sits in a `.js` file the browser downloads, caches, and will happily show in DevTools or in a sourcemap. The reason it feels safe is that the *authoring* looks server-side: you read `process.env.API_SECRET` in a Node process, in a config file, at build time. But the output is client-side, and "the code that read the secret ran on a server" is not the same claim as "the secret stayed on the server". Anything that must stay secret has to be used by code the client never receives.

**★ Why does the function form of the config exist at all, rather than just reading `process.env` at the top of the file?**
Because `process.env` at module scope tells you about the shell, not about the invocation. The function form is called by Vite *after* it has resolved which command is running and which mode applies, including mode resolution from CLI flags — so it is the only place where you can branch on facts Vite has decided rather than facts you have guessed. It is also the only form that can branch cleanly on `command`, which has no environment-variable equivalent at all; there is no `process.env` value that tells you whether the user typed `vite` or `vite build`.

**Why must `base` be decided at build time rather than configured on the host?**
Because `base` is not a server setting — it is a string compiled into the emitted `index.html`, into every asset URL the bundler rewrites, and into the runtime value the app uses to construct further URLs. By the time a host is serving those files, the paths inside them are already literal. This is the practical consequence of the dev/build split: in dev, paths are resolved live by a server that can be told anything; in the build, they were frozen at bundle time by a tool that had to be told at bundle time.

---

← [CLI & Project Scaffolding](../02-cli-and-scaffolding/01-commands-and-templates.md) · [Vite overview](../../README.md) · Next → [Dev Server Mechanics](../04-dev-server-mechanics/01-native-esm-and-hmr.md)
