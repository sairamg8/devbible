---
title: "The third renderer family"
sidebar_label: "01 · The third renderer family"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`prerender`](https://react.dev/reference/react-dom/static/prerender) and
> [`prerenderToNodeStream`](https://react.dev/reference/react-dom/static/prerenderToNodeStream)
> (definition, environment notes, returns, and both "when should I use this" sections), with
> [`<Suspense>`](https://react.dev/reference/react/Suspense) for what activates a boundary.
> No sandbox script backs this page; claims are cited, not measured.

**`react-dom/static` is a third family of renderers, and its defining property is that it
waits.** Everything in [topic 03](../03-the-server-renderers.md) either streamed as it went
or gave up on streaming entirely. These two do neither: they render the whole tree, wait for
every Suspense boundary to resolve, and hand you finished HTML.

## Where they sit

React ships **five** renderers across three entry points, and the grid is the fastest way to
stop confusing them:

| | Node.js streams | Web streams | Neither |
|---|---|---|---|
| **`react-dom/server` — stream as you go** | `renderToPipeableStream` | `renderToReadableStream` | — |
| **`react-dom/server` — one shot, no streaming** | — | — | `renderToString` |
| **`react-dom/static` — wait for everything** | **`prerenderToNodeStream`** | **`prerender`** | — |

The environment split is exactly the one from topic 03 and is stated the same way in both
references:

> **This API is specific to Node.js.** Environments with Web Streams, like Deno and modern
> edge runtimes, should use `prerender` instead.

and, from the other side:

> This API depends on Web Streams. For Node.js, use `prerenderToNodeStream` instead.

So the choice between the two static APIs is **not** a feature decision. It is the same
question as `renderToPipeableStream` vs `renderToReadableStream` — which stream type your
runtime speaks. Everything else in this topic is true of both.

## The signature

```js
const {prelude, postponed} = await prerender(reactNode, options?);
const {prelude, postponed} = await prerenderToNodeStream(reactNode, options?);
```

Both are **async**, and that is the first real difference from `react-dom/server`.
`renderToPipeableStream` returns synchronously with a control object and calls you back on
`onShellReady`; `prerender` gives you a Promise that does not settle until the work is done.

What resolves:

- **`prelude`** — a stream of HTML. A Web Stream from `prerender`, a Node.js Stream from
  `prerenderToNodeStream`. *"You can use this stream to send a response in chunks, or you can
  read the entire stream into a string."*
- **`postponed`** — *"a JSON-serializeable, opaque object that can be passed to `resume` if
  `prerender` did not finish. Otherwise `null` indicating that the `prelude` contains all the
  content and no resume is necessary."*

**If rendering fails, the Promise is rejected** — and `prerenderToNodeStream`'s reference
points that case at the same recovery as the server renderers: use it to output a fallback
shell.

🔴 **`postponed` is `null` on the happy path.** A complete prerender needs no resume, and
that is how you tell the two cases apart in code. The non-null case is
[chunk 03](03-aborting-errors-caveats.md) and, beyond it,
[topic 09](../09-partial-prerendering.md); nothing else in this chunk depends on it.

## The defining property: it waits for all data

Stated in both references, and this is the sentence the whole topic hangs on:

> **Unlike `renderToString`, `prerender` waits for all data to load before resolving.** This
> makes it suitable for generating static HTML for a full page, including data that needs to
> be fetched using Suspense.

Compare the three behaviours honestly:

| | `renderToString` | `renderToPipeableStream` | `prerenderToNodeStream` |
|---|---|---|---|
| Suspense boundary that has not resolved | emits the **fallback**, done | emits the fallback, then **streams the real content in** | **waits** for it, emits the real content |
| Result arrives | immediately | shell first, rest over time | once, when everything is finished |
| Built for | legacy / non-streaming hosts | a live request | **static generation ahead of time** |
| Streams more content as it loads | no | yes | **no** |

`prerender` is not "streaming with extra steps" and the reference is blunt about it:

> The `prerender` response waits for the entire app to finish rendering, including waiting
> for all Suspense boundaries to resolve, before resolving. It is designed for static site
> generation (SSG) ahead of time and does **not support streaming more content as it loads**.
> To stream content as it loads, use `renderToReadableStream` instead.

The `prelude` being a *stream* is about how you consume the bytes, not about when the content
becomes available. All of it is already decided by the time the Promise resolves.

## What counts as "all data"

The same qualifier that governs streaming SSR governs this, and it is the one people get
wrong:

> Only data read from a source that **activates a Suspense boundary**, such as a Promise read
> with `use`, will suspend during rendering. **Suspense does not detect data fetched inside
> an Effect or event handler.**

So "waits for all data" means *waits for everything that suspends*. A component that fetches
in `useEffect` does not suspend, is not waited for, and produces the same empty-state HTML it
would have produced under `renderToString` — and Effects do not run on the server at all, so
the fetch never even starts. If your prerendered pages are coming out empty, this is almost
always why, and no renderer option fixes it. The data has to move to a source that suspends.

## Gotchas

**Symptom:** prerendered pages ship with empty lists and loading placeholders baked in.
**Cause:** the data is fetched in an Effect. Effects do not run on the server, and *"Suspense
does not detect data fetched inside an Effect or event handler"* — so there is nothing for
`prerender` to wait for.
**Fix:** read the data from a source that activates a boundary, such as a Promise read with
`use`. No renderer option substitutes for this.

**Symptom:** `prerender` is used for a live request and the response is slow.
**Cause:** it waits for the entire app, including every Suspense boundary, before resolving.
That is the documented design — *"designed for static site generation (SSG) ahead of time"*.
**Fix:** use `renderToPipeableStream` / `renderToReadableStream` for per-request rendering
([topic 06](../06-streaming-ssr.md)). Keep the static APIs for build time.

**Symptom:** `prerender is not a function`, or an import error at build time in Node.
**Cause:** `prerender` depends on Web Streams; Node's entry point is
`prerenderToNodeStream`. Both live in `react-dom/static`, not `react-dom/server`.
**Fix:** pick the one that matches the runtime — Node gets `prerenderToNodeStream`, Deno and
modern edge runtimes get `prerender`.

**Symptom:** the prelude is being awaited chunk by chunk in the hope of getting content
earlier.
**Cause:** the stream is a consumption detail. The Promise has already waited for the entire
app before handing it over.
**Fix:** if you need content earlier, you need a streaming renderer, not a different way of
reading this one.

## Interview questions

**★ What does `prerender` do that `renderToString` does not?**
It waits. `renderToString` emits the fallback for any Suspense boundary that has not resolved
and returns immediately; `prerender` *"waits for all data to load before resolving"*, so the
finished HTML contains the real content. That is what makes it usable for static generation
of a page whose data is fetched through Suspense.

**★ Then how does it differ from `renderToPipeableStream`, which also resolves boundaries?**
By *when* the content is available. The streaming renderers send a shell immediately and push
each boundary's HTML as it resolves — good for a live request. `prerender` resolves once,
after everything is finished, and explicitly *"does not support streaming more content as it
loads"*. Streaming is for a request; prerendering is for a build.

**★ `prelude` is a stream. Doesn't that make it streaming?**
No — the stream is how you consume the bytes, not when the content was decided. The Promise
does not resolve until the whole app has rendered, so everything in that stream is already
finalised. You can pipe it to a response or read it into a string; neither gets you content
earlier.

**★ Which of the two static APIs should you use?**
Whichever matches your runtime's stream type. `prerenderToNodeStream` is *"specific to
Node.js"*; environments with Web Streams — *"Deno and modern edge runtimes"* — use
`prerender`. It is the same split as `renderToPipeableStream` vs `renderToReadableStream`,
and it is not a feature decision.

**★ You prerendered the site and every page shows a spinner. What went wrong?**
The data is almost certainly being fetched in an Effect. Effects never run during server
rendering, and Suspense only detects sources that activate a boundary, so `prerender` has
nothing to wait for and captures the loading state as the final HTML. The fix is in the data
layer, not the renderer.

**★ What is `postponed` and when is it `null`?**
It is an opaque, JSON-serializeable handle on work the prerender did not finish, meant to be
passed to a resume API. It is `null` when the render completed — which is the ordinary case,
and the signal that the `prelude` already contains everything.

---

Index: [08 · Prerendering](README.md) ·
Next → [Calling them](02-calling-them.md)
