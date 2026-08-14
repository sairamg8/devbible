---
title: "Oxlint Core Architecture: Design & Differences from ESLint"
sidebar_label: "Oxlint Core Architecture"
sidebar_position: 1
---

# 🦀 Oxlint Core Architecture: Design & Differences from ESLint

Covers syllabus **§12.1 What Oxlint Is** and **§12.2 Architectural Differences from ESLint**.

## 1. Concept & Under-the-Hood Mechanics

### 12.1 What Oxlint Is

**Oxlint** is a high-performance JS/TS linter built on the **Oxc** compiler stack (Rust parser, semantic analysis shared with other Oxc tools). Pronunciation note from upstream: roughly “ox-lint.”

Design goals (as framed by Oxc docs):

- Scale to **large repositories and CI**  
- **Correctness-focused defaults** (high-signal, low noise out of the box)  
- Broad **ESLint-compatible rule coverage** via native reimplementations  
- First-class **migration path** from ESLint  
- **Type-aware** linting aligned with TypeScript semantics (via tsgolint / TypeScript Go lineage—see [§15](../15-oxlint-type-aware-linting-and-multi-file-analysis/01-type-aware-and-multi-file.md))

**Language support:** `.js/.mjs/.cjs/.ts/.mts/.cts/.jsx/.tsx`, plus framework files (Vue/Svelte/Astro) by linting **script blocks**.

**Performance mental model:** public benchmarks often cite **~50–100×** vs ESLint on large trees. Treat that as an order-of-magnitude claim—measure with your plugins, type-aware mode, and JS-plugin alpha features enabled. This repo pins `oxlint` in `package.json` (see root `package.json` devDependency) for the docs site itself.

### 12.2 Architectural Differences from ESLint

| Dimension | ESLint | Oxlint |
| --- | --- | --- |
| Rule implementation | Mostly JavaScript rules | **Native Rust** rules; optional **JS plugins (alpha)** |
| Defaults | Shareable “recommended” packages | **Categories** (correctness, suspicious, …) with correctness-first defaults |
| Config shape | Flat **array** of objects (`eslint.config.*`) | **`.oxlintrc.json` / `oxlint.config.ts`** aligned with ESLint **v8-style** schema (not flat array) |
| Multi-file / import graph | Often expensive JS resolvers | **Multi-file analysis** as a designed feature for graph rules |
| Extensibility | Mature custom rule API | Prefer native coverage; JS plugins maturing; dual-run for gaps |

Oxlint is a **linter**, not a bundler or typechecker (though experimental type-check integration exists). Formatting belongs to Prettier/Oxfmt/Biome format.

---

## 2. Real-World Engineering Scenario

**Scenario: Kibana-scale / monorepo CI.**

Projects publicly associated with Oxlint adoption (Kibana, Sentry JS SDKs, etc. per upstream marketing) share a theme: ESLint wall-clock time dominated CI. Oxlint’s native rules + shared parse amortize cost. Teams still keep ESLint when a security plugin or bespoke rule has no native twin—architecture assumes **hybrid** rather than religious purity.

---

## 3. Production-Grade Code Example

```bash
# This docs repo already uses oxlint as the lint script
yarn lint
# → oxlint
```

```json
// Minimal zero-config expectation: running oxlint with no config still applies correctness defaults
// Adding .oxlintrc.json opts into plugins/categories explicitly
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "categories": {
    "correctness": "error"
  }
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Assuming config is “flat config like ESLint 9”
It is **not** an array of `{ files, rules }`. Overrides use an `overrides` array inside JSON/TS config. Don’t copy `eslint.config.js` structure into `.oxlintrc.json` and expect it to parse.

### ⚠️ Expecting 100% ESLint rule option parity
Native reimplementations track popular options; migration tools report gaps. Always triage `@oxlint/migrate` output.

### ⚠️ Enabling every category at error on day one
Same adoption failure mode as `eslint:all`. Start correctness; expand.

### ⚠️ Ignoring JS-plugin alpha performance cliffs
Many simultaneous JS plugins can regress toward ESLint-like costs—see [§16](../16-oxlint-js-plugins-and-extensibility/01-js-plugins-and-custom-rules.md).
