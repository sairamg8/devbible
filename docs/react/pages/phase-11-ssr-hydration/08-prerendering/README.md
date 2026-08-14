---
title: "Prerendering"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`prerender`](https://react.dev/reference/react-dom/static/prerender) and
> [`prerenderToNodeStream`](https://react.dev/reference/react-dom/static/prerenderToNodeStream).
> No sandbox script backs this topic; claims are cited, not measured.

**`react-dom/static` is a third renderer family, and its defining property is that it
waits.** `renderToString` bails out of Suspense boundaries; the streaming renderers push each
one to the client as it resolves; `prerender` holds until every one of them is finished and
then hands you the whole page. That is what makes static generation of Suspense-driven pages
possible — and what makes an escape hatch necessary when a data source never arrives.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[The third renderer family](01-the-static-apis.md)** | Where the two sit among the five renderers, the async signature, `prelude` and `postponed`, "waits for all data" and exactly what data counts |
| 02 | **[Calling them](02-calling-them.md)** | Rendering the whole document, the doctype and bootstrap injection, both ways to consume the prelude, and every option — including the one that decides whether the page ships React at all |
| 03 | **[Aborting, errors and the caveat](03-aborting-errors-caveats.md)** | `signal` and why an abort is a partial success, what lands in the HTML, the handover to `resume`, `onError` for recoverable failures, and why `nonce` is deliberately unavailable |

## Why this is three files

Three questions, and they are answered from different material. **What is this thing** is a
comparison — five renderers, one property that separates this family from the other two.
**How do you call it** is an API surface: the document requirement, the two consumption
patterns, the options. **What if it never finishes** is a design decision rather than a
feature, and it is where `postponed` appears and where
[topic 09](../09-partial-prerendering.md) begins.

Splitting there keeps the abort machinery out of the introduction, and keeps the option table
out of the argument about what prerendering *is*.

## Where this connects

- **[Topic 03 · The three server renderers](../03-the-server-renderers.md)** — the same
  Node-streams-versus-Web-streams split governs which static API you get.
- **[Topic 06 · Streaming SSR](../06-streaming-ssr.md)** — the direct opposite trade: send a
  shell now and fill it in, rather than wait and send everything.
- **[Topic 09 · Partial pre-rendering](../09-partial-prerendering.md)** — what `postponed` is
  for, and the two ways to finish an aborted prerender.
- **[Topic 04 · `hydrateRoot`](../04-hydrateroot.md)** — the client half, including hydrating
  the entire `document` as these APIs expect.
- **[Topic 02 · Hydration mismatches](../02-hydration-mismatches.md)** — why
  `identifierPrefix` has to match on both sides.

---

← Index: [Phase 11](../README.md) ·
Prev: [Selective hydration](../07-selective-hydration.md) ·
Next → [The static APIs](01-the-static-apis.md)
