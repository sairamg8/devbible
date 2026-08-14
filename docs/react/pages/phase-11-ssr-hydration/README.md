---
title: "Phase 11 — Server rendering, hydration and the DOM APIs"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: React 19.2.8.** No sandbox and **no console blocks** — every claim is
> validated against primary documentation and each page's `> Verified:` line names
> its sources.

✅ **COMPLETE — all 17 topics written.** 24 leaf pages — five chunked topics (2–3 pages each)
plus twelve single-file topics — **5,495 lines, 0 files over 300.**

**Everything `react-dom` does outside the browser, plus the DOM-level features React 19
absorbed.** This is where SSR stops being a checkbox and starts being a set of trade-offs
you choose between — and where [Phase 10](../phase-10-server-components/README.md)'s
"the RSC environment is separate from your SSR server" finally gets taken apart properly.

| # | Topic | Tier | In one line |
|---|---|---|---|
| 01 | **[CSR vs SSR vs SSG vs streaming vs RSC](01-csr-ssr-ssg-streaming-rsc.md)** | <span className="db-tier t-master">Master</span> | Five distinct things that are constantly conflated, and which combinations are real |
| 02 | **[Hydration mismatches](02-hydration-mismatches.md)** | <span className="db-tier t-master">Master</span> | The documented causes in order, and the fix for each |
| 03 | **[The three server renderers](03-the-server-renderers.md)** | <span className="db-tier t-understand">Understand</span> | Node streams vs Web streams, and why `renderToString` cannot stream Suspense |
| 04 | **[`hydrateRoot`](04-hydrateroot.md)** | <span className="db-tier t-understand">Understand</span> | What it reuses, what it re-creates, and what hydration costs |
| 05 | **[`suppressHydrationWarning` and the two-pass render](05-suppresshydrationwarning.md)** | <span className="db-tier t-understand">Understand</span> | The two escapes for genuinely client-only content, and when each is honest |
| 06 | **[Streaming SSR with Suspense](06-streaming-ssr.md)** | <span className="db-tier t-understand">Understand</span> | The shell, `onShellReady` vs `onAllReady`, and which one a crawler needs |
| 07 | **[Selective hydration](07-selective-hydration.md)** | <span className="db-tier t-understand">Understand</span> | Prioritising the boundary the user just clicked |
| 08 | **[Prerendering](08-prerendering/README.md)** | <span className="db-tier t-understand">Understand</span> | `prerender` and `prerenderToNodeStream` — static generation that waits for all data |
| 09 | **[Partial pre-rendering (19.2)](09-partial-prerendering/README.md)** | <span className="db-tier t-understand">Understand</span> | `postponed`, `resume`, `resumeAndPrerender` — a static shell filled per request |
| 10 | **[Document metadata (19)](10-document-metadata/README.md)** | <span className="db-tier t-understand">Understand</span> | `<title>`, `<meta>` and `<link>` hoisted from anywhere in the tree |
| 11 | **[Resource preloading](11-resource-preloading/README.md)** | <span className="db-tier t-understand">Understand</span> | `preload`, `preinit`, `preconnect`, `prefetchDNS` and when each helps |
| 12 | **[`flushSync`](12-flushsync.md)** | <span className="db-tier t-understand">Understand</span> | Forcing a synchronous commit — the legitimate cases and the cost of every other |
| 13 | **[Root error options (19)](13-root-error-options/README.md)** | <span className="db-tier t-understand">Understand</span> | `onCaughtError`, `onUncaughtError`, `onRecoverableError`, and `onError` on the server |
| 14 | **[`renderToStaticMarkup`](14-rendertostaticmarkup.md)** | <span className="db-tier t-know">Know</span> | No hydration markers — for email and genuinely static pages |
| 15 | **[Stylesheets and `precedence` (19)](15-stylesheets-and-precedence.md)** | <span className="db-tier t-know">Know</span> | Suspense-aware style loading, deduplication, and CSS-in-JS |
| 16 | **[`<script async>` support (19)](16-async-scripts.md)** | <span className="db-tier t-know">Know</span> | Rendered anywhere, hoisted and deduplicated |
| 17 | **[Portals and SSR](17-portals-and-ssr.md)** | <span className="db-tier t-know">Know</span> | Portals do not render on the server; the mount-guard pattern |

## Why this phase sits after Phase 10

Because Phase 10 kept saying "not the SSR server" and deferring the explanation.
[Topic 01 · 01](../phase-10-server-components/01-what-a-server-component-is/01-the-definition.md)
established three environments — RSC, SSR, browser — and drew the line at the definition.
This phase is the middle column: what runs there, what it produces, and how the browser
picks it up.

It also completes two threads deliberately left open:

- **[Phase 8 · Suspense](../phase-8-concurrent-suspense/02-suspense/README.md)** noted that
  Streaming SSR and Selective Hydration are integrated with Suspense. Topics 06 and 07 are
  that integration.
- **[Phase 10 · 13](../phase-10-server-components/13-the-rsc-payload.md)** described the
  first-load sequence — HTML paints, payload reconciles, JavaScript hydrates. Topic 04 is
  the third step in detail.

## The distinction the whole phase rests on

**SSR runs client-graph components on a server to produce HTML; they still ship to the
browser and still hydrate.** RSC runs server-graph components in a separate environment,
before bundling, and they never hydrate at all. An app can use both, and most RSC apps do.

Get that wrong and every topic here reads as a contradiction of Phase 10.

## Where this phase connects

- **Nginx** — caching headers, compression and the SPA fallback for server-rendered React
  are **Nginx** topics. This phase states the requirement and links out.
- **Node** — the process that serves an SSR build, its graceful shutdown and its
  observability are **Node** material.
- **Phase 14 · Testing React** *(not yet written)* — hydration mismatches are the class of
  bug a test suite most often fails to catch.

## Coverage

**All 17 topics, 24 leaf pages, 5,495 lines. No file exceeds 300 lines and nothing was
trimmed to get there.** Five topics became directories on concept boundaries:

| Topic | Chunks | Lines | Split on |
|---|---|---|---|
| 08 Prerendering | 3 | 721 | what the static family is · how you call it · aborting and its caveats |
| 09 Partial pre-rendering | 3 | 738 | the idea and the four APIs · calling them · the caveats that shape the design |
| 10 Document metadata | 2 | 520 | whether the tag moves · what each tag accepts |
| 11 Resource preloading | 2 | 523 | what the six APIs ask for · where you are allowed to ask |
| 13 Root error options | 2 | 476 | the client's three callbacks · the server's one |

The other twelve fit one file each without compression, and their lengths run **171 to 242** —
a genuine spread rather than a cluster under the cap. Topic 08's first chunk was written at
310 lines and split again on a second concept boundary rather than being trimmed.

**Every page is documentation-validated.** No sandbox, no console blocks; each `> Verified:`
line names its sources. Where a primary source does **not** settle something, the page says so
rather than guessing:

- [Topic 09 · 03](09-partial-prerendering/03-the-caveats.md) records **three places react.dev
  contradicts itself** about the resume APIs and resolves none of them.
- [Topic 10 · 01](10-document-metadata/01-hoisting.md) declines to say what happens to metadata
  rendered inside a Suspense boundary that resolves after `<head>` has flushed.
- [Topic 13 · 01](13-root-error-options/01-the-three-client-callbacks.md) does not assert that
  hydration mismatches are delivered to `onRecoverableError` — the reference implies it and
  never states it.
- [Topic 17](17-portals-and-ssr.md) reasons from `createPortal`'s parameter contract because
  **its reference never mentions server rendering at all**, and says which steps are inference.
- [Topic 12](12-flushsync.md) refuses to list the browser APIs that need `flushSync`, because
  the reference lists none.

## Gate

**Deliverable:** a server-rendered page that streams a shell immediately, fills two
independent Suspense boundaries as their data arrives, hydrates without a single mismatch
warning, and reports a thrown render error through `onUncaughtError`.

---

← Index: [React — Explanations](../README.md) ·
Prev: [Phase 10 — Server Components and Server Functions](../phase-10-server-components/README.md)
