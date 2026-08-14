---
title: "Fetching data in an effect"
sidebar_label: "07 · Fetching data in an effect"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useEffect`](https://react.dev/reference/react/useEffect) (§ Fetching data with
> Effects, and the deep dive *What are good alternatives to data fetching in
> Effects?*) and
> [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
> (§ Fetching data). No sandbox script backs this page; claims are cited, not
> measured.

**Fetching is the one case from [topic 06](06-you-might-not-need-an-effect/README.md)
that survives as a legitimate effect — and react.dev still recommends you do
something else. Both halves of that sentence are true and neither cancels the
other.**

It is everyone's first answer because it is the only one you can write with
nothing but React. That is also the whole problem: what you get is the mechanism
with none of the infrastructure around it.

## The shape that actually works

```jsx
export default function Page() {
  const [person, setPerson] = useState('Alice');
  const [bio, setBio] = useState(null);

  useEffect(() => {
    let ignore = false;
    setBio(null);
    fetchBio(person).then(result => {
      if (!ignore) {
        setBio(result);
      }
    });
    return () => {
      ignore = true;
    };
  }, [person]);
}
```

Three details, none of them optional:

- **`let ignore = false`, flipped in cleanup.** The race-condition guard —
  *"network responses may arrive in a different order than you sent them"*
  ([topic 08](08-race-conditions.md) in full).
- **`setBio(null)` before the fetch.** Easy to leave out and the omission is
  visible: without it, switching from Alice to Bob shows *Alice's* bio until
  Bob's arrives. Stale data presented as current is worse than a spinner.
- **The cleanup returns a function, so the setup is not `async`.** You can use
  `async`/`await` inside, but react.dev is explicit: *"you still need to provide a
  cleanup function"* ([topic 02](02-useeffect-anatomy.md)).

That is the correct version. Now the case against it.

## The four documented downsides

react.dev's own list, and none of these is a style objection:

> - **Effects don't run on the server.** This means that the initial
>   server-rendered HTML will only include a loading state with no data. The
>   client computer will have to download all JavaScript and render your app only
>   to discover that now it needs to load the data. This is not very efficient.

The sequence is the point: server sends a spinner → client downloads the bundle →
client renders → *only then* does the request start. The data fetch cannot begin
until the JavaScript has arrived and executed. This is the client-only constraint
from [topic 01](01-what-an-effect-is-for.md) showing up as a page-load cost.

> - **Fetching directly in Effects makes it easy to create "network
>   waterfalls".** You render the parent component, it fetches some data, renders
>   the child components, and then they start fetching their data. If the network
>   is not very fast, this is significantly slower than fetching all data in
>   parallel.

The waterfall is **structural, not accidental**. A child cannot render until its
parent has, and an effect cannot run until its component has rendered — so
requests serialise along the tree depth whether or not they depend on each other.
Three nested components that each fetch produce three sequential round trips for
data that could have gone out at once.

> - **Fetching directly in Effects usually means you don't preload or cache
>   data.** For example, if the component unmounts and then mounts again, it would
>   have to fetch the data again.

And unmount-then-mount is not exotic — it is the back-navigation from
[topic 04](04-cleanup/03-when-cleanup-is-not-the-answer.md), a tab switch, a
route change and return. Every one of them refetches from scratch.

> - **It's not very ergonomic.** There's quite a bit of boilerplate code involved
>   when writing `fetch` calls in a way that doesn't suffer from bugs like race
>   conditions.

The mildest-sounding item and the one that does the damage in practice: the
correct version has enough moving parts that the incorrect version is what most
codebases contain.

## It is not a React problem

Worth quoting because it heads off the usual response:

> This list of downsides is not specific to React. It applies to fetching data on
> mount with any library.

None of the four is caused by `useEffect`. They follow from *fetching after the
component mounts*, which is what any on-mount fetch does in any framework. So
"React is bad at data fetching" is the wrong conclusion; **fetching on mount is
the weak strategy**, and effects are simply the most direct way to express it.

## What to do instead

> - **If you use a framework, use its built-in data fetching mechanism.** Modern
>   React frameworks have integrated data fetching mechanisms that are efficient
>   and don't suffer from the above pitfalls.
> - **Otherwise, consider using or building a client-side cache.** Popular open
>   source solutions include TanStack Query, useSWR, and React Router 6.4+.

The framework option is first for a reason — it can start the request *before*
the component renders, which is the only fix for the first two downsides. A
client-side cache addresses the third and fourth but still fetches after mount.

And the permission, which is not a formality:

> You can continue fetching data directly in Effects if neither of these
> approaches suit you.

## If you build it yourself

react.dev names what you are taking on:

> you would use Effects under the hood but also add logic for **deduplicating
> requests, caching responses, and avoiding network waterfalls** (by preloading
> data or hoisting data requirements to routes).

Plus, from the other page, the two things every real screen needs:

> you'd probably want to add some logic for **error handling** and **tracking
> whether the content is loading**.

That is six concerns. The custom hook is the right first step but only relocates
the problem:

```jsx
function useData(url) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let ignore = false;
    fetch(url)
      .then(response => response.json())
      .then(json => {
        if (!ignore) {
          setData(json);
        }
      });
    return () => {
      ignore = true;
    };
  }, [url]);
  return data;
}
```

One place to fix the race condition instead of twenty — genuinely valuable, and
what [topic 06 · 03](06-you-might-not-need-an-effect/03-state-that-belongs-elsewhere.md)
means by extracting the effect. But `useData` still has no cache, so two
components calling it with the same URL issue two requests, and it still runs
after mount, so the waterfall is untouched. **Extracting the hook fixes
ergonomics only.**

## When fetching in an effect is genuinely fine

- **No framework and no cache library**, and the screen is simple enough that the
  four downsides do not bite — react.dev explicitly allows this.
- **Data that is genuinely per-component and short-lived**, where caching would be
  wrong anyway.
- **Subscribing to something that streams**, which is synchronisation rather than
  fetching, and squarely what effects are for.

What should push you off it: nested components that each fetch, a screen users
navigate back to, anything that must appear in server-rendered HTML, or a fetch
that more than one component needs.

## Gotchas

**Symptom:** switching between records briefly shows the previous record's data.
**Cause:** the old state was not cleared before the new fetch started.
**Fix:** `setBio(null)` — or whatever the reset is — as the first line of the
setup, as react.dev's example does.

**Symptom:** the page shows a spinner for a long time on a slow connection even
though the server rendered instantly.
**Cause:** effects do not run on the server, so the request cannot start until
the bundle has downloaded and executed.
**Fix:** a framework data-fetching mechanism. No amount of effect tuning helps —
the request begins too late by construction.

**Symptom:** a screen takes three round trips to fill in, one section at a time.
**Cause:** a network waterfall — nested components each fetching in their own
effect, serialised by render order.
**Fix:** hoist the data requirements up, to the route or the parent, so the
requests go out together.

**Symptom:** navigating away and back refetches everything.
**Cause:** no cache. The component unmounted and its state went with it.
**Fix:** a client-side cache — TanStack Query, useSWR, React Router 6.4+.

**Symptom:** two components on one screen fetch the same URL.
**Cause:** no request deduplication. Extracting a shared custom hook does not add
one — each call still runs its own effect.
**Fix:** a cache keyed by URL. This is the specific thing a custom hook does
*not* solve.

**Symptom:** the fetch effect has no error handling and a failed request leaves a
permanent spinner.
**Cause:** the documented example covers the race condition only; error and
loading state are explicitly left to you.
**Fix:** track all three states. If you are writing that by hand for every
screen, you are building the cache library the docs suggested.

**Symptom:** `useEffect must not return anything besides a function`.
**Cause:** an `async` setup function.
**Fix:** an inner async function, or `.then()`. The cleanup is still required
either way.

## Interview questions

**★ Why does react.dev recommend against fetching data in effects, given it also
documents how?**
Four reasons, none of them stylistic: effects do not run on the server, so
server-rendered HTML contains only a loading state and the request cannot start
until the bundle has downloaded and executed; nested fetching effects create
network waterfalls, because a child cannot render — and so cannot fetch — until
its parent has; there is no preloading or caching, so unmount-and-remount
refetches everything; and the correct version has enough boilerplate that most
codebases contain an incorrect one. It remains supported if no better option
suits you.

**★ Why is the waterfall structural rather than a mistake you can avoid?**
Because an effect runs after its component renders, and a child renders after its
parent. So requests serialise along the depth of the tree even when the data is
completely independent. The fix is not to write the effect better — it is to move
the data requirement up to the route or parent so the requests are issued
together, which is exactly what framework loaders and route-level data APIs do.

**★ What does extracting a `useData` custom hook fix, and what does it not?**
It fixes ergonomics: the race-condition guard lives in one place instead of every
call site. It fixes nothing else. There is still no cache, so two components
requesting the same URL send two requests and a remount refetches; and it still
runs after mount, so the waterfall and the empty server HTML are unchanged. The
hook is the right first step and is not a solution.

**Why is `setBio(null)` at the top of the fetch effect important?**
Because without it the previous value stays on screen while the new request is in
flight, so switching from Alice to Bob shows Alice's bio labelled as Bob's. Stale
data presented as current is a worse failure than a visible loading state. The
`ignore` flag prevents the wrong response being *applied*; clearing the state
prevents the wrong data being *displayed* in the meantime.

**Is "React is bad at data fetching" a fair summary?**
No — react.dev is explicit that the downsides are not specific to React and apply
to fetching on mount with any library. The weak strategy is fetching after the
component mounts; effects are just the most direct way to express it. That is why
the recommended alternatives all change *when* the request starts rather than how
the effect is written.

**What would you have to build to replace a data-fetching library?**
Request deduplication, response caching, and waterfall avoidance by preloading or
hoisting data requirements to routes — react.dev's own list — plus error handling
and loading state, which the documented example deliberately omits. Six concerns.
Reaching that list is the point at which writing it yourself stops being the
cheaper option.

---

← Prev: [You might not need an effect](06-you-might-not-need-an-effect/README.md) · Index: [Phase 4](README.md) · Next → [Race conditions](08-race-conditions.md)
