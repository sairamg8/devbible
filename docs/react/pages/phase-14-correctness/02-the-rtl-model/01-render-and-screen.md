---
title: "render, screen and the document"
sidebar_label: "01 · render and screen"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **React Testing Library 16.x**, from documentation —
> Testing Library [RTL API](https://testing-library.com/docs/react-testing-library/api)
> (`render` options, the return value, `cleanup`, `act`),
> [Setup](https://testing-library.com/docs/react-testing-library/setup) (custom render,
> automatic cleanup) and [queries · About](https://testing-library.com/docs/queries/about)
> (`screen` is pre-bound to `document.body`).
> No sandbox script backs this page; claims are cited, not measured.

## What `render` does

> **By default, React Testing Library creates a `div` and appends it to
> `document.body`**, then renders your element into it.

That is the whole mechanism, and it is worth holding onto because it explains several
things that otherwise look arbitrary:

- There is a **real document**. `document.body` exists; the element is attached to it.
  Anything that depends on being in the document — focus, most accessibility APIs, event
  bubbling to `document` — works.
- Because the tree is attached, **portals work**. A modal rendered through
  `createPortal` into `document.body` lands outside the container `div` but is still in
  the document, which is why querying via `screen` finds it and querying via `container`
  does not.
- Because it is a fresh `div` per `render`, tests do not see each other's markup —
  provided cleanup runs, which it does automatically.

```jsx
import { render, screen } from "@testing-library/react";

render(<Greeting name="Ada" />);

expect(screen.getByRole("heading", { name: /hello, ada/i })).toBeInTheDocument();
```

No wrapper object, no instance, no assertion on what the component returned. A document,
and a question asked of it.

## The options worth knowing

| Option | What it does | When you actually want it |
|---|---|---|
| **`wrapper`** | a component rendered *around* your element | providers — theme, i18n, store, router. The basis of `renderWithProviders`, [topic 10](../10-wrappers-and-providers.md) |
| **`container`** | render into an element you supply, **and it is not appended to `document.body` automatically** | markup with parent requirements — a `<tbody>` that must live inside a `<table>` |
| **`baseElement`** | the node queries and `debug()` are based on; **defaults to the container if you passed one, otherwise `document.body`** | rarely direct — mostly a consequence of passing `container` |
| **`hydrate`** | uses hydration instead of a fresh client render | testing server-rendered markup, [Phase 11](../../phase-11-ssr-hydration/README.md) |
| **`reactStrictMode`** | wraps the tree in `<StrictMode>`, overriding the global `configure` setting | reproducing double-invoked effects deliberately |
| **`queries`** | replaces the default query set | almost never — see the warning below |

⚠️ **The `container` and `baseElement` pair is the one that surprises people.** Pass
`container` and your element is *not* automatically in `document.body`, so queries scoped
to the body find nothing. The documentation is explicit that it "won't automatically
append to `document.body`" — if you pass a container, append it yourself or expect empty
results.

⚠️ **On custom queries the docs are blunt:**

> **Generally you should not need to create custom queries for react-testing-library.
> Where you do use it, you should consider whether your new queries encourage you to test
> in a user-centric way, without testing implementation details.**

## What `render` returns, and what to use

```js
const { container, rerender, unmount, asFragment, debug, ...queries } = render(<App />);
```

**Use `rerender` and `unmount`. Reach for the rest rarely, and for `container` almost
never.**

- **`rerender(ui)`** — re-renders with new props, which is how you test a component's
  response to a prop change. The docs' own caveat is worth quoting, because it is a
  design opinion: *"It'd probably be better if you test the component that's doing the
  prop updating"* — i.e. render the parent and let the real interaction change the prop.
  `rerender` is for when the parent is out of scope.
- **`unmount()`** — the only way to test teardown: that an effect's cleanup runs, a
  subscription is removed, a timer is cleared. Under-used, and the direct test for a class
  of memory leak.
- **`asFragment()`** — a `DocumentFragment` snapshot with no live bindings, which is what
  makes it usable for snapshot testing ([topic 12](../12-snapshot-tests.md)).
- **`container`** — the `div`. It is a DOM node, so `container.querySelector('.thing')`
  works, and that is exactly why it is a trap: it is the escape hatch back to
  implementation details. Legitimate uses are narrow — asserting on something with no
  accessible representation at all, or scoping a query in markup you do not control.
- **`debug()`** — prints the DOM. The docs recommend `screen.debug()` instead.
- **`...queries`** — every query, bound to `baseElement`. Which brings us to the thing you
  should use instead.

## Why `screen` rather than destructuring

`screen` is the same set of queries **pre-bound to `document.body`**, exported as a
singleton. Three reasons it wins:

1. **Nothing to maintain.** Adding a query to a test means typing `screen.` — not
   returning to the `render` line to destructure another name.
2. **It sees the whole document.** Portals, dialogs and toasts that render outside the
   container are found by `screen` and missed by container-scoped queries. Modals are the
   most common thing people fight here.
3. **It reads like the user's viewpoint.** `screen.getByRole('button')` is "on the screen,
   there is a button" — which is the framing the whole library is arguing for.

Scope down deliberately, when you mean it, with `within`:

```jsx
import { render, screen, within } from "@testing-library/react";

render(<OrdersTable />);
const row = screen.getByRole("row", { name: /A-1001/ });
expect(within(row).getByRole("button", { name: /cancel/i })).toBeEnabled();
```

That is the right answer for "the second table's third row" — not a `querySelector` on
`container`, and not a test id ([topic 03](../03-the-query-families/README.md)).

## Cleanup is automatic, and why that matters

> **Cleanup is called after each test automatically by default if the testing framework
> you're using supports the `afterEach` global (like mocha, Jest, and Jasmine).**

So with Jest or Vitest you get it for free: every rendered tree is unmounted between
tests. Three consequences:

- **Effects' cleanup functions run between tests**, which is what stops a subscription or
  interval from one test firing during the next.
- **You do not unmount manually** at the end of a test. Calling `unmount()` is for
  *asserting on teardown*, not hygiene.
- **In a runner without a global `afterEach`, you must call `cleanup()` yourself** —
  the docs say so explicitly — or trees pile up in the document and tests start finding
  each other's elements. "`getByRole` found multiple elements" across unrelated tests is
  the classic symptom.

## `act` — the version you should import

RTL re-exports `act` as a thin wrapper around React's, and recommends importing it from
`@testing-library/react` rather than from React directly, so the version always matches
the renderer RTL is using. **You will rarely call it**: `render`, `rerender`, `unmount`,
`user-event` and the async utilities already wrap what they do.
[Topic 05](../05-async-testing-and-act.md) is about the one case where the warning still
appears and what it is really telling you.

## Custom render — the pattern the docs prescribe

Providers are a suite-wide concern, so RTL's setup guide builds them into `render` once:

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

Tests then import `render` from `test/utils` and never mention providers again. Note the
shape: **re-export everything, then override `render`** — so the module is a drop-in
replacement for the library. [Topic 10](../10-wrappers-and-providers.md) extends it to
per-test options (a route, a preloaded store) without losing that property.

## Gotchas

**Symptom:** a modal or toast renders fine in the app, and the test cannot find it.
**Cause:** the query was scoped to `container`, and the content is in a portal — outside
the container `div` but still inside `document.body`.
**Fix:** query through `screen`, which is bound to the body. This is the single best
argument for `screen` over destructured queries.

**Symptom:** "Found multiple elements" for something the component renders once.
**Cause:** a previous test's tree is still in the document — cleanup is not running
because the runner has no global `afterEach`, or it was disabled.
**Fix:** confirm automatic cleanup applies to your runner; otherwise call `cleanup()` in
your own `afterEach`. Do not disambiguate with `getAllBy*`\[0] — that hides the leak.

**Symptom:** passing `container` makes every `screen` query return nothing.
**Cause:** a supplied container is **not** appended to `document.body`, so nothing is in
the body for `screen` to find.
**Fix:** append it yourself, or drop the option — you need it only for markup with parent
requirements such as `<tbody>`.

**Symptom:** a test asserts on `container.firstChild` and breaks whenever the markup is
wrapped in one more element.
**Cause:** an assertion on structure, through the escape hatch.
**Fix:** query by role or text. `container` is a DOM node precisely so that unusual cases
are *possible*; that is not a reason to make it routine.

**Symptom:** an effect from a previous test fires during a later one.
**Cause:** the tree was never unmounted, so its cleanup never ran.
**Fix:** same as above — automatic cleanup is the mechanism that runs those cleanups.

## Interview questions

**★ What does `render` actually do?**
It creates a `div`, appends it to `document.body`, and renders your element into it — a
real document, not a virtual tree. That is why focus, event bubbling and portals behave
as they do in a browser, and why queries can be asked of the whole body.

**★ Why prefer `screen` over destructuring the queries from `render`?**
`screen` is pre-bound to `document.body`, so it finds portalled content that
container-scoped queries miss, it needs no maintenance when you use a new query, and it
reads as the user's point of view. Destructured queries are bound to `baseElement` and
tempt you toward `container`.

**★ When is `container` legitimate?**
When there is genuinely nothing accessible to query — some third-party markup, or an
element with no role, name or text. It is a DOM node with `querySelector`, so it is also
the easiest way back into implementation-detail testing; treat each use as a decision.

**★ Is cleanup automatic, and what happens if it is not?**
It is automatic in any runner that provides a global `afterEach` — Jest, Vitest, mocha,
Jasmine. Without one you must call `cleanup()` yourself, or rendered trees accumulate in
the document, effects from old tests keep running, and queries start matching several
elements across unrelated tests.

**What is `rerender` for, and what does the documentation say about it?**
It re-renders the same component with new props, for testing prop-change behaviour when
the parent is out of scope. The docs note it would probably be better to test the
component doing the updating — because then the prop change happens through the real
interaction rather than being simulated.

**When would you call `unmount()`?**
To test teardown: that an effect cleanup ran, a subscription was removed, a timer
cleared. Not for hygiene between tests — automatic cleanup already does that.

**Where does `act` come from and how often do you call it?**
Import it from `@testing-library/react`, which re-exports React's with the matching
version. You rarely call it directly: `render`, `rerender`, `unmount`, `user-event` and
the async helpers already wrap their work in it.

---

← Index: [React Testing Library's model](README.md) ·
Next → [What RTL refuses, and where jsdom stops](02-refusals-and-jsdom.md)
