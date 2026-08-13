---
title: "07.2 · `var`, `let` and `const`"
sidebar_label: "02 · var, let and const"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6). Scripts: `sandbox/js-p3/ex7-scope.mjs`, `sandbox/js-p3/ex7b-scope-sloppy.cjs`.

**Three declaration keywords, and the differences are not stylistic.** They scope
differently, they redeclare differently, and one of them silently leaks out of
the block you wrote it in.

The short version: **`const` by default, `let` when you must reassign, `var`
never.** The rest of this page is why.

## Function scope versus block scope

```
--- var is FUNCTION scoped; let/const are BLOCK scoped ---
  after an if-block                                  v=var  l → ReferenceError  c → ReferenceError
  after two loops                                    a=1  b → ReferenceError
```

```js
function scopes() {
  if (true) { var v = 'var'; let l = 'let'; const c = 'const'; }
  return v;            // 'var'  — escaped the block
  // l and c are ReferenceError here
}
```

`var` ignores blocks entirely and attaches to the nearest **function** (or
module/script). `let` and `const` attach to the nearest **block**, which includes
`if`, `for`, `while`, `try`, and a bare `{ … }`.

The loop row shows the same thing with the counter: `var a` is still `1` after
the loop, while `let b` is gone. That escaping counter is what makes the
`var`-in-a-loop closure bug possible — see
[Closures](../06-closures/01-what-is-captured.md).

## Redeclaration

```
--- redeclaration rules ---
  let a; let a;                                      SyntaxError: Identifier 'dup' has already been declared
  var a; var a;                                      parsed — var allows it
  let a; var a;                                      SyntaxError: Identifier 'dup3' has already been declared
  const without an initialiser                       SyntaxError: Missing initializer in const declaration
  reassigning a const                                TypeError: Assignment to constant variable.
```

| Action | `var` | `let` | `const` |
|---|---|---|---|
| Redeclare in the same scope | allowed | `SyntaxError` | `SyntaxError` |
| Reassign | allowed | allowed | **`TypeError`** |
| Declare without a value | allowed (`undefined`) | allowed (`undefined`) | **`SyntaxError`** |
| Scope | function | block | block |
| Hoisted | yes, as `undefined` | yes, into the TDZ | yes, into the TDZ |

Two details worth separating, because they are different error *kinds*:

- **Redeclaration is a `SyntaxError`** — thrown at parse time, so the whole module
  fails to load. Nothing runs.
- **Reassigning a `const` is a `TypeError`** — thrown at runtime, when the line
  executes.

`var`'s permissiveness is the problem. Declaring the same name twice in one
function is almost always a mistake — a copy-paste, or two developers adding a
variable to a long function — and `var` accepts it silently, with the second
declaration quietly winning.

## `const` is not immutable

This is the single most misunderstood row in the table.

```
--- const is not immutable — only the BINDING is fixed ---
  const arr = [1,2]; arr.push(3)  ← mutation OK      [1,2,3]
  const a2 = [1]; a2 = []  ← rebinding               TypeError: Assignment to constant variable.
  Object.freeze({a:1}) then frozen.a = 99            TypeError: Cannot assign to read only property 'a' of object '#<Object>'
  the frozen object is unchanged                     {"a":1}
  freeze is SHALLOW: nested.inner.a = 99             {"inner":{"a":99}}
```

**`const` fixes the binding, not the value.** The variable cannot be pointed at
something else; the thing it points at can be changed freely:

```js
const arr = [1, 2];
arr.push(3);        // fine — [1, 2, 3]
arr = [];           // TypeError: Assignment to constant variable.
```

So `const` on an object or array gives you exactly one guarantee: *this name will
always refer to this same object*. It says nothing about the object's contents.

For actual immutability you need `Object.freeze` — and even that is **shallow**,
measured above: freezing `{inner: {a: 1}}` did not protect `inner`, which was
mutated to `99` without complaint. Deep immutability requires recursion over the
object, or a library.

Note the freeze failure mode differs by mode. In strict code — every module and
class — it throws:

```
  Object.freeze({a:1}) then frozen.a = 99            TypeError: Cannot assign to read only property 'a' of object '#<Object>'
```

In sloppy code it **fails silently**:

```
--- silent failures that strict mode turns into errors ---
  sloppy: frozen.a = 99 (no throw)                   {"a":1}  ← silently ignored
```

Same non-effect, but only one of them tells you.

## Module top level is not the global scope

```
--- the global scope: var at TOP LEVEL of a module ---
  this file is an ES module                          top-level var does NOT become a global
  globalThis.moduleVar                               undefined
  the binding itself is fine                         declared with var at module top level
```

In a **browser `<script>`** (not `type="module"`), a top-level `var` becomes a
property of the global object. That is where the old "`var` pollutes the global
namespace" warning comes from — and it no longer applies to modules:

```
--- CommonJS top level is NOT the global scope ---
  globalThis.cjsVar                                  undefined
    because CommonJS wraps the file                  in a function(exports, require, module, __filename, __dirname)
```

Three different top levels, three different answers:

| Context | Top-level `var` becomes | Top-level `this` |
|---|---|---|
| Browser `<script>` | a global property | `globalThis` |
| ES module (`.mjs`, `type="module"`) | **module-scoped only** | `undefined` |
| CommonJS (`.cjs`, `require`) | **function-scoped** (the wrapper) | `module.exports` |

`let` and `const` at top level never create global properties in any of the
three — not even in a classic script.

## The accidental global

```
--- an undeclared assignment: ReferenceError in strict, global in sloppy ---
  undeclaredName = 1 (module = strict)               ReferenceError: undeclaredName is not defined
```

Assigning to a name that was never declared is the classic bug. In sloppy mode it
silently creates a global:

```
  sloppy: undeclaredName = ...                       "created without any keyword"
    and it landed on globalThis                      "created without any keyword"
```

A typo in an assignment — `usreName = 'ada'` — creates a new global rather than
failing, and the real variable keeps its old value. Strict mode turns it into a
`ReferenceError` at the point of the mistake, which is the whole reason modules
are strict by default.

## Which to use

- **`const` by default.** It documents that the binding will not move, and the
  compiler enforces it. Reaching for `const` first also surfaces accidental
  reassignment as an error rather than a silent behaviour change.
- **`let` only when you genuinely reassign** — loop counters, accumulators,
  values assigned in a branch.
- **`var` never in new code.** Every property it has is a liability: it escapes
  blocks, it allows silent redeclaration, and it hoists as `undefined` so
  mistakes surface as `TypeError: x is not a function` rather than a clear
  message.

**The one honest counter-argument** to `const`-by-default: it can read as noise
when a value is obviously local and short-lived. That is a style preference; the
cost of `let` everywhere is that reassignment stops being a signal.

## Gotchas

**Symptom:** A variable is still visible after the block that declared it
**Cause:** `var` is function-scoped and ignores blocks. Measured: `v=var`
survives an `if`, while `let` and `const` give `ReferenceError`.
**Fix:** `let`/`const`.

**Symptom:** `TypeError: Assignment to constant variable.`
**Cause:** Reassigning a `const` binding — as opposed to mutating its value.
**Fix:** Use `let` if the binding must move. If you meant to change contents,
mutate the object instead of reassigning.

**Symptom:** A `const` object changed anyway
**Cause:** `const` fixes the binding, not the value. Measured:
`arr.push(3)` on a `const` array gave `[1,2,3]`.
**Fix:** `Object.freeze` for one level — and note it is shallow, measured: a
nested object was still mutated to `99`.

**Symptom:** `Object.freeze` appears to do nothing and throws nothing
**Cause:** Sloppy mode ignores the write silently. Measured: strict throws
`TypeError: Cannot assign to read only property`, sloppy returns `{"a":1}`
unchanged with no error.
**Fix:** Use modules, which are strict.

**Symptom:** A typo creates a new variable instead of erroring
**Cause:** Sloppy-mode implicit globals. Measured: an undeclared assignment
landed on `globalThis`.
**Fix:** Modules or `'use strict'` — measured `ReferenceError` there.

**Symptom:** `SyntaxError: Identifier 'x' has already been declared` after a
merge
**Cause:** Two `let`/`const` declarations of one name in a scope. It is a parse
error, so nothing in the file runs.
**Fix:** Rename or remove one. Note `var` would have accepted this silently —
that is a reason to prefer the error.

## Interview questions

**★ Difference between `var`, `let` and `const`?**
Scope, redeclaration and reassignment. `var` is function-scoped, redeclarable and
hoists as `undefined`; `let`/`const` are block-scoped, throw `SyntaxError` on
redeclaration, and hoist into the TDZ. `const` additionally throws `TypeError` on
reassignment and requires an initialiser. All measured.

**★ Does `const` make a value immutable?**
No — only the binding. Measured: `arr.push(3)` on a `const` array succeeded,
while `arr = []` threw `TypeError: Assignment to constant variable.` For
immutability use `Object.freeze`, which is **shallow** — a nested object was
still mutated (measured `{"inner":{"a":99}}`).

**★ Why is `var` discouraged?**
It escapes blocks (measured: still visible after an `if`), allows silent
redeclaration, and hoists as `undefined` so errors appear as
`TypeError: x is not a function` far from the cause. It also enables the
`var`-in-a-loop closure bug.

**★ Does a top-level `var` create a global?**
Only in a classic browser `<script>`. In an ES module it is module-scoped and in
CommonJS it is function-scoped — both measured as `globalThis.x === undefined`.
`let`/`const` never create global properties anywhere.

**What is the difference between redeclaring and reassigning?**
Redeclaration is a parse-time `SyntaxError`, so nothing runs. Reassignment of a
`const` is a runtime `TypeError` when that line executes. Both measured.

**What happens if you assign to an undeclared variable?**
Strict mode: `ReferenceError` (measured). Sloppy mode: it silently creates a
global property (measured on `globalThis`). This is why a typo can leave the real
variable unchanged while appearing to work.

---

← [The scope chain](./01-the-scope-chain.md) · [Topic index](./README.md) · Next → [Hoisting and the temporal dead zone](../08-hoisting-and-tdz/README.md)
