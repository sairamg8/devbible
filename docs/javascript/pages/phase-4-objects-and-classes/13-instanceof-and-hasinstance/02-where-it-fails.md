---
title: "2 · Where it fails, and what to use instead"
sidebar_label: "2 · Where it fails"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`instanceof`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof), [`Array.isArray()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray), [`Object.prototype.toString()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/toString), [`Symbol.toStringTag`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toStringTag), [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) (thenables), [`Symbol.for()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/for), [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone); and the Node.js documentation for [`util.types`](https://nodejs.org/api/util.html#utiltypes) and [`vm`](https://nodejs.org/api/vm.html). Documentation-validated; **no timings**.

`instanceof` compares against **one specific object** — `C.prototype`, the one in *this* copy of
*this* class. Everywhere two copies of a class exist, the check returns `false` on values that are
correct in every way that matters.

There are two ways to end up with two copies, and both are ordinary.

## Failure 1 — two realms

A realm is an independent set of built-ins. An iframe, a worker, a Node `vm` context and a jsdom
environment each have their own `Array`, their own `Object`, their own `Error`:

```js
const iframe = document.createElement("iframe");
document.body.appendChild(iframe);

const foreignArray = new iframe.contentWindow.Array(1, 2, 3);

foreignArray instanceof Array;   // 🔴 false — a different Array, in a different realm
Array.isArray(foreignArray);     // ✅ true
```

Nothing is wrong with `foreignArray`. It is a real array with real array methods; it simply
inherits from the *iframe's* `Array.prototype`, and the operator was asked about ours.

**Where this actually bites**, in rough order of how often it does:

- **Tests under jsdom or a `vm` sandbox** — the classic `expected value to be an instance of Error`
  on an error that is plainly an error.
- **Anything crossing an iframe boundary** — a `postMessage` payload, a value read off
  `contentWindow`.
- **Web Workers and `worker_threads`** — values arriving through `structuredClone` are rebuilt with
  the *receiving* realm's constructors, so identity is not preserved across the boundary either.
- **Node's `vm` module**, and tooling built on it.

## Failure 2 — two copies of the same package

This one has nothing to do with realms and catches more people:

```js
// node_modules/lib-a/node_modules/shared@2.0.0/  →  class Money
// node_modules/lib-b/node_modules/shared@1.4.0/  →  class Money
value instanceof Money;   // 🔴 false — same name, same source, different class object
```

A duplicated transitive dependency, a bundler resolving ESM and CJS builds of one package
separately, a monorepo with two lockfile resolutions — each produces two distinct class objects
from the same source file. `instanceof` is identity-based, so it says `false`, and the error message
you get ("expected a Money") is actively misleading.

🔴 **This is why library authors avoid shipping `instanceof` as the public way to test their own
types.** They ship `isFoo()` instead.

## The checks that survive both

| Question | Use | Cross-realm | Notes |
|---|---|---|---|
| Is it an array? | `Array.isArray(x)` | ✅ | Checks an internal slot. The one everybody should already be using. |
| What built-in is it? | ``Object.prototype.toString.call(x)`` | ✅ | Gives ``"[object Date]"``, ``"[object Map]"``, … — but see the caveat below. |
| Is it a promise-like? | `typeof x?.then === "function"` | ✅ | Duck typing, and it is what the language itself does. |
| Node built-ins | `util.types.isDate(x)`, `Buffer.isBuffer(x)` | ✅ | Internal-slot checks, same idea as `isArray`. |
| Your own type | a static `Foo.is(x)` using a `Symbol.for` brand | ✅ | The library pattern — see below. |
| Same-realm class hierarchy | `instanceof` | ❌ | Still the right tool inside one bundle: readable, and it narrows in TypeScript. |

⚠️ **`Object.prototype.toString` can be lied to.** `Symbol.toStringTag` overrides the built-in tag
for essentially everything, including arrays:

```js
const fake = [];
Object.defineProperty(fake, Symbol.toStringTag, { value: "Date" });
Object.prototype.toString.call(fake);   // "[object Date]"
Array.isArray(fake);                    // ✅ still true — internal slots cannot be faked
```

So it is fine for diagnosis and for distinguishing built-ins you control, and it is not a security
boundary. `Array.isArray` and the `util.types.*` family are the honest checks, because they read
internal state that no property can shadow. (One edge worth knowing: `Array.isArray` returns `true`
for a `Proxy` whose target is an array — it follows the proxy to the target.)

## Duck typing, and why the language itself prefers it

The best argument against `instanceof` is that JavaScript's own most important interop point does
not use it. **`await` and `Promise.resolve` do not check `instanceof Promise`** — they check for a
callable `then` method:

```js
const thenable = { then(resolve) { resolve(42); } };
await thenable;   // 42 — no Promise involved anywhere
```

That is the *entire* reason a jQuery deferred, a Bluebird promise, a native promise and a promise
from another realm can all be awaited by the same code. Had the spec written `instanceof Promise`,
every promise library would have been mutually incompatible.

**The general form:** ask what the value can *do*, not what it *is*.

```js
const isIterable = (x) => x != null && typeof x[Symbol.iterator] === "function";
const isThenable = (x) => x != null && typeof x.then === "function";
const isStream   = (x) => x != null && typeof x.pipe === "function";
```

⚠️ **Duck typing has a real cost, and it should be stated.** It accepts a value that happens to
have a `then` method for unrelated reasons, it gives worse error messages, and it does not narrow a
type in TypeScript without a hand-written predicate. Use it at boundaries — where the value comes
from somewhere you do not control — and use `instanceof` inside your own module, where identity is
guaranteed.

## Branding your own types so the check survives

When you need a reliable "is this one of mine" across copies, the pattern is a registered symbol —
`Symbol.for` returns the *same* symbol in every realm and every copy of the code, which is exactly
the property `instanceof` lacks:

```js
const BRAND = Symbol.for("myapp.Money");

export class Money {
  static [BRAND] = true;
  [BRAND] = true;
  static is(value) { return Boolean(value?.[BRAND]); }
}

Money.is(fromAnotherCopyOfThePackage);   // ✅ true
```

A plain string property (`_isMoney`) works the same way and is what older libraries use; the symbol
just avoids colliding with real data. Either way, **the brand is what makes the check portable** —
and a `static is()` is the API to expose rather than asking callers to use `instanceof`.

## Errors deserve their own note

`err instanceof Error` is the single most common cross-realm failure, because errors travel further
than any other object — across iframes, out of workers, through test harnesses:

```js
function isError(e) {
  return Object.prototype.toString.call(e) === "[object Error]";
}
```

That is the portable check today. ⚠️ **A newer built-in, `Error.isError()`, is documented on MDN as
the intended replacement — treat it as recent and check support for your targets before relying on
it.** Meanwhile, the pragmatic version most codebases end up with is a shape check:

```js
const looksLikeError = (e) => e != null && typeof e.message === "string" && typeof e.name === "string";
```

And the practical rule for a `catch` block: **anything can be thrown**, so narrow before you touch
properties — that is the substance of
[Phase 8 · 03 · Errors and subclasses](../../phase-8-modules-errors/03-error-and-subclasses/README.md).

## So when should you use `instanceof`?

**Use it** for your own class hierarchy inside one module or bundle, for narrowing in a `catch`
where you control what is thrown, and anywhere TypeScript's flow analysis makes it pay. It is
readable, it needs no helper, and identity is not in doubt.

**Reach for something else** when the value crossed a boundary — an iframe, a worker, a `vm`, a
test environment — or when it came from a package that might exist twice, or when what you need is
capability (iterable, thenable, disposable) rather than lineage.

## Gotchas

**Symptom:** `arr instanceof Array` is `false` on something that is obviously an array
**Cause:** It came from another realm — an iframe, a worker, a `vm` context, jsdom.
**Fix:** `Array.isArray(arr)`. Never fix this with `Array.prototype.slice.call` and hope.

**Symptom:** `err instanceof Error` fails in tests but passes in the browser
**Cause:** The test environment is a separate realm with its own `Error`.
**Fix:** ``Object.prototype.toString.call(e) === "[object Error]"``, or a shape check on `name`/`message`.

**Symptom:** `value instanceof SomeClass` is `false` after adding a dependency
**Cause:** Two copies of the package are installed, so there are two distinct class objects.
**Fix:** Deduplicate the dependency, and expose a branded `SomeClass.is()` instead of asking callers to use `instanceof`.

**Symptom:** ``Object.prototype.toString.call(x)`` reports the wrong type
**Cause:** `Symbol.toStringTag` on the object overrides the built-in tag.
**Fix:** Use `Array.isArray` or `util.types.*` when the answer must be trustworthy.

**Symptom:** A custom thenable is never awaited correctly
**Cause:** `then` is not callable, or the object is `null`-ish and the check threw first.
**Fix:** `typeof x?.then === "function"` — the language's own test.

**Symptom:** A duck-typed check accepted something wrong
**Cause:** The value happened to have a `then` or `pipe` property for unrelated reasons.
**Fix:** Accepted cost at a boundary. Brand your own types with `Symbol.for` where it matters.

**Symptom:** TypeScript stops narrowing after switching from `instanceof` to a helper
**Cause:** A plain `boolean` return does not narrow.
**Fix:** Declare the helper as a type predicate — `function isMoney(x: unknown): x is Money`.

## Interview questions

**★ Why can `instanceof` fail across an iframe or a worker?**
Each realm has its own set of built-ins, so the iframe's `Array.prototype` is a different object
from ours. `instanceof` compares against one specific prototype object, so a genuine array from
another realm returns `false`. `Array.isArray` checks an internal slot instead and is unaffected.

**★ Give a non-realm reason `instanceof` returns false for a valid value.**
Two copies of the same package. A duplicated transitive dependency, or a bundler resolving the ESM
and CJS builds separately, produces two distinct class objects from identical source. This is why
libraries ship `Foo.is(x)` rather than telling you to use `instanceof`.

**★ How does `await` decide whether something is a promise?**
It does not use `instanceof`. It checks for a callable `then` method — the thenable protocol. That
duck typing is precisely why promises from different libraries and different realms interoperate at
all.

**★ Is `Object.prototype.toString.call(x)` a reliable type check?**
It is cross-realm, which `instanceof` is not, but it is spoofable: `Symbol.toStringTag` overrides
the tag for essentially anything, arrays included. Fine for diagnosis; use `Array.isArray` or
`util.types.*` when the answer has to be trustworthy, since those read internal slots.

**★ How would you make a type check that survives duplicate copies of your package?**
Brand the instances with a `Symbol.for("scope.Type")` key — registered symbols are shared across
realms and copies — and expose a `static is(value)` that checks for the brand. Do not ask consumers
to use `instanceof` on your class.

**When is `instanceof` still the right choice?**
Inside your own module or bundle, for your own class hierarchy, and in a `catch` where you control
what is thrown. It is readable, needs no helper, and narrows types in TypeScript. The failures are
all about values crossing a boundary you do not control.

**What is the trade-off of duck typing?**
It accepts anything with the right shape — including values that have a `then` method for unrelated
reasons — and it produces worse error messages and no automatic narrowing. In exchange it works
across realms, copies and implementations. Use it at boundaries; use `instanceof` internally.

---

← [1 · What it really asks](./01-what-it-really-asks.md) · [Topic index](./README.md) · [Phase index](../README.md) →
