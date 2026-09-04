---
title: "Streaming can be perfect on the server and arrive as one blocking response anyway, because five separate layers buffer by default and none of them report it"
sidebar_label: "02c · What silently defeats streaming"
sidebar_position: 106
description: "Reverse proxies, CDNs, serverless response streaming, compression, browser buffering and static export — the layers that collect your chunks before the user sees them, and how to verify the response is actually arriving progressively."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Next.js
> [Streaming guide](https://nextjs.org/docs/app/guides/streaming) (page metadata
> `version: 16.3.4`, `lastUpdated: 2026-08-25`) — its "What can affect streaming",
> "Verifying that streaming works" and Platform Support sections are quoted verbatim below —
> and the [`loading.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
> (`lastUpdated: 2026-06-08`) for the browser-buffering limit.
> Target: **Next.js 16.3.4**, App Router. Documentation-validated; **no sandbox run**.

**A streaming failure that nobody notices is the most expensive kind, because the code that
produced it is correct.** The boundaries are placed well, the shell is small, the server emits
chunks exactly when it should — and the user waits for the whole document anyway, because
something between the two collected the chunks first. Nothing errors. No log line appears. The
page is simply slower in production than it was in development, and the usual conclusion is that
the server is slow rather than that streaming is being undone in transit. The guide names the
layers responsible; each one buffers **by default**, which is why this is the normal state of an
un-configured deployment rather than an exotic misconfiguration.

## The general statement

> *"Any layer between your server and the client that buffers the response can diminish the
> benefits of streaming. The HTML may be fully generated progressively on the server, but if a
> proxy, CDN, or even the client itself collects all the chunks before rendering them, the user
> sees a single delayed response instead of progressive rendering."*

## The layers, in the order you should check them

### Reverse proxies

> *"Nginx and similar reverse proxies buffer responses by default."*

The documented fix is a header, applied from Next.js config so it travels with the app rather
than living only in the ops repo:

```js
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*{/}?',
        headers: [
          {
            key: 'X-Accel-Buffering',
            value: 'no',
          },
        ],
      },
    ]
  },
}
```

### CDNs

> *"Content Delivery Networks may buffer entire responses before forwarding them to the client.
> Check your CDN provider's documentation for streaming support. Some require specific
> configuration or plan tiers to pass through chunked responses."*

🔴 **"Plan tiers" is the part that turns this into a procurement question rather than a config
question.** A CDN that buffers is not misbehaving; it is doing what it was bought to do, and on
some products pass-through streaming is not available at all on the tier you are on.

### Serverless platforms

> *"Not all serverless environments support streaming. AWS Lambda, for example, requires
> response streaming mode to be explicitly enabled (it is not the default). Vercel supports
> streaming natively."*

This is the one that most often explains "it streams locally and not in production": the local
dev server has no Lambda in front of it.

### Compression

> *"Gzip and Brotli compression can buffer chunks internally before flushing, as the compression
> algorithm needs enough data to compress efficiently. This can add latency to the first visible
> chunk. If you notice streaming delays, check whether your compression layer is flushing
> aggressively enough."*

Note the shape of this one: it is a *latency* effect, not an all-or-nothing one. Streaming still
happens; the first visible chunk just arrives later than the server sent it.

### Clients

> *"Safari/WebKit buffers streaming responses until 1024 bytes have been received, so very small
> responses paint all at once instead of progressively. Real applications easily exceed this
> threshold (layouts, styles, scripts), so it only affects minimal demos or tiny Route Handler
> responses."*

And the tool most people reach for to check:

> *"Command-line tools like `curl` also buffer by default. The `-N` flag disables output
> buffering, but `curl` still relies on newline characters to flush lines to the terminal. A
> stream that sends chunks without newlines may appear to stall even with `-N`."*

⚠️ **So `curl` is a bad instrument for this measurement**, and a "stalled" `curl` is not evidence
of a stalled server.

### Static export

Streaming is **not supported** on a static export. The Platform Support table is explicit: Node.js
server — yes; Docker container — yes; **static export — no**; adapters — platform-specific. A
route that depends on streaming for its perceived performance cannot be exported.

## Verifying it actually streams

Two methods from the guide, in increasing order of trustworthiness.

**The Network tab.** *"In Chrome DevTools, select the document request and look at the "Timing"
breakdown. A long "Content Download" phase with an early "Time to First Byte" confirms the
response is streaming rather than arriving all at once."*

**A reader script**, which the guide prefers precisely because `curl` has its own buffering:

```js
// stream-observer.mjs
const res = await fetch(
  'https://streaming-demo.labs.vercel.dev/suspense-demo',
  {
    headers: { 'Accept-Encoding': 'identity' },
  }
)

const reader = res.body.getReader()
const decoder = new TextDecoder()
let i = 0
const start = Date.now()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  console.log(`\nchunk ${i++} (+${Date.now() - start}ms)\n`)
  console.log(decoder.decode(value))
}
```

> **Good to know** *(from the guide)*: *"The `Accept-Encoding: identity` header disables
> compression so chunks are not buffered by the compression layer."*

What the chunks contain is worth knowing when you read the output: the first carries the static
shell with `<template id="B:0">` placeholders standing in for each Suspense fallback, and each
later chunk carries a `<div hidden id="S:0">` with the resolved HTML plus a script that swaps it
into place.

## The crawler case, which is not a defect

Point the same script at the route with a bot user agent and streaming stops entirely — by
design. For HTML-limited bots the server *"waits for the full render and sends one fully formed
HTML document instead of streaming"*, so that `generateMetadata` has resolved and the metadata is
in the `<head>` of the initial HTML.

🔴 **With Cache Components there is a sharper edge here**, and it is the kind of bug that only
appears in a crawl report:

> *"Visitors and DOM-capable crawlers receive the shell without re-running that code, but an
> HTML-limited bot re-renders it dynamically, so a page that loads for a person can fail to
> render for a crawler. Make sure any data the shell relies on is also available at request
> time."*

## Gotchas

### It streams in development and blocks in production
**Symptom.** Skeletons appear instantly on `localhost` and the deployed page shows nothing until
the whole document is ready.
**Cause.** Dev has no proxy, no CDN and no serverless wrapper in front of it. Production has all
three, and each buffers by default.
**Fix.** Work down the list in order — `X-Accel-Buffering: no` for the proxy, the CDN's
pass-through setting or plan tier, and response streaming mode on the platform — verifying with
the reader script after each change rather than guessing which one it was.

### `curl` says it does not stream
**Symptom.** `curl -N https://…` prints nothing for several seconds and then everything at once,
which looks like conclusive proof.
**Cause.** `curl` buffers by default, and even `-N` flushes on newlines — HTML chunks may not
contain one where you need it.
**Fix.** Use the reader script with `Accept-Encoding: identity`, which observes the chunks
directly, or read the Timing breakdown in DevTools.

### First byte is fast and nothing paints for a second
**Symptom.** TTFB looks excellent in monitoring; users still stare at a blank page.
**Cause.** Compression is buffering the early chunks — the algorithm wants more data before it
flushes — so the shell is generated promptly and delivered late.
**Fix.** Confirm by re-measuring with `Accept-Encoding: identity`; if the delay disappears, the
compression layer's flush behaviour is the cause, not the render.

### A tiny Route Handler response appears not to stream in Safari
**Symptom.** A Server-Sent Events endpoint or a small chunked response arrives all at once in
Safari and progressively everywhere else.
**Cause.** WebKit buffers until 1024 bytes have arrived.
**Fix.** Nothing to fix in a real page — layouts, CSS and scripts pass the threshold easily. For
a deliberately small endpoint, pad the initial write or accept the behaviour; it is a client
limit, not a server one.

### Streaming disappears when the route is added to a static export
**Symptom.** A build that used to stream produces a fully-rendered page with no progressive
delivery, or fails outright.
**Cause.** Static export does not support streaming — the Platform Support table says so
directly.
**Fix.** Serve the route from a Node.js server, a container or a supporting adapter. Do not try
to recover streaming behaviour inside an export.

### A page that renders for users and fails for crawlers
**Symptom.** Search Console reports a render error on a URL that is demonstrably fine in a
browser.
**Cause.** With Cache Components, an HTML-limited bot skips the prerendered shell and re-renders
dynamically. If the shell depended on something only available at build time, that re-render has
nothing to work with.
**Fix.** Make sure any data the shell relies on is reachable at request time too, exactly as the
guide advises.

## Interview questions

**★ The page streams locally and blocks in production. Where do you look, in what order?**
At the layers that buffer by default: the reverse proxy (Nginx buffers unless
`X-Accel-Buffering: no` is set), the CDN (some pass chunked responses only on certain
configurations or plan tiers), and the serverless platform (AWS Lambda requires response
streaming mode to be enabled explicitly; it is not the default). Then compression, which delays
rather than prevents. Development has none of these in the path, which is why the difference
appears only after deploy.

**★ Why is `curl` a poor tool for confirming a response streams?**
It buffers by default, and `-N` only disables output buffering — it still flushes on newlines, so
a chunked HTML response without a newline at the right place looks stalled. The guide recommends
reading the body with a script instead, sending `Accept-Encoding: identity` so the compression
layer cannot buffer the chunks either.

**★ Does compression stop streaming?**
No — it delays it. Gzip and Brotli buffer internally because the algorithm needs enough input to
compress efficiently, which pushes back the first *visible* chunk. The response still arrives in
pieces; the user just waits longer for the first one.

**★ Why does a bot get a blocking response, and when does that turn into a bug?**
Deliberately: HTML-limited bots need metadata in the `<head>` of the initial HTML, so the server
waits for the full render and sends one complete document. It turns into a bug under Cache
Components, where the bot skips the prerendered shell and re-renders it dynamically — if the
shell depended on build-time-only data, the page renders for a person and fails for the crawler.

**★ Can a statically exported route stream?**
No. The Platform Support table lists static export as not supported, alongside Node.js server and
Docker as supported and adapters as platform-specific. Any route whose perceived performance
depends on streaming has to be served by a runtime.

**★ What does the first chunk of a streamed response actually contain?**
The static shell — everything that renders before any async work resolves: layouts, navigation,
the `<link>` and `<script>` tags, and a `<template id="B:n">` placeholder for each Suspense
fallback. Later chunks carry a `<div hidden id="S:n">` with the resolved HTML plus an inline
script that swaps it into place, which is why the swap happens before hydration completes.

---

← [02b · `notFound()` after the first chunk](02b-notfound-and-redirect-after-the-first-chunk.md) · **Next → [03 · Server Action error contracts](03-server-action-error-contracts-returning-typed-errors-vs.md)**
