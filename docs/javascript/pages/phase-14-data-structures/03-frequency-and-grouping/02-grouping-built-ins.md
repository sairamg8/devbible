---
title: "03.2 · Grouping, and the built-ins"
sidebar_label: "02 · Grouping built-ins"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Object.groupBy()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy), [`Map.groupBy()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/groupBy), [null-prototype objects](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object#null-prototype_objects), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map). Documentation-validated; **no timings**.

**Grouping is counting with the items kept.** The hand-written version is four lines and worth
knowing; the built-ins are newer, and choosing between the two of them is a real decision with a
coercion trap in it.

## The hand-written version

```js
function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}
```

O(n), one pass, and it works everywhere. The `has`/`set`/`get` dance is the get-or-create idiom
from [02 · Using the built-ins](../02-hash-maps-and-sets/01-using-the-built-ins.md) — remember
`map.get(k) ??= []` is not valid syntax, because `get` is a call and not an assignable reference.

## `Object.groupBy` — for string keys

MDN:

> "The **`Object.groupBy()`** static method groups the elements of a given iterable according to
> the **string values** returned by a provided callback function. The returned object has separate
> properties for each group, containing arrays with the elements in the group."

```js
const byRole = Object.groupBy(users, (user) => user.role);
// { admin: [...], editor: [...] }
```

Two properties of the result that are easy to miss:

🔴 **The returned object has a `null` prototype.** MDN describes it as *"A null-prototype object
with properties for all groups"*. That is deliberate and helpful — a group named `"constructor"`
or `"toString"` is just a key, with nothing inherited to collide with — but it means the result
has **no `hasOwnProperty`, no `toString`**, and it does not behave like a normal object literal.

```js
const g = Object.groupBy(items, fn);
g.hasOwnProperty("admin");        // ❌ TypeError: g.hasOwnProperty is not a function
Object.hasOwn(g, "admin");        // ✅
"admin" in g;                     // ✅
```

🔴 **Keys are coerced to strings.** MDN: *"The callback function should return a string or symbol
(values that are neither type are **coerced to strings**)"*. So a callback returning a number
gives you `"1"`, `true` gives `"true"`, and **an object gives `"[object Object]"` — collapsing
every object key into one group**.

That coercion is the reason the second method exists.

## `Map.groupBy` — for keys of any type

```js
const byDate = Map.groupBy(orders, (order) => startOfDay(order.createdAt));   // Date keys
const byUser = Map.groupBy(posts, (post) => post.author);                     // object keys
```

MDN's own guidance on choosing:

> "This method should be used when group names can be represented by **strings**. If you need to
> group elements using a key that is **some arbitrary value**, use `Map.groupBy()` instead."

The `Map` version keeps keys as they are — objects by identity, numbers as numbers, `NaN` as a
usable key (SameValueZero) — and gives you `size` and insertion-ordered iteration.

⚠️ **Grouping by `Date` objects needs care even with `Map.groupBy`**: two `Date` objects for the
same instant are different objects, so they are different keys. Group by a canonical *value* —
`date.toISOString().slice(0, 10)`, or the timestamp — not by a fresh `Date`.

**The rule:** string-ish group names → `Object.groupBy`. Anything else, or when you want `size`
and ordered iteration → `Map.groupBy`. When neither is available, the four-line helper above.

## Availability, honestly

Both are recent additions (ES2024). They are not present in older runtimes, and a polyfill or the
hand-written helper is the fallback. ⚠️ **Check support for your target environments rather than
assuming** — this is exactly the kind of claim that ages, and the four-line version costs nothing.

## Grouping into something other than arrays

The built-ins always give you arrays. When you want a different accumulation — a sum, a count, a
`Set` — the hand-written form is the answer, and it is the same shape:

```js
// sum per group
const totals = new Map();
for (const o of orders) totals.set(o.userId, (totals.get(o.userId) ?? 0) + o.amount);

// set per group — deduplicating as you go
const tagsByPost = new Map();
for (const { postId, tag } of rows) {
  if (!tagsByPost.has(postId)) tagsByPost.set(postId, new Set());
  tagsByPost.get(postId).add(tag);
}
```

🔴 **Grouping then reducing each group is two passes and often unnecessary.** If the answer is a
sum, accumulate the sum directly; building arrays only to `reduce` them allocates every item twice
for nothing.

## Multi-level grouping

```js
const byYearThenMonth = new Map();
for (const row of rows) {
  const [y, m] = [row.date.getFullYear(), row.date.getMonth()];
  if (!byYearThenMonth.has(y)) byYearThenMonth.set(y, new Map());
  const inner = byYearThenMonth.get(y);
  inner.set(m, [...(inner.get(m) ?? []), row]);      // ⚠️ see below
}
```

⚠️ **That last line is the quadratic trap again** — `[...(inner.get(m) ?? []), row]` copies the
group's array on every row. Push instead:

```js
if (!inner.has(m)) inner.set(m, []);
inner.get(m).push(row);
```

**For two or three levels, a composite key is usually simpler than nesting:**

```js
const key = `${y}-${m}`;                    // one flat Map
```

…as long as the parts cannot contain the separator, which is the standard composite-key caveat.

## Gotchas

**Symptom:** `groups.hasOwnProperty(...)` throws
**Cause:** `Object.groupBy` returns a **null-prototype** object.
**Fix:** `Object.hasOwn(groups, key)` or the `in` operator.

**Symptom:** Every object key groups together
**Cause:** `Object.groupBy` coerces keys to strings — MDN: values that are neither string nor
symbol are *"coerced to strings"* — so objects become `"[object Object]"`.
**Fix:** `Map.groupBy`.

**Symptom:** Grouping by `Date` produces one group per row
**Cause:** Each `Date` object is a distinct key by identity.
**Fix:** Group by a canonical value — an ISO date string or a timestamp.

**Symptom:** Numeric group keys arrive as strings
**Cause:** Same coercion.
**Fix:** `Map.groupBy`, or accept the strings deliberately.

**Symptom:** `Object.groupBy is not a function`
**Cause:** ES2024; older runtimes do not have it.
**Fix:** The four-line helper, or a polyfill.

**Symptom:** Multi-level grouping is slow
**Cause:** `[...(inner.get(m) ?? []), row]` copies each group on every row — O(n²).
**Fix:** `push` into the existing array.

**Symptom:** `map.get(k) ??= []` is a syntax error
**Cause:** Logical assignment needs an assignable reference.
**Fix:** `has`/`set`/`get`.

**Symptom:** Composite keys collide
**Cause:** A part of the key contained the separator.
**Fix:** Choose a separator the data cannot contain, or nest `Map`s.

## Interview questions

**★ Write `groupBy` by hand.**
A `Map`, one pass, get-or-create: if the key is absent set it to `[]`, then push. O(n). Note that
`map.get(k) ??= []` is not valid — `get` is a call, not an assignable reference.

**★ `Object.groupBy` or `Map.groupBy`?**
MDN's own rule: `Object.groupBy` *"should be used when group names can be represented by
strings"*; if the key is *"some arbitrary value"*, use `Map.groupBy`. The `Map` version keeps keys
as objects, numbers or `NaN`, and gives you `size` and insertion order.

**★ What is surprising about `Object.groupBy`'s return value?**
It is a **null-prototype object** — so `hasOwnProperty` and `toString` are absent, and
`Object.hasOwn` or `in` is required. The upside is that a group called `"constructor"` is just a
key.

**★ Why does grouping objects with `Object.groupBy` put everything in one group?**
Keys are coerced to strings, and every plain object coerces to `"[object Object]"`. That coercion
is precisely why `Map.groupBy` exists.

**★ You group by `Date` and get one group per row. Why?**
Two `Date` objects for the same instant are distinct objects, and `Map` keys compare by identity.
Group by a canonical value — an ISO string or the timestamp.

**★ When would you not use either built-in?**
When the accumulation is not an array — a sum, a count, a `Set` per key — or when the runtime is
older than ES2024. Both cases are the same four-line loop, which is why it is worth knowing.

**What is wrong with grouping and then reducing each group?**
It is two passes and allocates every item into an array that is immediately discarded. If the
answer is a sum, accumulate the sum directly.

---

← [01 · The frequency map](./01-the-frequency-map.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
