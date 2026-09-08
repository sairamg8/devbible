---
title: "The Frontend Build Landscape in September 2026: Five Live Bundlers, and Which Question Each One Answers"
sidebar_label: "The 2026 Landscape"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07. Versions and publish dates fetched from **registry.npmjs.org**; positioning statements quoted from each project's own documentation — [Why Vite](https://vite.dev/guide/why), [Migration from v7](https://vite.dev/guide/migration), [Rspack Introduction](https://rspack.rs/guide/start/introduction). Dependency facts read from the published `vite@8.2.2` manifest. **No sandbox run, no timings, no benchmarks.** Target: **Vite 8.2.2 · webpack 5.110.3 · Rspack 2.2.2 · Babel 8.0.1**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ The Frontend Build Landscape in September 2026

The common belief is that Vite won and webpack died. **Both halves are wrong.** Vite won the
greenfield dev-server slice decisively; webpack shipped `5.110.3` on 2026-09-01. What actually
happened is that the ecosystem **fragmented into two lineages** rather than consolidating onto one
tool, and knowing which lineage you are in tells you what your migration options are.

---

## 1. Under-The-Hood Mechanics

### The two lineages

```
LINEAGE A — "the ESM dev server"          LINEAGE B — "the webpack config model"
  Vite 8.2.2                                webpack 5.110.3
    └── Rolldown 1.2.7 (Rust)                 └── Rspack 2.2.2 (Rust)
    └── Oxc (Rust, transforms)                └── SWC (Rust, transforms)
                                              └── Turbopack (Rust, inside Next.js)

  config: small, convention-first           config: explicit graph — entry, output,
  entry: index.html                                 loaders, plugins, splitChunks
  dev: native ESM, no bundle                dev: bundle, then serve
```

**Every fast bundler in 2026 is Rust.** That is the one uncontested convergence: Rolldown, Rspack,
Turbopack, Oxc and SWC are all Rust, and the JavaScript-implemented bundler is now a legacy
category. What did *not* converge is the **configuration model**, which is what actually costs you
time when you move.

### Vite 8 — one engine, finally

Vite's own history, in its own words:

> *"Vite originally relied on two separate tools under the hood: esbuild for fast compilation during development, and Rollup for thorough optimization in production builds."* … *"Rolldown was built to unify both into a single bundler"* — [Why Vite](https://vite.dev/guide/why)

> *"Vite 8 uses Rolldown and Oxc based tools instead of esbuild and Rollup."* — [Migration from v7](https://vite.dev/guide/migration)

🔴 **The evidence is the package manifest, not a blog post.** `vite@8.2.2`'s `dependencies` are
`postcss`, **`rolldown ~1.2.4`**, `picomatch`, `tinyglobby` and `lightningcss`. Rollup is **not a
dependency at all**; esbuild is only an *optional peer*. `engines.node` is `^20.19.0 || >=22.12.0`.

So the "esbuild in dev, Rollup in prod" description that most material still repeats describes
**Vite 7 and earlier**. On Vite 8 there is one bundler on both sides of the dev/build line.

### webpack — alive, and no longer the default

`webpack@5.110.3`, published **2026-09-01**. Six days before this page was written. Not abandoned,
not unmaintained, not a legacy runtime.

⚠️ **npm's `next` dist-tag for webpack reads `5.0.0-rc.6`.** That is a stale tag left pointing at an
old release candidate, **not** a newer line. Do not read it as a webpack 6.

What webpack still holds is not speed — it lost that — but **expressiveness and installed base**:
`splitChunks`'s chunk-graph control, the loader long tail for file types nothing else handles,
CommonJS-heavy legacy interop, and the several million existing configs that someone has to keep
running.

### Rspack — the webpack successor that is not Vite

Rspack describes itself without ambiguity:

> *"Rspack (pronounced as /'ɑrespæk/) is a fast Rust-based bundler for the web. It **modernizes the webpack API to enable seamless replacement of webpack** while delivering lightning-fast build speeds."* — [Rspack Introduction](https://rspack.rs/guide/start/introduction)

Its documentation ships a *Migrate from webpack* guide, an SWC loader, a Lightning CSS loader, asset
modules, `splitChunks`-shaped code splitting and Module Federation — i.e. the webpack surface, in
Rust. It was built at ByteDance, where *"Production build times had grown to ten minutes or even
half an hour in some cases."*

🔴 **This is the single most important correction to the "Vite replaced webpack" story.** If you
have a large webpack config, the drop-in successor is **Rspack**, not Vite. Vite is a different
configuration model and a rewrite; Rspack is a swap.

### Turbopack — Next.js's answer, not a general one

Turbopack is Vercel's Rust bundler for Next.js. It is not distributed as a standalone bundler you
adopt for an arbitrary app; it is what Next.js runs. So for the purposes of "which bundler should I
choose", it is usually not a choice you make — it is a consequence of choosing Next.js.

### Where esbuild and Rollup went

Neither disappeared; both moved down a layer.

- **esbuild `0.28.2`** — still the fastest transform for one-off jobs, still ubiquitous inside other
  tools, and out of Vite 8's pipeline. A tool you use *through* something else.
- **Rollup `4.63.1`** — still shipping, still the reference for library bundling and the plugin API
  that Rolldown deliberately mirrors. Rolldown's compatibility with the Rollup plugin ecosystem is
  precisely why Vite's plugin ecosystem survived the engine swap intact.

### Versions, all fetched 2026-09-07

| Product | Version | Published | Note |
|---|---|---|---|
| `vite` | **8.2.2** | 2026-08-20 | depends on `rolldown`, not `rollup` |
| `rolldown` | 1.2.7 | 2026-09-02 | Vite 8's engine |
| `webpack` | **5.110.3** | 2026-09-01 | alive; `next` tag is stale |
| `@rspack/core` | **2.2.2** | 2026-09-01 | the webpack-shaped successor |
| `@babel/core` | **8.0.1** | 2026-06-17 | Babel 8 is stable |
| `rollup` | 4.63.1 | 2026-08-28 | library bundling, plugin API reference |
| `esbuild` | 0.28.2 | 2026-08-08 | out of Vite 8's pipeline |
| `@swc/core` | 1.16.2 | 2026-09-04 | Rspack's and Next's transformer |
| `parcel` | 2.16.4 | 2026-02-02 | slowest release cadence of the set |

---


## 3. Production-Grade Code Example

```bash
# Establishing the facts for your own project, before anyone writes a proposal.

# 1. What is your bundler actually, and is it maintained?
npm view webpack version dist-tags.latest time.modified
npm view @rspack/core version
npm view vite version

# 2. What does Vite 8 actually depend on? (the Rolldown claim, verifiable)
npm view vite@8 dependencies
# → { postcss, rolldown, picomatch, tinyglobby, lightningcss }   ← no rollup

# 3. How much webpack surface do you actually use? This is the migration estimate.
grep -c 'loader' webpack.config.js
grep -n 'splitChunks\|ModuleFederationPlugin\|ProvidePlugin\|require.context' -r . --include=*.js
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — "webpack is dead"

It shipped `5.110.3` on 2026-09-01. What is true is that it is no longer the default choice for new
work. Those are different statements, and the second one does not license a migration on its own.

### ⚠️ Pitfall 3 — Repeating the "esbuild in dev, Rollup in prod" description

That is Vite 7 and earlier. On Vite 8 the manifest shows `rolldown` as a dependency and no `rollup`
at all. The description survives in an enormous amount of material, including material written after
the change.

### ⚠️ Pitfall 4 — Reading webpack's `next` dist-tag as a new major

It reads `5.0.0-rc.6` — an old release candidate the tag was never moved off. There is no webpack 6
behind it.

---

## Gotchas

**★ Symptom: a migration proposal justifies itself with "webpack is unmaintained".** Cause: an assumption nobody checked. Fix: check. `npm view webpack time.modified` — `5.110.3` shipped 2026-09-01. A proposal resting on a false premise needs re-costing even when the conclusion happens to be right.

**★ Symptom: documentation or an AI answer says Vite uses esbuild and Rollup.** Cause: it describes Vite 7. Fix: check the manifest, which cannot be out of date — `npm view vite@8 dependencies` lists `rolldown` and no `rollup`.

**★ Symptom: `build.rollupOptions` still works on Vite 8 and a lint says to change it.** Cause: it is now an alias — the v8 name is `build.rolldownOptions`. Fix: rename it. It is a straight rename with no behaviour change, which is exactly why nobody does it until something forces them.

**★ Symptom: a team rejects leaving webpack because of Module Federation.** Cause: out-of-date information. Fix: `@module-federation/vite` is published by the official Module Federation org and is actively shipped; the webpack/Rspack side is `@module-federation/enhanced`. ⚠️ Check the publish date of whichever plugin you are handed — the community `@originjs/vite-plugin-federation`, which most tutorials link, last shipped **2025-04-12**.

**★ Symptom: a `parcel` project feels stalled.** Cause: `parcel@2.16.4` was published 2026-02-02, the slowest cadence in this set. Fix: not automatically a problem — a stable tool can be finished — but it is a fact worth surfacing in any comparison, alongside webpack's 2026-09-01, precisely because "unmaintained" claims are usually made about the wrong project.

---

## Interview questions

**★ Did Vite replace webpack?**
No, and the accurate version is more interesting. Vite won greenfield decisively, and webpack is
still shipping — `5.110.3` on 2026-09-01. What actually happened is that the ecosystem split into
two lineages: the ESM-dev-server model (Vite, now on Rolldown) and the webpack config model (webpack
itself, and Rspack, which says it *"modernizes the webpack API to enable seamless replacement of
webpack"*). Both lineages went Rust. Neither absorbed the other. The practical consequence is that
"we should leave webpack" does not imply "we should move to Vite" — for an existing config, the
successor in the same lineage is Rspack, and choosing Vite means choosing a rewrite.

**★ What changed in Vite 8, and how would you verify it without trusting a blog post?**
Vite unified on Rolldown: *"Vite 8 uses Rolldown and Oxc based tools instead of esbuild and Rollup."*
The verification is the package manifest — `npm view vite@8 dependencies` returns `postcss`,
`rolldown`, `picomatch`, `tinyglobby`, `lightningcss`, with **no `rollup`**, and esbuild demoted to
an optional peer. That is a stronger source than any prose because it is what actually gets
installed. It also matters for a practical reason: the "esbuild in dev, Rollup in prod" line is
still in a large amount of published material, so a candidate reciting it is telling you when they
last read about the tool rather than what it does.

**★ Why did every bundler become Rust rather than, say, Go or staying in JavaScript?**
Bundling is a parallelisable, allocation-heavy graph problem, and the honest answer is that the
dominant factor was ecosystem gravity rather than language properties: Rust has mature napi bindings
for shipping native modules to npm, a parser ecosystem (SWC, Oxc) that several projects could share,
and no runtime that has to be embedded alongside Node's. esbuild proved the point in Go first, which
is worth acknowledging — the argument was never "Rust specifically", it was "not JavaScript". What
follows practically is that the *transform* is no longer the bottleneck anywhere, so a team still
complaining about build times after switching is usually being slowed by type-checking, source maps
or CI cache behaviour, none of which the bundler's language touches.

**★ Where did esbuild and Rollup go?**
Down a layer, not away. esbuild `0.28.2` is still shipping and still the right tool for a one-off
transform in a script, and it remains embedded inside a great many tools — it just left Vite 8's
pipeline. Rollup `4.63.1` is still the reference for library bundling, and more importantly its
**plugin API is what Rolldown mirrors**, which is the entire reason Vite could swap engines without
detonating its plugin ecosystem. That is a genuinely instructive piece of design: the compatibility
surface that survived the rewrite was the *interface*, not the implementation, and it is why the
Vite 8 migration is a list of renamed options rather than an ecosystem reset.

---

← [01n · Module Federation](../16-migration-recipes/01n-module-federation-migration.md) · [Vite overview](../../README.md) · Next → [Choosing a Bundler](01a-choosing-a-bundler.md)
