---
name: research-eslint-oxlint-01-landscape
description: Banked primary-source quotes for the eslint-oxlint track — Oxlint's own positioning and speed claim, the ESLint→Oxlint migration guidance, eslint-plugin-oxlint, and ESLint's 2023 deprecation of formatting rules. Fetched 2026-09-08. Do not re-derive.
metadata:
  type: reference
---

# Research bank — eslint-oxlint, topics 01 / 18 / 19

**Fetched 2026-09-08. 🔴 Do not re-derive — write every chunk of topics 01, 18 and 19
from this file.** Research once per topic, not once per page.

## Oxlint — `https://oxc.rs/docs/guide/usage/linter.html`

> *"Our benchmarks show Oxlint is 50 to 100 times faster than ESLint."*

> *"Choose Oxlint if you want the best dedicated linter"* — versus *"Choose Vite+ if you
> want a unified toolchain that includes Oxlint and Oxfmt"*.

> *"Migrate incrementally (recommended for especially large and complex repos). Run
> Oxlint first, then run ESLint with overlapping rules disabled."*

Uses `eslint-plugin-oxlint` *"to disable overlapping ESLint rules while running both"*.

## Migrating — `https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint`

> *"Stay on ESLint if a specific missing behavior still blocks migration."*

The dual-run shape, verbatim: *"Enable Oxlint for all supported rules; Keep ESLint for
unsupported rules; Disable overlapping rules in ESLint"*, and *"run Oxlint first to catch
errors early, then fall back to ESLint only if needed."*

Limits, verbatim: *"Some rules may not yet be available"*; *"Some rules are deprecated in
the original plugins, or have alternatives implemented already"*; local custom ESLint
plugins *"will not be migrated automatically by `@oxlint/migrate` right now"*; and
*"JS Plugins functionality does not support all ESLint plugins"*.

## `eslint-plugin-oxlint` — `https://github.com/oxc-project/eslint-plugin-oxlint`

Repo tagline: *"Turn off all rules already supported by oxlint"*. Presets exist both **by
plugin** (`flat/eslint`, `flat/import`, `flat/jest`, `flat/jsdoc`, `flat/jsx-a11y`,
`flat/nextjs`, `flat/react`, `flat/react-perf`, `flat/tree-shaking`, `flat/typescript`,
`flat/unicorn`) and **by oxlint category** (`flat/correctness`, `flat/pedantic`,
`flat/restriction`, `flat/style`, `flat/suspicious`). In flat config it goes **last** in
the exported array. Optimised for ESLint >= 9.

## ESLint deprecating formatting rules — `https://eslint.org/blog/2023/10/deprecating-formatting-rules/`

> *"Formatting rules are those rules that simply enforce code conventions around spacing,
> semicolons, string formats, etc."*

🔴 **Precision that matters for our pages:** the rules moved to
**`@stylistic/eslint-plugin-js`** (JavaScript) and **`@stylistic/eslint-plugin-ts`**
(TypeScript), maintained by Anthony Fu at eslint.style — not to a single
`@stylistic/eslint-plugin` name. ESLint's own recommendation is a dedicated formatter,
naming **Prettier** and **dprint**.

Related: [[devbible-validation-ledger]] · [[devbible-cursor-a2-toolchain]]
