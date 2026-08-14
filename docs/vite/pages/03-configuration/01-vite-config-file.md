---
title: "Configuration: `vite.config.ts`, `defineConfig()` & Conditional Config"
sidebar_label: "Configuration"
sidebar_position: 1
---

# ⚡ Configuration: `vite.config.ts`, `defineConfig()` & Conditional Config

## 1. Under-The-Hood Mechanics

`vite.config.ts` is itself executed by Vite's own Node-based config loader (using esbuild to transpile TypeScript on the fly) **before** either the dev server or the build process starts — meaning the config file's own execution is a distinct, earlier step from anything it configures.

```
vite.config.ts loaded & executed (Node process, esbuild-transpiled if TS)
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
```
❌ MISUNDERSTANDING: `root` controls where Vite looks for index.html/source files —
it does NOT relocate where vite.config.ts is expected to live; the config file itself
is always resolved relative to the current working directory (or via --config), independently

✅ AWARENESS: root and the config file's own location are two SEPARATE concerns
```

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
