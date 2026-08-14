---
title: "Module Federation Fundamentals: Containers, `remotes` & `exposes`"
sidebar_label: "Module Federation Fundamentals"
sidebar_position: 1
---

# ⚙️ Module Federation Fundamentals: Containers, `remotes` & `exposes`

## 1. Under-The-Hood Mechanics

Module Federation lets **independently built and independently deployed** Webpack bundles load modules from each other **at runtime**, over the network — not at build time. This is the mechanism that makes true micro-frontends possible: Team A's app can consume Team B's `<Button>` component without Team A's build ever needing Team B's source code, without a shared monorepo, and without redeploying Team A's app when Team B ships a fix.

```
Remote App (design-system)                       Host App (checkout)
        │                                                  │
   ModuleFederationPlugin({                          ModuleFederationPlugin({
     name: 'design_system',                              name: 'checkout',
     filename: 'remoteEntry.js',                          remotes: {
     exposes: {                                              design_system: 'design_system@https://ds.acme.com/remoteEntry.js',
       './Button': './src/Button',                        },
     },                                                  })
   })
        │                                                  │
        ▼                                                  ▼
  Emits remoteEntry.js ──────── fetched over HTTP at runtime ────────► import('design_system/Button')
  (a small manifest + container                                          resolves the ACTUAL Button module
   runtime, NOT the whole app)                                            from the remote's bundle, live
```

### `exposes`: What a Remote Offers
Each entry maps a **public import path** (what consumers will `import('design_system/Button')` as) to a **local module path** in the remote's own source. Only explicitly listed modules are reachable from outside — everything else in the remote's bundle stays private, exactly like a package's exports map.

### `remotes`: What a Host Consumes
Each entry names a remote and points at its `remoteEntry.js` URL: `'design_system@https://ds.acme.com/remoteEntry.js'`. The `@` syntax is a runtime-resolvable pointer, not a build-time import — this is precisely why the host doesn't need the remote's source code available at all during its own build.

### The Container Runtime
`remoteEntry.js` is not the remote app's actual code — it's a small **container** exposing a runtime API (`get(module)`, `init(shareScope)`) that, when called, dynamically fetches the *actual* requested module's chunk on demand. This is why consuming one exposed component doesn't download the remote's entire bundle — only the chunk(s) that component's code actually needs.

### Eager vs Lazy Remote Loading
A `remotes` entry resolves **lazily** by default — the remote's `remoteEntry.js` is fetched only when a federated `import()` for it actually executes. `import('design_system/Button')` (dynamic `import()`, not a static top-level `import`) is required for this laziness — a static import of a federated module forces eager resolution, defeating on-demand loading.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Design System Team Shipping Component Updates Without Coordinating Deploys With Every Consuming Team.
A design system team owns `Button`, `Modal`, and `DataTable` components used by 12 different product teams' apps. Before Module Federation, shipping a bug fix meant publishing an npm package version, then waiting for (or nagging) all 12 teams to bump their dependency and redeploy. With Module Federation, the design system team deploys their remote once; every host app's next page load fetches the updated `remoteEntry.js` and gets the fix automatically — no consuming team needs to rebuild or redeploy anything, because the federated module resolution happens live, in the browser, at runtime.

---

## 3. Production-Grade Code Example

```javascript
// design-system/webpack.config.js — the REMOTE
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

module.exports = {
  mode: 'production',
  output: { publicPath: 'https://ds.acme.com/' }, // MUST be an absolute, correct public URL for a remote
  plugins: [
    new ModuleFederationPlugin({
      name: 'design_system',
      filename: 'remoteEntry.js',
      exposes: {
        './Button': './src/components/Button.tsx',
        './Modal': './src/components/Modal.tsx',
        './DataTable': './src/components/DataTable.tsx',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
    }),
  ],
};
```

```javascript
// checkout-app/webpack.config.js — the HOST
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'checkout',
      remotes: {
        design_system: 'design_system@https://ds.acme.com/remoteEntry.js',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
    }),
  ],
};
```

```tsx
// checkout-app/src/CheckoutPage.tsx — consuming a federated module lazily
import { lazy, Suspense } from 'react';

// The path 'design_system/Button' is resolved AT RUNTIME against the remotes config above —
// Webpack's build-time compiler has NO idea what this module's actual contents are
const Button = lazy(() => import('design_system/Button'));

export function CheckoutPage() {
  return (
    <Suspense fallback={<ButtonSkeleton />}>
      <Button label="Complete Purchase" />
    </Suspense>
  );
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Relative `publicPath` on a Remote
```javascript
// ❌ WRONG: a relative or 'auto' publicPath resolves against the HOST page's URL when the remote's
// chunks are fetched, not the remote's OWN origin — chunk fetches 404 against the wrong domain entirely
module.exports = { output: { publicPath: 'auto' } }, // in a REMOTE'S config

// ✅ CORRECT: a remote's publicPath must be an absolute URL to where ITS OWN files are actually hosted
module.exports = { output: { publicPath: 'https://ds.acme.com/' } },
```

### ⚠️ Pitfall 2: Static Import of a Federated Module
```tsx
// ❌ WRONG: a static top-level import forces eager, build-time-adjacent resolution of the federated
// module, which defeats the whole "load on demand, independently deployed" premise of Module Federation
import Button from 'design_system/Button';

// ✅ CORRECT: dynamic import() is what triggers genuinely lazy, runtime resolution against remoteEntry.js
const Button = lazy(() => import('design_system/Button'));
```

### ⚠️ Pitfall 3: Forgetting a Remote's `exposes` Path Must Match What Hosts Actually Import
The string on the left of `exposes: { './Button': ... }` **is** the import path consumers use (`design_system/Button`, stripping the leading `.`) — renaming an exposed path without coordinating with every consuming host breaks those hosts' federated imports at runtime with a cryptic "Module not found" error that only surfaces when a user's browser actually tries to load that specific route, not at any host's build time (since the host's build never validates the remote's actual exposed surface).
