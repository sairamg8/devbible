---
title: "04.2 · Syntax, and when not to use one"
sidebar_label: "02 · Syntax and when not to"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6). Script:
> `sandbox/js-p3/ex4-arrows.mjs`.

**The concise body is where arrows earn their keep and where they bite.** One
pair of braces changes an expression into a block, and the failure is a silent
`undefined` rather than an error.

## Implicit return, and the object-literal trap

```
--- implicit return, and the object-literal trap ---
  n => n * 2                                       8
  n => { value: n }   ← parsed as a BLOCK          undefined
  n => ({ value: n }) ← parenthesised              {"value":4}
```

```js
const ret1  = (n) => n * 2;             // ret1(4)  → 8
const wrong = (n) => { value: n };      // wrong(4) → undefined
const right = (n) => ({value: n});      // right(4) → { value: 4 }
```

`{` after the arrow always starts a **block**, never an object literal. So
`{ value: n }` is a block containing a **label** `value:` and an expression
statement `n` — legal code that does nothing and returns `undefined`.

Nothing warns you. No syntax error, no lint failure by default, and the function
even runs. The symptom appears somewhere downstream as
`Cannot read properties of undefined`.

Wrap in parentheses to force expression position: `(n) => ({value: n})`. This
matters most where returning an object is the whole point — and the arity of the
object decides whether you get a loud failure or a silent one:

```
--- the object-literal trap: one property parses, two do not ---
  rows.map(r => { id: r.id })  ← one label         [ undefined, undefined ]
  rows.map(r => { id: r.id, name: r.name })        SyntaxError: Unexpected token ':'
  rows.map(r => ({ id: r.id, name: r.name }))      [{"id":1,"name":"ada"},{"id":2,"name":"linus"}]
```

**The one-property case is the dangerous one, precisely because it parses.** A
single `id: r.id` is a valid labelled statement, so you get an array of
`undefined` and no complaint. Add a second property and the comma makes it
illegal — `SyntaxError: Unexpected token ':'` — which is the better outcome,
because it fails at parse time.

So the bug is most likely to survive in exactly the smallest case, and to
disappear the moment you add a field to it.

## A concise body holds an expression, nothing else

```
--- a concise arrow body cannot hold a statement ---
  eval("(n) => if (n) 1")                          SyntaxError: Unexpected token 'if'
  eval("() => return 1")                           SyntaxError: Unexpected token 'return'
```

No `if`, no `for`, no `return`, no `throw` — those are statements, and a concise
body is an expression position. `return` is especially worth noting: writing it
is a syntax error because the return is already implicit.

Conditionals still work as expressions — the ternary and the logical operators
are expressions, so they are legal:

```js
const grade = (n) => n >= 50 ? 'pass' : 'fail';
const label = (u) => u.nickname ?? u.name ?? 'anonymous';
```

The moment you need a statement, add braces and an explicit `return`. There is no
prize for keeping it on one line.

## Async yes, generator no

```
--- arrows are not constructible, but ARE callable — generators/async differ ---
  async () => 1 returns                            [object Promise]
  eval("const g = *() => {}")                      SyntaxError: Unexpected token '*'
  there is no generator arrow                      function* only
```

`async () => …` is fully supported and returns a promise like any async function.
**There is no generator arrow** — no `*() => {}` syntax exists, so a generator
must be `function*`. This is not an oversight to work around; generators need
their own `this`-adjacent machinery that arrows deliberately lack.

## Methods vs class-field arrows

This is the decision that has a real cost attached, so it is measured rather than
argued:

```
--- prototype methods vs class-field arrows: shared or per-instance ---
  two instances, prototype method: m1.m === m2.m   true
  two instances, field arrow: f1.m === f2.m        false
  is the method on the prototype?                  true
  is the field on the prototype?                   false
  own keys of a prototype-method instance          []
  own keys of a field-arrow instance               ["m"]
  JSON.stringify of the field-arrow instance       {}  ← functions are skipped
```

```js
class WithMethod { m() { return 1; } }      // one function, on the prototype
class WithField  { m = () => 1; }           // one function PER INSTANCE
```

Four consequences, all visible above:

1. **Allocation.** A prototype method is one function object shared by every
   instance (`m1.m === m2.m` is `true`). A field arrow is a new closure per
   instance (`false`). Ten thousand instances means ten thousand functions.
2. **Not on the prototype.** `'m' in Object.getPrototypeOf(f1)` is `false`, so it
   cannot be overridden by a subclass through the normal prototype mechanism, nor
   stubbed via `WithField.prototype.m` in a test.
3. **It becomes an own enumerable key.** `Object.keys(f1)` is `["m"]`, so it shows
   up in spreads, `Object.assign`, and anything that enumerates own properties.
4. **`JSON.stringify` still skips it** — `{}` — because functions are dropped by
   `stringify` regardless. So serialisation is unaffected, but object-spread
   cloning is not.

**Use a field arrow when the method is passed as a value and must keep `this`** —
a React event handler, a listener you register once. **Use a prototype method
everywhere else**, and bind at the single call site that needs it.

## When not to use an arrow

| Situation | Use | Why |
|---|---|---|
| Object method needing `this` | `method() {}` | An object literal is not a scope — `this` escapes to module scope |
| Prototype method | `method() {}` | Shared, overridable, stubbable |
| Constructor | `function` / `class` | Arrows have no `prototype` |
| Generator | `function*` | No arrow generator syntax exists |
| Needs its own `arguments` | `function` or `(...args) =>` | An arrow inherits the outer one silently |
| Needs `new.target` | `function` | `SyntaxError` in an arrow with no enclosing function |
| Callback inside a method | **arrow** | Preserves the method's `this` for free |
| Class handler passed as a value | **class field arrow** | Survives detaching, at one closure per instance |
| Short pure transform | **arrow** | Concise body reads better than `function` |

The default remains: **arrow for callbacks and nested functions, `function` or
method shorthand for anything that is called as a method or with `new`.**

## Gotchas

**Symptom:** An arrow returns `undefined` where you expected an object
**Cause:** `{` after the arrow started a block. Measured: `n => { value: n }`
returned `undefined` — it is a labelled statement, not an object. Only the
one-property form parses; two properties give
`SyntaxError: Unexpected token ':'`.
**Fix:** Parenthesise — `n => ({value: n})`.

**Symptom:** `SyntaxError: Unexpected token 'return'`
**Cause:** `return` inside a concise body, where the return is already implicit.
**Fix:** Drop the `return`, or add braces around the body.

**Symptom:** `SyntaxError: Unexpected token 'if'` in a one-line arrow
**Cause:** A concise body is an expression position; `if` is a statement.
**Fix:** Use a ternary, or add braces.

**Symptom:** Memory grows with instance count after converting methods to class
fields
**Cause:** A field arrow allocates one closure per instance. Measured:
`f1.m === f2.m` is `false`.
**Fix:** Keep prototype methods; bind at the call site that needs a detached
reference.

**Symptom:** A test cannot stub a class method
**Cause:** It is a field arrow, so it is not on the prototype. Measured:
`'m' in Object.getPrototypeOf(f1)` is `false`.
**Fix:** Make it a prototype method, or stub the instance property directly.

**Symptom:** Spreading an instance copies its methods too
**Cause:** Field arrows are own enumerable properties. Measured:
`Object.keys(f1)` is `["m"]`.
**Fix:** Prototype methods, which are not own properties.

## Interview questions

**★ What does `n => { value: n }` return?**
`undefined`. The braces start a block, `value:` is a label and `n` is an
expression statement — measured. `n => ({value: n})` is the object version. The
one-property form parses cleanly so nothing warns you; a two-property version
would have failed loudly with `SyntaxError: Unexpected token ':'`.

**★ When should you not use an arrow function?**
Object and prototype methods that need `this`, constructors (no `prototype`),
generators (no such syntax), and anything needing its own `arguments` or
`new.target`. Arrows are for callbacks and nested functions.

**★ What is the cost of a class field arrow versus a prototype method?**
One closure per instance instead of one shared function (measured
`f1.m === f2.m` is `false`), it is not on the prototype so it cannot be
overridden or stubbed there, and it becomes an own enumerable key that shows up
in spreads. In exchange it survives being detached from the instance.

**Can an arrow function be async? A generator?**
Async yes — `async () => 1` returns a promise (measured `[object Promise]`).
Generator no; `*() => {}` is a `SyntaxError`, so generators must be `function*`.

**Why can't a concise arrow body contain an `if`?**
Because it is an expression position, and `if` is a statement — measured
`SyntaxError: Unexpected token 'if'`. Use a ternary or add braces.

---

← [Lexical `this` and the missing bindings](./01-lexical-this.md) · [Topic index](./README.md) · Next → [`call`, `apply` and `bind`](../05-call-apply-bind.md)
