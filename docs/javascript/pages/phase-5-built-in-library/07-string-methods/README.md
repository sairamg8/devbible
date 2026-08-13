---
title: "07 · String methods"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`substring`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/substring), [`slice`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/slice), [`at`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/at), [`split`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/split), [`replaceAll`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replaceAll), [`padStart`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart), [`trim`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/trim). Documentation-validated.

**Strings are immutable**, so nothing here mutates and no defensive copying is ever
needed. What is left is choosing between near-identical methods — and two of the
choices have real consequences.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Slicing and splitting](./01-slicing-and-splitting.md)** | `slice` vs `substring` on both documented edge cases, `at(-1)`, `split`'s three surprises (`[""]`, the truncating `limit`, no-separator), and why `split("")` breaks emoji where `[...str]` does not |
| 2 | **[Trimming, padding and replacing](./02-trimming-padding-replacing.md)** | The trim family, `padStart`'s target-length semantics and truncated pad, `repeat`'s `RangeError`, **`replace` replacing only the first match**, `replaceAll`'s `TypeError` on a non-global regex, why a string pattern beats a built regex, the `$` replacement patterns, and locale-dependent case |

## The two decisions

```js
text.substring(5, 2);   // "zil" — SWAPS the arguments, hiding the bug
text.slice(5, 2);       // ""    — use slice

"a-b-c".replace("-", "+");     // "a+b-c"  ← only the FIRST
"a-b-c".replaceAll("-", "+");  // "a+b+c"
```

🔴 **Use `slice`, not `substring`.** 🔴 **Never build a regex from user input** —
`replaceAll` with a string matches literally, and a user-supplied pattern is both a
correctness bug and a backtracking DoS vector.

## Phase gate

You are done with this topic when you can name both differences between `slice` and
`substring`, say what `"".split(",")` returns, and explain why
`replaceAll(name, "[REDACTED]")` is safer than building a regex from `name`.

## Where this connects

- [01 · Making arrays](../01-array-creation-and-shape/01-making-arrays.md) — `Array.from(str)` and spread yield code points where `split("")` yields code units
- [04 · Array iteration methods](../04-array-iteration-methods/README.md) — `split` then `map` is the usual parsing shape
- [Phase 1 · Values, types and coercion](../../phase-1-values-and-coercion/README.md) — why `"👍".length` is `2`

---

Start → [Slicing and splitting](./01-slicing-and-splitting.md)
