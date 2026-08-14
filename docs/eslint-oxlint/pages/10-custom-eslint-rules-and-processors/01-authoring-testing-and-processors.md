---
title: "Custom ESLint Rules, Testing & Processors"
sidebar_label: "Custom ESLint Rules, Testing & Processors"
sidebar_position: 1
---

# 🛠️ Custom ESLint Rules, Testing & Processors

Covers syllabus **§10.1 Authoring a Rule**, **§10.2 Testing Rules**, and **§10.3 Custom Processors**.

## 1. Concept & Under-the-Hood Mechanics

### 10.1 Authoring a Rule

A rule module exports:

```js
export default {
  meta: {
    type: 'problem', // problem | suggestion | layout
    docs: { description: '...', recommended: false },
    fixable: 'code', // or 'whitespace' or omit
    hasSuggestions: true,
    schema: [/* JSON schema for options */],
    messages: { avoidFoo: 'Do not use foo()' },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'foo') {
          context.report({
            node,
            messageId: 'avoidFoo',
            fix(fixer) {
              return fixer.replaceText(node.callee, 'bar');
            },
          });
        }
      },
    };
  },
};
```

- **`context.report`** records findings.  
- **Fixers** must be correct for all syntax forms you claim to handle—or omit `fixable`.  
- **Suggestions** are optional fixes the user applies manually in the IDE.  
- Share utilities inside the plugin package; don’t copy-paste AST helpers across rules.

### 10.2 Testing with RuleTester

`RuleTester` runs valid/invalid code strings (or file fixtures). Prefer fixtures that look like production code over toy `var x = 1` samples. For TypeScript rules, use the typescript-eslint RuleTester configuration that sets the TS parser and, if needed, type-aware project services.

### 10.3 Processors

Processors extract virtual JS/TS blocks from **Vue SFC, Markdown, MDX, Astro**, etc. Prefer **maintained framework plugins** over writing a processor from scratch. A bad processor loses line mappings → broken disable comments and confusing IDE squiggles.

---

## 2. Real-World Engineering Scenario

**Scenario: enforce no direct `@acme/legacy-api` imports outside `src/legacy/`.**

Architecture guild wants a hard boundary. An `import/no-restricted-paths` setup is awkward; a 30-line custom rule flags `ImportDeclaration` sources matching the package name when filename is outside allowlist. RuleTester fixtures cover alias imports and re-exports. Violations fail CI with a message linking to the ADR. This is the kind of rule that keeps ESLint in a dual-run with Oxlint when Oxlint cannot express the policy yet.

---

## 3. Production-Grade Code Example

```js
// tools/eslint-plugin-acme/rules/no-legacy-api-outside-folder.js
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Only src/legacy may import @acme/legacy-api' },
    schema: [],
    messages: {
      forbidden: 'Import @acme/legacy-api only from src/legacy/** (see ADR-142).',
    },
  },
  create(context) {
    const filename = context.filename.replace(/\\/g, '/');
    const allowed = filename.includes('/src/legacy/');
    return {
      ImportDeclaration(node) {
        if (allowed) return;
        if (node.source.value === '@acme/legacy-api') {
          context.report({ node: node.source, messageId: 'forbidden' });
        }
      },
    };
  },
};
```

```js
// RuleTester sketch
import { RuleTester } from 'eslint';
import rule from '../rules/no-legacy-api-outside-folder.js';

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
});

ruleTester.run('no-legacy-api-outside-folder', rule, {
  valid: [
    {
      code: `import x from '@acme/legacy-api';`,
      filename: '/repo/src/legacy/client.ts',
    },
  ],
  invalid: [
    {
      code: `import x from '@acme/legacy-api';`,
      filename: '/repo/src/app/page.ts',
      errors: [{ messageId: 'forbidden' }],
    },
  ],
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Fixes that break comments or template strings
Always re-test fix output; prefer suggestions if uncertain.

### ⚠️ Using `context.getFilename()` assumptions on Windows
Normalize path separators.

### ⚠️ Custom processors when a plugin already exists
Maintenance cost of mapping source locations is high.

### ⚠️ Rules that need type info without type-aware setup
They will be wrong or empty—use typescript-eslint utilities and document projectService requirements.
