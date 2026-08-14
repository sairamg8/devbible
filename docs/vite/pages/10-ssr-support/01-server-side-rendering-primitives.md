---
title: "SSR Support: Middleware Mode, `ssrLoadModule()` & SSR Manifests"
sidebar_label: "SSR Support"
sidebar_position: 1
---

# ⚡ SSR Support: Middleware Mode, `ssrLoadModule()` & SSR Manifests

## 1. Under-The-Hood Mechanics

Vite provides low-level primitives for building a custom SSR setup on top of a Node server — deliberately unopinionated compared to a full framework (like Next.js), giving direct control for teams building their own SSR pipeline rather than adopting a framework's built-in one.

```
Custom Node server (Express/Fastify/etc.)
        │
        ▼
server.middlewareMode: true  ──► Vite runs as MIDDLEWARE inside YOUR server, not as its own standalone dev server
        │
        ▼
vite.ssrLoadModule('/src/entry-server.tsx')  ──► loads and transforms a module IN SSR CONTEXT during dev,
                                                     applying the same on-demand transform pipeline as
                                                     client-side dev serving, but for server-side execution
        │
        ▼
(at build time) build.ssrManifest: true  ──► generates ssr-manifest.json, mapping each module to the
                                                asset chunks it depends on — used to correctly inject
                                                <link rel="preload"> tags for exactly what a given
                                                SSR-rendered page actually needs, no more, no less
```

### `server.middlewareMode`: Vite as a Library, Not a Standalone Server
In this mode, Vite doesn't start its own HTTP server at all — instead, it exposes a `connect`-compatible middleware function that a custom Express/Fastify/etc. server mounts directly, letting that custom server own routing/request handling while still getting Vite's dev-time module transformation for anything it explicitly asks Vite to handle.

### `ssrLoadModule()`: The Dev-Time SSR Entry Point
Since native ESM `import()` in Node doesn't go through Vite's transform pipeline automatically, `ssrLoadModule()` is the explicit hook a custom dev server uses to load the app's server-rendering entry module **through** Vite's transforms (JSX, TS stripping, etc.) — without it, Node would fail trying to execute untransformed JSX/TS source directly.

### SSR Manifest: Correct Preload Injection, Automatically Derived
Rather than a hand-maintained mapping of "which JS/CSS chunks does this particular SSR-rendered route actually need," `build.ssrManifest: true` has Vite generate this mapping automatically from the actual build's module graph — a custom SSR server reads this manifest to inject exactly the right `<link rel="preload">` tags per rendered page, avoiding both under-preloading (missing needed chunks) and over-preloading (wastefully preloading chunks that page doesn't use).

---

## 2. Real-World Engineering Scenario

**Scenario**: A Team Building a Custom SSR Setup on Express, Needing Dev-Mode HMR to Work Alongside Server-Rendered Pages.
A team chose to hand-build their SSR pipeline on Express (rather than adopting a full framework) for specific routing/middleware needs unique to their infrastructure. `server.middlewareMode: true` let Vite's dev-time transform pipeline (HMR, on-demand ESM serving) run **inside** their existing Express server, rather than requiring a separate Vite dev server process — `ssrLoadModule()` loaded their `entry-server.tsx` fresh on every request during development (picking up live edits immediately, matching Vite's usual HMR experience), while the actual production build used the generated SSR manifest to correctly preload each page's real dependencies.

---

## 3. Production-Grade Code Example

```typescript
// server.ts — a custom Express server using Vite in middleware mode
import express from 'express';
import { createServer as createViteServer } from 'vite';

async function createServer() {
  const app = express();

  const vite = await createServer({
    server: { middlewareMode: true }, // Vite provides transforms, Express owns the actual HTTP server
    appType: 'custom',
  });
  app.use(vite.middlewares);

  app.use('*', async (req, res) => {
    try {
      // Load the server entry FRESH on every request during dev — picks up live edits immediately
      const { render } = await vite.ssrLoadModule('/src/entry-server.tsx');
      const appHtml = await render(req.originalUrl);
      const template = await vite.transformIndexHtml(req.originalUrl, await getIndexHtmlTemplate());
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template.replace('<!--app-html-->', appHtml));
    } catch (err) {
      vite.ssrFixStacktrace(err); // maps the error's stack trace back to ORIGINAL source, not transformed output
      res.status(500).end(err.stack);
    }
  });

  app.listen(3000);
}

createServer();
```

```typescript
// vite.config.ts — enabling SSR manifest generation for the production build
export default defineConfig({
  build: {
    ssrManifest: true, // generates ssr-manifest.json — maps modules to their actual asset chunks
  },
});
```

```typescript
// server-prod.ts (simplified) — using the generated manifest to inject CORRECT preload tags
import manifest from './dist/client/ssr-manifest.json';

function renderPreloadLinks(modules: string[]): string {
  const files = modules.flatMap((id) => manifest[id] || []); // ONLY the chunks this specific render actually used
  return [...new Set(files)].map((file) => `<link rel="modulepreload" href="${file}">`).join('');
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting `ssrFixStacktrace()`, Getting Useless Production-Mapped Stack Traces During Dev
```typescript
// ❌ WRONG: without this call, an error thrown during SSR rendering shows a stack trace
// pointing at Vite's INTERNAL transformed output, not the original TSX/JSX source —
// makes debugging a server-render error during development needlessly difficult
} catch (err) {
  res.status(500).end(err.stack); // unhelpful, transformed-code stack trace
}

// ✅ CORRECT: let Vite remap the stack trace back to original source first
} catch (err) {
  vite.ssrFixStacktrace(err);
  res.status(500).end(err.stack); // now points at the ACTUAL source file/line
}
```

### ⚠️ Pitfall 2: Using `ssrLoadModule()` in Production, Not Just Development
```
❌ WRONG: ssrLoadModule() is a DEV-TIME-ONLY mechanism — it re-transforms modules on demand,
which is exactly what makes it slow relative to just running pre-built, pre-bundled server
code directly in production. Production SSR should import the ALREADY-BUILT server bundle
(produced by `vite build --ssr`) directly via Node's normal require()/import, NOT ssrLoadModule().

✅ CORRECT: branch server startup logic on environment — dev uses ssrLoadModule() against
live source, production imports the pre-built dist/server output directly
```

### ⚠️ Pitfall 3: Forgetting the SSR Manifest Only Reflects the LAST Production Build
The `ssr-manifest.json` is generated once, at build time — a custom server reading it needs to be restarted (or re-read it fresh) after any new deploy/build, since it's a static artifact tied to that specific build's chunk hashes, not something that stays valid indefinitely or updates itself as the underlying source changes.
