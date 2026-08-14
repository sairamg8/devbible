---
title: "`webpack-dev-server` & Hot Module Replacement"
sidebar_label: "`webpack-dev-server` & Hot Module Replacem"
sidebar_position: 1
---

# ⚙️ `webpack-dev-server` & Hot Module Replacement

## 1. Under-The-Hood Mechanics

`webpack-dev-server` runs Webpack in **watch mode**, serving bundles from **memory** (never touching disk) over a local HTTP server, with a WebSocket connection pushing update notifications to the browser.

```
File changed on disk
        │
        ▼
Webpack recompiles the affected module(s) ──► produces an UPDATED chunk in memory
        │
        ▼
dev-server pushes a message over its WebSocket connection to the browser's HMR runtime client
        │
        ▼
Browser's HMR runtime fetches the new module chunk, and either:
   ├── module.hot.accept() handler exists for that module ──► swap the module in-place, re-run dependents
   └── no accept() handler anywhere up the chain ──► HMR runtime falls back to a FULL PAGE RELOAD
```

### HMR vs Live Reload — a Real Distinction
**Live reload** always does a full page refresh on any file change — simple, always correct, but destroys all in-memory component/application state (a half-filled form, an expanded accordion, redux devtools history). **HMR** swaps only the changed module in-place, preserving state elsewhere in the app — this is what makes React Fast Refresh able to update a component's rendered output while keeping its `useState` values intact across the edit.

### `devServer.proxy`
Routes specific paths (typically `/api/*`) to a separate backend server during development, so the frontend dev server and a locally-running backend can coexist on different ports without the frontend code needing environment-specific `fetch` base URLs, and without CORS configuration on the backend.

### `historyApiFallback`
For client-side-routed SPAs, a direct browser navigation to `/dashboard/settings` would 404 against the dev server's in-memory file map (no such file exists) — `historyApiFallback: true` rewrites any unmatched route request back to `index.html`, letting the client-side router take over and render the correct view from the URL.

---

## 2. Real-World Engineering Scenario

**Scenario**: React App With a Local Express Backend, SPA Routing, and Fast Refresh.
A developer runs the frontend on `localhost:3000` and a backend API on `localhost:4000`. `devServer.proxy` forwards `/api/**` requests transparently to `4000`, so frontend code can call `fetch('/api/users')` identically in dev and production (where a reverse proxy does the equivalent routing). `historyApiFallback` lets deep-linking to `/dashboard/settings` work correctly on a hard refresh. React Fast Refresh (built on HMR's `module.hot.accept` primitive) means editing a component's JSX updates the browser instantly while any active `useState` (e.g. a form the developer was mid-testing) survives the edit.

---

## 3. Production-Grade Code Example

```javascript
// webpack.config.js
module.exports = {
  devServer: {
    port: 3000,
    hot: true, // enables HMR (not just live reload)
    historyApiFallback: true, // SPA client-side routing support
    proxy: [
      {
        context: ['/api'],
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    ],
    client: {
      overlay: { errors: true, warnings: false }, // show compile errors in-browser, not just terminal
    },
  },
  plugins: [
    // React Fast Refresh plugin registers the module.hot.accept() boundaries automatically per component
    new (require('@pmmmwh/react-refresh-webpack-plugin'))(),
  ],
};
```

```javascript
// A manually-authored HMR boundary for a non-React module (e.g. a vanilla state manager)
if (module.hot) {
  module.hot.accept('./store.js', () => {
    // Re-run only the code that depends on store.js's exports, WITHOUT reloading the whole page
    const newStore = require('./store.js');
    app.updateStore(newStore);
  });
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Assuming HMR "Just Works" Without Any `module.hot.accept()` Boundary
For non-framework-integrated code (plain JS modules, not React components handled by Fast Refresh), HMR silently falls back to a full page reload if no module up the dependency chain calls `module.hot.accept()` — a common source of "why isn't HMR working, it's just doing full reloads" confusion. Fast Refresh handles this automatically for React components; hand-written vanilla modules need their own explicit `accept()` call.

### ⚠️ Pitfall 2: `historyApiFallback` Masking a Genuinely Broken Static Asset Path
Because any unmatched request falls back to `index.html`, a typo'd image/font path (`/asets/logo.png`) doesn't 404 the way it would in production — it silently serves the SPA's HTML instead, which can mask broken asset references during development that only surface as real 404s once deployed to a production server without the same fallback behavior.

### ⚠️ Pitfall 3: Proxying WebSocket Endpoints Without `ws: true`
```javascript
// ❌ WRONG: default proxy config only forwards HTTP, not WebSocket upgrade requests —
// a backend WebSocket endpoint silently fails to connect through the dev proxy
{ context: ['/socket'], target: 'http://localhost:4000' },

// ✅ CORRECT: explicitly enable WebSocket proxying for ws:// endpoints
{ context: ['/socket'], target: 'http://localhost:4000', ws: true },
```
