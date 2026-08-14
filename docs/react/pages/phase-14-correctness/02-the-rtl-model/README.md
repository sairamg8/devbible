---
title: "React Testing Library's model"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **React Testing Library 16.x**, from documentation —
> Testing Library [RTL intro](https://testing-library.com/docs/react-testing-library/intro),
> [RTL API](https://testing-library.com/docs/react-testing-library/api),
> [Setup](https://testing-library.com/docs/react-testing-library/setup),
> [FAQ](https://testing-library.com/docs/react-testing-library/faq) and
> [Guiding Principles](https://testing-library.com/docs/guiding-principles).
> No sandbox script backs this topic; claims are cited, not measured.

**RTL is a very small library, and almost all of its value is in what it does not do.**
It renders your component into a real DOM document and hands you queries for finding
things the way a person would. There is no component instance, no state, no shallow tree,
no "wrapper" object with methods — because every one of those is a way to write a test
that passes while the page is broken.

The whole surface fits in a paragraph: `render` puts your element in a document,
`screen` finds things in it, `cleanup` takes it down again after each test. Learning RTL
is mostly learning why that is enough.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[`render`, `screen` and the document](01-render-and-screen.md)** | What `render` actually does to the DOM, its options, the return value worth using and the parts worth ignoring, why `screen` is preferred over destructuring, and automatic cleanup |
| 02 | **[What RTL refuses, and where jsdom stops](02-refusals-and-jsdom.md)** | No shallow rendering, no instances, no state — as design, not omission; what jsdom is and the four things it cannot do; and why RTL is not a test runner |

## Why this is two files

The first chunk is the API you use every day and the mental model behind it — a document,
some queries, a teardown. The second is the boundary: what the library will not give you,
and what the *environment* cannot give you regardless of the library. They fail
differently and they are learned differently — the first from writing tests, the second
from a test that mysteriously does not work.

## Where this connects

- **[Topic 01 · What to test](../01-what-to-test/README.md)** — the principle this
  library is built to enforce.
- **[Topic 03 · The query families](../03-the-query-families/README.md)** — the queries `screen`
  exposes, in priority order.
- **[Topic 07 · Jest or Vitest](../07-jest-or-vitest.md)** — RTL is not a runner; that
  topic picks one and configures the jsdom environment this topic describes.
- **[Topic 10 · Wrappers](../10-wrappers-and-providers.md)** — the `wrapper` option
  introduced here, turned into one `renderWithProviders` for a whole suite.

---

← Prev: [What to test, and what not to](../01-what-to-test/README.md) ·
Index: [Phase 14](../README.md) ·
Next → [`render`, `screen` and the document](01-render-and-screen.md)
