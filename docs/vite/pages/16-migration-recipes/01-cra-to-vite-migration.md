---
title: "Migration Recipe: Create React App \u2192 Vite"
sidebar_label: "Migration Recipe: Create React App \u2192 Vite"
sidebar_position: 1
---

# ⚡ Migration Recipe: Create React App → Vite

## 1. Under-The-Hood Mechanics

CRA (`react-scripts`) and Vite solve the same problem — "run and bundle a React app" — with **opposite architectural defaults**, which is why this migration is a set of structural changes, not a dependency swap:

```text
CRA (Webpack, bundle-then-serve)          Vite (native ESM, serve-then-transform)
public/index.html  ──entry──►             index.html  ──MOVES TO PROJECT ROOT, becomes the entry──►
  %PUBLIC_URL% placeholders                  plain relative paths, no placeholder needed
process.env.REACT_APP_*  ──env──►         import.meta.env.VITE_*
Webpack DefinePlugin polyfills `process`   `process` is NOT defined by default in the browser
Built-in Jest test runner                  No built-in test runner — Vitest (reuses vite.config.ts) is the natural pick
```

The single biggest structural change: CRA's entry HTML lives at `public/index.html` and is templated by Webpack; **Vite's `index.html` lives at the project root** and is itself the literal entry point Vite reads to discover your app's script tag — this isn't a config option, it's how Vite's dev server bootstraps the module graph.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Two-Year-Old CRA Dashboard App With Slow Cold Starts, Migrating Incrementally.
A dashboard app built on CRA has grown to the point where `npm start`'s cold start takes 45+ seconds and HMR updates lag noticeably — both symptoms of Webpack needing to bundle the entire dependency graph before serving anything, which Vite's native-ESM dev server avoids entirely. Rather than migrating everything at once, the team does it in a working session: get the app booting under Vite first (accepting some rough edges), then fixes SVG imports, env vars, and path aliases one category at a time, running the app after each category to catch breakage immediately rather than debugging a pile of unrelated changes at the end.

---

## 3. Production-Grade Migration Sequence

```bash
# 1. Remove CRA, install Vite + the React plugin 🟢
npm uninstall react-scripts
npm install --save-dev vite @vitejs/plugin-react

# 2. Move index.html from public/ to the PROJECT ROOT, and point it at your entry script directly
#    (CRA never required this — Webpack handled entry resolution via webpack.config internally)
mv public/index.html index.html
```

```html
<!-- BEFORE: public/index.html (CRA) -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
  </head>
  <body>
    <div id="root"></div>
    <!-- react-scripts injects the bundled script tag automatically at build time -->
  </body>
</html>
```

```html
<!-- AFTER: index.html (Vite, at project ROOT) -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <!-- %PUBLIC_URL% is gone entirely — public/ assets are just referenced by plain root-relative path -->
    <link rel="icon" href="/favicon.ico" />
  </head>
  <body>
    <div id="root"></div>
    <!-- Vite's entry is an EXPLICIT module script tag pointing at your actual entry file -->
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```typescript
// 3. vite.config.ts — the Webpack-config equivalent
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()], // Fast Refresh, JSX transform — CRA's babel-preset-react-app equivalent
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }, // CRA's automatic jsconfig baseUrl resolution -> explicit alias
  },
  server: {
    proxy: {
      // CRA's simple package.json "proxy": "http://localhost:5000" -> explicit path-pattern proxy config
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
});
```

```json
// 4. package.json scripts
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

```bash
# 5. Environment variables: rename the PREFIX everywhere (.env files AND source code references)
# REACT_APP_API_URL=https://api.acme.com   ->   VITE_API_URL=https://api.acme.com
```

```typescript
// BEFORE (CRA): process.env.REACT_APP_API_URL
// AFTER (Vite):
const apiUrl = import.meta.env.VITE_API_URL;
```

```tsx
// 6. SVG-as-component imports: CRA's react-scripts had this built in; Vite does NOT by default
// BEFORE (CRA, built-in):
// import { ReactComponent as Logo } from './logo.svg';

// AFTER: install vite-plugin-svgr, add it to vite.config.ts plugins, then use the ?react suffix
import Logo from './logo.svg?react';
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: A Dependency Crashes With "process is not defined"
```text
❌ Webpack's DefinePlugin (via react-scripts) replaced `process.env.NODE_ENV` references
throughout your OWN code AND third-party packages' code automatically. Vite does the same for
`import.meta.env`-based code, but does NOT define a global `process` object at all — any
dependency (often an older npm package) that reads `process.env.SOMETHING` directly at runtime
throws "process is not defined" in the browser under Vite, a failure mode that never happened
under Webpack.
```
**Fix**: either patch/upgrade the offending dependency, or add a targeted shim in `vite.config.ts`:
```typescript
export default defineConfig({
  define: { 'process.env': {} }, // minimal shim — only if a dependency truly requires SOME process.env to exist
});
```

### ⚠️ Pitfall 2: `tsconfig.json` Paths Configured, But Imports Still Fail at Runtime
```typescript
// ❌ Only updating tsconfig.json's "paths" fixes the TYPE CHECKER, not actual module resolution —
// Vite's dev server and build still don't know about the alias, so imports fail at runtime
// despite `tsc --noEmit` passing cleanly
{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }

// ✅ CORRECT: resolve.alias in vite.config.ts is what ACTUALLY makes the alias work at
// runtime/build; tsconfig paths only satisfies the type-checker. Both are required, kept in sync.
```

### ⚠️ Pitfall 3: CRA's Built-In Jest Setup Doesn't Carry Over
CRA bundled Jest configuration invisibly inside `react-scripts test` — there's no `jest.config.js` to migrate because it never existed as a visible file. Moving to Vite means explicitly adopting a test runner; **Vitest** is the natural choice specifically because it reuses `vite.config.ts`'s own transform pipeline (same JSX/TS handling, same aliases, same plugins) rather than needing a second, separately-configured toolchain — but this is a genuinely new setup step, not a file copy.

### ⚠️ Pitfall 4: Assuming `public/` Behavior Changed Too
Unlike `index.html`, the `public/` directory's role is **unchanged** — files placed there are still served as-is at the root path, uncached and unprocessed, in both CRA and Vite. Don't spend migration effort "fixing" `public/` asset references beyond removing the now-unnecessary `%PUBLIC_URL%` prefix in `index.html` itself.
