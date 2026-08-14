---
title: "10 · Getters and setters"
sidebar_label: "10 · Getters and setters"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`get`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get), [`set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/set), [Object.defineProperty()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty), [Object.getOwnPropertyDescriptor()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptor), [Spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax), [`Object.assign()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign), [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify), [Private properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties), [Classes guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_classes), [Strict mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode). Documentation-validated; **no timings**.

**An accessor property is a property whose read and write run your code.** To every caller it looks
exactly like an ordinary property — and that indistinguishability is both the feature and every
problem in this topic.

```js
const user = {
  first: "Ada", last: "Lovelace",
  get fullName() { return `${this.first} ${this.last}`; },
  set fullName(value) { [this.first, this.last] = value.split(" "); },
};

user.fullName;              // "Ada Lovelace"  ← a function call that looks like a read
user.fullName = "Grace Hopper";
user.first;                 // "Grace"
```

🔴 **A property is either a data property or an accessor property, never both.** A data property
has `value` and `writable`; an accessor has `get` and `set`. That is why the next section is the
first thing to learn.

## The infinite-recursion trap

```js
class User {
  set name(value) {
    this.name = value;      // 🔴 RangeError: Maximum call stack size exceeded
  }
}
```

`this.name = value` **is** an assignment to `name`, which invokes the setter, which assigns to
`name`… The same happens in a getter that returns `this.name`.

**The fix is a separate backing property**, and the modern spelling is a private field:

```js
class User {
  #name;
  get name()      { return this.#name; }
  set name(value) {
    if (!value) throw new TypeError("name is required");
    this.#name = value;
  }
}
```

⚠️ **The older convention is a leading underscore** — `this._name` — and you will meet it
constantly. It is a naming agreement, not a protection: `user._name` is fully accessible. Full
comparison in **20 · Private state before `#`** *(not written yet)*.

🔴 **A `#private` backing field cannot collide, and that is the real argument for it.** An
underscore-prefixed backing field is an ordinary property, so a subclass that happens to use the
same name silently shares it.

## What accessors are actually for

**Derived values that must not go stale.** The strongest case — there is nothing to keep in sync
because nothing is stored:

```js
class Cart {
  items = [];
  get total() { return this.items.reduce((n, i) => n + i.price, 0); }
}
```

Every read recomputes, so `total` cannot disagree with `items`. **The cost is that it recomputes
on every read** — including reads you did not write, such as a template rendering it in a loop.
If the computation is heavy, cache it deliberately and invalidate on write, rather than hoping.

**Validating on write**, as in the `User` example above — the setter is the one place a value can
be rejected before it is stored.

**Keeping a public shape while the internals change.** A field can become an accessor later
without touching a single call site, which is the compatibility argument for them.

⚠️ **What they are *not* for: hiding work.** A getter that performs a network call, mutates state,
or throws is a property that behaves like a method while presenting as data — and every reader of
the calling code will assume it is free and safe.

## They are invisible, and things read them without asking

🔴 **Any code that enumerates an object invokes its getters.** These all run the getter and copy
the *result*:

```js
const copy1 = { ...user };                 // getter invoked, result copied
const copy2 = Object.assign({}, user);     // same
JSON.stringify(user);                      // same
console.log(user);                         // devtools may invoke it to render
```

**And the accessor is lost in the copy.** `copy1.fullName` is now a plain string, frozen at the
moment of the spread — assigning to it will not split names any more, and it will not track later
changes to `first`:

```js
user.first = "Ada";
copy1.fullName;         // still "Grace Hopper" — a data property now
```

**To copy an object *with* its accessors**, descriptors have to be moved rather than values:

```js
const clone = Object.create(
  Object.getPrototypeOf(user),
  Object.getOwnPropertyDescriptors(user),   // ✅ getters stay getters
);
```

⚠️ **This is also why a getter with side effects is dangerous.** Logging the object, serialising
it, or spreading it in a test fires the side effect at a moment nobody chose.

## Class accessors live on the prototype — and it shows in JSON

```js
class Cart {
  items = [];
  get total() { … }
}

const cart = new Cart();
Object.keys(cart);            // ["items"]  — `total` is not an OWN property
JSON.stringify(cart);         // {"items":[]}  🔴 total is missing
```

🔴 **A class getter is defined on `Cart.prototype`, not on the instance**, and `JSON.stringify`
only serialises **own enumerable** properties. So computed values silently vanish from every API
payload, log line and `localStorage` write — while an object literal's getter, which *is* own and
enumerable, serialises fine. The two cases behave oppositely, which is why this catches people.

**Three ways out, in order of preference:**

```js
toJSON() { return { ...this, total: this.total }; }    // ✅ explicit, and stringify calls it
```

`JSON.stringify` looks for a `toJSON` method and uses its return value — the cleanest fix, because
the serialised shape becomes something you declare rather than something that falls out of
property mechanics.

Otherwise: define the accessor per-instance with `Object.defineProperty(this, "total", { get, enumerable: true })`
in the constructor — at the cost of one accessor per object — or simply expose a `getTotal()`
method, which nobody expects to be serialised.

⚠️ **Class accessors are non-enumerable; object-literal accessors are enumerable.** That single
difference explains the whole section.

## The half-defined cases

```js
const o = {
  get value() { return 42; },      // getter only — no setter
};

o.value = 99;      // sloppy mode: silently ignored
                   // strict mode (so: every module): TypeError
o.value;           // 42
```

🔴 **A getter-only property is read-only, and the failure mode depends on the mode.** In a module —
always strict — you get `TypeError: Cannot set property value of #<Object> which has only a
getter`, which is the useful version. In a classic script it fails silently, and the bug becomes
"my assignment did nothing".

A **setter-only** property is the mirror: reading it yields `undefined`, always, no matter what the
setter stored. Write-only properties are almost never what anyone wanted, and usually mean a getter
was forgotten.

## Defining them after the fact

```js
Object.defineProperty(obj, "total", {
  get() { return compute(); },
  enumerable: true,
  configurable: true,
});

Object.getOwnPropertyDescriptor(obj, "total");
// { get: [Function], set: undefined, enumerable: true, configurable: true }
```

**`defineProperty` defaults every flag to `false`**, so an accessor added this way is
non-enumerable and non-configurable unless you say otherwise — invisible to `Object.keys`,
spread and `JSON.stringify`, and impossible to redefine later. Descriptors in full:
**11 · Property descriptors** *(not written yet)*.

`static get` works the same way on the constructor — that is how `Symbol.species` is defined, as
seen in [09.2 · `super.method()` and overriding safely](./09-extends-and-super/02-super-method-and-overriding.md).

## Gotchas

**Symptom:** `RangeError: Maximum call stack size exceeded` on assignment
**Cause:** A setter assigning to its own property name — the assignment re-enters the setter.
**Fix:** A separate backing field, `#name` for preference.

**Symptom:** A subclass and its base silently share a backing field
**Cause:** `_name` is an ordinary property, so both write the same key.
**Fix:** `#name` — private fields cannot collide across classes.

**Symptom:** A spread copy stopped tracking changes
**Cause:** Spread invokes the getter and copies the **result** as a plain data property; the accessor is not preserved.
**Fix:** `Object.create(Object.getPrototypeOf(o), Object.getOwnPropertyDescriptors(o))`.

**Symptom:** A computed value is missing from JSON
**Cause:** A class getter lives on the prototype, and `JSON.stringify` serialises only own enumerable properties.
**Fix:** A `toJSON()` method — the explicit, declared shape.

**Symptom:** The same getter serialises fine on an object literal
**Cause:** Literal accessors are own and enumerable; class accessors are neither.
**Fix:** Nothing to fix — know which one you are looking at.

**Symptom:** An assignment did nothing, with no error
**Cause:** A getter-only property, in sloppy mode.
**Fix:** Add a setter, or run in a module — strict mode turns it into a `TypeError`.

**Symptom:** Reading a property always gives `undefined` despite writes appearing to work
**Cause:** A setter with no matching getter.
**Fix:** Add the getter; write-only properties are almost always a mistake.

**Symptom:** An accessor added with `defineProperty` is invisible to `Object.keys`
**Cause:** `defineProperty` defaults `enumerable` to `false`.
**Fix:** Pass `enumerable: true` (and `configurable: true`) explicitly.

**Symptom:** A side effect fires when an object is logged or serialised
**Cause:** A getter with side effects, invoked by devtools, `JSON.stringify` or a spread.
**Fix:** Keep getters pure and cheap; make anything else a method.

**Symptom:** A page got slow after a value became a getter
**Cause:** It recomputes on every read, and something reads it in a loop.
**Fix:** Cache in a backing field and invalidate in the setter — deliberately, not by accident.

## Interview questions

**★ What is an accessor property?**
A property whose read runs a getter and whose write runs a setter, so it looks like data to every
caller. A property is either a data property (`value`, `writable`) or an accessor (`get`, `set`) —
never both.

**★ Why does `set name(v) { this.name = v }` blow the stack?**
Because assigning to `name` invokes the setter for `name`, which assigns again. It needs a separate
backing property — `#name`, or the older `_name` convention.

**★ Why is `#name` better than `_name` as a backing field?**
`_name` is an ordinary property, so a subclass using the same name silently shares it, and anything
can read or write it. `#name` is genuinely private and cannot collide across classes.

**★ What happens to a getter when you spread the object?**
It is invoked, and the *result* is copied as a plain data property. The copy no longer recomputes,
and assigning to it no longer runs the setter. Preserve accessors with
`Object.getOwnPropertyDescriptors` and `Object.create`.

**★ Why does a class getter disappear from `JSON.stringify` output?**
Because it is defined on the prototype and `stringify` serialises only **own enumerable**
properties. An object literal's getter is own and enumerable, so it serialises — the two cases
behave oppositely. The fix is a `toJSON()` method.

**★ What happens when you assign to a getter-only property?**
Nothing, silently, in sloppy mode; a `TypeError` in strict mode — and modules are always strict, so
in modern code you get the error.

**★ When is a getter the wrong tool?**
When the work behind it is not cheap and pure. A getter presents as data, so callers assume a read
is free and safe — and devtools, `JSON.stringify` and spread will all invoke it without being
asked. Anything expensive or side-effecting should be a method.

**What do accessors buy you over a plain field?**
Values that cannot go stale because they are derived rather than stored, a single place to validate
on write, and the freedom to turn a field into computed behaviour later without changing a single
call site.

---

← [09 · `extends` and `super`](./09-extends-and-super/README.md) · [Phase index](./README.md) · Next: **11 · Property descriptors** *(not written yet)* →
