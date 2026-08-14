---
title: "The server side: onError"
sidebar_label: "02 · The server side"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`renderToPipeableStream`](https://react.dev/reference/react-dom/server/renderToPipeableStream)
> (the `onError` option, shell versus outside-the-shell recovery, logging and status-code
> guidance), with
> [`hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot) for what the client
> does afterwards.
> No sandbox script backs this page; claims are cited, not measured.

The server has one error callback, not three, and it does a different job from all of them.
[Chunk 01](01-the-three-client-callbacks.md) covered the client root; this is the other half of
the same story, and the two halves meet in the middle of a single page load.

## `onError` — one callback, every server error

> A callback that fires whenever there is a server error, whether recoverable or not. By default,
> this only calls `console.error`. If you override it to log crash reports, make sure that you
> still call `console.error`. You can also use it to adjust the status code before the shell is
> emitted.

Three separate facts in one paragraph, and each is worth pulling out.

**It fires for everything.** *"whether recoverable or not"* — the client's three-way split does
not exist here. On the server there is one stream and one response, so there is one callback.

**Its default is `console.error` and only that.** Note the difference in wording from the client
root, which *"will log all errors to the console"* — same practical effect, and the same
instruction follows.

🔴 **Keep calling `console.error`.** The reference says it twice: *"make sure that you still call
`console.error`"* and, later, *"If you provide a custom `onError` implementation, don't forget to
also log errors to the console like above."* When a reference repeats itself, it is because
people get it wrong.

**It can change the response.** *"You can also use it to adjust the status code before the shell
is emitted."* That clause is the whole reason `onError` is more than a logger — it runs early
enough to matter.

## 🔴 The distinction that governs everything: inside the shell or outside it

[Topic 06 · Streaming SSR](../06-streaming-ssr.md) established the shell — the part of the page
React can render before waiting for any Suspense boundary. Error handling on the server is
entirely organised around that line.

**Inside the shell:**

> If an error occurs while rendering those components, React won't have any meaningful HTML to
> send to the client.

Nothing useful exists yet, so this is a real failure. `onShellError` fires, no bytes have gone
out, and you can still choose a status code and a response body
([topic 09 · 02](../09-partial-prerendering/02-calling-them.md) covers the partial pre-rendering
variant of this recovery, where you have a prelude to fall back to).

**Outside the shell:**

> If a component *outside* the shell (i.e. inside a `<Suspense>` boundary) throws an error, React
> will not stop rendering. This means that the `onError` callback will fire, but you will still
> get `onShellReady` instead of `onShellError`.

and the reason:

> This is because React will try to recover from that error on the client.

**So a boundary that fails on the server is not a failed response.** The shell goes out, the
boundary's fallback goes with it, and the client retries that subtree. The user sees a loading
state that resolves — or fails again, this time through the client callbacks in
[chunk 01](01-the-three-client-callbacks.md).

⚠️ **This is the fact that surprises people reading logs.** `onError` firing does **not** mean
the request failed. A perfectly successful 200 response can have several `onError` calls behind
it. If your alerting treats every `onError` as an incident, streaming SSR will page you
constantly.

### The status-code consequence

Putting the two together gives the rule the reference implies:

| Where the error happened | Bytes sent? | What you can still do |
|---|---|---|
| In the shell | no | set the status code, send a different response entirely |
| Outside the shell | yes — the shell already went | nothing to the status line; the client will retry |

*"before the shell is emitted"* is the deadline. Once the shell is on the wire, the status code
is decided, which is the ordinary constraint of streaming a response — not a React quirk.

That is also why `onError` receiving an error is worth recording somewhere with the shell/
non-shell distinction attached. A crash report that cannot tell you whether the user got a page
is much less useful than one that can.

## How the two halves meet

A single first page load can pass through both mechanisms:

1. A component inside a `<Suspense>` boundary throws on the server. **`onError` fires**; the
   shell is already fine, so the response continues.
2. The boundary's fallback is what ships in the HTML.
3. The client hydrates and re-renders that subtree.
4. If it succeeds, the user never knew. If it throws again, it is now a client error — caught by
   a boundary (**`onCaughtError`**) or not (**`onUncaughtError`**).

**The same underlying bug can therefore appear in two different systems' logs, in two different
shapes.** Correlating them is your job; React provides no shared identifier between the server
callback and the client ones.

⬜ **Deliberately not asserted:** the server references in this phase do not document an id or
digest passed from `onError` to the client callbacks, and this page does not claim one exists.
If you need correlation, generate the id yourself in `onError` and put it somewhere the client
can read.

## Wiring it up

The shape that satisfies everything the reference asks for:

```js
const {pipe, abort} = renderToPipeableStream(<App />, {
  onShellReady() {
    response.statusCode = 200;
    pipe(response);
  },
  onShellError(error) {
    // nothing was emitted — a real failure response is still possible
    response.statusCode = 500;
    response.send('<!doctype html><p>Something went wrong</p>');
  },
  onError(error) {
    console.error(error);   // the reference asks for this twice
    logCrashReport(error);
  },
});
```

Two things this shape gets right. `onError` logs and reports but does **not** decide the
response — `onShellError` does, because it is the callback that knows nothing was emitted. And
`console.error` survives the override.

## Gotchas

**Symptom:** alerts fire on every streamed page.
**Cause:** `onError` fires for recoverable errors too — a boundary failing outside the shell
still produces a successful response.
**Fix:** record the error, but base alerting on `onShellError` and on the client callbacks.

**Symptom:** errors vanish from the server console after adding crash reporting.
**Cause:** the default *"only calls `console.error`"*, and your handler replaced it.
**Fix:** call `console.error` in your handler. The reference says so twice.

**Symptom:** a status code set inside `onError` had no effect.
**Cause:** the shell had already been emitted. The documented window is *"before the shell is
emitted"*.
**Fix:** set it in `onShellReady`/`onShellError`, which is where the decision is actually
available.

**Symptom:** the same bug appears once in server logs and once in client reports and is counted
twice.
**Cause:** an error outside the shell is retried on the client by design.
**Fix:** expect the pair. Correlate with an id you generate yourself; React does not supply one.

**Symptom:** a component throws on the server and the page still renders with a spinner stuck.
**Cause:** the boundary fell back on the server and the client retry threw again, uncaught.
**Fix:** look at `onUncaughtError` on the client — the server callback only tells you the first
half.

## Interview questions

**★ How many error callbacks does the server renderer have, and why?**
One — `onError`, firing *"whenever there is a server error, whether recoverable or not"*. The
client's three-way split reflects boundaries and recovery in a live tree; the server has a single
response being produced, so it has a single hook.

**★ Does `onError` firing mean the request failed?**
No. If the error was outside the shell, React does not stop rendering — you still get
`onShellReady`, the shell ships with the boundary's fallback, and the client retries that subtree.
Only a shell error means there is no meaningful HTML to send.

**★ Where can you still set a status code?**
Before the shell is emitted. `onError` can *"adjust the status code before the shell is emitted"*,
and `onShellError` is the callback that knows no bytes have gone out. After the shell, the status
line is already sent.

**★ What must a custom `onError` always do?**
Still call `console.error`. The reference states it twice, because a handler that only ships to a
reporting service silently removes the output every developer checks first.

**★ Trace one bug through both halves.**
A component inside a Suspense boundary throws on the server → `onError` fires, response continues
with the fallback → the client hydrates and re-renders that subtree → if it throws again it
surfaces through `onCaughtError` or `onUncaughtError`. Same bug, two systems, no shared id unless
you make one.

---

← Prev: [The three client callbacks](01-the-three-client-callbacks.md) ·
Index: [13 · Root error options](README.md) ·
Next → [`renderToStaticMarkup`](../14-rendertostaticmarkup.md)
