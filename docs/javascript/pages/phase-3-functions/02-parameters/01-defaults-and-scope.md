---
title: "02.1 · Defaults and the parameter scope"
sidebar_label: "01 · Defaults and scope"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6). Script:
> `sandbox/js-p3/ex2-parameters.mjs`.

**A default parameter is an expression, not a value.** It is stored unevaluated
and runs at call time — every call, left to right, only for the arguments that
were actually left out.

## Measured

```
--- defaults are evaluated at CALL time, left to right ---
  order() evaluation order                       ["a","b","c"]
  order(1, undefined, 3) → evaluated             ["b"]
  order(1, null, 3) → evaluated                  []  ← null does NOT trigger the default
    and the values were                          [1,null,3]
```

```js
const calls = [];
const track = (n) => { calls.push(n); return n; };
function order(a = track('a'), b = track('b'), c = track('c')) { return [a, b, c]; }
```

Three separate facts in those four lines:

1. **Left to right.** `order()` evaluated `a`, then `b`, then `c`. If your
   defaults have side effects — and `track` here does — the order is guaranteed,
   not incidental.
2. **Only the omitted ones.** `order(1, undefined, 3)` ran exactly one default.
   The other two expressions were never evaluated at all, so their cost is not
   paid.
3. **`undefined` triggers a default; `null` does not.** This is the line to
   memorise. Passing `null` is passing a value, and the parameter is `null`.

That third point is the single most common default-parameter bug, because
`null` is what an API returns for "no value" and `undefined` is what a missing
object property gives you. They are not interchangeable here:

```js
function greet(name = 'guest') { return `hi ${name}`; }

greet();                      // 'hi guest'
greet(undefined);             // 'hi guest'
greet(null);                  // 'hi null'    ← not what anyone wanted
greet(user.nickname);         // 'hi guest' if the key is absent
greet(row.nickname);          // 'hi null'   if the DB column was NULL
```

**The trade-off:** if you want `null` to fall back too, you have to say so with
`??` in the body — `name = name ?? 'guest'` — and you lose the ability to tell
"omitted" from "explicitly null", which is sometimes information you need.

## A default can read earlier parameters — but not later ones

```
--- a later default can read an earlier parameter — but not the reverse ---
  rect(3)                                        [3,6]
  function broken(a = b, b = 2) → broken()       ReferenceError: Cannot access 'b' before initialization
  broken(1) (a supplied, default never runs)     [1,2]
```

```js
function rect(w, h = w * 2) { return [w, h]; }     // rect(3) → [3, 6]
function broken(a = b, b = 2) { return [a, b]; }   // broken() throws
```

Parameters are initialised in order, and each one is in scope for the defaults
that follow it. Reaching *forward* hits the temporal dead zone — the parameter
list has one, exactly like a `let` block.

The third line is the subtle one: **`broken(1)` works.** Supplying `a` means its
default expression never runs, so the illegal forward reference is never
evaluated. This is a runtime error, not a syntax error, so a broken default can
sit in a codebase for years and only fire the first time someone omits that
argument.

The degenerate case is a parameter defaulting to itself:

```
--- the TDZ applies inside the parameter list too ---
  (function (a = a) {})()                        ReferenceError: Cannot access 'a' before initialization
```

## The shared-default myth

Python programmers arrive expecting `def f(x, list=[])` to share one list across
calls. JavaScript does not do that:

```
--- a default is re-evaluated on EVERY call — the shared-default myth ---
  pushTo(1) then pushTo(2)                       [1] then [2]
  but a default referencing an OUTER array       [1,2]
```

```js
function pushTo(item, list = []) { list.push(item); return list; }
pushTo(1);        // [1]
pushTo(2);        // [2]   ← a fresh array, not [1, 2]
```

`[]` is an expression evaluated per call, so each call gets its own array. The
mutable-default-argument trap does not exist here.

**It comes straight back the moment the default names something outer**, which
is the second row:

```js
const shared = [];
function pushToShared(item, list = shared) { list.push(item); return list; }
pushToShared(1);
pushToShared(2);
shared;           // [1, 2]   ← one array, mutated twice
```

The rule is not "defaults are safe" — it is **"a default is re-evaluated, and
re-evaluating `shared` yields the same array every time."** A default that
*constructs* is fresh; a default that *references* is not.

## `.length` counts differently than you expect

```
--- defaults change .length and disable the simple-parameter fast path ---
  ((a, b) => 0).length                           2
  ((a, b = 1) => 0).length                       1
  ((a = 1, b) => 0).length                       0  ← counts up to the FIRST default
  ((a, ...r) => 0).length                        1  ← rest is not counted
  ((a, {b}) => 0).length                         2  ← destructuring IS counted
```

`fn.length` is **the number of parameters before the first default or rest** —
not the number of parameters. The third row is the one that surprises people:
`(a = 1, b) => 0` has two parameters and reports `0`, because counting stops at
the first default and `a` is the first parameter.

Destructured parameters *are* counted (each pattern is one parameter), and rest
is never counted.

This matters because libraries read it. Express decides whether a middleware is
an error handler by checking `fn.length === 4`; Mocha decides whether a test is
callback-style by checking `fn.length > 0`. Add a default to such a function and
you silently change its contract:

```js
// pseudo-code — the shape of the bug, not runnable on its own
app.use((err, req, res, next = defaultNext) => { … });
// .length is now 3, so Express treats this as ordinary middleware
// and never routes errors to it. No error is thrown; it just stops running.
```

**Fix:** never put a default on a function whose arity is read by a framework.
Default inside the body instead.

## Parameters live in their own scope

```
--- parameters are in their own scope, separate from the body ---
  scopes("param") → [body x, default closure x]  ["body","param"]
    ↑ the default closure kept the PARAMETER x   not the body var
```

```js
function scopes(x, f = () => x) {
  var x = 'body';           // a NEW binding in the body scope
  return [x, f()];
}
scopes('param');            // ['body', 'param']
```

When a parameter list contains any default, the engine creates **two scopes**: a
parameter scope holding `x` and `f`, and a body scope inside it. A `var x` in the
body is a *different binding* that starts as a copy and then diverges.

So the closure `f`, created in the parameter scope, still sees `'param'` after
the body reassigns its own `x` to `'body'`. Two variables named `x`, one function
call.

This is legal but indefensible in real code — it is the kind of thing that gets
written by accident during a refactor and then debugged for an hour. **Do not
shadow a parameter with a `var` of the same name.** In strict mode a `let x`
there is a `SyntaxError` instead, which is the better failure.

## Gotchas

**Symptom:** A default did not apply and the value came through as `null`
**Cause:** Only `undefined` triggers a default. Measured: `order(1, null, 3)`
evaluated zero defaults and returned `[1, null, 3]`.
**Fix:** `name = name ?? fallback` in the body if `null` should fall back too —
accepting that you can no longer distinguish omitted from explicitly-null.

**Symptom:** `ReferenceError: Cannot access 'b' before initialization` pointing
at a function signature
**Cause:** A default reads a parameter declared later — the parameter list's TDZ.
**Fix:** Reorder the parameters so the dependency comes first, as
`function rect(w, h = w * 2)` does.

**Symptom:** That same error appears only for *some* callers
**Cause:** The illegal default is only evaluated when that argument is omitted.
Measured: `broken(1)` succeeds, `broken()` throws.
**Fix:** Same reorder — and treat it as proof that call coverage, not code
coverage, is what finds this class of bug.

**Symptom:** Express error-handling middleware silently never runs
**Cause:** A default or rest parameter changed `fn.length`, which is how the
framework detects a 4-arity error handler. Measured: `(a, b = 1) => 0` has
`.length === 1`.
**Fix:** Keep the signature bare and apply defaults inside the body.

**Symptom:** One array accumulates values across separate calls
**Cause:** The default *references* an outer binding rather than constructing.
Measured: `list = shared` gave `[1, 2]` where `list = []` gave `[1]` then `[2]`.
**Fix:** Construct in the default — `= []`, `= {}` — or clone at the top of the
body.

## Interview questions

**★ When is a default parameter evaluated?**
At call time, once per call, left to right, and only for arguments that were
omitted. Measured: `order(1, undefined, 3)` ran exactly one of three default
expressions. They are stored as expressions, not values.

**★ Does passing `null` trigger a default?**
No — only `undefined` does. `null` is a value, so the parameter becomes `null`.
Measured: `greet(null)` yields `'hi null'`. This is the difference between a
missing object key and a `NULL` database column.

**★ What does `function f(a = 1, b) {}` report for `f.length`?**
`0`. `length` counts parameters *before the first default*, and the first
parameter already has one. Frameworks that dispatch on arity — Express's
four-argument error handler — break when you add a default for this reason.

**★ Does JavaScript have Python's mutable-default-argument problem?**
Not with a constructing default: `list = []` builds a new array every call
(measured `[1]` then `[2]`). It reappears immediately if the default *references*
an outer value — `list = shared` accumulated `[1, 2]`.

**Can a default parameter refer to another parameter?**
An earlier one, yes — `h = w * 2` works. A later one throws
`ReferenceError: Cannot access 'b' before initialization`, because the parameter
list has its own TDZ and initialises left to right.

**Why does a closure created in the parameter list see a different variable than
the function body?**
Because a non-simple parameter list gets its own scope, with the body scope
nested inside. A `var` of the same name in the body is a separate binding.
Measured: `scopes('param')` returned `['body', 'param']` — the default's closure
kept the parameter, the body kept its own.

---

← [Topic index](./README.md) · Next → [Rest, destructuring and `arguments`](./02-rest-destructuring-arguments.md)
