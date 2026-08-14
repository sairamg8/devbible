---
title: "useInsertionEffect"
sidebar_label: "17 · useInsertionEffect"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useInsertionEffect`](https://react.dev/reference/react/useInsertionEffect).
> No sandbox script backs this page; claims are cited, not measured.

**The third effect hook, and the only one the documentation tells you outright not
to use. It is worth knowing because it explains the shape of the other two — and
because recognising it in a library's source is the realistic reason you will meet
it.**

> `useInsertionEffect` allows inserting elements into the DOM **before any layout
> Effects fire.**

> ⚠️ **`useInsertionEffect` is for CSS-in-JS library authors.** Unless you are
> working on a CSS-in-JS library and need a place to inject the styles, you
> probably want `useEffect` or `useLayoutEffect` instead.

That is the whole audience. This is a <span className="db-tier t-know">Know</span>
topic precisely because application code should not contain it.

## The problem it exists for

A CSS-in-JS library has to get a `<style>` tag into the document before anything
measures layout — otherwise a component measures itself with the wrong styles
applied. `useLayoutEffect` is too late: it is one pass, so a library's layout
effect and an application's layout effect are in the same pass with no ordering
guarantee between different components
([topic 13](13-effect-ordering.md)).

An earlier pass solves it:

> `useInsertionEffect` is better than inserting styles during `useLayoutEffect` or
> `useEffect` because it ensures that **by the time other Effects run in your
> components, the `<style>` tags have already been inserted.**

react.dev is also discouraging about the underlying technique:

> We don't recommend runtime `<style>` tag injection … (1) Runtime injection
> forces the browser to recalculate the styles a lot more often. (2) Runtime
> injection can be very slow if it happens at the wrong time in the React
> lifecycle.

So the hook mitigates a cost rather than removing it.

## What it gives up to run that early

The caveats are the interesting part, because each one is a consequence of being
first:

> - Effects only run on the client. They don't run during server rendering.
> - **You can't update state from inside `useInsertionEffect`.**
> - **By the time `useInsertionEffect` runs, refs are not attached yet.**
> - `useInsertionEffect` **may run either before or after the DOM has been
>   updated.** You shouldn't rely on the DOM being updated at any particular time.

Read together: no state, no refs, and no guarantee about the DOM. It runs before
the things that would make it useful for anything except injecting styles — which
is exactly why it is safe to give a library and useless to give an application.

The third caveat is worth pairing with
[topic 15](15-effects-and-refs.md): refs are attached by the time `useEffect` and
`useLayoutEffect` run, and *not* by the time this runs. That is a real ordering
distinction, not a warning about carelessness.

## The interleaving exception

The one behaviour that differs from every other effect, and the reason
[topic 13](13-effect-ordering.md) can cite this page for the general rule:

> **Unlike other types of Effects, which fire cleanup for every Effect and then
> setup for every Effect**, `useInsertionEffect` will fire both cleanup and setup
> one component at a time. This results in an **"interleaving"** of the cleanup
> and setup functions.

`useEffect` and `useLayoutEffect` run in phases across the commit — all cleanups,
then all setups. `useInsertionEffect` runs cleanup-then-setup per component, in
sequence. For style injection that is the right shape: each component's styles are
swapped as a unit rather than every component's styles being removed before any
are re-added, which would leave the document briefly unstyled.

## The three hooks side by side

| Hook | Runs | Refs attached | Can set state | For |
|---|---|---|---|---|
| `useInsertionEffect` | before any layout effect | ❌ | ❌ | CSS-in-JS libraries |
| `useLayoutEffect` | after DOM mutation, before paint | ✅ | ✅ (blocks paint) | measuring and adjusting |
| `useEffect` | after paint | ✅ | ✅ | everything else |

Reading down the "for" column is the phase in miniature: the default is the last
row, and the two above it are each a specific trade bought with a specific cost.

## Gotchas

**Symptom:** `useInsertionEffect` reached for because "it runs earliest, so it is
safest".
**Cause:** treating earlier as stricter, the same mistake as reaching for
`useLayoutEffect` ([topic 12](12-uselayouteffect.md)).
**Fix:** earlier means fewer guarantees, not more. No refs, no state, no settled
DOM.

**Symptom:** a state update inside `useInsertionEffect` does not work.
**Cause:** it is explicitly disallowed.
**Fix:** whatever needs the state belongs in `useEffect`.

**Symptom:** `ref.current` is `null` in `useInsertionEffect`.
**Cause:** refs are not attached yet at that point in the commit.
**Fix:** `useLayoutEffect` if it must be before paint, otherwise `useEffect`.

**Symptom:** code in it assumes the DOM reflects the new render.
**Cause:** it may run before *or* after the DOM has been updated — unspecified.
**Fix:** do not read the DOM here. Its guaranteed position is relative to other
*effects*, not to the mutation.

**Symptom:** a styling library is slow and injection was moved to
`useInsertionEffect` to fix it.
**Cause:** the hook fixes *ordering*, not the cost of runtime injection, which the
docs warn about separately.
**Fix:** build-time extraction if the cost is the problem.

## Interview questions

**★ What is `useInsertionEffect` for, and should you use it?**
Inserting elements into the DOM before any layout Effect fires — which in practice
means CSS-in-JS libraries injecting `<style>` tags. react.dev says outright that
unless you are writing such a library you want `useEffect` or `useLayoutEffect`
instead. Its value in application code is recognising it in a dependency's source,
not writing it.

**★ Why can't a CSS-in-JS library just use `useLayoutEffect`?**
Because layout effects all run in one pass with no ordering guarantee between
different components beyond children-before-parents, so an application component
could measure itself before the library's styles were inserted.
`useInsertionEffect` is an earlier, separate pass, which is what lets the docs
promise that by the time other Effects run, the `<style>` tags are already in
place.

**★ How does its cleanup/setup ordering differ from other effects?**
Other effects run in phases across the commit — every cleanup, then every setup.
`useInsertionEffect` fires cleanup and setup one component at a time, interleaved.
For style injection that is the right shape, since each component's styles are
swapped as a unit instead of the document being briefly stripped of every
component's styles at once.

**What does it give up by running so early?**
Refs are not attached, state cannot be updated, and it may run either before or
after the DOM has been updated — so the DOM cannot be relied on either. Those are
consequences of being first, and together they are why the hook is safe to hand a
library and useless to an application.

---

← Prev: [Subscribing to an external store](16-external-store.md) · Index: [Phase 4](README.md) · Next → [Skipping the first run](18-skipping-the-first-run.md)
