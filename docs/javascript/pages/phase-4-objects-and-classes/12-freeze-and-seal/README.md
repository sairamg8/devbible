---
title: "12 · `Object.freeze` and `seal`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Object.freeze()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze), [`Object.seal()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/seal), [`Object.preventExtensions()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/preventExtensions), [Strict mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode), [Private properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties). Documentation-validated; **no timings**.

**Both are shallow, and both fail silently unless you are in strict mode.** Those two sentences
account for nearly every "I froze it and it changed anyway" report.

Underneath, all of this is [property descriptors](../11-property-descriptors.md): `seal` clears
`configurable` on every own property, `freeze` clears `writable` as well, and both set the object
itself to non-extensible. There is no separate immutability mode in the engine — which is exactly
why the guarantee stops where properties stop.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The three levels, and how they fail](./01-the-three-levels.md)** | `preventExtensions` vs `seal` vs `freeze` as a table, what each sets in descriptor terms, the immutable prototype, silent no-op vs `TypeError`, the `isFrozen` answer that looks wrong, and when `seal` is genuinely the right call |
| 2 | **[Shallow — what freeze cannot reach](./02-what-freeze-cannot-reach.md)** | Nested objects, arrays (and why `push` throws when an index assignment does not), `Map`/`Set`/`Date` internal slots, `#private` fields, setters that still run, and why every copy comes out unfrozen |
| 3 | **[Deep freeze, and the alternatives](./03-deep-freeze-and-alternatives.md)** | The three bugs in the naive `deepFreeze`, the version to actually use, the honest costs, dev-only freezing, and how freeze compares with `readonly`, copy-on-read and structural sharing |

## Phase gate

You are done with this topic when you can say **why a frozen object's nested property still
changed**, **what makes the failure silent in one file and a `TypeError` in another**, and **what a
deep freeze still cannot protect**.

## Where this connects

- [11 · Property descriptors](../11-property-descriptors.md) — the flags all three levels set
- [04 · Shallow vs deep copy](../04-shallow-vs-deep-copy/README.md) — the same shallow/deep seam, and how to get a mutable copy back
- [06 · `class`](../06-class/README.md) — `#private` fields, which freezing cannot see
- [10 · Getters and setters](../10-getters-and-setters.md) — why an accessor survives a freeze
- [Phase 3 · 17 · Merging, forwarding and identity](../../phase-3-functions/17-closure-and-default-gotchas/02-merging-forwarding-and-identity.md) — the shared-default-object bug a freeze catches
- **15 · Normalising untrusted shapes** *(not written yet)* — what to do with a payload instead of freezing it
- **16 · Prototype patterns to avoid** *(not written yet)* — hardening `Object.prototype` against pollution

---

Start → [The three levels, and how they fail](./01-the-three-levels.md)
