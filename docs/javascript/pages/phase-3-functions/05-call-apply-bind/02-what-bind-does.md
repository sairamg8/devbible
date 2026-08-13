---
title: "05.2 · What `bind` does"
sidebar_label: "02 · What bind does"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6). Scripts: `sandbox/js-p3/ex5-call-apply-bind.mjs`, `sandbox/js-p3/ex5c-write-bind.mjs`.

**`bind` does not just set `this`.** It returns a new exotic object with a
different name, a different arity, no `prototype` of its own, and a binding that
nothing except `new` can override.

## What `bind` does to the function it returns

```
--- bind: permanence, name, length, and prototype ---
  bound.name                                       "bound greet"
  bound.length (greet.length is 3, 1 bound)        2
  greet.length                                     3
  bound.call({tag: "OTHER"}, 2, 3)                 T|1|2|3  ← this ignored, args appended
  bound.bind({tag:"AGAIN"}, 99)()                  T|1|99|  ← this still T, args still accumulate
  bound.hasOwnProperty("prototype")                false
```

```js
function greet(a, b, c) { return [this?.tag, a, b, c].join('|'); }
const bound = greet.bind({tag: 'T'}, 1);
```

Five separate facts:

1. **`.name` gains a `"bound "` prefix** — `"bound greet"`. A stack frame reading
   `bound handleClick` tells you the function was bound somewhere, which is a
   genuine debugging aid.
2. **`.length` is reduced by the number of bound arguments** — `3 - 1 = 2`. The
   bound function honestly reports how many arguments it still expects. This
   interacts with frameworks that dispatch on arity.
3. **The binding is permanent.** `bound.call({tag: 'OTHER'}, 2, 3)` still used
   `T`. A later `call`, `apply` or `bind` cannot change `this` — it fails
   silently, which is the dangerous part.
4. **Arguments still accumulate.** Binding a bound function appends more leading
   arguments: `bound.bind({tag: 'AGAIN'}, 99)()` produced `T|1|99|`. The `this`
   stayed `T`, but `99` was appended after the already-bound `1` — and the third
   parameter went unfilled, hence the trailing empty field.
5. **No `prototype` property** — `hasOwnProperty('prototype')` is `false`. A
   bound function is an exotic object that wraps the target rather than a normal
   function.

Point 5 raises an obvious question, which point six answers.

## `bind` and `new`

```
--- bind + new: the bound this is dropped, bound ARGS are not ---
  new (Point.bind({...}, 10))(20)                  {"x":10,"y":20}
  instanceof Point                                 true
    ↑ prototype chain survives binding             true
```

```js
function Point(x, y) { this.x = x; this.y = y; }
const BoundPoint = Point.bind({ignored: true}, 10);
new BoundPoint(20);          // { x: 10, y: 20 }
```

`new` on a bound function **discards the bound `this`** but **keeps the bound
arguments**, and the instance is still `instanceof Point` with
`Object.getPrototypeOf(p) === Point.prototype`.

Despite having no own `prototype` property, the bound function's `[[Construct]]`
delegates to the target, so the prototype chain is the target's. That is what
makes `bind` usable for partial application on constructors without breaking
`new` — the one place the "bind is permanent" rule is deliberately overridden.

## Writing `bind` yourself

A common interview task. The naive version is three lines:

```js
Function.prototype.myBind = function (thisArg, ...boundArgs) {
  const target = this;
  return function (...callArgs) {
    return target.apply(thisArg, [...boundArgs, ...callArgs]);
  };
};
```

That covers ordinary calls. It does **not** reproduce the `new` behaviour above —
`new` on it would bind `thisArg`, not a fresh object. Handling that needs
`new.target`:

```js
Function.prototype.myBind = function (thisArg, ...boundArgs) {
  const target = this;
  if (typeof target !== 'function') throw new TypeError('Bind must be called on a function');
  function bound(...callArgs) {
    // called with `new`? then ignore thisArg and use the fresh object
    return target.apply(new.target ? this : thisArg, [...boundArgs, ...callArgs]);
  }
  bound.prototype = Object.create(target.prototype ?? Object.prototype);
  return bound;
};
```

Both versions were run against the native one
 rather than assumed correct:

```
--- ordinary calls: both implementations match native bind ---
  native  greet.bind({tag:"T"}, 1)(2, 3)               T|1|2|3
  naive   greet.naiveBind({tag:"T"}, 1)(2, 3)          T|1|2|3
  mine    greet.myBind({tag:"T"}, 1)(2, 3)             T|1|2|3

--- with new: this is where naive diverges ---
  native  new (Point.bind({z:1}, 10))(20)              {"x":10,"y":20}
  naive   new (Point.naiveBind({z:1}, 10))(20)         {}
  mine    new (Point.myBind({z:1}, 10))(20)            {"x":10,"y":20}

--- instanceof after new ---
  native  instanceof Point                             true
  naive   instanceof Point                             false
  mine    instanceof Point                             true
```

The naive version produces `{}` and fails `instanceof` — the constructor wrote
`x` and `y` onto `thisArg` instead of the new object, and the instance's
prototype was never linked.

Say the remaining limitations out loud in an interview rather than claiming
completeness:

```
--- what mine still does NOT reproduce ---
  native  .name                                        "bound greet"
  mine    .name                                        "bound"
  native  .length (greet.length 3, 1 bound)            2
  mine    .length                                      0
  native  hasOwnProperty("prototype")                  false
  mine    hasOwnProperty("prototype")                  true
```

Note the `.name` row is a coincidence, not a success: mine reads `"bound"` only
because the inner function is literally *named* `bound`. It does not carry the
target's name, and rest parameters mean `.length` is `0` rather than `2`. Those
three rows are not fixable from user code — a real bound function is an exotic
object the specification builds directly.

## Gotchas

**Symptom:** `bind` on a callback appears to have no effect
**Cause:** Either the target is an arrow (no `this` to set), or it is already
bound — the binding is permanent. Measured: `bound.call({tag: 'OTHER'}, 2, 3)`
still returned `T|1|2|3`.
**Fix:** Bind the original unbound function. Keep a reference to it if you need
both.

**Symptom:** `removeEventListener` does not remove a bound handler
**Cause:** `bind` returns a new function object every call, so the reference
never matches the one added.
**Fix:** Bind once, store the result, add and remove that same reference.

**Symptom:** Express middleware stops receiving errors after adding `bind`
**Cause:** `bind` reduces `.length` by the number of bound arguments — measured
`3` down to `2` — and Express detects error handlers by `fn.length === 4`.
**Fix:** Bind with no leading arguments, or wrap in a function of the right
arity.

**Symptom:** A hand-written `bind` produces `{}` when used with `new`
**Cause:** The naive implementation applies `thisArg` instead of the fresh
object, and never links the prototype. Measured: `{}` and
`instanceof Point === false`.
**Fix:** Check `new.target` and set `bound.prototype` from the target — measured
to restore both.

**Symptom:** A bound constructor ignores the object you bound to it
**Cause:** That is specified behaviour: `new` discards the bound `this` while
keeping bound arguments. Measured: `new (Point.bind({z:1}, 10))(20)` gave
`{"x":10,"y":20}`.
**Fix:** None needed — this is what makes `bind` safe for partial application on
constructors.

## Interview questions

**★ Can you change `this` on a bound function?**
No. Measured: `bound.call({tag: 'OTHER'}, 2, 3)` still used the originally bound
`T`. It fails silently rather than throwing. The one exception is `new`, which
discards the bound `this` while keeping bound arguments.

**★ What does `new (Fn.bind(obj, 1))(2)` produce?**
An instance of `Fn` built from both arguments — measured `{"x":10,"y":20}` — and
still `instanceof Fn`. The bound `this` is discarded, the bound argument is not.
Despite the bound function having no own `prototype`, its `[[Construct]]`
delegates to the target, so the prototype chain is the target's.

**★ Write `bind`.**
Capture `this` as `target` and the leading arguments; return a function that
`apply`s the target with `thisArg` and the concatenated arguments. For `new`
fidelity, use `new.target ? this : thisArg` and set `bound.prototype` from the
target — measured: without that, `new` gives `{}` and fails `instanceof`. It
still will not match the real `.name`, the reduced `.length`, or the absent own
`prototype`.

**★ What happens to `fn.length` after binding?**
It is reduced by the number of bound arguments — measured `3` to `2`. Frameworks
that dispatch on arity, such as Express's four-argument error handler, change
behaviour as a result.

**What does `bind` do to the function's name?**
Prefixes it with `"bound "` — measured `"bound greet"`. It shows up in stack
traces, which is a genuine debugging aid: a `bound handleClick` frame tells you
the function was bound somewhere.

**What happens if you bind a bound function?**
The `this` stays as the first binding, but arguments keep accumulating —
measured `T|1|99|` from `bound.bind({tag: 'AGAIN'}, 99)()`. So repeated binding
is useful for partial application and useless for changing the receiver.

---

← [The three methods](./01-the-three-methods.md) · [Topic index](./README.md) · Next → [Borrowing, partial application and cost](./03-borrowing-and-cost.md)

