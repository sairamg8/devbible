---
title: "Stylesheets and precedence (19)"
sidebar_label: "15 · Stylesheets and precedence"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<link>`](https://react.dev/reference/react-dom/components/link) (stylesheet behaviour,
> precedence ranking, de-duplication) and
> [`<style>`](https://react.dev/reference/react-dom/components/style) (special rendering
> behavior, props, all three caveats), with
> [`preinit`](https://react.dev/reference/react-dom/preinit) for the imperative form.
> No sandbox script backs this page; claims are cited, not measured.

[Topic 10](10-document-metadata/README.md) established that React hoists `<link>` into the
`<head>` — **except** for `rel="stylesheet"`, which needs one more prop. This is that prop, and
the machinery behind it.

**`precedence` exists because CSS order is semantics.** Two rules of equal specificity are
resolved by which came last, so a system that moves stylesheets around the document has to be
told how to order them. React will not guess:

> If the `<link>` has a `rel="stylesheet"` prop, then it has to also have a `precedence` prop to
> get this special behavior. This is because the order of stylesheets within the document is
> significant, so React needs to know how to order this stylesheet relative to others, which you
> specify using the `precedence` prop.

```jsx
<link rel="stylesheet" href="sitemap.css" precedence="medium" />
```

## What `precedence` actually is

Not an enum — an **order of first appearance**:

> React will infer that precedence values it discovers first are "lower" and precedence values it
> discovers later are "higher".

🔴 **The strings are arbitrary; their discovery order is what ranks them.** `"medium"` is not
special, and neither is `"high"`. If your app renders `precedence="app"` before
`precedence="theme"`, then `theme` outranks `app` — because React saw it later, not because of
what it is called.

That has a practical consequence worth stating: **the ranking is a property of your render order,
so keep the set of precedence names small and establish them in one place.** A name introduced
late in an unusual code path lands at the top of the cascade, which is rarely what anyone meant.

⚠️ **Note the mismatch with [`preinit`](11-resource-preloading/01-the-six-apis.md).** That
reference enumerates four values — *"The possible values are `reset`, `low`, `medium`, `high`"* —
while `<link>`'s documents `precedence` only as a string ranked by discovery order. Both
statements are on react.dev. **This page does not reconcile them**; treating the four names as a
convention rather than a validated enum is the reading that satisfies both.

### One bucket across three forms

> Stylesheets with the same precedence go together whether they are `<link>` or inline `<style>`
> tags or loaded using `preinit` functions.

**That is the sentence that makes the feature usable.** A component library shipping a `<link>`,
your app's inline `<style>`, and a `preinit` call in an event handler all land in the same
ordering system. There is one cascade, and `precedence` is the shared vocabulary for it.

## The Suspense half

> The component that renders `<link>` will suspend while the stylesheet is loading.

🔴 **This is the real feature, and it is easy to miss among the ordering rules.** A component that
needs a stylesheet does not render un-styled and then reflow — it suspends, the nearest
[`<Suspense>`](../phase-8-concurrent-suspense/02-suspense/README.md) boundary shows its fallback,
and the content appears already styled. The flash of unstyled content becomes a loading state you
control.

It also means a stylesheet link is not a free thing to render deep in a tree. Rendering one
inside a boundary makes that boundary wait on a network request.

**Inline `<style>` behaves differently, and the reference is explicit:**

> Inline stylesheets will not trigger Suspense boundaries while they're loading.

Which makes sense — there is nothing to load. The rules are already in the document.

## `<style>` — the same treatment for inline CSS

> React can move `<style>` components to the document's `<head>`, de-duplicate identical
> stylesheets, and suspend while the stylesheet is loading.
>
> To opt into this behavior, provide the `href` and `precedence` props.

**`href` on a `<style>` is an identity, not a URL.** Nothing is fetched from it:

> `href`: a string. Allows React to de-duplicate styles that have the same `href`.

That is what makes inline styles safe to render from a component that appears many times: give
the rules a stable name and React inserts them once.

```jsx
function Pill({children}) {
  return (
    <>
      <style href="pill" precedence="component">{`.pill { border-radius: 999px }`}</style>
      <span className="pill">{children}</span>
    </>
  );
}
```

### 🔴 The three caveats — one more than `<link>` has

> * React will ignore changes to props after the style has been rendered. (React will issue a
>   warning in development if this happens.)
> * **React will drop all extraneous props when using the `precedence` prop (beyond `href` and
>   `precedence`).**
> * React may leave the style in the DOM even after the component that rendered it has been
>   unmounted.

The first and third are the same two [topic 10](10-document-metadata/02-the-three-tags.md)
covered for `<link>`: props are read once, and the element is effectively append-only for the
life of the page.

**The middle one is unique to `<style>` and it is silent.** Opt into `precedence` and every prop
except `href` and `precedence` is dropped — a `media`, a `nonce`, a `data-` attribute, anything
you added. Nothing warns you; the props simply are not on the element.

⚠️ **That is the trap of this topic.** A `nonce` you thought you were setting on an inline style,
under a strict CSP, disappears — and the failure appears only in the browser, only under the
policy.

## De-duplication, in both forms

For `<link>`:

> If multiple components render links to the same stylesheet, React will de-duplicate them and
> only put a single link into the DOM. Two links are considered the same if they have the same
> `href` prop.

For `<style>`: *"React will de-duplicate styles if they have the same `href`."*

**Same rule, same key.** And in both cases the de-duplication is tied to the opt-in — a
`<link rel="stylesheet">` without `precedence` gets no special behaviour at all, including this.

## What this means for CSS-in-JS

The `<style>` reference gives the design note that matters:

> Many style systems can work fine using a single precedence value because style rules are
> atomic.

**Atomic rules do not fight**, so their order does not matter, so one bucket is enough. That is
the shape of a utility-class system. A system with cascading component styles and theme overrides
needs the ranking, and needs its names decided deliberately — remembering that the rank comes from
discovery order.

The other half of the answer is the caveats: props read once, extraneous props dropped, elements
outliving their components. **A style system built on React's hoisting has to be one that emits
rules and never mutates them.** Anything that wants to update a `<style>` element in place is
building against the documented behaviour.

## Gotchas

**Symptom:** a stylesheet `<link>` renders in the body and does not deduplicate.
**Cause:** no `precedence`, so it gets no special behaviour — neither hoisting nor
de-duplication.
**Fix:** add `precedence`.

**Symptom:** a `nonce` or `media` prop vanished from an inline `<style>`.
**Cause:** *"React will drop all extraneous props when using the `precedence` prop (beyond `href`
and `precedence`)."*
**Fix:** do not rely on other props on a precedence-managed `<style>`; use a `<link>` or set the
policy elsewhere.

**Symptom:** a rarely used component's styles override everything.
**Cause:** it introduced a new precedence name, discovered last, and *"precedence values it
discovers later are 'higher'"*.
**Fix:** define the precedence names in one place, up front.

**Symptom:** a Suspense fallback appears where it never used to.
**Cause:** a component in that subtree started rendering a stylesheet `<link>`, and the component
that renders one *"will suspend while the stylesheet is loading"*.
**Fix:** expected behaviour — or hoist the link higher so the wait happens once.

**Symptom:** the same inline `<style>` is emitted for every list item.
**Cause:** no `href`, so there is no identity to de-duplicate on.
**Fix:** give the style a stable `href` name.

**Symptom:** changing a `<style>`'s content in state does nothing, with a development warning.
**Cause:** *"React will ignore changes to props after the style has been rendered."*
**Fix:** render a different style (a new `href`), rather than mutating one.

## Interview questions

**★ Why does a stylesheet `<link>` need `precedence` when a `<meta>` does not?**
Because stylesheet order is significant to the cascade. React moves these elements into the head,
so it needs to know where in the order this one belongs — and it refuses to guess, giving no
special behaviour at all when `precedence` is missing.

**★ Is `precedence="high"` higher than `precedence="medium"`?**
Only if React encountered `"high"` later. The values are ranked by discovery order — *"precedence
values it discovers first are 'lower' and precedence values it discovers later are 'higher'"* —
so the names are a convention, not a scale.

**★ What is `href` on a `<style>` tag?**
An identity for de-duplication, not a URL. Styles with the same `href` are inserted once, which is
what makes it safe for a component rendered many times to declare its own rules.

**★ What happens to the other props on a `<style precedence="…">`?**
They are dropped — everything beyond `href` and `precedence`. Silently, which makes a missing
`nonce` under a strict CSP a genuinely hard bug to trace.

**★ How do stylesheets interact with Suspense?**
A component rendering a stylesheet `<link>` suspends while it loads, so the boundary above shows a
fallback and the content arrives styled. Inline `<style>` tags do not trigger boundaries — there
is nothing to wait for.

**★ Do `<link>`, `<style>` and `preinit` compete for order?**
No — they share one ordering system. Stylesheets with the same precedence go together whichever
of the three produced them.

---

← Index: [Phase 11](README.md) ·
Prev: [`renderToStaticMarkup`](14-rendertostaticmarkup.md) ·
Next → [`<script async>` support (19)](16-async-scripts.md)
