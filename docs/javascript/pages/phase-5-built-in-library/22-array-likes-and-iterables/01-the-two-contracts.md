---
title: "1 · The two contracts"
sidebar_label: "1 · The two contracts"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols), [`Symbol.iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/iterator), [`arguments`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments), [`String.prototype[Symbol.iterator]()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/Symbol.iterator), [`NodeList`](https://developer.mozilla.org/en-US/docs/Web/API/NodeList), [`HTMLCollection`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCollection), [`Document.querySelectorAll()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelectorAll), [`Document.getElementsByTagName()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/getElementsByTagName), [`Node.childNodes`](https://developer.mozilla.org/en-US/docs/Web/API/Node/childNodes). Documentation-validated; **no timings**.

## Array-like

**A value is array-like if it has a `length` and integer-keyed properties.** That is the
whole definition — there is no marker, no interface, no check the language performs:

```js
const arrayLike = { 0: "a", 1: "b", length: 2 };

arrayLike[0];        // "a"
arrayLike.length;    // 2
arrayLike.map;       // 🔴 undefined — no array methods
[...arrayLike];      // 🔴 TypeError: arrayLike is not iterable
```

⚠️ **It is a *shape*, not a type.** Nothing declares itself array-like; code simply treats
it that way by reading `length` and indices. Which is why the "is this array-like?" check
in [chunk 2](./02-converting-correctly.md) is harder than it looks.

## Iterable

**A value is iterable if it has a `[Symbol.iterator]` method** that returns an iterator.
That one method is what powers four separate pieces of syntax:

```js
for (const x of value) { }        // for...of
[...value];                       // spread
const [a, b] = value;             // array destructuring
Promise.all(value);               // and everything built on iteration
```

```js
const iterable = {
  *[Symbol.iterator]() { yield "a"; yield "b"; },
};

[...iterable];       // ✅ ["a", "b"]
iterable.length;     // 🔴 undefined — no length, no indices
iterable[0];         // 🔴 undefined
```

**The protocol itself — writing `Symbol.iterator` by hand, the `next()` contract,
generators — is Phase 6 · The iteration protocols** *(another chunk's topic)*. Here it is
enough that the method exists or it does not.

## The grid

| | Array-like | Iterable | Has array methods |
|---|---|---|---|
| `Array` | ✅ | ✅ | ✅ |
| **string** | ✅ | ✅ | ❌ (its own methods instead) |
| `arguments` | ✅ | ✅ | ❌ |
| `NodeList` | ✅ | ✅ | ❌ — but it does have `forEach` |
| `HTMLCollection` | ✅ | ✅ | ❌ — and **no `forEach`** |
| `{ length: 2 }` | ✅ | ❌ | ❌ |
| a **function** | ⚠️ accidentally — it has `length` | ❌ | ❌ |
| `Set`, `Map` | ❌ — `size`, not `length` | ✅ | ❌ |
| a generator object | ❌ | ✅ | ❌ |
| `TypedArray` | ✅ | ✅ | ✅ most of them |

**Three rows are worth stopping on.**

🔴 **A function has a `length`** — its declared arity — and a `name`. So any check of the
form `typeof x.length === "number"` says yes to every function in the program. That is the
trap in [chunk 2](./02-converting-correctly.md).

🔴 **`Set` and `Map` are iterable but not array-like.** They expose `size`, not `length`,
and have no indices at all — so `Array.from` and spread work, but nothing indexed does
([17 · `Set`](../17-set.md), [10 · `Map` vs a plain object](../10-map-vs-object/README.md)).

🔴 **`HTMLCollection` has no `forEach`.** `NodeList` gained `forEach`, `entries`, `keys`
and `values`; `HTMLCollection` has only `item()` and `namedItem()`. It is the most common
reason `collection.forEach is not a function` appears in a browser console.

## A string satisfies both — and the two views disagree

```js
const s = "é";      // "é" written as e + combining accent
s.length;                 // 2  — code units
[...s].length;            // 2  — code points
```

```js
const thumb = "👍";
thumb.length;             // 🔴 2 — one code point stored as a surrogate pair
thumb[0];                 // 🔴 a lone surrogate — not a character
[...thumb].length;        // ✅ 1 — iteration works in code points
```

🔴 **Indexing a string reads UTF-16 code units; iterating a string reads code points.**
They are two different traversals of the same value, and they disagree for anything
outside the Basic Multilingual Plane — which today means most emoji
([Phase 1 · 10 · Strings are UTF-16](../../phase-1-values-and-coercion/10-strings-are-utf16.md)).

⚠️ **And neither of them is a character count.** A grapheme cluster — an emoji with a
skin-tone modifier, a ZWJ family, a letter with a combining accent — is several code
points. `Intl.Segmenter` is the only correct answer
([20 · 03](../20-intl/03-text-collator-list-plural-segmenter.md)):

```js
"👍🏽".length;                                            // 4  code units
[..."👍🏽"].length;                                       // 2  code points
[...new Intl.Segmenter().segment("👍🏽")].length;         // 1  ✅ what a reader sees
```

**The practical rule: use `for...of` or spread on strings, never a `for (let i = 0; i <
s.length; i++)` loop**, unless you are deliberately working in code units.

## `arguments`, and why it still comes up

```js
function old() {
  arguments.length;        // ✅ array-like
  arguments[0];            // ✅
  arguments.map;           // 🔴 undefined
  [...arguments];          // ✅ it IS iterable
}
```

**`arguments` is the historical array-like** — the object every non-arrow function gets,
holding the arguments actually passed regardless of the declared parameters. Three facts
worth carrying:

- **It has no array methods**, which is why `Array.prototype.slice.call(arguments)`
  appears in every codebase written before 2015.
- **Arrow functions do not have it.** An arrow sees the enclosing function's `arguments`,
  which is a subtle source of wrong values.
- 🔴 **Rest parameters replaced it entirely**, and give you a real array:

```js
function modern(...args) {
  args.map(f);             // ✅ a genuine Array, arrow-safe, and self-documenting
}
```

The parameter-side detail — rest versus `arguments`, the non-strict aliasing between
`arguments` and named parameters — is
[Phase 3 · 02 · 02](../../phase-3-functions/02-parameters/02-rest-destructuring-arguments.md).

## Live versus static — the DOM's own trap

**Some DOM collections are *live*: they re-reflect the document every time you touch
them.**

| Returned by | Type | Live? |
|---|---|---|
| `querySelectorAll` | `NodeList` | ❌ **static** — a snapshot |
| `childNodes` | `NodeList` | ✅ live |
| `getElementsByTagName` / `getElementsByClassName` | `HTMLCollection` | ✅ live |
| `document.forms`, `document.images`, `element.children` | `HTMLCollection` | ✅ live |

🔴 **This loop never terminates in the way you expect:**

```js
const items = document.getElementsByClassName("item");
for (let i = 0; i < items.length; i++) {
  items[i].remove();      // 🔴 the collection shrinks under the loop
}
```

**Each removal shortens `items` immediately**, so `i` advances past elements that shifted
down and roughly half of them survive. The same shape with `appendChild` inside the loop
is a genuine infinite loop, because the collection grows as fast as `i` does.

✅ **Two fixes, and the first is the one to reach for:**

```js
document.querySelectorAll(".item").forEach((el) => el.remove());   // static snapshot

[...document.getElementsByClassName("item")].forEach((el) => el.remove());  // snapshot it
```

⚠️ **Converting to an array is not just for `.map` — it is how you freeze a live
collection.** That is the strongest everyday reason to convert at all.

**Live collections are not a mistake**, though: a live `element.children` that stays
correct as the DOM changes is exactly right for code that observes rather than mutates.
The DOM side is [Phase 9 · 07 · 01 · The two families](../../phase-9-dom/07-traversal/01-the-two-families.md).

## Gotchas

**Symptom:** `TypeError: x is not iterable` from spread or `for...of`
**Cause:** The value is array-like but has no `[Symbol.iterator]` — a plain
`{length, 0, 1}` object, or an API result shaped like one.
**Fix:** `Array.from(x)`, which accepts array-likes too.

**Symptom:** `collection.forEach is not a function`
**Cause:** It is an `HTMLCollection`, which has only `item` and `namedItem`. `NodeList`
is the one with `forEach`.
**Fix:** `[...collection].forEach(…)`, or select with `querySelectorAll`.

**Symptom:** `.map is not a function` on `arguments`, a `NodeList` or a string
**Cause:** None of them inherit from `Array.prototype`.
**Fix:** Convert first — or use rest parameters instead of `arguments`.

**Symptom:** Removing elements in a loop left about half of them
**Cause:** A live `HTMLCollection` shrinks as you remove, so the index skips.
**Fix:** Snapshot it — `querySelectorAll`, or spread into an array.

**Symptom:** Appending inside a loop over `getElementsByTagName` hung the tab
**Cause:** The live collection grows at least as fast as the index.
**Fix:** Snapshot before looping.

**Symptom:** `"👍".length` is 2, and `s[0]` printed a broken character
**Cause:** Indexing reads UTF-16 code units; the emoji is a surrogate pair.
**Fix:** Iterate, or spread. For a true character count, `Intl.Segmenter`.

**Symptom:** `arguments` was empty or held the wrong values inside an arrow function
**Cause:** Arrows have no `arguments`; the identifier resolves to the enclosing function's.
**Fix:** A rest parameter.

**Symptom:** An "is it array-like?" check accepted a function
**Cause:** Functions have a `length` — their arity.
**Fix:** See the detection section in [chunk 2](./02-converting-correctly.md).

## Interview questions

**★ What is the difference between array-like and iterable?**
Array-like means the value has a `length` and integer-keyed properties — a shape, not a
type. Iterable means it has a `[Symbol.iterator]` method, which is what `for...of`, spread
and array destructuring use. Neither implies the other: `{length: 2}` is array-like but not
iterable, and a `Set` is iterable but not array-like. Neither gives you array methods.

**★ Why can't you call `.map` on a `NodeList`?**
Because `NodeList` does not inherit from `Array.prototype`. It has its own `forEach`,
`entries`, `keys` and `values`, but no `map`, `filter` or `reduce`. `HTMLCollection` does
not even have `forEach`. Convert with `Array.from` or spread.

**★ Why does removing elements while looping over `getElementsByClassName` skip half of
them?**
Because that returns a **live** `HTMLCollection` — it re-reflects the document, so each
removal shortens it while the index keeps advancing. `querySelectorAll` returns a static
`NodeList` instead, and spreading a live collection into an array snapshots it.

**★ How many characters is `"👍".length`?**
It reports 2, because `length` counts UTF-16 code units and that emoji is a surrogate
pair. Spreading gives 1 because string iteration works in code points. Neither is a
character count in general — a grapheme cluster can be several code points, which is what
`Intl.Segmenter` is for.

**What is `arguments`, and what replaced it?**
The array-like object of actual arguments that every non-arrow function receives. Rest
parameters replaced it: they give a real array, they work in arrow functions, and they
document the signature. `arguments` survives mainly in older code and in the
`Array.prototype.slice.call(arguments)` idiom.

**Is a function array-like?**
Accidentally, by the naive test — it has a `length`, which is its declared arity. That is
exactly why a `typeof x.length === "number"` check is not a reliable detector.

---

[Topic index](./README.md) · Next: [2 · Converting correctly](./02-converting-correctly.md) →
