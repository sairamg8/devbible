---
title: "Module Federation Ports Because Its Metadata Was Never webpack-Specific — But the Plugin Doing the Porting Must Be Checked by Publish Date, Not by Search Ranking"
sidebar_label: "01n · Module Federation"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against [webpack — ModuleFederationPlugin](https://webpack.js.org/plugins/module-federation-plugin/), [Module Federation — Vite integration](https://module-federation.io/integrations/build-tool/vite.html), and package facts from **registry.npmjs.org**, fetched 2026-09-08. Documentation-validated; **no sandbox run, no timings**. Target: **`@module-federation/vite` 1.21.5 · webpack 5.110.3 · `@module-federation/enhanced` 2.9.0**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Migrating Module Federation Off webpack

**A team's Module Federation setup is one of the least webpack-specific things in its whole
config — `exposes`, `remotes` and `shared` describe a runtime contract between independently
deployed apps, not a webpack mechanism — which is exactly why an actively maintained plugin
can offer near-parity on Vite.** The blocker was never technical parity. It is that the
package most search results and tutorials point to has not shipped in over a year, and a team
that finds it first reasonably concludes Module Federation is a reason to stay on webpack.

## The two plugins, and why the date matters more than the name

| | `@originjs/vite-plugin-federation` | `@module-federation/vite` |
|---|---|---|
| Latest version | **1.4.1** | **1.21.5** |
| Last published | **2025-04-12** | **2026-09-07** |
| Publisher | Community, unaffiliated | The official Module Federation org |
| webpack/Rspack-side counterpart | — | `@module-federation/enhanced` (2.9.0) |

🔴 **The community plugin dominates search results precisely because it shipped first and
has more accumulated blog coverage — not because it is the current answer.** Confirm which
one you were handed with `npm view <pkg> time.modified` before either adopting it or citing
its absence as a blocker.

## webpack's `ModuleFederationPlugin` config, for reference

```javascript
// webpack.config.js — a remote app exposing one component, consuming another remote.
import webpack from 'webpack';
const { ModuleFederationPlugin } = webpack.container;

export default {
  plugins: [
    new ModuleFederationPlugin({
      name: 'dashboard_app',
      filename: 'remoteEntry.js',
      exposes: {
        './Widget': './src/components/Widget.js',
      },
      remotes: {
        shell_app: 'shell_app@http://localhost:3000/remoteEntry.js',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
      },
    }),
  ],
};
```

## The Vite translation

```typescript
// vite.config.ts — the plugin function replaces the webpack constructor;
// name, filename, exposes and shared carry over as concepts directly.
import { defineConfig } from 'vite';
import { federation } from '@module-federation/vite';

export default defineConfig({
  server: { port: 3001 },
  base: 'http://localhost:3001', // ⚠️ Module Federation needs an absolute base — see Gotchas
  build: { target: 'chrome89' }, // remoteEntry.js needs a target broad enough for consumers
  plugins: [
    federation({
      name: 'dashboard_app',
      filename: 'remoteEntry.js',
      exposes: {
        './Widget': './src/components/Widget.js',
      },
      shared: ['react', 'react-dom'],
    }),
  ],
});
```

⚠️ **`remotes` is a genuine structural difference, not a rename.** webpack's `remotes` is an
object keyed by the local name you import through (`shell_app: 'shell_app@http://…'`).
`@module-federation/vite`'s documented type is `remotes?: Array<RemoteInfo>` — an **array** of
remote-descriptor objects, not a plain key-value map. A migration that pastes the webpack
object shape in directly will fail type-checking or, worse, silently be ignored depending on
how loosely the config is typed — this is genuine engineering judgement drawn from the
documented type shape, not a quoted equivalence claim, and it is the one field in this
translation worth reading the current plugin's own type definitions for before shipping,
since a plugin at this publish cadence can reasonably evolve the shape further.

```typescript
// A host app's remotes, in the ARRAY shape the current plugin's types document —
// verify the exact object fields against the installed version before depending on this.
import { federation } from '@module-federation/vite';

export default defineConfig({
  plugins: [
    federation({
      name: 'shell_app',
      remotes: [
        { name: 'dashboard_app', entry: 'http://localhost:3001/remoteEntry.js' },
      ],
      shared: ['react', 'react-dom'],
    }),
  ],
});
```

## What genuinely does not carry over: `shared`'s object-form hints

webpack's `shared` accepts a rich per-dependency object — `singleton`, `requiredVersion`,
`eager`, `strictVersion` — because webpack's runtime performs its own semver resolution
across remotes at load time. A migration that only writes `shared: ['react', 'react-dom']`
(the array shorthand shown above) is accepting the plugin's defaults for all of that, which
may be exactly right for a simple two-app setup and is worth an explicit decision, not a
silent one, once a federation graph grows past two or three participants — check the current
plugin's own documentation for its object-form equivalent of `singleton`/`requiredVersion`
before assuming the shorthand is sufficient at scale.

---

## Gotchas

**★ Symptom: a migration proposal lists "cannot use Module Federation" as a reason to stay on webpack.** Cause: evaluated against `@originjs/vite-plugin-federation`, last published **2025-04-12**, rather than the actively shipped `@module-federation/vite` from the official org. Fix: `npm view <package> time.modified` before citing any plugin's staleness as a blocker — this specific claim is wrong often enough, and cheap enough to check, that it should never survive into a proposal unverified.

**★ Symptom: a remote app loads fine when accessed directly, and consuming apps get a blank widget with no console error.** Cause: Module Federation's remote-loading mechanism needs an **absolute** URL to fetch `remoteEntry.js` from, and Vite's `base` defaults to `/`, which resolves relative to whatever page is currently loaded — fine for a normal app, wrong for a file meant to be fetched cross-origin by a different application entirely. Fix: set `base` to the remote app's own absolute origin, as shown above, not a relative path.

**★ Symptom: `remotes` is configured with the webpack object shape (`{ appName: 'appName@url' }`) and either a type error appears or the remote is silently never reached.** Cause: `@module-federation/vite`'s documented `remotes` field is an **array** of descriptor objects, not a key-value map — a structural difference from webpack's shape, not a naming one. Fix: rewrite as an array of `{ name, entry }`-shaped objects (or whatever fields the currently installed version's own types document — check them directly, since this plugin ships frequently enough that the shape is worth re-confirming rather than trusting a worked example from a specific date).

**★ Symptom: two federated apps built with different React versions both boot fine individually and one of them "loses" its own state or hooks fail once the other's remote is loaded.** Cause: `shared`'s array shorthand accepted each app's default resolution behaviour rather than an explicit `singleton: true` contract, and the federation runtime resolved two different copies of React into the same page. Fix: use the object form (if the current plugin version supports it — check its own docs, since this is exactly the field most likely to need per-version verification) to require a single shared instance across every participant, the direct equivalent of webpack's `singleton: true`.

---

## Interview questions

**★ Why does Module Federation port to Vite with a plugin swap, when `splitChunks` needs a full redesign?**
Because Module Federation's core concepts — `exposes`, `remotes`, `shared`, a runtime
manifest fetched at load time — describe a contract between independently built and deployed
applications, and that contract was never expressed in webpack-specific terms; it is a
protocol the plugin implements, not a webpack mechanism the plugin merely exposes.
`splitChunks`, by contrast, encodes decisions about *this specific application's* dependency
graph and deploy cadence in a vocabulary — chunk groups, cache lifetimes — that has no
independent existence outside webpack's implementation of it. The practical test that
generalises: a capability defined by a *protocol* usually finds a plugin; a capability defined
by *one tool's internal model* usually needs a redesign.

**★ A team is evaluating whether Module Federation blocks a webpack-to-Vite migration. What is the actual due-diligence step, and why does it matter more here than for most plugins?**
Check the publish date and publishing organisation of whichever plugin they were handed,
specifically because this is a case where the wrong answer is unusually easy to reach with
real evidence — the community plugin genuinely exists, genuinely has more search results and
tutorials, and genuinely has not shipped in over a year, so "I looked and it's basically
unmaintained" is a defensible-sounding conclusion built entirely on having found the wrong
package. `npm view <pkg> time.modified` and checking the maintaining org settles it in
seconds, and it is worth doing before Module Federation shows up as a line item in a
migration-blocking argument, because unlike most stale-plugin claims, this one has a
plausible, actively-shipped alternative sitting one search result away.

**★ Why is `remotes` an array in `@module-federation/vite` rather than the key-value object webpack uses?**
The documented type is `remotes?: Array<RemoteInfo>`, and while the plugin's own
rationale for the choice is not something this page found stated explicitly, the practical
consequence is what matters for a migration: this is a genuine structural difference, not a
cosmetic rename, so a port that copies the webpack shape verbatim will not merely behave
differently — it is a different data structure entirely, likely to fail a type check outright
rather than silently misbehave, which is the better failure mode of the two but still means
"just rename the keys" is not a safe way to think about this specific field.

---

← [01m · noParse & externals](01m-webpack-only-config-with-no-equivalent.md) · [Vite overview](../../README.md) · Next → [The 2026 Landscape](../17-the-2026-toolchain-landscape/01-the-2026-bundler-landscape.md)
