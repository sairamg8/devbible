---
title: "<script async> support (19)"
sidebar_label: "16 · <script async> support"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<script>`](https://react.dev/reference/react-dom/components/script) (special rendering
> behavior, the opt-in props, de-duplication and both caveats).
> No sandbox script backs this page; claims are cited, not measured.

The fourth tag React 19 treats specially, and the one with the strictest entry condition.

> React can move `<script>` components to the document's `<head>` and de-duplicate identical
> scripts.

> To opt into this behavior, provide the `src` and `async={true}` props.

```jsx
function Analytics() {
  return <script async={true} src="https://example.com/analytics.js" />;
}
```

Same idea as [topic 10](10-document-metadata/README.md)'s metadata tags and
[topic 15](15-stylesheets-and-precedence.md)'s stylesheets: **the component that knows a resource
is needed declares it, and React handles placement and duplicates.**

## Why `async={true}` is required

This is the interesting part of the topic, and the reference states the reason in one line:

> The `async` prop must be true to allow scripts to be safely moved.

🔴 **Because a non-async script's position in the document *is* its semantics.** A classic
`<script src>` blocks parsing and executes in document order — code after it can depend on code
before it. Move one and you have changed the program. An `async` script has already given up
those guarantees: it executes whenever it finishes downloading, in no particular order relative
to any other script. **There is nothing left for the move to break.**

So the rule is not a limitation React chose; it is the only condition under which hoisting is
sound at all. Compare the shape:

| Tag | Opt-in | Why that prop |
|---|---|---|
| `<meta>`, `<title>` | none | order never mattered |
| `<link rel="stylesheet">` | `precedence` | order matters — so state it explicitly |
| `<style>` | `href` + `precedence` | same, plus an identity to dedupe on |
| **`<script>`** | **`src` + `async={true}`** | **order must not matter — prove it by making it async** |

`src` is required for the same practical reason `href` is on `<style>`: it is the identity.

## De-duplication

> React will de-duplicate scripts if they have the same `src`.

> React will de-duplicate scripts that have the same `src`, inserting only one of them into the
> DOM even if multiple components render it.

**This is what the feature is for.** Three components on a page each needing the same third-party
script can each render it, and the script is inserted — and therefore executed — once. Without
this you need a module-level flag, a provider at the root, or a `useEffect` that checks the DOM;
all three are patterns this replaces.

## The two caveats

> * React will ignore changes to props after the script has been rendered. (React will issue a
>   warning in development if this happens.)
> * React may leave the script in the DOM even after the component that rendered it has been
>   unmounted. (This has no effect as scripts just execute once when they are inserted into the
>   DOM.)

The first is the same read-once rule as `<link>` and `<style>`: swapping `src` in state does not
swap the script. Change the `key` if you genuinely need a different one.

🔴 **The second comes with its own reassurance, and it is the only one of the three tags where
React offers one** — *"This has no effect as scripts just execute once when they are inserted
into the DOM."* A leftover `<link>` keeps styling the page; a leftover `<script>` element is
inert, because the execution already happened. The parenthesis is doing real work: it is telling
you not to build cleanup logic for something that has no effect.

⚠️ **What it does not say is that the script's *effects* are cleaned up.** The element is inert;
the timers, listeners and globals the script installed are not. Unmounting the component that
rendered a third-party script does not unload that script's behaviour, and nothing in React's
model pretends otherwise.

## The props that turn it off

> **Props that disable React's special treatment of scripts:**
>
> * `onError`: a function. Called when the script fails to load.
> * `onLoad`: a function. Called when the script finishes being loaded.

Exactly as with [`<link>`](10-document-metadata/01-hoisting.md): if you are handling load and
error yourself, React takes it that you are managing this element, and leaves it where you put
it.

**Which is a genuine fork, not a caveat to work around.** You can have hoisting and
de-duplication, or you can have load callbacks. If you need to know when a script is ready, you
are opting out of the hoisting, and the element renders in place.

## Where this sits in server rendering

The same place as the metadata tags: **a script declared in a component ends up in the `<head>`
of the HTML the server produces**, without a framework-level script registry and without an
effect that only runs after hydration. For a third-party tag that is supposed to load early —
analytics, consent, an experiment framework — that is the difference between loading with the
document and loading after the client has booted.

⬜ The `<script>` reference does not spell out server-specific behaviour separately, and this page
does not claim any beyond the general hoisting. What it does mean in practice is that the tag is
in the response rather than added later.

## Gotchas

**Symptom:** a `<script src>` renders in the body instead of `<head>`.
**Cause:** `async={true}` is missing. The opt-in is *both* `src` and `async={true}`.
**Fix:** add it — and if the script genuinely cannot be async, accept that it must stay where it
is.

**Symptom:** the same third-party script is inserted twice.
**Cause:** the `src` values differ, or one of them has `onLoad`/`onError` and is therefore not
managed by React.
**Fix:** normalise the URL; move load handling elsewhere if you want de-duplication.

**Symptom:** adding `onLoad` stopped the script being hoisted.
**Cause:** documented — `onLoad` and `onError` disable the special treatment.
**Fix:** choose. Callbacks and hoisting are mutually exclusive here.

**Symptom:** changing `src` in state does not load the new script.
**Cause:** *"React will ignore changes to props after the script has been rendered."*
**Fix:** give it a new `key`.

**Symptom:** a third-party widget keeps running after its component unmounts.
**Cause:** React may leave the element in the DOM, and in any case the script already executed —
its timers and listeners are its own.
**Fix:** use the library's own teardown; there is nothing React can unwind for you.

## Interview questions

**★ Why must a hoisted `<script>` be `async`?**
Because a non-async script's position in the document is part of its meaning — it blocks parsing
and executes in order. An async script has already renounced ordering guarantees, so moving it
cannot break anything. React puts it plainly: the prop *"must be true to allow scripts to be
safely moved."*

**★ What is `src` doing besides pointing at the file?**
Serving as the identity for de-duplication — React inserts one script per `src` even if many
components render it, which is what lets a shared component declare its own dependency.

**★ Which props opt out, and why would you use them?**
`onLoad` and `onError`. You use them when you need to know the script is ready — and you accept
that the element is then yours to place, with no hoisting and no de-duplication.

**★ React may leave the script element in the DOM after unmount. Is that a leak?**
Not of the element — *"This has no effect as scripts just execute once when they are inserted
into the DOM."* But the script's own side effects are untouched by unmounting; cleaning those up
is the library's job, not React's.

**★ How does this compare to the stylesheet rules?**
Same pattern, different proof obligation. A stylesheet declares its order with `precedence`; a
script proves order does not matter by being `async`. Both use a URL as the de-duplication key,
and both read their props once.

---

← Index: [Phase 11](README.md) ·
Prev: [Stylesheets and `precedence` (19)](15-stylesheets-and-precedence.md) ·
Next → [Portals and SSR](17-portals-and-ssr.md)
