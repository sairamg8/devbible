---
title: "Jest and Vitest both run in jsdom, which is a browser-shaped environment — so the real design question is not which runner you pick but which half of an App Router codebase is even eligible to run inside one"
sidebar_label: "1 · Unit and component testing"
sidebar_position: 1
description: "What next/jest configures and what it leaves to you, the Vitest config the guide actually ships, the eligibility boundary that decides what a jsdom runner can render, React Testing Library query discipline, and the four Vitest 5 default changes that silently rewrite an existing suite."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [How to set up Jest with Next.js](https://nextjs.org/docs/app/guides/testing/jest) (lastUpdated 2026-08-25), [How to set up Vitest with Next.js](https://nextjs.org/docs/app/guides/testing/vitest) (2026-08-25), [Testing](https://nextjs.org/docs/app/guides/testing) (2026-02-03) and [Migrating to Vitest 5.0](https://vitest.dev/guide/migration).
> Target: **Next.js 16.3.4** · React 19.2.8 · Vitest 5.0.0 · Jest 30.5.1 · `@testing-library/react` 16.3.3.

**A unit test runner for a React app is a jsdom process: a Node process with a fake DOM bolted on, no browser engine, no layout, no network stack you did not build yourself. Everything that follows from that is the whole story of this page. It is why a synchronous component renders fine and an `async` Server Component does not, why `next/jest` exists at all, and why the interesting question is never "Jest or Vitest" but "does this thing belong in jsdom, in a plain Node test, or in Playwright". Get the eligibility boundary right and either runner works. Get it wrong and you will spend a week writing mocks that assert your mocks.**

## The eligibility boundary

Before any config, sort your code into four buckets. The bucket decides the tool; the tool does not decide the bucket.

| What it is | Where it runs in production | Where you test it |
|---|---|---|
| Pure functions — schemas, formatters, permission predicates, query builders | Anywhere | Plain Node test, no DOM environment at all |
| Client Components | Browser | jsdom + React Testing Library |
| Synchronous Server Components | Server, at render time | jsdom will render them, with caveats below |
| `async` Server Components, Server Actions' full request path, streaming, navigation | Server, inside the framework | Playwright — see [2 · End-to-end flows with Playwright](02-end-to-end-flows-with-playwright-testing-streaming-and-ppr-b.md) |

The Next.js testing overview draws exactly one hard line here, and it is the async Server Component line — covered in [1b · Testing Server Components and Server Actions](01b-testing-server-components-and-server-actions.md), along with the part the docs leave open.

The bucket that pays the most and costs the least is the first one. A Zod schema, an `authorize(user, resource)` predicate and a `toDisplayDate()` helper have no DOM, no framework and no I/O; they run in milliseconds and they are exactly where correctness bugs live. Put those tests in a `node` environment and never load jsdom for them.

## Vitest: the setup the guide ships

Three dev dependencies do three different jobs, and knowing which is which saves you an hour when one of them is missing.

```bash
npm install -D vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/dom vite-tsconfig-paths
```

- `@vitejs/plugin-react` gives you JSX transformation. Without it, a `.tsx` file is a syntax error.
- `jsdom` is the DOM implementation. It is a peer of the environment name, not bundled.
- `vite-tsconfig-paths` teaches Vite about `compilerOptions.paths` from your `tsconfig.json`, so `@/components/button` resolves in a test the same way it resolves in the app. The docs list it only in the TypeScript variant of the install command, which is the tell: it exists purely to stop path aliases diverging.

```ts title="vitest.config.mts"
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
  },
})
```

The file extension matters: `.mts` forces ESM parsing regardless of what `package.json` says about `type`, which is why the guide picks it over `.ts`.

### Do not ship `environment: 'jsdom'` globally

That config gives jsdom to every test file in the project, including the pure-function ones that do not need it. Scope it instead, so the cheap tests stay cheap:

```ts title="vitest.config.mts"
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'node', environment: 'node', include: ['src/lib/**/*.test.ts'] },
      },
      {
        extends: true,
        test: { name: 'dom', environment: 'jsdom', include: ['src/components/**/*.test.tsx'] },
      },
    ],
  },
})
```

Per-file overrides also work through a docblock comment at the top of a test file, which is the right escape hatch for a single outlier:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
```

### The script is not `vitest`

The guide's `package.json` uses `"test": "vitest"`, and then says plainly that this watches for changes. In CI that command never exits and your job hangs until the runner's timeout kills it. Split it:

```json title="package.json"
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

## Jest: what `next/jest` actually does for you

`next/jest` is a config factory, not a preset you extend. You call it with the app directory and it returns a function that wraps your own config — and it must be exported by calling that function, because loading `next.config.js` is asynchronous.

```ts title="jest.config.ts"
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}

export default createJestConfig(config)
```

Six things it configures, per the guide: SWC as the `transform`; auto-mocks for `.css`, `.module.css`, their SCSS variants, image imports and `next/font`; `.env` files loaded into `process.env`; `node_modules` excluded from resolution and transforms; `.next` excluded from resolution; and `next.config.js` read for the flags that enable SWC transforms.

The interesting entry is the auto-mocking. Importing a stylesheet or a font in a component would otherwise crash a Node runner, because Node cannot parse CSS. `next/jest` replaces them with inert stubs, which means **a test can never assert anything about a class name coming out of a CSS module** — the stub does not produce the hashed name. If your assertion depends on a generated class, the assertion is wrong for a reason unrelated to your component.

### What it does not do

Module path aliases. `next/jest` does not read `compilerOptions.paths`. You mirror them by hand:

```js title="jest.config.js"
moduleNameMapper: {
  '^@/components/(.*)$': '<rootDir>/components/$1',
  '^@/lib/(.*)$': '<rootDir>/lib/$1',
}
```

This is a duplication that drifts. Every alias you add to `tsconfig.json` is an alias someone must remember to add here, and the failure mode is a "cannot find module" in a test for code that compiles fine. Vitest's `vite-tsconfig-paths` avoids the class of bug entirely, which is the strongest single argument for Vitest on a new project.

## React Testing Library: the query order is the contract

RTL's query priority is not a style preference, it is what makes a test survive a refactor. Roughly in order of preference:

1. `getByRole(role, { name })` — queries the accessibility tree. Robust to markup changes, and it fails when your component is inaccessible, which is a feature.
2. `getByLabelText` — the right query for form fields, and it fails when a field has no label.
3. `getByPlaceholderText`, `getByText`, `getByDisplayValue` — user-visible content.
4. `getByTestId` — the escape hatch, for things with no accessible handle.

```tsx title="components/task-form.test.tsx"
import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskForm } from './task-form'

test('submits the trimmed title', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()

  render(<TaskForm onSubmit={onSubmit} />)

  await user.type(screen.getByLabelText('Title'), '  Ship syllabus  ')
  await user.click(screen.getByRole('button', { name: 'Add task' }))

  expect(onSubmit).toHaveBeenCalledWith({ title: 'Ship syllabus' })
})
```

Two disciplines are load-bearing in that snippet. `userEvent.setup()` is called once per test, before `render`; `userEvent` dispatches the full sequence of events a real interaction produces, where `fireEvent.click` dispatches exactly one. And every `user.*` call is awaited, because `userEvent` is asynchronous by design.

### `getBy` versus `queryBy` versus `findBy`

- `getBy*` throws immediately when there is no match. Use it to assert presence.
- `queryBy*` returns `null`. It is the **only** correct query for asserting absence: `expect(screen.queryByRole('alert')).toBeNull()`.
- `findBy*` returns a promise and retries. Use it when the thing appears after an effect or a resolved promise.

Using `getBy*` inside a `try`/`catch` to test absence, or `findBy*` when nothing is async, are the two ways this goes wrong.

## Vitest 5 changed four defaults that rewrite an existing suite

If you are upgrading rather than starting fresh, these land without a deprecation window. The floor moved first: Vitest 5 requires Vite 6.4 or newer and Node.js 22.12 or newer.

**`clearMocks` now defaults to `true`.** Vitest calls `vi.clearAllMocks()` before every test. Call history recorded outside a test body — in a setup file, at a module's top level, or in `beforeAll` — is gone by the time the test asserts on it. Set `clearMocks: false` to restore the old behaviour, or move the recording into the test.

**Unawaited async assertions now fail.** `expect(promise).resolves.toBe(1)` without an `await` used to be auto-awaited with a warning; it is now a test failure. That is strictly good news — those assertions were silently passing before — but it will light up an old suite.

**`vi.mock` outside the top level now throws.** These calls are hoisted, so writing one inside a `describe` callback never meant what it looked like. Vitest 5 reports every offending call with its location instead of warning. `vi.doMock` and `vi.doUnmock` are not hoisted and may still be called anywhere.

**The `json` and `junit` reporters write files instead of printing to stdout.** They now land in `.vitest/json/output.json` and `.vitest/junit/output.xml` under a single `.vitest/` artifact directory. A CI step that piped `vitest --reporter=json` into `jq` now pipes nothing. Read the file, or opt back in with `reporters: [['json', { stdout: true }]]`.

## Gotchas

**★ Asserting on a CSS module class name always fails under `next/jest`.**
Stylesheet imports are auto-mocked, so `styles.card` is a stub value and not the hashed class the bundler would emit. The assertion is testing the mock. Assert on role, text or state instead — `expect(button).toBeDisabled()` rather than `expect(button).toHaveClass('btn--disabled')`.

**★ `moduleNameMapper` drift is a "cannot find module" in a file that compiles.**
Add an alias to `tsconfig.json`, forget `jest.config.js`, and the test suite fails on an import the type checker is perfectly happy with. Either keep them in lockstep in review, or generate the mapper from the tsconfig, or use Vitest with `vite-tsconfig-paths`.

**★ `"test": "vitest"` hangs CI.**
Watch is the default for the bare command. The job does not fail, it stalls until the platform timeout, which reads as an infrastructure problem rather than a config one. `vitest run` in CI, always.

**★ A global `environment: 'jsdom'` taxes every pure-function test.**
jsdom construction is not free, and it is paid per test file. A schema test that needs nothing but a function call gets a full fake DOM. Scope the environment per project or per file.

**★ `fireEvent` passes tests that a real user would fail.**
`fireEvent.click` dispatches one `click` event. A real click is `pointerdown`, `mousedown`, `focus`, `pointerup`, `mouseup`, `click`. Components that rely on focus or pointer events behave differently under the two. Use `userEvent` unless you are deliberately testing a single event handler in isolation.

**★ Forgetting to await a `userEvent` call produces a green test that asserted nothing.**
`user.click(...)` returns a promise. Without `await`, the assertion runs before React has processed the interaction, so it usually observes the pre-interaction state — and passes, if your assertion happens to describe that state.

**★ `getByRole` cannot find an element that has no accessible name.**
An icon-only button with no `aria-label` has a role but an empty name, so `getByRole('button', { name: 'Delete' })` misses it. The instinct is to fall back to `getByTestId`. The correct fix is to give the button a name, because a screen reader user has exactly the same problem your test does:

```tsx
<button aria-label="Delete task" onClick={onDelete}>
  <TrashIcon aria-hidden="true" />
</button>
```

**★ `@testing-library/jest-dom` before v6 needs a different import.**
v6 removed the `extend-expect` entry point. On v6+, `import '@testing-library/jest-dom'` in your setup file; below v6, `import '@testing-library/jest-dom/extend-expect'`. An older tutorial plus a current install gives you a module-not-found on a package that is clearly installed.

**★ Snapshot tests on a whole page are a change detector, not a test.**
`expect(container).toMatchSnapshot()` on a component tree fails on every cosmetic edit and passes on every logic regression that does not alter markup. They are worth having on small, stable, output-shaped units — a formatter, a serialiser — and actively harmful on pages.

**★ jsdom has no layout engine, so visibility and size assertions are fiction.**
`getBoundingClientRect()` returns zeros. Anything depending on element geometry, `IntersectionObserver`, scroll position or media queries either needs a stub you control or belongs in Playwright.

**★ A component that calls `fetch` in an effect will hit the network in jsdom unless you stop it.**
Node 24 ships a real `fetch`. There is no automatic interception. Either inject the fetcher, or install a request interceptor in a setup file, and make the failure mode loud — an unmocked request should throw, not silently time out.

**★ Vitest 5 no longer searches parent directories for a config file.**
Running `vitest` from a package subdirectory in a monorepo used to find the root config. Now it does not; pass `--config ../vitest.config.ts` and scope discovery with `--dir`.

## Interview questions

**★ Why does the choice of runner matter less than people think, and what does matter?**
Both Jest and Vitest run your code in a Node process with jsdom providing a fake DOM. The constraints that actually shape your test suite — no layout engine, no browser navigation, no real streaming, no framework request lifecycle — come from that environment and apply identically to both. What differs is ergonomics: Vitest reuses your Vite pipeline and resolves `tsconfig` path aliases through a plugin, while Jest needs `next/jest` to arrange an equivalent transform and needs its module aliases maintained by hand. On a new project that duplication is the deciding factor; on an existing Jest suite it rarely justifies a migration on its own.

**★ What does `next/jest` configure, and what is the one thing people expect it to configure and it does not?**
It sets the transform to the Next.js compiler, auto-mocks stylesheets, image imports and `next/font`, loads `.env` files into `process.env`, ignores `node_modules` for resolution and transforms, ignores `.next`, and reads `next.config.js` for the flags that turn on SWC transforms. It does not map module path aliases — you mirror `compilerOptions.paths` into `moduleNameMapper` yourself, and keeping the two in sync is a standing maintenance cost.

**★ Why is `createJestConfig(config)` exported as a call rather than an object?**
Because `next/jest` has to load your Next.js config to decide which transforms to enable, and that load is asynchronous. Exporting the result of the factory call lets Jest await the resolved configuration. Exporting a plain object would mean the config was read before Next.js had finished telling it what to be.

**★ You need to test a component and a Zod schema. Should they share a Vitest environment?**
No. The schema test needs no DOM at all, and constructing jsdom is paid per test file. Split them into two Vitest projects — one on `node` for `src/lib`, one on `jsdom` for components — or override a single outlier with a `// @vitest-environment node` docblock. A global `environment: 'jsdom'` makes every cheap test pay for the expensive one.

**★ When would you reach for `queryBy` instead of `getBy`?**
Only when asserting that something is absent. `getBy*` throws on no match, so it cannot express "this is not here" without a try/catch; `queryBy*` returns `null` and lets you write `expect(screen.queryByRole('alert')).toBeNull()`. Conversely, do not use `queryBy` to assert presence — you lose the descriptive failure message that `getBy` gives you.

**★ A test using `fireEvent.click` passes, and the same flow is broken in the browser. What is the likely cause?**
`fireEvent.click` dispatches a single `click` event; a real click is a sequence including pointer, mouse, and focus events. A component whose behaviour depends on focus (a form that validates on blur), on pointer events (a drag handle), or on an event ordering assumption will diverge. `userEvent` simulates the full sequence and would have caught it.

**★ Your test asserts on `styles.active` and it never matches. Why?**
CSS module imports are auto-mocked by `next/jest`, so the imported object does not carry the bundler's hashed class names. The assertion is checking a stub against a stub. Assert on observable state instead — `toBeDisabled`, `toHaveAttribute('aria-pressed', 'true')`, visible text — which is also what a user can perceive.

**★ You upgrade to Vitest 5 and a previously green suite starts failing on mock call counts. What happened?**
`clearMocks` now defaults to `true`, so Vitest clears every mock's recorded history before each test. Any test that relied on calls recorded in a setup file, at module top level, or in a `beforeAll` hook now sees an empty history. Either move the recording inside the test, or set `clearMocks: false` to restore the previous behaviour — but the default is the safer one, because cross-test history leakage was making tests order-dependent.

**★ Why is "unawaited async assertions now fail" a good change rather than a breaking one?**
Because in Vitest 4 those assertions were auto-awaited at the end of the test with a warning, which meant a failing `expect(p).rejects.toThrow()` could report after the test had already been marked complete. The assertion was decorative. Failing the test surfaces every place where an async expectation was not actually gating the result.

**★ How do you decide something belongs in Playwright rather than in a unit test?**
Ask whether the behaviour depends on anything jsdom does not have: real navigation, real streaming of a response, layout and visibility, the framework's request lifecycle, or a browser engine. If the answer is yes for any of them, no amount of mocking will make a jsdom test meaningful — you will be asserting on the shape of your mocks. Async Server Components, streaming boundaries and full request flows all fall on that side of the line.

{/* FOOTER */}
