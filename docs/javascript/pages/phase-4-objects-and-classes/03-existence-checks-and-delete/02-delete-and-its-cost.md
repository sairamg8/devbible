---
title: "03.2 · `delete` and what it really costs"
sidebar_label: "02 · delete and its cost"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`delete`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/delete) — and V8's engineering blog, [Fast properties in V8](https://v8.dev/blog/fast-properties). Documentation-validated; the performance section states exactly what the V8 post claims and no more.

`delete` removes an **own property from an object**. That sentence is short, and
every word in it excludes something people expect `delete` to do. It does not free
memory, it does not remove variables, it does not touch the prototype chain, and on
an array it does not remove an element.

## What it actually does

```js
function Foo() {
  this.bar = 10;
}

Foo.prototype.bar = 42;
const foo = new Foo();

console.log(foo.bar); // 10
delete foo.bar;       // returns true
console.log(foo.bar); // 42 — now reaches the prototype
```

MDN: *"`delete` only has an effect on own properties."* Deleting the own `bar`
**unshadows** the inherited one, so the property does not disappear — it changes
value. If you were deleting in order to make `foo.bar` undefined, you got the
opposite of what you wanted.

There is no way to delete an inherited property through the instance. You would
have to delete it from the prototype, which affects every object that shares it.

## The return value, and when it lies

MDN: *"`delete` returns `true` for all cases except when the property is an own
non-configurable property, in which case `false` is returned in non-strict mode."*

**`true` does not mean anything was deleted.** `delete obj.neverExisted` is `true`.
The only thing `false` tells you is that the property was own and non-configurable:

```js
const Employee = {};
Object.defineProperty(Employee, "name", { configurable: false });

console.log(delete Employee.name); // false
```

In strict mode — every module, every class body — that same statement **throws a
`TypeError`** instead of returning `false`. So the failure mode differs by mode,
which is the recurring pattern across this whole corpus: sloppy mode returns a
value nobody checks, strict mode throws.

Properties are non-configurable more often than people realise: anything defined
with `Object.defineProperty` without `configurable: true` (the default is `false`),
`length` on an array, a top-level `var` in a classic script, and everything in a
frozen object.

## What `delete` cannot remove

**Variables.** MDN: *"Deleting variables never works. `delete variable` will throw
a `SyntaxError` in strict mode and have no effect in non-strict mode."*

```js
var empCount = 43;
delete empCount; // returns false

function f() {
  var z = 44;
  delete z; // returns false
}
```

Two different reasons, per MDN: `var` bindings are **non-configurable** properties
of their scope object, and `let`/`const` bindings *"are not attached to an object"*
at all — there is nothing for `delete` to operate on. Function declarations are in
the same position as `var`.

**Anything on the prototype chain**, as shown above.

**Memory.** MDN, plainly: *"The `delete` operator has nothing to do with directly
freeing memory. Memory management is done indirectly via breaking references."*
This is the misconception carried over from `delete` in C++, and it is worth being
explicit: the garbage collector frees an object when nothing references it. If
`delete obj.big` removes the last reference to a large object, that object becomes
collectable — but so would `obj.big = null`, and so would letting `obj` itself go
out of scope. `delete` is not a memory tool.

## `delete` on an array leaves a hole

```js
const trees = ["redwood", "bay", "cedar", "oak", "maple"];
delete trees[3];
console.log(3 in trees); // false
```

MDN: *"When you delete an array element, the array `length` is not affected."*
The array is still length 5, with a **hole** at index 3 — the third state from
[chunk 1](./01-the-four-checks.md), distinguishable from a stored `undefined` only
by `in` or `Object.hasOwn`.

The correct tool:

```js
const trees = ["redwood", "bay", "cedar", "oak", "maple"];
trees.splice(3, 1);
console.log(trees); // ["redwood", "bay", "cedar", "maple"]
```

Or, if you would rather not mutate, `trees.filter((_, i) => i !== 3)` — or
`toSpliced(3, 1)` in a modern runtime, which returns a new array.

**Never `delete` an array index.** Holes make array methods behave inconsistently
(some skip them, some visit them as `undefined`), and they push the array's backing
store into a slower representation. The V8 blog notes that *"Array functions perform
considerably slower on objects with slow elements."*

## The performance cost, stated precisely

This is the part usually asserted with a made-up multiplier, so here is exactly
what V8's engineering blog says and nothing beyond it.

V8 gives each object a **HiddenClass** describing its shape, and a **descriptor
array** holding property metadata. Objects sharing a shape share a HiddenClass,
which is what lets inline caches make property access fast. On deletion:

> *"if many properties get added and deleted from an object, it can generate a lot
> of time and memory overhead to maintain the descriptor array and HiddenClasses."*

For objects that change shape a lot, V8 has a second representation — **dictionary
mode**, also called *slow mode*, where properties live in a hash table and there is
no descriptor array. The cost of being there:

> *"Since inline caches don't work with dictionary properties, the latter are
> typically slower than fast properties."*

**What the blog does not say**, and what this page therefore does not claim:

- It does **not** say a single `delete` moves an object to dictionary mode. The
  documented trigger is properties being *frequently added and removed*, and the
  exact heuristic is a V8 implementation detail that can change between versions.
- It gives **no multiplier**. Any "delete is 20× slower" figure you have read came
  from someone's benchmark on some version, not from documentation — and this
  corpus does not print numbers that no run here produced.

So the honest formulation: **`delete` on a hot object risks moving it off V8's fast
path, and the risk grows the more you do it.** For a config object read once at
startup it is irrelevant. For an object mutated inside a render loop or a
per-request handler it is worth avoiding. And the reason to avoid it is mostly not
performance anyway — it is that the alternatives are clearer.

## What to do instead

**Build a new object without the key.** Rest destructuring is the tidiest form:

```js
const { password, ...safeUser } = user;
// safeUser has every own enumerable property except password
```

This is the standard way to strip a field before logging or returning a payload. It
creates a fresh object, so nothing else holding a reference to `user` is affected,
and the shape of the new object is stable from birth. Note it is **shallow** — a
nested `credentials.password` is untouched.

**Set it to `undefined` or `null`** when the key may legitimately stay:

```js
cache.entry = null; // drops the reference; shape unchanged
```

The property remains, so `Object.hasOwn` still reports it and `JSON.stringify`
still emits it for `null` (though not for `undefined`). If your consumers use
`!== undefined` checks this is equivalent to deletion for their purposes, and it
keeps the object's shape stable. It also breaks the reference, which is the actual
mechanism by which memory is reclaimed.

**Use a `Map` when the collection is genuinely dynamic.** `map.delete(key)` is a
first-class operation on a data structure designed for insertion and removal, with
none of the shape consequences, plus real insertion order and any key type. **If
you are calling `delete` in a loop, you wanted a `Map`.**

**Use `Object.create(null)` or a `Map` for user-supplied keys**, so you are not
deleting to clean up prototype-inherited surprises in the first place.

## Gotchas

**Symptom:** `delete obj.x` returns `true` but `obj.x` still has a value
**Cause:** `delete` removes **own** properties only. The value now comes from the
prototype — MDN's example goes from `10` to `42`.
**Fix:** Nothing at the instance level; the inherited property is shared. Reconsider
whether you should be deleting at all.

**Symptom:** `delete` returned `true` and you concluded the property existed
**Cause:** `delete` returns `true` for a property that was never there. Only `false`
is informative, and only about non-configurability.
**Fix:** Check existence with `Object.hasOwn` **before** deleting if you care.

**Symptom:** `TypeError` from a `delete` in a module or class
**Cause:** Strict mode turns "delete a non-configurable own property" from a `false`
return into a throw.
**Fix:** Check `Object.getOwnPropertyDescriptor(obj, k).configurable` first, or stop
deleting it. Properties from `Object.defineProperty` are non-configurable by
default.

**Symptom:** `delete arr[i]` leaves `arr.length` unchanged and a hole behind
**Cause:** MDN: *"the array `length` is not affected."* You created a sparse array.
**Fix:** `splice(i, 1)` to mutate, `filter` or `toSpliced` to build a new array.

**Symptom:** `delete` did not reduce memory usage
**Cause:** MDN: *"The `delete` operator has nothing to do with directly freeing
memory."* Collection happens when the last reference goes.
**Fix:** Break the reference (`obj.big = null`) and make sure nothing else — a
closure, a cache, an event listener — is still holding it.

**Symptom:** `SyntaxError` from `delete someVariable` in a module
**Cause:** Deleting a variable is a `SyntaxError` in strict mode and a no-op
otherwise (MDN). `var` bindings are non-configurable; `let`/`const` are not on an
object at all.
**Fix:** Let it go out of scope, or reassign it.

**Symptom:** A hot code path slowed down after adding `delete`
**Cause:** Per V8's blog, repeatedly adding and deleting properties *"can generate a
lot of time and memory overhead to maintain the descriptor array and
HiddenClasses"*, and dictionary-mode properties are *"typically slower"* because
inline caches do not work with them.
**Fix:** Rest destructuring to build a new object, or a `Map` if the collection is
dynamic. Do not chase a specific multiplier — profile your own code.

## Interview questions

**★ What does `delete` actually do?**
Removes an **own** property from an object. It does not remove inherited
properties, does not remove variables, does not free memory, and does not change an
array's length. MDN: it *"has nothing to do with directly freeing memory. Memory
management is done indirectly via breaking references."*

**★ What does `delete` return?**
`true` in every case except deleting an own **non-configurable** property, where it
returns `false` in sloppy mode and **throws `TypeError`** in strict mode. Crucially,
`true` does not mean anything was removed — deleting a property that never existed
also returns `true`.

**★ Why should you not `delete` an array element?**
Because it leaves a hole: `length` is unchanged and the index becomes absent rather
than `undefined`. Array methods then treat holes inconsistently, and V8 notes array
functions are *"considerably slower on objects with slow elements"*. Use `splice`,
`filter` or `toSpliced`.

**★ Is `delete` slow?**
It can be, and the honest version is narrower than the folklore. V8's blog says
frequent addition and deletion *"can generate a lot of time and memory overhead to
maintain the descriptor array and HiddenClasses"*, and that dictionary-mode
properties are *"typically slower than fast properties"* because inline caches do
not work on them. It does **not** say one `delete` demotes an object, and it gives
no multiplier. Irrelevant for a startup config object; worth avoiding in a hot loop.

**How do you remove a field from an object without `delete`?**
Rest destructuring — `const { password, ...safeUser } = user` — which builds a new
object with a stable shape and leaves the original untouched. It is shallow, so
nested copies of the field survive.

**When is `delete` the right tool?**
When you genuinely need an own property gone from an existing object, once, on an
object that is not on a hot path — clearing a cache entry whose absence is
meaningful, or normalising a payload in place. If you are doing it repeatedly, you
wanted a `Map`.

---

← [The four existence checks](./01-the-four-checks.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
