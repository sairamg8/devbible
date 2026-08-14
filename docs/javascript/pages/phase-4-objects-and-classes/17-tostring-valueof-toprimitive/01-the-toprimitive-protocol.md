---
title: "1 · The ToPrimitive protocol"
sidebar_label: "1 · The protocol"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [`Symbol.toPrimitive`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toPrimitive), [`Object.prototype.toString()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/toString), [`Object.prototype.valueOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/valueOf), [`Date.prototype[Symbol.toPrimitive]()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Symbol.toPrimitive), [`Array.prototype.toString()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toString), [Addition `+`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Addition), [Equality `==`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Equality), [Type coercion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Data_structures#type_coercion). Documentation-validated; **no timings**.

**You will not write a `Symbol.toPrimitive` this year, and you will read code whose behaviour
depends on one this week.** This topic is a reading skill: what the engine does when an object turns
up where a string or a number was expected.

Every such conversion runs one algorithm — **ToPrimitive(value, hint)** — and it has exactly three
steps:

1. If the object has a **`Symbol.toPrimitive`** method, call it with the hint. Whatever it returns
   is the answer (and must be a primitive, or it is a `TypeError`).
2. Otherwise, try two methods **in an order the hint decides**, and take the first that returns a
   primitive.
3. If neither does, throw `TypeError: Cannot convert object to primitive value`.

## The hint decides the order — and that is the whole thing

| Hint | Order tried | Comes from |
|---|---|---|
| `"string"` | **`toString`** → `valueOf` | `String(x)`, `` `${x}` ``, `x` as a property key, `.join()` |
| `"number"` | **`valueOf`** → `toString` | `-`, `*`, `/`, `%`, unary `+`, `<`, `>`, `Number(x)` |
| `"default"` | `valueOf` → `toString` *(same as number)* | binary `+`, `==` against a primitive |

**Only two operators produce `"default"`**: `+` and loose `==`. Everything else asks for a specific
type. The reason `+` is special is that it means two things — addition and concatenation — so it
declines to say which it wants and lets the object decide.

```js
const obj = {
  valueOf()  { return 42; },
  toString() { return "forty-two"; },
};

`${obj}`;      // "forty-two"  — string hint → toString first
obj * 2;       // 84           — number hint → valueOf first
obj + 1;       // 43           — default hint behaves as number
obj + "";      // "42"         — 🔴 valueOf won, then the NUMBER 42 was concatenated
```

⚠️ **That last line catches people.** `obj + ""` looks like a string conversion, but `+` asks for
`"default"`, `valueOf` answers first, and the *number* `42` is what gets concatenated. To force the
string path, use `String(obj)` or a template literal.

## The defaults every plain object inherits

`Object.prototype` supplies both methods, and both are nearly useless on purpose:

- **`valueOf()` returns the object itself** — not a primitive, so it never wins and the algorithm
  moves on.
- **`toString()` returns `"[object Object]"`.**

Which is why:

```js
({}) + "";        // "[object Object]"
({ a: 1 }) * 2;   // NaN — toString gave "[object Object]", Number() of that is NaN
```

🔴 **An object with no prototype has neither method**, so both steps fail and you get the `TypeError`
directly — the failure described in
[14 · `Object.create` and dictionaries](../14-object-creation-patterns/02-object-create-and-dictionaries.md).

## Arrays: why `[1, 2] + [3]` is `"1,23"`

`Array.prototype.toString` joins with commas, and arrays inherit `Object.prototype.valueOf`, which
returns the array itself:

```js
[1, 2] + [3];   // "1,23"  — "1,2" and "3" concatenated
[] + [];        // ""
[5] * 2;        // 10      — number hint: valueOf fails, toString gives "5"
[1, 2] * 2;     // NaN     — "1,2" is not a number
```

Nothing here is a special case for arrays. It is the same three steps with `toString` producing a
comma-joined string.

**The famous quiz answer, and the honest version of it:**

```js
[] + {};   // "[object Object]"
{} + [];   // 0  — but only at the start of a statement
```

The second is **not** about coercion at all: at statement position `{}` parses as an empty *block*,
so what remains is unary `+[]`, which is `0`. Inside an expression — `console.log({} + [])` — it is
`"[object Object]"` like the first. **Say that when asked**; the interesting part is the parse, not
the protocol.

## `Date` is the exception worth memorising

`Date` ships its own `Symbol.toPrimitive`, and it treats `"default"` as **`"string"`**:

```js
const d = new Date();

d + 1;        // "Thu Aug 14 2026 …1"   🔴 string concatenation
d - 1;        // 1786…                   number, milliseconds
d * 1;        // a number
`${d}`;       // the human-readable string
```

**`date1 - date2` gives a duration in milliseconds; `date1 + date2` gives nonsense.** That asymmetry
is the single most useful consequence of this whole topic, and it exists because dates are far more
often printed than added. Use `d.getTime()` or `+d` (unary plus asks for `"number"`) when you want
the timestamp explicitly.

## `==` coerces; `===` never does

```js
const money = { valueOf: () => 100 };

money == 100;    // true  — object vs primitive: ToPrimitive with the default hint
money === 100;   // false — no coercion, ever
money == { valueOf: () => 100 };   // 🔴 false — two objects compare by reference
```

🔴 **`==` between two objects never coerces either operand.** It is identity, full stop. Coercion
happens only when one side is a primitive — which is one more reason `===` is the default choice
and this operator is something to *recognise*, not to use.

## Symbols refuse

```js
const s = Symbol("id");
`${s}`;        // 🔴 TypeError: Cannot convert a Symbol value to a string
String(s);     // "Symbol(id)" — the explicit form is allowed
s + "";        // 🔴 TypeError
```

The implicit path throws deliberately, so a symbol cannot leak into a string by accident. `String()`
and `.toString()` are the opt-in.

## Gotchas

**Symptom:** `obj + ""` produced a number-derived string instead of `toString`'s output
**Cause:** `+` uses the `"default"` hint, which tries `valueOf` first.
**Fix:** `String(obj)` or `` `${obj}` `` when you want the string path.

**Symptom:** `"[object Object]"` in the UI
**Cause:** A plain object reached a string conversion with no `toString` of its own.
**Fix:** Give the class a `toString`, or format explicitly at the call site.

**Symptom:** `NaN` from arithmetic on an object
**Cause:** `valueOf` returned the object, `toString` gave `"[object Object]"`, and `Number()` of that is `NaN`.
**Fix:** Implement `valueOf` or `Symbol.toPrimitive` — or stop doing arithmetic on the object.

**Symptom:** `TypeError: Cannot convert object to primitive value`
**Cause:** Neither method returned a primitive — usually an `Object.create(null)` object, which has neither.
**Fix:** `JSON.stringify(o)` for display, or spread into a plain object first.

**Symptom:** Adding two dates produced a long concatenated string
**Cause:** `Date`'s `Symbol.toPrimitive` treats the `default` hint as `string`.
**Fix:** `+d` or `d.getTime()`. Subtraction already works because `-` asks for a number.

**Symptom:** Two objects with equal contents compare `false` under `==`
**Cause:** Object-to-object `==` is reference identity; no coercion happens.
**Fix:** Compare a field, or a `valueOf()` result explicitly.

**Symptom:** `TypeError: Cannot convert a Symbol value to a string` in a template literal
**Cause:** Symbols block implicit string conversion by design.
**Fix:** `String(sym)` or `sym.toString()`.

**Symptom:** `{} + []` is `0` in the console but `"[object Object]"` in a file
**Cause:** At statement position `{}` is a block, so it is `+[]`.
**Fix:** Nothing — it is a parsing question, not a coercion one.

## Interview questions

**★ What happens when an object is used where a primitive is expected?**
`ToPrimitive` runs with a hint. If the object has `Symbol.toPrimitive`, that method decides. Otherwise
the hint picks the order: `"string"` tries `toString` then `valueOf`, `"number"` and `"default"` try
`valueOf` then `toString`. The first primitive returned wins; if neither returns one it is a
`TypeError`.

**★ Which operators produce which hint?**
`String()`, template literals and property keys give `"string"`. Arithmetic other than `+`, unary
`+`, and the relational operators give `"number"`. Only binary `+` and loose `==` give `"default"`,
which behaves like `"number"` for every built-in except `Date`.

**★ Why is `date1 - date2` a number but `date1 + date2` a string?**
`-` asks for `"number"`. `+` asks for `"default"`, and `Date` is the one built-in whose
`Symbol.toPrimitive` maps `"default"` to `"string"` — because dates are printed far more often than
added.

**★ Why is `[1,2] + [3]` equal to `"1,23"`?**
Arrays inherit `Object.prototype.valueOf`, which returns the array itself — not a primitive — so the
algorithm falls through to `Array.prototype.toString`, which joins with commas. `"1,2"` and `"3"` are
then concatenated by `+`.

**★ Does `==` coerce two objects?**
No. Coercion happens only when one operand is a primitive. Two objects compare by reference, so
`{valueOf: () => 1} == {valueOf: () => 1}` is `false`.

**Why does `obj + ""` not call `toString`?**
Because `+` asks for the `"default"` hint, which tries `valueOf` first. If `valueOf` returns a
primitive, that value is what gets concatenated. Use `String(obj)` to force the string path.

**What is `{} + []`?**
`"[object Object]"` in expression position. At the start of a statement it is `0`, because `{}` parses
as an empty block and the rest is unary `+[]`. The answer is about parsing, not coercion.

---

← [Topic index](./README.md) · [Phase index](../README.md) · Next: [2 · Implementing it, and the protocols it is not](./02-implementing-and-the-neighbours.md) →
