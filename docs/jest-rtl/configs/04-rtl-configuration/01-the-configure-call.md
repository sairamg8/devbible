---
title: "The configure() call"
sidebar_label: "01 · The configure() call"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the
> [Testing Library configuration API](https://testing-library.com/docs/dom-testing-library/api-configuration)
> and the [React Testing Library setup guide](https://testing-library.com/docs/react-testing-library/setup).
> **No sandbox, no console blocks.**

`configure()` is Testing Library's whole configuration surface. It is a **function call**,
not a file — call it once from the setup file and it applies to every test in that
worker's module registry.

```ts
import { configure } from '@testing-library/react';

configure({ testIdAttribute: 'data-qa' });
```

---

## The options

| Option | Default | What it changes |
|---|---|---|
| `testIdAttribute` | `'data-testid'` | Which attribute `getByTestId` reads |
| `asyncUtilTimeout` | `1000` ms | Default timeout for `findBy*` and `waitFor` |
| `throwSuggestions` | `false` | Throws when a better query exists for the element you found |
| `defaultHidden` | `false` | Whether `getByRole` includes `aria-hidden` elements |
| `computedStyleSupportsPseudoElements` | `false` | Lets accessible-name computation read `::before`/`::after` |
| `reactStrictMode` | `false` | Wraps every `render` in `<StrictMode>` |
| `getElementError` | built-in | Customise the "not found" error — the DOM dump lives here |
| `asyncWrapper` / `eventWrapper` | built-in | Framework integration hooks. Rarely yours to set |

---

## `testIdAttribute` — the one with a real reason

Set this when your organisation already standardised on something else:

```ts
configure({ testIdAttribute: 'data-qa' });
```

⚠️ **Change it and every existing `data-testid` stops being found**, with an error that
says the element does not exist rather than that the attribute name changed. Migrate the
markup in the same commit.

---

## 🔴 `asyncUtilTimeout` — the option to leave alone

Raising it is the most common config change in a React codebase, and almost always the
wrong one.

```ts
configure({ asyncUtilTimeout: 5000 });   // 🔴 what does this actually buy?
```

A `findBy*` that needs more than a second in jsdom is telling you something specific:
**there is a real timer, an unmocked network call, or a genuinely slow render.** Raising
the ceiling does not fix any of those — it makes the eventual failure take five times as
long, and turns a fast red into a slow red.

**Do this instead:**

1. **Mock the network** so the response is immediate — MSW resolves in-process.
2. **Fake the timers** for a deliberate delay, and advance them
   ([02 · chunk 04](../02-jest-config-reference/04-mock-state-and-timers.md)).
3. **Raise it for the one test that needs it**, not globally:
   ```ts
   await screen.findByText('Done', {}, { timeout: 4000 });
   ```

A modest global bump (1000 → 2000) is defensible on a loaded CI box. Five seconds is a
plaster over a timer you have not found.

---

## `throwSuggestions` — the useful one nobody enables

```ts
configure({ throwSuggestions: true });
```

When you query one way and a better query exists, this throws and names it — pushing
`getByTestId('submit')` towards `getByRole('button', { name: /submit/i })`.

⚠️ **It throws, it does not warn.** Turning it on in an established codebase can fail
dozens of tests at once. Two workable adoption paths: enable it in the setup file **only**
when an env var is set, or enable it globally on a new project from day one.

---

## `defaultHidden` — read the trade carefully

`getByRole` ignores elements hidden from the accessibility tree by default. That is the
correct behaviour: **if a screen reader cannot reach it, a role query should not either.**

```ts
configure({ defaultHidden: true });   // ⚠️ include hidden elements
```

🔴 **Setting this globally disables a genuine accessibility check.** A modal that leaves
`aria-hidden="true"` on the background, or an icon button with no accessible name, will
now be found by tests and remain unusable by real users. If one test needs it, pass it
locally:

```ts
screen.getByRole('button', { hidden: true });
```

---

## `reactStrictMode`

```ts
configure({ reactStrictMode: true });
```

Every `render` is wrapped in `<StrictMode>`, so effects double-invoke in development
builds exactly as they do in your app.

**Worth turning on** if the app itself uses StrictMode — otherwise tests pass on a
mounting behaviour production never sees. Expect it to surface real bugs on adoption:
effects that subscribe without cleaning up, or that assume they run once.

---

## `getElementError` — trimming the DOM dump

By default a failed query prints the whole container. On a large tree that is hundreds of
unreadable lines, and the useful part is the message:

```ts
configure({
  getElementError(message) {
    const error = new Error(message ?? 'Element not found');
    error.name = 'TestingLibraryElementError';
    error.stack = undefined;
    return error;
  },
});
```

⚠️ **Do this knowing the cost.** The dump is genuinely useful when a query fails for a
reason you did not predict. A better first move is `DEBUG_PRINT_LIMIT`, which caps the
output without discarding it:

```bash
DEBUG_PRINT_LIMIT=10000 npx jest
```

---

## Where to call it

In the setup file, after the jest-dom import:

```ts
// src/setupTests.ts
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

configure({ asyncUtilTimeout: 2000, reactStrictMode: true });
```

⚠️ **Calling it inside a test file affects only that module registry**, which is
occasionally what you want — a single file needing `defaultHidden` — but is a confusing
place to put a project-wide setting.

---

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Every `getByTestId` fails after a config change | `testIdAttribute` no longer matches the markup | Migrate the attribute in the same commit |
| Suite got much slower after a timeout bump | Failures now take the full timeout each | Fix the underlying wait; keep the default |
| `findBy*` still times out at 1000 ms | `configure()` ran in a different registry, or after the test | Call it in the setup file |
| Dozens of tests fail after enabling `throwSuggestions` | It throws rather than warns | Adopt behind an env var, or on new projects only |
| An inaccessible element is found by `getByRole` | `defaultHidden: true` set globally | Remove it; pass `{ hidden: true }` per query |
| Effects run twice after enabling `reactStrictMode` | That is the point — it matches the app | Fix the effect's cleanup |
| Failure output is unreadably long | The default DOM dump | `DEBUG_PRINT_LIMIT`, before customising `getElementError` |
| A per-file `configure()` seems to leak | Same module registry within a worker | Set project-wide options in the setup file only |
| `configure` imported from the wrong package | `@testing-library/dom` and `/react` both export it | Import from `@testing-library/react` in a React project |

---

## Interview questions

**Q. Where does RTL keep its configuration?**
Nowhere on disk — `configure()` is a function call, typically made once from the runner's
setup file, applying to the module registry it runs in.

**Q. Why is raising `asyncUtilTimeout` usually wrong?**
It treats the symptom. A slow `findBy*` in jsdom means a real timer, an unmocked request
or a slow render; a bigger ceiling only makes failures slower to arrive.

**Q. What should you do instead?**
Mock the network so responses are immediate, fake and advance timers for deliberate
delays, and pass a per-query `timeout` for the rare genuine case.

**Q. What does `throwSuggestions` do and why is adoption awkward?**
It throws when a better query exists, naming it. Because it throws rather than warns, an
established suite can fail wholesale — adopt behind a flag or on new projects.

**Q. Why is `defaultHidden: true` risky?**
`getByRole` deliberately ignores elements hidden from the accessibility tree. Including
them lets tests pass on UI a screen-reader user cannot reach — the flag disables a real
accessibility check.

**Q. When is `reactStrictMode` worth enabling?**
When the app renders under StrictMode, so tests see the same double-invoked effects.
Expect it to expose effects that assume a single run.

**Q. Failure output is thousands of lines. First move?**
`DEBUG_PRINT_LIMIT` to cap the dump. Replacing `getElementError` removes it entirely and
costs you the information when a failure is genuinely unexpected.

**Q. Does `configure()` in one test file affect another?**
Within a worker's module registry, yes — which is why project-wide settings belong in the
setup file, not scattered across test files.

---

← **Prev:** [04 · RTL configuration](./README.md) ·
**Next:** [02 · The setup file](./02-the-setup-file.md)
