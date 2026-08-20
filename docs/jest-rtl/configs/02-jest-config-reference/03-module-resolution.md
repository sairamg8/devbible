---
title: "Module resolution"
sidebar_label: "03 · Module resolution"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the [Jest configuration reference](https://jestjs.io/docs/configuration)
> — `moduleNameMapper`, `moduleFileExtensions`, `moduleDirectories`, `modulePaths`,
> `resolver`, `extensionsToTreatAsEsm` — and the
> [Jest ECMAScript Modules guide](https://jestjs.io/docs/ecmascript-modules).
> **No sandbox, no console blocks.**

Your component imports `@/lib/api`, `./Card.module.css` and `./logo.svg`. **Node
understands none of those.** Resolution is the stage that decides what each one becomes.

---

## `moduleNameMapper`

| Option | Default |
|---|---|
| `moduleNameMapper` | `{}` |

A map of **regex → replacement path or module name**. It does two unrelated jobs, and
keeping them mentally separate makes the option much easier to reason about.

### Job 1 — path aliases

```js
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
  '^@ui/(.*)$': '<rootDir>/packages/ui/src/$1',
},
```

This is the third copy of the alias table described in the
[section overview](../README.md) — the one that drifts from `tsconfig.json`.

**Do not hand-maintain it.** `ts-jest` ships a helper that reads `tsconfig.json` and
generates the mapper from `paths`, which keeps one source of truth:

```js
const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
  prefix: '<rootDir>/',
}),
```

### Job 2 — stubbing non-JavaScript imports

```js
moduleNameMapper: {
  // CSS Modules → a proxy returning the key you asked for
  '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  // images, fonts → a tiny module exporting a string
  '\\.(jpg|jpeg|png|gif|webp|avif|svg|woff2?)$': '<rootDir>/src/test/fileMock.js',
},
```

```js
// src/test/fileMock.js
module.exports = 'test-file-stub';
```

**Why `identity-obj-proxy` rather than an empty object:** `styles.card` returns the string
`"card"`, so a `className` assertion still means something. An empty object returns
`undefined` and every class-based query silently fails.

### 🔴 Order matters — first match wins

Keys are tested in **declaration order**, and the first hit ends the search. A broad
pattern above a narrow one shadows it permanently:

```js
// ❌ every .svg is a stub, including the one you meant to map to a component
moduleNameMapper: {
  '\\.svg$': '<rootDir>/src/test/fileMock.js',
  '^@icons/(.*)\\.svg$': '<rootDir>/src/icons/$1.tsx',
}
```

Put the **specific patterns first**. This is the cause of "my mapping is ignored" nine
times out of ten.

⚠️ **Anchor your regexes.** `'react'` unanchored matches `react-dom`,
`@testing-library/react` and anything else containing the substring. Write `'^react$'`.

---

## The search options

| Option | Default | Use |
|---|---|---|
| `moduleFileExtensions` | `["js","mjs","cjs","jsx","ts","mts","cts","tsx","json","node"]` | Extensions tried, **in order**, for an extensionless import |
| `moduleDirectories` | `["node_modules"]` | Directory names walked up the tree |
| `modulePaths` | `[]` | Absolute paths searched before `moduleDirectories` |
| `resolver` | *(undefined)* | A custom resolver module — the escape hatch |

⚠️ **`moduleFileExtensions` order is a real behaviour, not a formality.** With the default,
`import './Button'` resolves `Button.js` in preference to `Button.tsx`. In a
partially-migrated codebase where both exist, tests silently run the stale JavaScript and
every assertion about the new component fails for no visible reason.

⚠️ **Adding `"src"` to `moduleDirectories`** makes `import 'lib/api'` work without an
alias. It also makes any local directory shadow a real dependency of the same name —
convenient, and a genuinely confusing failure when it bites.

---

## ESM options

| Option | Default | Note |
|---|---|---|
| `extensionsToTreatAsEsm` | `[]` | Extensions to load as ESM. `.ts` is legal here; **`.js` is not** — that is decided by the nearest `package.json` `"type"` |
| `injectGlobals` | `true` | Set `false` to require explicit `import { test } from '@jest/globals'` |

Native ESM also needs the VM modules flag on the Node process:

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest
```

🔴 **Under native ESM, `jest.mock()` no longer hoists the way it does in CommonJS**, because
ESM imports are resolved before module code runs. `jest.unstable_mockModule` plus dynamic
`import()` is the documented path. **This ergonomic loss — not raw speed — is the reason
most teams evaluating ESM end up evaluating Vitest**, where `vi.mock` is hoisted by a
transform and keeps working.

---

## Reading a resolution failure

`Cannot find module '@/lib/api' from 'src/Card.tsx'` — work down this list:

1. **Is there a `moduleNameMapper` entry for `^@/`?** Absent, or present in `tsconfig.json`
   only, is the common case.
2. **Is a broader key above it winning?** First match wins.
3. **Is the regex anchored?** `'@/(.*)'` unanchored can match mid-string.
4. **Does the replacement use `<rootDir>`?** A bare `./src/$1` resolves against the CWD.
5. **Is the extension in `moduleFileExtensions`?** A `.mts` file needs it listed.

`npx jest --showConfig` prints the resolved mapper, which settles 1–4 immediately.

---

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot find module '@/x'`, works in the editor and the build | Alias in `tsconfig.json` and `vite.config.ts` but not `moduleNameMapper` | Add it, or generate it with `pathsToModuleNameMapper` |
| A mapping is "ignored" | An earlier, broader key matched first | Move specific patterns above general ones |
| Mapping `'react'` breaks `react-dom` too | Unanchored regex matches the substring | `'^react$'` |
| `className` assertions all fail | CSS mapped to an empty object, so `styles.card` is `undefined` | `identity-obj-proxy` |
| Importing an SVG crashes the parser | No mapping — Jest tries to parse XML as JavaScript | Map to a file stub |
| Tests run stale code after a `.js` → `.tsx` migration | `moduleFileExtensions` tries `js` before `tsx` | Reorder, or delete the stale file |
| A `.mts`/`.cts` file cannot be found | Extension missing from `moduleFileExtensions` | Add it |
| A local folder shadows a real dependency | `moduleDirectories` includes `"src"` | Remove it and use an explicit alias |
| `jest.mock` stops working after enabling ESM | Hoisting does not apply under native ESM | `jest.unstable_mockModule` + dynamic `import()` |
| Mapper works locally, not in CI | Replacement used a bare relative path, not `<rootDir>` | Use the token |

---

## Interview questions

**Q. What are the two jobs of `moduleNameMapper`?**
Path aliases (`@/x` → `src/x`) and stubbing imports Jest cannot parse (CSS, images,
fonts). Same mechanism, unrelated purposes.

**Q. Why `identity-obj-proxy` for CSS Modules?**
It returns the requested key as a string, so `styles.card` is `"card"` and class
assertions stay meaningful. An empty object returns `undefined` and those assertions fail
silently.

**Q. Two keys could match one import. Which wins?**
The first in declaration order — so specific patterns must be declared above general ones.

**Q. Why anchor the regexes?**
They are substring-matched otherwise. `'react'` also matches `react-dom` and
`@testing-library/react`, replacing modules you never intended.

**Q. Alias resolves in the editor and the build but not in tests. Why?**
`tsconfig.json#paths` and `resolve.alias` are read by the type checker and the bundler;
Jest reads neither. It needs its own `moduleNameMapper` entry — the third copy.

**Q. How do you avoid maintaining that third copy by hand?**
`pathsToModuleNameMapper` from `ts-jest` generates it from `compilerOptions.paths`, so
`tsconfig.json` stays the single source of truth.

**Q. Why does `moduleFileExtensions` order matter?**
It is the order tried for an extensionless import. With `js` before `tsx`, a leftover
`Button.js` beside a new `Button.tsx` means tests exercise the old file.

**Q. What breaks about mocking under native ESM?**
`jest.mock()` relies on hoisting above CommonJS `require` calls. ESM resolves imports
before module code runs, so the equivalent is `jest.unstable_mockModule` with dynamic
`import()`.

**Q. Which command shows the resolved mapper?**
`npx jest --showConfig` — it prints the fully merged config including every
`moduleNameMapper` entry in final order.

---

← **Prev:** [02 · The transform pipeline](./02-the-transform-pipeline.md) ·
**Next:** [04 · Mock state and timers](./04-mock-state-and-timers.md)
