---
title: "2 · Shallow — what freeze cannot reach"
sidebar_label: "2 · What it cannot reach"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Object.freeze()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze), [`Array.prototype.push()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push), [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [`Date`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date), [Private properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties), [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone), [`Object.assign()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign), [Spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax). Documentation-validated; **no timings**.

**`Object.freeze` locks an object's own properties. It says nothing about what those properties
point at.**

```js
"use strict";
const config = Object.freeze({
  name: "api",
  retry: { attempts: 3 },
});

config.name = "other";        // 🔴 TypeError — the own property is locked
config.retry.attempts = 99;   // ✅ works fine — a different object entirely
config.retry;                 // { attempts: 99 }
```

Nothing is broken here. `config.retry` is a non-writable property holding a **reference**, and
freezing protects the reference, not the referent — the same distinction as `writable: false` in
[11 · Property descriptors](../11-property-descriptors.md). One frozen object, one perfectly
mutable one, and the guarantee stops at the boundary between them.

That is the well-known half. The half that actually causes incidents is that **several things are
not properties at all**, and freeze cannot see them.

## Arrays — locked, but they fail two different ways

```js
"use strict";
const list = Object.freeze(["a", "b"]);

list[0] = "z";     // 🔴 TypeError: Cannot assign to read only property '0'
list.push("c");    // 🔴 TypeError: Cannot add property 2, object is not extensible
list.length = 0;   // 🔴 TypeError: Cannot assign to read only property 'length'
list.sort();       // 🔴 TypeError: Cannot assign to read only property '0'
```

Array indices are ordinary properties, so freezing an array works exactly as you would hope. The
detail worth carrying:

🔴 **`push` throws even in sloppy mode**, while `list[0] = "z"` on the same frozen array stays
silent there. The mutating array methods define and assign with the throw-on-failure form
internally, so their behaviour does not depend on the *caller's* strictness — a bare assignment's
does. **The same frozen array will therefore report some mutations and not others** in a sloppy
file, which is exactly as confusing as it sounds, and one more reason to be in a module.

⚠️ **Non-mutating methods are unaffected**, because they build a new array: `map`, `filter`,
`slice`, `concat`, `toSorted`, `toReversed` all work normally on a frozen array — and their result
is **not** frozen.

## `Map`, `Set`, `Date`, `WeakMap` — freeze does nothing at all

```js
"use strict";
const m = Object.freeze(new Map());
m.set("a", 1);        // ✅ works — no error, entry added
m.size;               // 1

const d = Object.freeze(new Date(0));
d.setFullYear(2030);  // ✅ works — the date changed
```

🔴 **Their contents live in internal slots, not in properties.** A `Map`'s entries, a `Set`'s
members and a `Date`'s timestamp are engine-level state that the property machinery cannot address,
so `configurable: false` and `writable: false` have nothing to apply to. `Object.freeze(map)`
freezes the *zero* own properties a `Map` has, reports `isFrozen === true`, and provides no
protection whatsoever.

**There is no built-in way to make a `Map` immutable.** The options are to expose a read-only
wrapper (a `Proxy`, or an object with only the read methods), to hand out a copy on each access, or
to use a plain frozen object where a `Map` is not required.

## `#private` fields survive a freeze

```js
"use strict";
class Counter {
  #count = 0;
  increment() { this.#count++; return this.#count; }
  get value() { return this.#count; }
}

const c = Object.freeze(new Counter());
c.increment();   // ✅ 1
c.increment();   // ✅ 2 — the "frozen" instance is still changing
```

Private fields are not properties either. They are a separate per-instance mechanism that
`Object.freeze`, `Object.keys`, `getOwnPropertyNames` and `Reflect.ownKeys` all miss alike — see
[06 · `class`](../06-class/README.md). **Freezing a class instance protects its public data
properties and nothing else**, which is a weak guarantee for any class that keeps real state
privately.

The same applies to the older ways of holding private state: values in a closure or in a `WeakMap`
keyed by the instance are equally out of reach.

## A setter still runs on a frozen object

Freeze cannot clear `writable` on an accessor property, because accessors do not have one. The
setter stays installed and stays callable:

```js
"use strict";
const store = Object.freeze({
  _items: [],                       // frozen: the reference is locked
  set item(v) { this._items.push(v); },   // ✅ still runs, still mutates
});

store.item = "x";
store._items;   // ["x"]
```

⚠️ **Whether the write succeeds depends entirely on what the setter body does.** Here it mutates an
array that freeze never reached. Had the setter written `this._value = v` on the frozen object
itself, that inner assignment would have thrown. So a frozen object with accessors is only as
immutable as its accessors are — reviewing them is part of trusting the freeze.

The mirror image is worth stating too: **a getter is still called on a frozen object**, so a getter
that computes and returns a fresh object hands out a fully mutable value every time.

## Every copy comes out unfrozen

```js
const frozen = Object.freeze({ a: 1, nested: { b: 2 } });

const spread = { ...frozen };              // ✅ mutable
const assigned = Object.assign({}, frozen); // ✅ mutable
const cloned = structuredClone(frozen);     // ✅ mutable, and deeply so
Object.isFrozen(cloned);                    // false
```

**Frozen-ness is not a property of the value; it is state on that one object.** Spread and
`Object.assign` read values and write plain, fully-flagged data properties
([11 · Property descriptors](../11-property-descriptors.md) covers why), and `structuredClone`
builds new objects from the structured-clone algorithm without carrying descriptors across.

Two things follow, and they are the useful ones:

- **This is how you "unfreeze"** — you cannot, but you can copy. `structuredClone` is the deep
  version, and its result is mutable at every level.
- **Freezing at a boundary does not survive the boundary.** If a frozen config is spread into a
  new object by a helper, the helper's caller receives a mutable one. The guarantee is not
  contagious in either direction.

## What is still protected, and is easy to forget

The prototype. All three lockdown levels make `[[Extensible]]` false, which makes the prototype
immutable — so `Object.setPrototypeOf(frozen, X)` throws in every mode, not just strict. That is
the one part of a frozen object that *is* reliably safe, and it is the part nobody thinks about.

⚠️ **But the prototype's own contents are not frozen.** Freezing an instance does nothing to the
class prototype the instance inherits from, so a method can still be replaced on the prototype and
every "frozen" instance sees the change.

## Gotchas

**Symptom:** A nested property of a frozen object changed
**Cause:** `freeze` is shallow — it locks the reference, not the object referenced.
**Fix:** Deep-freeze, or restructure so the boundary holds ([chunk 3](./03-deep-freeze-and-alternatives.md)).

**Symptom:** `map.set(...)` works on a frozen `Map`, and `isFrozen` still says `true`
**Cause:** `Map` entries live in internal slots, not properties; freeze had nothing to lock.
**Fix:** Wrap it in a read-only interface, or hand out copies. There is no built-in immutable `Map`.

**Symptom:** A frozen `Date` moved
**Cause:** Same reason — the timestamp is an internal slot.
**Fix:** Store the epoch number or an ISO string instead, and build a `Date` on demand.

**Symptom:** A method still mutates a frozen class instance
**Cause:** The state is in `#private` fields, a closure or a `WeakMap` — none of which are properties.
**Fix:** Freezing does not apply. Return new instances from the methods instead.

**Symptom:** `push` throws on a frozen array but a direct index assignment does not
**Cause:** The mutating array methods throw on failure regardless of the caller's strictness; a bare assignment follows the caller's mode.
**Fix:** Use strict mode so both report. The inconsistency is only visible in sloppy code.

**Symptom:** Assigning to a frozen object's property ran real code and changed something
**Cause:** It is an accessor property. Freeze cannot make a setter read-only, so the setter ran.
**Fix:** Check the setter's body — the freeze is only as strong as what the accessor does.

**Symptom:** A copy of a frozen object is mutable
**Cause:** Spread, `Object.assign` and `structuredClone` all produce plain writable properties.
**Fix:** Working as intended — that is also the supported way to get a mutable version.

**Symptom:** A "frozen" instance's method changed behaviour at runtime
**Cause:** The method lives on the prototype, which was never frozen.
**Fix:** Freeze the prototype too if that matters, and read **16 · Prototype patterns to avoid** *(not written yet)*.

## Interview questions

**★ Why is `Object.freeze` called shallow?**
It sets flags on the object's own properties only. A property holding an object reference is locked
*as a reference* — you cannot repoint it — but the object it points at is untouched and fully
mutable. The guarantee stops at one level.

**★ What happens if you freeze a `Map` or a `Set`?**
Nothing useful. Their contents live in internal slots rather than properties, so there is nothing
for `writable` or `configurable` to apply to. `set`, `add` and `delete` keep working, and
`Object.isFrozen` still returns `true` — a `true` that means nothing here.

**★ Can a method mutate a frozen class instance?**
Yes, if the state is private. `#private` fields, closure variables and `WeakMap`-held state are not
properties, so `Object.freeze` never sees them. Only public own data properties are locked.

**★ Why does `push` throw on a frozen array in sloppy mode when `arr[0] = 1` does not?**
The mutating array methods perform their writes with the throw-on-failure form internally, so they
throw regardless of the calling code's strictness. A plain assignment obeys the caller's mode, which
in sloppy code means a silent no-op.

**★ How do you get a mutable version of a frozen object?**
Copy it. Spread and `Object.assign` give a shallow mutable copy; `structuredClone` gives a deep one.
There is no way to unfreeze in place, because freezing sets `configurable: false`, which is
irreversible.

**Does freezing an object protect its getters?**
It protects them from being *replaced*, not from *running*. An accessor has no `writable` flag, so
freeze cannot disable it. A setter on a frozen object still executes and can mutate anything it can
reach; a getter still runs and can hand out a fresh mutable object each call.

**What does freezing reliably protect that people forget about?**
The prototype. Any of the three levels makes the object non-extensible, which makes its prototype
immutable — `Object.setPrototypeOf` throws in every mode. The prototype *object's* own contents are
still mutable, though.

---

← [1 · The three levels](./01-the-three-levels.md) · [Topic index](./README.md) · Next: [3 · Deep freeze, and the alternatives](./03-deep-freeze-and-alternatives.md) →
