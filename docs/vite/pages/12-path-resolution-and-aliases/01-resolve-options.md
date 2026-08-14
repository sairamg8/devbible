---
title: "Path Resolution & Aliases: `resolve.alias`, `extensions` & `dedupe`"
sidebar_label: "Path Resolution & Aliases"
sidebar_position: 1
---

# ⚡ Path Resolution & Aliases: `resolve.alias`, `extensions` & `dedupe`

## 1. Under-The-Hood Mechanics

Vite's `resolve` options control how bare and relative import specifiers are turned into actual file paths — the same conceptual job as Webpack's `resolve` object (see the [Webpack module resolution doc](../../../webpack/pages/03-module-resolution/01-the-resolve-object.md)), but scoped to Vite's own resolution algorithm.

```typescript
resolve: {
  alias: { '@': '/src' },              // remaps import specifiers — '@/components/Button' → '/src/components/Button'
  extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'], // resolution order for extensionless imports
  dedupe: ['react', 'react-dom'],         // FORCES a single instance, even if multiple copies exist in node_modules
}
```

### `alias`: Must Be Mirrored in `tsconfig.json`'s `paths`
Exactly like the Webpack/TypeScript relationship covered in the TS configuration doc, Vite's `resolve.alias` only affects **actual module resolution at runtime/build time** — it has no effect on TypeScript's own type-checking, which reads `tsconfig.json`'s separate `paths` field. Both must be configured, kept in sync, for an alias to work correctly both for the type-checker and for the actual bundler resolution.

### `dedupe`: Solving the "Two Copies of React" Problem
In a monorepo or a project with multiple dependencies each depending on their own (potentially slightly different) copy of a shared library like React, `node_modules` can end up with **multiple physical copies** of that library nested at different levels — leading to the exact "two React instances, hooks break" class of bug covered in the [Module Federation shared dependencies doc](../../../webpack/pages/11-module-federation/02-shared-dependencies-and-version-negotiation.md), but arising from `node_modules` nesting rather than runtime federation. `dedupe` forces Vite to resolve **every** import of a listed package to the **same single instance**, regardless of how many physically separate copies exist on disk.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Monorepo Where a Shared UI Package's Own React Dependency Caused "Invalid Hook Call" Errors in the Consuming App.
A monorepo's `ui-kit` package listed `react` as its own dependency (rather than strictly as a peer dependency), and due to how the package manager hoisted/nested dependencies, the consuming app ended up with two physically separate copies of `react` in `node_modules` — one used by the app directly, one nested inside `ui-kit`'s own dependency tree. Every component from `ui-kit` using hooks threw "Invalid hook call," since its React instance's internal dispatcher differed from the app's own. Adding `resolve.dedupe: ['react', 'react-dom']` forced Vite to resolve both the app's and `ui-kit`'s `react` imports to the exact same single instance, fixing the error without needing to restructure the monorepo's dependency tree at all.

---

## 3. Production-Grade Code Example

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@ui': path.resolve(__dirname, '../../packages/ui-kit/src'), // pointing at SOURCE for fast monorepo dev
    },
    dedupe: ['react', 'react-dom'], // force ONE instance across the whole resolved graph
  },
});
```

```json
// tsconfig.json — the alias MUST be mirrored here too, for the type-checker/IDE to resolve it correctly
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@ui/*": ["../../packages/ui-kit/src/*"]
    }
  }
}
```

```typescript
// Usage — both aliases resolve correctly, for BOTH the bundler and the type-checker
import { Button } from '@ui/Button';
import { formatDate } from '@/utils/date';
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Configuring `resolve.alias` Without Mirroring It in `tsconfig.json`
```typescript
// ❌ WRONG: this makes the BUNDLER happy (the app runs fine), but the TypeScript compiler/IDE
// has no idea what '@' means, producing "Cannot find module '@/utils/date'" errors in the editor
// despite the app working perfectly at runtime
resolve: { alias: { '@': path.resolve(__dirname, 'src') } }, // vite.config.ts only

// ✅ CORRECT: mirror the SAME alias mapping in tsconfig.json's paths field
// { "compilerOptions": { "paths": { "@/*": ["src/*"] } } }
```

### ⚠️ Pitfall 2: Forgetting `dedupe` Doesn't Retroactively Fix an Already-Installed Duplicate Structure
`dedupe` changes Vite's **resolution** behavior — forcing every import to point at one instance — but it doesn't reorganize `node_modules` itself. If the underlying package manager's hoisting continues to install genuinely incompatible major versions of a deduped package at different levels of the tree, `dedupe` forces them into ONE resolution, which could mean one dependency silently gets a version it wasn't actually tested against, rather than the "duplicate instance" bug being fully solved. For genuinely incompatible version requirements, the proper fix is aligning the actual declared version ranges across the monorepo, not just deduping resolution.

### ⚠️ Pitfall 3: Aliasing a Path That Shadows a Real npm Package Name
```typescript
// ❌ RISKY: naming an internal alias identically to a REAL, currently-or-future npm package name
// (e.g. aliasing '@/utils' to something, when 'utils' is also a real installable package) can cause
// confusing resolution ambiguity, especially if the alias pattern is broad
resolve: { alias: { utils: path.resolve(__dirname, 'src/utils') } }, // 'utils' is a common REAL package name too

// ✅ CORRECT: use a clearly internal-only prefix (like '@/' or '~/') that could never collide
// with a real, publishable npm package name
resolve: { alias: { '@/utils': path.resolve(__dirname, 'src/utils') } },
```
