---
title: "Plugin System: Rollup Compatibility, Vite-Specific Hooks & Ordering"
sidebar_label: "Plugin System"
sidebar_position: 1
---

# ⚡ Plugin System: Rollup Compatibility, Vite-Specific Hooks & Ordering

## 1. Under-The-Hood Mechanics

Vite's plugin system is explicitly built as a **superset** of the Rollup plugin interface — any valid Rollup plugin already works in Vite's production build unmodified, and Vite adds its own additional hooks specifically for dev-server-only concerns Rollup's model has no equivalent for.

```
Vite Plugin = Rollup Plugin interface (resolveId, load, transform, ...)
                      +
              Vite-specific hooks:
                config            ──► modify the resolved config BEFORE it's finalized
                configResolved      ──► read the FINAL, fully-resolved config (read-only at this point)
                configureServer       ──► access/extend the dev server's underlying connect/middleware instance
                transformIndexHtml      ──► transform the served/built index.html specifically
```

### `enforce`: Controlling Execution Order Relative to Core Processing
By default, plugins run in the order listed, interleaved with Vite's own core transforms (like the framework plugin's JSX handling). `enforce: 'pre'` runs a plugin **before** core Vite transforms (useful for a plugin that needs to see/modify source before any built-in processing); `enforce: 'post'` runs **after** (useful for a plugin operating on already-transformed output, like a final HTML post-processor).

### `apply`: Restricting a Plugin to Dev-Only or Build-Only
`apply: 'serve'` or `apply: 'build'` scopes a plugin to run **only** during that specific command — appropriate for plugins whose logic is meaningless (or actively harmful) in the other context, e.g. a plugin injecting dev-only debugging tools that should never run as part of an actual production build.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Custom Plugin Injecting a Dev-Only Debug Toolbar Into `index.html`, Never Reaching Production.
A team wanted a debug toolbar script injected into `index.html` during local development (showing build info, active feature flags) but absolutely never wanted it to leak into a production build by accident. A custom plugin using `transformIndexHtml` to inject the toolbar's `<script>` tag, combined with `apply: 'serve'`, guaranteed the injection logic **only ever runs** during `vite` (dev server) — the plugin is structurally incapable of affecting a `vite build` output at all, rather than relying on a runtime `if (import.meta.env.DEV)` check that could theoretically still leave dead code paths in a production bundle.

---

## 3. Production-Grade Code Example

```typescript
// plugins/debug-toolbar.ts — a custom plugin using Vite-specific hooks
import type { Plugin } from 'vite';

export function debugToolbarPlugin(): Plugin {
  return {
    name: 'debug-toolbar',
    apply: 'serve', // ONLY runs during `vite` (dev server) — structurally excluded from `vite build`

    transformIndexHtml(html) {
      return html.replace(
        '</body>',
        `<script type="module" src="/@debug-toolbar/inject.js"></script></body>`
      );
    },

    configureServer(server) {
      // Extend the dev server's middleware to serve the toolbar's own script
      server.middlewares.use('/@debug-toolbar/inject.js', (req, res) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.end(`console.log('Debug toolbar active. Mode:', import.meta.env?.MODE);`);
      });
    },
  };
}
```

```typescript
// vite.config.ts — wiring the custom plugin alongside official ones, with explicit ordering
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { debugToolbarPlugin } from './plugins/debug-toolbar';

export default defineConfig({
  plugins: [
    react(),
    debugToolbarPlugin(), // apply: 'serve' means this is a no-op during `vite build`, by construction
  ],
});
```

```typescript
// A plugin using `enforce: 'pre'` to run before Vite's own core transforms
function rawSqlPlugin(): Plugin {
  return {
    name: 'raw-sql-loader',
    enforce: 'pre', // must run BEFORE core transforms attempt to parse .sql files as JS
    transform(code, id) {
      if (id.endsWith('.sql')) {
        return `export default ${JSON.stringify(code)};`; // turn raw SQL into an importable string module
      }
    },
  };
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting `apply` on a Dev-Only Plugin, Leaking Debug Code Into Production
```typescript
// ❌ RISKY: without apply: 'serve', this plugin's transformIndexHtml ALSO runs during
// `vite build` — a debug toolbar script tag ends up in the actual production HTML
export function debugToolbarPlugin(): Plugin {
  return { name: 'debug-toolbar', transformIndexHtml(html) { /* injects debug script, ALWAYS */ } };
}

// ✅ CORRECT: explicitly scope dev-only plugins with apply: 'serve'
export function debugToolbarPlugin(): Plugin {
  return { name: 'debug-toolbar', apply: 'serve', transformIndexHtml(html) { /* ... */ } };
}
```

### ⚠️ Pitfall 2: Assuming Plugin Order Doesn't Matter
```typescript
// ❌ WRONG: two plugins both transforming the same file type, in the wrong order, can
// produce broken output — e.g. a plugin expecting RAW source running AFTER another
// plugin has already transformed that source into something unrecognizable
plugins: [alreadyTransformsSql(), rawSqlPlugin()], // rawSqlPlugin never sees genuinely raw .sql content

// ✅ CORRECT: use enforce: 'pre'/'post' deliberately when relative ordering to CORE Vite
// transforms matters, and be mindful of plain array order for plugin-to-plugin ordering
```

### ⚠️ Pitfall 3: A Custom `resolveId`/`load` Hook Not Handling Both Dev and Build Consistently
A plugin's `resolveId`/`load`/`transform` hooks run in **both** the dev server and the production build (unless scoped via `apply`) — a hook that behaves correctly under Rollup's build-time module resolution but makes assumptions that don't hold for the dev server's on-demand, per-file resolution (or vice versa) can produce a plugin that "works in dev but breaks the build" or vice versa — always test a custom plugin against both `vite` and `vite build`, not just whichever one was being actively developed against.
