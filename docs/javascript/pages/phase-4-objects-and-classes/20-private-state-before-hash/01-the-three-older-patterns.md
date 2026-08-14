---
title: "1 · The three older patterns"
sidebar_label: "1 · The three older patterns"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Private properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties), [Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`Symbol`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol), [`Object.getOwnPropertySymbols()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertySymbols), [`Reflect.ownKeys()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/ownKeys), [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify), [`Object.keys()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys). Documentation-validated; **no timings**.

`#private` fields are recent. **Every codebase older than them uses one of four other approaches**,
and you will read all four this year. Only two of them are actually private.

## 1 · The underscore convention — not private, and never was

```js
class User {
  constructor(name) { this._name = name; }
  get name() { return this._name; }
}
```

`_name` is an ordinary public property. Anyone can read it, write it, and see it:

```js
const u = new User("Ada");
u._name = "anything";        // ✅ nothing stops this
Object.keys(u);              // ["_name"]
JSON.stringify(u);           // {"_name":"Ada"}   🔴 leaks into every API response
```

**It is documentation, not enforcement** — "you are not supposed to touch this". That is worth
something, and it is why the convention survived for two decades.

🔴 **The failure that is not obvious: subclass collision.** A subclass writing `this._name` for its
own purpose silently shares the base class's storage. Nothing warns; the two just overwrite each
other. That is the concrete problem `#` solves that a naming convention structurally cannot —
[06 · `class`](../06-class/README.md).

⚠️ **TypeScript's `private` is the same category.** It is checked at compile time and **erased at
build**, so the emitted JavaScript has an ordinary public property. It stops your teammates; it does
not stop `obj["secret"]`, a JavaScript caller, or `JSON.stringify`.

## 2 · Closure privacy — real, and it costs the prototype

```js
function createCounter() {
  let count = 0;                       // 🔴 genuinely unreachable from outside
  return {
    increment() { return ++count; },
    get value()  { return count; },
  };
}
```

`count` lives in the closure ([Phase 3 · 06 · Closures](../../phase-3-functions/06-closures/README.md)).
There is no property to find, so no amount of reflection reveals it —
`Object.keys`, `getOwnPropertyNames`, `Reflect.ownKeys` and `JSON.stringify` see nothing.

**What it costs:**

- **Every instance gets its own copies of the methods**, because they must be created inside the
  factory to capture the variable. No prototype sharing — the trade-off in
  [14 · Factory, constructor, class](../14-object-creation-patterns/01-factory-constructor-class.md).
- **Debugging is harder.** The value is a closure variable, so it shows up in devtools only while a
  frame that closes over it is on the stack, not as a field on the object.
- **Inheritance is awkward.** A "subclass" cannot reach the parent's closure at all; you compose
  instead, which is often the right answer anyway.

This was *the* privacy pattern in pre-class JavaScript, and it is still correct — it is just a
different object model, not a private-field mechanism bolted onto classes.

## 3 · `WeakMap` — the one that keeps the prototype

```js
const internals = new WeakMap();            // module scope — not exported

export class User {
  constructor(name) {
    internals.set(this, { name, loginCount: 0 });
  }
  get name() { return internals.get(this).name; }
  recordLogin() { internals.get(this).loginCount++; }
}
```

**Genuinely private** — the map is a module-scoped binding nobody outside can reach, and the data is
not a property of the instance, so reflection finds nothing.

**And the methods stay on the prototype**, which is what makes this the pre-`#` pattern for classes
specifically. It is also, in shape, how `#private` fields were compiled by Babel and TypeScript
before engines supported them natively.

🔴 **`Weak` is load-bearing.** The map holds its keys weakly, so when an instance becomes
unreachable its entry can be collected. **A plain `Map` here is a memory leak**: it would hold a
strong reference to every instance ever created, forever.

**What it costs:** verbosity at every access (`internals.get(this).name`), one lookup per read, and
a subtle hazard — `internals.get(this)` returns `undefined` if `this` is not an instance you
registered, so a method borrowed onto another object fails with
`Cannot read properties of undefined` rather than something meaningful.

## 4 · Symbol keys — collision avoidance, *not* privacy

```js
const NAME = Symbol("name");

class User {
  constructor(name) { this[NAME] = name; }
  get name() { return this[NAME]; }
}
```

This is the one people most often mislabel. Symbol-keyed properties are **hidden from casual
enumeration but fully visible to reflection**:

| Sees a symbol key? | |
|---|---|
| `Object.keys`, `for...in`, `JSON.stringify`, spread | ❌ |
| `Object.getOwnPropertySymbols`, `Reflect.ownKeys` | ✅ |
| devtools | ✅ |

```js
Object.getOwnPropertySymbols(u);            // [Symbol(name)]
u[Object.getOwnPropertySymbols(u)[0]];      // "Ada" — trivially readable
```

🔴 **So a symbol is the right tool for "do not collide with anyone else's key", and the wrong tool
for "nobody may read this".** It is exactly what a mixin should use for internal state
([18 · The three patterns](../18-mixins-and-composition/02-the-three-patterns.md)), and it is not a
privacy mechanism.

⚠️ **`Symbol.for("x")` is worse still** for this purpose — the global registry means anyone can
recreate the same symbol by name.

## Side by side

| | `_underscore` | Closure | `WeakMap` | `Symbol` key |
|---|---|---|---|---|
| actually private | ❌ | ✅ | ✅ | ❌ |
| methods on the prototype | ✅ | ❌ | ✅ | ✅ |
| in `JSON.stringify` | 🔴 yes | no | no | no |
| in `Object.keys` | 🔴 yes | no | no | no |
| visible to reflection | ✅ | no | no | ✅ `getOwnPropertySymbols` |
| subclass can collide | 🔴 yes | n/a | no | no |
| verbosity | none | low | 🔴 high | low |

## Gotchas

**Symptom:** An internal field appeared in an API response
**Cause:** `_name` is an ordinary public property; `JSON.stringify` serialises it.
**Fix:** `#private`, a `WeakMap`, or a `toJSON` that picks the public fields.

**Symptom:** A subclass and its base silently corrupted each other's state
**Cause:** Both used `this._name`. The underscore is a convention, not a namespace.
**Fix:** `#private` — the collision becomes impossible rather than unlikely.

**Symptom:** TypeScript `private` did not stop a runtime access
**Cause:** It is compile-time only and erased at build.
**Fix:** `#` if the guarantee must hold at runtime. Both can coexist.

**Symptom:** A symbol-keyed "private" field was read by outside code
**Cause:** `Object.getOwnPropertySymbols` and `Reflect.ownKeys` list them.
**Fix:** Symbols prevent collisions, not access. Use `#` or a `WeakMap`.

**Symptom:** Memory grew steadily in a long-running process
**Cause:** A plain `Map` used for per-instance data holds every instance strongly, forever.
**Fix:** `WeakMap`.

**Symptom:** `Cannot read properties of undefined (reading 'name')` in a `WeakMap`-backed getter
**Cause:** The method ran with a `this` that was never registered — a borrowed or detached method.
**Fix:** Guard the lookup and throw something meaningful, or use `#`, whose brand check is built in.

**Symptom:** A closure-private value cannot be seen while debugging
**Cause:** It is a closure variable, not a property, so it appears only in a live scope.
**Fix:** Expected. It is the cost of the strongest pre-`#` privacy.

## Interview questions

**★ How was private state done before `#`?**
Four ways. The `_underscore` convention (not private at all — public, enumerable, serialised, and
collides across a class hierarchy), closure variables (genuinely private but no prototype sharing),
a module-scoped `WeakMap` keyed by instance (private *and* keeps methods on the prototype), and
symbol keys — which are collision avoidance, not privacy.

**★ Why is a symbol key not private?**
`Object.getOwnPropertySymbols` and `Reflect.ownKeys` list them, and devtools show them. Symbols are
skipped by `Object.keys`, `for...in` and `JSON.stringify`, which makes them *unobtrusive*, not
inaccessible. They are the right tool for a mixin's internal state.

**★ Why must the per-instance store be a `WeakMap` and not a `Map`?**
A `Map` holds its keys strongly, so every instance ever created stays reachable and can never be
collected — an unbounded leak in a long-running process. A `WeakMap` lets the entry go when the
instance does.

**★ What does the underscore convention fail at, beyond being unenforced?**
Subclass collision. A subclass writing `this._name` for its own purpose silently shares the base
class's storage, with no warning. And it serialises: `JSON.stringify` puts it straight into your API
response.

**★ Is TypeScript's `private` enough?**
Only against TypeScript callers. It is checked at compile time and erased at build, so the emitted
JavaScript has an ordinary public property that `obj["secret"]`, any JavaScript consumer, and
`JSON.stringify` all reach.

**What does closure privacy cost?**
Prototype sharing. The methods must be created inside the factory to capture the variable, so every
instance carries its own copies — and the value is harder to inspect while debugging, because it is
a scope variable rather than a field.

---

← [Topic index](./README.md) · [Phase index](../README.md) · Next: [2 · `#` today, and choosing](./02-hash-today-and-choosing.md) →
