---
title: "Module Federation: Micro-Frontend Architecture Patterns & Topologies"
sidebar_label: "Module Federation"
sidebar_position: 4
---

# ⚙️ Module Federation: Micro-Frontend Architecture Patterns & Topologies

## 1. Under-The-Hood Mechanics

Module Federation is a low-level primitive — `remotes`/`exposes`/`shared` — that supports several genuinely different micro-frontend **topologies** on top of it. Which one fits a given organization depends on team structure, deployment independence needs, and how much runtime coupling between apps is acceptable.

### Topology 1: Horizontal Federation (One Host, Many Sibling Remotes)
The most common shape: a single host app (often owning routing/shell/navigation) consumes multiple independent remotes, each owned by a different team, each exposing one feature area.
```
                     ┌────────────┐
                     │    Host    │ (shell, routing, auth)
                     └─────┬──────┘
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  ┌───────────┐      ┌───────────┐      ┌───────────┐
  │  Remote:  │      │  Remote:  │      │  Remote:  │
  │ Checkout  │      │  Reviews  │      │  Search   │
  └───────────┘      └───────────┘      └───────────┘
```
Best fit: many independent teams, each owning a clearly-bounded feature, with one team owning the overall shell/navigation experience.

### Topology 2: Nested (Vertical) Federation — A Remote That Is Also a Host
A remote can itself declare `remotes` and consume federated modules from further downstream apps — Module Federation doesn't restrict federation to a single host/remote layer.
```
Host (checkout) ──consumes──► Remote (payment-methods) ──consumes──► Remote (fraud-check-widget)
```
Best fit: a large feature area (payments) that is itself composed of independently-owned sub-features, without forcing the top-level host to know about every leaf remote directly.

### Topology 3: Bidirectional Federation
An app can be **both** a host (consuming others' remotes) **and** a remote (exposing its own modules to others) simultaneously — there's no structural "host" vs "remote" distinction in Module Federation itself, only in how a given `ModuleFederationPlugin` config is used.
```
App A ──exposes './Widget'──► App B
App B ──exposes './Modal'───► App A
```
Best fit: two closely collaborating teams' apps that genuinely need to embed each other's UI (e.g. a dashboard app embedding a widget from a reporting app, and the reporting app embedding a nav component from the dashboard app).

### Topology 4: Federated Design System, Consumed Everywhere
A dedicated remote exposing **only** shared UI primitives (buttons, modals, design tokens as CSS custom properties), consumed by every other app in the organization as a `remotes` entry — never itself consuming anyone else's remote. This is the shape shown in [fundamentals](./01-fundamentals-remotes-and-exposes.md) and is often the first Module Federation use case an organization adopts, since it has the lowest coordination overhead (one-directional dependency, clear ownership).

### Composition Strategy: Build-Time vs Runtime
- **Build-time composition** (classic Module Federation as shown so far): the host's JS bundle, once loaded, decides which remotes to fetch and when. All composition happens client-side, in one SPA.
- **Runtime/server composition** (an alternative micro-frontend strategy, e.g. Next.js Multi-Zones, or Edge-Side Includes): entirely separate apps are stitched together **before** reaching the browser — often by path-based routing at a reverse proxy/edge layer, with each "zone" being a fully independent Next.js app rather than federated modules inside one SPA. This trades Module Federation's fine-grained, same-page component embedding for coarser, route-level independence with less runtime coupling (no shared React instance, no shared-scope version negotiation needed at all).

---

## 2. Real-World Engineering Scenario

**Scenario**: A Retail Platform Choosing Between Horizontal Federation and Multi-Zone Routing for a New Marketplace Section.
A retail platform's core shopping experience is one federated SPA (horizontal topology: host + checkout/reviews/search remotes, all needing to interact live in the same page — e.g. adding to cart from a search result updates a cart badge in the shell instantly). A newly-acquired marketplace feature, built by a recently-integrated team on a completely different stack version and release cadence, doesn't need that tight, same-page interactivity — it's a mostly self-contained set of routes. Rather than forcing it into the existing federation's shared-React-singleton constraints, the platform routes `/marketplace/*` at the edge/reverse-proxy layer to an entirely separate deployment (multi-zone style) — avoiding the version-negotiation coupling entirely for a feature that doesn't need same-page component embedding anyway.

---

## 3. Production-Grade Code Example

```javascript
// Nested federation — payment-methods is BOTH a remote (to checkout) AND a host (to fraud-check-widget)
// payment-methods/webpack.config.js
module.exports = {
  plugins: [
    new (require('webpack/lib/container/ModuleFederationPlugin'))({
      name: 'payment_methods',
      filename: 'remoteEntry.js',
      exposes: { './PaymentForm': './src/PaymentForm' },   // exposed UPWARD to checkout
      remotes: {
        fraud_check: 'fraud_check@https://fraud.acme.com/remoteEntry.js', // consumed DOWNWARD
      },
      shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
    }),
  ],
};
```

```javascript
// Bidirectional federation — dashboard and reporting apps expose to AND consume from each other
// dashboard/webpack.config.js
module.exports = {
  plugins: [
    new (require('webpack/lib/container/ModuleFederationPlugin'))({
      name: 'dashboard',
      filename: 'remoteEntry.js',
      exposes: { './NavBar': './src/NavBar' },              // dashboard EXPOSES its nav
      remotes: { reporting: 'reporting@https://reporting.acme.com/remoteEntry.js' }, // and CONSUMES reporting's widget
      shared: { react: { singleton: true } },
    }),
  ],
};

// reporting/webpack.config.js
module.exports = {
  plugins: [
    new (require('webpack/lib/container/ModuleFederationPlugin'))({
      name: 'reporting',
      filename: 'remoteEntry.js',
      exposes: { './ReportWidget': './src/ReportWidget' },    // reporting EXPOSES its widget
      remotes: { dashboard: 'dashboard@https://dash.acme.com/remoteEntry.js' }, // and CONSUMES dashboard's nav
      shared: { react: { singleton: true } },
    }),
  ],
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Choosing Bidirectional Federation for Teams That Don't Need It
```
❌ RISKY: two apps mutually depending on each other's remotes creates a circular deployment
dependency — App A's build/runtime now implicitly depends on App B being reachable and vice versa,
doubling the blast radius of either app's outage and making independent versioning genuinely harder
to reason about than a simple one-directional dependency.
```
Bidirectional federation should be a deliberate choice for two teams with a real mutual-embedding need — not a default reached for because "we can."

### ⚠️ Pitfall 2: Nesting Federation Too Deeply Without a Clear Ownership Boundary at Each Level
Each additional level of nested (vertical) federation adds another network round-trip to the critical path of rendering a leaf component, and another shared-scope version-negotiation surface that can silently mismatch (see [shared dependencies](./02-shared-dependencies-and-version-negotiation.md)). Three or more levels deep, debugging "why did this component render with the wrong prop shape" often means tracing through multiple independently-deployed apps' current production versions — keep nesting shallow (one, at most two levels) unless the org structure genuinely mirrors that depth.

### ⚠️ Pitfall 3: Defaulting to Module Federation When Route-Level Independence Was All That Was Needed
Module Federation's value is same-page, live component-level composition with shared runtime state (shared React instance, shared design tokens, cross-remote event communication). A feature that's really just "a different set of routes, maybe on a different stack, that doesn't need to share live state with the rest of the app" gets that independence more simply (and with far less operational complexity — no shared-scope version negotiation, no singleton constraints) via edge/reverse-proxy path-based routing to a wholly separate deployment, as in the marketplace scenario above. Reach for Module Federation specifically when same-page runtime composition is the actual requirement, not merely "we want independent deploys" — simpler routing-based composition achieves independent deploys too, with less coupling.
