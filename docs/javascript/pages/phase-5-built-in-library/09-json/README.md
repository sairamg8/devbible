---
title: "09 · `JSON.parse` and `JSON.stringify`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify), [`JSON.parse`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse). Documentation-validated.

**`JSON.stringify` is lossy, and it is lossy silently.** It throws on exactly two
things — `BigInt` and cycles — and quietly discards or transforms half a dozen others.
The `reviver` on the parse side is the only place to repair the damage.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[`JSON.stringify` and what it drops](./01-stringify.md)** | The silent losses — `undefined`/functions/symbols **omitted in objects but nulled in arrays**, `NaN`/`Infinity` → `null`, `Date` → string, `Map`/`Set` → `{}`, symbol keys and non-enumerables skipped, prototype lost — the two `TypeError`s, `toJSON`, both `replacer` forms, and why it is not a deep-equality check |
| 2 | **[`JSON.parse` and the reviver](./02-parse-and-the-reviver.md)** | `SyntaxError` on trailing commas, single quotes and empty bodies; the reviver's **return-`value`-or-lose-it** rule; the **innermost-first** call order; reviving dates; `context.source` for 64-bit precision; and why the parse itself is safe from prototype pollution |

## The shape of the losses

```js
JSON.stringify({ x: [10, undefined, function(){}, Symbol("")] });
// '{"x":[10,null,null,null]}'    ← nulled in an array
JSON.stringify({ x: undefined, y: Object, z: Symbol("") });
// '{}'                            ← omitted in an object
```

Same values, opposite treatment. `JSON.stringify` sees exactly the set `Object.keys`
sees: own, enumerable, string-keyed.

## The reviver rule

```js
JSON.parse(text, (key, value) => {
  if (key.endsWith("At")) return new Date(value);
  return value;                      // ← REQUIRED, or everything else is deleted
});
```

## Phase gate

You are done with this topic when you can name what `stringify` drops versus what it
throws on, explain why a reviver must end with `return value`, and say why
`JSON.parse` is not the prototype-pollution vulnerability.

## Where this connects

- [Phase 4 · 04 · JSON round trips and hand-written clones](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/03-json-and-hand-written.md) — the same losses, viewed as a cloning technique, and `structuredClone` as the better one
- [Phase 4 · 08 · What they include](../../phase-4-objects-and-classes/08-keys-values-entries/01-what-they-include.md) — the own/enumerable/string-keyed set `stringify` shares with `Object.keys`
- [Phase 4 · 01 · `__proto__` and null-prototype objects](../../phase-4-objects-and-classes/01-object-literals/04-proto-and-null-prototype.md) — where prototype pollution actually happens

---

Start → [`JSON.stringify` and what it drops](./01-stringify.md)
