---
title: "CI, Monorepos & Lint Performance Engineering"
sidebar_label: "CI, Monorepos & Lint Performance Engineeri"
sidebar_position: 1
---

# 🏗️ CI, Monorepos & Lint Performance Engineering

Covers syllabus **§20.1 CI Design**, **§20.2 Monorepo Patterns**, and **§20.3 Performance Pitfalls**.

Cross-link architecture concerns: [Frontend Architecture CI/CD](../../../frontend-architecture/pages/12-ci-cd-pipeline-design/01-shipping-safely.md) and team practices where process meets tooling.

## 1. Concept & Under-the-Hood Mechanics

### 20.1 CI Design for Linters

| Practice | Why |
| --- | --- |
| Fail fast with Oxlint | Cheap signal before e2e/typecheck matrices |
| Cache ESLint | `--cache` + cache key on config + lockfile |
| Oxlint | Often so fast caching is optional; still cache `node_modules` |
| Sharding / path filters | Affected packages only for PR—plus nightly full-tree |
| Warning budgets | `--max-warnings 0` / `denyWarnings` |
| **SARIF** | `eslint-formatter-sarif` (or equivalent) → code scanning alerts, not only job logs |
| **Annotations** | Problem matchers / JSON format so errors inline on the PR diff |

### 20.2 Monorepo Patterns

- **Root baseline + overrides** — shared correctness; apps override env/globals.  
- **Per-package ESLint flat configs** vs **one root** with `files` globs—both work; pick one and document.  
- **Oxlint nearest-config** — package-local `.oxlintrc.json` for divergent apps.  
- **Turbo/Nx** — `lint` task graph; invalidate remote cache when eslint/oxlint config hashes change.

### 20.3 Performance Pitfalls

- Type-aware ESLint on whole monorepo / scripts  
- `eslint-plugin-import` expensive resolvers / `no-cycle` on ESLint  
- Too many Oxlint **JS plugins** (alpha cliff)  
- Over-broad globs linting `dist`/`node_modules`

---

## 2. Real-World Engineering Scenario

**Scenario: PR CI 35 minutes, 12 of which are ESLint.**

Split job: (1) `oxlint` 40s required, (2) `eslint` residual 3m required, (3) full type-aware ESLint nightly. PR wall clock drops; quality on correctness rules improves because failures are visible faster. SARIF upload for security plugin findings goes to GitHub code scanning for longer-lived tracking.

---

## 3. Production-Grade Code Example

```yaml
# .github/workflows/lint.yml
name: lint
on: [pull_request]
jobs:
  oxlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm oxlint
  eslint:
    runs-on: ubuntu-latest
    needs: [oxlint]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - uses: actions/cache@v4
        with:
          path: .cache/eslint
          key: eslint-${{ hashFiles('**/eslint.config.*', 'pnpm-lock.yaml') }}
      - run: pnpm eslint . --cache --cache-location .cache/eslint --max-warnings 0 -f unix
```

SARIF sketch (package name may vary):

```bash
eslint . -f @microsoft/eslint-formatter-sarif -o eslint.sarif || true
# Upload via github/codeql-action/upload-sarif — wire only if the formatter package is adopted
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Cache keys missing config files
Stale green CI after rule severity changes.

### ⚠️ Path-filtered PR lint as only cycle detection
Cycles can be introduced via untouched files’ relationships—nightly full graph still matters.

### ⚠️ Turbo cache hits with changed lint config
Ensure config files are part of task inputs/hash.

### ⚠️ Annotations only for ESLint, not Oxlint
Engineers miss Oxlint failures in the UI—configure both or fail the job hard with clear logs.
