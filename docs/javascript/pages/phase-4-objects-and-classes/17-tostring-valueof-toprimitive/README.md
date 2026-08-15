---
title: "17 · `toString`, `valueOf`, `Symbol.toPrimitive`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [`Symbol.toPrimitive`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toPrimitive), [`Object.prototype.toString()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/toString), [`Object.prototype.valueOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/valueOf), [`Date.prototype[Symbol.toPrimitive]()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Symbol.toPrimitive), [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify). Documentation-validated; **no timings**.

**You will not write a `Symbol.toPrimitive` this year, and you will read code whose behaviour
depends on one this week.** This is a reading skill: what the engine does when an object turns up
where a string or a number was expected.

One algorithm answers all of it — `Symbol.toPrimitive` if the object has it, otherwise `toString`
and `valueOf` **in an order the context decides**. Get the order right and `"[object Object]"`,
`NaN` from arithmetic, and the difference between `date1 - date2` and `date1 + date2` all stop being
mysteries.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The ToPrimitive protocol](./01-the-toprimitive-protocol.md)** | The three steps, the hint table and which operators produce which hint, why `obj + ""` does not call `toString`, the useless defaults on `Object.prototype`, arrays and `"1,23"`, the `Date` exception, `==` vs `===`, and symbols refusing |
| 2 | **[Implementing it, and the protocols it is not](./02-implementing-and-the-neighbours.md)** | Why one `Symbol.toPrimitive` beats a `toString`/`valueOf` pair, when it is worth it, and the three neighbouring mechanisms it is confused with — `toJSON`, `Symbol.toStringTag`, and debugger output — plus `sort()`'s string coercion |

## Phase gate

You are done with this topic when you can say **why `date1 - date2` is a number and `date1 + date2`
is a string**, and **why a class with `#private` fields and no `toJSON` serialises to `{}`**.

## Where this connects

- [Phase 1 · Values, types and coercion](../../phase-1-values-and-coercion/README.md) — coercion between primitives, which this sits on top of
- [02 · Property access](../02-property-access.md) — every key is stringified, which is the same protocol
- [06 · `class`](../06-class/README.md) — `#private` fields, and why they make `toJSON` necessary
- [13 · `instanceof` and `Symbol.hasInstance`](../13-instanceof-and-hasinstance/02-where-it-fails.md) — `Symbol.toStringTag` and why `Object.prototype.toString` can lie
- [Phase 5 · The built-in library](../../phase-5-built-in-library/README.md) — `sort()`, `Intl.NumberFormat`, and `JSON` in full

---

Start → [The ToPrimitive protocol](./01-the-toprimitive-protocol.md)
