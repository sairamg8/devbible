---
title: "Source Maps & Debugging Babel Output"
sidebar_label: "Source Maps & Debugging Babel Output"
sidebar_position: 1
---

# 🗺️ Source Maps & Debugging Babel Output

Covers syllabus **§10.1 Source Map Generation** and **§10.2 Debugging Transform Output**.

## 1. Concept & Under-the-Hood Mechanics

### 10.1 Source Map Generation

Babel options (conceptual):

| Value | Behavior |
| --- | --- |
| `sourceMaps: true` | External map alongside code (integration-dependent) |
| `'inline'` | Map as data URL comment |
| `'both'` | External + inline (heavy) |
| `false` | No maps |

Webpack/Vite must be configured so **loader maps compose** with bundler `devtool` / `build.sourcemap`. Mismatched settings yield “wrong line in DevTools.”

### 10.2 Debugging Transforms

- **`@babel/cli`** — `babel src --out-dir lib` to inspect emit without the bundler  
- **AST Explorer** (babel parser/transform) — prototype visitors before writing plugins  
- Diff before/after when changing preset-env targets or removing plugins  

---

## 2. Real-World Engineering Scenario

**Scenario: production stack traces point at minified bundle only.**

`sourceMaps` disabled in babel-loader for “speed,” Webpack `devtool: false` in prod. Incident response blind. Fix: upload external maps to the error tracker; keep maps out of public CDN if secrets concern—most teams upload privately to Sentry/Datadog.

---

## 3. Production-Grade Code Example

```bash
pnpm add -D @babel/core @babel/cli @babel/preset-env
npx babel src/index.ts --out-file /tmp/out.js --source-maps both \
  --presets @babel/preset-typescript,@babel/preset-env
```

```js
// babel-loader options
{
  loader: 'babel-loader',
  options: {
    sourceMaps: true,
    cacheDirectory: true,
  },
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Inline maps in production bundles
Huge payloads—prefer external maps for prod.

### ⚠️ Debugging plugins only inside the full Next build
Use CLI isolation first.

### ⚠️ Assuming Vite always uses Babel maps
If SWC/esbuild path is active, Babel map settings never run.

### ⚠️ Map path `sources` wrong with monorepo roots
Breaks editor “open file” from DevTools—check `sourceRoot` / bundler source map settings.
