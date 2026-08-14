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
| 01 | **[The static APIs](01-the-static-apis.md)** | Where the two sit among the five renderers, the async signature, `prelude` and `postponed`, "waits for all data" and exactly what data counts, rendering the whole document, and every option |
| 02 | **[Aborting, errors and the caveat](02-aborting-errors-caveats.md)** | `signal` and why an abort is a partial success, what lands in the HTML, the handover to `resume`, `onError` for recoverable failures, and why `nonce` is deliberately unavailable |

## Why this is two files

Because a finished prerender and an unfinished one are different subjects. The first is an
API — what you call, what comes back, what "all data" means. The second is a design decision:
what happens when waiting for everything is not something you can afford, which is where
`postponed` appears and where [topic 09](../09-partial-prerendering.md) begins. Splitting
there keeps the abort machinery out of the introduction and keeps the introduction out of the
partial-rendering story.

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
