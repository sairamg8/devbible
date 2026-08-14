---
title: "The idea, and the four APIs"
sidebar_label: "01 · The idea and the four APIs"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`resume`](https://react.dev/reference/react-dom/server/resume),
> [`resumeToPipeableStream`](https://react.dev/reference/react-dom/server/resumeToPipeableStream),
> [`resumeAndPrerender`](https://react.dev/reference/react-dom/static/resumeAndPrerender)
> and [`prerender`](https://react.dev/reference/react-dom/static/prerender)
> (definitions, arguments, returns and the "when to use" sections).
> No sandbox script backs this page; claims are cited, not measured.

**Partial pre-rendering is one render split across two moments in time.** A build renders as
far as it can and stops; a request picks the same tree up where the build left off and
finishes it. The thing that travels between them is the `postponed` object from
[topic 08](../08-prerendering/03-aborting-errors-caveats.md).

## The problem it solves

[Topic 01](../01-csr-ssr-ssg-streaming-rsc.md) drew a hard line: a page is either generated
ahead of time (fast, cacheable, identical for everyone) or generated per request (slow,
personal). Most real pages want both halves — a shell, a nav, a product description that
never varies, and one region that does: the cart count, the recommendations, the greeting.

The usual answers each give something up. Make the page fully dynamic and you pay per-request
rendering for content that never changes. Make it static and fetch the personal part on the
client and you have re-invented client-side rendering for that region, with its loading
state and its round trip.

Partial pre-rendering refuses the choice: **prerender everything that does not depend on the
request, and postpone the rest.**

## The lifecycle

```
BUILD TIME                          REQUEST TIME
───────────                         ────────────
prerender(<App />, {signal})        resume(<App />, postponedState)
   │                                   │
   ├─ prelude   → serve / CDN          └─ stream → the client
   └─ postponed → redis, a file, S3 ───┘
```

React's own wording for where the state lives is unusually concrete:

> **`postponedState`**: The opaque `postpone` object returned from a prerender API, **loaded
> from wherever you stored it (e.g. redis, a file, or S3)**.

Three things follow from that one sentence, and they are the practical shape of the feature:

1. **The build must persist two artifacts, not one.** The prelude alone is a half-finished
   page nobody can complete.
2. **It is storage you now own** — invalidation, versioning and cleanup included. A
   `postponed` object is tied to the build that produced it.
3. **Serialization is the point.** It is documented as JSON-serializeable precisely so it can
   cross that gap.

## The four resume APIs

The same two-by-two shape as everything else in this phase — **what you are producing** ×
**which stream type your runtime speaks**:

| | Node.js streams | Web streams |
|---|---|---|
| **Finish for a request** (stream to a client) | `resumeToPipeableStream` | `resume` |
| **Finish into more static output** | `resumeAndPrerenderToNodeStream` | `resumeAndPrerender` |

The columns are a runtime fact, not a decision — the same split as
[topic 03](../03-the-server-renderers.md). **The rows are the actual choice**, and they are
two different products:

- **`resume` / `resumeToPipeableStream` live in `react-dom/server`.** They *"stream a
  pre-rendered React tree"* to a client. This is the per-request half of partial
  pre-rendering: the postponed regions are rendered now, for this user, and streamed.
- **`resumeAndPrerender` / `resumeAndPrerenderToNodeStream` live in `react-dom/static`.**
  `resumeAndPrerender` *"continues a prerendered React tree to a static HTML string"* and,
  like `prerender`, *"waits for all data to load before resolving"*.

🔴 **The second row is the one people miss.** Resuming does not have to mean "serve it to a
user". You can resume a prerender into **more static output** — finishing at a later build,
when the data that was missing has arrived. And it composes: `resumeAndPrerender`'s reference
says its `reactNode` is *"the React node you called `prerender` **(or a previous
`resumeAndPrerender`)** with"*, and that it

> can be aborted and later either continued with another `resumeAndPrerender` or resumed with
> `resume` to support **partial pre-rendering**.

So a page can be completed in stages — build, then a later build, then finally a request —
with a `postponed` object handed along at each step.

## What each one gives back

| API | Returns |
|---|---|
| `resume` | a Promise resolving to a **Readable Web Stream**, with an extra **`allReady`** property |
| `resumeToPipeableStream` | **`{pipe, abort}`** — the same control object as `renderToPipeableStream` |
| `resumeAndPrerender` | a Promise resolving to **`{prelude, postponed}`** — exactly `prerender`'s shape |

That table is the clearest statement of what the two rows *are*. The server-side pair returns
streaming machinery — a shell, callbacks, an abort. The static pair returns a prelude and
another `postponed`, which is to say: **the same thing you put in**, and therefore something
you can feed round again.

⚠️ **A wording inconsistency in the `resumeAndPrerender` reference, stated rather than
resolved:** its signature line reads `const { prelude, postpone } = await
resumeAndPrerender(...)` while the Returns section documents the property as **`postponed`**.
`prerender` documents `postponed` in both places, and `resume`'s parameter is described as
*"the opaque `postpone` object"*. **The documentation is not self-consistent about this
name**, and this page will not guess which is authoritative — check against the version you
have installed before relying on either spelling.

## Where the `nonce` restriction goes

[Topic 08](../08-prerendering/03-aborting-errors-caveats.md) established that the static APIs
refuse `nonce` because a prerendered nonce is shared by everyone. The resume APIs are where
that resolves:

- **`resume` and `resumeToPipeableStream` accept `nonce`.** They run per request, so a fresh
  value exists.
- **`resumeAndPrerender` does not** — it carries the identical caveat as `prerender`, for the
  identical reason.

Which is a small, satisfying confirmation that the row split is real: the per-request row can
do per-request things, and the static row cannot. There is a sharp condition attached to
that, covered in [chunk 03](03-the-caveats.md).

## Is this what "PPR" means elsewhere?

The term "partial pre-rendering" appears in framework documentation too, and react.dev's
scope is narrower than that usage. **What react.dev documents is the API surface**: prerender
with a signal, keep the `postponed`, resume later. It does not describe route conventions,
build orchestration, cache invalidation or how a framework decides which regions are dynamic.

⚠️ **So do not attribute framework behaviour to React here.** If your knowledge of PPR comes
from a framework's docs, some of it is that framework's design sitting on top of these four
functions, and this bible marks that line rather than blurring it.

## Gotchas

**Symptom:** the resumed page is missing the parts the build did render.
**Cause:** the prelude was thrown away, or the `postponed` object was used on its own.
**Fix:** both artifacts are needed. The prelude is the HTML that already exists; `postponed`
only describes what is left.

**Symptom:** a `postponed` object from an older build produces broken or stale output.
**Cause:** it is opaque and tied to the render that produced it. React documents nothing that
makes it portable across builds.
**Fix:** version the stored state alongside the build that produced it and discard it when
that build is retired.

**Symptom:** `resume` was reached for when the goal was another static file.
**Cause:** the two rows produce different things — `resume` streams to a client,
`resumeAndPrerender` produces a prelude and another `postponed`.
**Fix:** pick by what you are producing, then let the runtime pick the column.

**Symptom:** `resumeAndPrerender` was expected to stream progressively.
**Cause:** it is in `react-dom/static` and *"waits for all data to load before resolving"*,
exactly like `prerender`.
**Fix:** use `resume` / `resumeToPipeableStream` if you want the content to arrive
progressively.

**Symptom:** code reads `postpone` in one place and `postponed` in another and one of them is
undefined.
**Cause:** the documentation itself uses both names in the `resumeAndPrerender` reference.
**Fix:** verify against the installed version rather than the prose.

## Interview questions

**★ What problem does partial pre-rendering solve?**
The forced choice between static and dynamic for a page that is mostly one and slightly the
other. It lets a build render everything request-independent, stop at the parts that are not,
and have a request finish only those — instead of rendering the whole page per request or
pushing the personal region to the client.

**★ What actually travels from build time to request time?**
The `postponed` object — opaque, JSON-serializeable — plus the prelude HTML. React's
documentation is explicit that you store the postponed state yourself, *"e.g. redis, a file,
or S3"*, and load it when the request arrives. Neither artifact is useful without the other.

**★ There are four resume APIs. How do you choose?**
Two dimensions. The column is your runtime's stream type and is not a decision:
`resumeToPipeableStream` and `resumeAndPrerenderToNodeStream` for Node, `resume` and
`resumeAndPrerender` for Web streams. The row is the real choice: finish it **for a request**
and stream it, or finish it **into more static output** and get another prelude and another
`postponed` back.

**★ Can you resume something more than once?**
Yes. `resumeAndPrerender` accepts the node you called `prerender` *"or a previous
`resumeAndPrerender`"* with, and can itself be aborted and continued again, or finished off
with `resume`. So a page can be completed in stages, with a `postponed` object handed along
each time.

**★ Why can `resume` take a `nonce` when `prerender` cannot?**
Because `resume` runs per request, which is when a unique nonce exists. `prerender` produces
output shared by everyone, so a nonce baked into it would be a constant. `resumeAndPrerender`
sits on the static side and carries the same refusal for the same reason.

---

Index: [09 · Partial pre-rendering](README.md) ·
Next → [Calling the resume APIs](02-calling-them.md)
