---
title: "Oxlint Type-Aware Linting & Multi-File Analysis"
sidebar_label: "Oxlint Type-Aware Linting & Multi-File Ana"
sidebar_position: 1
---

# 🔬 Oxlint Type-Aware Linting & Multi-File Analysis

Covers syllabus **§15.1 Type-Aware Mode** and **§15.2 Multi-File Analysis**.

## 1. Concept & Under-the-Hood Mechanics

### 15.1 Type-Aware Mode

Some rules need **TypeScript types**, not just syntax (classic example: **floating promises**).

Oxlint enables this via:

- CLI: `--type-aware`  
- Config: `options.typeAware: true`  

**Dependency:** `oxlint-tsgolint` — integrates a **native Go port of the TypeScript compiler** (tsgo / TypeScript 7 lineage) so type behavior stays aligned with TypeScript itself, rather than a partial reimplementation.

**`options.typeCheck` / `--type-check`:** experimental path to surface broader compiler diagnostics through the linter. Treat as experimental until your version’s release notes say otherwise; still keep a dedicated `tsc` CI step unless you have verified parity for your repo.

**Contrast with Biome:** Biome has invested in its own type inference approaches; Oxlint’s pitch is **compiler-aligned** types via the TS toolchain port. Different tradeoffs: alignment vs independent implementation maturity.

### 15.2 Multi-File Analysis

Multi-file mode builds a **project module graph** and shares parse/resolve across rules. This targets checks like **`import/no-cycle`** that historically caused **severe ESLint + eslint-plugin-import performance cliffs**.

Enable when you rely on graph rules in CI; measure cost. For huge monorepos, you may run multi-file always in CI but keep local pre-commit on cheaper subsets—**verify flags/options for your Oxlint version** (feature naming can evolve; check current Oxc docs if a flag is unclear).

---

## 2. Real-World Engineering Scenario

**Scenario: silent lost errors from unawaited promises.**

A NestJS-like service calls `await repo.save()` but forgets `await` on `notifyUser()` which returns `Promise<void>`. Unit tests mock notify. Production drops notifications. Type-aware `no-floating-promises` class rules catch it at lint time. Without type-aware mode, pure syntax linters often miss it.

**Scenario: import cycle CI job at 40 minutes on ESLint.**

`import/no-cycle` on a 3k-module graph dominates. Switching cycle detection to Oxlint multi-file analysis drops the job dramatically; ESLint residual config disables the overlapping import rules via `eslint-plugin-oxlint`.

---

## 3. Production-Grade Code Example

```bash
pnpm add -D oxlint oxlint-tsgolint
```

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["typescript", "import"],
  "categories": { "correctness": "error" },
  "rules": {
    "import/no-cycle": "error"
  },
  "options": {
    "typeAware": true
  }
}
```

```json
{
  "scripts": {
    "lint": "oxlint --type-aware",
    "lint:fast": "oxlint"
  }
}
```

Use `lint:fast` for editor-adjacent hooks if type-aware is too heavy locally; keep `--type-aware` required in CI.

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ typeAware without tsgolint installed
Fails or silently skips type rules—install the companion package.

### ⚠️ Expecting full `tsc` replacement
Even with typeCheck experiments, treat `tsc --noEmit` as the source of truth for type correctness until your org validates otherwise.

### ⚠️ Multi-file + JS plugins + type-aware all at once on first PR
Stack costs; enable one dimension at a time and benchmark.

### ⚠️ Floating promise false positives on intentional void
Establish a team pattern (`void promise` or helper) and document it.
