---
title: "2 · Implementing it, and the protocols it is not"
sidebar_label: "2 · Implementing it"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [`Symbol.toPrimitive`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toPrimitive), [`Symbol.toStringTag`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toStringTag), [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) (including `toJSON`), [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort), [`Intl.NumberFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat), [`Object.prototype.toString()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/toString); and the Node.js documentation for [`util.inspect.custom`](https://nodejs.org/api/util.html#utilinspectcustom). Documentation-validated; **no timings**.

If you do implement the protocol, **implement `Symbol.toPrimitive` and nothing else.** One method,
one place, all three hints visible together:

```js
class Money {
  #cents;
  constructor(cents) { this.#cents = cents; }

  [Symbol.toPrimitive](hint) {
    if (hint === "number") return this.#cents;
    if (hint === "string") return `$${(this.#cents / 100).toFixed(2)}`;
    return this.#cents;                    // "default" — pick one, deliberately
  }
}

const price = new Money(1250);
`${price}`;        // "$12.50"
price * 2;         // 2500
price > new Money(1000);   // true — relational operators use the number hint
```

**Why one method beats a `toString`/`valueOf` pair:** the pair splits the decision across two places
and leaves the `"default"` case implicit — which is exactly where `obj + ""` surprises people
([chunk 1](./01-the-toprimitive-protocol.md)). Here the three answers sit in one function and the
`default` line is a visible choice.

⚠️ **Decide `"default"` on purpose.** Returning the number makes `price + 0` arithmetic; returning
the string makes it concatenation, the way `Date` does. Either is defensible; silence is not.

## When to implement it, and when not

**Worth it** for value types where an operator genuinely reads better: money, durations,
temperatures, vectors, big-decimal wrappers. `a - b` on two `Duration`s is clearer than
`a.minus(b).toMillis()`.

🔴 **Not worth it** for domain objects. Making `user + order` mean something is cleverness that
costs every future reader — and it never scales, because JavaScript has **no operator overloading**:
you can influence what an operand *converts to*, and you cannot change what `+` *does*. A `Vector`
class cannot make `v1 + v2` return a vector; it can only make it return a number or a string.

**The honest default is explicit methods** — `total.add(shipping)`, `money.format()` — with
`Symbol.toPrimitive` added only where an operator is genuinely the clearer notation.

## The protocols this is *not*

Four different mechanisms answer four different questions, and mixing them up is the usual bug:

| Question | Mechanism |
|---|---|
| turn into a string or number | `Symbol.toPrimitive`, else `toString` / `valueOf` |
| serialise to JSON | **`toJSON()`** |
| what `Object.prototype.toString` reports | **`Symbol.toStringTag`** |
| how it prints in a debugger | devtools' own rules; Node adds `util.inspect.custom` |

🔴 **`JSON.stringify` does not call `toString`.** It calls `toJSON()` if present, otherwise
serialises own enumerable properties:

```js
class Money {
  #cents = 1250;
  toString() { return "$12.50"; }
  toJSON()   { return { cents: this.#cents, currency: "USD" }; }
}
JSON.stringify({ price: new Money() });   // {"price":{"cents":1250,"currency":"USD"}}
```

Without the `toJSON`, that stringify produces `{"price":{}}` — because `#cents` is private and
`toString` is never consulted. **A class whose fields are private and which has no `toJSON`
serialises to an empty object**, silently. That is the failure worth remembering from this page.

**`Symbol.toStringTag`** changes only what `Object.prototype.toString.call(x)` reports:

```js
class Money { get [Symbol.toStringTag]() { return "Money"; } }
Object.prototype.toString.call(new Money());   // "[object Money]"
String(new Money());                            // "[object Money]" — via the inherited toString
```

It affects nothing else, and — as [13 · Where `instanceof` fails](../13-instanceof-and-hasinstance/02-where-it-fails.md)
notes — it is exactly why `Object.prototype.toString` is not a trustworthy type check.

**Debugger output is a fourth thing again.** Browsers show the object's structure regardless of
`toString`; Node's `console.log` uses `util.inspect`, which a class can customise with
`[util.inspect.custom]()`. A `toString` you added for logging will very often not be what you see in
the log.

## Where implicit coercion bites in ordinary code

**`sort()` converts to strings by default.** No object involved — this is the same protocol applied
to numbers:

```js
[1, 10, 2].sort();                  // [1, 10, 2]  🔴 string order
[1, 10, 2].sort((a, b) => a - b);   // [1, 2, 10]
```

An array of objects sorted without a comparator becomes `"[object Object]"` for every element, so
the order is meaningless rather than wrong-looking. **Always pass a comparator.**

**Object keys are strings**, so an object used as a key stringifies to `"[object Object]"` and every
distinct object collides into one entry — the case for `Map` made in
[02 · Property access](../02-property-access.md).

**Template literals in logs.** `` `user: ${user}` `` produces `"user: [object Object]"`. Log the
object itself (`console.log("user:", user)`) and let the debugger format it, or `JSON.stringify` it.

**Formatting is a separate concern from coercion.** `toString` is for a developer-readable form;
user-facing output belongs to `Intl.NumberFormat` and `Intl.DateTimeFormat`, which know about
locale, currency and grouping. Do not put locale logic in a `toString`.

## Gotchas

**Symptom:** A class instance serialises to `{}`
**Cause:** Its state is in `#private` fields and it has no `toJSON`; `JSON.stringify` never calls `toString`.
**Fix:** Add `toJSON()` returning a plain object.

**Symptom:** `toString` is defined but the log shows the object's structure
**Cause:** Debuggers do not use `toString` — Node uses `util.inspect`, browsers use their own formatter.
**Fix:** `[util.inspect.custom]()` on Node, or log a string explicitly.

**Symptom:** `Symbol.toStringTag` was added and nothing else changed
**Cause:** It only affects `Object.prototype.toString.call(x)`.
**Fix:** Expected. Implement `Symbol.toPrimitive` for conversions and `toJSON` for serialisation.

**Symptom:** `obj + 0` concatenated instead of adding
**Cause:** The `"default"` branch returns a string.
**Fix:** Decide that branch deliberately — and remember `+` is the only arithmetic operator that can concatenate.

**Symptom:** `[10, 9, 100].sort()` came back in the wrong order
**Cause:** The default comparator converts to strings.
**Fix:** `sort((a, b) => a - b)`, and always pass a comparator for objects.

**Symptom:** A `Map`-like object keyed by objects holds one entry
**Cause:** Object keys are stringified, and every plain object gives `"[object Object]"`.
**Fix:** A real `Map`.

**Symptom:** An operator overload "almost" works
**Cause:** JavaScript has no operator overloading — only conversion. `v1 + v2` cannot return a vector.
**Fix:** Named methods. Reserve `Symbol.toPrimitive` for values where a number or string genuinely is the meaning.

## Interview questions

**★ If you implement one of these, which and why?**
`Symbol.toPrimitive`. It handles all three hints in one function, so the `"default"` case — the one
that surprises people through `+` and `==` — is an explicit line rather than an accident of which
method happened to return a primitive first.

**★ Does `JSON.stringify` use `toString`?**
No. It calls `toJSON()` if present, otherwise serialises own enumerable properties. A class holding
its state in `#private` fields and lacking `toJSON` serialises to `{}` — silently, which is what
makes it a real bug rather than an obvious one.

**★ What does `Symbol.toStringTag` change?**
Only the result of `Object.prototype.toString.call(x)` — `"[object Money]"` instead of
`"[object Object]"`. It does not affect arithmetic, template literals or `JSON.stringify`, and its
spoofability is why `Object.prototype.toString` is not a reliable type check.

**★ Can you overload operators in JavaScript?**
No. You can influence what an object *converts to* via `Symbol.toPrimitive`, but not what an operator
*does*. `v1 + v2` on two vectors can only produce a number or a string, never a vector — which is why
value semantics belong in named methods.

**★ Why does `[1, 10, 2].sort()` give `[1, 10, 2]`?**
The default comparator converts every element to a string and compares those, so `"10"` sorts before
`"2"`. Pass `(a, b) => a - b` for numbers, and always pass a comparator for objects — otherwise every
element stringifies to `"[object Object]"` and the order is meaningless.

**Where should locale-aware formatting live?**
Not in `toString`. `toString` is the developer-readable form; user-facing output belongs to
`Intl.NumberFormat` and `Intl.DateTimeFormat`, which handle locale, currency and grouping.

**When is implementing this protocol a bad idea?**
For domain objects. Making `user + order` mean something is cleverness with a permanent readability
cost, and it cannot express what you want anyway. It earns its place only for value types — money,
durations, temperatures — where an operator is genuinely the clearer notation.

---

← [1 · The protocol](./01-the-toprimitive-protocol.md) · [Topic index](./README.md) · [Phase index](../README.md) →
