---
title: "jest.config reference"
sidebar_label: "02 · jest.config reference"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the [Jest configuration reference](https://jestjs.io/docs/configuration).
> **No sandbox, no console blocks.**

**Jest is not only a test runner. It is also a module resolver, a transformer and a
process pool** — and its config file has an option group for each of those jobs. Read it
that way and the seventy-odd options stop looking like a flat list.

---

## The six groups

| Chunk | Group | The question it answers |
|---|---|---|
| [01](./01-discovery-and-environments.md) | **Discovery & environments** | Which files are tests, and what globals do they run against? |
| [02](./02-the-transform-pipeline.md) | **The transform pipeline** | How does TypeScript/JSX become something Node can execute — and why does one `node_modules` package break it? |
| [03](./03-module-resolution.md) | **Module resolution** | When a test imports `@/Button` or `./card.css`, what does Jest hand back? |
| [04](./04-mock-state-and-timers.md) | **Mock state & timers** | What is reset between tests, and by which of the three near-identical flags? |
| [05](./05-coverage.md) | **Coverage** | What is measured, by which instrumenter, and what makes the build fail? |
| [06](./06-workers-and-projects.md) | **Workers & projects** | How many processes, how much memory, and how do you run two environments at once? |

---

## The mental model

A single test file goes through the groups in this order. Knowing the order is what
makes a failure diagnosable, because **each group can only break in its own way**:

```
  jest.config.ts
        │
   ┌────┴─────────────────────────────────────────────┐
   │ 1. DISCOVERY      roots, testMatch               │  → "no tests found"
   │ 2. ENVIRONMENT    testEnvironment, jsdom/node    │  → "document is not defined"
   │ 3. TRANSFORM      transform, transformIgnore…    │  → "Cannot use import statement"
   │ 4. RESOLUTION     moduleNameMapper, moduleFile…  │  → "Cannot find module '@/x'"
   │ 5. SETUP          setupFiles, setupFilesAfterEnv │  → matchers missing, chunk 03
   │ 6. RUN            the test, mock state per flags │  → leaked state between tests
   │ 7. REPORT         coverage, thresholds, reporters│  → "coverage threshold not met"
   └──────────────────────────────────────────────────┘
```

**Match the error to the stage before changing anything.** A `Cannot find module` is
stage 4 and no amount of transform configuration will help it; a
`Cannot use import statement outside a module` is stage 3 and no `moduleNameMapper` entry
will either. Most wasted debugging time is a stage-3 error being treated as stage 4.

---

## A note on defaults

Every chunk states the **default** for the options it covers, because half of Jest
configuration is deciding whether to touch an option at all. Defaults are quoted from the
configuration reference for the version named at the top of each chunk.

⚠️ **Where a default changed between Jest 29 and 30, the chunk says so explicitly.**
Where this reference could not confirm a change from primary documentation, it says that
too rather than guessing — check the
[Jest release notes](https://github.com/jestjs/jest/blob/main/CHANGELOG.md) for anything
load-bearing in your setup.

---

← **Prev:** [01 · Where config lives](../01-where-config-lives.md) ·
**Next:** [01 · Discovery and environments](./01-discovery-and-environments.md)
