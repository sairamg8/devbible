---
title: "06 · `class`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes), [`static`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/static), [Static initialization blocks](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Static_initialization_blocks), [Private elements](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_elements). Documentation-validated.

**"`class` is just syntactic sugar over prototypes" is half true, and the half that
is false is the half worth knowing.** The lookup machinery is unchanged — methods go
on `Ctor.prototype`, exactly as in
[05 · The prototype chain](../05-the-prototype-chain/README.md). Everything else it
adds is a real language feature.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What `class` desugars to](./01-what-class-desugars-to.md)** | The part that is sugar, the five parts that are not, instance fields vs prototype methods and why mutable defaults must be fields, the arrow-function-field idiom, and field initialisation order in base vs derived classes |
| 2 | **[Static members and accessors](./02-static-and-accessors.md)** | The three destinations in one class body, why `instance.staticThing` is `undefined`, `this` as the class in a static method, static initialization blocks, and the accessor recursion trap |
| 3 | **[Private elements](./03-private-elements.md)** | `SyntaxError` outside the class and `TypeError` on the wrong object, no deletion and no assignment-creation, the shared unique namespace, why they are **not inherited**, the brand check, and what privacy does *not* buy |

## The five things that are not sugar

1. The body is **always strict**, with no opt-out.
2. Calling without `new` is a **`TypeError`**, not a silent misbehaviour.
3. Methods are **non-enumerable**; hand-assigned prototype methods are not.
4. Declarations are **block-scoped and in the TDZ**, and never touch `globalThis`.
5. **Private elements** exist, and have no desugaring at all.

## Where things live

| Written as | Lives on | Copies |
|---|---|---|
| `field = 1` | each instance (own property) | one per instance |
| `method() {}` | `Ctor.prototype` | one, shared |
| `static x = 1` | the class object | one |
| `#field` | each instance, in a private slot | one per instance, not inherited |

## Phase gate

You are done with this topic when you can name three things `class` does that
assigning to `.prototype` cannot, say why `items = []` must be a field rather than a
prototype property, and explain why a subclass cannot read the parent's `#field`.

## Where this connects

- [05 · The prototype chain](../05-the-prototype-chain/README.md) — the machinery `class` is sugar over
- [03 · brand checks](../03-existence-checks-and-delete/02-undefined-holes-and-brand-checks.md) — `#x in obj`, and why it beats `instanceof`
- [04 · `structuredClone`](../04-shallow-vs-deep-copy/02-structuredclone.md) — which drops the prototype and does not duplicate private elements
- [Phase 3 · 08 · Classes and circular imports](../../phase-3-functions/08-hoisting-and-tdz/06-classes-and-circular-imports.md) — the class TDZ, the const-like inner binding, and `extends` ordering

---

Start → [What `class` desugars to](./01-what-class-desugars-to.md)
