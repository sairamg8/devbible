---
title: "Cleanup recipes"
sidebar_label: "02 · Cleanup recipes"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
> (§ How to handle the Effect firing twice in development) and
> [`useEffect`](https://react.dev/reference/react/useEffect).
> No sandbox script backs this page; claims are cited, not measured.

**The contract from [chunk 01](01-the-cleanup-contract.md) resolves differently
depending on what the effect touches. These are react.dev's own cases, and two
of them end with the correct cleanup being none at all.**

Every recipe is the same question answered: *after setup → cleanup → setup, does
the user see anything different from setup alone?*

## Controlling a non-React widget

This is the case with two answers, and telling them apart is the skill.

**No cleanup**, when calling the method twice with the same value does nothing:

```jsx
useEffect(() => {
  const map = mapRef.current;
  map.setZoomLevel(zoomLevel);
}, [zoomLevel]);
```

Setting the zoom to 12, then to 12 again, leaves the map at 12. The operation is
**idempotent**, so the invariant holds with an empty cleanup.

**Cleanup required**, when the API refuses a second call:

```jsx
useEffect(() => {
  const dialog = dialogRef.current;
  dialog.showModal();
  return () => dialog.close();
}, []);
```

> In development, your Effect will call `showModal()`, then immediately
> `close()`, and then `showModal()` again. This has the same user-visible
> behavior as calling `showModal()` once, as you would see in production.

A second `showModal()` on an already-open `<dialog>` throws. The cleanup is what
makes the second call legal — and it is also, not coincidentally, what closes
the dialog when the component unmounts.

**The test is the API, not the widget.** Setters are usually idempotent; anything
that opens, pushes, registers or begins usually is not.

## Subscribing to events

The archetype. Cleanup unsubscribes:

```jsx
useEffect(() => {
  function handleScroll(e) {
    console.log(window.scrollX, window.scrollY);
  }
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, []);
```

> In development, your Effect will call `addEventListener()`, then immediately
> `removeEventListener()`, and then `addEventListener()` again with the same
> handler. So there would be only one active subscription at a time.

Note where `handleScroll` is declared — **inside the setup**. That is what makes
the reference passed to `removeEventListener` identical to the one passed to
`addEventListener`. Declaring it in the component body works too, but only until
something makes it a new function each render, at which point the cleanup
silently removes nothing and every render adds another listener.

Without the cleanup the failure is cumulative: one listener per commit, all of
them live, all of them holding their render's closure alive.

## Triggering animations

Cleanup resets to the starting value:

```jsx
useEffect(() => {
  const node = ref.current;
  node.style.opacity = 1; // Trigger the animation
  return () => {
    node.style.opacity = 0; // Reset to the initial value
  };
}, []);
```

> In development, opacity will be set to `1`, then to `0`, and then to `1`
> again. This should have the same user-visible behavior as setting it to `1`
> directly, which is what would happen in production.

The generalisation react.dev gives for libraries:

> If you use a third-party animation library with support for tweening, your
> cleanup function should reset the timeline to its initial state.

"Undo" here means **restore the initial state**, not "play the animation
backwards". The two are easy to conflate and only one satisfies the invariant.

## Fetching data

A network request cannot be recalled, so the cleanup works on the *result*:

```jsx
useEffect(() => {
  let ignore = false;

  async function startFetching() {
    const json = await fetchTodos(userId);
    if (!ignore) {
      setTodos(json);
    }
  }

  startFetching();

  return () => {
    ignore = true;
  };
}, [userId]);
```

> You can't "undo" a network request that already happened, but your cleanup
> function should ensure that the fetch that's *not relevant anymore* does not
> keep affecting your application. If the `userId` changes from `'Alice'` to
> `'Bob'`, cleanup ensures that the `'Alice'` response is ignored even if it
> arrives after `'Bob'`.

`ignore` is a plain `let` in the setup's scope, so **each run gets its own** —
the cleanup can only ever flip its own render's flag. This is the race-condition
guard, and it has a full topic of its own
([08](../08-race-conditions.md)) along with the `AbortController` variant.

On what you will actually observe:

> In development, you will see two fetches in the Network tab. There is nothing
> wrong with that. With the approach above, the first Effect will immediately get
> cleaned up so its copy of the `ignore` variable will be set to `true`. So even
> though there is an extra request, it won't affect the state thanks to the
> `if (!ignore)` check.

> In production, there will only be one request.

And the escape hatch, if the duplicate is genuinely a problem:

> If the second request in development is bothering you, the best approach is to
> use a solution that deduplicates requests and caches their responses between
> components.

Which is the honest answer to the whole category — fetching in an effect has
real drawbacks, covered in [topic 07](../07-fetching-data.md).

## Sending analytics

```jsx
useEffect(() => {
  logVisit(url); // Sends a POST request
}, [url]);
```

**No cleanup.** And the justification is not "it is too hard to undo":

> In development, `logVisit` will be called twice for every URL, but this is not
> a problem because you don't want the logs from the development machines to skew
> the production metrics.

> In production, there will be no duplicate visit logs.

The double call happens only in development, and development traffic should not
be in the metrics anyway. The invariant is satisfied because there is **no
user-visible difference at all** — nobody is looking at your analytics dashboard
as a user.

Note how narrow that argument is. It works for analytics precisely because the
duplicate is invisible to users *and* harmless to the data that matters. A POST
that changes application state has neither property, which is
[chunk 03](03-when-cleanup-is-not-the-answer.md).

## When no cleanup is needed

Pulling the negative cases together — an effect needs no cleanup when the setup
is:

- **idempotent** — calling it twice with the same input leaves the same state
  (`map.setZoomLevel`, assigning `document.title`);
- **read-only** — it measures or observes without registering anything;
- **fire-and-forget with no user-visible duplicate** — the analytics case.

Everything else needs one. If you cannot place your effect in one of those three
buckets, assume it needs cleanup and go find the inverse.

And one caution in the other direction: a cleanup added where none was needed is
not free. Resetting a value the next setup is about to set anyway introduces an
intermediate state the user can see.

## Gotchas

**Symptom:** two requests in the Network tab in development, and a suspicion the
`ignore` flag is not working.
**Cause:** it is working. The flag suppresses the *state update*, not the
request. Two fetches in development is documented and expected.
**Fix:** nothing. Confirm production sends one. If the duplicate is genuinely
costly, deduplicate at the data-fetching layer.

**Symptom:** `removeEventListener` in the cleanup leaves the listener attached,
and listeners accumulate on every render.
**Cause:** the handler is a different function reference by the time cleanup
runs — an inline arrow, or a handler defined in the component body and recreated
each render.
**Fix:** declare the handler inside the setup so both calls close over the same
binding.

**Symptom:** `showModal()` throws on the second call, only in development.
**Cause:** no cleanup, so the extra cycle re-opens an already-open dialog.
**Fix:** `return () => dialog.close()` — which is the unmount behaviour you
needed anyway.

**Symptom:** an animation "undo" plays the transition in reverse and looks
wrong.
**Cause:** cleanup implemented as a reverse animation rather than a reset.
**Fix:** restore the initial value — or reset the library's timeline to its
initial state.

**Symptom:** cleanup added to an idempotent setter makes the widget flicker.
**Cause:** a cleanup that "resets" something the next setup was about to set
anyway, introducing a state the user can see.
**Fix:** remove it. Idempotent setups need no cleanup — the invariant already
holds.

**Symptom:** an observer keeps firing for a node that is no longer on screen.
**Cause:** `observe()` in setup with no `disconnect()` in cleanup. The observer
holds a reference to the node, so neither is collected.
**Fix:** return `() => observer.disconnect()`. Full treatment in
[topic 14](../14-timers-listeners-observers.md).

## Interview questions

**★ How do you clean up a data fetch, given a request cannot be cancelled after
the fact?**
You do not undo the request; you make its result irrelevant. A `let ignore =
false` in the setup scope, checked before the state update, and set to `true` in
the cleanup. Each run has its own copy, so a superseded fetch can only ever
invalidate itself. `AbortController` is the variant that also stops the transfer.
In development you will see two requests and that is documented and correct; in
production there is one.

**★ Which effects legitimately need no cleanup?**
Three kinds: idempotent setups where calling twice with the same value changes
nothing, read-only setups that register nothing, and fire-and-forget calls with
no user-visible duplicate — analytics being react.dev's example, since the double
call happens only in development and development traffic should not be in the
metrics. Anything that opens, subscribes, registers or begins needs cleanup.

**★ Why does the same "control a widget" case sometimes need cleanup and
sometimes not?**
It depends on the API, not on the widget. `map.setZoomLevel(12)` twice leaves the
map at 12, so the invariant already holds and an empty cleanup is correct.
`dialog.showModal()` twice throws, so it needs `dialog.close()`. Setters tend to
be idempotent; anything that opens, pushes or begins tends not to be.

**Why must the event handler be declared inside the setup?**
So that `addEventListener` and `removeEventListener` receive the same function
reference. `removeEventListener` matches on identity, so a handler recreated
between setup and cleanup removes nothing — and because setup still runs, every
commit adds another live listener. Declaring it in the setup body makes the two
calls close over one binding by construction.

**What does "undo" mean for an animation?**
Restore the initial value, not play the transition in reverse. react.dev's
example sets `opacity` to 1 in setup and back to 0 in cleanup, so the development
sequence 1 → 0 → 1 is indistinguishable from setting it to 1 once. For a
tweening library the equivalent is resetting the timeline to its initial state.

**Is there a cost to adding cleanup that was not needed?**
Yes. If the cleanup resets something the next setup immediately sets again, you
have introduced a state the user can see — a flicker — where the idempotent
setup had none. Cleanup is required whenever the invariant would otherwise
break, and is not a default to apply everywhere.

---

← Prev: [The cleanup contract](01-the-cleanup-contract.md) · Index: [Cleanup](README.md) · Next → [When cleanup is not the answer](03-when-cleanup-is-not-the-answer.md)
