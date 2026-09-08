---
title: "A working shell-and-checkout federation pair shows where the mechanism from the previous page actually bites — a network-dependent import, a version nobody has pinned a browser range for, and a host that can't see its own remote's history"
sidebar_label: "05b · Worked example and version spine"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against [Module Federation — Vite integration](https://module-federation.io/integrations/build-tool/vite.html) and package facts from **registry.npmjs.org**, fetched 2026-09-08. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+ · `@module-federation/vite` 1.21.5**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

**Continues [05](05-module-federation-on-vite.md) — the mechanism, the config keys and the
two documented limitations. This page puts them into two complete apps, then treats the
things that only become visible once the two apps are actually deployed separately: what
version of the plugin you're really running, and what the host can and can't verify about
a remote it doesn't own.**

## Worked example — a `shell` host and a `checkout` remote

Two independently deployable apps. `checkout` exposes one component; `shell` consumes it
behind a lazy boundary with an explicit error fallback, because a remote fetch is a network
request and can fail the way any network request can.

**`checkout/vite.config.ts` — the remote:**

```ts
import { defineConfig } from 'vite';
import { federation } from '@module-federation/vite';

export default defineConfig({
  server: {
    origin: 'http://localhost:3001',
    port: 3001,
  },
  base: 'http://localhost:3001',
  plugins: [
    federation({
      name: 'checkout',
      filename: 'remoteEntry.js',
      exposes: {
        './CheckoutFlow': './src/CheckoutFlow.tsx',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.2.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.2.0' },
      },
    }),
  ],
  build: {
    target: 'chrome89',
  },
});
```

**`shell/vite.config.ts` — the host:**

```ts
import { defineConfig } from 'vite';
import { federation } from '@module-federation/vite';

export default defineConfig({
  server: {
    origin: 'http://localhost:3000',
    port: 3000,
  },
  base: 'http://localhost:3000',
  plugins: [
    federation({
      name: 'shell',
      remotes: {
        checkout: 'checkout@http://localhost:3001/remoteEntry.js',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.2.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.2.0' },
      },
    }),
  ],
  build: {
    target: 'chrome89',
  },
});
```

**`shell/src/CheckoutBoundary.tsx` — the consuming side, with a `React.lazy` boundary and an
explicit error fallback:**

```tsx
import { Suspense, lazy } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

// The specifier `checkout/CheckoutFlow` is not a real path on disk in `shell` —
// the federation runtime intercepts it and resolves it against the manifest
// fetched from `checkout`'s remoteEntry.js at http://localhost:3001.
const CheckoutFlow = lazy(() => import('checkout/CheckoutFlow'));

export function CheckoutBoundary() {
  return (
    <ErrorBoundary fallback={<p>Checkout is temporarily unavailable.</p>}>
      <Suspense fallback={<p>Loading checkout…</p>}>
        <CheckoutFlow />
      </Suspense>
    </ErrorBoundary>
  );
}
```

The `ErrorBoundary` is not decorative here the way it would be around a normal lazy chunk.
A same-app lazy chunk fails only if the build is broken, which CI already caught. A
federated remote's `import()` fails whenever `checkout`'s origin is down, its
`remoteEntry.js` 404s, or its exposed module throws during evaluation — none of which the
host's own CI can see, because the host and the remote are built and deployed on separate
pipelines.

## Version spine, and what the integration page does not state

`@module-federation/vite` published **1.21.5 on 2026-09-07** — the day before this page was
verified. 🔴 **The supported Vite version range is not documented on the integration page.**
The page shows the config shape and the two limitations described on
[05](05-module-federation-on-vite.md); it does not name a Vite version floor or ceiling, and
nothing here should be read as implying the plugin is confirmed against Vite 8 or against
the Rolldown-backed bundler pipeline specifically — check the installed plugin's own
`peerDependencies` before pinning a Vite major on the strength of this page.

For the surrounding decision of picking Module Federation over another cross-app strategy at
all, see
[choosing a bundler](../17-the-2026-toolchain-landscape/01a-choosing-a-bundler.md) and
[webpack-to-vite parity](../17-the-2026-toolchain-landscape/02-webpack-to-vite-parity.md).
For which plugin to reach for and why the obvious search result is stale, see
[Module Federation migration](../16-migration-recipes/01n-module-federation-migration.md) —
that page argues the stale-plugin trap in full; this page assumes you already picked
`@module-federation/vite` and covers how it behaves once running.

## Gotchas

**Symptom: TypeScript reports "Cannot find module `checkout/CheckoutFlow`" even though the
app runs correctly in the browser.** Cause: `checkout/CheckoutFlow` is not a real path in
`shell`'s `node_modules` or source tree — it only exists at runtime, resolved by the
federation runtime against a manifest fetched over the network. TypeScript has no way to
see it statically. Fix: add an ambient module declaration in the host, for example a
`checkout.d.ts` with `declare module 'checkout/CheckoutFlow'` naming the shape the exposed
component provides, kept in sync by hand or generated from the remote's published types if
the remote publishes them.

**★ Symptom: a host built and deployed weeks ago starts rendering a remote incorrectly with
no code change on the host's own side.** Cause: the remote redeployed, and because
`remoteEntry.js` is fetched fresh at load time rather than pinned at the host's build time,
the host is now running against whatever the remote's manifest currently points at. This is
the intended behaviour — independently deployable code is exactly what federation buys —
but it means the host's own git history and CI green checkmarks no longer fully describe
what is executing in production. Fix: treat the exposed module's shape as a versioned
contract (types, expected props) and add integration or contract tests that exercise the
host against the remote's currently deployed `remoteEntry.js`, not just against the host's
own unit tests.

**Symptom: a component works when the remote is loaded standalone but throws once loaded
inside the host.** Cause: usually a `shared`-dependency mismatch — covered in full on
[05a](05a-shared-dependencies-and-singleton-breakage.md), which this page defers to rather
than duplicating.

## Interview questions

**★ Why is an `ErrorBoundary` around a federated `React.lazy` import materially more
important than around a same-app lazy chunk?**
A same-app lazy chunk only fails if the build itself is broken — something CI on that same
repository already caught before it shipped. A federated remote's chunk is fetched from a
separately deployed origin at runtime; it can fail for reasons the host's own pipeline has
no visibility into at all — the remote's server being down, `remoteEntry.js` 404ing, or the
exposed module throwing during evaluation on a deploy the host never tested against.

**★ Why can a Vite host correctly serve a component today whose exact deployed code the
host's own repository has no record of?**
Because `remoteEntry.js` is fetched fresh at load time rather than pinned into the host's
build output. The host's build only encodes *where* to ask for `checkout/CheckoutFlow`, not
*what* that module currently is — the remote can redeploy the underlying implementation at
any time, and the host picks it up on the next page load without a rebuild of its own. This
is the entire value of independent deployability, and also why contract testing across the
boundary matters more here than in a monolithic build.

**Is `@module-federation/vite`'s supported Vite version range documented, and what should
that change about how you pin it?**
No — the integration page names no Vite version floor or ceiling, only the plugin's own
version and publish date. Don't assume Vite 8 or the Rolldown-backed pipeline is confirmed
compatible on the strength of the integration doc alone; check the installed plugin's own
`peerDependencies` before committing to a Vite major.

---

← [Shared dep versioning gap](05a2-shared-dependency-versioning-and-the-optimizedeps-gap.md) · [Vite overview](../../README.md) · Next → [Version skew and the manifest](05c-version-skew-and-the-remote-manifest.md)
