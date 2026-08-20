---
title: "RTL configuration"
sidebar_label: "04 · RTL configuration"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the
> [Testing Library configuration API](https://testing-library.com/docs/dom-testing-library/api-configuration),
> the [React Testing Library setup guide](https://testing-library.com/docs/react-testing-library/setup)
> and the [user-event API](https://testing-library.com/docs/user-event/intro).
> **No sandbox, no console blocks.**

**React Testing Library has no config file, and that is not an oversight.** It is a
library you call, not a tool that runs your code — so "configuring RTL" means three
separate things that happen to share a name.

---

## The three things people mean

| # | Thing | Where it lives | Chunk |
|---|---|---|---|
| 1 | **`configure()`** — the library's own knobs | A call, usually from the setup file | [01](./01-the-configure-call.md) |
| 2 | **The setup file** — jest-dom, MSW lifecycle, cleanup | An ordinary module the **runner** loads | [02](./02-the-setup-file.md) |
| 3 | **jsdom's missing APIs** — `matchMedia`, `ResizeObserver`, … | Polyfills in that same file | [03](./03-the-jsdom-polyfill-checklist.md) |

Only the first is genuinely RTL's. The second is a runner concern
([chunk 03 of this section](../03-setup-lifecycle.md)), and the third is jsdom's — RTL
gets blamed for both because the error surfaces inside a `render()` call.

---

## Which layer is failing

The fastest way to place a failure:

| The error | Layer | Where to look |
|---|---|---|
| `toBeInTheDocument is not a function` | the **setup file** | jest-dom not imported, or imported in the wrong stage |
| `matchMedia is not a function` | **jsdom** | a missing polyfill |
| `Unable to find an element with the text …` | **your query** or the render | not configuration — read the suggested queries |
| `Found multiple elements` | **your query** | scope it, or use `getAllBy*` |
| Warnings about `act(...)` | **async handling** | not configuration |
| `waitFor` times out with the element on screen | **timers** | fake timers with no bridge |
| `getByTestId` finds nothing, the attribute is there | **`configure()`** | `testIdAttribute` does not match |

⚠️ **Two of these are not configuration at all.** A query failing and an `act` warning are
test-authoring problems, and reaching for config to fix them is how projects end up with
inflated timeouts hiding real bugs. Those belong to
[RTL queries](../../pages/08-rtl-queries/01-query-variants-and-priority.md) and
[async utilities](../../pages/10-async-utilities/01-waiting-for-updates.md).

---

## The one-line summary of each chunk

- **[01 · The `configure()` call](./01-the-configure-call.md)** — every option, what it
  costs, and why `asyncUtilTimeout` is the one to leave alone.
- **[02 · The setup file](./02-the-setup-file.md)** — jest-dom, automatic cleanup and how
  to lose it, MSW lifecycle ordering, and `userEvent.setup()` options.
- **[03 · The jsdom polyfill checklist](./03-the-jsdom-polyfill-checklist.md)** — what
  jsdom does not implement, and the copy-ready stubs.

---

← **Prev:** [03 · The setup lifecycle](../03-setup-lifecycle.md) ·
**Next:** [01 · The configure call](./01-the-configure-call.md)
