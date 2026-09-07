---
title: "Choosing a Bundler: Match the Change to the Complaint, Not the Tool to the Trend"
sidebar_label: "Choosing a Bundler"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Versions from **registry.npmjs.org**; positioning quoted from [Rspack Introduction](https://rspack.rs/guide/start/introduction) and [Migration from v7](https://vite.dev/guide/migration). **No sandbox run, no timings, no benchmarks** — every performance statement here is attributed to its source, never asserted. Target: **Vite 8.2.2 · webpack 5.110.3 · Rspack 2.2.2**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Choosing a Bundler: Match the Change to the Complaint

[Chunk 1](01-the-2026-bundler-landscape.md) established what each tool is. This chunk is the
decision, and it has one rule: **"slow builds", "the config is unmaintainable" and "our dev loop is
slow" are three different problems with three different answers**, and a proposal that does not say
which one it solves cannot be evaluated.

---

## 1. Under-The-Hood Mechanics

### The decision, as a table

| Constraint that actually binds | Answer | Why |
|---|---|---|
| New app, no config to preserve | **Vite** | The greenfield story is genuinely won |
| Large webpack config, complaint is **build speed** | **Rspack** | Same model, Rust core, official webpack migration guide |
| Large webpack config, complaint is **the model itself** | **Vite**, rewrite budgeted | A different model *is* the change you want |
| On Next.js | **Turbopack** | Not a choice; a property of the framework |
| Publishing a library | **Vite lib mode** or **Rollup** | App and library bundling want opposite things |
| One-off transform in a script | **esbuild** | No config, no graph, no project |

### Why Rspack rather than Vite for an existing config

> *"Rspack … modernizes the webpack API to enable **seamless replacement of webpack** while delivering lightning-fast build speeds."* — [Rspack Introduction](https://rspack.rs/guide/start/introduction)

That sentence is the whole argument. Rspack preserves `entry`/`output`, loader rules,
`splitChunks`, asset modules and Module Federation, and ships a *Migrate from webpack* guide. Vite
preserves none of those, because it is a different model — `index.html` is the entry, loaders do not
exist, and `splitChunks` has no direct equivalent.

**Both make builds faster. Only one of them also changes everything else.**

### The migration estimate is a grep, not a guess

```
loaders you use            → each must be rewritten or replaced (Vite)  / kept (Rspack)
splitChunks complexity     → no direct Vite equivalent; v8 removed the object manualChunks form
require.context uses       → become import.meta.glob (mechanical)
ProvidePlugin uses         → no direct Vite equivalent
Module Federation remotes  → a plugin swap in both directions
```

Count them before anyone writes a number down. A config with four loaders and no `splitChunks` is a
different project from one with forty and a hand-tuned chunk graph, and the difference is visible in
about thirty seconds.

### 🔴 What changing bundler does not fix

Every Rust bundler makes **bundling** faster. It does not touch:

- **type-checking** — `tsc` is usually the longest step in a large TypeScript build, and no bundler
  runs it. Vite does not type-check at all; that is by design.
- **source-map generation** at high fidelity.
- **an ill-conditioned chunk graph** — a bad `splitChunks` is bad faster.
- **CI cache misses** — often the real reason "CI takes twenty minutes".

⚠️ A team that migrates and is still slow usually never profiled. Do that first: the answer is
frequently that the bundler was not the bottleneck, in which case the migration was the wrong
project regardless of which tool it chose.

---

## 2. Real-World Engineering Scenario

**A migration proposal that would have cost a quarter, replaced by one that cost a week.**

A team maintaining a six-year-old webpack 5 build — 40 loaders, a hand-tuned `splitChunks`, four
Module Federation remotes — wrote a proposal to move to Vite. The stated reason was "webpack is
dead", the stated benefit was dev-server speed, the estimate was one quarter.

Three things in it were wrong on the facts:

- **"webpack is unmaintained."** It had shipped a release that month.
- **"Vite is the migration path."** Vite is a *different configuration model*. Every loader becomes
  a plugin in a different API, `splitChunks` has no direct equivalent, and the dev server does not
  bundle — which changes what the team can reproduce locally before shipping.
- **"Module Federation means we cannot leave webpack."** False in the other direction:
  `@module-federation/vite` exists and is actively shipped by the official Module Federation org.

The quarter-long estimate was *accurate for the plan as written*. What made the plan unnecessary is
that the team's real complaint was **build time** — and build time does not require a configuration
model change. They moved to Rspack, kept the config, and revisited Vite later for a new app where
the greenfield story actually applied.

The reusable part is the sequencing: **name the complaint, then pick the tool.** Every expensive
migration this page exists to prevent has the same shape — a real problem, solved as a side effect
of a much larger change that nobody costed separately.

---

## 3. Production-Grade Code Example

```bash
# Establishing facts before anyone writes a proposal. All of this is one minute.

# 1. Is the incumbent actually unmaintained?
npm view webpack version time.modified
npm view @rspack/core version
npm view vite version

# 2. Verify the Vite 8 engine claim from the manifest, not from prose.
npm view vite@8 dependencies
# → { postcss, rolldown, picomatch, tinyglobby, lightningcss }   ← no rollup

# 3. THE ESTIMATE. How much webpack surface do you actually use?
grep -c 'loader' webpack.config.js
grep -rn 'splitChunks\|ModuleFederationPlugin\|ProvidePlugin\|require\.context' \
  --include='webpack*.js' --include='*.config.js' .

# 4. Where does the time actually go? Run this BEFORE choosing anything.
time npx tsc --noEmit          # often the real answer
time npx webpack --mode production
```

```javascript
// The two migration shapes, side by side.

// ── Rspack: the config model is preserved. Often a near drop-in. ──────────────
// rspack.config.js
module.exports = {
  entry: './src/index.js',
  module: { rules: [{ test: /\.tsx?$/, use: 'builtin:swc-loader' }] },
  optimization: { splitChunks: { chunks: 'all' } },   // same option, same shape
};

// ── Vite: a different model. index.html is the entry; loaders do not exist. ───
// vite.config.ts
import { defineConfig } from 'vite';
export default defineConfig({
  // No `entry`: index.html is the entry and <script type="module"> is the graph root.
  // No loader rules: TS/JSX go through Oxc, CSS through Lightning CSS — both built in.
  build: {
    // `rollupOptions` still works as an alias; v8's name is `rolldownOptions`.
    rolldownOptions: { /* … */ },
  },
});
```

```markdown
<!-- The proposal template that makes a migration reviewable. -->
## The complaint
One sentence. "Production builds take 22 minutes." NOT "webpack is old."

## Evidence it is the bundler
`time tsc --noEmit` = __   ·  `time webpack` = __  ·  CI cache hit rate = __

## The surface we actually use
loaders: __   splitChunks: yes/no   Module Federation: __ remotes
require.context: __ uses   ProvidePlugin: __ uses

## Options, costed separately
Rspack (keep model):  __ days     Vite (change model): __ days
Do nothing + fix CI:  __ days
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Treating Vite as webpack's migration path

Vite is a different configuration model, not a faster webpack. The tool that *is* a faster webpack
says so itself. Choosing Vite for a large existing config means choosing a rewrite — sometimes
correct, never incidental.

### ⚠️ Pitfall 2 — Choosing a bundler before naming the complaint

Four common complaints, four different answers, and only one of them is "change the configuration
model". A proposal that does not state which it solves cannot be reviewed, only agreed with.

### ⚠️ Pitfall 3 — Assuming Turbopack is available to you

It is Next.js's bundler. If you are not on Next.js it is not a candidate; if you are, it is largely
not a decision. Treat it as a property of the framework.

### ⚠️ Pitfall 4 — Migrating without profiling

If `tsc --noEmit` is twelve of your twenty minutes, no bundler change touches twelve minutes. This
is the single most common way a successful migration produces a disappointed team.

### ⚠️ Pitfall 5 — Publishing a library with an app bundler's defaults

An app inlines, minifies and hashes; a library preserves module structure, externalises peers and
ships types. Using app defaults for a package is how consumers end up with a duplicated React or an
unbundleable artefact.

### ⚠️ Pitfall 6 — Costing only the option you already chose

A proposal that estimates one path is a decision with a document attached. Cost at least the
do-nothing option — "fix the CI cache" is frequently the cheapest row in the table and is almost
never on it.

---

## Gotchas

**★ Symptom: a Vite migration estimate balloons after the loaders are counted.** Cause: webpack loaders do not port — they are a different plugin API and each must be rewritten or replaced. Fix: count them first: `grep -c 'loader' webpack.config.js`. That number, plus `splitChunks` complexity, *is* the estimate.

**★ Symptom: "we picked the Rust one" and the build is still slow.** Cause: the transform was never the bottleneck. Type-checking, source maps, an ill-conditioned chunk graph and CI cache misses are all unaffected by the bundler's implementation language. Fix: profile before migrating; every Rust bundler makes bundling faster and nothing else.

**★ Symptom: a team rejects leaving webpack because of Module Federation.** Cause: out-of-date information. Fix: `@module-federation/vite` is published by the official MF org and actively shipped; the webpack/Rspack side is `@module-federation/enhanced`. ⚠️ Check the publish date of whichever plugin you are handed — the community `@originjs/vite-plugin-federation` that most tutorials link last shipped **2025-04-12**.

**★ Symptom: an app on Next.js is evaluating Vite.** Cause: treating the bundler as separable from the framework. Fix: on Next.js the bundler is Turbopack, and changing it means leaving Next.js. That may be right, but it is a framework decision wearing a bundler's clothes.

**★ Symptom: a library published with an app bundler breaks consumer builds.** Cause: app bundling and library bundling want opposite things. Fix: Vite's library mode or Rollup directly — and validate the *published artefact*, not the build log.

**★ Symptom: `splitChunks` has no obvious Vite equivalent and the migration stalls there.** Cause: there isn't one, and Vite 8 made it harder — the object form of `output.manualChunks` was removed and the function form is deprecated in favour of Rolldown's `codeSplitting`. Fix: treat chunking as a re-design rather than a port. A `splitChunks` config encodes a caching *intent*; restate the intent, do not translate the literal.

**★ Symptom: the migration is done, dev is fast, and CI is unchanged.** Cause: the dev server and the production build are different code paths, and only one of them runs in CI. Fix: measure both separately from the start. Vite's headline benefit is the dev loop; that is a real benefit and it is not a CI benefit.

**★ Symptom: a proposal is approved because nobody could argue with the numbers.** Cause: there was one option, so the numbers were unopposed rather than compared. Fix: require at least three costed rows — keep-and-fix, same-lineage swap, model change. The comparison is the review; a single estimate cannot be wrong in any visible way.

**★ Symptom: after moving to Vite, "it works in dev" bugs increase.** Cause: the dev server does not bundle your source, so tree-shaking, chunk boundaries, module evaluation order across chunks and minification have not run. Fix: `vite build` before believing a fix, and put a production build in the pre-merge pipeline. This is a genuine cost of the model and it is rarely in a migration proposal.

---

## Interview questions

**★ A team has a large webpack config and complains their builds take twenty minutes. What do you propose?**
First, that they profile — because if `tsc --noEmit` is twelve of the twenty minutes, no bundler
choice touches twelve minutes. If the bundling genuinely dominates, then **Rspack, not Vite**, and
the reasoning is the point: the complaint is *build speed*, not *configuration model*, and Rspack
changes the first without touching the second — same `splitChunks`, same loader concepts, Module
Federation, an official webpack migration guide, a Rust core built at ByteDance for exactly this
problem. Vite would also make builds faster and would *additionally* require rewriting every loader,
replacing `splitChunks` and accepting an unbundled dev server. That is a large cost to pay
incidentally.

**★ How would you decide between these tools for a project you are starting today?**
By writing down the constraint that actually binds and reading it off. No config to preserve → Vite.
Large webpack config, problem is speed → Rspack. Large webpack config, problem is the model → Vite,
with the rewrite budgeted honestly. Next.js → Turbopack, which is a consequence rather than a
choice. Publishing a library → Vite lib mode or Rollup, because app and library bundling want
opposite things. One-off transform → esbuild. Stating it as a table matters for a reason beyond
tidiness: it makes the *reason* auditable in two years, when someone asks why the repository has the
build system it has and nobody remembers.

**★ What does changing bundler NOT fix?**
Type-checking, which is usually the longest step in a large TypeScript build and which no bundler
runs — Vite deliberately does not type-check at all. High-fidelity source maps. A poorly designed
chunk graph, which is merely bad faster. And CI cache misses, which are frequently the real content
of "CI takes twenty minutes". The reason this list is worth having memorised is that every Rust
bundler's marketing is a comparison of the one number they *do* improve, and a team that never
profiled will attribute the whole wall-clock to it and be disappointed by a genuinely successful
migration.

**★ Why is `splitChunks` the hardest part of a webpack→Vite migration?**
Because it has no equivalent, and Vite 8 narrowed the nearest thing: the object form of
`output.manualChunks` was removed and the function form is deprecated in favour of Rolldown's
`codeSplitting`. But the deeper reason is that a `splitChunks` config encodes an *intent* — "these
packages share a cache lifetime, that route loads separately" — in a vocabulary of package names and
chunk groups. Porting it means restating the intent in a different vocabulary, not translating the
literal, which is a design task rather than a mechanical one. It is the one item in a typical
migration that cannot be estimated by counting.

**★ What is the honest cost of Vite's unbundled dev server?**
That dev and production diverge structurally, not just in speed. In development each module is its
own HTTP-served ESM file: nothing is tree-shaken, nothing is minified, module identity is
one-file-one-module, and chunk boundaries do not exist. In the build, all four change. So a class of
bug — evaluation order across chunks, a tree-shaken side effect, a minifier-sensitive pattern —
cannot appear until you run `vite build`. Unifying on Rolldown in Vite 8 removed one *kind* of
discrepancy, two transformers disagreeing about the same syntax, and left the structural one
completely intact. It is a real cost, it is worth paying for the dev loop, and it belongs in the
proposal rather than being discovered afterwards.

---

← [The 2026 Landscape](01-the-2026-bundler-landscape.md) · [Vite overview](../../README.md) · Next → [What Transfers From webpack, and What Does Not](02-webpack-to-vite-parity.md)
