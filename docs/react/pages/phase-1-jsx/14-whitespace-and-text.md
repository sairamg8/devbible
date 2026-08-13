---
title: "Whitespace and text"
sidebar_label: "14 · Whitespace and text"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against **@babel/preset-react 7.29.7** and **react-dom
> 19.2.8** in **Firefox 153.0**. The compiled children arrays and the rendered
> text both come from `sandbox/react-p1/ex13-whitespace.mjs`.

**JSX decides what your indentation means at compile time, before React ever
sees it. The rule is short, and it is the reason a space disappears when you
break a line.**

## The rule

JSX removes whitespace that is **adjacent to a newline**, and keeps everything
else. Precisely:

1. Leading and trailing whitespace on each line is removed.
2. Blank lines are removed.
3. A newline **between two elements** is removed entirely.
4. A newline **between two words of text** becomes a single space.
5. Whitespace **within one line** is kept exactly as typed.

```console
$ node ex13-whitespace.mjs
=== 1. what the compiler does with the whitespace you typed ===

  one line:
    | <p><b>a</b> <i>b</i></p>
    => children: [_jsx("b", {children: "a"}), " ", _jsx("i", {children: "b"})]

  elements on separate lines:
    | <p>
    |   <b>a</b>
    |   <i>b</i>
    | </p>
    => children: [_jsx("b", {children: "a"}), _jsx("i", {children: "b"})]

  text on separate lines:
    | <p>
    |   Hello
    |   world
    | </p>
    => children: "Hello world"

  trailing spaces on one line:
    | <p>Hello   <b>you</b></p>
    => children: ["Hello   ", _jsx("b", {children: "you"})]
```

Compare rows two and three. Two elements on separate lines produce **two
children with nothing between them**; two words on separate lines produce
**one string with a space**. Rule 3 versus rule 4.

Row four is the one people misremember: **three spaces on one line stay three
spaces.** JSX does not collapse them — the *browser* does, at layout time,
under `white-space: normal`. Two different mechanisms, and only one of them can
be turned off with CSS.

## The disappearing space

```console
=== 2. the text that actually reached the DOM (production build) ===
  one line                          "a b"
  separate lines                    "ab"
  separate lines + {" "}            "a b"
```

This is the whole practical content of the page:

```jsx
<p><b>Hello</b> <i>world</i></p>       // "Hello world"

<p>
  <b>Hello</b>
  <i>world</i>
</p>                                    // "Helloworld"  ← the bug

<p>
  <b>Hello</b>{' '}
  <i>world</i>
</p>                                    // "Hello world"
```

Reformatting a long line — by hand or by Prettier — silently deletes the space
between two elements. `{' '}` is how you say "there is a space here and I mean
it". It survives reformatting because it is an expression, not whitespace.

Prettier itself inserts `{' '}` when it breaks a line that had a meaningful
space, so in a Prettier-formatted codebase this mostly self-corrects. In one
that is not, it is a common review comment.

## Entities and the two kinds of space

```console
  entity:
    | <p>a&nbsp;&amp;&nbsp;b</p>
    => children: "a\xA0&\xA0b"
```

```console
  entities                          "a & b"
  {" "} vs &nbsp;                   "a b c"
```

```console
=== 3. the two space characters, by code point ===
  {" "}   -> U+0020 SPACE            collapsed by CSS: yes
  &nbsp;  -> U+00A0 NO-BREAK SPACE   collapsed by CSS: no
```

HTML entities work in JSX **text**, and are resolved by the compiler — `&nbsp;`
becomes the actual U+00A0 character in the string. They do **not** work inside
`{}`, where you are in JavaScript: write `{' '}` or `{'&nbsp;'}`-as-literal-
text-you-did-not-want.

The two are not interchangeable:

- `{' '}` is an ordinary space. It collapses with neighbouring whitespace and
  is a line-break opportunity.
- `&nbsp;` does neither — which is what you want between a number and its unit
  (`5&nbsp;kg`), or before a trailing punctuation mark you do not want orphaned.

Because `&nbsp;` is invisible in source, prefer `{' '}` in a codebase where
someone might "clean up" the entity.

## Strings in braces are literal

```console
  {"   "} literal                   "a   b"
  template literal                  "a\n  b"
```

Anything inside `{}` is a JavaScript value and reaches the DOM untouched —
including newlines from a template literal. The compile-time rules above apply
only to JSX *text*, never to expressions.

That gives you the escape hatch for preformatted content:

```jsx
<pre>{`line one
line two`}</pre>
```

with `white-space: pre` (or a `<pre>`) so the browser does not collapse it
either. Two layers, both of which must cooperate.

## Multi-line text

```jsx
<p>
  This paragraph is long enough to wrap in the source, and JSX will join the
  lines with single spaces, which is exactly what prose wants.
</p>
```

That works and is the normal way to write prose in JSX. It breaks only when a
line ends with something that must touch the next — punctuation next to an
element, or a word next to `{value}`:

```jsx
<p>
  Signed in as {name}                    {/* fine: newline before {name} → space */}
</p>

<p>
  Hello, {name}
  !                                       {/* "Hello, Ada !" — an orphaned mark */}
</p>
```

## Gotchas

**Symptom:** two words run together after you reformatted the JSX.
**Cause:** the space between two elements was on a line boundary, and JSX
removes it.
**Fix:** `{' '}` at the end of the first line.

**Symptom:** an extra space appears where you did not want one.
**Cause:** text and an element on the same line, with whitespace between them —
kept verbatim.
**Fix:** move the element to its own line, or close up the source.

**Symptom:** `&nbsp;` renders as the literal text `&nbsp;`.
**Cause:** it is inside `{}`, where you are in JavaScript, not JSX text.
**Fix:** `{' '}`.

**Symptom:** a multi-line template literal renders on one line.
**Cause:** the newline is in the string, but CSS collapsed it at layout time.
**Fix:** `white-space: pre-wrap`, or a `<pre>`.

**Symptom:** indentation from a template literal appears on screen.
**Cause:** the opposite — `white-space: pre` is on, and the source's indentation
is part of the string.
**Fix:** dedent the literal, or build the string without leading spaces.

**Symptom:** a number and its unit break across lines at the end of a
paragraph.
**Cause:** an ordinary space is a break opportunity.
**Fix:** a non-breaking space.

## Interview questions

**★ Why does the space between two elements disappear when you put them on
separate lines?**
JSX strips whitespace adjacent to a newline at compile time. A newline between
two *elements* is removed entirely; a newline between two *words* becomes a
single space. Use `{' '}` to keep a space that must survive reformatting.

**Does JSX collapse multiple spaces?**
Not within a line — three spaces typed on one line compile to three spaces in
the string. What collapses them is the browser's `white-space: normal`, at
layout time. They are separate mechanisms, and only the CSS one can be turned
off.

**What is the difference between `{' '}` and `&nbsp;`?**
`{' '}` is U+0020, which collapses with adjacent whitespace and allows a line
break there. `&nbsp;` is U+00A0, which does neither. Use the second between a
value and its unit.

**Do HTML entities work in JSX?**
In JSX text, yes — the compiler resolves them into the actual characters. Inside
`{}` you are in JavaScript, so write the escape (`' '`) instead.

**How do you render preformatted text?**
Put the string in an expression — a template literal keeps its newlines — and
make sure CSS does not collapse them, with `<pre>` or `white-space: pre-wrap`.

---

← Prev: [Form elements in JSX](13-form-elements/README.md) · Index: [Phase 1](README.md) · Next → [The classic runtime](15-the-classic-runtime.md)
