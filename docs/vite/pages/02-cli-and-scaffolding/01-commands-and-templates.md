---
title: "CLI & Project Scaffolding: `create vite` & Core Commands"
sidebar_label: "CLI & Project Scaffolding"
sidebar_position: 1
---

# ⚡ CLI & Project Scaffolding: `create vite` & Core Commands

## 1. Under-The-Hood Mechanics

Vite's CLI surface is deliberately small — four core commands, each mapping directly to one phase of the dual-engine model covered in the [core architecture doc](../01-core-architecture/01-dual-engine-model.md).

```
npm create vite@latest    ──► scaffolds a NEW project from a template (react, react-ts, vue, svelte, vanilla, ...)
        │
        ▼
vite            (alias: vite dev)   ──► starts the DEV SERVER — native ESM + esbuild pre-bundling
vite build                           ──► produces the PRODUCTION BUILD — Rollup-based bundling
vite preview                           ──► serves the ALREADY-BUILT dist/ output locally, for a final sanity check
vite optimize                             ──► manually forces a fresh dependency pre-bundle (rarely needed directly)
```

### `npm create vite@latest`: Template-Based Scaffolding, Not a Framework Opinion
Unlike some framework-specific CLIs that scaffold a full opinionated app structure (routing, state management, testing setup all pre-wired), `create vite` scaffolds the **minimum** needed to start a dev server for a chosen framework/language combination — a deliberately thin starting point, leaving architectural decisions (routing library, state management, folder structure) to the consuming team rather than baking in a specific opinion.

### `vite preview`: Why It Exists Separately From `vite build`
`vite build`'s output is static files meant to be served by a **real** production web server (or CDN) — it is not itself a server. `vite preview` spins up a minimal local static server specifically to sanity-check that the built output behaves correctly (particularly catching bugs that only manifest in the bundled, minified, tree-shaken production build, not the unbundled dev server) before an actual deploy.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Bug That Only Reproduced After Deployment, Never in Local Development.
An engineer's feature worked flawlessly under `vite` (the dev server) but broke once deployed — the root cause was code relying on development-only behavior (an unminified variable name referenced via a debugging hack, coincidentally still working under Vite's unbundled dev serving) that Rollup's production minification/tree-shaking changed. Running `vite build && vite preview` locally **before** deploying — rather than only ever testing against the dev server — would have caught this exact class of dev-vs-production behavioral gap in a local environment, well before it reached a live deployment.

---

## 3. Production-Grade Code Example

```bash
# Scaffolding a new project — template selection determines framework + language combo
npm create vite@latest my-app -- --template react-ts

cd my-app
npm install
```

```json
// package.json — the standard script wiring around Vite's four core commands
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "build:analyze": "vite build && vite preview"
  }
}
```

```bash
# The recommended pre-deploy sanity check — NEVER skip straight from `vite` (dev) to deploying
vite build      # produces dist/ — the ACTUAL artifact that will be deployed
vite preview    # serves dist/ locally — catches production-only bugs before they reach users
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Treating the Dev Server as a Reliable Production Preview
```
❌ WRONG: shipping straight from "it works when I run `vite`" without ever running
`vite build && vite preview` locally — the dev server's unbundled, unminified,
non-tree-shaken serving model is NOT representative of what actually gets deployed

✅ CORRECT: always validate against an actual `vite build` + `vite preview` pass,
especially before a release, not just the dev server experience
```

### ⚠️ Pitfall 2: Manually Running `vite optimize` Habitually "Just in Case"
`vite optimize` forces a fresh dependency pre-bundle — but Vite already automatically
re-triggers pre-bundling when it detects lockfile or config changes. Habitually running
it manually on every dev session start adds unnecessary startup latency for no benefit
in the common case; it's a targeted troubleshooting tool for when dependency pre-bundling
genuinely seems stale or corrupted, not a routine step.

### ⚠️ Pitfall 3: Assuming `vite preview` Is Suitable for Actual Production Hosting
```
❌ WRONG: vite preview is a MINIMAL, DEV-CONVENIENCE static server — it lacks production
concerns like proper caching headers, compression tuning, CDN integration, or the
robustness/security hardening a real production web server provides

✅ CORRECT: use vite preview ONLY for local pre-deploy sanity checks; actual production
hosting should go through a real web server / CDN / hosting platform, never `vite preview` itself
```
