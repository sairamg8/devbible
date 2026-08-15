---
title: "Wrappers — context, providers and the router"
sidebar_label: "10 · Wrappers and providers"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **RTL 16.x**, from documentation —
> [RTL · Setup](https://testing-library.com/docs/react-testing-library/setup): the
> `AllTheProviders` + `customRender` pattern, `export * from '@testing-library/react'`
> followed by `export {customRender as render}`, and the caution that *"Generally you should
> not need to create custom queries for react-testing-library"*; and
> [RTL · API](https://testing-library.com/docs/react-testing-library/api) for the `wrapper`
> option on both `render` and `renderHook`.
> No sandbox script backs this page; claims are cited, not measured.

A real component does not render alone. It expects a theme, a locale, a router, a query
client, a store. Rebuilding that stack in every test file is the most reliable way to make a
suite tedious to write and impossible to change.

**The fix is one module, and the documentation prescribes its exact shape.**

## The pattern

```jsx
// test/utils.jsx
import { render } from "@testing-library/react";

const AllTheProviders = ({ children }) => (
  <ThemeProvider theme="light">
    <TranslationProvider messages={defaultStrings}>{children}</TranslationProvider>
  </ThemeProvider>
);

const customRender = (ui, options) =>
  render(ui, { wrapper: AllTheProviders, ...options });

export * from "@testing-library/react";
export { customRender as render };
```

Tests then do this and never mention providers again:

```jsx
import { render, screen } from "../test/utils";     // not from the library
```

🔴 **The re-export is the load-bearing part.** `export * from '@testing-library/react'` then
overriding `render` makes the module a **drop-in replacement** for the library: `screen`,
`within`, `waitFor`, `fireEvent` and everything else still come from one import. Without it,
every test file imports from two places and eventually someone imports the wrong `render` —
which fails in a confusing way, because the component renders without its providers.

## Per-test options without losing that property

Real suites need per-test variation: this test starts on `/orders/A-1001`, that one has an
admin user, another has a pre-seeded cache. Extend the signature rather than writing a second
helper:

```jsx
export function renderWithProviders(
  ui,
  { route = "/", user = anonymousUser, queryClient = makeTestQueryClient(), ...options } = {},
) {
  window.history.pushState({}, "", route);

  const Wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider value={user}>
        <BrowserRouter>{children}</BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );

  return { user: userEvent.setup(), ...render(ui, { wrapper: Wrapper, ...options }) };
}
```

Two habits worth copying from that snippet:

- **Return `userEvent.setup()` alongside the render result**, so each test starts with
  `const { user } = renderWithProviders(<Orders />)` and cannot forget the setup step
  ([topic 04](04-user-event-over-fireevent/README.md)).
- **Every provider has a default**, so a test that does not care says nothing about routes,
  users or clients. Options exist for the tests that do care.

## The router

Two decisions, and both are about honesty.

**Set the location by pushing history before rendering**, as above, rather than mounting a
`MemoryRouter` with a fixed entry when the app uses a browser router — the closer the test
router is to the real one, the fewer behaviours diverge. A `MemoryRouter` is right when the
app genuinely has no browser history to work with.

**Assert navigation by what the user sees, not by spying on the router.**

```jsx
// ❌ tests the router's API
expect(mockNavigate).toHaveBeenCalledWith("/orders/A-1001");

// ✅ tests the application
await user.click(screen.getByRole("link", { name: /A-1001/ }));
expect(await screen.findByRole("heading", { name: /invoice A-1001/i })).toBeInTheDocument();
```

The second version survives a router upgrade, a route-definition change, and a switch from
`navigate()` to a `<Link>`. The first breaks on all three while proving nothing about whether
the destination renders.

## Query clients and stores

**A fresh client per test, with retries off.**

```jsx
const makeTestQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });
```

Retries turn one failing request into several seconds of waiting and a timeout instead of a
clear failure. A shared client leaks cached data between tests, which is the classic
"passes alone, fails in the suite" bug.

**The same rule for stores:** build a new one per test. If the store is a module singleton,
that is a testability problem worth fixing at the source — a factory function — rather than
by resetting state in `beforeEach` and hoping every field was covered.

⚠️ **Prefer seeding through the network layer.** Setting a store's internal state directly to
"log the user in" bypasses the code that does it in the app. An MSW handler returning a session
exercises the real path ([topic 06](06-mocking-the-api/README.md)). Direct seeding is a
shortcut for tests where authentication is not the subject — a fair trade, made knowingly.

## What not to put in the wrapper

The wrapper is for what the component genuinely needs, not for everything the app has.

- **Not error boundaries.** They swallow the failures a test exists to surface, so a broken
  component renders a fallback and the test fails with a confusing message. Add one only when
  the boundary *is* the subject.
- **Not `<Suspense>` by default**, for the same reason — a permanent fallback looks like a
  loading state that never resolves.
- **Not analytics, feature-flag or logging providers**, unless the component reads them.
  Every provider in the wrapper is code running in every test.

## Gotchas

**Symptom:** "useContext must be used within a Provider" in one file only.
**Cause:** that file imported `render` from `@testing-library/react` instead of the test
utils.
**Fix:** the re-export pattern plus a lint rule banning direct RTL `render` imports in test
files.

**Symptom:** tests pass alone and fail together.
**Cause:** a shared query client or store carrying state between tests.
**Fix:** construct a fresh one inside the render helper, so isolation is the default rather
than something each test remembers.

**Symptom:** an error test takes seconds and then times out.
**Cause:** the query client is retrying the failing request.
**Fix:** `retry: false` in the test client.

**Symptom:** a navigation test breaks after a router upgrade.
**Cause:** it asserted on `navigate` being called rather than on the destination rendering.
**Fix:** assert what the user sees at the destination.

**Symptom:** a component throws, and the test fails with an unhelpful fallback message.
**Cause:** an error boundary in the wrapper is catching it.
**Fix:** keep boundaries out of the default wrapper; opt in for the tests that are about
boundaries.

**Symptom:** the wrapper has grown to eight providers and tests are slow.
**Cause:** the default wrapper accumulated everything the app has.
**Fix:** split it — a minimal default, plus opt-in extras for the components that need them.

## Interview questions

**★ How do you avoid repeating provider setup in every test?**
One test-utils module that wraps `render` with the providers and re-exports the rest of RTL —
`export * from '@testing-library/react'` then `export { customRender as render }`. Tests
import `render` and `screen` from that module, so it is a drop-in replacement and no file can
accidentally get the un-wrapped `render`.

**★ Why is the `export *` re-export important?**
Because without it each test imports from two modules, and the wrong `render` eventually gets
imported — producing a "must be used within a Provider" error in one file that looks like a
component bug. One import path removes the possibility.

**★ How should navigation be asserted?**
By what renders at the destination, not by spying on `navigate`. A spy assertion breaks on a
router upgrade or a switch between `navigate()` and `<Link>` while proving nothing about
whether the destination works; asserting the heading appears survives all of that and tests
the actual behaviour.

**Why a fresh query client per test, with retries disabled?**
A shared client leaks cache between tests, which produces order-dependent failures. Retries
turn a clean failure into a slow timeout. Both are solved by constructing the client inside
the render helper with `retry: false`.

**What should not go in the default wrapper?**
Error boundaries and `Suspense`, because they hide the failures tests exist to catch, and any
provider the component does not actually read. Each one costs time in every test and can mask
a real error.

---

← Prev: [Testing hooks](09-testing-hooks.md) ·
Index: [Phase 14](README.md) ·
Next → [Roles are the query surface](11-roles-as-the-query-surface.md)
