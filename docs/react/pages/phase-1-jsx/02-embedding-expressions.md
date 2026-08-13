---
title: "Embedding expressions"
sidebar_label: "02 · Embedding expressions"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **react-dom 19.2.8** in **Firefox 153.0**. Every
> markup string below was read off a live DOM node by
> `sandbox/react-p1/ex02-what-renders.mjs`.

**Curly braces take an *expression* — something with a value — and put that
value into the tree. Not a statement. And React's rules about which values
disappear are the source of the single most common visual bug in React.**

## Expression, not statement

```jsx
<p>{user.name.toUpperCase()}</p>          // ✓ a call has a value
<p>{items.length > 0 ? 'some' : 'none'}</p> // ✓ a ternary has a value
<p>{items.map(i => <li key={i.id}/>)}</p>   // ✓ map returns an array

<p>{if (x) { 'yes' }}</p>                 // ✗ `if` is a statement
<p>{for (const i of items) …}</p>          // ✗ so is `for`
<p>{const x = 1}</p>                       // ✗ so is a declaration
```

Those three fail at **compile time**, not at render. If you need a statement,
put it above the `return`:

```jsx
function Status({items}) {
  let label;
  if (items.length === 0) label = 'Empty';
  else if (items.length === 1) label = 'One item';
  else label = `${items.length} items`;
  return <p>{label}</p>;
}
```

Braces work in three places, and mean the same thing in all three:

```jsx
<img src={url} alt={caption} />        {/* attribute value  */}
<p>{greeting}</p>                       {/* child            */}
<div style={{margin: 8}} />             {/* an object literal — two braces:
                                            one for the expression slot, one
                                            for the object */}
```

## What each value actually renders

Every row below is a live render of `<span>{value}</span>`, with the resulting
markup printed verbatim:

```console
$ node ex02-what-renders.mjs
=== what a JSX expression slot renders (production build) ===
  null                     -> "<span></span>"
  undefined                -> "<span></span>"
  false                    -> "<span></span>"
  true                     -> "<span></span>"
  '' (empty string)        -> "<span></span>"
  0                        -> "<span>0</span>"
  NaN                      -> "<span>NaN</span>"
  -0                       -> "<span>0</span>"
  42                       -> "<span>42</span>"
  'text'                   -> "<span>text</span>"
  [] (empty array)         -> "<span></span>"
  ['a', 'b']               -> "<span>ab</span>"
  ['a', null, 'b']         -> "<span>ab</span>"
```

The rule in one line: **`null`, `undefined`, `true` and `false` render nothing.
Everything else that is a primitive renders as text.**

`0` is a number, so it renders. So does `NaN`. That single fact is responsible
for the `0` that appears in the corner of a page when a list is empty — see
[Conditional rendering](06-conditional-rendering.md), where it is measured.

`-0` renders `"0"`, because it is stringified with `String(-0)`, which is
`"0"` — not `"-0"`.

## The four falsy values that are not the same

| Value | Renders | Why it matters |
|---|---|---|
| `null` | nothing | The idiomatic "render nothing" |
| `undefined` | nothing | A missing prop renders nothing rather than crashing |
| `false` | nothing | This is what makes `cond && <X/>` work |
| `true` | nothing | So `cond \|\| <X/>` silently renders nothing when `cond` is `true` |
| `0` | **`0`** | The trap |
| `''` | nothing | Not a special case — it is an empty text node |
| `NaN` | **`NaN`** | Usually a division or a `parseInt` that failed |

## Arrays flatten, and `null` inside them disappears

`['a', null, 'b']` rendered `"ab"`. React walks arrays, skips the nothings, and
concatenates the rest. Nested arrays flatten too — `[['a'], ['b']]` rendered
`"ab"`.

That is what makes this work without any wrapper:

```jsx
<ul>
  {header && <li className="header">…</li>}
  {items.map(i => <li key={i.id}>{i.name}</li>)}
  {footer ? <li className="footer">…</li> : null}
</ul>
```

Three children: a boolean-or-element, an array, and an element-or-null. React
flattens the array and drops the nothings.

## Whitespace inside braces is yours

```console
  {"   "} literal                   "a   b"
```

A string literal in braces is a value, so React renders it exactly. That is the
difference between `{' '}` and the whitespace you typed between two lines of
JSX — the latter is a compile-time decision. See
[Whitespace and text](14-whitespace-and-text.md).

## Comments

There is no comment syntax in JSX. `{/* … */}` is an expression slot containing
a JavaScript block comment, which evaluates to `undefined` — which renders
nothing. It works by accident of the rules above, not by design.

```jsx
<div>
  {/* this is fine */}
  <!-- this is a syntax error -->
</div>
```

## Gotchas

**Symptom:** a stray `0` appears where a list should be.
**Cause:** `{items.length && <List/>}` — `0` is falsy so `&&` returns `0`, and
`0` renders.
**Fix:** `{items.length > 0 && <List/>}`.

**Symptom:** `NaN` appears on the page.
**Cause:** arithmetic on `undefined` — usually a prop that has not arrived yet,
or `parseInt` on a non-numeric string.
**Fix:** guard the value, not the display: `{Number.isFinite(n) ? n : '—'}`.

**Symptom:** "Unexpected token" pointing at an `if` inside JSX.
**Cause:** braces take an expression; `if` is a statement.
**Fix:** move the branch above the `return`, or use a ternary.

**Symptom:** an object literal in an attribute throws a parse error.
**Cause:** `style={margin: 8}` — one set of braces, so the parser sees a label,
not an object.
**Fix:** two braces: `style={{margin: 8}}`.

**Symptom:** a value renders as `"[object Object]"` or throws "Objects are not
valid as a React child".
**Cause:** an object reached a child slot.
**Fix:** pick the field you meant, or `JSON.stringify` deliberately. See
[What can be rendered](03-what-can-be-rendered.md).

## Interview questions

**★ Which values render nothing in JSX?**
`null`, `undefined`, `true` and `false`. Empty strings and empty arrays also
produce no visible output. Everything else primitive is stringified — including
`0` and `NaN`, which is why `{count && <X/>}` can leave a `0` on screen.

**★ Why does `{items.length && <List/>}` sometimes show a `0`?**
`&&` returns its left operand when that operand is falsy. With an empty array
the left operand is the number `0`, and `0` is a value React renders as text.
Use `items.length > 0 &&` or a ternary.

**★ Can you put an `if` inside JSX braces?**
No — braces hold an expression. Use a ternary, `&&`, a lookup object, or move
the branching above the `return` into a variable.

**Why does `style` need two sets of braces?**
The outer braces open a JavaScript expression slot; the inner braces are the
object literal itself. `style={{margin: 8}}` is `style={ {margin: 8} }`.

**How do you write a comment inside JSX?**
`{/* … */}` — an expression slot containing a block comment. It evaluates to
`undefined`, which renders nothing. HTML comment syntax is a parse error.

**What happens to `null` entries inside an array of children?**
They are skipped. React flattens arrays, including nested ones, and drops
`null`, `undefined` and booleans while concatenating the rest.

---

← Prev: [JSX is a function call](01-jsx-is-a-function-call.md) · Index: [Phase 1](README.md) · Next → [What can be rendered](03-what-can-be-rendered.md)
