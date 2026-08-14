---
title: "Partial pre-rendering (19.2)"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`resume`](https://react.dev/reference/react-dom/server/resume),
> [`resumeToPipeableStream`](https://react.dev/reference/react-dom/server/resumeToPipeableStream),
> [`resumeAndPrerender`](https://react.dev/reference/react-dom/static/resumeAndPrerender) and
> [`prerender`](https://react.dev/reference/react-dom/static/prerender).
> No sandbox script backs this topic; claims are cited, not measured.

**[Topic 08](../08-prerendering/README.md) ended with an abort that produced a `postponed`
object and nothing to do with it. This is what it is for.** A build prerenders as far as it
can, aborts at the parts that depend on the request, and stores what it could not finish. A
request later loads that object and **resumes** the same render — either into a response for
this user, or into more static output.

The APIs are new in **19.2** and there are four of them, split the same way every other server
API in this phase is split: Node streams versus Web streams, and per-request versus static.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[The idea, and the four APIs](01-the-idea-and-the-four-apis.md)** | The build→request lifecycle, where the postponed state lives, the 2×2 grid of resume APIs, what each returns, where the `nonce` restriction resolves, and the line between React's API and a framework's "PPR" |
| 02 | **[Calling the resume APIs](02-calling-them.md)** | The two shared arguments and why the tree is passed **again**, `resume`'s shell contract and `allReady`, `resumeToPipeableStream`'s `pipe`/`abort` with `onShellReady`/`onShellError`, and `resumeAndPrerender` as `prerender` with a head start |
| 03 | **[The caveats that shape the design](03-the-caveats.md)** | The re-render rule that decides whether any of this pays, why bootstrap options and `identifierPrefix` belong to the build, the `nonce`-versus-scripts fork, and three places react.dev contradicts itself |

## Why this is three files

**What it is** is a lifecycle plus a grid — two axes, four functions, and an argument about
what the word "partial" actually covers. **How you call it** is an API surface, and it is where
the surprise lives: you pass the component tree in again, because resuming is a render and not
a replay. **The caveats** read like four small restrictions and are really one design
constraint — the build and the request are two halves of one render — with the performance
model buried in the last of them.

Each answers a different question from different material, and the third is the one that
decides whether you should adopt this at all.

## Where this connects

- **[Topic 08 · Prerendering](../08-prerendering/README.md)** — the other half. `postponed`
  comes from an aborted `prerender`, and everything about waiting, aborting and `nonce` is
  established there.
- **[Topic 06 · Streaming SSR](../06-streaming-ssr.md)** — `resume`'s shell contract and the
  `onShellReady`-versus-`onAllReady` decision are that topic's, unchanged.
- **[Topic 03 · The three server renderers](../03-the-server-renderers.md)** — the same
  Node-versus-Web split decides which of the four you get.
- **[Topic 02 · Hydration mismatches](../02-hydration-mismatches.md)** — why `identifierPrefix`
  has to be identical in both renders, and why `resume` therefore refuses the option.
- **[Topic 01 · CSR vs SSR vs SSG vs streaming vs RSC](../01-csr-ssr-ssg-streaming-rsc.md)** —
  the "SSG + per-request data" cell of that table is this topic.

---

← Index: [Phase 11](../README.md) ·
Prev: [Prerendering](../08-prerendering/README.md) ·
Next → [The idea, and the four APIs](01-the-idea-and-the-four-apis.md)
</content>
