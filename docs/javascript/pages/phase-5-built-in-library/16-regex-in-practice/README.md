---
title: "16 · Regular expressions — in practice"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`RegExp`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp), [`RegExp.prototype.lastIndex`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/lastIndex), [`String.prototype.matchAll()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/matchAll), [`String.prototype.replace()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace), [Advanced searching with flags](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Advanced_searching_with_flags). Documentation-validated; **no timings**.

[15 · the syntax](../15-regex-syntax/README.md) is what a pattern means. **This topic is what
happens when you use one** — and almost every failure here is about the *API* rather than the
pattern.

Two of them account for most of the lost time: a `g`-flagged regex is **stateful**, so `test` on the
same string alternates `true`/`false`; and a pattern with nested quantifiers can take exponential
time on input that nearly matches, which on Node blocks the whole process.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The methods, the flags, and `lastIndex`](./01-the-methods-and-flags.md)** | Which method answers which question, why `match` with `g` throws away your capture groups, the `lastIndex` trap in its three usual shapes and the fix that actually works, all eight flags, and reading a match object |
| 2 | **[Replacing, and what goes wrong](./02-replacing-and-what-goes-wrong.md)** | `replace` vs `replaceAll`, the replacement mini-syntax and why user-supplied replacement text is dangerous, the callback form, catastrophic backtracking and why JavaScript is exposed to it, and the four places a regex is the wrong tool |

## Phase gate

You are done with this topic when you can say **why `test` can return `false` for a string it just
matched**, and **what makes `/^(a+)+$/` dangerous**.

## Where this connects

- [15 · Regular expressions — the syntax](../15-regex-syntax/README.md) — what the pattern itself means
- [12 · String searching](../12-string-searching/README.md) — the methods that answer most questions without a regex
- [07 · String methods](../07-string-methods/README.md) — `split`, `trim`, `replace` on plain strings
- [Phase 4 · 15 · Normalising untrusted shapes](../../phase-4-objects-and-classes/15-normalising-untrusted-shapes/README.md) — validation that belongs at the boundary, and why email is not a regex problem

---

Start → [The methods, the flags, and `lastIndex`](./01-the-methods-and-flags.md)
