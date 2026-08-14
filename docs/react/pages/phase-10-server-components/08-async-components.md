---
title: "Async components"
sidebar_label: "08 · Async components"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Server Components](https://react.dev/reference/rsc/server-components) (the async-component
> note, the "Async components with Server Components" section, and the promise-on-the-server
> pattern) and [`'use client'`](https://react.dev/reference/rsc/use-client) (Promises on the
> serializable-props list).
> No sandbox script backs this page; claims are cited, not measured.

**`await` works in render.** That sentence would have been nonsense in every previous version
of React, and it removes an entire category of boilerplate — not by hiding it, which is the
accusation usually made, but by removing the reason it existed.

> **Async Components are a new feature of Server Components that allow you to `await` in
> render.**

## What it replaces

The client-side shape everyone has written a hundred times:

```jsx
function Note({ id }) {
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/notes/${id}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setNote(d); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e); setLoading(false); } });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <Spinner />;
  if (error) return <Error error={error} />;
  return <article>{note.body}</article>;
}
```

The server version:

```jsx
async function Note({ id }) {
  const note = await db.notes.findById(id);
  return <article>{note.body}</article>;
}
```

**Every line that disappeared was there for a reason that no longer applies.** The three
state variables existed because the data arrived after the first render; the cleanup flag
existed because the component could unmount mid-fetch; the API route existed because the
browser could not reach the database. On the server, the data arrives *during* the render.

The loading and error states have not been hidden — they moved to where they compose. The
loading state is a `<Suspense>` boundary above this component, and the error state is an
error boundary. Both are declared once, by a parent, for a whole region, instead of
re-implemented per component
([Phase 8 · Suspense](../phase-8-concurrent-suspense/02-suspense/README.md)).

## How React handles the await

> **When you `await` in an async component, React will suspend and wait for the promise to
> resolve before resuming rendering. This works across server/client boundaries with
> streaming support for Suspense.**

So an async component is a **suspending** component. Everything Phase 8 established applies:
the nearest parent `<Suspense>` shows its fallback, the boundary is one unit, and with
streaming SSR the shell can flush before this component's data arrives.

```jsx
<Suspense fallback={<NoteSkeleton />}>
  <Note id={id} />
</Suspense>
```

**Where you put that boundary is a design decision, not a formality.** It decides what the
user sees while waiting and how much of the page is held back. A boundary per independent
region streams independently; one boundary around everything makes the slowest query the
page's speed.

## Sequential awaits are a waterfall

The one performance trap of the pattern, and it is easy to write by accident:

```jsx
// ✖ two round trips, one after the other
const user = await getUser(id);
const posts = await getPosts(id);
```

```jsx
// ✅ both start immediately
const [user, posts] = await Promise.all([getUser(id), getPosts(id)]);
```

Sequential `await`s are only correct when the second genuinely depends on the first. This is
the same waterfall discussion as [Phase 8 · 05](../phase-8-concurrent-suspense/05-request-waterfalls.md),
moved to the server — where the round trips are shorter but the ordering rule is identical.
[Topic 15](15-data-fetching-in-rsc.md) covers the rest of the technique.

## Starting on the server, finishing on the client

The advanced form, and the reason Promises are on the serializable-props list
([topic 05](05-what-crosses-the-boundary.md)):

> **You can even create a promise on the server, and await it on the client.**
>
> **The `note` content is important data for the page to render, so we `await` it on the
> server. The comments are below the fold and lower-priority, so we start the promise on the
> server, and wait for it on the client with the `use` API. This will Suspend on the client,
> without blocking the `note` content from rendering.**

```jsx
// Server Component
async function Page({ id }) {
  const note = await db.notes.findById(id);        // awaited here — blocks the page
  const commentsPromise = db.comments.findByNote(id); // started, not awaited

  return (
    <div>
      <Note note={note} />
      <Suspense fallback={<CommentsSkeleton />}>
        <Comments commentsPromise={commentsPromise} />
      </Suspense>
    </div>
  );
}
```

```jsx
'use client';
import { use } from 'react';

function Comments({ commentsPromise }) {
  const comments = use(commentsPromise);   // suspends here, not on the server
  return comments.map(c => <Comment key={c.id} {...c} />);
}
```

The query **starts on the server**, at the earliest possible moment, so there is no
client-side waterfall — but the *waiting* happens in the browser, so the note renders and
streams without being held back. That is a genuinely new capability: it separates *when a
request starts* from *where it is awaited*.

> **Since async components are not supported on the client, we await the promise with
> `use`.**

🔴 **Async components are server-only.** `async function` as a Client Component is not a
supported pattern; the client-side way to consume a promise is `use`
([Phase 8 · 04](../phase-8-concurrent-suspense/04-use-promise.md)).

## The rules that still apply

An async Server Component is still a component, and
[Phase 7's Rules of React](../phase-7-custom-hooks/README.md) have not been repealed:

- **Render must be pure.** `await` a read; do not mutate. Writing to the database during
  render is the anti-pattern that Server Functions exist to replace
  ([topic 06 · 02](06-server-function-security/02-what-the-framework-does.md)).
- **No hooks.** `useState`, `useEffect` and the rest are unavailable in the server graph
  ([topic 01 · 02](01-what-a-server-component-is/02-defaults-and-limits.md)).
- **It renders once.** There is no dependency array because there is no second render to
  guard against.

## Gotchas

**Symptom:** an `async` Client Component does not work.
**Cause:** async components are not supported on the client.
**Fix:** pass the promise down and consume it with `use`.

**Symptom:** the page is slow and every query is fast.
**Cause:** sequential `await`s serialize independent requests.
**Fix:** `Promise.all` for anything without a real dependency.

**Symptom:** the whole page waits for one slow section.
**Cause:** no Suspense boundary around it, so it is part of the shell.
**Fix:** wrap that region in its own boundary and let it stream in.

**Symptom:** an error in an async component takes down more of the page than expected.
**Cause:** the nearest error boundary is higher than intended.
**Fix:** place error boundaries with the same care as Suspense boundaries — per region, not
per app.

**Symptom:** a mutation was put in an async component and runs on every render or from a
prefetch.
**Cause:** render must be pure; a page render is not a user action.
**Fix:** move it into a Server Function, which is POST-only and origin-checked.

**Symptom:** `useState` was needed to keep a value the component computed.
**Cause:** there is no second render on the server for state to survive into.
**Fix:** compute it in render, or move that concern into a Client Component.

## Interview questions

**★ What does `await` in a component actually change?**
It removes the reason the loading-state boilerplate existed. The data arrives *during* the
render instead of after it, so there is no post-mount fetch, no `isLoading` flag, no cleanup
guard, and — for your own pages — no API route whose only job was to let the browser reach
the database. React suspends at the `await` and resumes when the promise resolves.

**★ Where did the loading and error states go?**
Up, to boundaries. A `<Suspense>` boundary supplies the fallback and an error boundary
handles the failure, both declared once by a parent for a whole region rather than
re-implemented in every component. Placing those boundaries is a real design decision: it
decides what streams independently and what the user waits for.

**★ What is the waterfall trap in an async component?**
Sequential `await`s. Two independent queries written one after the other cost two round
trips in series; `Promise.all` starts both at once. Sequential is correct only when the
second genuinely depends on the first.

**★ Explain creating a promise on the server and awaiting it on the client.**
`await` the data the page needs, and for lower-priority data start the query without
awaiting it, passing the promise to a Client Component that consumes it with `use` inside a
Suspense boundary. The request starts as early as possible, so there is no client waterfall,
but the waiting happens in the browser so the important content is not held back. Promises
are on the serializable-props list precisely to make this work.

**Can a Client Component be `async`?**
No — async components are not supported on the client. The client-side equivalent is `use`,
which suspends on a promise the server handed down.

**Do the Rules of React still apply on the server?**
Yes. Render must be pure, so `await` reads and never mutate — mutations belong in Server
Functions. Hooks are unavailable in the server graph. And the component renders once, which
is why there is no dependency array to reason about.

---

← Prev: [Passing Server Components as `children`](07-server-components-as-children.md) ·
Index: [Phase 10](README.md) ·
Next → [Calling Server Functions from the client](09-calling-server-functions.md)
