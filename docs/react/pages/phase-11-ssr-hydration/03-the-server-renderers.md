---
title: "The three server renderers"
sidebar_label: "03 · The server renderers"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`renderToString`](https://react.dev/reference/react-dom/server/renderToString),
> [`renderToPipeableStream`](https://react.dev/reference/react-dom/server/renderToPipeableStream)
> and
> [`renderToReadableStream`](https://react.dev/reference/react-dom/server/renderToReadableStream)
> — signatures, options, returns and every caveat.
> No sandbox script backs this page; claims are cited, not measured.

**Two questions decide which one you use: Node streams or Web streams, and do you need
streaming at all.** The second question has a documented answer for almost everybody, and it
is *yes*.

## The three

| | `renderToPipeableStream` | `renderToReadableStream` | `renderToString` |
|---|---|---|---|
| Stream type | **Node.js Writable** | **Web ReadableStream** | none — a string |
| Runtime | Node.js | Deno, edge runtimes | anywhere |
| Streams Suspense | ✅ | ✅ | ✖ |
| Waits for data | optionally (`onAllReady`) | optionally (`await stream.allReady`) | **never** |
| Shell ready | `onShellReady` callback | the returned Promise resolving | — |
| Abort | `abort()` | `signal` (an `AbortSignal`) | — |

> **This API is specific to Node.js. Environments with Web Streams, like Deno and modern edge
> runtimes, should use `renderToReadableStream` instead.**
>
> **This API depends on Web Streams. For Node.js, use `renderToPipeableStream` instead.**

Each names the other. **The split is your runtime, not your preference** — and the two are
the same feature with different plumbing, so everything in
[topic 06](06-streaming-ssr.md) applies to both.

## 🔴 `renderToString` cannot stream Suspense

The caveat that decides most of this topic:

> **`renderToString` does not support streaming or waiting for data.**
>
> **`renderToString` has limited Suspense support. If a component suspends, `renderToString`
> immediately sends its fallback as HTML.**

Read the second sentence carefully. It does not error and it does not wait — it **ships the
fallback**. So a page whose data loads through Suspense renders to a document full of
spinners, and every one of them is filled in only after JavaScript loads and the client
re-fetches.

**That is worse than it sounds for SEO and for slow connections**: the server did work,
produced HTML, and the HTML contains none of the content. React's recommendation is
unambiguous:

> **When possible, we recommend using these fully-featured alternatives: If you use Node.js,
> use `renderToPipeableStream`. If you use Deno or a modern edge runtime with Web Streams,
> use `renderToReadableStream`.**

`renderToString` remains reasonable for markup with no async data at all — and for that case
[`renderToStaticMarkup`](14-rendertostaticmarkup.md) is often the better fit, since it also
drops the hydration markers.

> **`renderToString` works in the browser, but using it in the client code is not
> recommended.**

## The shape of each API

### Node — callbacks

```js
const { pipe, abort } = renderToPipeableStream(<App />, {
  bootstrapScripts: ['/main.js'],
  onShellReady() {
    response.statusCode = 200;
    response.setHeader('content-type', 'text/html');
    pipe(response);
  },
  onShellError(error) {
    response.statusCode = 500;
    response.setHeader('content-type', 'text/html');
    response.send('<h1>Something went wrong</h1>');
  },
  onError(error) { console.error(error); logServerCrashReport(error); },
});
```

Four callbacks worth knowing apart:

| Callback | Fires |
|---|---|
| `onShellReady` | *"right after the initial shell has been rendered"* — usually where you `pipe` |
| `onShellError` | shell failed; *"No bytes were emitted from the stream yet"* |
| `onAllReady` | *"when all rendering is complete"* — for crawlers and static generation |
| `onError` | *"whenever there is a server error, whether recoverable or not"* |

### Web — a promise

```js
const stream = await renderToReadableStream(<App />, {
  bootstrapScripts: ['/main.js'],
  signal: controller.signal,
  onError(error) { console.error(error); logServerCrashReport(error); },
});
```

> If rendering the shell is successful, **that Promise will resolve to a Readable Web
> Stream.** If rendering the shell fails, **the Promise will be rejected.**

So the shell-ready/shell-error split is expressed as resolve/reject rather than two
callbacks, and "all ready" is a property on the stream:

> **`allReady`: A Promise that resolves when all rendering is complete… You can `await
> stream.allReady` before returning a response for crawlers and static generation. If you do
> that, you won't get any progressive loading. The stream will contain the final HTML.**

**Same four states, two idioms.** Recognising that is most of what "porting between runtimes"
means here.

## `onError` is not optional in practice

> **By default, this only calls `console.error`. If you override it to log crash reports,
> make sure that you still call `console.error`.**

Two things in one sentence: there *is* a default, and overriding it silently removes your
console output unless you put it back. The docs repeat the warning in the example — *"If you
provide a custom `onError` implementation, don't forget to also log errors to the console."*

## Aborting

Both streaming renderers can give up:

```js
// Node
setTimeout(() => abort(), 10000);

// Web
setTimeout(() => controller.abort(), 10000);
```

> **React will flush the remaining loading fallbacks as HTML, and will attempt to render the
> rest on the client.**

A timeout is therefore a **degradation**, not a failure: the user gets the shell plus
fallbacks, and the browser finishes the job. Worth wiring up deliberately rather than letting
a slow query hold a connection open.

## What suspends, and what does not

Identical on both, and it is the same sentence Phase 8 established:

> **Only data read from a source that activates a Suspense boundary, such as a Promise read
> with `use`, will suspend during rendering. Suspense does not detect data fetched inside an
> Effect or event handler.**

🔴 **An effect-based fetch does not suspend and does not run on the server at all.** A
component that loads its data in `useEffect` server-renders in its empty state, every time,
no matter which renderer you chose. Streaming cannot help code that never told the server it
was waiting ([Phase 8 · 03](../phase-8-concurrent-suspense/03-what-can-suspend.md)).

## Gotchas

**Symptom:** the server-rendered HTML is full of fallbacks.
**Cause:** `renderToString` immediately emits a suspended component's fallback.
**Fix:** use a streaming renderer, or `prerender` if you want to wait for everything.

**Symptom:** `renderToPipeableStream` is not a function in an edge runtime.
**Cause:** it is Node-specific.
**Fix:** `renderToReadableStream` there — the docs cross-reference each other.

**Symptom:** errors stopped appearing in the server logs.
**Cause:** a custom `onError` replaced the default `console.error`.
**Fix:** call `console.error` as well.

**Symptom:** the status code cannot be changed once content is flowing.
**Cause:** documented — *"once you start streaming, you can no longer set the response status
code."*
**Fix:** set it in `onShellReady` / before returning the response.

**Symptom:** a slow query holds the response open indefinitely.
**Cause:** no abort configured.
**Fix:** `abort()` or an `AbortSignal` on a timeout; React flushes fallbacks and the client
finishes.

**Symptom:** data fetched in an effect never appears in the server HTML.
**Cause:** Suspense does not detect data fetched inside an Effect, and effects do not run on
the server.
**Fix:** move it to a source that activates a boundary.

## Interview questions

**★ Which renderer would you use, and why?**
`renderToPipeableStream` on Node, `renderToReadableStream` on Deno or an edge runtime — the
split is the stream type, and each API's caveats name the other as the alternative.
`renderToString` only for markup with no async data, because it does not support streaming or
waiting for data.

**★ What actually happens when a component suspends under `renderToString`?**
It **immediately sends the fallback as HTML**. It does not wait and does not error — so the
document ships full of spinners and the real content only appears after JavaScript loads.
That is why the docs recommend the streaming APIs "when possible".

**★ How do the Node and Web APIs express the same states?**
Node uses callbacks — `onShellReady`, `onShellError`, `onAllReady`, `onError` — and returns
`{ pipe, abort }`. Web returns a Promise that **resolves** when the shell is ready and
**rejects** when it fails, with `allReady` as a property on the stream and an `AbortSignal`
passed in as `signal`. Same four states, two idioms.

**What happens when you abort a streaming render?**
React flushes the remaining loading fallbacks as HTML and attempts to render the rest on the
client. So a timeout degrades to a client-rendered page rather than failing — which makes an
abort on a timer a reasonable default rather than a last resort.

**What is the trap with a custom `onError`?**
The default implementation is `console.error`, and overriding it removes that unless you call
it yourself. The docs say so twice. Teams lose their server error logs to this and only
notice during an incident.

**Does streaming help a component that fetches in `useEffect`?**
No. Suspense does not detect data fetched inside an Effect, and effects do not run during
server rendering at all — the component server-renders in its empty state regardless of
renderer. Streaming can only defer work that told the server it was waiting.

---

← Prev: [Hydration mismatches](02-hydration-mismatches.md) ·
Index: [Phase 11](README.md) ·
Next → [`hydrateRoot`](04-hydrateroot.md)
