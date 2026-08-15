---
title: "Root error options (19)"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`createRoot`](https://react.dev/reference/react-dom/client/createRoot),
> [`hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot) and
> [`renderToPipeableStream`](https://react.dev/reference/react-dom/server/renderToPipeableStream).
> No sandbox script backs this topic; claims are cited, not measured.

**Four callbacks — three on the client root, one on the server renderer — and between them they
carry every error React knows about.** React 19 added the client three; they attach to the root
rather than to a component, which is what finally makes "report every error to one place"
expressible.

The client splits errors by who handled them. The server does not split at all, because it has
one response to produce. Understanding why the two shapes differ is most of the topic.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[The three client callbacks](01-the-three-client-callbacks.md)** | `onCaughtError` / `onUncaughtError` / `onRecoverableError` as a partition, why they are not a replacement for error boundaries, `errorInfo.componentStack` and `error.cause`, why recoverable errors are still bugs, and what overriding the default console logging costs you |
| 02 | **[The server side: `onError`](02-the-server-side.md)** | One callback for every server error, the shell-versus-outside-the-shell distinction that decides whether the request even failed, the status-code deadline, and how a single bug surfaces twice — once on the server and once again after hydration |

## Why this is two files

They are two different systems that happen to share a subject. The client callbacks are about
**a live tree with boundaries in it**: who caught what, and what React silently repaired. The
server callback is about **a response being streamed**: whether anything meaningful has been sent
yet, and whether you can still change the status code.

The join between them — an error outside the shell being retried on the client — is the last
section of chunk 02, and it only makes sense once both halves are in place.

## Where this connects

- **[Topic 02 · Hydration mismatches](../02-hydration-mismatches.md)** — the canonical
  recoverable error, and the reason `onRecoverableError` is worth wiring up in production.
- **[Topic 06 · Streaming SSR](../06-streaming-ssr.md)** — the shell, `onShellReady` and
  `onShellError`, which is the machinery `onError` sits beside.
- **[Topic 08 · Prerendering](../08-prerendering/README.md)** — `onError` on the static
  renderers, where a failure means a build artifact rather than a request.
- **[Topic 04 · `hydrateRoot`](../04-hydrateroot.md)** — where the client root's options are
  passed, and what hydration is doing when it recovers.

---

← Index: [Phase 11](../README.md) ·
Prev: [`flushSync`](../12-flushsync.md) ·
Next → [The three client callbacks](01-the-three-client-callbacks.md)
