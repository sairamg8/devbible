---
sidebar_position: 11
title: "App Router SSR moved to native Node.js streams, and the 22% it bought you needed no code change"
sidebar_label: "11 · Native Node.js streams in SSR"
description: "The 16.3 rendering-layer change from web streams to native Node.js streams, why conversion overhead existed at all, and why streaming is a property of the whole path rather than the server."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the
> [Next.js 16.3 release post](https://nextjs.org/blog/next-16-3) and
> [PR #94311](https://github.com/vercel/next.js/pull/94311).
> Target: **Next.js 16.3.4**, App Router.

**This page documents a change you cannot opt into, cannot configure, and will not find in your
diff.** In 16.3 the App Router's rendering layer stopped using web streams and started using
native Node.js streams, removing the cost of converting between the two on every server-side
render. Applications handle up to **22% more requests under load** with **no changes to
application code**. It is worth a page for two reasons that have nothing to do with the number:
it is the cleanest available argument that staying current *is* a performance strategy, and the
question it raises — why was there a conversion at all — leads directly to the thing that
actually breaks streaming in production, which is never the server.

## Why there were two kinds of stream

Node.js has had its own stream implementation since long before the web platform standardised
one. `ReadableStream` — the WHATWG type — is what runs in browsers, in edge runtimes, and in
the Web APIs React's server renderer targets. `stream.Readable` is Node's own. They express the
same idea and are not the same object.

The App Router renders on a Node.js server but its rendering layer was built against web
streams, so every server-side render paid to adapt one to the other on the way out. Not a lot,
per render. Measurable across a fleet.

16.3 replaced the web streams in that layer with native Node.js streams, which deletes the
adaptation rather than optimising it. The rendering output goes straight into the response.

## What you get, and what you have to do

Nothing. Upgrade to 16.3 and the App Router handles up to 22% more requests under load. There
is no flag, and there is nothing in your code that was wrong before.

The reason to state that plainly is that it is unusual. Most performance work in this chapter
asks something of you — `reactCompiler`, bundle analysis, a `<Suspense>` boundary in the right
place, a cache directive chosen deliberately. This one asks for a version bump, which makes it
the strongest concrete answer to *why should we spend a sprint upgrading*.

## Streaming is a property of the whole path

Here is the part worth carrying away. The server can be as fast as it likes; **streaming
survives only if every hop between it and the browser also streams.** A faster renderer does
not fix a proxy that buffers.

The documented failure points, covered in full in the deployment chapter:

- **Load balancers** must support chunked transfer encoding or HTTP/2 streaming, and some
  buffer responses by default — AWS ALB with Lambda integration is the named example.
- **Reverse proxies** sitting between the load balancer and Next.js must pass chunked responses
  through without buffering. `nginx` needs telling.

A buffered hop does not error. It waits for the complete response and forwards it in one piece,
which turns every `<Suspense>` boundary in your application into decoration: the fallback never
shows, because the browser receives nothing until everything is ready. Time-to-first-byte
regresses to the slowest thing on the page and no log anywhere says why.

See **[16 · Choosing a deployment target](../16-deployment-scaling-and-observability/17-choosing-a-deployment-target-beyond-vercel.md)**
for the platform requirements and the nginx configuration.

## What this does not change

- **It is not a caching improvement.** Throughput per instance is not hit rate; the two are
  independent, and cache placement is still the larger lever. See
  [the three cache directives](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/README.md).
- **It does not affect the Edge runtime**, which is a Web-APIs environment and uses web streams
  by definition. This is a Node.js server-side rendering change.
- **It does not make a slow render fast.** Removing conversion overhead raises the ceiling on
  requests per instance. A component awaiting a slow database call is unaffected.

## Gotchas

### Reading 22% as a page-speed improvement

**Symptom.** A team upgrades expecting Core Web Vitals to move and sees nothing.

**Cause.** The figure is **requests handled under load** — a throughput measurement, taken at
saturation. LCP and INP for a single user on an unloaded server are not what changed.

**Fix.** Expect it in capacity and cost: fewer instances for the same traffic, more headroom
before autoscaling. If you want LCP to move, that is caching, streaming boundaries and image
work.

### Assuming a faster renderer fixes streaming

**Symptom.** Suspense fallbacks never appear in production, and TTFB matches the slowest data
dependency on the page — while everything streams correctly in local development.

**Cause.** Something between the server and the browser is buffering. Local development has no
load balancer and no reverse proxy, which is exactly why it works there.

**Fix.** Verify the whole path. Chunked transfer encoding or HTTP/2 through every hop, and
buffering explicitly disabled on any reverse proxy.

### Benchmarking it on an idle server

**Symptom.** Before-and-after numbers look identical.

**Cause.** Removing per-render overhead shows up **under load**, where that overhead is
competing for CPU with real work. One request at a time leaves the difference in the noise.

**Fix.** Measure at saturation — requests per second at a fixed error rate and latency budget —
not with a stopwatch on a single request.

### Expecting it in the Edge runtime

**Symptom.** No throughput change on edge-deployed routes.

**Cause.** The Edge runtime is a Web-APIs environment; web streams are native there, so there
was never a conversion to remove. This change is specific to Node.js server-side rendering.

**Fix.** None needed — but note that `runtime: 'edge'` is now marked **deprecated**, which is a
larger consideration than this page. See
[04 · Node.js runtime vs Edge runtime](04-nodejs-runtime-vs-edge-runtime-capabilities-cold-starts-choo.md).

### Deferring the upgrade because "there is nothing in it for us"

**Symptom.** A version behind, indefinitely, on the grounds that no listed feature is wanted.

**Cause.** Reading a release as a feature list rather than as a body of work. 16.3 also cut dev
memory by up to 90%, made repeat builds read from a filesystem cache, and — the part that
actually decides this — shipped in the same line as the security patches. Falling behind on
minors is how patching becomes expensive.

**Fix.** Treat throughput improvements that require no code change as the cheapest performance
work available, and read the security blog alongside the release notes.

## Interview questions

**★ What changed in the App Router's rendering layer in 16.3?**
Web streams were replaced with native Node.js streams, removing the overhead of converting
between the two during server-side rendering.

**★ What did it buy, and what did it cost to adopt?**
Up to **22% more requests handled under load**, with **no changes to application code**. The
cost is the version bump.

**★ Why was there a conversion in the first place?**
Node has its own stream implementation predating the web standard. The rendering layer was
built against web streams — the type React's server renderer targets and browsers and edge
runtimes use — while running on a Node.js server, so every render adapted one to the other.

**★ Is 22% a page-speed number?**
No. It is throughput at saturation. It shows up as capacity and cost headroom, not as LCP.

**★ Does it apply to the Edge runtime?**
No. Edge is a Web-APIs environment where web streams are native, so there was no conversion to
remove.

**★ Your Suspense fallbacks never appear in production but work locally. Where do you look?**
At every hop between the server and the browser. Load balancers must support chunked transfer
encoding or HTTP/2 streaming — some buffer by default — and reverse proxies must pass chunked
responses through unbuffered. A buffered hop produces no error; it just waits for the whole
response.

**★ Why does a buffered proxy make Suspense pointless rather than merely slower?**
Because the browser receives nothing until the response is complete, so no fallback ever
renders and TTFB collapses to the slowest dependency on the page.

**★ How would you measure this change honestly?**
Under load, at saturation — requests per second at a fixed latency and error budget. A single
request on an idle server leaves the difference inside the noise.
