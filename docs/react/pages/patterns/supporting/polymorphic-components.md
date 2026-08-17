---
title: "Polymorphic components"
sidebar_label: "03 · Polymorphic components"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [Your First Component](https://react.dev/learn/your-first-component) and
> [Writing Markup with JSX](https://react.dev/learn/writing-markup-with-jsx) for
> the capitalization rule, [`ref` as a prop](https://react.dev/blog/2024/12/05/react-19)
> from the React 19 release notes, and
> [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
> for what happens when the element type changes between renders. HTML semantics
> from the WHATWG [HTML Standard](https://html.spec.whatwg.org/multipage/) and
> the W3C [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/).
> ⚠️ **"Polymorphic component" is a community term, not a React API.** React
> documents that a component type can be held in a capitalized variable; it does
> not document or name this pattern.
> No sandbox script backs this page; claims are cited, not measured.

**One component, a caller-chosen element. `<Button as="a" href="/pricing">` —
your styling and behaviour, their tag.**

## Why this exists, and it is not about styling

The usual framing is "I want my `<Button>` to sometimes be a link". The real
problem underneath is that **HTML elements are not interchangeable**, and the one
you pick is a promise to the browser and to assistive technology.

A `<button>` and an `<a href>` differ in ways CSS cannot paper over:

| | `<button>` | `<a href>` |
|---|---|---|
| Keyboard activation | `Enter` **and** `Space` | `Enter` only |
| Announced as | "button" | "link" |
| Middle-click / ⌘-click | nothing | opens in a new tab |
| Right-click menu | generic | "Copy link address", "Open in new tab" |
| In the browser's link list | no | yes |
| Works with JS disabled | no | yes |

So a "button" that navigates must really be an `<a>`, and a "link" that submits
a form must really be a `<button>`. Styling one to look like the other is fine;
**rendering the wrong element is a defect**, and it is the defect polymorphic
components exist to make easy to avoid.

The worst version of this — `<div onClick={...}>` styled as a button — is not
focusable, not keyboard-operable and has no role at all.

## The implementation

In plain JavaScript it is almost nothing:

```jsx
function Text({ as: Component = 'span', ...rest }) {
  return <Component {...rest} />;
}
```

```jsx
<Text>inline by default</Text>
<Text as="p">a paragraph</Text>
<Text as="h1" className="page-title">a heading</Text>
<Text as={Link} to="/pricing">a router link</Text>
```

**The rename to `Component` is mandatory, not stylistic.** JSX decides between a
DOM tag and a component by case: a lowercase name is compiled to the string
`"as"` and you would render an `<as>` element. This is the
[capitalization rule](../../phase-1-jsx/05-capitalization.md), and it is the single
most common way this pattern is got wrong the first time.

```jsx
function Text({ as = 'span', ...rest }) {
  return <as {...rest} />;      // ❌ renders <as>, silently
}
```

Because `as` accepts either a string tag or a component, `as={Link}` works
unchanged — which is what makes it useful with a router.

## Refs, and what React 19 changed

A design-system component almost always needs to forward a ref — a tooltip needs
to measure it, a menu needs to focus it. Before React 19 that meant wrapping
every polymorphic component in `forwardRef`. In React 19 `ref` is an ordinary
prop, so the spread already carries it:

```jsx
function Text({ as: Component = 'span', ...rest }) {
  return <Component {...rest} />;   // `ref` rides along inside ...rest
}
```

[`ref` as a prop](../../phase-2-components/09-ref-as-a-prop.md) is the page on that
change, including what still needs `forwardRef` and why `forwardRef` is on its
way out.

## The `asChild` alternative

There is a second approach, popularised by Radix: instead of taking a tag name,
take a boolean and merge your props onto the child the caller already wrote.

```jsx
<Button asChild>
  <a href="/pricing">Pricing</a>
</Button>
```

The trade-off, stated honestly:

- **`as`** is simpler to implement and to read; the caller passes a type.
- **`asChild`** gives the caller full control of the element and its attributes,
  and composes better when several wrappers each want to contribute props — but
  it requires cloning the child element to merge props, which means the caller
  must pass exactly one element, and prop-merge conflicts have to be resolved by
  the implementation rather than by JSX's last-key-wins.

*(Which to prefer is a judgement, not something documentation settles. `as`
covers the common case with far less machinery.)*

## The cost nobody mentions until they hit it

**In TypeScript, typing this properly is genuinely hard** — and since that is the
main argument against the pattern, here is the actual shape rather than a warning
about it.

The type has three jobs: capture which element was chosen, pull that element's
props in, and stop the element's props colliding with your own.

```tsx
import type { ElementType, ComponentPropsWithRef } from 'react';

type PolymorphicProps<E extends ElementType, OwnProps> =
  OwnProps &
  { as?: E } &
  Omit<ComponentPropsWithRef<E>, keyof OwnProps | 'as'>;
```

Read it clause by clause:

| Clause | What it is for |
|---|---|
| `E extends ElementType` | `E` is the chosen tag or component, inferred from the `as` the caller passed |
| `OwnProps` | your component's own API — `tone`, `size`, whatever |
| `{ as?: E }` | the prop that does the choosing, optional so the default applies |
| `ComponentPropsWithRef<E>` | every prop the chosen element accepts, `ref` included |
| `Omit<…, keyof OwnProps \| 'as'>` | **the load-bearing part** — drops the element's versions of any prop you also define, so your `size` wins over `<input>`'s `size` instead of producing an unusable intersection |

Used:

```tsx
type TextOwnProps = { tone?: 'default' | 'muted' };

function Text<E extends ElementType = 'span'>(
  { as, tone, ...rest }: PolymorphicProps<E, TextOwnProps>,
) {
  const Component = as ?? 'span';
  return <Component data-tone={tone} {...rest} />;
}
```

`<E extends ElementType = 'span'>` on the function is what makes inference work:
write `<Text as="a" href="/x" />` and `E` becomes `'a'`, so `href` is allowed and
checked. Omit `as` and the default `'span'` applies, so `href` is an error.

**And here is where it stops being pleasant.** *(Judgement, from the shape of the
type rather than from documentation.)*

- **The internal `<Component {...rest} />` usually will not type-check on its
  own.** TypeScript cannot prove that the props gathered for a generic `E` are
  valid for the specific element it resolves to, so most implementations end up
  with a cast at that one line. The cast is contained, but it means the
  component's *inside* is unchecked even though its *outside* is precise.
- **Error messages become unreadable.** A wrong prop on `<Text as="a">` reports
  against the expanded intersection, which for an anchor is well over a hundred
  members.
- **The `ref` story is version-sensitive.** `ComponentPropsWithRef` is the right
  helper today, but React 19's typings changed how `ref` flows for function
  components, so a type copied from a pre-19 blog post can be subtly wrong.
- **It degrades to `any` quietly.** Get one clause wrong and you keep
  compilation and lose every bit of checking the type existed to provide.

If your codebase is TypeScript and the component has two possible elements, two
components are often the honest answer:

```jsx
<Button>Save</Button>
<ButtonLink href="/pricing">Pricing</ButtonLink>
```

That is a real design choice, not a cop-out — it is discoverable, trivially
typed, and each one can require the props its element actually needs (`href`
mandatory on the link, `type` on the button).

## When it is the wrong answer

**When the variants are not really the same component.** If `as="a"` also needs
different padding, a different icon and a different hover state, you have two
components wearing one name.

**When it is being used to fix layout.** `as="div"` because a `<span>` would not
take a margin is a CSS problem solved in the wrong file.

**When the element list is unbounded.** Accepting any tag means accepting
`<table>`, `<option>` and `<script>`. Constrain it — in JS, by documenting the
supported set; in TypeScript, by unioning the allowed tags rather than taking
`ElementType`.

## Gotchas

**Changing `as` between renders remounts the subtree.** React reconciles by
element type: a different type means the old tree is destroyed and a new one
built, so DOM state, focus and any component state below are lost. That follows
from
[preserving and resetting state](../../phase-3-state/15-preserving-and-resetting.md)
and from
[identity and nesting](../../phase-2-components/01-function-components/02-identity-and-nesting.md).
Toggling `as` on a focused input will drop the focus.

**Props valid on one element are invalid on another.** `<Button as="a"
type="submit">` puts a meaningless `type` attribute on an anchor; `<Button
as="button" href="/x">` puts an `href` on a button, which does nothing. Nothing
in React catches either — it passes unknown attributes through to the DOM.

**Default styles change with the tag.** `as="div"` and `as="span"` differ in
`display`; `as="button"` brings the browser's own button styling and a default
`font` that does not inherit. A component that looked identical in every variant
during development can break the first time a caller picks a tag you did not try.

**`as={someComponent}` where the component is defined inline recreates the type
every render** — a new function identity is a new type, so React unmounts and
remounts. This is the general trap from
[function components](../../phase-2-components/01-function-components/README.md),
and `as` is an unusually easy way to fall into it.

**Accessibility does not follow automatically.** `as="div"` on something the user
clicks still needs `role`, `tabIndex` and a keyboard handler. The pattern makes
the *right* element easy to reach for; it does not stop you reaching for the
wrong one.

## Interview questions

**What is a polymorphic component?**
One that lets the caller choose the element or component it renders, usually
through an `as` prop, while keeping the original's styling and behaviour.

**Why does the implementation rename `as` to `Component`?**
JSX distinguishes DOM tags from components by capitalization. A lowercase `as`
compiles to the literal string `"as"` and renders an `<as>` element. Assigning it
to a capitalized variable is what makes it a component reference.

**Why is this an accessibility pattern rather than a styling one?**
Because `<button>` and `<a>` differ in keyboard behaviour, announced role and
browser affordances such as middle-click. Making the correct element easy to pick
is the point; CSS could already handle the appearance.

**What happens if `as` changes while the component is mounted?**
The element type changes, so React unmounts the old tree and mounts a new one —
state, focus and DOM state below that point are lost.

**What is the main cost?**
Typing it correctly in TypeScript. A proper polymorphic type is generic over the
element, merges that element's props, and handles `ref`; getting it slightly
wrong silently degrades to `any`. Two explicit components are often the better
trade.

---

← Prev: [The state reducer pattern](../08-state-reducer/README.md) · Index: [React patterns](../README.md) · Next → [04 · Prop getters](prop-getters.md)
