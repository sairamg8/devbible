---
title: "ESLint Editor Integration, Git Hooks & Scripts"
sidebar_label: "ESLint Editor Integration, Git Hooks & Scr"
sidebar_position: 1
---

# 🖥️ ESLint Editor Integration, Git Hooks & Scripts

Covers syllabus **§11.1 VS Code / IDE Integration** and **§11.2 Git Hooks & Local Scripts**.

## 1. Concept & Under-the-Hood Mechanics

### 11.1 IDE Integration

The official **ESLint VS Code extension** runs the same flat config as the CLI when working directories and ESLint versions align.

- Older extension settings mentioned `eslint.useFlatConfig` / experimental flags—modern extension versions default to flat config for ESLint 9+; if squiggles disagree with CLI, check extension ESLint resolution and monorepo **working directories**.
- **Monorepos:** set `eslint.workingDirectories` to package roots so each package’s config and `node_modules/eslint` resolve correctly.
- **Code Actions on save:** `source.fixAll.eslint` vs Prettier format-on-save—order matters; don’t run both as formatters fighting style.
- **Language validation:** configure which language IDs ESLint validates (`javascript`, `typescript`, `typescriptreact`, vue, etc.).

### 11.2 Hooks & Scripts

| Pattern | Guidance |
| --- | --- |
| `lint-staged` | Run linters only on staged files for speed |
| husky pre-commit | Keep under ~a few seconds or people skip hooks |
| Scripts | `lint`, `lint:fix`, `lint:ci` with explicit flags (`--max-warnings 0`, cache paths) |

Oxlint’s speed makes **pre-commit lint realistic** again on large trees; ESLint can run on staged paths only or CI-only for residual rules.

---

## 2. Real-World Engineering Scenario

**Scenario: editor green, CLI red.**

VS Code uses workspace-root ESLint 9 + flat config. A package still has nested ESLint 8. Terminal `pnpm --filter api lint` uses ESLint 8 + leftover eslintrc. Developer is confused for days. Fix: single ESLint version, hoisted binary, flat config only, `eslint.workingDirectories` mode `auto` or explicit package list.

---

## 3. Production-Grade Code Example

```json
// .vscode/settings.json
{
  // Harmless no-op on modern extension versions (flat config is already the
  // default for ESLint 9+) — kept explicit here only for teams pinned to an
  // older extension build where the default hasn't caught up yet.
  "eslint.useFlatConfig": true,
  "eslint.workingDirectories": [{ "mode": "auto" }],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true
}
```

```js
// lint-staged.config.js
export default {
  '*.{js,mjs,cjs,ts,tsx}': ['oxlint', 'eslint --fix --max-warnings 0'],
  '*.{json,md,yml}': ['prettier --write'],
};
```

```json
{
  "scripts": {
    "lint": "oxlint && eslint . --cache --max-warnings 0",
    "lint:fix": "oxlint --fix && eslint . --fix",
    "lint:ci": "oxlint && eslint . --cache --cache-strategy content --max-warnings 0"
  }
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Format on save with ESLint stylistic rules
Conflicts with Prettier. Use prettier as defaultFormatter; ESLint fix for semantic rules only.

### ⚠️ lint-staged running type-aware ESLint on partial files
Some type-aware rules need full project context—staged-only can false-negative. Keep full type-aware lint in CI.

### ⚠️ Hooks that run the entire monorepo build
Developers will use `--no-verify`. Prefer Oxlint + staged ESLint.

### ⚠️ Extension resolving a different ESLint than the project
Pin and use workspace TypeScript/ESLint SDKs where applicable; never rely on a global outdated `eslint`.

{/* LINKMAP:START */}

## Further reading

*Best explanations found elsewhere on the web — added alongside this page, nothing here replaces it.*

- **Read this:** [Integrations](https://eslint.org/docs/latest/use/integrations) — ESLint docs: a list of editor plugins (VS Code, JetBrains, Vim, Neovim and more) and a few git hook entries (a generic pre-commit hook, a staged-only hook, overcommit); it lists neither lint-staged nor husky (*read*)
- **Also good:** [Setup editors](https://oxc.rs/docs/guide/usage/linter/editors.html) — oxc.rs: editor extensions run `oxlint --lsp` from your project, so Oxlint must be installed locally (*read*)
- **Also good:** [Setup CI and other integrations](https://oxc.rs/docs/guide/usage/linter/ci.html) — oxc.rs: lint-staged and pre-commit examples; husky suggested for installing the hook (*read*)
- **Beyond the docs:** [Husky and lint-staged](https://betterstack.com/community/guides/scaling-nodejs/husky-and-lint-staged/) — Stanley Ulili, Better Stack, updated 2025-06-10: uses `npx husky init` (the v9 flow); `.husky/pre-commit` holds one `lint-staged` line, and the lint-staged config runs `eslint --fix --max-warnings=0` (*read*)

{/* LINKMAP:END */}
