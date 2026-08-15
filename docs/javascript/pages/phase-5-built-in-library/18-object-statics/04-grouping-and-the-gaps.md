---
title: "4 · Grouping, and the statics that do not exist"
sidebar_label: "4 · Grouping and the gaps"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Object.groupBy()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy), [`Map.groupBy()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/groupBy), [`Object.fromEntries()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries), [`Object.entries()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries), [`Array.prototype.reduce()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [Equality comparisons and sameness](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Equality_comparisons_and_sameness), [`Object.hasOwn()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn). Documentation-validated; **no timings**.

Two statics answer the same question and hand back different containers:

```js
Object.groupBy(items, (item) => key);   // → null-prototype object of arrays
Map.groupBy(items, (item) => key);      // → Map of arrays
```

Both take any iterable, call the function once per element with `(element, index)`, and
put every element into exactly one group, preserving order within it. They arrived in
**ES2024**, so they are recent enough to check against your targets — the four-line
`reduce` they replace is at the bottom of this page.

```js
const orders = [
  { id: 1, status: "paid" },
  { id: 2, status: "pending" },
  { id: 3, status: "paid" },
];

Object.groupBy(orders, (o) => o.status);
// { paid: [{id:1,…}, {id:3,…}], pending: [{id:2,…}] }
```

## The choice rule

🔴 **`Object.groupBy` when the key is already a string. `Map.groupBy` for anything else.**
That is MDN's own guidance and it follows from a single fact: an object's keys can only
be strings or symbols, and a `Map`'s can be any value at all.

| The key is | Use | Why |
|---|---|---|
| a status, a category, a letter | `Object.groupBy` | it is a string already; the result reads naturally |
| a number you want back as a number | `Map.groupBy` | object keys stringify |
| a `Date`, an object, a class instance | `Map.groupBy` | see the two surprises below |
| going straight into JSON | `Object.groupBy` | a `Map` does not serialise ([09 · `JSON`](../09-json/README.md)) |
| going into more `Map` work | `Map.groupBy` | no conversion |

## Surprise one — the result has no prototype

```js
const groups = Object.groupBy(orders, (o) => o.status);

groups.paid;                        // ✅ works
groups.hasOwnProperty("paid");      // 🔴 TypeError: not a function
Object.hasOwn(groups, "paid");      // ✅ true
```

**`Object.groupBy` returns an object created with a `null` prototype** — the same
construction as `Object.create(null)`
([Phase 4 · 14 · 02](../../phase-4-objects-and-classes/14-object-creation-patterns/02-object-create-and-dictionaries.md)).
It is deliberate and it is the right call: a group named `"constructor"`, `"toString"` or
`"__proto__"` would otherwise collide with something inherited, and grouping is exactly
the operation whose keys come from data.

⚠️ **What this actually breaks in practice:**

- `groups.hasOwnProperty(...)` and `groups.toString()` throw. Use `Object.hasOwn` and
  `String(...)`.
- Older library code that calls `.hasOwnProperty` on the object you pass it will throw.
- Node's console prints it as `[Object: null prototype] { … }`, which looks alarming and
  is fine.
- `JSON.stringify(groups)` **works normally** — it never consults the prototype.

**If you need an ordinary object**, spread it — spread creates a fresh object with the
standard prototype:

```js
const normal = { ...Object.groupBy(orders, (o) => o.status) };
normal.hasOwnProperty("paid");   // ✅ true
```

## Surprise two — keys are coerced to property keys

Every key that is not already a string or a symbol goes through the same coercion any
property key does, and **that is where grouping quietly goes wrong**:

```js
Object.groupBy(items, (i) => i.owner);
// 🔴 every plain object becomes the key "[object Object]" — one giant group

Object.groupBy(items, (i) => i.createdAt);
// 🔴 a Date becomes its full toString() — including the time, so "by day" never happens

Object.groupBy([1, "1"], (v) => v);
// 🔴 { "1": [1, "1"] } — the number and the string share a key
```

**`Map.groupBy` has none of this**, because a `Map` compares keys with SameValueZero and
stores them as they are:

```js
Map.groupBy(items, (i) => i.owner);   // ✅ one entry per owner object
```

🔴 **But `Map.groupBy` does not rescue the `Date` case either**, and this is the trap
worth remembering. `Map` compares objects by *reference*, so two `Date` objects for the
same instant are two different keys:

```js
Map.groupBy(events, (e) => e.at);     // 🔴 one group per Date object — no grouping at all
```

✅ **The fix for both is the same: derive a key that is a value, not an object.**

```js
Object.groupBy(events, (e) => e.at.toISOString().slice(0, 10));   // "2026-08-15"
Object.groupBy(items,  (i) => i.owner.id);
```

**The general rule: group by an id or a normalised string, and keep the object in the
group rather than in the key.** It survives serialisation, it reads in a debugger, and it
works identically in both functions.

## Where neither built-in helps

`groupBy` produces **arrays of the original elements**. The moment you want anything
else — a count, a sum, a `Set` — you are back to `reduce` or a plain loop, because there
is no reducing form:

```js
// counts
const counts = new Map();
for (const o of orders) counts.set(o.status, (counts.get(o.status) ?? 0) + 1);

// sums
const totals = new Map();
for (const o of orders) totals.set(o.status, (totals.get(o.status) ?? 0) + o.amount);
```

⚠️ **Do not group and then map over the groups when a count is all you wanted** — that
allocates every element into an array only to throw the arrays away.

The frequency-map pattern in full, multi-level grouping, and the composite-key
alternative are at
[Phase 14 · 03 · 02 · Grouping and the built-ins](../../phase-14-data-structures/03-frequency-and-grouping/02-grouping-built-ins.md).

**And the four lines the built-ins replace**, still worth being able to write:

```js
const groupBy = (items, fn) =>
  items.reduce((acc, item) => {
    const key = fn(item);
    (acc[key] ??= []).push(item);
    return acc;
  }, Object.create(null));
```

## The statics that do not exist

🔴 **There is no `Object.map`, `Object.filter`, `Object.forEach` or `Object.size`.** This
is the single most common "where is it?" about the namespace, and the answer is that
objects are not collections — arrays and `Map`s are, and objects are records.

**The replacement is the `entries` round trip:**

```js
const prices = { apple: 100, pear: 250 };

// map
Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, v * 2]));
// { apple: 200, pear: 500 }

// filter
Object.fromEntries(Object.entries(prices).filter(([, v]) => v > 150));
// { pear: 250 }

// forEach
for (const [k, v] of Object.entries(prices)) console.log(k, v);

// size
Object.keys(prices).length;
```

⚠️ **The round trip silently drops things** — symbol keys, non-enumerable properties, the
prototype, and any two keys that map to the same name collapse into one. The full list of
seven, and the cases where you should use a `Map` instead, are in
[Phase 4 · 08 · 02 · Transforming objects](../../phase-4-objects-and-classes/08-keys-values-entries/02-transforming-objects.md).

**And the conversions in each direction**, because they are the same two functions:

```js
new Map(Object.entries(obj));    // object → Map
Object.fromEntries(map);         // Map → object
Object.fromEntries(formData);    // and anything else iterable of pairs
```

## Gotchas

**Symptom:** `TypeError: groups.hasOwnProperty is not a function`
**Cause:** `Object.groupBy` returns a null-prototype object.
**Fix:** `Object.hasOwn(groups, key)`, or `{ ...groups }` for an ordinary object.

**Symptom:** Everything landed in one group called `[object Object]`
**Cause:** The callback returned an object, and object keys are coerced to strings.
**Fix:** Return an id or a normalised string — or use `Map.groupBy`.

**Symptom:** Grouping by `Date` produced one group per record
**Cause:** `Object.groupBy` stringifies the whole date including the time;
`Map.groupBy` compares `Date` objects by reference. Both give a unique key per record.
**Fix:** `d.toISOString().slice(0, 10)` for a day, or any explicit normalised key.

**Symptom:** `1` and `"1"` grouped together
**Cause:** Property-key coercion — everything becomes a string.
**Fix:** `Map.groupBy`, which keeps the values distinct.

**Symptom:** `JSON.stringify` of a grouped result gave `{}`
**Cause:** It was a `Map` from `Map.groupBy`, not an object.
**Fix:** `Object.fromEntries(map)` first — and only if the keys are strings.

**Symptom:** `Object.groupBy is not a function`
**Cause:** ES2024; the target engine is older.
**Fix:** The four-line `reduce` above.

**Symptom:** Looking for `Object.map`
**Cause:** It does not exist — objects are records, not collections.
**Fix:** `Object.fromEntries(Object.entries(o).map(…))`, or hold the data in a `Map`.

## Interview questions

**★ What is the difference between `Object.groupBy` and `Map.groupBy`?**
The container, and therefore what a key may be. `Object.groupBy` returns a
**null-prototype object** and coerces every key to a string, so objects collapse to
`"[object Object]"` and `1` collides with `"1"`. `Map.groupBy` returns a `Map`, compares
keys with SameValueZero and keeps them as they are. Strings → `Object.groupBy`; anything
else → `Map.groupBy`.

**★ Why does `Object.groupBy` return an object with no prototype?**
Because the keys come from data. A group legitimately named `"constructor"`,
`"toString"` or `"__proto__"` would otherwise collide with inherited properties. The cost
is that `hasOwnProperty` and `toString` are not there — use `Object.hasOwn`, or spread the
result if you need an ordinary object.

**★ How do you group records by day?**
Not by the `Date`. `Object.groupBy` stringifies it with the time included and `Map.groupBy`
compares it by reference, so both give a unique key per record. Derive a value key —
`d.toISOString().slice(0, 10)` — and group on that.

**★ Why is there no `Object.map`?**
Because an object is a record, not a collection — the collection types are array and
`Map`. The idiom is `Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]))`,
which quietly drops symbol keys, non-enumerable properties and the prototype, and
collapses duplicate keys.

**Can you write `groupBy` yourself?**
`items.reduce((acc, item) => { const k = fn(item); (acc[k] ??= []).push(item); return acc; }, Object.create(null))`.
The `Object.create(null)` seed is what the built-in does too, and for the same reason.

**When do the built-ins stop being enough?**
As soon as you want anything but arrays of the original elements — counts, sums, `Set`s.
There is no reducing form, so a `Map` and a loop is the answer, and grouping first only to
discard the arrays is wasted allocation.

---

← [3 · Descriptors, and faithful copies](./03-descriptors-and-faithful-copies.md) · [Topic index](./README.md) · [Phase index](../README.md) →
