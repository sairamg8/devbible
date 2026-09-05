---
title: "SSE almost never fails with an error — it fails by arriving late, arriving all at once, or not arriving, and every one of those is a layer between your handler and the browser deciding to hold the bytes"
sidebar_label: "03h · What silently breaks SSE"
sidebar_position: 38
description: "Symptom-first: proxy and CDN buffering, X-Accel-Buffering, gzip and Brotli holding chunks, no-transform, block buffering, Safari's 1024-byte threshold, curl -N, platforms that require streaming to be enabled, and why Content-Length on a stream is proof of buffering."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the Next.js [Streaming guide](https://nextjs.org/docs/app/guides/streaming)
> §"What can affect streaming", [Self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
> §"Streaming and Suspense" and [Deploying to Platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms);
> the WHATWG HTML Living Standard [§9.2.5 and §9.2.7 Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html);
> MDN [Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events).
> Documentation-verified, **no sandbox run, no timings, no captured traffic**.
> Target: **Next.js 16.3.4** · Node **24.20.0**.

**An SSE endpoint that is wrong almost never returns an error. It returns `200`, the connection opens, `readyState` goes to `OPEN`, and then the events are late, or bunched, or absent. Every one of those symptoms has the same shape of cause: something between your `controller.enqueue()` and the browser's parser decided to hold bytes rather than forward them, and nothing in the stack considers that a fault. The Next.js documentation states the problem in one sentence — *"Any layer between your server and the client that buffers the response can diminish the benefits of streaming"* — and the whole of this page is that sentence expanded into the layers that actually do it, indexed by what you see. Connection *lifetime* — streams that die after thirty seconds, or five minutes, or on the sixth tab — is a different failure family and lives in [03ha](03ha-connection-lifetime-limits-and-the-cost-of-an-open-stream.md).**

## The symptom index

| What you see | Almost always | Section |
|---|---|---|
| Nothing for a long time, then every event at once | A proxy or CDN buffering the whole response | Buffering |
| First event a few seconds late, then fine | Compression holding chunks until it has enough to compress | Compression |
| Events arrive in bursts of several | Block buffering somewhere in the path | Buffering |
| Works in `next dev`, dead in production | A hop that exists only in production | Buffering |
| Works with one CDN configuration, not another | Streaming not enabled or not supported on that tier | Platform |
| `curl` shows nothing but the browser works | `curl`'s own output buffering | Tooling |
| Safari shows nothing until the response is large | The 1024-byte paint threshold | Browser |
| The response has a `Content-Length` | Something built the whole body before sending it | Diagnosis |
| A static build serves the route and never runs it | `output: 'export'`, or a prerendered `GET` handler | Platform |

Work down that table before you read your own handler. The handler is usually right.

## Buffering: the default behaviour of almost everything

The Next.js Streaming guide is unambiguous about the mechanism:

> *"Any layer between your server and the client that buffers the response can diminish the benefits of streaming. The HTML may be fully generated progressively on the server, but if a proxy, CDN, or even the client itself collects all the chunks before rendering them, the user sees a single delayed response instead of progressive rendering."*

And about the most common culprit:

> *"Nginx and similar reverse proxies buffer responses by default. Disable buffering by setting the `X-Accel-Buffering` header to `no`"*

That header is not an nginx configuration directive you set on the proxy — it is a **response header your application sends**, which nginx reads and obeys. That is what makes it usable from a Next.js app that does not own the proxy config. The guide's own snippet applies it globally:

```js
// next.config.js
module.exports = {
  async headers() {
    return [
      { source: '/:path*{/}?', headers: [{ key: 'X-Accel-Buffering', value: 'no' }] },
    ]
  },
}
```

The self-hosting guide repeats the requirement for anyone running behind their own proxy:

> *"The Next.js App Router supports streaming responses when self-hosting. If you are using nginx or a similar proxy, you will need to configure it to disable buffering to enable streaming."*

Setting it per route is usually better than globally — you rarely want to disable proxy buffering for your static assets:

```ts
return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  },
})
```

MDN's own reference server for server-sent events sets the same header, which is a good sign that it is not an nginx curiosity but the accepted way to say *do not hold my bytes*.

### The CDN is a second, independent buffer

> *"Content Delivery Networks may buffer entire responses before forwarding them to the client. Check your CDN provider's documentation for streaming support. Some require specific configuration or plan tiers to pass through chunked responses."*

Two things follow. First, a CDN that buffers cannot be fixed from your handler — no header makes a proxy stream if it does not implement streaming, and *"specific configuration or plan tiers"* is the documentation telling you this may be a billing question rather than an engineering one. Second, and more usefully: an SSE endpoint has nothing to gain from a CDN. Route it around one.

### Block buffering delays events even when nothing is "broken"

The specification anticipated this and says exactly what safe buffering looks like:

> *"Since connections established to remote servers for such resources are expected to be long-lived, UAs should ensure that appropriate buffering is used. In particular, while line buffering with lines are defined to end with a single U+000A LINE FEED (LF) character is safe, block buffering or line buffering with different expected line endings can cause delays in event dispatch."*

That is the mechanism behind "events arrive in bursts of four": something is filling a fixed-size block before flushing. It is not an error state and nothing logs it. The authoring notes add a related warning:

> *"Authors are also cautioned that HTTP chunking can have unexpected negative effects on the reliability of this protocol, in particular if the chunking is done by a different layer unaware of the timing requirements."*

## Compression: the buffer nobody remembers is there

> *"Gzip and Brotli compression can buffer chunks internally before flushing, as the compression algorithm needs enough data to compress efficiently. This can add latency to the first visible chunk."*

This is the cause of the most confusing variant — the stream works, but the *first* event is late and everything after it is fine. The compressor is holding bytes until its window is worth flushing, and SSE frames are small. The guide names the client-side lever:

> *"The `Accept-Encoding: identity` header disables compression so chunks are not buffered by the compression layer."*

That is useful for diagnosis, but you cannot make every browser send it. On the response side, `no-transform` is the standard way to tell intermediaries not to re-encode:

```ts
'Cache-Control': 'no-cache, no-transform',
```

⚠️ Be precise about what that does and does not guarantee. `no-transform` instructs caches and proxies not to alter the payload; whether a particular CDN or reverse proxy honours it for compression is that product's behaviour, and the Next.js documentation does not enumerate it. **I could not confirm from a primary source that any specific proxy will stop compressing on `no-transform` alone.** Treat it as necessary, not sufficient: send it, and verify against the deployment you actually have.

The reliable diagnostic is the other direction — if the response carries a `Content-Encoding`, a compressor is in the path, and if the events are bunched, that compressor is your suspect.

## The client and the tooling buffer too

Two entries here exist purely to stop you debugging the wrong layer.

> *"Safari/WebKit buffers streaming responses until 1024 bytes have been received, so very small responses paint all at once instead of progressively. Real applications easily exceed this threshold (layouts, styles, scripts), so it only affects minimal demos or tiny Route Handler responses."*

An SSE endpoint is exactly the "tiny Route Handler response" case, so a minimal test page can look broken in Safari and correct everywhere else. Padding the opening of the stream with a comment makes the symptom go away and is harmless — a colon line is ignored by the parser:

```ts
// One 2 KiB comment, sent once at connect, defeats a small-response paint threshold.
controller.enqueue(encoder.encode(': ' + ' '.repeat(2048) + '\n\n'))
```

And for the command line:

> *"Command-line tools like `curl` also buffer by default. The `-N` flag disables output buffering, but `curl` still relies on newline characters to flush lines to the terminal. A stream that sends chunks without newlines may appear to stall even with `-N`."*

SSE frames always end in newlines, so `curl -N` is a legitimate probe for an SSE endpoint — which makes it the cheapest way to decide whether the problem is in the browser or before it.

## Platform: not every target can stream at all

> *"Not all serverless environments support streaming. AWS Lambda, for example, requires response streaming mode to be explicitly enabled (it is not the default). Vercel supports streaming natively."*

And the baseline requirement, from the deployment-targets page:

> *"**Streaming Required** means the platform must support chunked transfer encoding or HTTP/2 streaming and must not buffer the response before sending it to the client."*

Note the phrasing: *must not buffer*, not *should support streaming*. A platform can technically forward a chunked response and still be useless for SSE if it accumulates it first.

The absolute case is a static export. `output: 'export'` produces files; there is no invocation to hold a connection, so an SSE route is not "slow" there, it does not exist. The same class of mistake in a smaller form is a `GET` Route Handler that got prerendered at build time — covered in [03d](03d-writing-the-sse-route-handler.md), fixed with `await connection()`.

## The one diagnostic that settles the argument

Send a comment as the very first thing in the stream, before any authorization lookup, database connection or subscription:

```ts
const stream = new ReadableStream<Uint8Array>({
  start(controller) {
    controller.enqueue(encoder.encode(': open\n\n')) // synchronous, first
    void beginProducing(controller)
  },
})
```

Then the diagnosis is binary. If that comment does not reach the client within a network round trip, **nothing you write in the handler matters** — a layer in the path is buffering. If it arrives instantly and your real events do not, the problem is your producer: a slow `await` before the first enqueue, a subscription that never fires, or back-pressure per [03e](03e-pull-sources-and-back-pressure.md).

The second diagnostic is the response headers. A response you intended to stream should have no `Content-Length` — a length can only be computed by something that has the entire body, so its presence is direct evidence that a hop buffered the response to completion before forwarding it.

## Gotchas

**★ Symptom: the endpoint works perfectly in `next dev` and delivers nothing in production until it closes.** Cause: `next dev` is one process talking straight to your browser; production inserts a reverse proxy, a CDN and a compression layer, and at least one of them buffers by default. Fix: `X-Accel-Buffering: no` and `Cache-Control: no-cache, no-transform` on the response, and route the endpoint around the CDN:

```ts
headers: {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
}
```

**★ Symptom: you set `X-Accel-Buffering: no` and nothing changed.** Cause: the buffering layer is not nginx. That header is an nginx convention that some proxies honour and many do not; a CDN that buffers entire responses, or a platform that does not support streaming at all, ignores it completely. Fix: identify the hop. Test the origin directly with `curl -N`, then through each layer in turn — the first hop where the comment stops arriving instantly is the one holding your bytes.

**★ Symptom: the first event is seconds late and every event after it is instant.** Cause: compression. Gzip and Brotli hold bytes until they have enough to compress efficiently, and the opening frames of an SSE stream are tiny. Fix: send `no-transform`, and confirm by checking whether the response carries a `Content-Encoding` at all. As a diagnostic only, a client can ask for no compression:

```bash
curl -N -H 'Accept-Encoding: identity' -H 'Accept: text/event-stream' https://example.com/api/events
```

**★ Symptom: events arrive four at a time even though the server sends them one a second.** Cause: block buffering in an intermediary — the spec's *"block buffering or line buffering with different expected line endings can cause delays in event dispatch"*. Fix: this cannot be fixed from the handler; it is a property of the hop. Reduce the number of hops, or increase the size of what you send so a block fills quickly. If neither is possible, accept the batching and design the UI for it rather than pretending it is real-time.

**★ Symptom: a demo works in Chrome and shows nothing in Safari.** Cause: the 1024-byte paint threshold on small responses. Fix: pad the opening of the stream with a comment line, which the parser ignores by definition — *"A colon as the first character of a line is in essence a comment, and is ignored."* Real applications rarely hit this; minimal SSE endpoints hit it constantly.

**★ Symptom: `curl` shows nothing and you conclude the server is broken.** Cause: `curl` buffers its own output. Fix: `curl -N`, and remember it still flushes on newlines — which is fine for SSE, and is why `curl -N` is a trustworthy probe here and not for a stream of raw tokens without line breaks.

**★ Symptom: the response has a `Content-Length` header and arrives complete.** Cause: something computed the whole body, which is only possible after collecting it. That is a buffered response wearing a streaming response's `Content-Type`. Fix: find the hop that added it. It is upstream of the client and downstream of your handler, and no change to your `ReadableStream` will affect it.

**★ Symptom: the route returns a cached response and your handler never runs.** Cause: a `GET` Route Handler that was prerenderable, or a CDN caching a `200` it was allowed to cache. Fix: `await connection()` as the first line of the handler, and `Cache-Control: no-cache` on the response so no intermediary stores it. A cached event stream is a uniquely confusing failure, because it replays real events forever.

**★ Symptom: streaming works on one deployment target and not on another with identical code.** Cause: the platform. Some serverless runtimes require response streaming to be enabled explicitly and do not do it by default; some CDNs pass chunked responses only on certain configurations or plan tiers. Fix: check the target's documentation for streaming support before debugging your code, and treat *"must not buffer the response before sending it to the client"* as the acceptance criterion rather than "supports streaming".

**★ Symptom: an SSE route in a project with `output: 'export'`.** Cause: a static export has no server to hold a connection. Fix: there is no fix at that setting — the route needs a runtime. This is worth catching in review rather than in staging, because the failure looks like a 404 rather than like a streaming problem.

**★ Symptom: the stream is fine until you put it behind a new WAF or API gateway.** Cause: a new hop, with its own buffering defaults, added by a team that was not thinking about long-lived responses. Fix: re-run the first-comment diagnostic through the new hop before blaming the application, and add the SSE endpoint to whatever set of paths that layer treats as pass-through.

## Interview questions

**★ An SSE endpoint "works locally and hangs in production". What is your first move?**
Send a comment line as the very first bytes of the stream, before any awaited work, and see whether it arrives immediately. That single probe splits the problem in half. If the comment does not arrive, the handler is irrelevant — something in the path is buffering, and you walk the hops from the origin outward with `curl -N` until you find the first one that swallows it. If the comment arrives instantly but your real events do not, the handler is at fault: a slow `await` before the first enqueue, a subscription that never fires, or a stream whose queue is full. Reading your own code first is the common mistake, because the code is the only part you can see.

**★ Why is `X-Accel-Buffering: no` a response header rather than a proxy configuration setting?**
Because it is designed to be set by an application that does not control the proxy. nginx reads it from the upstream response and disables its own buffering for that response, which means a Next.js app can opt a single route out of buffering without anyone touching the proxy config — the Next.js docs give exactly that recipe. The corollary is that it only works on proxies that implement the convention. A CDN that buffers entire responses, or a serverless platform that does not support streaming, will not do anything with it, which is why "I set the header and nothing changed" means "the buffering hop is not nginx" rather than "the header is wrong".

**★ How can compression break a stream that is otherwise correct?**
A compressor is a buffer by construction: gzip and Brotli need a window of input before they can emit output that is worth emitting, so they hold small writes rather than flushing each one. SSE frames are small, so the opening of the stream is exactly the worst case — the first event waits for the compressor's window while later events, arriving into a warm stream, pass through quickly. That produces the signature symptom of a slow first event and a fine stream afterwards. The response-side lever is `no-transform`; the diagnostic lever is a request with `Accept-Encoding: identity`, which removes the compressor from the path entirely so you can see whether it was the cause.

**★ Why does an SSE endpoint have nothing to gain from a CDN, and what does it lose?**
It gains nothing because there is nothing to cache: every connection is a distinct, personalised, open-ended response, so there is no shared artifact and no cache hit to serve. It loses because a CDN is one more hop with its own buffering behaviour, and the documentation is explicit that CDNs *"may buffer entire responses before forwarding them to the client"* and that streaming support can depend on configuration or plan tier. So the CDN adds latency risk and a class of failure you cannot fix from the handler, in exchange for nothing. Route SSE endpoints directly at the origin.

**★ What does a `Content-Length` header on a streamed response tell you?**
That the response was not streamed. A length can only be known after the entire body exists, so its presence proves that some hop collected the whole thing before forwarding it — which for an open-ended SSE stream means the connection was allowed to complete before anything was delivered. It is the single most decisive piece of evidence available, and it is visible in any network inspector. The corollary is a useful sanity check: a correctly streamed SSE response carries no `Content-Length` and, over HTTP/1.1, will be chunked.

**★ The deployment requirements say a platform must "not buffer the response before sending it to the client". Why is that phrased as a prohibition rather than as a feature?**
Because supporting chunked transfer encoding and actually forwarding chunks promptly are different properties, and only the second one matters. A platform can accept a chunked response from your handler, accumulate it, and emit a perfectly valid chunked response to the client at the end — every protocol box ticked, streaming entirely absent. Phrasing the requirement as "must not buffer" makes the acceptance criterion observable from the client: does the first byte arrive before the last one is produced. That is the only question, and it is why a checklist that says "supports streaming" is not sufficient evidence that a target will work.

---

← [03ga · Owning reconnection](03ga-owning-reconnection-when-you-own-the-client.md) · [Chapter 15 overview](01-explanation.md) · Next → [03ha · Connection lifetime and the cost of an open stream](03ha-connection-lifetime-limits-and-the-cost-of-an-open-stream.md)
