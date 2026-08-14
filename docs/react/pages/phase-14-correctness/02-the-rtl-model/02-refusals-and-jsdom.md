---
title: "What RTL refuses, and where jsdom stops"
sidebar_label: "02 · Refusals and jsdom"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **React Testing Library 16.x** and **jsdom**, from
> documentation — Testing Library
> [RTL intro](https://testing-library.com/docs/react-testing-library/intro) (not a test
> runner; does not deal with instances),
> [FAQ](https://testing-library.com/docs/react-testing-library/faq) (no shallow rendering,
> the Enzyme comparison, the `cloneNode` snapshot caveat) and
> [Guiding Principles](https://testing-library.com/docs/guiding-principles).
> No sandbox script backs this page; claims are cited, not measured.

A library is defined as much by its refusals as by its API. RTL's are deliberate, they are
documented, and every one of them is the same argument in a different costume: **a test
that can see something the user cannot is a test that can be wrong about the thing that
matters.**

This page is the boundary. First the three things the library will not give you and why,
then the three things the *environment* cannot give you regardless of the library — which
is a different kind of limit, and one people routinely mistake for a bug.

## Refusal 1 — no shallow rendering

Shallow rendering renders one component one level deep: children appear as unrendered
placeholders rather than real DOM. It is fast, and it was the default style of the Enzyme
era. RTL does not support it and does not intend to.

The reasoning in the FAQ is that shallow rendering tests something that never ships. A
component that renders `<Button disabled={busy}>Save</Button>` shallow-renders to a
placeholder carrying a `disabled` prop. The assertion you can write is *"it passed
`disabled: true`"* — a claim about a prop, not about a page. Whether a disabled button is
actually unclickable depends on `Button`, and shallow rendering has deliberately excluded
`Button` from the test.

This produces the failure pair from [topic 01](../01-what-to-test/README.md), in its
sharpest form:

- **Refactor and the test breaks.** Replace `<Button disabled>` with
  `<Button aria-disabled>` plus a no-op handler — identical to the user, and a different
  prop. The test fails, nothing is broken.
- **Break it and the test passes.** `Button` ignores `disabled` entirely after a bad
  merge. The prop is still passed, the assertion still holds, the button is still
  clickable in production.

**What to do instead:** render the real tree and assert on the outcome —
`expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()`. That holds across
both refactors and fails when either component is broken. If the real tree is too
expensive to render — a child that hits the network on mount — the answer is to mock that
child's *data*, not to mock its existence ([topic 06](../06-mocking-the-api/README.md)).

Where a genuinely heavy child must go, the FAQ names the tool: mock the module with
`jest.mock` (or `vi.mock`). That is an explicit, visible decision in one test file, not a
rendering strategy applied to every test you write.

## Refusal 2 — no component instances

The intro is explicit that RTL does **not** deal with instances of rendered React
components. There is no `wrapper.instance()`, no way to reach a class component's `this`,
no handle on a function component at all — function components have no instance to hand
out, which is itself a hint about how much the idea was worth.

You therefore cannot call a method on a component from a test. You call it the way the app
does: by rendering the component and doing the thing that triggers it.

```jsx
// Not available, and not an oversight:
//   wrapper.instance().handleSubmit()

// The equivalent that also proves the wiring works:
await user.click(screen.getByRole("button", { name: /save/i }));
expect(await screen.findByText(/saved/i)).toBeInTheDocument();
```

The second version tests the handler *and* that it is attached to the button *and* that the
button is reachable and enabled. The first tests a function that may well be wired to
nothing.

## Refusal 3 — no state access

There is no `wrapper.state()` and no equivalent for hooks. You cannot read `count`; you
read the "3 items" the user sees. You cannot set state directly; you perform the
interaction that sets it.

This is the refusal people resent longest, usually while testing something whose state has
no visible consequence — and that is the tell. If `isDirty` changes nothing on screen and
nothing about what the component does, there is nothing to test yet. If it does change
something — an enabled Save button, a navigation-away warning — then *that* is the
assertion, and it survives the day `isDirty` becomes `useReducer` or moves into a store.

The FAQ's rejection of Enzyme collects all three refusals: shallow rendering, selecting
components by their constructor, and reading instance state. Each one is a way of reaching
past the DOM into the implementation.

⚠️ **One practical FAQ caveat that belongs here, because it is the same "the DOM is real"
fact in another form:** the DOM is *mutable*, so if you snapshot a node and then interact,
`snapshot-diff` sees no change — you are diffing an object against its own later self.
Clone with `cloneNode(true)` before storing it. Real document, real mutation, real
aliasing. ([Topic 12](../12-snapshot-tests.md) covers snapshots properly.)

## What jsdom is

Tests run in Node, and Node has no DOM. **jsdom is a pure-JavaScript implementation of the
DOM and HTML standards**, providing `document`, `window`, elements, events and enough of
the platform that React can render into it and RTL can query it. It is the default test
environment for Jest and an opt-in one for Vitest ([topic 07](../07-jest-or-vitest.md)).

It is genuinely good, which is what makes its edges surprising: everything works until it
abruptly does not, and the missing piece is never the piece you were testing.

## Where jsdom stops

**1 · There is no layout, so there are no geometry values.** jsdom parses CSS but does not
lay anything out. `getBoundingClientRect()` returns zeros. `offsetWidth`, `offsetHeight`,
`scrollHeight` are 0. Nothing is ever scrolled, and nothing overflows. Any component whose
logic asks "does this fit?", "is this off-screen?", "how tall is the list?" cannot be
answered by a jsdom test — you can stub the measurement, and then you are testing your stub.

**2 · Observers and media APIs are absent unless you provide them.**
`IntersectionObserver`, `ResizeObserver` and `matchMedia` are not implemented; touching one
throws `not a function` or `not defined`. The standard fix is a polyfill or a stub in test
setup, but note what that means: an infinite-scroll component tested this way is testing
*"when I fire the observer callback, more items render"*. That is a fair unit test of the
rendering half, and it proves nothing about whether the sentinel is ever actually observed.

**3 · There is no navigation and no real network.** `window.location.assign` and a real
form submission are not implemented — jsdom logs a "not implemented" error rather than
navigating. `fetch` reaches the real network unless you intercept it, which is why the API
layer is mocked at the network boundary with MSW rather than by stubbing `fetch` by hand
([topic 06](../06-mocking-the-api/README.md)).

**4 · There is no rendering engine, so there is no paint, no animation and no real
visibility.** No compositor, no `requestAnimationFrame`-driven visual result, no CSS
transitions completing. `toBeVisible` works from the computed-style rules jsdom *does*
implement — `display`, `visibility`, `opacity`, `hidden` — not from anything painted, and
an element hidden purely because a parent has zero height is not hidden as far as jsdom is
concerned.

**The honest conclusion:** when what you need to know is *does this look right, fit,
scroll, animate or navigate*, the answer is a real browser — Playwright or Cypress — not a
more elaborate jsdom stub. Recognising the boundary is a skill; the failure mode is a
40-line mock of `IntersectionObserver` that proves nothing and breaks whenever the
component's scroll strategy changes.

## RTL is not a test runner

The intro says so plainly: RTL is *"a very light-weight solution for testing React
components"* built as *"light utility functions on top of `react-dom` and
`react-dom/test-utils`"*. It has no `describe`, no `it`, no `expect`, no assertion library,
no watch mode, no coverage, no config for which files are tests.

All of that comes from Jest or Vitest, and the matchers you actually assert with —
`toBeInTheDocument`, `toBeDisabled`, `toHaveAccessibleName` — come from a third package,
`@testing-library/jest-dom`. Three libraries with three jobs:

| Package | Provides |
|---|---|
| Jest / Vitest | the runner, `describe`/`it`, `expect`, mocks, coverage, the jsdom environment |
| `@testing-library/react` | `render`, `screen`, queries, `cleanup`, `act`, `renderHook` |
| `@testing-library/jest-dom` | DOM-aware matchers for `expect` |

Worth knowing because the errors are attributed wrongly all the time.
`toBeInTheDocument is not a function` is not an RTL problem — `jest-dom` is not imported in
setup. `document is not defined` is not an RTL problem either — the runner is in the Node
environment rather than jsdom.

## Gotchas

**Symptom:** a test needs `wrapper.instance()`, `wrapper.state()` or shallow rendering, and
none of them exist.
**Cause:** an Enzyme-shaped test being written with RTL. All three are refused by design.
**Fix:** re-ask the test as a user question — render the real tree, do the interaction,
assert on what appears. If the state has no visible consequence, there is nothing to assert
yet.

**Symptom:** `getBoundingClientRect()` returns all zeros, so a "does it fit" branch never
runs.
**Cause:** jsdom does no layout; every geometry value is 0.
**Fix:** either stub the measurement and accept you are testing the branch, not the
measurement, or move the test to a real browser. Do not chase the zeros.

**Symptom:** `IntersectionObserver is not defined` or `window.matchMedia is not a function`.
**Cause:** neither is implemented in jsdom.
**Fix:** polyfill or stub it in test setup, and be clear afterwards about what the test
proves — that the callback renders more items, not that the sentinel is observed.

**Symptom:** "Not implemented: navigation (except hash changes)" in the test output.
**Cause:** something called `location.assign` or submitted a form for real; jsdom does not
navigate.
**Fix:** assert on the call (a mocked router, a spy) rather than on the navigation, and put
the real-navigation check in a browser test.

**Symptom:** `toBeInTheDocument is not a function`.
**Cause:** `@testing-library/jest-dom` is not imported in the setup file — an RTL-adjacent
package, not RTL.
**Fix:** import it once in the runner's setup file ([topic 07](../07-jest-or-vitest.md)).

**Symptom:** a `snapshot-diff` between "before" and "after" shows no difference even though
the DOM changed.
**Cause:** the DOM node is mutable and both snapshots reference the same live node.
**Fix:** `cloneNode(true)` before storing the first one.

## Interview questions

**★ Why does React Testing Library not support shallow rendering?**
Because a shallow test asserts on props passed to placeholders rather than on what renders.
It breaks on refactors that change nothing for the user, and it passes when a child ignores
the prop entirely. RTL's position is that the real tree is what ships, so the real tree is
what you test; a genuinely expensive child gets mocked explicitly with `jest.mock`, which is
one visible decision rather than a rendering strategy.

**★ How do you test a component's internal state with RTL?**
You do not — there is no state or instance access. You test the state's consequence: the
enabled button, the visible count, the appearing error. If the state has no consequence,
there is nothing worth asserting; if it has one, the assertion keeps working when the state
moves to a reducer or a store.

**★ What is jsdom and what can't it do?**
A JavaScript implementation of the DOM and HTML standards, giving Node a `document` and a
`window`. It has no layout engine — all geometry is zero and nothing scrolls; no
`IntersectionObserver`, `ResizeObserver` or `matchMedia` unless polyfilled; no navigation
and no real network; and no paint, so no animations or visual truth. Anything that turns on
those belongs in a real browser.

**★ Is React Testing Library a test framework?**
No. It provides `render`, `screen`, queries and cleanup — light utilities over `react-dom`.
The runner, `describe`/`it`/`expect`, mocking and coverage come from Jest or Vitest, and the
DOM matchers come from `@testing-library/jest-dom`. Most "RTL errors" people report are
actually one of the other two being missing.

**When is the honest answer "this belongs in Playwright"?**
When the assertion is about layout, scrolling, visual appearance, animation, real
navigation, or cross-tab and cross-origin behaviour. Stubbing jsdom until such a test
"passes" produces a test of the stub. A small number of browser tests over the critical
journeys, plus fast jsdom tests for logic and wiring, is the split that pays.

**Why can't you select a component by its type in RTL?**
Because component identity is an implementation detail — it changes when a component is
renamed, split or wrapped, none of which the user experiences. Queries address the
accessible output instead: role, name, label, text ([topic 03](../03-the-query-families/README.md)).

---

← Prev: [`render`, `screen` and the document](01-render-and-screen.md) ·
Index: [React Testing Library's model](README.md) ·
Next → [The query families](../03-the-query-families/README.md)
