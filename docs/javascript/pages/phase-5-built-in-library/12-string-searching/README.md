---
title: "12 · String searching"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`String.prototype.includes()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes), [`String.prototype.indexOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/indexOf), [`String.prototype.localeCompare()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare), [`Intl.Collator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator), [`String.prototype.normalize()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize). Documentation-validated; **no timings**.

Finding a substring is four methods and one classic bug. **Comparing text that a human will read is
a different subject entirely**, and it is where the interesting failures live: a sorted list with
the capitals first, `file10` before `file2`, and two identical-looking names that are not `===`.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Finding a substring](./01-finding-a-substring.md)** | `includes` vs `indexOf` and the index-0 falsy bug, the position arguments (including `endsWith`'s *end* position), why `includes` throws on a regex while `indexOf` stringifies it, case-insensitive search and the Turkish dotless `ı`, and `charAt` vs `at` |
| 2 | **[Comparing and sorting human text](./02-comparing-and-sorting.md)** | Why `sort()` is not alphabetical, `localeCompare` and locale-dependent order, building one `Intl.Collator` with `numeric` and `sensitivity`, Unicode normalisation and why `"café" !== "café"`, and code units vs code points vs graphemes |

## Phase gate

You are done with this topic when you can say **why `["Zebra", "apple"].sort()` puts `Zebra`
first**, and **why two identical-looking strings can fail `===`**.

## Where this connects

- [07 · String methods](../07-string-methods/README.md) — slicing, splitting, replacing
- [06 · `sort`](../06-sort/README.md) — the comparator contract `localeCompare` satisfies
- [03 · `slice` vs `splice` vs `at`](../03-slice-splice-at.md) — `at` and negative indices on strings too
- [Phase 4 · 15 · Normalising untrusted shapes](../../phase-4-objects-and-classes/15-normalising-untrusted-shapes/02-normalising-at-the-boundary.md) — where `normalize()` belongs
- **15 / 16 · Regular expressions** *(not written yet)* — for anything that is a pattern rather than a substring
- **20 · `Intl`** *(not written yet)* — `Collator` in the context of the whole `Intl` family

---

Start → [Finding a substring](./01-finding-a-substring.md)
