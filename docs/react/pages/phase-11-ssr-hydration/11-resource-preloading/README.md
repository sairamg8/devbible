---
title: "Resource preloading"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`prefetchDNS`](https://react.dev/reference/react-dom/prefetchDNS),
> [`preconnect`](https://react.dev/reference/react-dom/preconnect),
> [`preload`](https://react.dev/reference/react-dom/preload),
> [`preinit`](https://react.dev/reference/react-dom/preinit),
> [`preloadModule`](https://react.dev/reference/react-dom/preloadModule) and
> [`preinitModule`](https://react.dev/reference/react-dom/preinitModule).
> No sandbox script backs this topic; claims are cited, not measured.

**Six `react-dom` functions that ask the browser to get ahead of you.** They take a URL, return
nothing, and differ only in how far down the loading pipeline they push — resolve the host,
open the connection, download the bytes, evaluate them — and therefore in how much you have to
know before calling.

They belong to this phase because of one caveat that all six share: **on the server they only
count if you call them during a render.** Anywhere else, the call is ignored without a word.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[The six APIs, and the ladder they form](01-the-six-apis.md)** | The four rungs plus the two module variants, what each asks the browser to do, why neither host-level hint helps your own origin, the `preload`-versus-`preinit` fork and what "evaluate" costs you, `precedence` on preinited stylesheets, and why all six return nothing |
| 02 | **[Calling them: the rule that decides whether the call counts](02-calling-them.md)** | The browser-anywhere / server-only-during-render rule and why it exists, render-time versus event-handler intent, de-duplication and the responsive-image exception, and how these relate to rendering a `<link>` instead |

## Why this is two files

**What each function asks for** is a comparison — six APIs on two axes, with a fork in the
middle that changes your page rather than just your cache. **Where you may call it** is a
single rule with a silent failure mode, and it is the half that makes these server-rendering
APIs rather than browser trivia.

Splitting there keeps the ladder readable, and gives the caveat the room it needs — it is the
thing most likely to make a correct-looking call do nothing at all.

## Where this connects

- **[Topic 10 · Document metadata](../10-document-metadata/README.md)** — the declarative form
  of the same hints. A rendered `<link rel="preload">` is hoisted into the head; these functions
  are what you use when markup cannot express the moment.
- **[Topic 15 · Stylesheets and `precedence`](../15-stylesheets-and-precedence.md)** —
  `preinit` with `as: 'style'` needs a `precedence`, for the same reason a hoisted stylesheet
  link does.
- **[Topic 06 · Streaming SSR](../06-streaming-ssr.md)** — hints emitted during a render go out
  with the shell, which is why calling them during render is what makes them early.
- **[Topic 08 · Prerendering](../08-prerendering/README.md)** — hints that land in a prerendered
  prelude are hints paid for once, at build time.

---

← Index: [Phase 11](../README.md) ·
Prev: [Document metadata (19)](../10-document-metadata/README.md) ·
Next → [The six APIs, and the ladder they form](01-the-six-apis.md)
