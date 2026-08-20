---
title: "The setup file"
sidebar_label: "02 · The setup file"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the
> [React Testing Library setup guide](https://testing-library.com/docs/react-testing-library/setup),
> the [user-event API](https://testing-library.com/docs/user-event/intro),
> [jest-dom](https://github.com/testing-library/jest-dom) and the
> [MSW v2 documentation](https://mswjs.io/docs/). **No sandbox, no console blocks.**

`setupTests.ts` is an ordinary module. It has no special powers — it matters only because
the runner was told to load it before each test file. **Everything about it is ordering.**

---

## The four jobs, in the order they belong

```ts
// src/setupTests.ts
// 1 ─ extend expect
import '@testing-library/jest-dom';

// 2 ─ configure the library
import { configure } from '@testing-library/react';
configure({ asyncUtilTimeout: 2000 });

// 3 ─ network mocking lifecycle
import { server } from './mocks/server';
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// 4 ─ jsdom gaps — chunk 03
import './polyfills';
```

Wire it as `setupFilesAfterEnv` in Jest, or `test.setupFiles` in Vitest —
[chunk 03 of this section](../03-setup-lifecycle.md) explains why those two differently
named options are the same stage.

---

## jest-dom, and its name under Vitest

`@testing-library/jest-dom` adds `toBeInTheDocument`, `toHaveTextContent`,
`toBeDisabled`, `toHaveAccessibleName` and the rest. **It works under Vitest too** — the
package name says Jest for historical reasons only.

```ts
import '@testing-library/jest-dom';          // both runners
```

For TypeScript, the matchers need to be visible to the type checker. The modern package
ships types that attach on import; if your editor disagrees, a `types` entry in
`tsconfig.json` or an explicit import in a `.d.ts` settles it. **A type error here does
not stop the matchers working at runtime** — it is an editor problem, and worth separating
from a real failure.

---

## 🔴 Automatic cleanup, and the two ways to lose it

RTL unmounts rendered components after each test — via an `afterEach` it registers when
imported, provided the framework's globals exist.

**It is lost if:**

1. **`injectGlobals: false` (Jest) or `globals: false` (Vitest)** — there is no global
   `afterEach` to hook. Vitest's docs are explicit that `globals: true` is what enables
   automatic cleanup; without it, import it yourself:
   ```ts
   import { cleanup } from '@testing-library/react';
   afterEach(cleanup);
   ```
2. **`RTL_SKIP_AUTO_CLEANUP` is set**, or the `/dont-cleanup-after-each` entry point is
   imported. Rare, and usually inherited from a copied config.

⚠️ **The symptom of losing cleanup is not an error.** It is `getByRole` finding *multiple*
elements, because the previous test's DOM is still mounted. A "Found multiple elements"
failure in a test that renders one component is this, near enough every time.

---

## MSW lifecycle — the ordering that matters

```ts
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());     // 🔴 the one people omit
afterAll(() => server.close());
```

- **`resetHandlers()` is not optional.** A `server.use()` override inside one test stays
  installed for the rest of the file without it, and the test it breaks is a later one
  that looks unrelated.
- **`onUnhandledRequest: 'error'`** turns a forgotten mock into an immediate, named
  failure instead of a real network call.
- **Under jsdom, MSW needs the node build.** That is a Jest resolution setting, not an MSW
  one: `testEnvironmentOptions: { customExportConditions: [''] }` —
  [02 · chunk 01](../02-jest-config-reference/01-discovery-and-environments.md). Without
  it MSW appears to start and intercepts nothing.

---

## `userEvent.setup()` — v14's contract

```ts
// ❌ v13 style. Still seen everywhere on the web
userEvent.click(button);

// ✅ v14 — setup() once per test, and await every interaction
const user = userEvent.setup();
await user.click(button);
```

`setup()` installs its own pointer/keyboard state and returns the API. **Every method
returns a promise**, and skipping the `await` is the cause of a whole family of "the click
did nothing" reports.

### The options worth knowing

| Option | Use |
|---|---|
| `advanceTimers` | 🔴 **Required under fake timers.** `userEvent.setup({ advanceTimers: jest.advanceTimersByTime })`, or `vi.advanceTimersByTime` |
| `delay` | Milliseconds between keystrokes. `null` disables — the fix for a slow `type()` on long strings |
| `pointerEventsCheck` | Relaxes the "element has `pointer-events: none`" guard. Usually a sign of a real problem |
| `document` | For a custom document, e.g. inside an iframe |
| `skipHover` | Skip the hover that precedes a click |

⚠️ **Call `setup()` inside the test or a `beforeEach`, not at module scope.** At module
scope it is created once and its accumulated pointer state is shared across every test in
the file.

---

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `toBeInTheDocument is not a function` | jest-dom not imported, or imported in `setupFiles` | Import it in `setupFilesAfterEnv` / `test.setupFiles` |
| Matchers work, TypeScript complains | Types not visible to the checker | A `types` entry or a `.d.ts` import — runtime is unaffected |
| "Found multiple elements" rendering one component | Automatic cleanup is not running | `globals: true`, or `afterEach(cleanup)` explicitly |
| Cleanup lost after disabling globals | No global `afterEach` for RTL to register | Import `cleanup` and register it |
| A `server.use()` override affects later tests | No `resetHandlers()` | Add it to `afterEach` |
| Tests reach the real network | `onUnhandledRequest` defaults to warning | `'error'` |
| MSW starts but intercepts nothing under jsdom | The browser export condition was resolved | `customExportConditions: ['']` |
| `user.click()` appears to do nothing | The promise was not awaited | `await` every interaction |
| `await user.click()` hangs | Fake timers with no `advanceTimers` bridge | Pass `advanceTimers` to `setup()` |
| `user.type()` takes seconds on a long string | The default inter-key delay | `setup({ delay: null })` |
| Pointer state leaks between tests | `setup()` called at module scope | Call it per test |

---

## Interview questions

**Q. What makes `setupTests.ts` special?**
Nothing intrinsic. It is a normal module the runner is configured to load before each test
file — all of its behaviour follows from *when* it runs.

**Q. Does `@testing-library/jest-dom` work with Vitest?**
Yes. The name is historical; it extends whichever `expect` is present.

**Q. How does RTL clean up, and how is that lost?**
It registers an `afterEach` on import, which needs the framework globals. Disabling
globals, or `RTL_SKIP_AUTO_CLEANUP`, removes it — then you register `afterEach(cleanup)`
yourself.

**Q. What does losing cleanup look like?**
Not an error — "Found multiple elements" in a test rendering a single component, because
earlier tests' DOM is still mounted.

**Q. Why is `server.resetHandlers()` in `afterEach` non-negotiable?**
A per-test `server.use()` override otherwise persists for the rest of the file, breaking a
later test that never touched it.

**Q. MSW is set up and intercepts nothing under jsdom. Where do you look?**
At Jest's resolution, not MSW: jsdom resolved the package's browser export condition.
`testEnvironmentOptions: { customExportConditions: [''] }`.

**Q. What changed in user-event v14?**
`setup()` returns the API and every interaction is async. Calling the old
`userEvent.click(el)` form, or forgetting `await`, produces interactions that appear not
to happen.

**Q. Why must `advanceTimers` be passed under fake timers?**
user-event awaits between synthetic events on a clock that is frozen, so it waits forever.
The option bridges it to the fake clock.

**Q. Why not call `setup()` at module scope?**
Its pointer and keyboard state would be shared by every test in the file, so one test's
held modifier key or hover position leaks into the next.

---

← **Prev:** [01 · The configure() call](./01-the-configure-call.md) ·
**Next:** [03 · The jsdom polyfill checklist](./03-the-jsdom-polyfill-checklist.md)
