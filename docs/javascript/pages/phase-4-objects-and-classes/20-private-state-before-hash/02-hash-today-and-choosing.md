---
title: "2 · `#` today, and choosing"
sidebar_label: "2 · # today, and choosing"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Private properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties), [`in` operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in) (private-field brand checks), [Classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes), [`static`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/static), [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify), [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone), [`Object.freeze()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze), [`Proxy`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy). Documentation-validated; **no timings**.

```js
class Counter {
  #count = 0;
  static #instances = 0;

  #bump(by) { this.#count += by; }     // private method
  increment() { this.#bump(1); return this.#count; }
  get value() { return this.#count; }
}
```

**`#` is enforced by the syntax, not by a convention or a lookup.** Fields, methods, getters,
setters and statics can all be private, and access from outside the class body is a **`SyntaxError`
at parse time** — the error arrives before the code ever runs:

```js
counter.#count;   // 🔴 SyntaxError: Private field '#count' must be declared in an enclosing class
```

Reaching a private field on an object that is not an instance is a **`TypeError`**, and that is the
brand check that makes `#` more than sugar: a private field cannot be forged, borrowed or added
later.

## `#x in obj` — the brand check, done properly

```js
class Money {
  #cents = 0;
  static isMoney(v) { return #cents in v; }    // ✅ no try/catch, no throw
}
```

Before this existed, testing whether an object was a real instance meant a `try/catch` around a
field access. `#field in obj` returns a plain boolean and is the honest answer to the question
[13 · `instanceof`](../13-instanceof-and-hasinstance/02-where-it-fails.md) cannot answer reliably —
**it survives realms and duplicate package copies**, because it tests the actual brand rather than a
prototype identity.

## What `#` is invisible to, and why that matters

Private fields are not properties. Nothing in the reflection surface sees them:

| | Sees `#private`? |
|---|---|
| `Object.keys`, `getOwnPropertyNames`, `Reflect.ownKeys` | ❌ |
| `JSON.stringify` | ❌ |
| `Object.freeze` / `seal` | ❌ — a frozen instance can still mutate them |
| `Proxy` traps | ❌ — and a proxied instance **throws** on private access |
| `structuredClone` | ❌ — and it cannot clone a class instance's identity anyway |
| devtools | ✅ shown, as a debugging affordance |

Four of those have already bitten in this phase, and they are the same fact each time:

- 🔴 **A class with only `#` state and no `toJSON` serialises to `{}`** — silently
  ([17 · Implementing it](../17-tostring-valueof-toprimitive/02-implementing-and-the-neighbours.md)).
- **`Object.freeze` on such an instance protects nothing that matters**
  ([12 · What freeze cannot reach](../12-freeze-and-seal/02-what-freeze-cannot-reach.md)).
- **A `Proxy` around it throws** on any method touching a private field
  ([19 · The traps](../19-proxy-and-reflect/01-the-traps-and-reflect.md)).
- **Tests cannot reach it**, which is a feature: test through the public API. If a private field is
  the only way to assert something, the class is probably missing a public observation.

## Choosing, in one pass

- **New code, class-based** → **`#`**. Enforced, no boilerplate, no collisions, and the brand check
  comes free.
- **New code, factory-based** → closure variables. Same guarantee, different object model
  ([14 · Factory, constructor, class](../14-object-creation-patterns/01-factory-constructor-class.md)).
- **You must support a runtime without `#`** → a module-scoped `WeakMap`, which is what the
  compilers emitted anyway.
- **Avoiding key collisions rather than hiding data** → a `Symbol`.
- **Marking something as "internal" that genuinely must stay serialisable and reachable** → the
  underscore convention, deliberately, with a comment saying why.

⚠️ **Do not churn a working codebase to `#`.** Converting `_name` to `#name` changes what
`JSON.stringify` produces, what `Object.keys` returns, what a `Proxy` wrapper does, and whether
tests compile. Those are real behaviour changes, not a rename — do it when touching the class
anyway, not as a sweep.

## Two limits worth knowing before committing

**Private fields do not survive serialisation round-trips.** `structuredClone` and any
`JSON.parse(JSON.stringify(x))` produce a plain object with none of them. A class whose identity
lives in private state needs an explicit `toJSON`/`fromJSON` pair — which is good design regardless.

**Subclasses cannot see a parent's private fields.** `#` is per-class, not per-hierarchy, so a
subclass needing access means the parent must expose a `protected`-style accessor — and JavaScript
has no `protected`. That is a genuine gap: the options are a public-but-documented accessor, or
composition instead of inheritance
([18 · Why deep hierarchies fail here](../18-mixins-and-composition/01-why-deep-hierarchies-fail-here.md)).

## Gotchas

**Symptom:** `SyntaxError: Private field '#x' must be declared in an enclosing class`
**Cause:** Access from outside the class body — including from a test file.
**Fix:** Expected. Test through the public API, or expose a getter if the value is genuinely public.

**Symptom:** `TypeError: Cannot read private member #x from an object whose class did not declare it`
**Cause:** The method ran with a `this` that is not an instance — a detached method, a proxy, or a plain object.
**Fix:** Bind the method, or use `#x in obj` to check first.

**Symptom:** An instance serialises to `{}`
**Cause:** All its state is private, and `JSON.stringify` cannot see private fields.
**Fix:** Add `toJSON()`.

**Symptom:** A frozen instance still changed
**Cause:** `Object.freeze` only touches properties; `#` fields are not properties.
**Fix:** Return new instances instead of mutating, if immutability is the goal.

**Symptom:** Wrapping an instance in a `Proxy` broke every method
**Cause:** Private access requires the real receiver; the proxy is a different object.
**Fix:** Bind methods to the target in the `get` trap, or do not proxy class instances.

**Symptom:** A subclass cannot read the parent's `#field`
**Cause:** Private fields are per-class. There is no `protected`.
**Fix:** An accessor on the parent, or composition.

**Symptom:** Converting `_x` to `#x` broke an API response or a test
**Cause:** It is a behaviour change — enumeration and serialisation both differ.
**Fix:** Convert deliberately, with a `toJSON` if the field was being serialised on purpose.

## Interview questions

**★ What does `#` give you that a `WeakMap` or an underscore does not?**
Enforcement by syntax with no boilerplate. Outside access is a `SyntaxError` at parse time, access
on a non-instance is a `TypeError`, subclass collision is impossible, and the field is invisible to
every reflection API. A `WeakMap` achieves the privacy but costs verbosity at every access; the
underscore achieves nothing but documentation.

**★ What is `#x in obj` for?**
A brand check — whether an object is a real instance of the class — returning a boolean instead of
requiring `try/catch` around a field access. It is more reliable than `instanceof` because it tests
the actual private brand, so it survives realms and duplicate package copies.

**★ What is `#private` invisible to?**
`Object.keys`, `getOwnPropertyNames`, `Reflect.ownKeys`, `JSON.stringify`, `Object.freeze` and
`Proxy` traps — and proxying an instance makes private access throw. Devtools do show them, as a
debugging affordance. The serialisation case is the one that causes real bugs: an all-private class
with no `toJSON` stringifies to `{}`.

**★ Can a subclass access a parent's private field?**
No. `#` is per-class, and JavaScript has no `protected`. The parent must expose an accessor, or the
relationship should be composition rather than inheritance.

**★ Would you migrate an existing codebase from `_x` to `#x`?**
Not as a sweep. It changes `JSON.stringify` output, `Object.keys`, proxy behaviour and test access —
real behaviour changes rather than a rename. Do it when the class is being modified anyway, adding a
`toJSON` if the field was serialised on purpose.

**How do you test private state?**
Through the public API. If an assertion is impossible without reaching a private field, the class is
usually missing a public observation that its real callers need too.

**What happens to private fields under `structuredClone`?**
They are lost — the result is a plain object with none of them, and no class identity. A class whose
meaning lives in private state needs an explicit `toJSON`/`fromJSON` pair.

---

← [1 · The three older patterns](./01-the-three-older-patterns.md) · [Topic index](./README.md) · [Phase index](../README.md) →
