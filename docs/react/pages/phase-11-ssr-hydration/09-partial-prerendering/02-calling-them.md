---
title: "Calling the resume APIs"
sidebar_label: "02 · Calling the resume APIs"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`resume`](https://react.dev/reference/react-dom/server/resume) (signature, returns,
> `allReady`, options) and
> [`resumeToPipeableStream`](https://react.dev/reference/react-dom/server/resumeToPipeableStream)
> (signature, returns, `onShellReady` / `onShellError`, and the documented example), with
> [`resumeAndPrerender`](https://react.dev/reference/react-dom/static/resumeAndPrerender)
> for the static side.
> No sandbox script backs this page; claims are cited, not measured.

All four take the **same first two arguments** and differ in what comes back.
[Chunk 01](01-the-idea-and-the-four-apis.md) covered why the rows differ; this is the call
site.

## The two arguments that never change

```js
const stream            = await resume(reactNode, postponedState, options?);
const {pipe, abort}     = await resumeToPipeableStream(reactNode, postponedState, options?);
const {prelude, postpone} = await resumeAndPrerender(reactNode, postponedState, options?);
```

**`reactNode`** is *"The React node you called `prerender` with"*, and the same
whole-document expectation applies as in
[topic 08 · 02](../08-prerendering/02-calling-them.md) — *"it is expected to represent the
entire document, so the `App` component should render the `<html>` tag."*

🔴 **You pass the tree again.** This is the detail that surprises people: resuming is not
replaying a recording, it is a **render** that has been told which parts it may skip. The
component code has to be present and has to match — which is why
[chunk 03](03-the-caveats.md)'s re-render rule matters as much as it does.

**`postponedState`** is the object you stored. The word React uses for it in every one of
these references is *opaque*.

## `resume` — the Web-stream, per-request one

> `resume` streams a pre-rendered React tree to a Readable Web Stream.

What it returns is the shell contract from
[topic 06](../06-streaming-ssr.md), unchanged:

> - If `resume` successfully produced a **shell**, that Promise will resolve to a Readable
>   Web Stream that can be piped to a Writable Web Stream.
> - **If an error happens in the shell, the Promise will reject with that error.**

and the extra property:

> **`allReady`**: A Promise that resolves when all rendering is complete. You can `await
> stream.allReady` before returning a response **for crawlers and static generation**. If you
> do that, **you won't get any progressive loading. The stream will contain the final HTML.**

That is the same `onShellReady`-versus-`onAllReady` decision topic 06 made, expressed as a
Promise: **respond at the shell for users, await `allReady` for crawlers.** Resuming does not
change the trade-off, and the sentence *"you won't get any progressive loading"* is the docs
being honest about what you are giving up.

Its options are the per-request set: **`nonce`**, **`signal`**, **`onError`**.

## `resumeToPipeableStream` — the Node one

> `resumeToPipeableStream` streams a pre-rendered React tree to a pipeable Node.js Stream.

It returns the familiar control object rather than a stream:

- **`pipe`** — *"Outputs the HTML into the provided Writable Node.js Stream. Call `pipe` in
  `onShellReady` if you want to enable streaming, or in `onAllReady` for crawlers and static
  generation."*
- **`abort`** — *"Lets you abort server rendering and render the rest on the client."*

with the callbacks to drive it:

- **`onShellReady`** — *"fires right after the shell has finished. You can call `pipe` here to
  start streaming. React will stream the additional content after the shell along with the
  inline `<script>` tags that replace the HTML loading fallbacks with the content."*
- **`onShellError`** — *"fires if there was an error rendering the shell. It receives the
  error as an argument. **No bytes were emitted from the stream yet**, and neither
  `onShellReady` nor `onAllReady` will get called, so you can output a fallback HTML shell
  **or use the prelude**."*

🔴 **"Or use the prelude" is the recovery path partial pre-rendering adds**, and it is
strictly better than what plain SSR can offer. A normal shell failure leaves you writing a
hand-rolled fallback; here the build already produced real HTML for this page, so the honest
recovery is to serve the prelude and let the client fill in the rest.

React's own example, which is about as small as it gets:

```js
import { resume } from 'react-dom/server';
import {getPostponedState} from './storage';

async function handler(request, response) {
  const postponed = await getPostponedState(request);
  const {pipe} = resumeToPipeableStream(<App />, postponed, {
    onShellReady: () => {
      pipe(response);
    }
  });
}
```

⚠️ **Two slips in that snippet, worth naming so you do not copy them into a debugging
session.** It imports `resume` and then calls `resumeToPipeableStream`; and it calls it
without `await` even though the reference's own signature line writes `await`. **This page
does not resolve whether the call is genuinely awaitable** — the documentation says both
things and nothing settles it. Check the types you actually have installed. What the example
does convey correctly is the shape: load the postponed state keyed off the request, pass the
same tree, pipe on `onShellReady`.

Note also `getPostponedState(request)` — the state is looked up **per request**, because
which page you are resuming depends on which page was asked for.

## `resumeAndPrerender` — the static one

Its options are the short list: **`signal`** and **`onError`** only. No `nonce`
([chunk 03](03-the-caveats.md)), no shell callbacks — because there is no shell to respond
at, only a finished result.

What comes back is `prerender`'s own shape:

- **`prelude`** — a Web Stream of HTML, *"to send a response in chunks, or you can read the
  entire stream into a string"*
- **`postponed`** — *"a JSON-serializeable, opaque object that can be passed to `resume` or
  `resumeAndPrerender` if `prerender` is aborted"*

> **If rendering fails**, the Promise will be rejected.

And the same defining behaviour: *"Unlike `renderToString`, `resumeAndPrerender` waits for all
data to load before resolving."*

So the mental model is exact: **`resumeAndPrerender` is `prerender` with a head start.**
Everything you know about `prerender` from [topic 08](../08-prerendering/README.md) — waiting,
aborting, `postponed`, the nonce refusal — is true of it.

## Which one, in one line each

| You want | Use |
|---|---|
| finish this page for **this user**, streaming | `resume` (Web) / `resumeToPipeableStream` (Node) |
| finish it for a **crawler**, complete HTML | the same, then `await stream.allReady` or pipe in `onAllReady` |
| finish it into **another static artifact** | `resumeAndPrerender` (Web) / `resumeAndPrerenderToNodeStream` (Node) |
| finish it **in stages**, later | `resumeAndPrerender`, keeping each returned `postponed` |

## Gotchas

**Symptom:** `resume` was given only the postponed state and the render failed.
**Cause:** it takes the React node **as well** — resuming re-renders the tree, it does not
replay a recording.
**Fix:** pass the same `<App />` you prerendered with.

**Symptom:** the resumed response has no progressive loading.
**Cause:** `await stream.allReady` was used, and the docs say plainly that *"you won't get any
progressive loading. The stream will contain the final HTML."*
**Fix:** intended for crawlers. Respond at the shell for users instead.

**Symptom:** a shell error takes the whole page down even though a perfectly good prelude
exists on disk.
**Cause:** the `onShellError` path was left as a generic fallback.
**Fix:** serve the prelude — the reference names that as the option, and it is content the
build already produced for this page.

**Symptom:** `onShellReady` never fires and nothing is written.
**Cause:** the shell errored. *"No bytes were emitted from the stream yet, and neither
`onShellReady` nor `onAllReady` will get called."*
**Fix:** handle `onShellError`; it is the only callback that runs in that case.

**Symptom:** the same postponed state is served for every URL.
**Cause:** it is per page. React's example looks it up as `getPostponedState(request)`.
**Fix:** key the stored state by route, and by build.

**Symptom:** `resumeAndPrerender` was awaited expecting a stream and destructuring failed.
**Cause:** it resolves to an **object** — a prelude and another postponed — not a stream.
**Fix:** destructure it; the streaming shape belongs to the `react-dom/server` pair.

## Interview questions

**★ Why do the resume APIs need the React tree passed in again?**
Because resuming is a render, not a replay. React re-renders from the root and skips the parts
that were fully prerendered, so the component code must be present and must match the build
that produced the postponed state. Nothing about a `postponed` object contains your
components.

**★ What is `allReady` on the stream `resume` returns?**
A Promise that resolves when all rendering is complete, for crawlers and static generation.
Awaiting it means the stream contains the final HTML — and the documentation is explicit that
you then *"won't get any progressive loading"*. It is the Promise form of the
`onShellReady`-versus-`onAllReady` decision.

**★ The shell errors while resuming. What can you do that plain SSR cannot?**
Serve the prelude. `onShellError` fires with no bytes emitted, and the reference names using
the prelude as an option — the build already produced real HTML for this page, so recovery is
serving that and letting the client finish, rather than a hand-written error shell.

**★ How is `resumeAndPrerender` different from `resume`?**
It behaves like `prerender` rather than like a server renderer: it waits for all data, and it
resolves to a prelude plus another postponed object instead of a stream you pipe to a client.
`resume` finishes the page for a request; `resumeAndPrerender` finishes it into more static
output, and can be continued again.

**★ Where does the postponed state come from at request time?**
From wherever you put it — React's parameter documentation says *"loaded from wherever you
stored it (e.g. redis, a file, or S3)"*, and its example looks it up as
`getPostponedState(request)`. It is per page and per build, and storing and invalidating it is
your responsibility, not React's.

---

← Prev: [The idea, and the four APIs](01-the-idea-and-the-four-apis.md) ·
Index: [09 · Partial pre-rendering](README.md) ·
Next → [The caveats that shape the design](03-the-caveats.md)
