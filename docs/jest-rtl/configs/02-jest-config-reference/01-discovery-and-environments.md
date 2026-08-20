---
title: "Discovery and environments"
sidebar_label: "01 · Discovery and environments"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the [Jest configuration reference](https://jestjs.io/docs/configuration)
> — `roots`, `testMatch`, `testRegex`, `testPathIgnorePatterns`, `testEnvironment`,
> `testEnvironmentOptions` — and [Jest CLI options](https://jestjs.io/docs/cli).
> **No sandbox, no console blocks.**

Two questions, answered before a single line of your code runs: **which files are tests**,
and **what world do they execute in**.

---

## Discovery — which files are tests

| Option | Default | What it does |
|---|---|---|
| `roots` | `["<rootDir>"]` | The directories Jest scans. Narrowing this is the cheapest speed win in a repo with a large `build/` or `fixtures/` tree |
| `testMatch` | `["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec\|test).[jt]s?(x)"]` | Glob patterns. The default covers both conventions — a `__tests__` folder **and** a `.test.ts` / `.spec.ts` suffix |
| `testRegex` | `[]` | Regex patterns instead of globs |
| `testPathIgnorePatterns` | `["/node_modules/"]` | Regexes tested against the **full path** |

### 🔴 `testMatch` and `testRegex` are mutually exclusive

Setting both is a configuration error, not a merge. Pick one — `testMatch` for almost
everyone, because globs are what the rest of the ecosystem speaks.

### The ignore options are regexes, not globs

This is the most-repeated mistake in the group:

```js
// ❌ a glob. Matches nothing, and fails silently
testPathIgnorePatterns: ['**/e2e/**'],

// ✅ a regex tested against the absolute path
testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
```

⚠️ **Overriding `testPathIgnorePatterns` drops the `node_modules` default.** If you set
the option at all, re-add `'/node_modules/'` yourself — otherwise Jest starts collecting
tests out of your dependencies, and the symptom is a run that suddenly takes minutes and
fails in packages you have never opened.

### Narrowing on the CLI, not in the config

For a one-off, do not edit the config:

```bash
npx jest src/components          # positional arg = regex against the test path
npx jest -t "renders empty state" # by test NAME, not file
npx jest --onlyChanged            # tests touching files changed vs the base branch
npx jest --listTests              # print what WOULD run — the debugging tool for this group
```

**`--listTests` is the answer to "no tests found" and to "why is it running that file".**
It resolves discovery only, and prints the list, without executing anything.

---

## Environments — what globals exist

| Option | Default | What it does |
|---|---|---|
| `testEnvironment` | `"node"` | The sandbox each test file gets. `"jsdom"` for anything touching the DOM |
| `testEnvironmentOptions` | `{}` | Passed to the environment's constructor — jsdom's `url`, `customExportConditions`, and so on |

### `jsdom` is not bundled — install it

Since Jest 28, `jest-environment-jsdom` is a **separate package**. A React project needs
it explicitly:

```bash
npm i -D jest-environment-jsdom
```

Without it the failure is a module-not-found for the environment itself, which reads
oddly because you never imported it.

### Per-file override with a docblock

One environment for the whole project is usually right, and the exception is handled per
file — this beats a `projects` split when you have three such files, not three hundred:

```ts
/**
 * @jest-environment node
 */
import { buildInvoice } from './invoice';
// no jsdom cost, no window — a pure-function test in a jsdom project
```

The docblock must be the **first** thing in the file, before any import.

### `testEnvironmentOptions` — the two that matter

```js
testEnvironment: 'jsdom',
testEnvironmentOptions: {
  // jsdom's document.location. Some code reads it at module scope
  url: 'https://example.test/',

  // 🔴 makes jsdom resolve packages by their "node" export condition
  customExportConditions: [''],
},
```

`customExportConditions` is the fix for a specific, very confusing class of failure:
a package ships both browser and node builds via `exports` conditions, jsdom picks the
**browser** one, and that build expects APIs jsdom does not implement. **MSW v2 documents
exactly this** — under jsdom it needs the node build, and `customExportConditions: ['']`
is how you ask for it. The symptom without it is a network mock that appears installed
and intercepts nothing.

---

## What "no tests found" actually means

Jest prints the same message for several distinct causes. In order of likelihood:

1. **The file name does not match `testMatch`** — `Button.tests.ts` (plural) is the
   classic; the default wants `test` or `spec`.
2. **`roots` excludes the directory** — narrowed for speed, then a new folder was added.
3. **`testPathIgnorePatterns` was overridden** with a pattern broader than intended, e.g.
   `'/test/'` also matching `src/test-utils/`.
4. **You are in the wrong `rootDir`** — see [chunk 01](../01-where-config-lives.md).

`npx jest --listTests` distinguishes 1–3 in one command; `--showConfig` prints the fully
resolved config, which settles 4.

---

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `No tests found` on a file you can see | Name does not match `testMatch` — `.tests.ts`, `.Test.ts`, `-test.ts` in a `__test__` (singular) folder | `--listTests`, then rename or widen `testMatch` |
| Both `testMatch` and `testRegex` set | They are mutually exclusive; Jest errors rather than merging | Keep `testMatch` |
| An ignore pattern does nothing | Written as a glob (`**/e2e/**`); the option takes **regexes** | `'/e2e/'` |
| Jest suddenly scans `node_modules` | `testPathIgnorePatterns` was set and dropped the default | Re-add `'/node_modules/'` |
| `document is not defined` | `testEnvironment` is the default `node` | Set `jsdom`, or add the per-file docblock |
| Cannot find `jest-environment-jsdom` | Not bundled since Jest 28 | `npm i -D jest-environment-jsdom` |
| MSW installs but intercepts nothing under jsdom | jsdom resolved the package's **browser** export condition | `testEnvironmentOptions: { customExportConditions: [''] }` |
| Code reading `window.location` throws at import time | jsdom's default URL is `about:blank` | `testEnvironmentOptions: { url: 'https://example.test/' }` |
| The docblock override is ignored | It is not the first thing in the file | Move it above every import |
| A jsdom project is slow for pure logic tests | Every file pays jsdom construction | `@jest-environment node` docblocks, or split with `projects` — [chunk 06](./06-workers-and-projects.md) |

---

## Interview questions

**Q. What does `testMatch` default to, and why two patterns?**
`**/__tests__/**/*.[jt]s?(x)` and `**/?(*.)+(spec|test).[jt]s?(x)` — the two conventions
that exist in the wild, a dedicated folder and a filename suffix, so either works with no
configuration.

**Q. `testPathIgnorePatterns: ['**/e2e/**']` does not exclude anything. Why?**
The option takes regular expressions matched against the full path, not globs. `'/e2e/'`
is the correct form.

**Q. What is the risk in setting `testPathIgnorePatterns` at all?**
You replace the default rather than adding to it, losing `'/node_modules/'` — Jest then
discovers tests inside dependencies.

**Q. Difference between `roots` and `rootDir`?**
`rootDir` is the anchor that paths resolve against; `roots` is the list of directories
scanned for test files. Changing `roots` never changes what `<rootDir>` means.

**Q. How do you run one file in a `node` environment inside a jsdom project?**
A `@jest-environment node` docblock at the very top of that file, before any import.

**Q. When would you use `projects` instead of docblocks?**
When the split is structural rather than incidental — a whole `server/` tree needing
node and a `client/` tree needing jsdom. Docblocks suit a handful of exceptions.

**Q. What is `customExportConditions: ['']` for?**
It changes which `exports` condition jsdom resolves. A dual-build package otherwise gets
its browser entry under jsdom, which can expect APIs jsdom lacks — MSW v2 is the common
case, and it fails by silently not intercepting.

**Q. `document is not defined` — where in the pipeline is that, and where is it not?**
Stage 2, the environment. It is never a transform or resolution problem, so
`transformIgnorePatterns` and `moduleNameMapper` cannot fix it.

**Q. Which command tells you what Jest will run, without running it?**
`npx jest --listTests`. `--showConfig` complements it by printing the resolved config,
which is how you confirm `rootDir`.

---

← **Prev:** [02 · jest.config reference](./README.md) ·
**Next:** [02 · The transform pipeline](./02-the-transform-pipeline.md)
