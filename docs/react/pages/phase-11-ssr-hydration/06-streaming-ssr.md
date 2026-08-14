---
title: "Streaming SSR with Suspense"
sidebar_label: "06 · Streaming SSR"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`renderToPipeableStream`](https://react.dev/reference/react-dom/server/renderToPipeableStream)
> (the shell, streaming, crawler, error, status-code and abort sections) and
> [`renderToReadableStream`](https://react.dev/reference/react-dom/server/renderToReadableStream)
> (`allReady`).
> No sandbox script backs this page; claims are cited, not measured.

**The server sends the page in pieces, and a `<Suspense>` boundary is the seam.** Everything
here follows from that: what "the shell" means, why boundary placement is a design decision,
and why crawlers need a different code path from humans.

## The shell

> **The part of your app outside of any `<Suspense>` boundaries is called *the shell*.**
>
> **It determines the earliest loading state that the user may see.**

So the shell is not a concept you configure — it is **whatever is left when you subtract the
Suspense boundaries.** Add a boundary and the shell shrinks; remove one and it grows.

> **This is why usually you'll want to place the `<Suspense>` boundaries so that the shell
> feels *minimal but complete* — like a skeleton of the entire page layout.**

🔴 **"Minimal but complete" is the whole design brief.** Minimal, so it flushes fast;
complete, so what the user sees first is a page rather than a fragment.

## What streaming buys

> **Streaming allows the user to start seeing the content even before all the data has loaded
> on the server.**

React sends the fallback first and patches in the real content later:

> **React will send the HTML for the loading fallback (`PostsGlimmer`) first, and then, when
> `Posts` finishes loading its data, React will send the remaining HTML along with an inline
> `<script>` tag that replaces the loading fallback with that HTML.**

Note the mechanism: **an inline `<script>` doing DOM surgery**, not a client-side re-render.
Which is why the next sentence is possible at all:

> **Streaming does not need to wait for React itself to load in the browser, or for your app
> to become interactive. The HTML content from the server will get progressively revealed
> before any of the `<script>` tags load.**

**Content arrives before your bundle does.** That is the property that makes streaming worth
the trouble on a slow connection, and it is independent of hydration
([topic 04](04-hydrateroot.md)).

## Boundary placement is the design

```jsx
<Suspense fallback={<BigSpinner />}>
  <Sidebar>
    <Friends />
    <Photos />
  </Sidebar>
  <Suspense fallback={<PostsGlimmer />}>
    <Posts />
  </Suspense>
</Suspense>
```

Nesting gives granularity: the sidebar and the posts resolve independently, each revealing
when its own data is ready. One boundary around everything makes the slowest query the
page's speed; a boundary per independent region is what actually streams.

The same rule as [Phase 10 · 08](../phase-10-server-components/08-async-components.md), seen
from the server side — and the same rule Phase 8 stated about the boundary being one unit.

## `onShellReady` vs `onAllReady`

The branch that most SSR setups need and many lack.

> **Streaming offers a better user experience because the user can see the content as it
> becomes available. However, when a crawler visits your page, or if you're generating the
> pages at the build time, you might want to let all of the content load first and then
> produce the final HTML output instead of revealing it progressively.**

```js
let isCrawler = /* your bot detection */;

const { pipe } = renderToPipeableStream(<App />, {
  bootstrapScripts: ['/main.js'],
  onShellReady() {
    if (!isCrawler) {
      response.statusCode = didError ? 500 : 200;
      response.setHeader('content-type', 'text/html');
      pipe(response);
    }
  },
  onAllReady() {
    if (isCrawler) {
      response.statusCode = didError ? 500 : 200;
      response.setHeader('content-type', 'text/html');
      pipe(response);
    }
  }
});
```

> **A regular visitor will get a stream of progressively loaded content. A crawler will
> receive the final HTML output after all the data loads.**

On the Web-streams side the same choice is `await stream.allReady`:

> **If you do that, you won't get any progressive loading. The stream will contain the final
> HTML.**

⚠️ **Piping in `onAllReady` for everyone is a common accident.** It compiles, it works, and
it silently removes streaming — every user waits for the slowest boundary. If streaming
"isn't doing anything", check which callback pipes.

## The status-code trade-off

> **Streaming introduces a tradeoff. You want to start streaming the page as early as
> possible so that the user can see the content sooner. However, once you start streaming,
> you can no longer set the response status code.**

And the consequence for error handling:

> **If a component *outside* the shell (i.e. inside a `<Suspense>` boundary) throws an error,
> React will not stop rendering. This means that the `onError` callback will fire, but you
> will still get `onShellReady` instead of `onShellError`.**
>
> **If knowing whether an error occurred for some content is critical, you can move it up
> into the shell.**

🔴 **That last sentence is a real architectural lever.** Content in the shell can fail the
response with a 500; content behind a boundary cannot, because the headers are already gone.
So "what must be able to return a 500" is another input into where you draw boundaries — on
top of "what should stream".

## Errors outside the shell degrade, they do not fail

> 1. **It will emit the loading fallback for the closest `<Suspense>` boundary
>    (`PostsGlimmer`) into the HTML.**
> 2. **It will "give up" on trying to render the `Posts` content on the server anymore.**
> 3. **When the JavaScript code loads on the client, React will *retry* rendering `Posts` on
>    the client.**
>
> **If retrying rendering `Posts` on the client *also* fails, React will throw the error on
> the client.**

A server-side failure inside a boundary therefore becomes a **client-side retry**, silently,
and only a second failure surfaces. Worth knowing when a page "works" but a section is
mysteriously slow — it may be rendering twice, once failing.

Inside the shell there is no such recovery:

> **If an error occurs while rendering those components, React won't have any meaningful HTML
> to send to the client. Override `onShellError` to send a fallback HTML that doesn't rely on
> server rendering as the last resort.**
>
> **If there is an error while generating the shell, both `onError` and `onShellError` will
> fire.**

## Aborting

> **You can force the server rendering to "give up" after a timeout.** … **React will flush
> the remaining loading fallbacks as HTML, and will attempt to render the rest on the
> client.**

A timeout is a graceful degradation to client rendering, not a 500. Pair it with the abort
mechanism for your renderer ([topic 03](03-the-server-renderers.md)).

## Gotchas

**Symptom:** streaming was configured and nothing streams.
**Cause:** either `pipe` is called in `onAllReady`, or there is no `<Suspense>` boundary
below the shell.
**Fix:** pipe in `onShellReady`; add boundaries per independent region.

**Symptom:** the whole page waits for one slow section.
**Cause:** that section is in the shell, or a single boundary wraps everything.
**Fix:** give it its own boundary.

**Symptom:** a 500 cannot be returned for a failing section.
**Cause:** once streaming starts the status code is fixed, and errors outside the shell give
`onShellReady`, not `onShellError`.
**Fix:** move content whose failure must fail the response into the shell.

**Symptom:** a section renders twice, once failing on the server.
**Cause:** documented recovery — React gives up server-side and retries on the client.
**Fix:** expected. Look at `onError` to see the server-side failure.

**Symptom:** crawlers index fallbacks.
**Cause:** they received the progressive stream.
**Fix:** the documented branch — `onAllReady` (or `await stream.allReady`) for crawlers.

**Symptom:** the first paint is a fragment, not a page.
**Cause:** the shell is too small — boundaries were placed too high.
**Fix:** "minimal but complete" — a skeleton of the whole layout.

## Interview questions

**★ What is "the shell"?**
Everything outside any `<Suspense>` boundary. It is not configured — it is what remains when
you subtract the boundaries, and it determines the earliest loading state the user can see.
The design brief in the docs is that it should feel **minimal but complete**, like a skeleton
of the entire page layout.

**★ What does streaming SSR give you beyond plain SSR?**
The user sees content before all the data has loaded on the server, and — the key property —
the HTML is progressively revealed **before any `<script>` tags load**, so it does not wait
for React or interactivity. React sends the fallback first, then the real HTML with an inline
script that swaps it in.

**★ Why do crawlers need a different path?**
Because a progressive stream shows fallbacks first, and a crawler may not wait. The
documented answer is to branch: pipe in `onShellReady` for regular visitors and in
`onAllReady` for crawlers — or `await stream.allReady` with the Web-streams renderer, which
gives up progressive loading and produces the final HTML.

**★ How does streaming constrain error handling?**
Once streaming starts you can no longer set the status code, and an error **outside** the
shell does not stop rendering — `onError` fires but you still get `onShellReady`, not
`onShellError`. So content whose failure must produce a 500 has to live in the shell. That
turns boundary placement into an error-handling decision as well as a performance one.

**What happens to an error inside a boundary on the server?**
React emits that boundary's fallback, gives up on rendering it server-side, and **retries on
the client** when JavaScript loads. Only if the client retry also fails does the error
surface. It is a silent degradation, which is why `onError` logging matters.

**What does aborting do?**
React flushes the remaining fallbacks as HTML and attempts to render the rest on the client —
a graceful degradation to client rendering rather than an error, which makes an abort on a
timer a sensible default for a page that must not hold a connection open.

---

← Prev: [`suppressHydrationWarning` and the two-pass render](05-suppresshydrationwarning.md) ·
Index: [Phase 11](README.md) ·
Next → [Selective hydration](07-selective-hydration.md)
