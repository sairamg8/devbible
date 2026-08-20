---
title: "Jest, RTL & Vitest config section — survey and proposal"
sidebar_label: "Configs proposal · 2026-08-20"
sidebar_position: 1
---

:::note Proposal, not yet built
A record of the survey performed on **2026-08-20**, in response to the request for a
dedicated **config reference** for Jest, React Testing Library and Vitest — explained
option by option, the way `tsconfig.json` and its `compilerOptions` are explained
elsewhere in devbible. **Nothing has been written or moved yet.** Two decisions at the
bottom are still open.
:::

> Verified: 2026-08-20 by direct inspection of this repository. External claims in the
> proposed pages are to be validated against jestjs.io, vitest.dev and
> testing-library.com when written — **no sandbox, no console blocks** (global rule 8).

---

## 1 · What the survey found

### The stub that started this

`docs/jest-rtl/syllabus/#-snippet.md` — five lines, frontmatter only, untracked
(`sidebar_label: "1 · Jest and RTL config files"`, `sidebar_position: 0`).

Two problems with it as it stands:

- **`#` is a URL fragment character.** Docusaurus will mangle the generated route and
  every inbound link to it. The filename cannot ship.
- **It sits inside `syllabus/`.** That folder holds the tier tables for each part. A
  config reference is reference material, not a syllabus part.

### There is no Vitest folder to move

The request mentioned moving "the existing vitest files". There is **no standalone
Vitest area anywhere in the repo**. Vitest exists only as prose scattered across four
other technologies, and none of it is config-reference shaped:

| File | Lines | What it actually is |
|---|---|---|
| `docs/vite/pages/14-testing-integration/01-vitest-relationship.md` | 99 | *Why* Vitest reuses `vite.config.ts` — an argument, no option table |
| `docs/nodejs/pages/phase-9-testing/12-vitest-and-jest.md` | — | Runner comparison in a Node context |
| `docs/react/pages/phase-14-correctness/07-jest-or-vitest.md` | — | A pick-one decision page |
| `docs/jest-rtl/syllabus/04-production-ci.md` | — | **Three syllabus rows promising `vitest.config.ts` — none written** |

### Existing config coverage in this technology is one page

`docs/jest-rtl/pages/06-coverage-and-configuration/01-jest-config.md`, **163 lines**,
tier *Understand*. It is narrative — "here is a good config and why it is good". It does
**not** cover:

- `setupFiles` vs `setupFilesAfterEnv` ordering (its own syllabus marks this **Master**)
- `projects` / multi-project configuration
- `coverageProvider` — the v8 vs babel trade
- `clearMocks` vs `resetMocks` vs `restoreMocks`
- RTL's `configure()` — anywhere
- Vitest — at all

### The model being asked for

`docs/typescript/pages/phase-7-server/01-tsconfig-for-a-node-service/` — a chunked topic
directory whose payload chunk, `04-the-annotated-configs.md`, prints two **complete**
configs and gives **every single line a "why it is there" table row**. Paired with
`docs/typescript/pages/phase-0-how-typescript-runs/06-tsconfig-anatomy.md` for the
anatomy half (which files are the project vs what rules they run under).

**That pairing — anatomy page + option reference + fully annotated real configs — is the
shape to copy.**

### Folder convention across the repo today

Every technology has `pages/`. Most also have `syllabus/`. Exactly three have
`reviews/` — `expressjs`, `nodejs`, `postgresql` (this file makes `jest-rtl` the
fourth). **No technology has a `configs/`.** So this would be a new third sibling, which
matches the framing that *each language may or may not have configs*.

---

## 2 · Proposed structure

```
docs/jest-rtl/configs/
├── _category_.json                  {"label":"Configs","position":3,"collapsed":true}
├── README.md                        the three config surfaces + which-runner decision table
├── 01-where-config-lives.md
├── 02-jest-config-reference/        chunked — option groups
├── 03-setup-lifecycle.md
├── 04-rtl-configuration/            chunked
├── 05-vitest-config-reference/      chunked — option groups
├── 06-annotated-configs/            chunked — the payload
└── 07-jest-to-vitest-map.md
```

Sibling to `syllabus/` (position 1) and `pages/` (position 2), at **position 3**.

### What goes in each

| # | Topic | Why it earns a page |
|---|---|---|
| **README** | The three config surfaces, plus a runner decision table | Jest has a file, Vitest has a file, **RTL has no config file at all** — that asymmetry is the first thing a reader must be told |
| **01** | **Where config lives and how it resolves** — `package.json#jest` vs `jest.config.{js,ts,mjs,cjs}` vs `--config`; `vitest.config.ts` vs a `test:` key inside `vite.config.ts`; `rootDir` and the `<rootDir>` token; `extends` vs `mergeConfig` | The number-one cause of "why is my config being ignored" |
| **02** | **`jest.config` reference** — discovery (`roots`, `testMatch` vs `testRegex`, `testPathIgnorePatterns`) · environments (`testEnvironment`, `testEnvironmentOptions`, the `@jest-environment` docblock) · **transforms** (`transform`, `@swc/jest` vs `ts-jest` vs `babel-jest`, `transformIgnorePatterns` — the ESM trap) · resolution (`moduleNameMapper`, `moduleDirectories`, `moduleFileExtensions`, `resolver`, `extensionsToTreatAsEsm`) · mock state (`clearMocks` / `resetMocks` / `restoreMocks` / `resetModules` / `automock`) · coverage (`collectCoverageFrom`, `coverageProvider` v8 vs babel, glob-scoped and path-scoped `coverageThreshold`) · performance (`maxWorkers`, `workerIdleMemoryLimit`, `cache`, `testTimeout`, `randomize`, `--shard`) · **`projects`** for node + jsdom in one repo · `reporters`, `snapshotFormat`, `snapshotSerializers` · what changed Jest 29 → 30 | This is the `compilerOptions` equivalent — the reason the section exists |
| **03** | **The setup lifecycle** — `globalSetup` → `setupFiles` → test framework install → `setupFilesAfterEnv` → the test file → `globalTeardown`, with Vitest's `globalSetup` / `setupFiles` / `provide` shown beside it | The single most-confused ordering in either runner. Already marked **Master** in `syllabus/04-production-ci.md` and still unwritten |
| **04** | **RTL configuration** — `configure()` (`testIdAttribute`, `asyncUtilTimeout`, `throwSuggestions`, `reactStrictMode`, `defaultHidden`, `computedStyleSupportsPseudoElements`, `getElementError`) · `setupTests.ts` anatomy · the polyfill checklist (`matchMedia`, `ResizeObserver`, `IntersectionObserver`, `scrollTo`, `TextEncoder`, `HTMLCanvasElement.getContext`) · `RTL_SKIP_AUTO_CLEANUP` and the auto-cleanup import · `userEvent.setup({ advanceTimers, delay, pointerEventsCheck, document })` | RTL's "config" is a **runtime call plus a setup file**, never a config file. Nobody documents it as configuration, which is exactly why it gets missed |
| **05** | **`vitest.config` reference** — `defineConfig` from `vitest/config` vs `vite` · `test.environment` + `environmentMatchGlobs` + per-file docblock · `test.globals` and the `vitest/globals` types · **`test.pool`** threads / forks / vmThreads with `poolOptions` and `isolate` — Vitest's real isolation model · **`server.deps.inline` / `deps.optimizer`** — the `transformIgnorePatterns` equivalent · `test.coverage` v8 vs istanbul · `test.css`, `test.alias`, `test.clearMocks`/`mockReset`/`restoreMocks` · `test.testTimeout`, `test.retry`, `test.sequence` · **workspace / projects** · where `test.browser` mode stops and Playwright starts | Promised three times in `syllabus/04-production-ci.md`, written zero times |
| **06** | **The annotated configs** — one React + TypeScript application, configured **twice**: a complete `jest.config.ts` + `setupTests.ts`, and a complete `vitest.config.ts` + the same `setupTests.ts`. Every line carries a "why it is there" row, nothing elided | This is the page the request actually described |
| **07** | **Jest → Vitest, key by key** — the migration map at **config** level (`moduleNameMapper` → `resolve.alias`, `transformIgnorePatterns` → `server.deps.inline`, `setupFilesAfterEnv` → `setupFiles`, `maxWorkers` → `poolOptions`, `coverageProvider` → `coverage.provider`), *then* at API level (`jest.fn` → `vi.fn`, `jest.spyOn` → `vi.spyOn`, `jest.mock` → `vi.mock`) | Every existing devbible page does the API half and skips the config half — and the config half is the half that breaks a migration |

### The cross-cutting trap worth real space in 06

**A path alias must be declared in three places** — `tsconfig.json#paths`,
`jest.config#moduleNameMapper`, and `vite.config#resolve.alias`. Vitest's entire pitch is
that it collapses that to two. This is the concrete, demonstrable version of the drift
argument that `docs/vite/pages/14-testing-integration/` currently makes abstractly, and it
is the kind of thing a reader hits in week one.

### Contract the pages are written to

- **Documentation-validated only** — jestjs.io, vitest.dev, testing-library.com — with the
  source named on each `> Verified:` line. **No sandbox, no console blocks** (rule 8).
- **Version-stamped** — Jest 30, Vitest 3, Testing Library 16, and a behaviour's version
  named wherever it changed.
- **300-line file cap is a file-size rule, not a content budget** (rule 1). Option groups
  run to whatever length the options need, then split on concept boundaries into
  `NN-topic/` chunks with a `README.md` index.
- **Section counts are not capped** (rule 13). Gotchas, pitfalls, worked examples and
  interview Q&A run to as many entries as each option group actually has — a transform
  section with eleven failure modes lists eleven.

---

## 3 · Two decisions still open

### Decision 1 — what "move the existing vitest files" should mean

There is nothing standalone to move, so this needs a choice:

| Option | What happens | Cost |
|---|---|---|
| **(a) Absorb, do not move** — *recommended* | Write the Vitest config content fresh in `configs/05` and `configs/06`; leave `docs/vite/pages/14-testing-integration/` in place and add a pointer link to it | Nothing is broken elsewhere. `docs/vite/` belongs to another lane, and global rules 6 and 10 say another technology's pages are not this session's to edit |
| **(b) Physically relocate** | Move `docs/vite/pages/14-testing-integration/01-vitest-relationship.md` into `jest-rtl/configs/` and leave a stub on the Vite side | Edits `docs/vite/` — needs an explicit instruction naming that change, and leaves a hole in a technology this session does not own |
| **(c) Give Vitest its own top-level `docs/vitest/`** | A 30th technology folder; `jest-rtl/configs/` then covers only Jest + RTL | Largest change — new sidebar entry, new `progress.js` row, new `docs/README.md` rows, and it splits the Jest↔Vitest comparison across two technologies |

### Decision 2 — is `configs/` a repo-wide convention or jest-rtl only?

- **Repo-wide** → the `README.md` gets written as a **reusable seven-slot template**, so
  `docs/typescript/configs/`, `docs/vite/configs/`, `docs/eslint-oxlint/configs/`,
  `docs/babel/configs/` and `docs/webpack/configs/` can follow the identical shape later.
  Slightly more work now, consistent later.
- **jest-rtl only** → written bespoke to these three tools, no template overhead.

### One housekeeping item either way

`docs/jest-rtl/syllabus/#-snippet.md` must be **deleted** — the `#` in the filename cannot
ship — and its intent replaced by `docs/jest-rtl/configs/README.md`.

---

## Where this connects

- [Jest & RTL — Overview](../README.md) · [Explanations](../pages/README.md)
- [Part 4 — Production Setup, CI & Vitest Bridge](../syllabus/04-production-ci.md) — the
  three unwritten Vitest rows this section would satisfy
- [Coverage & Configuration](../pages/06-coverage-and-configuration/01-jest-config.md) —
  the 163-line page this section supersedes and expands
