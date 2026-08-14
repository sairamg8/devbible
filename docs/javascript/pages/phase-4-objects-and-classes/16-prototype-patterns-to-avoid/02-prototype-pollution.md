---
title: "2 · Prototype pollution"
sidebar_label: "2 · Prototype pollution"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Object.prototype.__proto__`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/proto), [`Object.create()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create), [`Object.freeze()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze), [`Object.hasOwn()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn), [`JSON.parse()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse) (including the reviver), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Object.getPrototypeOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getPrototypeOf); and the Node.js documentation for [`--disable-proto`](https://nodejs.org/api/cli.html#--disable-protomode). Documentation-validated; **no timings**.

**Prototype pollution is writing a property onto `Object.prototype` from data.** Because every plain
object inherits from it, one write changes every object in the process — including ones created
before the write, and ones in code that has never heard of your data.

```js
const payload = JSON.parse('{"__proto__": {"isAdmin": true}}');
naiveMerge({}, payload);

({}).isAdmin;                 // 🔴 true
const user = {};              // a brand-new, empty object…
if (user.isAdmin) grantAccess();   // 🔴 …and it passes
```

## The mechanism, precisely — and the part usually told wrong

🔴 **`JSON.parse` is not the vulnerability.** It creates the `__proto__` key as an ordinary **own
data property**; it does not invoke the inherited setter:

```js
const parsed = JSON.parse('{"__proto__": {"isAdmin": true}}');
Object.getPrototypeOf(parsed) === Object.prototype;   // true — nothing happened yet
Object.hasOwn(parsed, "__proto__");                    // true — it is just data sitting there
```

**The pollution happens when *your* code copies that key with assignment.** `Object.prototype` has
`__proto__` defined as an accessor, so `target["__proto__"] = value` calls its **setter**, which
changes the target's prototype — and when the target is a plain object, that setter is reached
through `Object.prototype`:

```js
function naiveMerge(target, source) {
  for (const key in source) {
    if (typeof source[key] === "object" && source[key] !== null) {
      target[key] ??= {};
      naiveMerge(target[key], source[key]);   // 🔴 recurses into target.__proto__ === Object.prototype
    } else {
      target[key] = source[key];              // 🔴 and writes onto it
    }
  }
}
```

Reading `target["__proto__"]` returns `Object.prototype`, the recursion descends into it, and every
leaf assignment lands on the prototype every object shares.

**Three key names do it**, and a defence that blocks only the first is not a defence:

| Key | Route |
|---|---|
| `__proto__` | the accessor on `Object.prototype` |
| `constructor` → `prototype` | `obj.constructor.prototype` is `Object.prototype` |
| `prototype` | on a function target, the same thing one step earlier |

## Where the sink usually is

It is rarely a function called `merge`. It is anything that writes a **data-derived key path**:

- a deep merge or `extend` of config, defaults, or a request body
- a `set(obj, "a.b.c", value)` path helper
- query-string or form parsers that build nested objects from `a[b][c]=1`
- a `clone` implemented by copying keys
- ORM/record hydration that assigns fields by name from a row

## Why it is a real vulnerability, not a curiosity

- **Property injection / authorisation bypass.** Any later `if (obj.isAdmin)` on an object that
  does not define it reads the polluted inherited value — the example at the top.
- **Denial of service.** Polluting `toString`, `then` or `hasOwnProperty` with a non-function
  breaks unrelated code across the process. Polluting `then` in particular makes every plain object
  look like a thenable, so `await` on it hangs or throws.
- **Escalation in Node.** A polluted property that some library reads as an option — a shell, a
  path, a template setting — turns into command or code execution. This is the class that produces
  the CVEs, and it is why "it is only a client-side object" is not a safe assumption on a server.
- **It survives.** The write persists for the life of the process, so a single poisoned request can
  affect every request after it.

## Defences, in the order to apply them

**1 · Do not merge untrusted objects at all.** Copy the fields you know, by name — a normaliser
([15 · Normalising untrusted shapes](../15-normalising-untrusted-shapes/02-normalising-at-the-boundary.md)).
🔴 **This is immune by construction**: `__proto__` is not in your field list, so there is nothing to
block. Everything below is for when you genuinely must accept arbitrary keys.

**2 · Make the target prototype-less.** With no `Object.prototype` above it, `__proto__` is an
ordinary string key and the accessor does not exist:

```js
const config = Object.create(null);
config.__proto__ = { isAdmin: true };      // an ordinary own property; reaches nothing
Object.getPrototypeOf(config);              // null
```

**3 · Reject the three keys explicitly**, and use `Object.hasOwn` so inherited keys are never
walked:

```js
const BLOCKED = new Set(["__proto__", "constructor", "prototype"]);

function safeMerge(target, source) {
  for (const key of Object.keys(source)) {           // own, enumerable — not `for...in`
    if (BLOCKED.has(key)) continue;
    const value = source[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      target[key] = safeMerge(Object.hasOwn(target, key) ? target[key] : Object.create(null), value);
    } else {
      target[key] = value;
    }
  }
  return target;
}
```

⚠️ **`for...in` is part of the bug** — it walks inherited keys, so an already-polluted prototype
feeds the next merge. `Object.keys` or `Object.entries` only ever sees own enumerable properties.

**4 · Use a `Map` when the keys are data.** No prototype, no accessors, any key type — the reason
[14 · Object creation patterns](../14-object-creation-patterns/02-object-create-and-dictionaries.md)
lands on `Map` for data-keyed lookups.

**5 · Strip during parsing**, when a payload must stay a plain object:

```js
const safe = JSON.parse(raw, function (key, value) {
  if (key === "__proto__" || key === "constructor") return undefined;
  return value;
});
```

**6 · Harden the runtime**, as defence in depth rather than a fix:

- `Object.freeze(Object.prototype)` at startup makes the pollution write fail — a `TypeError` in
  strict mode, silent in sloppy ([12 · `Object.freeze` and `seal`](../12-freeze-and-seal/01-the-three-levels.md)).
  ⚠️ It can break libraries that legitimately extend prototypes, so it is an application-level
  decision, never a library one.
- Node's **`--disable-proto=delete`** (or `=throw`) removes the `__proto__` accessor outright,
  closing the most common route process-wide.

## Detecting it

A cheap smoke test, worth having in a test suite for anything that merges input:

```js
merge({}, JSON.parse('{"__proto__":{"polluted":"yes"}}'));
if ({}.polluted !== undefined) throw new Error("prototype pollution");
```

⚠️ **Run it in an isolated process.** The whole point is that the effect is global, so a polluted
prototype leaks into every later test in the same run and produces failures that look unrelated.

## Gotchas

**Symptom:** An empty object has a property nobody set
**Cause:** `Object.prototype` was polluted earlier in the process.
**Fix:** Find the merge or path-assignment that copied a data-derived key. Add the smoke test above.

**Symptom:** A defence blocking `__proto__` was bypassed
**Cause:** `constructor.prototype` is a second route, and `prototype` a third.
**Fix:** Block all three, and prefer a field-by-field copy so there is nothing to block.

**Symptom:** `await someObject` hangs or throws on a plain object
**Cause:** `then` was polluted onto `Object.prototype`, so every object looks thenable.
**Fix:** Same root cause. This is the denial-of-service shape of the bug.

**Symptom:** A sanitised merge still polluted
**Cause:** It used `for...in`, which walks inherited keys — including ones a previous pollution added.
**Fix:** `Object.keys` / `Object.entries`, plus `Object.hasOwn` for existence checks.

**Symptom:** `JSON.parse` was blamed and replacing it changed nothing
**Cause:** `JSON.parse` only creates an own `__proto__` data property; the pollution is in the code that copies it.
**Fix:** Fix the copier. A parse reviver is a mitigation, not the root cause.

**Symptom:** Tests pass individually and fail together
**Cause:** Pollution from one test persists for the process.
**Fix:** Isolate the pollution test, and assert cleanliness after it.

**Symptom:** `Object.freeze(Object.prototype)` broke a dependency
**Cause:** Something was legitimately extending a prototype at load time.
**Fix:** It is an application-level hardening choice. Freeze after that library initialises, or do not.

## Interview questions

**★ What is prototype pollution?**
Writing a property onto `Object.prototype` using a key that came from data — typically `__proto__`
in a payload fed to a deep merge or a path-setter. Because every plain object inherits from
`Object.prototype`, the write is visible on every object in the process, including ones created
before it.

**★ Is `JSON.parse` the vulnerability?**
No, and this is the part usually told wrong. `JSON.parse` creates `__proto__` as an ordinary own
data property and never invokes the inherited setter. The pollution happens when your code copies
that key with assignment, because `target["__proto__"] = value` reaches the accessor on
`Object.prototype`.

**★ Blocking `__proto__` is not enough — why?**
`constructor.prototype` reaches the same object by another route, and `prototype` does on a function
target. A key-blocklist has to cover all three, which is why copying a known field list is the
stronger defence: there is nothing to block.

**★ How do you write a merge that cannot pollute?**
Iterate `Object.keys` rather than `for...in` (inherited keys are part of the bug), skip
`__proto__`/`constructor`/`prototype`, and build intermediate objects with `Object.create(null)`.
Better still, do not accept arbitrary keys — normalise into a shape you defined.

**★ What can an attacker actually achieve?**
Authorisation bypass, when later code reads a flag off an object that does not define it. Denial of
service, by polluting `toString` or `then` — a polluted `then` makes every object look thenable and
breaks `await`. And on Node, escalation to command or code execution when a library reads the
polluted property as an option. It persists for the life of the process.

**How would you harden a Node service against it?**
`Object.freeze(Object.prototype)` at startup and `--disable-proto=delete`, both as defence in depth
— never as a substitute for fixing the merge. Freezing can break libraries that extend prototypes,
so it is an application decision, not a library one.

**How do you test for it?**
Merge `JSON.parse('{"__proto__":{"polluted":"yes"}}')` into an empty object and assert
`{}.polluted === undefined`. Run it in an isolated process, because a real pollution leaks into
every later test and produces failures that look unrelated.

---

← [1 · Extending and patching](./01-extending-and-patching.md) · [Topic index](./README.md) · [Phase index](../README.md) →
