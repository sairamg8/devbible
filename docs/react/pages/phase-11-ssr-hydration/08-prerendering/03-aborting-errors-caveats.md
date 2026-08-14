---
title: "Aborting, errors and the caveat"
sidebar_label: "03 · Aborting, errors and the caveat"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`prerender`](https://react.dev/reference/react-dom/static/prerender) and
> [`prerenderToNodeStream`](https://react.dev/reference/react-dom/static/prerenderToNodeStream)
> — the `signal` option, the "Aborting prerendering" Usage sections, the `postponed` return
> value, the `onError` option and the single Caveat on each page.
> No sandbox script backs this page; claims are cited, not measured.

Chunks [01](01-the-static-apis.md) and [02](02-calling-them.md) described a prerender that
finishes. This one is about the
prerender that does not — which is not a failure mode, it is a **feature**, and it is the
mechanism the whole of [topic 09](../09-partial-prerendering.md) is built on.

## Waiting for all data is also the risk

The property that makes the static APIs useful is the property that can hang your build. If
one Suspense boundary is fed by a slow or broken source, `prerender` waits for it — there is
no shell to fall back to, because shells are a streaming concept. A single bad data source
stalls the page.

`signal` is the documented answer:

> **`signal`** (optional): An abort signal that lets you **abort prerendering and render the
> rest on the client**.

```js
async function renderToString() {
  const controller = new AbortController();
  setTimeout(() => {
    controller.abort()
  }, 10000);

  try {
    // the prelude will contain all the HTML that was prerendered
    // before the controller aborted.
    const {prelude} = await prerenderToNodeStream(<App />, {
      signal: controller.signal,
    });
    //...
```

🔴 **Aborting does not reject the Promise.** Read the comment in React's own example: *"the
prelude will contain all the HTML that was prerendered before the controller aborted."* You
still get a usable `prelude`. This is the single most surprising thing about the API — an
abort is a **partial success**, not an error.

## What lands in the HTML when you abort

> Any Suspense boundaries with **incomplete children** will be included in the prelude in the
> **fallback state**.

So the output is the same shape a streaming renderer's shell would have: real content
wherever the data arrived in time, and each unfinished boundary's `fallback` where it did
not. Two consequences worth being explicit about:

- **Boundary placement decides what you can salvage.** A boundary is the unit of "finished or
  not", exactly as it is for streaming ([topic 06](../06-streaming-ssr.md)) and hydration
  ([topic 07](../07-selective-hydration.md)). One boundary around the page means an abort
  costs you the page; a boundary per region means an abort costs you a region.
- **A component with no boundary above it cannot be partially rendered.** It has no fallback
  to emit, so it has to be finished before the abort or it takes its parent down with it into
  whatever the nearest boundary is.

## Where the timeout comes from is your decision

React gives you `signal` and nothing else — no built-in deadline, no default timeout, no
per-boundary limit. The 10-second `setTimeout` in the example is illustrative, not a
recommendation, and the documentation does not suggest a value. **Any budget you pick is
yours to justify**, and it belongs to the build system rather than to React.

## The handover to `resume`

An aborted prerender leaves `postponed` non-null, and that object is the entire link between
this topic and the next:

> **`postponed`**: a JSON-serializeable, opaque object that can be passed to `resume` if
> `prerender` did not finish. Otherwise `null` indicating that the `prelude` contains all the
> content and no resume is necessary.

Both references then name what can pick the work back up, and **the two APIs point at
different partners** — the same Node/Web split as everything else in this family:

| Aborted with | Resume with | Or continue prerendering with |
|---|---|---|
| `prerender` (Web streams) | `resume` | `resumeAndPrerender` |
| `prerenderToNodeStream` (Node) | `resumeToPipeableStream` | `resumeAndPrerenderToNodeStream` |

> `prerender` can be aborted and later either **continued with `resumeAndPrerender`** or
> **resumed with `resume`** to support partial pre-rendering.

Two different verbs for two different destinations: *resume* finishes the render **for a
request**, streaming the rest to a live client; *resumeAndPrerender* finishes it **into more
static output**. [Topic 09](../09-partial-prerendering.md) takes that apart properly —
here it is enough to know that `postponed` is what you must keep, and that it is
JSON-serializeable precisely so a build can write it to disk and a server can read it back
later.

⚠️ **`postponed` is described as *opaque*.** Do not inspect it, diff it, or try to derive
anything from its contents; the only supported thing to do with it is hand it to a resume
API.

## Errors

`onError` is the same callback the server renderers take, with the same two jobs:

> **`onError`** (optional): A callback that fires whenever there is a server error, whether
> **recoverable or not**. By default, this only calls `console.error`. If you override it to
> log crash reports, **make sure that you still call `console.error`**. You can also use it
> to **adjust the status code before the shell is emitted**.

Three things to take from that:

1. **Recoverable errors fire it too.** An error React recovered from — a component that threw
   on the server and will be retried on the client ([topic 07](../07-selective-hydration.md))
   — still reaches `onError`. It is your only window onto failures the user will never see.
2. **Overriding it silences the console unless you call `console.error` yourself.** The
   documentation asks for this explicitly, because the default *is* `console.error` and
   replacing it replaces that too.
3. **The status-code note is inherited from the request-time renderers** and reads oddly in a
   build script — but it is exactly right for `prerenderToNodeStream` used as a request
   handler, which chunk 01's first example does.

**If rendering fails outright, the Promise rejects.** `prerenderToNodeStream`'s reference
points that case at the server renderers' guidance: *"Use this to output a fallback shell."*
So the two failure paths are cleanly separated — **abort resolves with partial HTML, a real
failure rejects**, and your build wants a `try`/`catch` for the second even though the first
never reaches it.

## The one caveat: no `nonce`

Both pages carry exactly one Caveat, and it is the same one:

> **`nonce` is not an available option when prerendering.** Nonces must be **unique per
> request** and if you use nonces to secure your application with CSP it would be
> **inappropriate and insecure** to include the nonce value in the prerender itself.

🔴 **This is not an oversight, it is the security model.** A nonce's whole value is that it
cannot be guessed and is never reused; prerendered output is generated once and served to
everybody, so a nonce baked into it is a constant — which is to say, not a nonce. React
removes the option rather than let you build something that looks protected and is not.

The practical consequence: **a CSP that relies on nonces cannot be satisfied by output from
`react-dom/static` alone.** Either the nonce is injected at serve time, outside React, or the
policy uses hashes for the scripts that are genuinely static. This is one of the real reasons
a "fully static" site ends up with a server in front of it anyway.

⚠️ **Where React does support `nonce`:** the request-time renderers
([topic 03](../03-the-server-renderers.md)), because there a fresh value exists per request.
Moving a page from `renderToPipeableStream` to `prerenderToNodeStream` therefore silently
drops an option you may have been depending on — it will not error, it simply is not there.

## `progressiveChunkSize`

Listed on both APIs, documented as *"The number of bytes in a chunk"*, with a link to the
default heuristic in React's source. There is **no guidance on when to change it** and no
recommended value; treat it as a tuning knob you should have a measured reason to touch. On a
static API in particular it affects how the finished bytes are handed out, not how quickly
content becomes available — chunk 01's point that the stream is a consumption detail applies
here too.

## Gotchas

**Symptom:** the abort fired but no error was thrown and the build carried on.
**Cause:** by design — an abort resolves the Promise. *"The prelude will contain all the HTML
that was prerendered before the controller aborted."*
**Fix:** check `postponed`. Non-null means it did not finish; that is your signal, not an
exception.

**Symptom:** after an abort, a whole page is fallbacks.
**Cause:** the boundaries are too coarse — everything unfinished sits inside one boundary, so
one slow source cost the whole page.
**Fix:** place boundaries per region. Abort granularity is boundary granularity.

**Symptom:** `postponed` was discarded and now the page cannot be completed.
**Cause:** it is the only handle on the unfinished work, and it is opaque — there is nothing
to reconstruct it from.
**Fix:** serialise and persist it alongside the prelude. That is why it is documented as
JSON-serializeable.

**Symptom:** a CSP nonce that worked under streaming SSR is missing from prerendered HTML.
**Cause:** `nonce` *"is not an available option when prerendering"* — deliberately, because a
prerendered nonce would be shared by every visitor.
**Fix:** inject the nonce at serve time, or move those scripts to hash-based CSP.

**Symptom:** server errors stopped appearing in the logs after `onError` was overridden.
**Cause:** the default implementation *is* `console.error`; an override replaces it.
**Fix:** call `console.error` inside your handler as the documentation asks.

**Symptom:** a component that fails only on the server is reported by `onError` even though
the page looks fine.
**Cause:** `onError` fires for errors *"whether recoverable or not"*.
**Fix:** expected. Do not treat every `onError` call as a page failure — classify them.

## Interview questions

**★ What happens if you abort a prerender?**
The Promise still resolves. You get a `prelude` containing everything rendered before the
abort, with *"any Suspense boundaries with incomplete children … included in the prelude in
the fallback state"*, and a non-null `postponed`. An abort is a partial success — the failure
path is a rejected Promise, which is a different thing entirely.

**★ What is `postponed` and what are you supposed to do with it?**
A JSON-serializeable, opaque object returned when the prerender did not finish. The only
supported use is passing it to a resume API — `resume`/`resumeAndPrerender` for the Web-stream
side, `resumeToPipeableStream`/`resumeAndPrerenderToNodeStream` for Node. It is serializeable
so a build can persist it and a server can pick the work up later. It is `null` when the
prerender completed.

**★ Why can't you pass a `nonce` when prerendering?**
Because nonces must be unique per request, and prerendered HTML is produced once and served
to everyone. Baking one in would make it a constant, which defeats the point — the docs call
it *"inappropriate and insecure"*. React removes the option rather than let you ship
something that looks safe. A nonce-based CSP therefore needs the value injected at serve
time.

**★ Does `onError` fire for errors React recovered from?**
Yes — *"whenever there is a server error, whether recoverable or not"*. That includes a
component that threw on the server and rendered fine on the client, which the user never sees.
It is the only place those surface, so treat it as a signal to classify rather than as a
build failure.

**★ How long should a prerender be allowed to run before you abort it?**
React does not say, and provides no default. It gives you `signal` and leaves the budget to
you; the 10 seconds in the documentation's example is illustrative. The decision belongs to
the build pipeline, and the useful question is which boundaries you are prepared to ship as
fallbacks.

---

← Prev: [Calling them](02-calling-them.md) ·
Index: [08 · Prerendering](README.md) ·
Next → [Partial pre-rendering (19.2)](../09-partial-prerendering.md)
