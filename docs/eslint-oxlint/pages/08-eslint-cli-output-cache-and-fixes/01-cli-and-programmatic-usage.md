---
title: "ESLint CLI, Output, Cache, Fixes & Programmatic API"
sidebar_label: "ESLint CLI, Output, Cache, Fixes & Program"
sidebar_position: 1
---

# 💻 ESLint CLI, Output, Cache, Fixes & Programmatic API

Covers syllabus **§8.1 CLI Essentials** and **§8.2 Programmatic & Advanced Usage**.

## 1. Concept & Under-the-Hood Mechanics

### 8.1 CLI Essentials

| Flag / form | Role |
| --- | --- |
| `eslint [paths]` | Lint files/dirs; directory linting uses config `files` patterns |
| `--fix` | Apply autofixes that rules declare safe enough to fix |
| `--fix-dry-run` | Compute fixes without writing (good for PR previews) |
| `--cache` | Skip unchanged files based on cache file |
| `--cache-location` | Where to store cache (CI artifact path) |
| `--cache-strategy` | `metadata` vs `content` — content is safer when mtimes lie (some CI checkouts) |
| `-f` / `--format` | `stylish` (default), `unix`, `json`, `compact`, or custom formatter package |
| `--max-warnings N` | Exit non-zero if warnings exceed N |

**Exit codes:** non-zero on errors (and on warning threshold breach). Chain with `oxlint && eslint` so Oxlint failures fail fast (see [coexistence](../18-coexistence-eslint-and-oxlint/01-dual-run-overlap-and-retirement.md)).

### 8.2 Programmatic API

The modern **`ESLint` class** (not legacy `CLIEngine`) embeds linting in codemods, custom gates, or editor-like tools:

```js
const eslint = new ESLint({ fix: true });
const results = await eslint.lintFiles(['src/**/*.ts']);
await ESLint.outputFixes(results);
```

**Changed-files-only lint** (PR diff strategies) speeds CI but risks missing cross-file rule impacts (import cycles, type-aware issues in importers). Use as an additional fast path, not the only merge gate for graph-sensitive rules.

Inline `eslint-disable` comments still apply unless `noInlineConfig` / CLI flags disable them.

---

## 2. Real-World Engineering Scenario

**Scenario: cache poison after dependency bump.**

CI caches `.eslintcache` keyed only on lockfile hash, not on `eslint.config.mjs`. A rule severity change leaves CI green on stale cache. Fix: include config files and ESLint version in the cache key, or use `--cache-strategy content`.

---

## 3. Production-Grade Code Example

```json
{
  "scripts": {
    "lint:eslint": "eslint . --cache --cache-location ./.cache/eslint --max-warnings 0",
    "lint:eslint:fix": "eslint . --fix --cache"
  }
}
```

```yaml
# GitHub Actions excerpt
- uses: actions/cache@v4
  with:
    path: .cache/eslint
    key: eslint-${{ hashFiles('**/eslint.config.*', '**/pnpm-lock.yaml') }}
- run: pnpm lint:eslint
```

```js
// tools/lint-gate.mjs
import { ESLint } from 'eslint';

const eslint = new ESLint({ cache: true });
const results = await eslint.lintFiles(process.argv.slice(2));
const formatter = await eslint.loadFormatter('stylish');
console.log(formatter.format(results));
const errorCount = results.reduce((n, r) => n + r.errorCount, 0);
process.exitCode = errorCount > 0 ? 1 : 0;
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ `eslint .` without ignores
Walks `node_modules` if misconfigured—always set global ignores.

### ⚠️ `--fix` in the same CI step as review
Auto-fix commits need a deliberate bot PR or local policy; silent fix on main is controversial.

### ⚠️ Diff-only lint as sole gate
Misses broken imports in files not touched by the PR when the *importer* changes semantics.

### ⚠️ JSON formatter without handling huge output
Monorepo JSON reports can OOM log collectors—stream or path-filter.
