---
title: "Request waterfalls"
sidebar_label: "05 · Request waterfalls"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<Suspense>`](https://react.dev/reference/react/Suspense) (the closest-parent rule and
> the retry-from-scratch caveat), [`use`](https://react.dev/reference/react/use)
> (the promise-caching requirement), and
> [`preload`](https://react.dev/reference/react-dom/preload) (signature, options,
> caveats, deduplication and the sibling APIs).
> The waterfall analysis itself is **reasoning from those documented semantics**, not a
> quoted passage, and is labelled where it matters. No timings appear on this page —
> nothing was measured.
> No sandbox script backs this page; claims are cited, not measured.

**Suspense makes loading states easy, and that is exactly how it produces waterfalls: a
component cannot request what it needs until it renders, and it does not render until its
parent's data has arrived. Three nested boundaries is three sequential round trips, and
nothing in the code looks wrong.**

## How the waterfall forms

⚠️ **Reasoning from documented semantics**, not a quoted passage — but each step below is
a behaviour already established in this phase.

```jsx
<Suspense fallback={<PageSkeleton />}>
  <Profile id={id} />          {/* use(fetchUser(id)) */}
  <Suspense fallback={<PostsSkeleton />}>
    <Posts userId={...} />     {/* use(fetchPosts(userId)) */}
    <Suspense fallback={<CommentsSkeleton />}>
      <Comments postIds={...} />  {/* use(fetchComments(postIds)) */}
    </Suspense>
  </Suspense>
</Suspense>
```

1. `Profile` renders, calls `use(fetchUser(id))`, suspends. **Request 1 starts.**
2. `Posts` has not rendered — it is inside a tree that suspended, and a suspended tree is
   not executed further. **It cannot start its request**, because the call that starts it
   is inside a component body that has not run.
3. Request 1 resolves. React retries. `Profile` renders; now `Posts` renders and calls
   `use(fetchPosts(...))`. **Request 2 starts** — after request 1 finished.
4. Same again for `Comments`. **Request 3 starts** after request 2.

Three requests that could have been simultaneous, run one after another. The total wait is
their **sum**, not their maximum.

**The cause is structural, not a mistake.** Fetching *where the data is used* is exactly
what makes `use` pleasant — no prop drilling, no lifting, each component states its own
needs. The same property means each component's request is gated behind its parent
rendering, which is gated behind its parent's request.

The nested boundaries make it *look* better while it happens — you get a staged reveal
rather than one long blank — which is why waterfalls survive review. **The UI degrades
gracefully into a slow experience.**

## Fix 1 — hoist the requests, keep the components

Start every request at the top, then hand the promises down. The components still read
them with `use` and still suspend where they are.

```jsx
function Page({ id }) {
  // All three start now, in parallel — none awaits the others
  const userPromise     = fetchUser(id);
  const postsPromise    = fetchPosts(id);
  const commentsPromise = fetchComments(id);

  return (
    <Suspense fallback={<PageSkeleton />}>
      <Profile userPromise={userPromise} />
      <Suspense fallback={<PostsSkeleton />}>
        <Posts postsPromise={postsPromise} />
        <Suspense fallback={<CommentsSkeleton />}>
          <Comments commentsPromise={commentsPromise} />
        </Suspense>
      </Suspense>
    </Suspense>
  );
}
```

Now the wait is the **slowest** request, not the sum, and the boundaries still reveal
progressively as each resolves. This is the Server Component pattern from
[topic 04](04-use-promise.md) applied deliberately: **start the work high, read it low.**

Note what has *not* changed: the boundaries. Waterfall and reveal granularity are separate
concerns — you do not have to flatten your boundaries to parallelise your requests, and
conflating the two is a common wrong turn.

**The limit of this fix:** it only works when the parent *can* know what to request. If
`fetchComments` genuinely needs the post ids that come back from `fetchPosts`, the
dependency is real and no restructuring removes it. Then the honest options are to change
the endpoint so one request returns what the screen needs, or to accept a two-stage load
and design the intermediate state properly.

## Fix 2 — a cache makes hoisting free

Hoisting seems to force prop drilling. It does not, if the promises live in a cache keyed
by request — which [topic 04](04-use-promise.md) already established you need:

```jsx
function Page({ id }) {
  fetchUser(id);      // ← start them; ignore the return values
  fetchPosts(id);
  fetchComments(id);
  return (/* … children call use(fetchUser(id)) themselves … */);
}
```

Because the cache returns the **same promise** for the same key, the child's
`use(fetchUser(id))` joins the request the parent already started rather than making a new
one. You get parallel requests *and* colocated reads.

⚠️ **This depends entirely on the cache being keyed correctly.** A cache keyed on the
wrong thing gives you two requests and no error — which is the same failure as the naive
`Map` in topic 04, seen from the other side.

## Fix 3 — preload before the render happens

The earliest possible start is before the component that needs the data exists at all —
on hover, on route intent, during the previous screen.

> `preload` lets you **eagerly fetch a resource** such as a stylesheet, font, or external
> script that you expect to use.

```js
preload(href, options)
```

`options.as` is required and accepts, among others, **`fetch`**, `font`, `image`,
`script`, `style` — with a note worth catching:

> `crossOrigin`: … **Required when `as` is `"fetch"`.**

Two caveats that make it usable:

> Multiple equivalent calls to `preload` have the **same effect as a single call.** Two
> calls are equivalent if they have the same `href` (or for images, the same `href`,
> `imageSrcSet`, and `imageSizes`).

> In the browser, you can call `preload` **in any situation: while rendering, in Effects,
> event handlers, etc.**

> In server-side rendering or Server Components, `preload` **only has an effect when
> called during component rendering** or in async contexts originating from rendering.
> Other calls are ignored.

So on the client you may call it from a hover handler without guarding against repeats —
React deduplicates. On the server, the placement rule is strict.

The family, for the right tool at the right distance:

| API | What it does |
|---|---|
| `prefetchDNS` | Prefetches DNS for a domain |
| `preconnect` | Establishes a connection **without fetching** |
| `preload` | Downloads a resource |
| `preinit` | Downloads **and executes/applies** it immediately |
| `preloadModule` / `preinitModule` | The ESM equivalents |

The gradient is how *sure* you are: `prefetchDNS` for a domain you might use,
`preconnect` when a request is likely, `preload` when you will need this exact resource,
`preinit` when you want it applied on arrival.

**These are for resources, not for your data promises.** Warming your own cache — calling
`fetchUser(id)` on hover so the promise already exists when the route renders — is the
data equivalent, and it works for the same reason fix 2 does: the cache returns the
promise that is already in flight.

## Finding one

Without a measurement sandbox, the reliable checks are structural and observational:

- **Read the network panel as a staircase.** Requests that start where the previous one
  ended are a waterfall; requests that start together are not. This is the definitive
  check and needs no instrumentation.
- **Grep for `use(` inside components that render below a boundary** whose content also
  fetches. Each nesting level that fetches is one more step in the staircase.
- **Ask of each request: does it need anything from the one above it?** If no, it is
  parallelisable and currently is not.

## Gotchas

**Symptom:** a page loads in visible stages and each stage feels slower than the last.
**Cause:** a waterfall — each request starts only after its parent's render, which waits
for its parent's data.
**Fix:** start the requests at the top, or warm a shared cache; keep the boundaries where
they are.

**Symptom:** flattening the Suspense boundaries does not speed anything up.
**Cause:** boundaries control *reveal*, not *request start*. The waterfall is in where the
requests begin.
**Fix:** hoist or cache the requests. Boundary placement is topic 10's separate concern.

**Symptom:** hoisting is rejected because "it means prop drilling everything".
**Cause:** assuming hoisting requires passing promises down.
**Fix:** call the cached fetchers high for their side effect and let children read the
same cached promise.

**Symptom:** requests are hoisted and there are still two of each.
**Cause:** the cache key does not match between the parent's call and the child's.
**Fix:** key on exactly the request's inputs. This fails silently.

**Symptom:** `preload` with `as: "fetch"` does nothing.
**Cause:** `crossOrigin` is required for that type.
**Fix:** supply it.

**Symptom:** `preload` called in a Server Component event path is ignored.
**Cause:** on the server it only takes effect during component rendering or in async
contexts originating from rendering.
**Fix:** call it during render there; the browser has no such restriction.

**Symptom:** a genuine data dependency is "fixed" by hoisting and the code breaks.
**Cause:** the second request truly needs the first's result.
**Fix:** it is not a waterfall to remove — change the endpoint, or design the two-stage
load honestly.

## Interview questions

**★ Why does Suspense encourage request waterfalls?**
Because a component cannot request what it needs until it renders, and a component inside
a suspended tree does not render. So each nested fetching component starts its request
only after its parent's data has arrived — three levels is three sequential round trips,
and the total is the sum rather than the maximum. The nested boundaries make it look
better while it happens, which is why it survives review.

**★ How do you fix one without giving up colocated data reads?**
Start the requests high and read them low. Either hand the promises down as props — the
Server Component pattern — or, if the promises live in a cache keyed by request, simply
call the fetchers in the parent for their side effect and let the children call the same
cached fetcher. Because the cache returns the same promise, the child joins the in-flight
request instead of starting a second one.

**★ Does flattening Suspense boundaries fix a waterfall?**
No. Boundaries control when content is *revealed*, not when requests *start*. Conflating
the two is a common wrong turn: you can parallelise the requests and keep exactly the same
staged reveal, and you should.

**★ What is `preload` for, and what are its rules?**
Eagerly fetching a resource you expect to use — stylesheets, fonts, scripts, or a `fetch`
(where `crossOrigin` is required). React deduplicates equivalent calls, so calling it from
a hover handler repeatedly is safe. In the browser you may call it anywhere; in SSR and
Server Components it only takes effect during component rendering or async contexts
originating from rendering. Its siblings form a certainty gradient: `prefetchDNS`,
`preconnect`, `preload`, `preinit`.

**When is a waterfall not a bug?**
When the dependency is real — the second request genuinely needs a value the first
returned. No restructuring removes that; the options are to change the endpoint so one
request returns what the screen needs, or to accept a two-stage load and design the
intermediate state deliberately rather than leaving it as an accident.

**How do you detect one without profiling tools?**
Read the network panel as a staircase: requests that begin where the previous one ended
are sequential, requests that begin together are not. Structurally, look for `use(` in
components nested below a boundary whose content also fetches, and ask of each request
whether it needs anything from the one above it.

---

← Prev: [`use(promise)`](04-use-promise.md) ·
Index: [Phase 8](README.md) ·
Next → [What concurrent rendering means](06-what-concurrent-rendering-means.md)
