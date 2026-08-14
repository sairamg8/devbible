---
title: "Document metadata (19)"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<title>`](https://react.dev/reference/react-dom/components/title),
> [`<meta>`](https://react.dev/reference/react-dom/components/meta),
> [`<link>`](https://react.dev/reference/react-dom/components/link) and the
> [React 19 release post](https://react.dev/blog/2024/12/05/react-19).
> No sandbox script backs this topic; claims are cited, not measured.

**React 19 lets the component that knows a fact about the page declare it.** Render `<title>`,
`<meta>` or `<link>` anywhere in the tree and React moves the DOM element into the document's
`<head>` — on the client, during streaming SSR, and from Server Components, with one mechanism
instead of three workarounds.

The feature is small. The rules around it are not: four documented cases where hoisting
switches off, one tag that accepts only a single string, one that needs exactly one of four
props, and one that de-duplicates by `href` and then refuses to update.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[Hoisting, and the four exceptions to it](01-hoisting.md)** | The problem it replaces, what "hoist" means in React's own words, the four cases where React leaves the tag where you put it, why this matters more on the server than the client, and the one streaming question the references do not settle |
| 02 | **[The three tags, prop by prop](02-the-three-tags.md)** | `<title>`'s text-only children and the *undefined* behaviour of two titles, `<meta>`'s exactly-one-of-four rule and the `itemProp` fork, `<link>`'s de-duplication by `href` and its two real caveats, and where React stops and a metadata library starts |

## Why this is two files

**Whether the tag moves** and **what the tag accepts** are different questions with different
failure modes. The first is one rule plus four exceptions, and it is where server rendering
earns the feature. The second is three independent prop surfaces, each with a quiet trap —
interpolation in `<title>`, `content` without a partner in `<meta>`, prop changes ignored on
`<link>`.

Splitting there keeps the exception table out of the prop reference, and keeps the reader who
just wants to know *why is my stylesheet in the body* from reading about microdata.

## Where this connects

- **[Topic 15 · Stylesheets and `precedence`](../15-stylesheets-and-precedence.md)** — the
  `<link rel="stylesheet">` half, which needs `precedence` to be hoisted at all.
- **[Topic 16 · `<script async>` support](../16-async-scripts.md)** — the same hoist-and-
  deduplicate treatment applied to a fourth tag.
- **[Topic 11 · Resource preloading](../11-resource-preloading.md)** — the imperative
  counterpart: `preload` and `preinit` do from code what a hoisted `<link>` does from JSX.
- **[Topic 08 · Prerendering](../08-prerendering/README.md)** — the static renderers expect the
  tree to render the whole document, which is what makes metadata hoisting necessary rather
  than merely convenient.
- **[Topic 02 · Hydration mismatches](../02-hydration-mismatches.md)** — metadata derived from
  anything that differs between server and client mismatches like any other markup.

---

← Index: [Phase 11](../README.md) ·
Prev: [Partial pre-rendering (19.2)](../09-partial-prerendering/README.md) ·
Next → [Hoisting, and the four exceptions to it](01-hoisting.md)
