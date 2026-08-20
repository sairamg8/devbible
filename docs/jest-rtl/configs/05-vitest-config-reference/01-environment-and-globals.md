---
title: "Environment and globals"
sidebar_label: "01 · Environment and globals"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the [Vitest config reference](https://vitest.dev/config/)
> — `environment`, `environmentOptions`, `globals`, `include`, `exclude`, `css`,
> `setupFiles` — and the [Vitest guide](https://vitest.dev/guide/environment).
> **No sandbox, no console blocks.**

---

## `environment`

| Option | Default |
|---|---|
| `test.environment` | `'node'` |

Values: `'node'`, `'jsdom'`, `'happy-dom'`, `'edge-runtime'`, or a custom environment.

```ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'https://example.test/' } },
  },
});
```

**`jsdom` and `happy-dom` are separate packages** — install whichever you name.

### `happy-dom` — faster, and not the same

`happy-dom` is a lighter DOM implementation and measurably quicker to construct. The trade
is coverage of the platform: it implements less, and what it implements can differ subtly.

**The honest position:** if the suite is large and DOM-construction time dominates,
`happy-dom` is worth trying — and worth re-running the whole suite on, because
differences show up as individual test failures rather than a clean error. For most
projects the difference is not the bottleneck.

### Per-file override

Vitest reads a docblock comment, like Jest:

```ts
// @vitest-environment node
import { calculateTax } from './tax';
```

⚠️ **Note the syntax differs from Jest's.** Jest wants a JSDoc block with
`@jest-environment`; Vitest accepts the line-comment form above. Copying a Jest docblock
across verbatim does nothing — and it does nothing *silently*, so the file quietly runs in
the project default.

---

## 🔴 `globals`

| Option | Default |
|---|---|
| `test.globals` | `false` |

**This is the default that most surprises people arriving from Jest.** Out of the box,
`describe`, `test`, `expect` and the hooks are **not** global:

```ts
// ✅ default (globals: false) — explicit
import { describe, it, expect } from 'vitest';

// ✅ with globals: true — Jest-like
describe('Button', () => { /* … */ });
```

### The three consequences of `globals: true`

1. **Types need the reference.** Add `"types": ["vitest/globals"]` to `tsconfig.json`, or
   the editor flags every `describe`.
2. 🔴 **RTL's automatic cleanup depends on it.** Vitest's docs are explicit: without
   `globals: true` there is no global `afterEach` for RTL to register on import, so
   nothing unmounts between tests. Either enable globals, or register cleanup yourself:
   ```ts
   import { cleanup } from '@testing-library/react';
   afterEach(cleanup);
   ```
   The symptom of getting this wrong is `Found multiple elements` — see
   [04 · chunk 02](../04-rtl-configuration/02-the-setup-file.md).
3. **A setup file with `globals: false` must import its own hooks** —
   `import { beforeAll, afterEach } from 'vitest'`.

**Which to choose:** `globals: true` for a Jest migration, because it removes an entire
class of diff. Explicit imports on a new project, because they are honest about where the
functions come from and they let the editor resolve them without a magic types entry.

---

## `include` and `exclude`

| Option | Default |
|---|---|
| `test.include` | `['**/*.{test,spec}.?(c\|m)[jt]s?(x)']` |
| `test.exclude` | `['**/node_modules/**', '**/dist/**', …]` |

🔴 **These are globs — unlike Jest's regex ignore options.** The two ecosystems disagree
here, and a pattern copied from a Jest config in either direction silently matches
nothing:

```ts
// Jest: testPathIgnorePatterns: ['/e2e/']     ← regex
// Vitest: exclude: ['**/e2e/**']              ← glob
```

⚠️ **Overriding `exclude` drops the defaults**, including `**/node_modules/**` — the same
trap as Jest's, with the same consequence. Spread the defaults or restate them.

---

## `css`

| Option | Default |
|---|---|
| `test.css` | `false` |

Vite can process CSS for real, which Jest cannot. `false` means CSS imports resolve to
empty — fast, and the usual right answer.

```ts
test: {
  css: { modules: { classNameStrategy: 'non-scoped' } },
}
```

Enable it only if a test genuinely asserts on class names: `non-scoped` keeps
`styles.card` as `"card"` rather than a hashed name, which is the Vitest equivalent of
Jest's `identity-obj-proxy`.

⚠️ **Processing CSS is not free.** Turning it on globally to fix two tests slows every
file that imports a stylesheet.

---

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `document is not defined` | `environment` defaults to `'node'` | Set `'jsdom'` |
| `Cannot find package 'jsdom'` | Environments are separate packages | Install it |
| A Jest `@jest-environment` docblock does nothing | Vitest uses `// @vitest-environment` | Rewrite the comment |
| `describe is not defined` | `globals` defaults to `false` | Import from `vitest`, or set `globals: true` |
| Editor errors on `describe` with `globals: true` | Types not referenced | `"types": ["vitest/globals"]` |
| "Found multiple elements" rendering one component | No global `afterEach`, so RTL cleanup never registered | `globals: true`, or `afterEach(cleanup)` |
| Setup file throws on `beforeAll` | `globals: false` and nothing imported | Import the hooks from `vitest` |
| An `exclude` pattern does nothing | Written as a regex; Vitest takes globs | `'**/e2e/**'` |
| `node_modules` suddenly scanned | `exclude` overridden, defaults lost | Restate them |
| Class-name assertions fail | `css: false`, so imports resolve to empty | Enable `css` with `classNameStrategy: 'non-scoped'` |
| Suite slower after enabling `css` | Every stylesheet is now processed | Scope it, or assert on roles instead of classes |

---

## Interview questions

**Q. What does `test.environment` default to, and why is that different from expectations?**
`'node'`. Vitest is not React-first, so a DOM must be asked for explicitly with `'jsdom'`
or `'happy-dom'`.

**Q. `happy-dom` versus `jsdom`?**
`happy-dom` is lighter and faster to construct but implements less of the platform.
Switching is worth measuring, and worth a full suite re-run, because gaps appear as
individual failures rather than a clear error.

**Q. Why does `globals` default to `false`?**
Vitest is ESM-first and prefers explicit imports — you can see where `describe` comes
from, and the editor resolves it without a global types reference.

**Q. What breaks in RTL when `globals: false`?**
Automatic cleanup. RTL registers an `afterEach` on import; with no global hook there is
nothing to register on, so components stay mounted and later queries find duplicates.

**Q. Two ways to fix that?**
Set `globals: true`, or import `cleanup` and register `afterEach(cleanup)` yourself.

**Q. A Jest environment docblock copied into a Vitest project does nothing. Why?**
Different syntax — `// @vitest-environment node`. The mismatch is silent, so the file runs
in the project default.

**Q. How do Jest's and Vitest's file-matching options differ?**
Jest's ignore options are regexes; Vitest's `include`/`exclude` are globs. Patterns do not
port in either direction.

**Q. What does `test.css: false` mean for a component importing a stylesheet?**
The import resolves to nothing, so class-name assertions fail. Enable `css` with
`classNameStrategy: 'non-scoped'` when you genuinely need them — at a per-file cost.

**Q. Which `globals` setting for a Jest migration?**
`true`. It removes an import line from every test file, so the migration diff stays about
real changes.

---

← **Prev:** [05 · vitest.config reference](./README.md) ·
**Next:** [02 · Pools and isolation](./02-pools-and-isolation.md)
