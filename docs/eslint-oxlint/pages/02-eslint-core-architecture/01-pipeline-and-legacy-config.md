---
title: "ESLint Core Architecture: Pipeline & Legacy Config"
sidebar_label: "ESLint Core Architecture"
sidebar_position: 1
---

# ⚙️ ESLint Core Architecture: Pipeline & Legacy Config

Covers syllabus **§2.1 How ESLint Works Under the Hood** and **§2.2 Legacy Config Era**.

## 1. Concept & Under-the-Hood Mechanics

### 2.1 Source → Parse → AST → Rules

ESLint is a **pluggable static analyzer**, not a compiler. For each file roughly:

1. **Read** source text (and apply ignores).
2. **Parse** with a parser that emits an **ESTree-compatible AST** (default: Espree for JS). TypeScript, Vue, etc. swap the parser via `languageOptions.parser`.
3. **Run rules.** Each rule is a factory `create(context)` returning **visitors** keyed by node type or ESLint selectors (`CallExpression[callee.name='eval']`). The linter walks the AST; on each node it invokes matching enter/exit handlers.
4. **Collect reports** (`context.report`) with message, severity, optional fix/suggestion.
5. **Apply fixes** in multipass mode when `--fix` is set: apply non-overlapping fix ranges, re-parse, re-run until stable or conflict.

**Why AST shape knowledge matters:** rules do not “search text.” They pattern-match node types and properties. A mistaken assumption (e.g. treating `foo?.bar()` like a simple `CallExpression` without optional chaining nodes) produces false negatives.

**Linter vs CLI vs IDE:** the same core engine evaluates rules. The **CLI** discovers files, loads flat config, formats output, manages cache and exit codes. The **editor extension** typically lints open/changed buffers with a subset of CLI options (and its own working-directory rules). Programmatic **`ESLint` class** embeds the same pipeline in custom tools.

**Autofix model:** a fix is `{ range: [start, end], text }`. Two fixes that overlap cannot both apply in one pass. Multipass fixing re-runs after partial application. Conflicting autofixes across rules are a real production failure mode—especially style + semantic rules mixed together.

### 2.2 Legacy Config Era (Historical Context)

Before flat config, ESLint used **cascading** config files:

- `.eslintrc`, `.eslintrc.js`, `.eslintrc.cjs`, `.eslintrc.json`, `.eslintrc.yaml`
- `package.json` `"eslintConfig"`
- **`.eslintignore`** for ignore patterns

Lookup walked from the linted file upward, merging `extends`, `env`, `globals`, `overrides`. That was powerful and *opaque*: “why is this rule on?” required mentally simulating cascade + overrides + shareable configs.

**Why flat config replaced it:** flat config is an **explicit array of config objects** evaluated with clear `files`/`ignores` targeting—no implicit directory cascade. Modern ESLint (v9+) treats flat config as the supported path; legacy eslintrc is migration history.

You still see eslintrc in older monorepo packages, CRA-era templates, and some generate-era Next apps. Treat them as **migrate-before-extend** debt: new APIs and many plugins assume flat config.

---

## 2. Real-World Engineering Scenario

**Scenario: “No-unused-vars is error in CI but off in VS Code.”**

A package at `packages/api` has `.eslintrc.js` extending a root config. The app at `apps/web` uses flat `eslint.config.mjs`. The VS Code ESLint extension, pointed at the workspace root with flat config, does not load the package’s eslintrc the same way the package’s local `pnpm lint` does via an older ESLint 8 binary in that package’s `node_modules`. Developers “fix” unused vars in the editor; CI (root flat config + different plugin versions) fails.

Root cause is **two config systems + two ESLint majors** in one repo. Fix: one ESLint major, flat config only, either root `files` globs per package or documented per-package flat configs—no eslintrc left behind.

---

## 3. Production-Grade Code Example

**Mental model of a minimal rule visitor (illustrative):**

```js
// conceptual — not a full plugin package
export default {
  meta: { type: 'problem', docs: { description: 'disallow eval' }, schema: [] },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'eval') {
          context.report({ node, message: 'eval is not allowed' });
        }
      },
    };
  },
};
```

**Legacy shape (history only — do not start new projects here):**

```js
// .eslintrc.cjs — legacy cascade era
module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  extends: ['eslint:recommended'],
  overrides: [{ files: ['**/*.ts'], parser: '@typescript-eslint/parser' }],
};
```

**Modern flat equivalent direction:**

```js
// eslint.config.js
import js from '@eslint/js';

export default [
  { ignores: ['dist/**', 'coverage/**'] },
  js.configs.recommended,
];
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Assuming Espree parses TypeScript
It does not. Without `@typescript-eslint/parser` (or another TS-capable parser), TS syntax fails parse or is misread.

### ⚠️ Autofix in CI without review on first enable
Bulk `--fix` on a legacy tree can change thousands of lines. Prefer dry-run, scoped paths, or a dedicated cleanup PR.

### ⚠️ Debugging rules by reading formatted output only
Use Config Inspector / debug flags when available; confirm which config object applied. Cascade-era “extends of extends” is especially hostile—another reason flat config won.

### ⚠️ Leaving `.eslintignore` as the long-term source of truth
In flat config, prefers `ignores` / `globalIgnores`. Oxlint similarly wants `ignorePatterns` long-term (see [Oxlint ignores](../17-oxlint-fixes-ignores-and-diagnostics/01-fixes-ignores-and-diagnostics.md)).

### ⚠️ Mixing CLI Engine mental models from old blog posts
`CLIEngine` is historical. Modern programmatic use is the `ESLint` class API (see [CLI & programmatic](../08-eslint-cli-output-cache-and-fixes/01-cli-and-programmatic-usage.md)).
