---
title: "3 · Deep freeze, and the alternatives"
sidebar_label: "3 · Deep freeze and alternatives"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Object.freeze()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze) (including its deep-freeze example), [`Reflect.ownKeys()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/ownKeys), [`Object.getOwnPropertyNames()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyNames), [`Object.getOwnPropertyDescriptor()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptor), [`WeakSet`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakSet), [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone). Documentation-validated; **no timings**.

Deep freezing is a recursive walk, and writing one is the standard exercise. The version everybody
writes first has three bugs.

## The naive version, and what it gets wrong

```js
function deepFreeze(obj) {
  for (const name of Object.getOwnPropertyNames(obj)) {
    const value = obj[name];                     // ⚠️ bug 2
    if (value && typeof value === "object") {
      deepFreeze(value);                         // ⚠️ bug 1
    }
  }
  return Object.freeze(obj);
}
```

**Bug 1 — cycles.** A parent/child pair that point at each other sends this into infinite recursion
and a `RangeError: Maximum call stack size exceeded`. Any object graph built from a real API
response can contain one.

**Bug 2 — it invokes getters.** `obj[name]` *runs* the accessor. A lazily-computed property is
forced, a getter with a side effect fires, and a getter that returns a fresh object each call has
that throwaway object frozen while the real state is never reached. This is the subtle one, and it
is invisible until a getter does something expensive or stateful.

**Bug 3 — it misses symbol keys.** `Object.getOwnPropertyNames` returns string keys only, so
symbol-keyed sub-objects are never frozen. Whether that matters depends on the data, but it is a
silent gap.

## The version to actually use

```js
function deepFreeze(obj, seen = new WeakSet()) {
  if (obj === null || (typeof obj !== "object" && typeof obj !== "function")) return obj;
  if (seen.has(obj)) return obj;          // cycle guard
  seen.add(obj);

  for (const key of Reflect.ownKeys(obj)) {          // strings AND symbols
    const desc = Object.getOwnPropertyDescriptor(obj, key);
    if (desc && "value" in desc) {                   // data properties only — never invoke a getter
      deepFreeze(desc.value, seen);
    }
  }
  return Object.freeze(obj);
}
```

Three changes, one per bug: a `WeakSet` of visited objects, `Reflect.ownKeys` instead of
`getOwnPropertyNames`, and reading `descriptor.value` instead of `obj[key]` so accessors are walked
past rather than run.

⚠️ **The `WeakSet` must be threaded through the recursion, not created inside it.** A fresh set per
call defeats the cycle guard entirely — the classic way this "fix" gets written and still crashes.

**It is still not total.** From [chunk 2](./02-what-freeze-cannot-reach.md): `Map` and `Set`
contents, `Date` timestamps and `#private` fields are internal state, so a deep freeze walks
straight past them and reports success. A deep-frozen object graph containing a `Map` is not
immutable, and nothing in the return value says so.

## The costs, stated honestly

**It is a full traversal.** Deep-freezing a large payload visits every node and every key. That is
work proportional to the graph, done at a moment you chose — usually right after a parse, which is
the worst moment, because it doubles the cost of ingesting data you may only read a field or two
from.

**It is permanent, and it is contagious downwards.** Every nested object is frozen too, and
`configurable: false` cannot be undone. If any downstream code mutates part of that graph as a
matter of course — a cache field, a normalisation step, an ORM hydrating a relation — it now throws
in production, and the fix is a copy at every such site.

🔴 **No timings appear on this page** (rule 8 — nothing was run here). Claims about how engines
optimise frozen objects vary by engine and version and are not worth carrying: **treat freeze as a
correctness tool, never as a performance one**, and do not assume it makes anything faster or
slower.

## Freeze in development, skip it in production

This is the pattern most libraries settled on, and it gets the benefit without paying for it in
production:

```js
export function protect(value) {
  return process.env.NODE_ENV === "production" ? value : deepFreeze(value);
}
```

The reasoning: the freeze exists to **catch a mutation bug during development**, and once the code
is correct the runtime enforcement earns nothing. It also fails loudly at exactly the moment a
developer can act on it, rather than in a user's browser. React's development build has long used a
comparable approach for props, and Redux's `redux-freeze`-style middleware is the same idea applied
to the store.

⚠️ **The trade-off is real:** the two builds now differ in behaviour, so a mutation introduced by a
production-only code path will not be caught. Accept that deliberately, or freeze everywhere.

## When freezing genuinely pays

**Exported constant objects.** The single best use, and cheap because it is shallow and one-off:

```js
export const STATUS = Object.freeze({ IDLE: "idle", BUSY: "busy", FAILED: "failed" });
```

Without it, any importer can add or overwrite a key and every other importer sees the change —
module objects are shared, not copied.

**A shared default-options object.** A module-level default that one caller mutates is a bug that
reappears on the *next* call, in unrelated code. Freezing it converts a heisenbug into an immediate
`TypeError`; the surrounding problem, and the four ways to fix it, are in
[Phase 3 · 17 · Merging, forwarding and identity](../../phase-3-functions/17-closure-and-default-gotchas/02-merging-forwarding-and-identity.md).

**Test fixtures.** A frozen fixture guarantees that test 3 cannot be passing because test 1 mutated
it.

**Anything you hand to code you do not control.** A frozen object passed to a plugin, a callback or
a third-party library cannot come back modified.

## The alternatives, and when each beats freezing

| Approach | Enforced | Cost | Use when |
|---|---|---|---|
| **Just do not mutate** — plus a lint rule | code review | none | Almost always. The cheapest guarantee is a convention the team keeps. |
| **TypeScript `readonly` / `as const`** | compile time | none at runtime | You have TypeScript. It catches mutation before the code runs — but it is **erased at build**, so it protects nothing against JavaScript callers or `any`. |
| **`Object.freeze`** | runtime | shallow: negligible; deep: a full walk | Exported constants, shared defaults, and values crossing a trust boundary. |
| **Copy on read** — hand out `structuredClone(state)` | runtime | a clone per read | The caller genuinely needs a mutable value and must not affect yours. |
| **Structural sharing** — Immer, Immutable.js | runtime | a library | Large state trees updated often, where copy-on-write with sharing beats both freezing and cloning. |

🔴 **`readonly` and `Object.freeze` are complements, not competitors.** One is a compile-time
contract with no runtime cost, the other a runtime guarantee with no compile-time help. The common
production shape is `as const` for the type plus a shallow `Object.freeze` for the export.

## Choosing, in one pass

- **A constant object you export** → `Object.freeze`, shallow. Always worth it.
- **A mutable state object where typos must fail** → `Object.seal`.
- **A parsed API payload** → do not freeze it. Normalise it into the shape you want
  (**15 · Normalising untrusted shapes** *(not written yet)*) and freeze the small result if it is
  shared.
- **A large state tree** → structural sharing, or dev-only deep freeze. Not a production deep
  freeze on every update.
- **You only need to stop *your own* code mutating** → TypeScript `readonly`, and skip the runtime
  cost entirely.

## Gotchas

**Symptom:** `RangeError: Maximum call stack size exceeded` from a deep freeze
**Cause:** A cycle in the object graph, and no visited-set.
**Fix:** Thread a `WeakSet` through the recursion — created once at the top, not per call.

**Symptom:** Deep-freezing ran expensive code, or triggered a side effect
**Cause:** `obj[key]` invokes getters. The walk called every accessor it passed.
**Fix:** Read `Object.getOwnPropertyDescriptor(obj, key).value` and recurse only into data properties.

**Symptom:** A symbol-keyed sub-object came back mutable after a deep freeze
**Cause:** `Object.getOwnPropertyNames` returns string keys only.
**Fix:** `Reflect.ownKeys`.

**Symptom:** A deep-frozen graph is still mutating
**Cause:** It contains a `Map`, `Set`, `Date` or class instance with `#private` state — all internal slots.
**Fix:** Freeze does not reach them. Wrap or copy those parts instead.

**Symptom:** Code that worked in development throws `TypeError` in production, or the reverse
**Cause:** A dev-only freeze — the two builds have different mutability.
**Fix:** Accept it deliberately, or freeze in both. Do not debug it as a production-only bug.

**Symptom:** A TypeScript `readonly` array was mutated at runtime anyway
**Cause:** `readonly` is erased at compile time; it constrains TypeScript callers only.
**Fix:** Add `Object.freeze` if a runtime guarantee is actually required.

**Symptom:** Freezing a parsed payload broke an ORM or a caching layer downstream
**Cause:** Deep freeze is contagious — every nested object is now locked for every consumer.
**Fix:** Freeze the small normalised result you share, not the raw payload.

## Interview questions

**★ How would you deep-freeze an object?**
Recurse over `Reflect.ownKeys`, recurse only into **data** property values read from the descriptor
(so getters are not invoked), guard cycles with a `WeakSet` threaded through the recursion, then
`Object.freeze` on the way out. And say what it still misses: `Map`/`Set` contents, `Date`
timestamps and `#private` fields are internal slots the walk cannot reach.

**★ What are the two bugs in the naive `deepFreeze` everyone writes first?**
Infinite recursion on a cyclic graph, and invoking getters — `obj[key]` runs the accessor, forcing
lazy values and firing side effects, and freezing whatever throwaway object a getter returned rather
than the real state. A third, smaller one: `getOwnPropertyNames` misses symbol keys.

**★ Should you deep-freeze application state in production?**
Usually not. It is a full traversal at a moment you chose, it is irreversible, and it is contagious
to every nested object and every downstream consumer. The common pattern is to freeze in
development only — the point is catching a mutation bug while someone can act on it — or to use
structural sharing for large trees.

**★ How do `Object.freeze` and TypeScript's `readonly` differ?**
`readonly` is a compile-time contract that is erased at build time, so it costs nothing at runtime
and protects nothing at runtime. `Object.freeze` is a runtime guarantee with no compile-time help.
They are complements: `as const` plus a shallow freeze on an exported constant is the usual shape.

**★ What is the best everyday use of `Object.freeze`?**
Exported constant objects — a status map, an action-type map, a default-options object. It is
shallow, one-off and cheap, and it stops one importer's mutation from silently reaching every other
importer of the same module object.

**Is a frozen object faster?**
Do not assume it either way, and do not choose freeze for performance. It is a correctness tool; any
engine-level effect varies by engine and version and is not something to design around.

**How do you make an immutable `Map`?**
There is no built-in way — freezing does nothing to it. Wrap it in a `Proxy` or an object exposing
only the read methods, hand out a copy per access, or use a plain frozen object if a `Map` is not
strictly required.

---

← [2 · What freeze cannot reach](./02-what-freeze-cannot-reach.md) · [Topic index](./README.md) · [Phase index](../README.md) →
