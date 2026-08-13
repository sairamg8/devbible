---
title: "03.1 · The four binding rules"
sidebar_label: "01 · The four rules"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6). Scripts: `sandbox/js-p3/ex3-this.mjs`, `sandbox/js-p3/ex3b-this-sloppy.cjs`.

**`this` is bound at call time.** Reading the function body tells you nothing;
reading the call site tells you everything. Four rules decide it, and they have a
strict precedence order.

## `this` is not a property of the function

Start here, because it dissolves most confusion. One function, four call sites,
four different values of `this`:

```
--- same function, four receivers — this is not a property of the function ---
  a.who()                                            a
  b.who()                                            b
  whoAmI()                                           undefined
  whoAmI.call({name: "adhoc"})                       adhoc
```

```js
function whoAmI() { return this === undefined ? 'undefined' : this.name; }
const a = {name: 'a', who: whoAmI};
const b = {name: 'b', who: whoAmI};
```

The function object is the same object in all four rows. Nothing about `whoAmI`
changed — only how it was invoked. **`this` behaves like a hidden first
parameter that the call site fills in.**

## The decision tree

Read the call site and take the first rule that matches:

| # | Rule | The call looks like | `this` becomes |
|---|---|---|---|
| 1 | **`new`** | `new Fn()` | a fresh object linked to `Fn.prototype` |
| 2 | **Explicit** | `fn.call(o)` · `fn.apply(o)` · `fn.bind(o)()` | `o` |
| 3 | **Implicit** | `obj.fn()` | `obj` — whatever is left of the last dot |
| 4 | **Default** | `fn()` | `undefined` in strict mode, `globalThis` in sloppy |

Arrow functions are outside this tree entirely — they have no `this` of their
own and are covered on [their own page](../04-arrow-functions-and-this/README.md).

## Rule 4 — default binding

```
--- rule 4 (default): a plain call — module code is strict ---
  plain()                                            undefined
  this at module top level                           undefined  ← undefined in an ES module
  globalThis is still reachable                      object
```

A bare `fn()` has no receiver. In strict mode `this` is `undefined`; in sloppy
mode it is `globalThis`.

**Assume strict.** ES modules, class bodies and anything with `'use strict'` are
all strict, which is essentially all modern code. The sloppy behaviour and why
strict is the improvement, measured in an inline check:

```
--- sloppy mode: default binding is globalThis, not undefined ---
  sloppy(): this === globalThis                      true
  strict fn(): this                                  undefined

--- why strict is the improvement ---
  sloppy: this.accidentalGlobal = ... created        "leaked"
  strict: this.count = 0 throws                      TypeError: Cannot set properties of undefined (setting 'count')
```

A mis-called function used to silently create a global; now it throws at the
mistake instead of producing a mystery three files away.

Note the second row of the first block: `this` at the top level of an **ES module
is `undefined`** — not `globalThis`, and not `module.exports`. The same position
in a CommonJS file is a different value:

```
--- module top-level `this` differs by module system ---
  CJS: this === module.exports                       true
  CJS: this                                          {}
```

Use `globalThis` when you actually want the global object.

## Rule 3 — implicit binding

```
--- rule 3 (implicit): this is whatever is LEFT OF THE DOT ---
  counter.read()                                     counter
  nested.inner.read()  ← only the LAST dot counts    inner
```

```js
const nested = {label: 'outer', inner: {label: 'inner', read() { return this.label; }}};
nested.inner.read();     // 'inner'
```

**Only the last dot counts.** `nested.inner.read()` binds `this` to `inner`, not
to `nested`. The chain that got you to the function is irrelevant — only the
object the call is made *on*.

This is the rule people think they understand and then trip over, because it is
purely syntactic. It depends on the shape of the expression at the call site,
which means it disappears the moment the function is passed around rather than
called through the object — the subject of
[the next chunk](./02-losing-and-fixing-this.md).

## Rule 2 — explicit binding

```
--- rule 2 (explicit): call / apply / bind ---
  whoAmI.call({name:"c"})                            c
  whoAmI.apply({name:"d"})                           d
  whoAmI.bind({name:"e"})()                          e
  a bound function re-bound                          e  ← bind wins, permanently
  bound.name                                         "bound whoAmI"
  bound.length (whoAmI takes 0)                      0
```

`call` and `apply` invoke immediately and differ only in how arguments are
passed — `call(this, a, b)` versus `apply(this, [a, b])`. `bind` invokes nothing;
it returns a **new function** with `this` fixed forever.

Two measured details worth carrying:

- **A bound function cannot be re-bound.** `bound.call({name: 'IGNORED'})`
  returned `e`, the originally bound value. The binding is baked into an exotic
  object, not stored in a writable slot. Binding twice is silently a no-op.
- **`bound.name` is `"bound whoAmI"`.** The engine prefixes it, which is a small
  gift in stack traces — a frame reading `bound handleClick` tells you the
  function was bound at some point.

Full treatment in [`call`, `apply` and `bind`](../05-call-apply-bind.md).

## Rule 1 — `new` binding

```
--- what new actually does, step by step ---
  new Widget(7) → this is a fresh object             {"id":7}
  linked to Widget.prototype                         true
  a constructor returning an OBJECT                  {"b":2}  ← the return wins
  a constructor returning a PRIMITIVE                {"a":1}  ← ignored
```

`new Fn(args)` performs four steps:

1. Create a fresh empty object.
2. Set its prototype to `Fn.prototype` — measured `true` above.
3. Call `Fn` with `this` bound to that object.
4. Return that object **unless the constructor returned an object of its own**.

Step 4 is the one that gets asked. A constructor returning an object replaces the
instance entirely — `new Returns()` gave `{"b":2}`, and the `this.a = 1` it also
did was thrown away. Returning a **primitive** is ignored, so `new
ReturnsPrimitive()` still gave `{"a":1}` despite `return 42`.

That asymmetry is what makes constructors that "sometimes return a cached
instance" work, and it is also why an accidental `return someObject` in a
constructor produces an instance with no methods — its prototype is whatever the
returned object had, not `Fn.prototype`.

## Precedence, measured

```
--- precedence, measured in one object ---
  target.report()                     implicit       implicit
  target.report.call({tag:"explicit"}) explicit      explicit
  boundToExplicit()                    bound         bound
  boundToExplicit.call({tag:"x"})      bound wins    bound
```

Explicit beats implicit; `bind` beats a later `call`. And `new` beats `bind`:

```
--- rule 1 (new) beats everything below it ---
  new (Person.bind({name:"bound-target"}))("from-new") "from-new"
    ↑ new overrode the bind                          the bound this was discarded, the arg was not
```

```js
function Person(name) { this.name = name; }
const bp = Person.bind({name: 'bound-target'});
new bp('from-new').name;      // 'from-new'
```

`new` on a bound function **discards the bound `this`** and uses a fresh object —
but keeps any bound *arguments*. That is the documented behaviour of a bound
exotic object's `[[Construct]]`, and it is what lets `bind` be used for partial
application on constructors without breaking `new`.

The full order, highest first: **`new` → `bind` → `call`/`apply` → implicit →
default.**

## Gotchas

**Symptom:** `TypeError: Cannot read properties of undefined (reading 'x')`
inside a method
**Cause:** Default binding — the function was called without a receiver, so
`this` is `undefined` in strict mode.
**Fix:** Call it through the object, or bind it. Diagnosis in
[Losing `this`](./02-losing-and-fixing-this.md).

**Symptom:** `this` is the wrong object in a nested property chain
**Cause:** Only the last dot counts. Measured: `nested.inner.read()` bound
`inner`, not `nested`.
**Fix:** Call on the object you actually want, or use `call` to say so
explicitly.

**Symptom:** `bind` appears to have no effect when you re-bind
**Cause:** A bound function's `this` is fixed permanently. Measured:
`bound.call({name: 'IGNORED'})` still returned `e`.
**Fix:** Bind the original function, not the already-bound one — keep a
reference to the unbound version if you need both.

**Symptom:** A `new` instance has none of its prototype methods
**Cause:** The constructor returned an object, which replaces the instance —
including its prototype link. Measured: `new Returns()` gave `{"b":2}`.
**Fix:** Don't return from a constructor. Return only when deliberately
implementing a factory or a cache.

**Symptom:** `this` is `undefined` at the top of a module, where you expected the
global
**Cause:** Module top-level `this` is `undefined` by specification — measured.
**Fix:** `globalThis`.

## Interview questions

**★ How is `this` determined?**
By the call site, not the definition site, using four rules in precedence order:
`new`, then explicit (`call`/`apply`/`bind`), then implicit (`obj.fn()`), then
default (`undefined` in strict, `globalThis` in sloppy). Measured: one function
body gave `a`, `b`, `undefined` and `adhoc` from four different call sites.

**★ What is `this` in a plain function call?**
`undefined` in strict mode — which covers all module and class code — and
`globalThis` in sloppy mode. The strict behaviour is the useful one: it turns a
silent global write into an immediate `TypeError`.

**★ What does `new` do?**
Creates an object, links its prototype to `Fn.prototype` (measured `true`), calls
`Fn` with `this` bound to it, and returns it — unless the constructor returns an
object, which wins. A returned primitive is ignored (measured: `return 42` still
produced `{"a":1}`).

**★ What wins, `bind` or `new`?**
`new`. Measured: `new (Person.bind({name: 'bound-target'}))('from-new')` produced
`name: 'from-new'` — the bound `this` was discarded, though bound *arguments*
would still apply.

**Can you re-bind a bound function?**
No. The binding is permanent; a later `call`, `apply` or `bind` is ignored.
Measured: `bound.call({name: 'IGNORED'})` returned the original `e`. `bind` also
renames the function to `"bound whoAmI"`.

**In `a.b.c.method()`, what is `this`?**
`a.b.c` — only the last dot before the call matters. The rest of the chain is
just how you reached the function.

---

← [Topic index](./README.md) · Next → [Losing `this`, and getting it back](./02-losing-and-fixing-this.md)
