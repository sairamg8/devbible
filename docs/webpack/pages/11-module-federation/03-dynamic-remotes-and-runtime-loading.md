---
title: "Module Federation: Dynamic Remotes & Runtime-Resolved URLs"
sidebar_label: "Module Federation"
sidebar_position: 3
---

# ⚙️ Module Federation: Dynamic Remotes & Runtime-Resolved URLs

## 1. Under-The-Hood Mechanics

The `remotes` config shown in [fundamentals](./01-fundamentals-remotes-and-exposes.md) hardcodes a remote's URL in `webpack.config.js` — fine for a fixed set of remotes known at build time, but insufficient when the exact remote URL must be decided **at runtime**: per-environment (staging vs prod), per-tenant (a white-labeled SaaS product with a different remote per customer), or per-feature-flag (A/B testing a new version of a remote).

### The Two-Step Dynamic Remote Pattern
```
Step 1: Register a PLACEHOLDER remote scope, pointing at NOTHING yet
        remotes: { design_system: 'design_system' }   // no @URL — just a name
        │
Step 2: At runtime, BEFORE the federated import() executes, manually inject
        the container into that named global scope:
        │
        ▼
window.design_system = await loadRemoteContainer(resolvedUrlFromConfigService);
        │
        ▼
import('design_system/Button') now resolves against the just-injected container
```
This works because a federated remote is ultimately just a global variable holding a container object with a `get()`/`init()` API (see [fundamentals](./01-fundamentals-remotes-and-exposes.md)) — nothing stops application code from constructing and registering that container manually, at any point before it's first used, instead of Webpack wiring a static URL at build time.

### `loadRemote` Helpers & Federation Runtime Packages
Modern tooling (`@module-federation/enhanced`'s runtime package, or hand-rolled equivalents) wraps this pattern into a `loadRemote(remoteName, moduleName)` async function: dynamically injecting a `<script>` tag for the resolved `remoteEntry.js` URL, awaiting its load, calling `container.init(shareScope)` to join the shared dependency negotiation (see [shared dependencies](./02-shared-dependencies-and-version-negotiation.md)), then calling `container.get(moduleName)` to retrieve the actual federated module.

---

## 2. Real-World Engineering Scenario

**Scenario**: White-Labeled SaaS Platform Where Each Customer's Checkout Widget Remote Lives at a Different URL.
A B2B SaaS platform lets enterprise customers customize their checkout flow's branding via a customer-specific remote deployed to `https://{customer-slug}.widgets.acme.com/remoteEntry.js`. Because the exact URL depends on which customer's tenant is currently logged in — information only available at runtime, not at the host app's build time — the host fetches a per-tenant config object on login (`{ checkoutWidgetUrl: 'https://acme-corp.widgets.acme.com/remoteEntry.js' }`) and dynamically registers that specific remote before any federated import of it executes.

---

## 3. Production-Grade Code Example

```typescript
// lib/loadRemote.ts — hand-rolled dynamic remote loader (the pattern federation runtime packages formalize)
declare global {
  interface Window {
    [key: string]: any;
  }
}

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) return resolve(); // already loaded
    const script = document.createElement('script');
    script.src = url;
    script.type = 'text/javascript';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load remote script: ${url}`));
    document.head.appendChild(script);
  });
}

export async function loadRemoteModule(scope: string, remoteUrl: string, module: string) {
  await loadScript(remoteUrl);

  const container = window[scope]; // the container global the remoteEntry.js script just registered
  // @ts-expect-error — __webpack_share_scopes__ is injected globally by Module Federation's runtime
  await container.init(__webpack_share_scopes__.default);

  const factory = await container.get(module);
  return factory();
}
```

```tsx
// CheckoutPage.tsx — resolving the remote URL from a per-tenant config service BEFORE importing
import { lazy, Suspense, useEffect, useState } from 'react';
import { loadRemoteModule } from '../lib/loadRemote';
import { fetchTenantConfig } from '../lib/tenantConfig';

function CheckoutPage({ tenantId }: { tenantId: string }) {
  const [CheckoutWidget, setCheckoutWidget] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { checkoutWidgetUrl } = await fetchTenantConfig(tenantId);
      const mod = await loadRemoteModule('checkout_widget', checkoutWidgetUrl, './Widget');
      if (!cancelled) setCheckoutWidget(() => mod.default);
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  if (!CheckoutWidget) return <WidgetSkeleton />;
  return <CheckoutWidget />;
}
```

```javascript
// webpack.config.js — the host declares NO static remotes at all when every remote is fully dynamic;
// or a hybrid: some remotes static (design_system, known at build time), others dynamic (per-tenant)
module.exports = {
  plugins: [
    new (require('webpack/lib/container/ModuleFederationPlugin'))({
      name: 'checkout',
      remotes: {
        design_system: 'design_system@https://ds.acme.com/remoteEntry.js', // static — same for everyone
        // checkout_widget intentionally NOT listed here — it's resolved entirely at runtime, per tenant
      },
      shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
    }),
  ],
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Calling `container.get()` Before `container.init()`
```typescript
// ❌ WRONG: skipping init() means this remote never joins the shared dependency negotiation —
// it will load its OWN bundled React copy regardless of singleton config, silently defeating sharing
const factory = await container.get(module);

// ✅ CORRECT: init() with the shared scope MUST happen first, exactly once per container
await container.init(__webpack_share_scopes__.default);
const factory = await container.get(module);
```

### ⚠️ Pitfall 2: Re-Injecting the Same Remote Script on Every Navigation
Without the "already loaded" guard shown in `loadScript` above, navigating to the same dynamically-federated route multiple times re-injects and re-executes the remote's script tag repeatedly — at best wasted network/parse time, at worst re-registering (and potentially re-initializing) the container in ways that weren't designed for multiple init calls, depending on the remote's own internal state assumptions.

### ⚠️ Pitfall 3: No Fallback UI for a Dynamic Remote That Fails to Load
A per-tenant remote URL that 404s (a misconfigured tenant record, a remote that's mid-deploy, a network blip) with no error handling around the `loadRemoteModule` call leaves the user staring at an infinitely-pending skeleton or an unhandled promise rejection crashing the whole page. Production dynamic-remote loading needs an explicit try/catch with a genuine fallback UI — see [production ops & troubleshooting](./05-production-ops-and-troubleshooting.md) for resilience patterns.
