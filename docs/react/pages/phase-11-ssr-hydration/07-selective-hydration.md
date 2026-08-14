---
title: "Selective hydration"
sidebar_label: "07 · Selective hydration"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<Suspense>`](https://react.dev/reference/react/Suspense) (the caveat naming Streaming
> Server Rendering and Selective Hydration, and "what activates a Suspense boundary") and
> the [React 18 release post](https://react.dev/blog/2022/03/29/react-v18) (the changelog
> entry).
> ⚠️ **React's reference documentation does not describe the mechanism in detail.** It calls
> these *"under-the-hood optimizations"* and links out to an architectural overview and a
> talk. This page states what is documented and marks the rest as **not settled by the
> docs** rather than filling the gap.
> No sandbox script backs this page; claims are cited, not measured.

**Hydration is not one atomic operation, and `<Suspense>` is what breaks it up.** That much
is documented. The detail of how React chooses what to hydrate first is not, and this page is
careful about the line.

## What the documentation actually says

> **React includes under-the-hood optimizations like *Streaming Server Rendering* and
> *Selective Hydration* that are integrated with Suspense.** Read an architectural overview
> and watch a technical talk to learn more.

That is the whole of it in the reference — a named optimization, tied to Suspense, with
pointers to an external overview and a conference talk. The React 18 changelog lists *"Add
selective hydration"* against a series of pull requests.

🔴 **So treat the following as the documented claim and nothing more:** hydration is
integrated with Suspense boundaries, which means a boundary is a unit of hydration as well as
a unit of streaming ([topic 06](06-streaming-ssr.md)).

## What follows from that, safely

Two consequences are derivable from documented behaviour rather than from mechanism detail:

**1. A boundary is a hydration unit.** If Suspense integrates with hydration, then the tree
does not have to hydrate as one block — parts of it can become interactive while others have
not. That is the difference between "the page is interactive" and "this section is
interactive", and it is why boundary placement affects **interactivity**, not only paint.

**2. Content can arrive after the shell and still hydrate.** Streaming means a boundary's
HTML may land well after the shell's ([topic 06](06-streaming-ssr.md)); hydration therefore
cannot be a single pass over a finished document.

⚠️ **What is *not* settled by react.dev:** the scheduling policy — whether React prioritises
the boundary a user clicked, how it queues the rest, or how a replayed event is handled. That
behaviour is widely described in talks and the React 18 working-group discussion the docs
link to. **This page does not restate those details as facts**, because they are not in the
reference and this bible's rule is that an unsettled claim is stated as uncertain or left
out.

If you need the mechanism, the docs' own two pointers are the honest place to go.

## What Suspense boundaries do to server HTML

This part *is* documented in detail, and it is the practically useful half.

> **Waiting for a large boundary's HTML to arrive during streaming server rendering. Sending
> HTML takes time, so a boundary with enough content activates even when nothing in it
> suspends. React reveals the content as the HTML arrives.**

A boundary can therefore activate for a reason that has nothing to do with data — **sheer
size**. Worth knowing, because a spinner appearing on a component with no async work at all
looks like a bug and is not.

## Opting a component out of server rendering

The documented technique that most people actually reach for when they think about selective
hydration:

> **If a component throws an error on the server, React will not abort the server render.
> Instead, it will find the closest `<Suspense>` component above it and include its fallback
> (such as a spinner) into the generated server HTML.**
>
> **On the client, React will attempt to render the same component again. If it errors on the
> client too, React will throw the error and display the closest Error Boundary. However, if
> it does not error on the client, React will not display the error to the user since the
> content was eventually displayed successfully.**

Which gives a deliberate escape:

```jsx
<Suspense fallback={<Loading />}>
  <Chat />
</Suspense>

function Chat() {
  if (typeof window === 'undefined') {
    throw Error('Chat should only render on the client.');
  }
  // ...
}
```

> **The server HTML will include the loading indicator. It will be replaced by the `Chat`
> component on the client.**

🔴 **Note what this is not.** It is *not* the `typeof window` bug from
[topic 02](02-hydration-mismatches.md) — that one *branches* on the environment and produces
two different renders. This one **throws**, which React handles as a boundary activation, so
there is no mismatch to reconcile. Same expression, opposite outcome, and the difference is
worth being able to explain.

Compare it with the two-pass render ([topic 05](05-suppresshydrationwarning.md)):

| | Throw on the server | Two-pass `isClient` |
|---|---|---|
| Server HTML | the Suspense fallback | the server branch |
| Client renders | once | **twice** |
| Needs a boundary | yes | no |
| Best for | a component that genuinely cannot run server-side | small differences inside an otherwise shared tree |

## Gotchas

**Symptom:** a spinner appears for a component that fetches nothing.
**Cause:** documented — a boundary with enough content activates on HTML size alone during
streaming.
**Fix:** not a bug. Reduce the boundary's content if the flash is unwanted.

**Symptom:** part of the page responds to clicks and part does not.
**Cause:** hydration is integrated with Suspense boundaries, so it is not all-or-nothing.
**Fix:** expected. Place boundaries with interactivity in mind, not only paint.

**Symptom:** an error thrown on the server never appears anywhere.
**Cause:** if the client render succeeds, **React does not display the error**, because the
content was eventually shown.
**Fix:** by design. Use `onError` on the server renderer to see it
([topic 03](03-the-server-renderers.md)).

**Symptom:** `typeof window === 'undefined'` was used and caused a mismatch, though the docs
show it working.
**Cause:** the documented pattern **throws**; branching on it renders two different trees.
**Fix:** throw inside a boundary, or use the two-pass render.

**Symptom:** the client-only component throws on the client too, and users see an error.
**Cause:** a second failure surfaces — React throws and the closest Error Boundary displays.
**Fix:** make sure the guard really is server-only.

## Interview questions

**★ What is selective hydration, and what does React actually document about it?**
That hydration is integrated with Suspense, so a boundary is a unit of hydration as well as
a unit of streaming — meaning the page does not hydrate as one block and parts can become
interactive independently. Beyond that, react.dev calls it an *"under-the-hood
optimization"* and points at an architectural overview and a talk; the scheduling policy is
not in the reference. Being straight about that line is better than reciting mechanism from
memory.

**★ Why does boundary placement affect interactivity and not just paint?**
Because hydration is integrated with those boundaries. Everything in one boundary becomes
interactive together, so a single boundary around the page makes interactivity all-or-nothing,
while a boundary per region lets each become usable on its own schedule.

**★ Can a Suspense boundary show a fallback with no async work in it?**
Yes, during streaming SSR. The docs list *"waiting for a large boundary's HTML to arrive"* as
something that activates a boundary — sending HTML takes time, so **size alone** is enough.
A spinner on a component that fetches nothing is expected, not a bug.

**★ How do you opt a component out of server rendering?**
Throw in the server environment and wrap it in a `<Suspense>` boundary. React does not abort
the render; it emits the closest boundary's fallback into the server HTML and retries on the
client, and if the client render succeeds it never surfaces the error. The server HTML has
the loading indicator and the client replaces it.

**That looks like the `typeof window` mismatch bug. What is the difference?**
Branching on `typeof window` produces two different renders and a mismatch. Throwing produces
a boundary activation, which React handles as a documented path with no mismatch to
reconcile. Same expression, opposite outcome — and it is a good test of whether someone
understands why mismatches happen.

---

← Prev: [Streaming SSR with Suspense](06-streaming-ssr.md) ·
Index: [Phase 11](README.md) ·
Next → [Prerendering](08-prerendering.md)
