---
title: "Jest or Vitest"
sidebar_label: "07 · Jest or Vitest"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **Vitest 3.x** and **Jest 30.x**, from documentation —
> [Vitest · Test environment](https://vitest.dev/guide/environment) (`node` is the default;
> `jsdom`, `happy-dom` — *"considered to be faster than jsdom, but lacks some API"* — and
> `edge-runtime`; the `// @vitest-environment jsdom` docblock) and
> [Jest · Configuration](https://jestjs.io/docs/configuration) (`testEnvironment` defaults
> to `node`, the `@jest-environment` docblock, `setupFilesAfterEnv` running *"after the
> framework is installed"*, and `transform` defaulting to `babel-jest` for `\.[jt]sx?$`).
> No sandbox script backs this page; claims are cited, not measured.

RTL is not a test runner ([topic 02](02-the-rtl-model/README.md)). Something has to provide
`describe`, `it`, `expect`, mocking, coverage and a DOM environment, and in a React project
that is Jest or Vitest.

**The honest summary: they are close enough that the deciding factor is your build tool, not
the runners' features.**

## The one decision that matters

| Your project builds with | Take |
|---|---|
| **Vite** (including React Router / TanStack Start projects) | **Vitest** |
| **Next.js**, or a Webpack/Babel setup | **Jest** — it is the documented default path |
| Neither, greenfield, no strong constraint | **Vitest** |
| An existing large Jest suite | **Jest** — migration is rarely worth it on its own |

The reason is transform configuration. Vitest runs your test files through **the same Vite
pipeline** the app uses, so your aliases, plugins, TypeScript settings, CSS handling and env
variables already work. Jest has its own module system and needs its own transform — the
default is `babel-jest` for `\.[jt]sx?$` — so a Vite project on Jest is maintaining two
build configurations that must agree, and the disagreements surface as errors like
"Cannot use import statement outside a module" or an unresolved `@/` alias.

The inverse holds: in a Next.js app, Jest is the path the framework documents and supports.

## Both need a DOM

Neither runner gives you a `document` by default — the default environment in both is
`node`.

```js
// vitest.config.ts
export default defineConfig({
  test: { environment: "jsdom", setupFiles: "./src/setup-tests.ts", globals: true },
});
```

```js
// jest.config.js
module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/src/setup-tests.js"],
};
```

Both also support choosing per file with a docblock, which is how you keep one Node-
environment test in an otherwise DOM suite:

```js
// @vitest-environment jsdom      ← Vitest
/** @jest-environment jsdom */    ← Jest
```

Vitest additionally offers **`happy-dom`**, which the docs describe as *"considered to be
faster than jsdom, but lacks some API"*. That is the trade in one sentence: try it if the
environment is a measurable cost, and expect to hit a missing API eventually.

## The setup file — the same three lines either way

```js
// src/setup-tests.ts
import "@testing-library/jest-dom/vitest";   // or "@testing-library/jest-dom" for Jest
import { server } from "./mocks/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

Two notes worth having:

- **Jest's `setupFilesAfterEnv`, not `setupFiles`.** The docs are explicit that
  `setupFilesAfterEnv` runs *after the testing framework is installed* — which is what
  `expect.extend` and `afterEach` need. Registering matchers in `setupFiles` fails because
  `expect` does not exist yet.
- **`@testing-library/jest-dom` is a separate package from RTL**, and it is what provides
  `toBeInTheDocument`, `toBeDisabled`, `toHaveAccessibleName`. Its absence is the cause of
  `toBeInTheDocument is not a function`.

## The API differences you will actually notice

| | Jest | Vitest |
|---|---|---|
| globals (`describe`, `it`, `expect`) | on by default | opt in with `globals: true`, or import from `vitest` |
| mock a module | `jest.mock('./x')` | `vi.mock('./x')` |
| mock function | `jest.fn()` | `vi.fn()` |
| fake timers | `jest.useFakeTimers()` | `vi.useFakeTimers()` |
| timer advance for `user-event` | `jest.advanceTimersByTime` | `vi.advanceTimersByTime` |
| watch mode | `--watch` | on by default in dev |

The mental model is the same; the prefix changes. That is why most migrations are largely
`jest.` → `vi.`, and why the runner choice is rarely worth much agonising.

⚠️ **`vi.mock` is hoisted, like `jest.mock`.** A variable declared with `const` and
referenced inside the factory is not initialised when the factory runs. Vitest provides
`vi.hoisted()` for exactly this:

```js
const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("./api", () => ({ getUser }));
```

## ESM, which is where the time goes

This is the practical difference behind the recommendation.

- **Vitest is ESM-native.** Modern packages that ship ESM only just work.
- **Jest's module system is CommonJS by default**, so an ESM-only dependency has to be
  transformed. The symptom is `SyntaxError: Cannot use import statement outside a module`
  from inside `node_modules`, and the fix is a `transformIgnorePatterns` entry that
  un-ignores that package — a line every mature Jest config eventually grows.

If a project's dependencies are mostly modern ESM, that alone can decide it.

## What does not depend on the choice

Worth stating plainly, because it is the reason not to over-think this: **everything else in
this phase is identical either way.** RTL, `user-event`, MSW, the queries, the priority
order, `act`, the way you structure a test — none of it changes. A suite written well on one
runner ports to the other in an afternoon, and most of that afternoon is `jest.` → `vi.`.

## Gotchas

**Symptom:** `document is not defined`.
**Cause:** the environment is `node`, which is the default in both runners.
**Fix:** set `environment: 'jsdom'` (Vitest) or `testEnvironment: 'jsdom'` (Jest), or use the
per-file docblock. If the runner reports a missing environment package, install the one it
names.

**Symptom:** `toBeInTheDocument is not a function`.
**Cause:** `@testing-library/jest-dom` is not imported in the setup file — it is a separate
package from RTL.
**Fix:** import it there (`/vitest` entry point under Vitest), and make sure the file is
listed in `setupFilesAfterEnv` / `setupFiles`.

**Symptom:** `expect.extend is not a function` in Jest setup.
**Cause:** the file is in `setupFiles`, which runs before the framework is installed.
**Fix:** move it to `setupFilesAfterEnv`, which the docs define as running after.

**Symptom:** `Cannot use import statement outside a module`, pointing into `node_modules`.
**Cause:** an ESM-only dependency under Jest's CommonJS module system.
**Fix:** add the package to `transformIgnorePatterns` so it is transformed. This class of
problem is what Vitest avoids by being ESM-native.

**Symptom:** an alias like `@/components/Button` resolves in the app and not in tests.
**Cause:** two build configurations — Jest's `moduleNameMapper` does not know about Vite's
`resolve.alias`.
**Fix:** mirror it in `moduleNameMapper`, or use Vitest, which shares the app's resolution.

**Symptom:** a `vi.mock`/`jest.mock` factory throws "Cannot access before initialization".
**Cause:** the call is hoisted above the `const` it references.
**Fix:** `vi.hoisted()` in Vitest; define the mock inside the factory in Jest.

## Interview questions

**★ Jest or Vitest — how do you choose?**
By build tool, not by features. A Vite project takes Vitest, because tests then run through
the same pipeline as the app and inherit its aliases, plugins and TypeScript handling; a
Next.js or Webpack project takes Jest, which is the documented path there. Everything else in
a React testing setup — RTL, `user-event`, MSW, the queries — is identical either way, so the
decision is about avoiding a second build configuration that has to agree with the first.

**★ Why do tests fail with `document is not defined`?**
Because both runners default to the `node` environment. React component tests need
`environment: 'jsdom'` in Vitest or `testEnvironment: 'jsdom'` in Jest — set globally in
config or per file with a docblock comment.

**★ What is the difference between Jest's `setupFiles` and `setupFilesAfterEnv`?**
`setupFilesAfterEnv` runs after the testing framework is installed, so `expect` and the
lifecycle hooks exist. That is where custom matchers and `afterEach` hooks belong;
registering matchers in `setupFiles` fails because `expect` is not defined yet.

**What is `happy-dom` and when would you use it?**
An alternative DOM environment in Vitest, documented as faster than jsdom but lacking some
APIs. Worth trying if environment setup is a measured cost in your suite, with the
expectation of eventually meeting a missing API and having to switch back for those files.

**Why does an ESM-only dependency break a Jest suite?**
Jest's module system is CommonJS by default, so ESM in `node_modules` is not transformed and
throws "Cannot use import statement outside a module". The fix is a `transformIgnorePatterns`
entry for that package. Vitest, being ESM-native, does not have the problem.

---

← Prev: [Mocking the API with MSW](06-mocking-the-api/README.md) ·
Index: [Phase 14](README.md) ·
Next → [Testing forms and Actions](08-testing-forms-and-actions.md)
