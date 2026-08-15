---
title: "1 · The weak collections"
sidebar_label: "1 · The weak collections"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`WeakMap.prototype.set()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap/set), [`WeakSet`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakSet), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [Memory management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management), [Private properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties). Documentation-validated; **no timings**.

## The leak they exist to prevent

```js
const clickCounts = new Map();

function onClick(el) {
  clickCounts.set(el, (clickCounts.get(el) ?? 0) + 1);
}
```

🔴 **Every element ever clicked is now permanently reachable**, because the map holds a
strong reference to it. Remove the element from the DOM, navigate away, tear down the
component — it does not matter. The map is alive, so the key is alive, so the entire
detached DOM subtree hanging off that element is alive.

**One character fixes it:**

```js
const clickCounts = new WeakMap();
```

**A `WeakMap` holds its keys weakly.** If nothing else in the program references an
element, it is collectable, and its entry goes with it. You never delete anything; you
never write a cleanup path; there is nothing to get wrong.

⚠️ **This is the single most valuable thing about them**, and it is why "metadata about
objects I do not own" is their defining use case.

## The API is deliberately tiny

```js
const wm = new WeakMap();
wm.set(obj, value);
wm.get(obj);        // value, or undefined
wm.has(obj);
wm.delete(obj);

const ws = new WeakSet();
ws.add(obj);
ws.has(obj);
ws.delete(obj);
```

**And that is all of it.** No `size`. No `clear`. No `forEach`, no `keys`, no `values`,
no `entries`. Neither is iterable, so no `for...of` and no spread:

```js
[...wm];        // 🔴 TypeError — not iterable
wm.size;        // 🔴 undefined
```

### 🔴 Why the API is missing all of that

**Because iteration would make garbage collection observable.** When an object gets
collected is unspecified — it depends on the engine, the heap, the moment, and whether
anything triggered a collection at all. If you could list a `WeakMap`'s keys, the result
would change without your program doing anything, and two runs of the same code would
disagree.

**So the language removes the question rather than answering it inconsistently.** You may
ask about a key you already hold; you may not ask what keys exist. `clear()` was in early
drafts and was removed for the same family of reasons.

⚠️ **The read-through for your own code:** a `WeakMap` is only useful when you already
have the key in hand. It is an annotation you look up, never a collection you process.

## Keys must be objects

```js
wm.set({}, 1);          // ✅
wm.set(document.body, 1);   // ✅
wm.set("id", 1);        // 🔴 TypeError: Invalid value used as weak map key
wm.set(42, 1);          // 🔴 TypeError
```

**Primitives cannot be keys**, because there is nothing to collect — a string is a value,
not an identity. (Recent engines also allow non-registered symbols as weak keys; check
your targets before relying on it.)

⚠️ **That rules out the most tempting use.** "Cache by user id" cannot be a `WeakMap` —
ids are strings. Cache by the *user object*, or use a `Map` with a real eviction policy.

## What they are genuinely good at

### 1 · Metadata on objects you do not own

```js
const initialised = new WeakSet();

function setup(el) {
  if (initialised.has(el)) return;   // ✅ idempotent, and leaks nothing
  initialised.add(el);
  // … expensive one-time setup
}
```

**Marking objects — "have I seen this, initialised this, visited this" — is exactly what
`WeakSet` is for**, and it is the shape used to detect cycles while walking a graph:

```js
function walk(node, seen = new WeakSet()) {
  if (typeof node !== "object" || node === null) return;
  if (seen.has(node)) return;        // ✅ cycle
  seen.add(node);
  Object.values(node).forEach((v) => walk(v, seen));
}
```

### 2 · Memoising by object identity

```js
const cache = new WeakMap();

function expensive(config) {
  if (cache.has(config)) return cache.get(config);
  const result = compute(config);
  cache.set(config, result);
  return result;
}
```

**The cache empties itself.** When the caller drops the config object, the entry goes —
no size limit, no LRU, no eviction policy to tune. That is a genuinely better cache than
a `Map` whenever the key is an object with a natural lifetime.

⚠️ **But it is keyed on identity, not value.** A structurally identical config object is a
different key and a cache miss.

### 3 · Private state, historically

```js
const _state = new WeakMap();

class Counter {
  constructor() { _state.set(this, { n: 0 }); }
  increment() { _state.get(this).n += 1; }
}
```

🔴 **`#private` fields replaced this**, and are better in every way — no module-scope map,
no lookup on every access, and genuinely unreachable rather than merely inconvenient
([Phase 4 · 20 · 01](../../phase-4-objects-and-classes/20-private-state-before-hash/01-the-three-older-patterns.md)).
Recognise the pattern in older code; do not start it.

### 4 · Associating a library's data with a user's object

**A library that must track something per instance — a listener registry, a rendered
node, a subscription — uses a `WeakMap` so it never becomes the reason a user's object
stays alive.** That is the whole design constraint, and it is why the collection exists at
all.

## The caveat that turns it back into a strong map

**The key is weak. The value is not.**

```js
const wm = new WeakMap();
wm.set(nodeA, { relatedNode: nodeB });   // ⚠️ nodeB is held strongly
```

**As long as `nodeA` is reachable, its value is reachable — and so is everything the value
points at.** If that value references *another* key of the same map, the second entry
cannot be collected while the first is alive, and you have rebuilt the leak with more
steps.

✅ **A value referring back to its own key is fine**, and the specification guarantees it:
the pair is collected together. It is references to *other* objects — especially other
keys — that keep things alive.

**The practical rule: store plain data in the value, not object graphs.** A count, a
string, a small record. The moment the value is itself a DOM node or a big structure, ask
what is keeping it alive.

## `Map` or `WeakMap`?

| | `Map` | `WeakMap` |
|---|---|---|
| Key types | anything | objects (and non-registered symbols) |
| Keeps keys alive | ✅ | ❌ |
| `size`, iteration, `clear` | ✅ | ❌ |
| Serialisable | via `[...map]` | ❌ — nothing to iterate |
| Needs a cleanup strategy | ✅ **yes** | ❌ |

**Choose by two questions:**

1. **Do you need to enumerate?** → `Map`. There is no way around it.
2. **Is the key an object whose lifetime you do not control?** → `WeakMap`.

⚠️ **If you answer yes to both, you have a design problem, not an API problem.** Either
hold an explicit list and delete from it deliberately, or accept that the enumerable
structure is what keeps the objects alive and give it a bounded size.

## Gotchas

**Symptom:** `TypeError: Invalid value used as weak map key`
**Cause:** The key is a primitive — a string id, a number.
**Fix:** Key on the object itself, or use a `Map` with an eviction policy.

**Symptom:** `weakMap.size` is `undefined` and `[...weakMap]` throws
**Cause:** There is no `size` and no iteration, deliberately — they would make garbage
collection observable.
**Fix:** If you need to enumerate, you need a `Map`.

**Symptom:** Memory still grew despite using a `WeakMap`
**Cause:** The values hold strong references — possibly to other keys of the same map.
**Fix:** Store plain data in values; audit what the value points at.

**Symptom:** A cache keyed by a config object never hits
**Cause:** `WeakMap` keys on identity, so a structurally identical object is a different
key.
**Fix:** Reuse the object, or key on a derived string in a `Map`.

**Symptom:** A `Map` keyed by DOM nodes kept detached elements in memory
**Cause:** The map holds the nodes strongly, so removing them from the document frees
nothing.
**Fix:** `WeakMap`, or delete the entry when you remove the node.

**Symptom:** `weakMap.clear is not a function`
**Cause:** `clear()` was removed from the specification.
**Fix:** Drop the whole map — `wm = new WeakMap()` — or delete keys you hold.

## Interview questions

**★ What problem does `WeakMap` solve?**
Attaching data to an object without keeping that object alive. A `Map` holds its keys
strongly, so a cache or metadata table keyed by DOM nodes or component instances pins
every one of them in memory for the life of the map. A `WeakMap` holds keys weakly, so the
entry disappears when the key becomes unreachable — with no cleanup code.

**★ Why can't you iterate a `WeakMap` or read its `size`?**
Because that would make garbage collection observable. Collection timing is unspecified,
so an enumerable weak collection would change contents without the program doing anything,
and identical runs would disagree. The language removes the question instead. It follows
that a `WeakMap` is only useful when you already hold the key.

**★ What can be a `WeakMap` key?**
Objects — and, in recent engines, non-registered symbols. Primitives throw, because a
string or number has no identity to collect. That rules out "cache by id", which is the
most common thing people try.

**★ Does a `WeakMap` guarantee no leak?**
No. The *key* is weak; the *value* is held as long as the key is. A value that references
another key of the same map keeps that entry alive, rebuilding the leak. A value
referencing its own key is safe — that pair is collected together.

**When would you still use a `Map` with object keys?**
When you need to enumerate, report on, or serialise the contents — there is no weak
equivalent. Then the retention is your responsibility: bound the size, or delete entries
at a known lifecycle point.

**What replaced the `WeakMap` privacy pattern?**
`#private` class fields. They are unreachable by any reflection, need no module-scope map,
and cost no lookup per access. The `WeakMap` version survives only in code predating them.

---

[Topic index](./README.md) · Next: [2 · `WeakRef` and `FinalizationRegistry`](./02-weakref-and-finalizationregistry.md) →
