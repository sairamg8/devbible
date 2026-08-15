---
title: "15 · Regular expressions — the syntax"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Regular expressions guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions), [Character classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Character_class), [Quantifiers](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Quantifier), [Groups and backreferences](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Groups_and_backreferences), [Assertions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Assertions). Documentation-validated; **no timings**.

A pattern is built from three kinds of piece — **what to match**, **how many times**, and **where** —
plus a way to **structure** them into groups and alternatives. That is the whole syntax, and it is
what this topic covers. Using it (`test` vs `match` vs `matchAll`, the flags, the `lastIndex` trap,
replacement callbacks, catastrophic backtracking) is **16 · Regular expressions — in practice**
*(not written yet)*.

**Two facts cause a disproportionate share of real regex bugs**, and both are in chunk 1: `.` does
not match a newline, and `\w` is ASCII-only — so `^\w+$` rejects every accented name.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Characters, quantifiers and anchors](./01-characters-and-quantifiers.md)** | Literals and character classes, `\d`/`\w`/`\s` and their ASCII limits, `\p{L}` with the `u` flag, greedy vs lazy quantifiers and why a negated class is often better than either, anchors and `\b`, and escaping user input safely |
| 2 | **[Groups, alternation and lookaround](./02-groups-and-lookaround.md)** | Capturing vs non-capturing, named groups and `$<name>`, backreferences, why `/^cat\|dog$/` is a bug, ordered alternation, the four lookaround forms with the two idioms worth memorising, and optional groups producing `undefined` |

## Phase gate

You are done with this topic when you can say **why `^\w+$` rejects `Müller`**, and **what
`/^cat|dog$/` actually means**.

## Where this connects

- [12 · String searching](../12-string-searching/README.md) — `includes`/`startsWith`, which answer most questions without a regex at all
- [07 · String methods](../07-string-methods/README.md) — `split`, `replace` and `replaceAll`
- [08 · Template literals](../08-template-literals/README.md) — `String.raw` for writing patterns as strings
- **16 · Regular expressions — in practice** *(not written yet)* — the methods, the flags, and the traps in using a pattern

---

Start → [Characters, quantifiers and anchors](./01-characters-and-quantifiers.md)
