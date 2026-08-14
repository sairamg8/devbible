---
title: "Extracting too early"
sidebar_label: "12 · Extracting too early"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
> (*When to use custom Hooks*, *Keep your custom Hooks focused on concrete high-level use
> cases*, and the Recap).
> No sandbox script backs this page; claims are cited, not measured.

**Eleven topics on how to write custom hooks, and the last one is about not writing them.
The failure mode this phase produces in practice is not a broken hook — it is a component
that reads as ten calls to ten files, none of which is used twice.**

## What the docs actually say

react.dev is more relaxed about extraction than almost any advice you will read
elsewhere, and it says so in three places.

> **You don't need to extract a custom Hook for every little duplicated bit of code. Some
> duplication is fine.** For example, extracting a `useFormInput` Hook to wrap a single
> `useState` call like earlier is probably unnecessary.

> **It's up to you how and where to choose the boundaries of your code.**

> **Start by choosing your custom Hook's name. If you struggle to pick a clear name, it
> might mean that your Effect is too coupled to the rest of your component's logic, and
> is not yet ready to be extracted.**

Three separate permissions: duplication is acceptable, the boundary is a judgement call,
and *not being able to name it is a reason to stop*. That last one is the only hard gate
in the topic, and it is a gate against extracting, not for it.

## The trigger is an effect, not a repetition

The one thing the docs *do* push you toward:

> However, **whenever you write an Effect, consider whether it would be clearer to also
> wrap it in a custom Hook.** You shouldn't need Effects very often, so if you're writing
> one, it means that you need to **"step outside React" to synchronize with some external
> system** … Wrapping it into a custom Hook lets you precisely communicate your intent and
> how the data flows through it.

So the criterion is **a boundary with something outside React**, not "this appears twice".
A boundary deserves a name because it is where the reader's mental model changes; two
similar lines of state manipulation are not a boundary, they are two similar lines.

| Candidate | Extract? |
|---|---|
| An effect synchronizing with a socket, an observer, a browser API | ✅ Yes — that is the documented trigger |
| The same three-line effect in two components | ✅ Yes, for the same reason |
| A `useState` plus its setter, wrapped | 🔴 No — explicitly named as probably unnecessary |
| Two `useState` calls that happen to appear together twice | 🔴 No — duplication is not a boundary |
| Something you cannot name | 🔴 **No** — the name is the gate |

## What over-extraction costs

The reason this is a topic rather than a preference is that each of these costs is
concrete.

**1. Control flow disappears.** A hook called once, in one component, that contains an
`if` and a state update, has moved the branch somewhere the reader must go and find. The
component now reads as a list of names with no visible logic, which feels tidy and is
strictly harder to follow than the code it replaced.

**2. The `use` guarantee is diluted.** The convention promises that a `use…` call may
contain state and a non-`use` call definitely does not
([Phase 7 · 02](02-writing-a-custom-hook.md)). Every trivial hook makes that promise
cheaper: if half the `use…` calls in a component hide nothing but a `useState`, the reader
stops treating the prefix as information.

**3. The dependency surface grows.** A hook boundary is a place where objects and
callbacks cross, and each crossing is a chance to re-subscribe or go stale
([Phase 7 · 08](08-hooks-that-wrap-effects/README.md)). A hook that earns nothing still
pays that tax.

**4. Premature abstraction locks in the wrong shape.** The second caller almost always
needs something slightly different, and the hook grows a flag. Then a third, and another
flag. That is the failure the docs describe from the other direction:

> **A good custom Hook makes the calling code more declarative by constraining what it
> does.** … **If your custom Hook API doesn't constrain the use cases and is very
> abstract, in the long run it's likely to introduce more problems than it solves.**

A hook extracted before its second use has no evidence about what to constrain, so it
constrains nothing.

**5. Testing gets worse, not better.** A hook used once is tested through a harness
component you invented rather than through the real caller — which is why RTL recommends
`render` over `renderHook` in the first place
([Phase 7 · 11](11-testing-a-custom-hook.md)). You added a file and a test that both
describe a fiction.

## The one exception worth naming

A hook used exactly once is fine when the *name is doing the explaining* — when
`useChatRoom({ serverUrl, roomId })` replaces twenty lines of connection lifecycle and the
component becomes readable at a glance. That is the docs' own example, and it is used
once in `ChatRoom`.

The distinction is not "how many callers" but **whether the name replaces something the
reader would otherwise have to understand**. `useChatRoom` does. `useUserName` wrapping a
`useState` does not.

## The migration argument, and its limit

The strongest case for extracting early:

> Effects are an "escape hatch" … With time, the React team's goal is to **reduce the
> number of the Effects in your app to the minimum** by providing more specific solutions
> to more specific problems. **Wrapping your Effects in custom Hooks makes it easier to
> upgrade your code** when these solutions become available.

That is real — the documented `useOnlineStatus` rewrite to `useSyncExternalStore` changed
no call sites. But note the scope: it is an argument for wrapping **effects**, which is
the same trigger as before. It is not an argument for wrapping state, derived values or
event handlers, none of which React is planning to replace.

## Deleting one

When you find a hook that should not exist, inlining it is usually a strict improvement,
and the tell that you were right is that **the component gets shorter**, not longer —
because the wrapper, the return shape and the arguments all disappear along with it. If
inlining makes the component meaningfully worse, the hook was earning its place.

Related: [Phase 4 · 06](../phase-4-effects/06-you-might-not-need-an-effect/README.md) is
the same argument one level down — the best custom hook wrapping an effect is often no
effect at all.

## Gotchas

**Symptom:** a component is ten hook calls to ten files and you cannot tell what it does.
**Cause:** extraction on duplication rather than on boundaries.
**Fix:** inline the ones whose names do not replace an explanation. Duplication is fine;
the docs say so.

**Symptom:** a hook grows `skip`, `once`, `mode`, `immediate` flags.
**Cause:** it was extracted before there was evidence about what to constrain.
**Fix:** split into concrete hooks, or inline it and extract again when the second real
caller exists.

**Symptom:** you cannot settle on a name.
**Cause:** the logic is still too coupled to the component to extract — react.dev's own
diagnostic.
**Fix:** leave it where it is. This is the one hard gate in the topic.

**Symptom:** every `use…` call in the codebase has to be opened to know whether it
matters.
**Cause:** trivial hooks have diluted the naming convention's guarantee.
**Fix:** the prefix is only worth having while it carries information.

**Symptom:** a hook exists to be tested.
**Cause:** the test needs a harness component that no real caller resembles.
**Fix:** test the component that uses it; RTL recommends exactly that.

## Interview questions

**★ When should you *not* extract a custom hook?**
When there is no boundary to name. The docs are explicit that some duplication is fine and
that wrapping a single `useState` is probably unnecessary, and they treat an unclear name
as evidence that the logic is too coupled to extract yet. The trigger for extraction is an
effect — a synchronization with something outside React — not the fact that two components
contain similar lines.

**★ What does over-extraction actually cost?**
Control flow moves out of sight, so the component reads as a list of names; the `use`
prefix stops meaning "state may hide here" once half the hooks hide nothing; every
boundary is another place objects and callbacks cross, with the re-subscribe and stale
risks that brings; the hook accumulates flags because it was designed without evidence;
and tests end up describing a harness component no real caller resembles.

**★ Is a hook used only once always wrong?**
No. `useChatRoom` in the docs is used once, and it is right because the name replaces
twenty lines of connection lifecycle the reader would otherwise have to follow. The test
is not the number of callers but whether the name does explanatory work. A `useUserName`
wrapping a `useState` does not.

**What is the strongest argument for wrapping effects early, and what is its limit?**
That effects are an escape hatch React intends to shrink, and a hook is the seam that lets
you adopt replacements — `useOnlineStatus` was rewritten onto `useSyncExternalStore` with
no call site changed. The limit is that it is an argument about *effects* specifically. It
does not extend to wrapping state, derived values or event handlers.

**How do you know you were right to delete a hook?**
The component gets shorter. The wrapper, the return shape and the argument plumbing all
disappear with it. If inlining makes the component meaningfully worse to read, the hook
was earning its place and should stay.

---

← Prev: [Testing a custom hook](11-testing-a-custom-hook.md) ·
Index: [Phase 7](README.md)
