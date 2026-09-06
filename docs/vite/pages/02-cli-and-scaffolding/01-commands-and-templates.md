---
title: "CLI & Project Scaffolding: `create vite` & Core Commands"
sidebar_label: "CLI & Project Scaffolding"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the Vite documentation — [Getting Started](https://vite.dev/guide/), [Migration from v7](https://vite.dev/guide/migration), [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling), [Build Options](https://vite.dev/config/build-options). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

# ⚡ CLI & Project Scaffolding: `create vite` & Core Commands

## 1. Under-The-Hood Mechanics

Vite's CLI surface is deliberately small — a handful of commands, each mapping directly to one phase of the dev/build split covered in the [core architecture doc](../01-core-architecture/01-dual-engine-model.md).

```text
npm create vite@latest    ──► scaffolds a NEW project from a template (react, react-ts, vue, svelte, vanilla, ...)
        │
        ▼
vite          (aliases: vite dev, vite serve)  ──► starts the DEV SERVER — native ESM, deps pre-bundled by Rolldown
vite build                                      ──► produces the PRODUCTION BUILD — Rolldown bundling
vite preview                                     ──► serves the ALREADY-BUILT dist/ output locally, for a final check
```

**Three of these are what a scaffolded project actually wires into `package.json`**, and the getting-started guide names them and their aliases exactly:

> *"`dev` — start dev server, aliases: `vite dev`, `vite serve`"* · *"`build` — build for production"* · *"`preview` — locally preview production build"* — [Getting Started](https://vite.dev/guide/)

⚠️ **`vite build` is no longer Rollup.** *"Vite 8 uses Rolldown and Oxc based tools instead of esbuild and Rollup."* ([Migration from v7](https://vite.dev/guide/migration)) The command name and its output shape are unchanged; only the engine underneath moved. Same for the dev server's dependency step: *"The pre-bundling is performed with Rolldown."*

### `npm create vite@latest`: Template-Based Scaffolding, Not a Framework Opinion
Unlike some framework-specific CLIs that scaffold a full opinionated app structure (routing, state management, testing setup all pre-wired), `create vite` scaffolds the **minimum** needed to start a dev server for a chosen framework/language combination — a deliberately thin starting point, leaving architectural decisions (routing library, state management, folder structure) to the consuming team rather than baking in a specific opinion.

### `vite preview`: Why It Exists Separately From `vite build`
`vite build`'s output is static files meant to be served by a **real** production web server (or CDN) — it is not itself a server. `vite preview` spins up a minimal local static server specifically to sanity-check that the built output behaves correctly (particularly catching bugs that only manifest in the bundled, minified, tree-shaken production build, not the unbundled dev server) before an actual deploy.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Bug That Only Reproduced After Deployment, Never in Local Development.
An engineer's feature worked flawlessly under `vite` (the dev server) but broke once deployed — the root cause was code relying on development-only behavior (an unminified variable name referenced via a debugging hack, coincidentally still working under Vite's unbundled dev serving) that the production minifier and tree-shaker changed. On Vite 8 that minifier is Oxc by default: the build reference gives `build.minify` as `'oxc'` for the client build and `false` for the SSR build. Running `vite build && vite preview` locally **before** deploying — rather than only ever testing against the dev server — would have caught this exact class of dev-vs-production behavioral gap in a local environment, well before it reached a live deployment.

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
```text
❌ WRONG: shipping straight from "it works when I run `vite`" without ever running
`vite build && vite preview` locally — the dev server's unbundled, unminified,
non-tree-shaken serving model is NOT representative of what actually gets deployed

✅ CORRECT: always validate against an actual `vite build` + `vite preview` pass,
especially before a release, not just the dev server experience
```

### ⚠️ Pitfall 2: Forcing a Fresh Dependency Pre-Bundle Habitually "Just in Case"
Vite already re-triggers pre-bundling on its own; the documented list of what it watches is
in the [dependency pre-bundling guide](https://vite.dev/guide/dep-pre-bundling) — package
manager lockfile content, patches folder modification time, relevant fields in your
`vite.config.js`, and the `NODE_ENV` value. Forcing a rebuild on every session start throws
away that cache for no benefit in the common case; it is a targeted troubleshooting move for
when the pre-bundle genuinely looks stale or corrupted, not a routine step.

🔴 **Use the two methods the docs actually name.** The guide's own instruction is to
> *"start the dev server with the `--force` command line option, or manually delete the `node_modules/.vite` cache directory."*

```bash
vite --force                 # documented: forces a fresh dependency pre-bundle
rm -rf node_modules/.vite    # documented: the same thing, by hand
```

⚠️ **This page previously taught a `vite optimize` subcommand here. I could not confirm it
in the Vite 8 documentation** — the getting-started guide lists `dev`, `build` and `preview`,
and the pre-bundling guide names only `--force` and deleting the cache directory. It may
still exist as an undocumented command; treat it as unverified and prefer the two above.

### ⚠️ Pitfall 3: Assuming `vite preview` Is Suitable for Actual Production Hosting
```text
❌ WRONG: vite preview is a MINIMAL, DEV-CONVENIENCE static server — it lacks production
concerns like proper caching headers, compression tuning, CDN integration, or the
robustness/security hardening a real production web server provides

✅ CORRECT: use vite preview ONLY for local pre-deploy sanity checks; actual production
hosting should go through a real web server / CDN / hosting platform, never `vite preview` itself
```

---

## Gotchas

**★ Symptom: `npm create vite@latest my-app --template react-ts` scaffolds the interactive prompt instead of a React+TS project.** Cause: the missing `--`. npm consumes the flag itself instead of forwarding it to `create-vite`. Fix: the documented form keeps the separator — > *"`npm create vite@latest my-vue-app -- --template vue`"* ([Getting Started](https://vite.dev/guide/)). Yarn, pnpm and bun do not all need the `--`; npm does, and this is the single most common scaffolding failure.

**★ Symptom: `--template react-swc` errors or falls back to the prompt.** Cause: the template list moved. The Vite 8 getting-started guide names these: `vanilla`, `vanilla-ts`, `vue`, `vue-ts`, `react`, `react-compiler`, `react-ts`, `react-compiler-ts`, `preact`, `preact-ts`, `lit`, `lit-ts`, `svelte`, `svelte-ts`, `solid`, `solid-ts`, `qwik`, `qwik-ts`. The React SWC variants that older tutorials reach for are **not** in that list; `react-compiler` and `react-compiler-ts` are the new React additions. Fix: run `npm create vite@latest` with no flags once and read the menu — it is generated from the templates the installed `create-vite` actually ships, which is a stronger source than any list, this one included.

**★ Symptom: the scaffold command fails on Node 21, or on Node 22.9.** Cause: the requirement is two windows, not one floor — > *"Vite requires Node.js version 20.19+, 22.12+."* Node 21.x and Node 22.0 through 22.11 are numerically above 20.19 and still unsupported. Fix: read it as "20.19 or later in the 20 line, or 22.12 or later" and note the guide's own caveat that *"some templates require a higher Node.js version to work"* — the template can have a stricter floor than Vite.

**★ Symptom: you run `vite serve` expecting the production preview and get the dev server.** Cause: `serve` is an **alias of `dev`**, not of `preview`. Other tools in this ecosystem use `serve` to mean "serve the built output", which is exactly what makes this one bite. Fix: `preview` is the only command that serves `dist/`.

**★ Symptom: `vite preview` shows the old build.** Cause: `preview` does not build. It serves whatever is already in the output directory, so a stale `dist/` previews cleanly and tells you nothing. Fix: always run the pair — `vite build && vite preview` — and treat a `preview` script that does not depend on `build` as a trap you set for your future self.

**★ Symptom: `vite preview` works locally, the same build 404s on deep links in production.** Cause: `preview` is a convenience static server with its own SPA-ish behaviour; a real host needs an explicit rewrite rule to serve `index.html` for unknown paths. Fix: `preview` is a check on *the bundle*, not a check on *the hosting configuration*. The two failure modes look identical in the browser and have nothing to do with each other — see [15 · Deployment considerations](../15-deployment-considerations/01-shipping-the-build.md).

**★ Symptom: CI passes, the deployed site is broken, and nobody can reproduce it locally.** Cause: the pipeline runs `vite` somewhere it should run `vite build`, or tests run against the dev server. Fix: the artifact that ships is `dist/`, so the artifact that gets tested must be `dist/`. `build:analyze` wired as `vite build && vite preview` (as in the example above) is a local habit; in CI the equivalent is to build once and serve the built output to whatever runs the tests.

**★ Symptom: "I'll just fix it in `vite preview` and redeploy."** Cause: treating `preview` as a production server. It has no caching-header policy, no compression tuning, no CDN, and no security hardening. Fix: it is a sanity check with a five-minute lifespan, and nothing in the Vite docs positions it otherwise.

## Interview questions

**★ What does `vite preview` do that `vite` does not, and why is that worth a separate command?**
`vite` serves your source as unbundled native ESM and never produces `dist/`. `vite preview` serves `dist/` — the actual artifact — over a minimal local static server. The reason it exists as its own command is that the class of bug it catches is *only* creatable by the build: tree-shaking that removed something reached dynamically, a chunk boundary that changed module evaluation order, a minifier that renamed an identifier some reflection-flavoured code was matching on. None of those exist in the dev server because none of those steps have run. It is deliberately not a production server; it is a way to look at the artifact before shipping it.

**★ Someone asks why `create vite` does not scaffold routing, state management and a test runner. What is the answer?**
Because `create-vite` scaffolds a build tool's minimum viable project, not an application architecture. A framework CLI that pre-wires routing and state is making decisions on your behalf that are expensive to undo six months in; Vite deliberately stops at "a dev server starts, and `build` produces something deployable for this framework and this language". The trade-off is real and cuts both ways — you get no opinionated defaults, so a team with no strong opinions ships an inconsistent structure. The right framing in an interview is that Vite chose to be a build tool, and the framework-level CLIs that build on it (and there are several) are where the opinions live.

**★ Vite already re-runs dependency pre-bundling automatically. What does it watch, and why does that list occasionally miss?**
The documented triggers are the package manager lockfile's content, the patches folder's modification time, the relevant fields in `vite.config.js`, and the `NODE_ENV` value. Each is a cheap proxy for "the dependency graph probably changed". They miss whenever the dependencies change without any of those four moving — a package edited in place inside `node_modules`, a linked local package, a manual `npm install` that produced no lockfile delta. That is exactly the situation `--force` or deleting `node_modules/.vite` is for, and it is why "delete the cache and restart" resolves so many reports that look like Vite bugs.

**★ You are told a build works because `npm run dev` looks correct. What do you ask next?**
Whether `vite build` has been run. Everything the dev server can prove is that your modules parse, resolve and execute individually; it proves nothing about tree-shaking, chunking, minification or the `base` path, because none of those run in dev. The follow-up question is whether `vite preview` was pointed at a *fresh* `dist/`, because `preview` will happily serve a build from last Tuesday and look green doing it.

**Why is the `--` in `npm create vite@latest my-app -- --template react-ts` not optional?**
Because `npm create` is `npm exec` with an argument convention, and npm parses flags it recognises before deciding what to forward. Without the separator, `--template` is consumed as an npm flag rather than passed to `create-vite`, and `create-vite` — having received no template — falls back to its interactive prompt. It looks like the flag was ignored; it was actually intercepted one layer up. This is npm-specific plumbing, not a Vite behaviour, which is why the failure survives every "check the Vite docs" instinct.

---

← [Core Architecture](../01-core-architecture/01-dual-engine-model.md) · [Vite overview](../../README.md) · Next → [Configuration](../03-configuration/01-vite-config-file.md)
