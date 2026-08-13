---
title: "08.1 · What they include and what they skip"
sidebar_label: "01 · What they include"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`Object.entries`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries), [`Object.keys`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys), [`Object.values`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/values). Documentation-validated.

**Three methods with one shared definition.** MDN, on `Object.entries`: it *"returns
an array of a given object's **own enumerable string-keyed** property key-value
pairs."* `keys` and `values` differ only in what they project out of the same set.

Those three words — **own**, **enumerable**, **string-keyed** — decide everything
these methods silently drop.

```js
const obj = { foo: "bar", baz: 42 };
Object.keys(obj);    // ["foo", "baz"]
Object.values(obj);  // ["bar", 42]
Object.entries(obj); // [ ['foo', 'bar'], ['baz', 42] ]
```

## Own — inherited properties are excluded

MDN states the contrast directly: *"This is the same as iterating with a `for...in`
loop, except that a `for...in` loop enumerates properties in the prototype chain as
well."*

That single difference is why `Object.keys` should be your default and `for...in`
almost never should. A `for...in` over a class instance can surface prototype
methods; `Object.keys` cannot.

It also means **these methods see no methods at all** for a class instance —
methods live on the prototype, so `Object.entries(new User("Ada"))` gives you the
fields and nothing else. Usually exactly what you want when serialising.

## Enumerable — non-enumerable properties are excluded

```js
// getFoo is a non-enumerable property
const myObj = Object.create(
  {},
  {
    getFoo: {
      value() {
        return this.foo;
      },
    },
  },
);
myObj.foo = "bar";
console.log(Object.entries(myObj)); // [ ['foo', 'bar'] ] — getFoo excluded
```

Recall from [05 · `Object.create`](../05-the-prototype-chain/02-prototype-vs-the-slot.md)
that descriptor flags **default to `false`** — so anything defined with
`Object.defineProperty` or `Object.create`'s second argument is invisible to these
methods unless you explicitly say `enumerable: true`.

Two practical consequences:

- **`class` methods are non-enumerable** ([06 · `class`](../06-class/01-what-class-desugars-to.md)),
  which is a second reason they never appear here — even if you reached them.
- **Array `length` is non-enumerable**, which is why `Object.keys(["a","b"])` is
  `["0","1"]` and not `["0","1","length"]`.

## String-keyed — symbols are excluded

Symbol-keyed properties never appear, in any of the three. That is the design: a
symbol key is metadata you attached without it showing up in ordinary iteration or
in `JSON.stringify`.

To see them you need `Object.getOwnPropertySymbols` or `Reflect.ownKeys`, from
[01 · Keys and enumeration order](../01-object-literals/03-keys-and-order.md).

## The order is the object's order, not insertion order

MDN: *"The order of the array returned by `Object.entries()` is the same as that
provided by a `for...in` loop"* — and its example makes the consequence concrete:

```js
const randomKeyOrder = { 100: "a", 2: "b", 7: "c" };
console.log(Object.entries(randomKeyOrder)); // [ ['2', 'b'], ['7', 'c'], ['100', 'a'] ]
```

**Integer-index keys come out ascending, regardless of how you wrote them.** This is
the three-tier rule from topic 01, and it is exactly why an object keyed by numeric
ID cannot be used as an ordered collection. If order matters and your keys are
numeric, you want an array or a `Map`.

Note also the keys come back as **strings** — `'2'`, not `2`. Every object key is a
string or a symbol, so `Object.keys` and the first element of each `entries` pair are
always strings. Code doing `Object.keys(byId).map(Number)` is common for exactly this
reason.

## Non-object arguments are coerced

MDN: *"Non-object arguments are coerced to objects. `undefined` and `null` throw a
`TypeError`."*

```js
console.log(Object.entries("foo")); // [ ['0', 'f'], ['1', 'o'], ['2', 'o'] ]
console.log(Object.entries(100));   // []
```

A string boxes into an object with indexed own properties, so you get its characters.
A number boxes into a `Number` with no own enumerable properties, so you get `[]`.

**The trap is `null` and `undefined`**, which throw rather than returning `[]`:

```js
Object.entries(maybeNull ?? {});           // ✅ safe
Object.entries(response.data ?? {});       // ✅ the common real case
```

That `?? {}` is worth making a habit — an API field that is sometimes absent will
otherwise take down the handler with `TypeError: Cannot convert undefined or null to
object`.

## The comparison table

| | Own only | Enumerable only | Strings | Symbols |
|---|---|---|---|---|
| `Object.keys` / `values` / `entries` | ✅ | ✅ | ✅ | ❌ |
| `Object.getOwnPropertyNames` | ✅ | ❌ — includes non-enumerable | ✅ | ❌ |
| `Object.getOwnPropertySymbols` | ✅ | ❌ | ❌ | ✅ |
| `Reflect.ownKeys` | ✅ | ❌ | ✅ | ✅ |
| `for...in` | ❌ — walks the chain | ✅ | ✅ | ❌ |
| `JSON.stringify` | ✅ | ✅ | ✅ | ❌ |

`Object.keys` and `JSON.stringify` agree exactly on which properties they see, which
is why "what will this serialise to?" and "what does `Object.keys` give me?" have the
same answer. That is a useful thing to know when debugging a payload.

## Gotchas

**Symptom:** `TypeError: Cannot convert undefined or null to object`
**Cause:** `Object.keys/values/entries` **throw** on `null` and `undefined`, while
coercing every other non-object.
**Fix:** `Object.entries(value ?? {})`. Make it a habit for anything from an API.

**Symptom:** A property is missing from `Object.keys` although it is definitely on
the object
**Cause:** It is non-enumerable (defined via `Object.defineProperty` or
`Object.create`, where flags default to `false`), or it is symbol-keyed, or it is
inherited.
**Fix:** `Object.getOwnPropertyNames` for non-enumerables, `Reflect.ownKeys` for
everything own, and check the prototype if it is inherited.

**Symptom:** `Object.entries` on a class instance returns no methods
**Cause:** Methods live on the **prototype**, so they are not own — and class methods
are non-enumerable as well.
**Fix:** Expected, and usually desirable. Use `Reflect.ownKeys(Object.getPrototypeOf(obj))`
if you genuinely need to enumerate methods.

**Symptom:** Keys come back in a different order than they were written
**Cause:** Integer-index keys enumerate **ascending** before string keys. MDN's
example: `{100:"a", 2:"b", 7:"c"}` gives `2, 7, 100`.
**Fix:** Do not use an object as an ordered collection with numeric keys — an array
or a `Map`.

**Symptom:** A numeric key arrives as a string and comparisons fail
**Cause:** All object keys are strings; `Object.keys` returns `'2'`, not `2`.
**Fix:** `.map(Number)` where you need numbers, or use a `Map`, whose keys keep their
type.

**Symptom:** `Object.keys` on a number returns `[]`
**Cause:** A boxed `Number` has no own enumerable properties. Strings do (their
indices), other primitives do not.
**Fix:** Check the type before assuming an object.

## Interview questions

**★ What exactly do `Object.keys`, `values` and `entries` return?**
An object's **own, enumerable, string-keyed** properties — MDN's phrase. So they skip
inherited properties, non-enumerable ones, and every symbol key. That is the same set
`JSON.stringify` serialises, which is why the two agree.

**★ How do they differ from `for...in`?**
MDN: *"a `for...in` loop enumerates properties in the prototype chain as well."*
`Object.keys` is own-only. That single difference is why `Object.keys`/`entries`
should be the default and `for...in` on a plain object is a smell.

**★ What happens with `Object.keys(null)`?**
It **throws** `TypeError`. Every other non-object is coerced — `Object.entries("foo")`
gives the character entries, `Object.entries(100)` gives `[]` — but `null` and
`undefined` cannot be coerced. Guard with `?? {}`.

**★ Do these methods preserve insertion order?**
Not for integer-like keys. They follow the object's own order: integer indices
**ascending** first, then string keys by insertion. MDN's example turns
`{100:"a", 2:"b", 7:"c"}` into `2, 7, 100`. Symbol keys are not returned at all.

**Why does `Object.entries` on a class instance show no methods?**
Because methods are on the prototype rather than own properties — and `class` methods
are non-enumerable too. You get the instance fields, which is normally what you want
for serialisation.

**Which method returns every own property, including symbols and non-enumerables?**
`Reflect.ownKeys`. `Object.getOwnPropertyNames` adds non-enumerable string keys but no
symbols; `Object.getOwnPropertySymbols` gives only symbols.

---

[Topic index](./README.md) · Next → [Transforming objects](./02-transforming-objects.md)
