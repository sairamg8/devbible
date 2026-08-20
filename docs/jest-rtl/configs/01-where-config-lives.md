---
title: "Where config lives and how it resolves"
sidebar_label: "01 · Where config lives"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the [Jest configuration reference](https://jestjs.io/docs/configuration)
> and [Jest CLI options](https://jestjs.io/docs/cli), the
> [Vitest config reference](https://vitest.dev/config/) and
> [Vitest workspace/projects guide](https://vitest.dev/guide/workspace.html), and the
> [Vite config docs](https://vite.dev/config/) for `mergeConfig`.
> **No sandbox, no console blocks.**

**"My config is being ignored" is the single most common configuration bug, and it is
almost never true.** The config is being read — just not the one you edited, or not
relative to the directory you assumed. This chunk is about which file wins, what paths
inside it are relative to, and what `extends` actually does.

---

## Jest — where it looks, in order

Jest accepts config from four places. They are **mutually exclusive**, and the first one
found wins outright:

| Priority | Source | Notes |
|---|---|---|
| 1 | `--config <path>` on the CLI | An explicit path, or a raw JSON string. Beats everything |
| 2 | `jest.config.ts` / `.mts` / `.cts` / `.js` / `.mjs` / `.cjs` / `.json` | The normal case. Searched upward from the current directory |
| 3 | A `"jest"` key in `package.json` | Fine for five options, painful past that — no comments, no types |
| 4 | *(nothing)* | Jest runs on defaults — which is why a typo'd filename looks like "my settings did nothing" |

### 🔴 The trap: two configs, one silently dead

If you have **both** a `jest.config.js` and a `"jest"` key in `package.json`, Jest does
not merge them. Depending on version it either warns about the duplicate or takes the
standalone file — either way **the `package.json` block stops applying**, and it is the
one people forget exists because a scaffolding tool wrote it months earlier.

**Check for this first, before debugging anything else:**

```bash
# Does a package.json jest block exist alongside a config file?
node -e "console.log(Object.keys(require('./package.json').jest ?? {}))"
ls jest.config.*
```

### `jest.config.ts` needs its own transpilation

A TypeScript config file is not free — Jest has to compile it before it can read it,
which means `ts-node` (or an equivalent) must be resolvable. **If it is not installed,
the failure reads like a missing module, not like a config problem.** A `jest.config.mjs`
sidesteps the whole issue, and you can still get types:

```js
// jest.config.mjs — typed, with no ts-node dependency
/** @type {import('jest').Config} */
export default {
  testEnvironment: 'jsdom',
};
```

---

## `rootDir` and `<rootDir>` — the part everyone gets wrong

**`rootDir` defaults to the directory containing the config file** — *not* the directory
you ran `jest` from, and *not* the repo root.

That default is the right one often enough that nobody thinks about it, and then it bites
in exactly one situation: **the config moved.** Put `jest.config.js` in a `config/`
subfolder and every path in it silently re-anchors one level deeper.

`<rootDir>` is a **string token**, substituted wherever it appears in a path-ish option:

```js
{
  rootDir: '.',                                        // resolved from THIS file's directory
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'], // absolute, and stays correct
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}
```

### Three rules that follow from that

1. **Always write `<rootDir>/…`, never `./…`,** in `setupFilesAfterEnv`,
   `moduleNameMapper`, `coveragePathIgnorePatterns` and friends. A bare relative path is
   resolved against the **process CWD** in some options and against `rootDir` in others —
   the inconsistency is the bug, and the token removes the question.
2. **In a monorepo, set `rootDir` explicitly.** Running Jest from the repo root with a
   config in `packages/web/` gives you a `rootDir` of `packages/web` — usually right, and
   catastrophic when it is not, because `collectCoverageFrom` will quietly measure one
   package.
3. `roots` is a **different option** and does not change `<rootDir>`. It says where to
   *scan* for tests; `rootDir` says what paths are *relative to*.

---

## Vitest — two files, and one import that matters

Vitest reads config from, in order of precedence:

| Priority | Source |
|---|---|
| 1 | `--config <path>` on the CLI |
| 2 | `vitest.config.ts` |
| 3 | A `test:` key inside `vite.config.ts` |

**If `vitest.config.ts` exists, `vite.config.ts` is not read for `test` options** — this
is the direct analogue of the Jest `package.json` trap, and it catches people who add a
`vitest.config.ts` for one option and wonder why their existing `test.setupFiles`
stopped loading.

### The import determines whether `test` type-checks

```ts
// ❌ `test` is not in Vite's config type — TS error, or silently untyped
import { defineConfig } from 'vite';

// ✅ Vitest's re-export knows about `test`
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
});
```

⚠️ **Two `defineConfig` exports, one name.** `vitest/config` re-exports Vite's function
widened to include `test`. Importing from `vite` while writing a `test` block is the most
common Vitest config mistake, and in a loosely-typed project it produces **no error at
all** — the block is just ignored.

### Paths in Vitest are relative to the config file's directory

`root` defaults to the config file's directory, same idea as `rootDir` — but there is
**no `<rootDir>` token**. Use plain relative paths, or build absolute ones:

```ts
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    setupFiles: ['./src/setupTests.ts'],                        // relative — fine
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }, // absolute — always
  },
});
```

---

## Sharing config: `extends` vs `mergeConfig`

The two ecosystems solve this differently, and the difference is not cosmetic.

### Jest's `extends` — shallow, and it replaces

```js
// jest.config.js
module.exports = {
  ...require('./jest.base.cjs'),          // explicit spread — you control the merge
  testEnvironment: 'jsdom',
};
```

Jest supports a `preset` (a package or path exposing `jest-preset.js`/`.json`), and its
merge is **shallow**. Set `moduleNameMapper` in both the preset and your config and
**yours replaces the preset's entirely** — you do not get the union. Every alias the
preset provided disappears, and the failure is a resolution error in a file you never
touched.

**So spread explicitly when the merge matters:**

```js
const base = require('./jest.base.cjs');

module.exports = {
  ...base,
  moduleNameMapper: {
    ...base.moduleNameMapper,             // ← the line that saves you
    '^@ui/(.*)$': '<rootDir>/src/ui/$1',
  },
};
```

### Vitest's `mergeConfig` — deep, and it is the supported path

```ts
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: { environment: 'jsdom', setupFiles: ['./src/setupTests.ts'] },
  }),
);
```

`mergeConfig` merges deeply and **concatenates arrays** rather than replacing them, which
is what you want for `plugins` and `setupFiles`. That array behaviour is also the gotcha:
merge a config that already has a plugin and you can end up applying it twice.

### One project, several environments

Both runners let one command run several configurations — a jsdom project for components
and a node project for server code:

- **Jest:** the `projects` array, each entry a full config object or a path to one.
  ⚠️ Options set at the top level **beside** `projects` are ignored for the runs
  themselves; per-project settings must live inside each project.
- **Vitest:** `test.projects` (v3), previously a workspace file. Same shape, same
  benefit — one command, one coverage report, two environments.

Both are covered in their reference chunks —
**02 · `jest.config` reference** *(not written yet)* and
**05 · `vitest.config` reference** *(not written yet)*.

---

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Config edits have no effect at all | A `"jest"` key in `package.json` alongside a `jest.config.*` file | Delete the `package.json` block; keep one source |
| `Cannot find module 'ts-node'` when running any test | `jest.config.ts` needs transpiling before Jest can read it | Install `ts-node`, or rename to `jest.config.mjs` with a `@type` JSDoc |
| Aliases from a shared preset vanish after adding one of your own | Jest's preset merge is **shallow** — your `moduleNameMapper` replaced it | Spread the base: `...base.moduleNameMapper` |
| `test` options ignored after adding `vitest.config.ts` | `vite.config.ts`'s `test:` block is no longer read | Move the block, or delete `vitest.config.ts` and keep one file |
| `test` block accepted but does nothing, no TS error | `defineConfig` imported from `vite`, not `vitest/config` | Change the import |
| Setup file loads locally, not in CI | A bare `./setup.ts` resolved against a different CWD | Use `<rootDir>/…` (Jest) or an `import.meta.url`-derived absolute path (Vitest) |
| Coverage only reports one package in a monorepo | `rootDir` defaulted to the config file's own package | Set `rootDir` explicitly, and scope `collectCoverageFrom` to match |
| A Vite plugin runs twice under test | `mergeConfig` **concatenates** arrays, including `plugins` | Merge a base without the plugin, or dedupe by plugin name |

---

## Interview questions

**Q. Where does Jest look for its configuration, and what happens with two sources?**
CLI `--config` first, then a `jest.config.*` file found by searching upward, then a
`"jest"` key in `package.json`. They do not merge — the higher-priority source wins and
the other is silently inert, which is why a forgotten `package.json` block is a classic
time sink.

**Q. What is `rootDir` relative to?**
The directory containing the config file, not the CWD and not the repo root. `<rootDir>`
is a token substituted into path options so they stay correct if the config moves.

**Q. Why prefer `<rootDir>/src/setupTests.ts` over `./src/setupTests.ts`?**
Relative-path handling is not uniform across Jest options — some resolve against the
process CWD, others against `rootDir`. The token removes the ambiguity, so the config
behaves the same locally and in a CI job that invokes Jest from elsewhere.

**Q. A shared Jest preset defines four aliases. You add a fifth in your config and the
first four break. Why?**
The preset merge is shallow: your `moduleNameMapper` object replaced the preset's rather
than extending it. Spread the base object's key explicitly.

**Q. What is the difference between `import { defineConfig } from 'vite'` and from
`vitest/config`?**
Vite's config type has no `test` property. Importing from `vite` and writing a `test`
block gives a type error in a strict project and, in a loose one, no error and no effect.
`vitest/config` re-exports the function widened to accept `test`.

**Q. How do Jest's `extends`/preset and Vitest's `mergeConfig` differ?**
Jest's is shallow and replaces on conflict. `mergeConfig` merges deeply and concatenates
arrays — better for the common case, at the cost of duplicate entries when both sides
supply the same plugin.

**Q. Why would you use `projects` rather than two config files and two commands?**
One invocation, one worker pool and one merged coverage report, with per-project
environments. Two commands give two coverage reports that have to be combined by hand,
and thresholds then cannot see the whole picture.

**Q. In a monorepo, you run Jest from the root and coverage reports only one package.
What is the likely cause?**
`rootDir` defaulted to the directory holding the config — one package — so
`collectCoverageFrom` globs never reached the others. Set `rootDir` explicitly, or run
with `projects` covering each package.

---

← **Prev:** [Configs — overview](./README.md) ·
**Next:** 02 · `jest.config` reference *(not written yet)*
