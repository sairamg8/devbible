---
title: "Hoisting, and the four exceptions to it"
sidebar_label: "01 · Hoisting"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<title>`](https://react.dev/reference/react-dom/components/title),
> [`<meta>`](https://react.dev/reference/react-dom/components/meta) and
> [`<link>`](https://react.dev/reference/react-dom/components/link) (Special rendering
> behavior sections), with the
> [React 19 release post](https://react.dev/blog/2024/12/05/react-19) for what changed and why.
> No sandbox script backs this page; claims are cited, not measured.

**React 19 made three HTML tags behave differently from every other tag: `<title>`, `<meta>`
and `<link>` are moved into the document's `<head>` no matter where you render them.** The
release post states it plainly — *"When React renders this component, it will see the
`<title>` `<link>` and `<meta>` tags, and automatically hoist them to the `<head>` section of
document."*

That is a small feature with a disproportionate effect on server rendering, which is why it
sits in this phase rather than in a components chapter.

## The problem it replaces

Before 19, the `<head>` was somebody else's territory. A component that knew the page's title —
the route component, the product page, the article — could not render it, because the only
valid place for `<title>` in the DOM is inside `<head>`, and `<head>` is nowhere near where
your tree is mounted. The workarounds were a portal, a side effect writing
`document.title`, or a library like `react-helmet` collecting metadata during render and
flushing it somewhere else.

None of those survives server rendering cleanly. A side effect does not run on the server at
all, so the HTML goes out with the wrong title and the browser fixes it after hydration —
which is exactly too late for a crawler. That is the gap React closed.

React's own framing of the trade-off is the sentence worth keeping:

> The `<head>` is the only valid place for `<title>` to exist within the DOM, yet it's
> convenient and keeps things composable if a component representing a specific page can
> render its `<title>` itself.

**Composability is the whole point.** The component that knows the fact declares the fact.

## What "hoist" actually means here

The same sentence appears, word for word except the tag name, on all three references:

> React will always place the DOM element corresponding to the `<title>` component within the
> document's `<head>`, regardless of where in the React tree it is rendered.

Three things follow from *"the DOM element corresponding to the component"*:

- **You still render a real element.** This is not a config object or a hook. `<title>` is in
  your JSX, in your component, subject to the same conditionals and props as anything else.
- **Position in the tree is irrelevant to position in the document.** A `<meta>` rendered
  twelve components deep inside a card ends up next to one rendered at the root.
- **It is React doing the moving, not the browser.** Which is why the exceptions below exist:
  React has to decide, from the props alone, whether a given tag is document-level metadata or
  something else that merely shares a tag name.

## 🔴 The four exceptions

Hoisting is not unconditional. Across the three references there are four documented cases
where React leaves the element exactly where you put it, and all four are the same judgement:
**this tag is not describing the document.**

| Exception | Tag | Why |
|---|---|---|
| Inside `<svg>` | `<title>` | it is an accessibility annotation for the graphic, not the page title |
| Has `itemProp` | `<title>`, `<meta>`, `<link>` | it is microdata about *a part of* the page |
| `rel="stylesheet"` with no `precedence` | `<link>` | React will not guess stylesheet order |
| Has `onLoad` or `onError` | `<link>` | you have taken over loading it yourself |

The wording for each, verbatim:

**`<title>` in an SVG** — *"If `<title>` is within an `<svg>` component, then there is no
special behavior, because in this context it doesn't represent the document's title but rather
is an accessibility annotation for that SVG graphic."*

**`itemProp` anywhere** — *"If the `<title>` has an `itemProp` prop, there is no special
behavior, because in this case it doesn't represent the document's title but rather metadata
about a specific part of the page."* `<meta>`'s page says the same about *"metadata about a
specific part of the page"*, and `<link>`'s says the same about *"metadata about a specific
part of the page"* rather than something that *"applies to the document"*.

**A stylesheet without a precedence** — *"If the `<link>` has a `rel="stylesheet"` prop, then
it has to also have a `precedence` prop to get this special behavior. This is because the order
of stylesheets within the document is significant, so React needs to know how to order this
stylesheet relative to others, which you specify using the `precedence` prop. If the
`precedence` prop is omitted, there is no special behavior."*

**`onLoad` or `onError`** — *"because in that case you are managing the loading of the linked
resource manually within your React component."*

⚠️ **Two of these fail silently in the direction you will not notice.** A stylesheet link
without `precedence` and a `<link>` with an `onLoad` handler both render **in place** — in the
body, where a `<link>` is not valid — and the page usually still works, because browsers are
forgiving. Nothing warns you. The tell is finding the tag in the DOM where you wrote it
instead of in `<head>`, which is exactly what you would expect if you had not read this page.

The stylesheet case is not a limitation to work around; it is the entry point to
[topic 15 · Stylesheets and `precedence`](../15-stylesheets-and-precedence.md), where
`precedence` earns its own topic.

## Why this belongs in the SSR phase

The release post gives the reason in one sentence:

> By supporting these metadata tags natively, we're able to ensure they work with client-only
> apps, streaming SSR, and Server Components.

**All three environments, one mechanism.** That is what the `document.title` side effect and
the portal never gave you. The server renderer emits the metadata into the `<head>` of the HTML
it produces, so the response a crawler sees already has the right title — no hydration
required, no second pass, no flash of the wrong title.

It also composes with the rest of this phase in ways worth naming:

- **[Topic 08 · Prerendering](../08-prerendering/README.md)** expects your tree to render the
  whole document, `<html>` included. Metadata hoisting is what makes that bearable: the page
  component still owns its own title even though a layout component owns the `<html>`.
- **[Topic 09 · Partial pre-rendering](../09-partial-prerendering/README.md)** stores a
  postponed render for later. Metadata that was emitted at build time is in the prelude, on
  disk, already correct.
- **[Topic 02 · Hydration mismatches](../02-hydration-mismatches.md)** is the failure mode to
  watch for: metadata derived from something that differs between server and client (a
  timestamp, a random id, `window`) is a mismatch like any other.

⬜ **What the references do not settle.** The three component pages describe *where* React puts
these tags; they do not describe what happens to a `<title>` rendered inside a Suspense
boundary that resolves **after** the shell — and therefore after `<head>` — has already been
flushed to the client. The release post says only that metadata *"work[s] with"* streaming SSR.
**This page does not assert an answer**, because no primary source settles it and there is no
run to appeal to. The safe design, and the one every framework's metadata API implies, is to
**render document-level metadata above your Suspense boundaries**, where it is part of the
shell. If you need it to depend on late data, treat that as a framework concern rather than
something to discover empirically in production.

## Gotchas

**Symptom:** a `<link rel="stylesheet">` renders in the body instead of `<head>`.
**Cause:** no `precedence` prop, so React deliberately gives it no special behavior — it will
not guess where the stylesheet belongs in the cascade.
**Fix:** add `precedence`, or accept the in-place rendering knowingly. See
[topic 15](../15-stylesheets-and-precedence.md).

**Symptom:** a `<link>` with an `onLoad` handler stopped being hoisted after you added the
handler.
**Cause:** `onLoad`/`onError` opt the element out — React takes it that you are managing the
resource yourself.
**Fix:** drop the handler if you want hoisting, or keep it and place the link yourself.

**Symptom:** `<title>` inside an SVG icon changed the page title on some other page.
**Cause:** it did not — `<title>` in an `<svg>` is an accessibility annotation and is never
hoisted. Something else set the title.
**Fix:** look for the real `<title>` element; the SVG one is not a candidate.

**Symptom:** microdata annotations disappeared from the body and turned up in `<head>`.
**Cause:** the `itemProp` prop was dropped or misspelled. `itemProp` is precisely what tells
React the tag describes part of the page rather than the document.
**Fix:** restore `itemProp`; check the casing — it is a React prop name, not the HTML
attribute spelling.

**Symptom:** the crawler sees the right title but the user briefly sees the wrong one.
**Cause:** a leftover `document.title` side effect racing the hoisted tag.
**Fix:** delete the effect. Rendering the tag is the whole mechanism now.

## Interview questions

**★ What changed about `<title>`, `<meta>` and `<link>` in React 19?**
React hoists them into the document's `<head>` regardless of where in the tree they are
rendered, so the component that knows a fact about the page can declare it. It works in
client-only apps, streaming SSR and Server Components with one mechanism — which is what the
`document.title` effect and the portal workarounds could not do.

**★ Name a case where React will *not* hoist one of these tags.**
Four: `<title>` inside an `<svg>`, any of the three with an `itemProp` prop, a
`<link rel="stylesheet">` without a `precedence` prop, and a `<link>` with `onLoad` or
`onError`. All four say the same thing — this element is not describing the document.

**★ Why does a stylesheet link need `precedence` to be hoisted?**
Because stylesheet order in the document is significant and React refuses to guess it. The
reference is explicit: *"React needs to know how to order this stylesheet relative to others,
which you specify using the `precedence` prop"*, and without it *"there is no special
behavior"*.

**★ Why does this feature matter more on the server than on the client?**
On the client you could always fix the title in an effect. On the server there are no effects —
the HTML is produced and sent. Native hoisting means the response already carries the correct
metadata, which is the only version a crawler or a link preview ever sees.

**★ Does this replace `react-helmet`?**
No, and React says so: these features *"make it easier for frameworks and libraries like
`react-helmet` to support metadata tags, rather than replace them."* React gives you placement;
a library gives you policy — route-based overriding of generic metadata with specific
metadata. [Chunk 02](02-the-three-tags.md) covers where that line falls.

---

← Index: [10 · Document metadata](README.md) ·
Next → [The three tags, prop by prop](02-the-three-tags.md)
</content>
