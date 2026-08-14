---
title: "The three tags, prop by prop"
sidebar_label: "02 · The three tags"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<title>`](https://react.dev/reference/react-dom/components/title) (props, the
> single-title note, the text-only children rule),
> [`<meta>`](https://react.dev/reference/react-dom/components/meta) (the exactly-one-of props
> rule, both Usage sections) and
> [`<link>`](https://react.dev/reference/react-dom/components/link) (props, de-duplication,
> Caveats), with the [React 19 release post](https://react.dev/blog/2024/12/05/react-19) on why
> a metadata library still has a job.
> No sandbox script backs this page; claims are cited, not measured.

[Chunk 01](01-hoisting.md) covered the mechanism and when it switches off. This is the
surface: what each of the three tags accepts, and the three rules that catch people — one per
tag, and each one fails quietly.

## `<title>` — one, and text only

**Props:** all common element props, plus children:

> `children`: `<title>` accepts only text as a child. This text will become the title of the
> document. You can also pass your own components as long as they only render text.

🔴 **The trap is interpolation.** Children must be a single string of text, so the obvious JSX
does not work:

```jsx
// ❌ an error — two children, a string and a number
<title>Results page {pageNumber}</title>

// ✅ one child, one string
<title>{`Results page ${pageNumber}`}</title>
```

This surprises people because it is the one place in JSX where mixing text and an expression is
not fine. Build the string first, then pass it.

### Only one at a time

> Only render a single `<title>` at a time. If more than one component renders a `<title>` tag
> at the same time, React will place all of those titles in the document head. When this
> happens, the behavior of browsers and search engines is undefined.

Read what that does **not** say. React does not throw, does not warn, and does not pick a
winner — it puts every one of them in the head and stops having an opinion. *"Undefined"* is
the documentation declining to promise anything, and it is the strongest hint in these three
pages that composability has a limit.

⚠️ **This is the failure mode of the naive design.** A layout renders a default title, a page
renders its own, and now the document has two. Nothing breaks locally — your browser tab shows
*something* — and the cost lands in a search result weeks later. **Overriding a generic title
with a specific one is exactly the job React does not do**, and exactly the job the release
post says a library is still for:

> libraries can offer more powerful features like overriding generic metadata with specific
> metadata based on the current route.

So the rule of thumb: **one component owns the title for a given render.** Either the route
component always renders it, or you adopt a metadata library that resolves the conflict. What
you cannot do is render a fallback title in a layout and a real one in the page and expect the
second to win.

## `<meta>` — exactly one of four props

`<meta>` supports all common element props, and then:

> It should have *exactly one* of the following props: `name`, `httpEquiv`, `charset`,
> `itemProp`. The `<meta>` component does something different depending on which of these props
> is specified.

| Prop | What it means |
|---|---|
| `name` | *"Specifies the kind of metadata to be attached to the document."* |
| `charset` | *"Specifies the character set used by the document. The only valid value is `"utf-8"`."* |
| `httpEquiv` | *"Specifies a directive for processing the document."* |
| `itemProp` | *"Specifies metadata about a particular item within the document rather than the document as a whole."* |

and one more that pairs with three of them:

> `content`: a string. Specifies the metadata to be attached when used with the `name` or
> `itemProp` props or the behavior of the directive when used with the `httpEquiv` prop.

Note the two spellings that differ from raw HTML: **`charset`** (HTML writes `charset` too, but
`httpEquiv` is React's camelCase for `http-equiv`) — and `itemProp` for `itemprop`. These are
React prop names, and getting `itemProp`'s casing wrong changes behaviour rather than producing
an error, because a misspelled prop is just an unknown attribute.

### The `itemProp` fork, stated twice

The `<meta>` page has two Usage sections, and they are the two halves of chunk 01's exception
table:

> You can annotate the document with metadata such as keywords, a summary, or the author's
> name. React will place this metadata within the document `<head>` regardless of where in the
> React tree it is rendered.

versus

> You can use the `<meta>` component with the `itemProp` prop to annotate specific items within
> the document with metadata. In this case, React will *not* place these annotations within the
> document `<head>` but will place them like any other React component.

**Same tag, two jobs, one prop deciding which.** If you are emitting schema.org microdata
alongside visible content, `itemProp` is what keeps it next to the content it describes.

## `<link>` — the one with de-duplication and real caveats

**Props:**

- **`rel`** — *"a string, required. Specifies the relationship to the resource."*
- **`href`** — *"a string. The URL of the linked resource."*
- **`precedence`** — *"Tells React where to rank the `<link>` DOM node relative to others in
  the document `<head>`, which determines which stylesheet can override the other."*
- **`media`** — *"a string. Restricts the stylesheet to a certain media query."*
- **`disabled`** — *"a boolean. Disables the stylesheet."*
- **`crossOrigin`** — *"a string. The CORS policy to use. Its possible values are `anonymous`
  and `use-credentials`. It is required when `as` is set to `"fetch"`."*

`precedence` and `media` are stylesheet machinery and belong to
[topic 15](../15-stylesheets-and-precedence.md); what matters here is that `precedence` is also
the switch that decides whether a stylesheet link gets hoisted at all
([chunk 01](01-hoisting.md)).

### De-duplication

> If multiple components render links to the same stylesheet, React will de-duplicate them and
> only put a single link into the DOM. Two links are considered the same if they have the same
> `href` prop.

**Identity is the `href` and nothing else.** That is what makes the feature usable in a
component library: five components can each declare the stylesheet they need, and the document
gets one `<link>`.

Two documented cases where you do not get it:

- *"If the link doesn't have a `precedence` prop, there is no special behavior"*
- *"If you supply any of the `onLoad`, `onError`, or `disabled` props, there is no special
  behavior"*

Both are the same rule as hoisting, which is the tidy part of this design: **the conditions
that opt a `<link>` out of hoisting are the conditions that opt it out of de-duplication.** One
decision, two consequences.

### 🔴 The two caveats

> * React will ignore changes to props after the link has been rendered. (React will issue a
>   warning in development if this happens.)
> * React may leave the link in the DOM even after the component that rendered it has been
>   unmounted.

These are unlike anything else in React and they are worth sitting with.

**Props are read once.** Changing `href` on a rendered `<link>` does nothing — the element is
not re-reconciled the way an ordinary DOM node is. You get a development warning, so this one at
least tells you. The workaround is the React one: change the `key` so it is a different element
rather than the same element with different props.

**Unmounting may not remove it.** *"May"* is the operative word — React does not promise either
way. Removing a stylesheet as a component unmounts would cause a visible reflow for anything
still using it, and React declines to make that call. Treat a hoisted `<link>` as an
**append-only** contribution to the document for the lifetime of the page.

⚠️ **Both caveats are fine for the case the feature is for** — a component declaring a resource
it needs — and wrong for anything dynamic. A theme switcher that swaps stylesheet `href`s is
building on sand.

## Where the line falls between React and a metadata library

React gives you **placement**: the tag ends up in `<head>`, on the server as well as the
client, deduplicated by `href`. It does not give you **policy** — precedence between a layout's
generic metadata and a route's specific metadata, per-route defaults, or resolving two
components that both want to own the title. The release post is explicit that the intent is
cooperation, not replacement:

> These features make it easier for frameworks and libraries like `react-helmet` to support
> metadata tags, rather than replace them.

Which gives a straightforward rule: **use the tags directly when exactly one component owns each
piece of metadata**; reach for a library or your framework's metadata API the moment two do.

## Gotchas

**Symptom:** `<title>Page {n}</title>` throws.
**Cause:** `<title>` accepts only text as a child, as a single string. Text plus an expression
is two children.
**Fix:** interpolate first — `` <title>{`Page ${n}`}</title> ``.

**Symptom:** the tab title is right but search results show a generic one.
**Cause:** two components rendered a `<title>`; React put both in the head and the documented
behaviour of browsers and search engines is *undefined*.
**Fix:** make one component own the title, or use a metadata library that overrides by route.

**Symptom:** a `<meta>` tag does nothing.
**Cause:** it needs *exactly one* of `name`, `httpEquiv`, `charset`, `itemProp` — and `content`
alone attaches nothing.
**Fix:** pair `content` with `name`, `httpEquiv` or `itemProp`.

**Symptom:** the same stylesheet is linked five times in `<head>`.
**Cause:** the `href`s are not byte-identical, or the links have no `precedence` — both disable
de-duplication.
**Fix:** normalise the URL, and give it a `precedence`.

**Symptom:** changing a `<link>`'s `href` in state has no effect, with a development warning.
**Cause:** *"React will ignore changes to props after the link has been rendered."*
**Fix:** give the link a `key` that changes, so it is a new element rather than an updated one.

**Symptom:** stylesheets accumulate as the user navigates.
**Cause:** *"React may leave the link in the DOM even after the component that rendered it has
been unmounted."* This is documented behaviour, not a leak in your code.
**Fix:** design for it — hoisted links are append-only. Do not build a theme switcher out of
them.

## Interview questions

**★ Why does `<title>Results page {n}</title>` fail?**
Because `<title>` accepts only text as a child and expects a single string; the JSX above passes
two children. The documented form is `` <title>{`Results page ${n}`}</title> `` — build the
string, then pass it.

**★ Two components render a `<title>`. What does React do?**
It puts both in the document head and stops there. The reference says the behavior of browsers
and search engines is then *undefined* — there is no warning and no last-one-wins rule.
Overriding generic metadata with specific metadata is the job React leaves to a library.

**★ How does React decide two `<link>`s are the same?**
By the `href` prop, and only that. Matching links are de-duplicated to one DOM node — unless the
link has no `precedence`, or has `onLoad`, `onError` or `disabled`, each of which turns the
special behaviour off.

**★ What are the two caveats on a hoisted `<link>`?**
React ignores prop changes after it has rendered (with a development warning), and it may leave
the link in the DOM after the component that rendered it unmounts. Both make hoisted links a
poor fit for anything dynamic — change the `key` if you need a different link, and expect them
to accumulate.

**★ `<meta content="...">` on its own — what happens?**
Nothing useful. `<meta>` should carry *exactly one* of `name`, `httpEquiv`, `charset` or
`itemProp`, and `content` supplies the value for whichever of those is present. Alone, it
attaches no metadata to anything.

**★ When do you still want a metadata library in React 19?**
As soon as more than one component has an opinion about the same piece of metadata — a layout
default overridden per route being the standard case. React handles placement, de-duplication by
`href`, and server rendering; it does not resolve conflicts, and its own release post frames
libraries as supported rather than replaced.

---

← Prev: [Hoisting, and the four exceptions to it](01-hoisting.md) ·
Index: [10 · Document metadata](README.md) ·
Next → [Resource preloading](../11-resource-preloading/README.md)
