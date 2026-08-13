---
title: "09.2 · `JSON.parse` and the reviver"
sidebar_label: "02 · parse and the reviver"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`JSON.parse`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse), [Object initializer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer). Documentation-validated.

```js
const json = '{"result":true, "count":42}';
const obj = JSON.parse(json);

obj.count;  // 42
obj.result; // true
```

Parsing is the easy half. The `reviver` is the part worth learning, because it is the
only place to repair what
[`stringify` destroyed](./01-stringify.md) — dates above all.

## Invalid JSON throws `SyntaxError`

```js
JSON.parse("[1, 2, 3, 4, ]");   // SyntaxError: Unexpected token ] in JSON at position 13
JSON.parse('{"foo": 1, }');     // SyntaxError: Unexpected token } in JSON at position 12
JSON.parse("{'foo': 1}");       // SyntaxError: Unexpected token ' in JSON at position 1
```

Those three are the everyday causes: a **trailing comma** (legal in JavaScript, illegal
in JSON) and **single quotes** (JSON requires double). JSON is stricter than JavaScript
object literal syntax, which is why pasting a JS object into a `.json` file so often
fails.

**Always wrap `JSON.parse` on untrusted input** — a truncated response, an HTML error
page returned with a 200, or an empty body all throw:

```js
try {
  data = JSON.parse(text);
} catch {
  // an HTML error page, a truncated body, or empty
}
```

`JSON.parse("")` throws too, so a zero-length response body is a `SyntaxError`, not
`null`.

## The reviver

MDN: an optional function *"that transforms values produced by parsing before they're
returned"*. It receives:

- **`key`** — *"The property name as a string (even for arrays)"*
- **`value`** — the parsed value
- **`context`** — *"Passed only for primitive values"*, holding `source`, the original
  JSON text for that value

**Returning `undefined` deletes the property.** MDN: *"Any other return value replaces
the originally parsed value. You must return untransformed values as-is or they'll be
deleted."*

That last sentence is the rule that catches everyone: a reviver **must** end with
`return value`, or everything it does not explicitly handle disappears. MDN's own
demonstration:

```js
const transformedObj = JSON.parse('[1,5,{"s":1}]', (key, value) =>
  typeof value === "object" ? undefined : value,
);

console.log(transformedObj); // undefined
```

The root value is an object too, so returning `undefined` for it deletes **the entire
result**.

### The call order is innermost-first

MDN: the reviver processes values *"in depth-first fashion, beginning with the most
nested properties and proceeding to the original value itself"*, and is called last on
the root with an **empty string** as the key:

```js
JSON.parse('{"1": 1, "2": 2, "3": {"4": 4, "5": {"6": 6}}}', (key, value) => {
  console.log(key);
  return value;
});
// Logs: 1, 2, 4, 6, 5, 3, ""
```

**Children are revived before their parent.** So by the time your reviver sees an
object, its properties have already been transformed — which is exactly what you want
when reconstructing nested types, and surprising if you assumed top-down.

The trailing `""` is the root callback. Guard for it when your reviver only means to
handle leaves.

## Reviving dates

The canonical use, and the fix for `stringify`'s most damaging loss:

```js
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const data = JSON.parse(text, (key, value) =>
  typeof value === "string" && ISO.test(value) ? new Date(value) : value,
);
```

Note the shape: check the type, check the pattern, **otherwise return `value`
unchanged**. And be deliberate about the pattern — a loose one turns any ISO-looking
string (a version number, an ID) into a `Date`. Matching on the **key name** is often
safer than matching on the value:

```js
(key, value) => (key.endsWith("At") ? new Date(value) : value)
```

## `context.source` and precision

MDN's example, and the reason `context` exists:

```js
const bigJSON = '{"gross_gdp": 12345678901234567890}';
const bigObj = JSON.parse(bigJSON, (key, value, context) => {
  if (key === "gross_gdp") {
    return BigInt(context.source);
  }
  return value;
});
```

**`value` has already lost precision** by the time you see it — it was parsed into a
double. `context.source` gives you the **original text**, so you can build a `BigInt`
from the digits actually sent.

This matters for any 64-bit integer ID. Snowflake IDs, database bigints and financial
amounts all exceed `Number.MAX_SAFE_INTEGER` (2⁵³−1), and without `context.source` the
last digits are silently wrong. The pragmatic alternative remains: **send large IDs as
strings**.

`context` is passed *"only for primitive values"* — there is no `source` for an object
or array.

## `JSON.parse` is safe from prototype pollution

MDN notes the one place JSON and JavaScript diverge: *"The only instance where JSON text
represents a different value from equivalent JavaScript is when dealing with the
`"__proto__"` key."*

In a JavaScript object literal `{ "__proto__": {} }` sets the prototype; in JSON it is
an **ordinary property**. So:

```js
JSON.parse('{"__proto__": {"isAdmin": true}}');
// a plain object with an own "__proto__" property — Object.prototype untouched
```

🔴 **The parse is safe; what you do next may not be.** A recursive merge that
*assigns* `target[key]` with `key === "__proto__"` goes through `Object.prototype`'s
accessor and pollutes every object in the program. That is the vulnerability, covered in
[Phase 4 · 01 · `__proto__` and null-prototype objects](../../phase-4-objects-and-classes/01-object-literals/04-proto-and-null-prototype.md).

## Gotchas

**Symptom:** A reviver returned a partly-empty object, or `undefined` entirely
**Cause:** It did not `return value` for the cases it does not handle — MDN: *"You must
return untransformed values as-is or they'll be deleted."* Returning `undefined` for the
root deletes the whole result.
**Fix:** End every reviver with `return value;`.

**Symptom:** A reviver saw children already transformed
**Cause:** The order is **depth-first, innermost first**, with the root called last under
the key `""`.
**Fix:** Expected — rely on it when reconstructing nested types, and guard the `""` key.

**Symptom:** `SyntaxError: Unexpected token` on data that looks fine
**Cause:** A **trailing comma** or **single quotes** — legal in JavaScript, illegal in
JSON.
**Fix:** Fix the producer. JSON is stricter than object-literal syntax.

**Symptom:** `JSON.parse` threw on an empty response body
**Cause:** `JSON.parse("")` is a `SyntaxError`.
**Fix:** Check for an empty body, and always `try`/`catch` untrusted input — an HTML
error page returned with a 200 fails the same way.

**Symptom:** A large integer ID is subtly wrong in the last digits
**Cause:** JSON numbers are parsed as doubles, so anything past `Number.MAX_SAFE_INTEGER`
loses precision **before** the reviver sees `value`.
**Fix:** Use `context.source` to rebuild it as a `BigInt`, or have the API send large IDs
as strings.

**Symptom:** A version string became a `Date`
**Cause:** A loose ISO pattern in a date reviver.
**Fix:** Tighten the regex, or match on the **key name** (`key.endsWith("At")`).

**Symptom:** Objects across the app gained a property after parsing user JSON
**Cause:** Not the parse — a later recursive **merge** assigning through `"__proto__"`.
**Fix:** Merge into `Object.create(null)`, skip `__proto__`/`constructor`/`prototype`,
or use `Object.defineProperty`.

## Interview questions

**★ What does the reviver do, and what is the one rule?**
It transforms each parsed value before it is returned. The rule: **return `value`
unchanged for anything you do not handle** — MDN warns that untransformed values *"must
be returned as-is or they'll be deleted"*, since returning `undefined` **deletes the
property**. Returning `undefined` for the root deletes the entire result.

**★ In what order is the reviver called?**
**Depth-first, innermost first** — children before parents — and finally on the root
value with the key `""`. MDN's example logs `1, 2, 4, 6, 5, 3, ""`.

**★ How do you get `Date` objects back out of JSON?**
A reviver: check `typeof value === "string"` and an ISO pattern, return `new Date(value)`,
otherwise return `value`. Matching on the key name (`key.endsWith("At")`) is often safer
than matching the value, which can turn version strings into dates.

**★ What is the reviver's third argument for?**
`context`, passed **only for primitives**, whose `source` is the **original JSON text**
for that value. It exists because `value` has already lost precision — a 64-bit ID has
been through a double. MDN's example rebuilds one with `BigInt(context.source)`.

**Is `JSON.parse` vulnerable to prototype pollution?**
No. MDN notes `"__proto__"` is the one key where JSON and JavaScript diverge: in JSON it
is an **ordinary property**. The vulnerability is a later recursive **merge** that
assigns through it.

**Why does valid-looking JSON throw a `SyntaxError`?**
Usually a **trailing comma** or **single quotes** — both legal in a JavaScript object
literal and illegal in JSON. An empty body throws too, and an HTML error page served
with a 200 status is the classic production case.

---

← [`JSON.stringify` and what it drops](./01-stringify.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
