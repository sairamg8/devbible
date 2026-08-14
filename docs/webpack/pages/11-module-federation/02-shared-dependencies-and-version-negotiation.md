---
title: "Module Federation: Shared Dependencies & Version Negotiation"
sidebar_label: "Module Federation"
sidebar_position: 2
---

# ⚙️ Module Federation: Shared Dependencies & Version Negotiation

## 1. Under-The-Hood Mechanics

The `shared` config is where most real-world Module Federation production incidents originate — it controls whether independently-built apps end up running **one shared copy** or **multiple duplicate copies** of a library like React, with drastically different runtime consequences.

### The Shared Scope: A Runtime Dependency Registry
Every federated app (host or remote) that lists a `shared` dependency registers its version into a shared, in-memory "share scope" the first time it loads. When a second app also needs that same dependency, Module Federation's runtime checks the share scope **before** loading its own bundled copy:

```
Host loads first, registers react@19.0.2 into the shared scope
        │
        ▼
Remote's federated module needs react
        │
        ├── Is a compatible version ALREADY in the shared scope? ──► YES ──► reuse it, don't load remote's own copy
        └──                                                        ──► NO  ──► load the remote's own bundled copy instead
```

### `singleton: true`
Without `singleton: true`, if version ranges don't overlap satisfactorily, Module Federation will happily load **multiple instances** of a library side by side — for most libraries this is fine (isolated, no shared state), but for React specifically, two React instances in the same page means two separate Fiber reconcilers, two separate hook dispatchers — a component rendered by one React instance whose hooks are called by a **different** instance's runtime throws "Invalid hook call" or produces silently broken state. `singleton: true` tells Module Federation: "there must be exactly ONE instance of this library across the whole federated application, even if that means using a slightly different (but semver-compatible) version than what I originally bundled."

### `requiredVersion` & `strictVersion`
`requiredVersion: '^19.0.0'` declares the semver range this app was built and tested against. If the actually-available shared version violates that range, `strictVersion: true` makes this a **hard runtime error** (fail loudly); the default (`strictVersion: false`) only logs a console warning and proceeds anyway with the mismatched version — a deliberately permissive default that has caused more than one silent-until-production bug.

### Eager Shared Dependencies
`shared: { react: { eager: true } }` bundles the dependency directly into the app's initial chunk (defeating some of Module Federation's lazy-loading benefit for that one dependency) — necessary for a **host** app's very first render, since a truly async-loaded React would mean the host's own initial UI can't render until a network round-trip to negotiate the shared scope completes. Remotes, by contrast, almost always want `eager: false` (the default) to stay genuinely on-demand.

---

## 2. Real-World Engineering Scenario

**Scenario**: Three Independently-Deployed Teams' Apps, Each on a Slightly Different React Patch Version.
A checkout host app runs React 19.0.2; a design-system remote was last deployed against React 19.0.0; a recommendations remote runs React 19.1.0. Without `singleton: true` + a permissive-but-compatible `requiredVersion: '^19.0.0'` range, the runtime could end up loading three separate React instances — the recommendations widget's hooks would silently break the moment its component tree gets reconciled by the host's differently-versioned React instance. With `singleton: true` correctly configured on all three apps, exactly one React instance (whichever loaded first, as long as it satisfies every app's declared range) is shared across the entire composed page.

---

## 3. Production-Grade Code Example

```javascript
// checkout-host/webpack.config.js
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'checkout',
      remotes: {
        design_system: 'design_system@https://ds.acme.com/remoteEntry.js',
        recommendations: 'recommendations@https://reco.acme.com/remoteEntry.js',
      },
      shared: {
        react: {
          singleton: true,           // exactly ONE React instance across the entire federated page
          requiredVersion: '^19.0.0',  // this host's tested-against range
          strictVersion: false,         // warn (don't crash) on a technically-out-of-range remote version
          eager: true,                   // host needs React available for its OWN synchronous initial render
        },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0', eager: true },
      },
    }),
  ],
};
```

```javascript
// design-system-remote/webpack.config.js
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'design_system',
      exposes: { './Button': './src/Button' },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' }, // eager: false (default) — stays lazy
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
    }),
  ],
};
```

```javascript
// A stricter production configuration for a payments-adjacent remote where silent mismatches are unacceptable
shared: {
  react: { singleton: true, requiredVersion: '^19.0.0', strictVersion: true }, // HARD FAIL on incompatible version
},
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Missing `singleton: true` on React
```javascript
// ❌ CATASTROPHIC: without singleton, incompatible version ranges across federated apps
// silently result in MULTIPLE React instances — "Invalid hook call" errors that only reproduce
// in the fully composed production page, never in any single team's isolated dev environment
shared: { react: { requiredVersion: '^19.0.0' } },

// ✅ CORRECT: singleton forces exactly one shared instance, resolving version differences via negotiation
shared: { react: { singleton: true, requiredVersion: '^19.0.0' } },
```

### ⚠️ Pitfall 2: Relying on `strictVersion: false`'s Default Silence in a High-Stakes Remote
The default permissive behavior (console warning only) is reasonable for most internal tooling, but for a remote embedded in a checkout/payments flow, a silently-tolerated major-version mismatch in a shared library (auth SDK, payment processor SDK) could change behavior in ways a console warning nobody reads will never catch before it reaches production. Set `strictVersion: true` deliberately for dependencies where a mismatch must be a loud, build/runtime-blocking failure, not a shrug.

### ⚠️ Pitfall 3: Marking Every Shared Dependency `eager: true`
```javascript
// ❌ WRONG: eager bundles the dependency directly into the initial chunk for EVERY app that sets
// this — for remotes, this defeats the lazy-loading premise entirely, shipping React (and everything
// else marked eager) even to users who never actually trigger that remote's federated import
shared: { react: { eager: true }, 'react-dom': { eager: true }, lodash: { eager: true } }, // in a REMOTE

// ✅ CORRECT: eager is a host-only concern for the FIRST render's dependencies; remotes stay lazy by default
shared: { react: { singleton: true }, 'react-dom': { singleton: true } }, // no eager — in a remote
```
