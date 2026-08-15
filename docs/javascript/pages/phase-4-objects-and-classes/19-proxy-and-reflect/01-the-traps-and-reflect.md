---
title: "1 · The traps, and why `Reflect` exists"
sidebar_label: "1 · The traps and Reflect"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Proxy`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy), [`Proxy.revocable()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/revocable), [`handler.get()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/get), [`handler.set()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/set), [`handler.ownKeys()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/ownKeys), [`Reflect`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect), [`Reflect.get()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/get), [`Reflect.ownKeys()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/ownKeys), [Private properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties). Documentation-validated; **no timings**.

**A `Proxy` intercepts the operations the engine performs on an object.** Not the syntax you write —
the internal operations underneath it: getting a property, setting one, asking whether a key exists,
listing keys, calling, constructing.

```js
const target = { name: "Ada" };

const p = new Proxy(target, {
  get(obj, prop, receiver) {
    console.log("read", prop);
    return Reflect.get(obj, prop, receiver);
  },
});

p.name;   // logs "read name", returns "Ada"
```

Two objects are involved and it is worth naming them precisely: the **target** does the real work,
and the **handler** is an object of trap functions. **A trap you do not define falls through to the
target unchanged**, so `new Proxy(target, {})` behaves almost exactly like `target`.

## The traps you will actually meet

| Trap | Fires on |
|---|---|
| `get` | `p.x`, `p[k]` |
| `set` | `p.x = v` |
| `has` | `"x" in p` |
| `deleteProperty` | `delete p.x` |
| `ownKeys` | `Object.keys`, `for...in`, spread, `JSON.stringify` |
| `getOwnPropertyDescriptor` | `Object.getOwnPropertyDescriptor`, and the filtering step of `Object.keys` |
| `defineProperty` | `Object.defineProperty` |
| `apply` | calling a proxied function |
| `construct` | `new` on a proxied constructor |

There are thirteen in all; the rest cover prototypes and extensibility. ⚠️ **`ownKeys` alone does
not control `Object.keys`** — that operation calls `ownKeys` *and then* `getOwnPropertyDescriptor`
for each key, keeping only the enumerable ones. A handler that fakes keys without also faking their
descriptors produces an empty `Object.keys` and a confusing hour.

## `Reflect` is the default behaviour, as functions

`Reflect` has **one method per trap, with the same signature**. That is its whole design: inside a
trap, `Reflect.<same name>(...arguments)` does exactly what would have happened without the proxy.

```js
set(obj, prop, value, receiver) {
  validate(prop, value);
  return Reflect.set(obj, prop, value, receiver);   // ✅ correct forwarding
}
```

**Why not `obj[prop] = value`?** Two reasons, and both are real bugs:

🔴 **The `receiver` is lost.** When the proxy is on a *prototype* and the property is read or written
through an inheriting object, `receiver` is that inheriting object. `Reflect.get(obj, prop,
receiver)` invokes a getter with the right `this`; `obj[prop]` invokes it with the target as `this`,
so a getter returns the prototype's data instead of the instance's.

🔴 **`set` must return a boolean.** `Reflect.set` returns whether the write succeeded, which is
exactly what the trap must report. A trap returning `undefined` counts as failure and **throws a
`TypeError` in strict mode** — which is every module.

**`Reflect` is useful without `Proxy` too**, and this is where most people first meet it:

```js
Reflect.ownKeys(obj);            // strings AND symbols — getOwnPropertyNames misses symbols
Reflect.has(obj, "x");           // `in` as a function
Reflect.apply(fn, thisArg, []);  // replaces Function.prototype.apply.call(fn, …)
Reflect.construct(C, args, NewTarget);   // `new` with an explicit new.target
```

## The invariants: a proxy is not allowed to lie

The engine enforces consistency against the target. If a target property is **non-configurable and
non-writable**, a `get` trap that returns something different is a `TypeError`:

```js
const target = {};
Object.defineProperty(target, "id", { value: 1, writable: false, configurable: false });

const p = new Proxy(target, { get: () => 999 });
p.id;   // 🔴 TypeError: 'get' on proxy: property 'id' is a read-only and non-configurable data
        //    property on the proxy target but the proxy did not return its actual value
```

Similar rules cover `ownKeys` (it must include every non-configurable key), `deleteProperty` (it
cannot report success for a non-configurable property) and `isExtensible` (it must agree with the
target). 🔴 **The practical consequence: never proxy a frozen object and expect the traps to
matter** — freezing makes every property non-configurable, so the invariants pin almost everything
([12 · `Object.freeze`](../12-freeze-and-seal/01-the-three-levels.md)).

## The failure that costs the most time: internal slots

**A proxy forwards property operations. It cannot forward access to internal slots**, and several
built-ins keep their state there rather than in properties:

```js
const p = new Proxy(new Map(), {});
p.get("k");   // 🔴 TypeError: Method Map.prototype.get called on incompatible receiver #<Map>
```

`Map.prototype.get` requires its `this` to be a real `Map` with the internal data slot. It receives
the proxy, which is not one. The same applies to `Set`, `Date`, `WeakMap`, typed arrays — and to
**`#private` fields**:

```js
class Counter {
  #n = 0;
  inc() { return ++this.#n; }
}
new Proxy(new Counter(), {}).inc();   // 🔴 TypeError: Cannot read private member
```

**The workaround is to bind the method to the target** in the `get` trap:

```js
get(obj, prop, receiver) {
  const value = Reflect.get(obj, prop, receiver);
  return typeof value === "function" ? value.bind(obj) : value;
}
```

⚠️ **That fixes the crash and gives up part of the point** — methods now run against the raw target,
so writes they perform internally do not go through your traps. It is the standard compromise, and
it is why reactivity libraries treat `Map` and `Set` as special cases with hand-written handlers
rather than a generic proxy.

## Identity, and `revocable`

```js
const p = new Proxy(target, {});
p === target;              // false — a distinct object
map.set(target, 1); map.get(p);   // undefined — different keys
```

**A proxy is never `===` its target.** Anything keyed by object identity — a `WeakMap` cache, a
`Set` of seen nodes, a React key — sees two different objects. Pick one to pass around and be
consistent.

`Proxy.revocable` gives a proxy plus a `revoke()`; after revoking, **every** operation on it throws.
That is the mechanism for handing out a reference you can withdraw later — a capability you can
cancel, or a sandbox teardown.

## Gotchas

**Symptom:** `TypeError: Method Map.prototype.get called on incompatible receiver`
**Cause:** The built-in needs its real `this`; internal slots are not forwarded by a proxy.
**Fix:** Bind methods to the target in the `get` trap, and accept that their internal writes bypass your traps.

**Symptom:** `TypeError: Cannot read private member` through a proxy
**Cause:** Same reason — `#private` fields are not properties.
**Fix:** Same fix, or proxy a plain object instead of a class instance.

**Symptom:** `TypeError: 'set' on proxy: trap returned falsish`
**Cause:** The `set` trap returned `undefined`. In strict mode that is a failed write and throws.
**Fix:** `return Reflect.set(...arguments)`.

**Symptom:** A getter through a proxied prototype returned the wrong object's data
**Cause:** The trap forwarded with `obj[prop]` instead of `Reflect.get(obj, prop, receiver)`, so `this` was the target.
**Fix:** Always forward with `Reflect` and pass the `receiver`.

**Symptom:** `Object.keys` on a proxy is empty despite an `ownKeys` trap
**Cause:** `Object.keys` also calls `getOwnPropertyDescriptor` per key and keeps only enumerable ones.
**Fix:** Implement `getOwnPropertyDescriptor` too.

**Symptom:** `TypeError: proxy did not return its actual value`
**Cause:** A trap contradicted a non-configurable, non-writable property on the target — the invariants forbid it.
**Fix:** Do not proxy frozen or sealed objects expecting interception.

**Symptom:** A cache keyed by the object misses every time
**Cause:** The proxy is a different object from the target.
**Fix:** Key consistently on one of them.

## Interview questions

**★ What does a `Proxy` intercept?**
The internal operations the engine performs on an object — property get and set, `in`, `delete`, key
listing, `apply`, `construct`, prototype access — via up to thirteen traps. Any trap you omit falls
through to the target unchanged.

**★ What is `Reflect` for, and why use it inside traps?**
It provides one function per trap with the same signature, implementing the default behaviour. Using
it forwards correctly: it passes the `receiver` so getters and setters run with the right `this`
when the proxy sits on a prototype, and it returns the boolean that `set` and `deleteProperty` traps
are required to return.

**★ Why does `new Proxy(new Map(), {}).get(k)` throw?**
Because `Map` keeps its entries in an internal slot, and `Map.prototype.get` requires its `this` to
be a real `Map`. The proxy is a different object, so the receiver check fails. The same applies to
`Set`, `Date`, typed arrays and `#private` fields.

**★ Can a proxy make an object appear to have any properties it likes?**
No. The engine enforces invariants against the target: a trap cannot contradict a non-configurable,
non-writable property, `ownKeys` must include every non-configurable key, and extensibility must
agree. Proxying a frozen object leaves almost nothing to intercept.

**★ Is a proxy `===` its target?**
No, it is a distinct object. Anything keyed by identity — a `WeakMap`, a `Set`, a cache — treats
them as two, so choose one to pass around.

**What is `Proxy.revocable` for?**
Handing out a reference you can withdraw. After `revoke()`, every operation on the proxy throws —
useful for capability-style access and for tearing down a sandbox.

**When would you use `Reflect` without `Proxy`?**
`Reflect.ownKeys` when you need symbol keys as well as strings, `Reflect.has` as a functional `in`,
`Reflect.apply` in place of the `Function.prototype.apply.call` idiom, and `Reflect.construct` when
you need to control `new.target`.

---

← [Topic index](./README.md) · [Phase index](../README.md) · Next: [2 · What they are actually for](./02-what-they-are-for.md) →
