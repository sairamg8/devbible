---
title: "What can be rendered"
sidebar_label: "03 · What can be rendered"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **react-dom 19.2.8** in **Firefox 153.0**, both a
> production and a development bundle. Error strings are quoted from the run of
> `sandbox/react-p1/ex02-what-renders.mjs` — the dev build for the readable
> text, the prod build for the minified code.

**React accepts a short list of things in a child slot: strings, numbers,
bigints, elements, and anything iterable containing those. Everything else
either renders nothing or throws — and which one it does is not obvious.**

## The full table, measured

```console
$ node ex02-what-renders.mjs
=== what a JSX expression slot renders (production build) ===
  'text'                   -> "<span>text</span>"
  42                       -> "<span>42</span>"
  10n (bigint)             -> "<span>10</span>"
  <b>elem</b>              -> "<span><b>elem</b></span>"
  ['a', 'b']               -> "<span>ab</span>"
  new Set(["x","y"])       -> "<span>xy</span>"
  a generator              -> "<span>g1g2</span>"
  new Map([["k","v"]])     -> "<span>kv</span>"
  Symbol("s")              -> "<span></span>"
  () => "fn"               -> "<span></span>"
  {a: 1}                   THROWS  Minified React error #31; visit
                             https://react.dev/errors/31?args[]=object%20with%20keys%20%7Ba%7D …
  new Date()               THROWS  Minified React error #31; …args[]=%5Bobject%20Date%5D …
  Promise.resolve(1)       -> ""
```

Three different outcomes, and the difference matters:

| Outcome | Values |
|---|---|
| **Renders** | strings, numbers, bigints, elements, arrays, `Set`, `Map`, generators |
| **Renders nothing, silently** | `null`, `undefined`, `true`, `false`, symbols, functions |
| **Throws** | plain objects, `Date`, any other non-iterable object |
| **Suspends** | a promise |

## The error, in full

The production build gives you an error *code*. The development build gives you
the sentence people quote:

```console
=== dev: the three values that only complain in development ===
  {a: 1}      THROWS  Objects are not valid as a React child (found: object with keys {a}).
                      If you meant to render a collection of children, use an array instead.
  new Date()  THROWS  Objects are not valid as a React child (found: [object Date]).
                      If you meant to render a collection of children, use an array instead.
```

The parenthetical is the useful half. `object with keys {a}` names the shape you
passed, and `[object Date]` names the class. When you meet this in production
you get `Minified React error #31` and a URL with the same detail encoded in
`args[]` — decode it rather than rebuilding a dev bundle.

### The three ways people hit it

```jsx
<p>{user}</p>                       // 1. the whole object instead of a field
<p>{new Date()}</p>                 // 2. a Date — render it as a string
<p>{await getUser()}</p>            // 3. an object from an unwrapped promise
```

Fix them by naming what you want: `{user.name}`,
`{date.toLocaleDateString()}`, `{JSON.stringify(value)}` when you genuinely
want to dump it.

## Iterables render — including the ones you did not intend

```console
  new Set(["x","y"])       -> "<span>xy</span>"
  new Map([["k","v"]])     -> "<span>kv</span>"
  a generator              -> "<span>g1g2</span>"
```

A `Set` renders. So does a `Map` — it iterates to `["k", "v"]` pairs, which are
arrays of strings, which render. React works, and warns:

```console
  [error] Using Maps as children is not supported. Use an array of keyed
          ReactElements instead.
  [error] Using Iterators as children is unsupported and will likely yield
          unexpected results because enumerating a generator mutates it. You
          may convert it to an array with `Array.from()` or the `[...spread]`
          operator before rendering. You can also use an Iterable that can
          iterate multiple times over the same items.
```

The generator warning explains itself: a generator is consumed by rendering it,
so the *second* render finds it empty. In StrictMode, which double-renders in
development, that is a component that draws its list once and then blanks.

**Convert first.** `[...set]`, `Array.from(map.values())`, `[...gen]` — and
then add keys.

## Silence is not success

```console
  Symbol("s")              -> "<span></span>"
  () => "fn"               -> "<span></span>"
```

Neither throws. Both render nothing at all. The development build does say
something:

```console
  [error] Symbols are not valid as a React child.
  [error] Functions are not valid as a React child. This may happen if you
          return Component instead of <Component /> from render. Or maybe you
          meant to call this function rather than return it.
```

The function case is the one that bites: `{MyComponent}` instead of
`{<MyComponent />}` produces an empty element and no production error at all.

## A promise child suspends

```console
  Promise.resolve(1)       -> ""
```

Not `<span></span>` — **nothing at all**, not even the wrapper. The root
suspended and committed no DOM. React 19 can unwrap a promise in a child
position, but only under a `<Suspense>` boundary that provides a fallback;
without one, everything above it is withheld. Phase 8 covers this properly;
here, treat "my component vanished" as a symptom worth recognising.

## What a component may return

The same list, plus one more option:

```jsx
function A() { return <div/>; }             // an element
function B() { return null; }               // nothing — the idiomatic way
function C() { return 'text'; }             // a string
function D() { return [<a key="1"/>, <b key="2"/>]; }  // an array (needs keys)
function E() { return <>{'a'}{'b'}</>; }    // a fragment
function F() { return createPortal(<div/>, node); }    // a portal
function G() { }                            // ✗ undefined — throws
```

Returning `undefined` — usually a `return` on its own line before the JSX, or a
missing `return` in an arrow function with a block body — throws
`Nothing was returned from render`. Returning `null` is fine and explicit.

## Gotchas

**Symptom:** `Objects are not valid as a React child (found: object with keys {a})`.
**Cause:** an object reached a text position — commonly the whole record instead
of one field.
**Fix:** read the keys named in the message; render a field, or stringify
deliberately.

**Symptom:** the same error naming `[object Date]`.
**Cause:** a `Date` is an object, and React does not call `toString` for you.
**Fix:** format it — `date.toISOString()`, `Intl.DateTimeFormat`, etc.

**Symptom:** a list renders once and is empty on the next render.
**Cause:** a generator or other one-shot iterator used directly as children;
rendering consumed it. StrictMode's double render makes it visible immediately.
**Fix:** `[...iterator]` into an array first.

**Symptom:** a component renders an empty element and no error.
**Cause:** `{MyComponent}` — a function in a child slot renders nothing.
**Fix:** `{<MyComponent />}`, or call it if it really is a helper.

**Symptom:** part of the page disappears entirely with no DOM and no error.
**Cause:** a promise in a child slot suspended the nearest boundary — and there
was none, so the whole root withheld its commit.
**Fix:** add a `<Suspense fallback={…}>`, or resolve the value before rendering.

**Symptom:** `Minified React error #31` in production with no readable text.
**Cause:** production builds ship error codes, not sentences.
**Fix:** open the `react.dev/errors/31?args[]=…` URL from the message — the
arguments carry the same detail the dev build would print.

## Interview questions

**★ What types can React render as children?**
Strings, numbers, bigints, React elements, and iterables of those — arrays,
`Set`s, generators. `null`, `undefined`, `true` and `false` render nothing.
Plain objects and `Date`s throw. Functions and symbols render nothing but warn
in development.

**★ What causes "Objects are not valid as a React child"?**
A non-iterable object in a child position — typically the whole object instead
of one of its fields, a `Date`, or the result of an unresolved promise. The
development message names the object's keys or class.

**Can a component return an array?**
Yes, since React 16. Each element needs a key, exactly as in a mapped list. A
fragment is usually clearer.

**What happens if a component returns `undefined`?**
React throws `Nothing was returned from render`. Return `null` to render
nothing on purpose. The usual cause is a missing `return`, or a `return` with
the JSX starting on the next line.

**Why is rendering a `Set` fine but rendering a `Map` warned about?**
Both are iterable, so both render. React warns about `Map` because iterating it
yields `[key, value]` pairs rather than elements, so the output is rarely what
you meant and there are no keys. Convert to an array of keyed elements.

**What happens when you render a promise?**
React 19 treats it as suspended work. Without a `<Suspense>` boundary above it,
nothing commits — the subtree simply does not appear, with no error.

---

← Prev: [Embedding expressions](02-embedding-expressions.md) · Index: [Phase 1](README.md) · Next → [Attributes vs props](04-attributes-vs-props.md)
