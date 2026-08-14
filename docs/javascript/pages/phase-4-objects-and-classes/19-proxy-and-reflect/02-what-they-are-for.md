---
title: "2 · What they are actually for"
sidebar_label: "2 · What they are for"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Proxy`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy), [`handler.get()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/get), [`handler.set()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/set), [`handler.has()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/has), [`Reflect`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect), [`Object.defineProperty()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty), [`Array.isArray()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray), [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify). Documentation-validated; **no timings**.

Most working developers read proxy code far more often than they write it — usually inside a
framework. These are the cases where it is the right tool, and the reason each one could not be done
another way.

## Reactivity — the reason `Proxy` displaced `defineProperty`

A reactive system needs to know when state is read (to record a dependency) and when it is written
(to re-run what depended on it). Both are trap-shaped:

```js
function reactive(obj) {
  return new Proxy(obj, {
    get(t, k, r) { track(t, k);  return Reflect.get(t, k, r); },
    set(t, k, v, r) {
      const ok = Reflect.set(t, k, v, r);
      trigger(t, k);
      return ok;
    },
    deleteProperty(t, k) { const ok = Reflect.deleteProperty(t, k); trigger(t, k); return ok; },
  });
}
```

🔴 **Vue 2 built this with `Object.defineProperty`, walking the object and replacing each property
with an accessor.** That has three limits the accessor model cannot escape, and they are why Vue 3
moved to `Proxy`:

- **A property added later is invisible** — there was nothing to instrument when the walk ran. Vue 2
  needed `Vue.set` for exactly this.
- **`delete` cannot be detected at all.**
- **Array index writes and `length` changes** are not observed, which is why Vue 2 hand-patched the
  mutating array methods.

A proxy intercepts the *operation* rather than instrumenting the *property*, so all three work with
no special cases. The limitation described in
[11 · Property descriptors](../11-property-descriptors.md) — that `defineProperty` can only
instrument properties that already exist — **is** this story.

## Validation and access control

```js
const validated = new Proxy({}, {
  set(t, k, v, r) {
    if (k === "age" && (!Number.isInteger(v) || v < 0)) {
      throw new TypeError("age must be a non-negative integer");
    }
    return Reflect.set(t, k, v, r);
  },
});
```

The point is that the check cannot be bypassed by *any* write, including ones from code you did not
write. A setter ([10 · Getters and setters](../10-getters-and-setters.md)) does the same job for a
*known* property; a proxy covers properties that do not exist yet.

**A stricter variant catches typos**, which is the same job `Object.seal` does on a fixed shape
([12 · The three levels](../12-freeze-and-seal/01-the-three-levels.md)) — with the proxy version
able to report the intended name:

```js
get(t, k, r) {
  if (!(k in t) && typeof k === "string") throw new ReferenceError(`unknown config key: ${k}`);
  return Reflect.get(t, k, r);
}
```

## The small, genuinely useful ones

**Negative indices**, which JavaScript does not have natively — the canonical `Proxy` demo, and note
`Array.prototype.at` now covers the common case without one:

```js
const negatable = (arr) => new Proxy(arr, {
  get(t, k, r) {
    const i = typeof k === "string" && Number.isInteger(Number(k)) ? Number(k) : null;
    return Reflect.get(t, i !== null && i < 0 ? String(t.length + i) : k, r);
  },
});
```

**Auto-vivifying defaults**, so a missing key produces a usable value:

```js
const counters = new Proxy({}, { get: (t, k) => (k in t ? t[k] : 0) });
counters.misses + 1;   // 1, with no initialisation
```

**Case-insensitive or aliased lookup** over headers or config, where the incoming key spelling is
not under your control.

**Dynamic method dispatch** — the pattern behind fluent API clients, where `api.users.list()`
resolves to an HTTP call without a method existing for every endpoint. ⚠️ **Also the pattern that
makes autocomplete useless and typos silent**, so it earns its place only when the surface is
genuinely open-ended.

**Tracing and instrumentation in development**, logging every read and write of an object under
investigation — and removed before it ships.

## The costs, stated plainly

- **Every intercepted operation is a function call into your handler.** Whether that matters depends
  entirely on the access pattern; **no timings appear on this page**, and the honest advice is to
  treat a proxy as a design tool, not a fast path, and to measure your own case if a hot loop reads
  through one.
- **Debugging gets harder.** Devtools show a proxy differently from a plain object, stack traces gain
  a handler frame, and a `get` trap that logs turns every inspection into more output.
- **Every reflective operation goes through you** — `JSON.stringify` fires `ownKeys`,
  `getOwnPropertyDescriptor` and `get` for each key. A trap with a side effect runs far more often
  than the code that "uses" the object suggests.
- **Internal slots and `#private` fields do not forward** ([chunk 1](./01-the-traps-and-reflect.md)),
  so class instances and `Map`/`Set`/`Date` need special handling.
- **Identity differs from the target**, so caches and `WeakMap`s see two objects.
- ⚠️ **`Array.isArray` follows a proxy to its target** and returns `true` for a proxied array —
  useful, and worth knowing when a check passes on something that is not what you think it is
  ([13 · Where `instanceof` fails](../13-instanceof-and-hasinstance/02-where-it-fails.md)).

## When not to reach for one

- **A known property needs validation** → a setter.
- **A shape must not gain fields** → `Object.seal`.
- **A value must not change** → `Object.freeze`.
- **You want an event when something happens** → call a function; make the mutation explicit.
- **You want "magic"** → almost always the wrong instinct. Code whose behaviour is invisible at the
  call site costs every future reader, which is the same argument made against monkey-patching in
  [16 · Extending and patching](../16-prototype-patterns-to-avoid/01-extending-and-patching.md).

**The honest summary: `Proxy` is a framework-author's tool.** Reach for it when you must intercept
operations on objects *other people* write, and prefer explicit code everywhere else.

## Gotchas

**Symptom:** A logging `get` trap floods the console
**Cause:** `JSON.stringify`, devtools inspection and spread all read many properties.
**Fix:** Log selectively, and never ship the trap.

**Symptom:** Vue-2-style reactivity missed a newly added property
**Cause:** `defineProperty` can only instrument properties that exist when it runs.
**Fix:** That is the limitation `Proxy` removes; in Vue 2 it needed `Vue.set`.

**Symptom:** A reactive `Map` did not trigger updates
**Cause:** `Map` state lives in internal slots, so a generic proxy cannot see `set`/`delete`.
**Fix:** Hand-written collection handlers — what real reactivity libraries do.

**Symptom:** `Array.isArray(proxiedArray)` is `true` and downstream code broke
**Cause:** It follows the proxy to the target. The check passed on an object that is not a plain array.
**Fix:** Know which side of the proxy you are handing out.

**Symptom:** A `has` trap made `in` lie and something downstream broke
**Cause:** Faking existence affects `in`, `with`, and inherited lookups.
**Fix:** Keep `has` consistent with what `get` will actually return.

**Symptom:** A proxy-based API has no autocomplete and typos fail silently
**Cause:** Dynamic dispatch means no method exists to discover.
**Fix:** Generate a real client, or add a `get` trap that throws on unknown names.

**Symptom:** Replacing a getter with a proxy made things slower or harder to follow
**Cause:** A proxy was used where a plain accessor would do.
**Fix:** Use the smallest tool that expresses the intent.

## Interview questions

**★ Why did Vue move from `Object.defineProperty` to `Proxy`?**
Because the accessor model instruments *properties*, so it cannot see a property added after the
walk, cannot detect `delete`, and misses array index and `length` writes — hence `Vue.set` and the
hand-patched array methods in Vue 2. A proxy intercepts the *operation*, so all three work with no
special cases.

**★ Give a real use for `Proxy` that nothing else achieves.**
Validation or tracking of properties that do not exist yet. A setter covers a known property; only a
proxy covers `obj.anythingAtAll = value`. That is exactly the reactivity and schema-enforcement case.

**★ What are the costs?**
Every intercepted operation is a call into your handler; debugging is harder because devtools,
stack traces and any logging trap all change; reflective operations like `JSON.stringify` fire many
traps per object; internal slots and `#private` fields do not forward; and the proxy is not `===`
its target, so identity-keyed structures see two objects.

**★ When should you not use one?**
When a setter, `Object.seal`, `Object.freeze` or an explicit function call expresses the intent. A
proxy makes behaviour invisible at the call site, which is the same objection as monkey-patching. It
is a framework-author's tool.

**★ Does `Array.isArray` return true for a proxied array?**
Yes — it follows the proxy to its target. Worth knowing both because it is a rare check that sees
through a proxy, and because it means the check passing does not mean you are holding a plain array.

**What breaks when you proxy a class instance?**
Anything using `#private` fields or internal slots, because those are not properties and are not
forwarded. Binding methods to the target in the `get` trap fixes the crash but means their internal
writes no longer pass through your traps.

**Why must a `set` trap return a boolean?**
It reports whether the write succeeded. Returning `undefined` counts as failure and throws a
`TypeError` in strict mode — which is every module. `return Reflect.set(...arguments)` gets it right.

---

← [1 · The traps and Reflect](./01-the-traps-and-reflect.md) · [Topic index](./README.md) · [Phase index](../README.md) →
